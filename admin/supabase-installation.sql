-- =========================================================
-- ZAIDAT FOOD — Installation de la base de données
-- ---------------------------------------------------------
-- À copier-coller en entier dans Supabase :
--   votre projet → SQL Editor → New query → Coller → Run
--
-- Ce script peut être relancé sans risque : il ne détruit
-- aucune donnée existante.
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

-- ---------------------------------------------------------
-- 2. Table des réglages (textes du site, contact, horaires…)
-- ---------------------------------------------------------
create table if not exists reglages (
  cle          text primary key,       -- « site » ou « categories »
  valeur       jsonb not null,
  modifie_le   timestamptz default now()
);

-- ---------------------------------------------------------
-- 3. Sécurité : qui a le droit de faire quoi
-- ---------------------------------------------------------
-- Règle : tout le monde peut LIRE (c'est un site public),
-- seule une personne connectée peut MODIFIER.
-- Sans ces règles, la clé publique permettrait à n'importe qui
-- de changer vos prix : elles ne sont pas optionnelles.

alter table produits enable row level security;
alter table reglages enable row level security;

drop policy if exists "lecture publique produits" on produits;
create policy "lecture publique produits"
  on produits for select
  to anon, authenticated
  using (true);

drop policy if exists "ecriture connectee produits" on produits;
create policy "ecriture connectee produits"
  on produits for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "lecture publique reglages" on reglages;
create policy "lecture publique reglages"
  on reglages for select
  to anon, authenticated
  using (true);

drop policy if exists "ecriture connectee reglages" on reglages;
create policy "ecriture connectee reglages"
  on reglages for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------
-- 4. Stockage des photos
-- ---------------------------------------------------------
-- Un dossier public nommé « photos » : les visiteurs les voient,
-- seule la personne connectée peut en ajouter ou en supprimer.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

drop policy if exists "photos lecture publique" on storage.objects;
create policy "photos lecture publique"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'photos');

drop policy if exists "photos ajout connecte" on storage.objects;
create policy "photos ajout connecte"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos');

drop policy if exists "photos modification connectee" on storage.objects;
create policy "photos modification connectee"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'photos');

drop policy if exists "photos suppression connectee" on storage.objects;
create policy "photos suppression connectee"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos');

-- ---------------------------------------------------------
-- Terminé.
-- Vous devriez voir « Success. No rows returned ».
-- Les tables « produits » et « reglages » apparaissent
-- maintenant dans Table Editor, encore vides : c'est normal.
-- Le dashboard les remplira au premier enregistrement.
-- ---------------------------------------------------------
