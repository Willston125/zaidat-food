-- =========================================================
-- ZAIDAT FOOD — Installation et sécurisation de la base
-- ---------------------------------------------------------
-- À copier-coller EN ENTIER dans Supabase :
--   votre projet → SQL Editor → New query → Coller → Run
--
-- Ce script est IDEMPOTENT et NON DESTRUCTIF :
--   • il peut être relancé autant de fois que nécessaire ;
--   • il ne supprime aucun produit, aucun réglage, aucune
--     photo et aucun compte utilisateur ;
--   • il fonctionne aussi bien sur une base déjà remplie que
--     sur une installation neuve.
--
-- ⚠️ APRÈS LE PREMIER LANCEMENT, une action est obligatoire :
--    déclarer la cuisinière comme administratrice (étape 8 en
--    bas de ce fichier). Tant que ce n'est pas fait, PERSONNE
--    ne peut modifier le site — c'est voulu.
-- =========================================================


-- ---------------------------------------------------------
-- 1. Table des produits
-- ---------------------------------------------------------
create table if not exists produits (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text unique not null,        -- adresse de la fiche (ex. samoussas)
  nom                    text not null,
  description_courte     text default '',
  description            text default '',
  prix                   integer,                     -- en KMF ; vide = « prix sur demande »
  categorie              text not null,
  image_produit          text default '',             -- photo du produit seul
  image_produit_petite   text default '',             -- même photo, version légère
  image_lifestyle        text default '',             -- photo avec la cuisinière
  image_lifestyle_petite text default '',
  disponible             boolean default true,
  en_avant               boolean default false,
  populaire              boolean default false,
  temps_preparation      text default '',
  portions               text default '',
  options                jsonb default '[]'::jsonb,
  ordre                  integer default 0,           -- ordre d'affichage dans le menu
  cree_le                timestamptz default now()
);

-- Le site trie par `ordre` : un index accélère l'affichage du menu.
create index if not exists produits_ordre_idx on produits (ordre);

-- Date de dernière modification. Elle sert au dashboard à détecter
-- qu'un autre appareil a enregistré entre-temps, et à refuser
-- d'écraser un travail plus récent (voir étape 5).
alter table produits add column if not exists modifie_le timestamptz default now();

-- Les lignes déjà présentes n'ont pas de date : on leur en donne une
-- sans toucher au reste de leur contenu.
update produits set modifie_le = coalesce(modifie_le, cree_le, now())
 where modifie_le is null;


-- ---------------------------------------------------------
-- 2. Table des réglages (textes du site, contact, horaires…)
-- ---------------------------------------------------------
create table if not exists reglages (
  cle          text primary key,       -- « site » ou « categories »
  valeur       jsonb not null,
  modifie_le   timestamptz default now()
);


-- ---------------------------------------------------------
-- 3. Qui a le droit de modifier le site
-- ---------------------------------------------------------
-- La clé « anon » du site est PUBLIQUE : elle est lisible par
-- n'importe quel visiteur, c'est normal et voulu. Elle ne doit
-- donc JAMAIS suffire à modifier quoi que ce soit.
--
-- Une simple connexion ne suffit pas non plus : si l'inscription
-- libre est active dans Supabase, n'importe qui pourrait créer un
-- compte. Le droit d'écriture est donc réservé aux comptes
-- explicitement inscrits dans la table ci-dessous.

create table if not exists administrateurs (
  id      uuid primary key references auth.users (id) on delete cascade,
  email   text,
  note    text,
  cree_le timestamptz default now()
);

alter table administrateurs enable row level security;

-- Une personne connectée peut savoir si ELLE est administratrice,
-- et rien d'autre. Aucune politique d'écriture n'est créée : la
-- table n'est donc modifiable QUE depuis le SQL Editor de Supabase.
-- Un utilisateur ordinaire ne peut pas s'y ajouter lui-même.
drop policy if exists "lecture de son propre acces" on administrateurs;
create policy "lecture de son propre acces"
  on administrateurs for select
  to authenticated
  using (id = auth.uid());

-- Fonction de contrôle utilisée par toutes les règles ci-dessous.
-- `security definer` lui permet de consulter la table complète,
-- alors que l'appelant n'en voit que sa propre ligne.
create or replace function public.est_administrateur()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.administrateurs a where a.id = auth.uid()
  );
$$;

-- La fonction est appelée à l'intérieur des règles de sécurité :
-- les rôles du site doivent pouvoir l'exécuter. Elle ne révèle
-- rien d'autre qu'un oui/non sur soi-même.
revoke all on function public.est_administrateur() from public;
grant execute on function public.est_administrateur() to anon, authenticated;


-- ---------------------------------------------------------
-- 4. Règles d'accès aux produits et aux réglages
-- ---------------------------------------------------------
-- Règle : tout le monde LIT (c'est un site public),
--         seules les administratrices ÉCRIVENT.

alter table produits enable row level security;
alter table reglages enable row level security;

-- Anciennes règles trop permissives des versions précédentes.
-- Elles autorisaient toute personne connectée à tout modifier.
drop policy if exists "ecriture connectee produits" on produits;
drop policy if exists "ecriture connectee reglages" on reglages;

-- --- Produits ---
drop policy if exists "lecture publique produits" on produits;
create policy "lecture publique produits"
  on produits for select
  to anon, authenticated
  using (true);

drop policy if exists "produits ajout administrateur" on produits;
create policy "produits ajout administrateur"
  on produits for insert
  to authenticated
  with check (public.est_administrateur());

drop policy if exists "produits modification administrateur" on produits;
create policy "produits modification administrateur"
  on produits for update
  to authenticated
  using (public.est_administrateur())
  with check (public.est_administrateur());

drop policy if exists "produits suppression administrateur" on produits;
create policy "produits suppression administrateur"
  on produits for delete
  to authenticated
  using (public.est_administrateur());

-- --- Réglages ---
drop policy if exists "lecture publique reglages" on reglages;
create policy "lecture publique reglages"
  on reglages for select
  to anon, authenticated
  using (true);

drop policy if exists "reglages ajout administrateur" on reglages;
create policy "reglages ajout administrateur"
  on reglages for insert
  to authenticated
  with check (public.est_administrateur());

drop policy if exists "reglages modification administrateur" on reglages;
create policy "reglages modification administrateur"
  on reglages for update
  to authenticated
  using (public.est_administrateur())
  with check (public.est_administrateur());

drop policy if exists "reglages suppression administrateur" on reglages;
create policy "reglages suppression administrateur"
  on reglages for delete
  to authenticated
  using (public.est_administrateur());


-- ---------------------------------------------------------
-- 5. Horodatage automatique des modifications
-- ---------------------------------------------------------
-- Le dashboard compare cette date avant d'enregistrer. Si un autre
-- appareil a écrit entre-temps, il refuse d'écraser et propose de
-- recharger. Sans ce garde-fou, un onglet resté ouvert pouvait
-- supprimer des produits ajoutés ailleurs.

create or replace function public.zf_touch_modifie_le()
returns trigger
language plpgsql
as $$
begin
  new.modifie_le := now();
  return new;
end;
$$;

drop trigger if exists produits_modifie_le on produits;
create trigger produits_modifie_le
  before insert or update on produits
  for each row execute function public.zf_touch_modifie_le();

drop trigger if exists reglages_modifie_le on reglages;
create trigger reglages_modifie_le
  before insert or update on reglages
  for each row execute function public.zf_touch_modifie_le();


-- ---------------------------------------------------------
-- 6. Stockage des photos
-- ---------------------------------------------------------
-- Un dossier public nommé « photos » : les visiteurs les voient,
-- seules les administratrices peuvent en ajouter ou en supprimer,
-- et uniquement dans les trois sous-dossiers attendus.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

-- Seuls ces chemins sont acceptés : produits/…, lifestyle/…,
-- galerie/… et affiches/…, avec une extension d'image. Tout le reste
-- est refusé, y compris les tentatives de remontée de dossier (« ../ »).
--
-- ATTENTION : relancer une ANCIENNE copie de ce fichier remplace cette
-- fonction par sa version d'alors, sans le moindre message. Les règles
-- ci-dessous, elles, sont identiques d'une version à l'autre : tout a
-- l'air en place, et pourtant l'envoi d'une photo est refusé. Prenez
-- toujours la version à jour du dépôt. Pour vérifier ce qui est
-- réellement installé :
--   select public.zf_chemin_photo_valide('affiches/photo-1080-abc.jpg');
create or replace function public.zf_chemin_photo_valide(nom text)
returns boolean
language sql
immutable
as $$
  select nom ~ '^(produits|lifestyle|galerie|affiches)/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|jpeg|png|webp)$'
     and nom !~ '\.\.';
$$;

revoke all on function public.zf_chemin_photo_valide(text) from public;
grant execute on function public.zf_chemin_photo_valide(text) to anon, authenticated;

drop policy if exists "photos lecture publique" on storage.objects;
create policy "photos lecture publique"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'photos');

-- Anciennes règles : toute personne connectée pouvait déposer
-- n'importe quel fichier. Remplacées ci-dessous.
drop policy if exists "photos ajout connecte" on storage.objects;
drop policy if exists "photos modification connectee" on storage.objects;
drop policy if exists "photos suppression connectee" on storage.objects;

drop policy if exists "photos ajout administrateur" on storage.objects;
create policy "photos ajout administrateur"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and public.est_administrateur()
    and public.zf_chemin_photo_valide(name)
  );

drop policy if exists "photos modification administrateur" on storage.objects;
create policy "photos modification administrateur"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'photos' and public.est_administrateur())
  with check (
    bucket_id = 'photos'
    and public.est_administrateur()
    and public.zf_chemin_photo_valide(name)
  );

drop policy if exists "photos suppression administrateur" on storage.objects;
create policy "photos suppression administrateur"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos' and public.est_administrateur());


-- ---------------------------------------------------------
-- 7. Outil de promotion (hors de portée du site)
-- ---------------------------------------------------------
-- Placé dans un schéma que l'API REST de Supabase n'expose pas :
-- il est donc impossible de l'appeler depuis un navigateur, même
-- avec un compte valide. Il ne s'utilise que dans le SQL Editor.

create schema if not exists zf_admin;
revoke all on schema zf_admin from public, anon, authenticated;

create or replace function zf_admin.promouvoir_administrateur(courriel text)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(trim(courriel));
  if uid is null then
    return 'Aucun compte Supabase avec l''adresse ' || courriel ||
           '. Créez-le d''abord dans Authentication → Users.';
  end if;
  insert into public.administrateurs (id, email, note)
  values (uid, lower(trim(courriel)), 'Promue depuis le SQL Editor')
  on conflict (id) do update set email = excluded.email;
  return 'OK — ' || courriel || ' peut maintenant modifier le site.';
end;
$$;

revoke all on function zf_admin.promouvoir_administrateur(text) from public, anon, authenticated;

create or replace function zf_admin.retirer_administrateur(courriel text)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  n integer;
begin
  delete from public.administrateurs
   where lower(email) = lower(trim(courriel))
      or id = (select id from auth.users where lower(email) = lower(trim(courriel)));
  get diagnostics n = row_count;
  if n = 0 then
    return 'Aucune administratrice avec cette adresse.';
  end if;
  return 'OK — ' || courriel || ' ne peut plus modifier le site.';
end;
$$;

revoke all on function zf_admin.retirer_administrateur(text) from public, anon, authenticated;


-- =========================================================
-- 8. ⚠️ ACTION OBLIGATOIRE APRÈS CE SCRIPT
-- ---------------------------------------------------------
-- Le script ci-dessus a fermé l'écriture à tout le monde. Il faut
-- maintenant désigner la personne autorisée. Dans le SQL Editor,
-- lancer cette ligne en remplaçant l'adresse par celle du compte
-- créé dans Authentication → Users :
--
--     select zf_admin.promouvoir_administrateur('adresse@exemple.com');
--
-- La réponse doit être « OK — … peut maintenant modifier le site. »
-- Pour vérifier à tout moment qui est autorisé :
--
--     select email, cree_le from administrateurs order by cree_le;
--
-- Pour retirer un accès :
--
--     select zf_admin.retirer_administrateur('adresse@exemple.com');
--
-- ---------------------------------------------------------
-- 9. ⚠️ SECONDE ACTION OBLIGATOIRE (hors SQL)
-- ---------------------------------------------------------
-- Fermer l'inscription libre, pour qu'un inconnu ne puisse même
-- pas créer de compte avec la clé publique du site :
--
--   Supabase → Authentication → Sign In / Providers → Email
--   → décocher « Allow new users to sign up » → Save
--
-- Les règles ci-dessus protègent déjà les données même si ce
-- réglage reste ouvert : ce sont deux barrières indépendantes,
-- il faut poser les deux.
--
-- ---------------------------------------------------------
-- Terminé. Vous devriez voir « Success. No rows returned ».
-- =========================================================
