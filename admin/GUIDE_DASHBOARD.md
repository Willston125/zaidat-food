# Dashboard ZAIDAT FOOD — guide complet

Le dashboard permet de gérer tout le site sans toucher au code :
produits, prix, photos, textes, horaires, numéro WhatsApp.

**Adresse du dashboard :** `zaidatfood.online/admin/`

---

## Comment ça marche, en une phrase

Les produits et les textes sont rangés dans une **base de données**
(Supabase), et les photos dans un **espace de stockage** au même endroit.
Le site les lit à chaque visite. Quand vous cliquez sur **Enregistrer**,
tout le monde voit la nouvelle version immédiatement.

**Le site ne tombe jamais en panne à cause de ça :** si la base devient
injoignable, il réaffiche automatiquement les produits inscrits dans ses
propres fichiers. Vos visiteurs ne voient jamais une page vide.

---

## Mise en route (une seule fois, environ 15 minutes)

### Étape 1 — Créer le compte Supabase

1. Aller sur **supabase.com** et cliquer sur **Start your project**.
2. Se connecter avec GitHub ou avec une adresse email.
3. Cliquer sur **New project** et remplir :
   - **Name** : `zaidat-food`
   - **Database Password** : un mot de passe long — **notez-le**, il ne
     sera plus jamais affiché (il ne sert pas au quotidien, mais il est
     indispensable en cas de problème).
   - **Region** : `West EU (Ireland)` ou `Frankfurt` — les plus proches
     des Comores parmi les régions proposées.
4. Cliquer sur **Create new project** et patienter environ deux minutes.

> **Coût :** l'offre gratuite couvre très largement un site comme
> celui-ci (500 Mo de base, 1 Go de photos). Aucune carte bancaire n'est
> demandée. Si le projet reste totalement inutilisé pendant une semaine,
> Supabase le met en pause — il suffit de cliquer sur *Restore* pour le
> réveiller, et le site continue de fonctionner entre-temps grâce à ses
> fichiers de secours.

### Étape 2 — Créer les tables

1. Dans le menu de gauche, ouvrir **SQL Editor**, puis **New query**.
2. Ouvrir le fichier `admin/supabase-installation.sql` de ce projet.
3. **Tout copier**, coller dans la fenêtre, cliquer sur **Run**.
4. Le message *Success. No rows returned* confirme que c'est bon.

Ce script crée les tables, l'espace photos, et surtout les **règles de
sécurité** : tout le monde peut lire le site, seule une personne
connectée peut le modifier.

### Étape 3 — Créer le compte de la cuisinière

1. Menu de gauche → **Authentication** → **Users** → **Add user** →
   **Create new user**.
2. Saisir son adresse email et un mot de passe.
3. **Cocher « Auto Confirm User »** — sans cela, la connexion sera
   refusée tant que l'email n'est pas validé.
4. Cliquer sur **Create user**.

C'est cet email et ce mot de passe qui serviront à se connecter au
dashboard.

### Étape 3 bis — Autoriser ce compte à modifier le site ⚠️

**Créer le compte ne suffit pas.** Par sécurité, un compte connecté ne
peut rien modifier tant qu'il n'a pas été explicitement déclaré
administrateur. C'est ce qui empêche un inconnu qui se serait créé un
compte de toucher à vos prix ou à votre numéro WhatsApp.

Dans **SQL Editor**, lancer cette seule ligne, avec l'adresse de
l'étape 3 :

```sql
select zf_admin.promouvoir_administrateur('adresse@exemple.com');
```

La réponse attendue est :
*« OK — adresse@exemple.com peut maintenant modifier le site. »*

Pour vérifier à tout moment qui est autorisé :

```sql
select email, cree_le from administrateurs order by cree_le;
```

### Étape 3 ter — Fermer l'inscription libre ⚠️

Par défaut, Supabase laisse **n'importe qui** créer un compte avec la
clé publique du site. Ce compte ne pourrait rien modifier (étape 3 bis),
mais autant fermer aussi cette porte :

**Authentication** → **Sign In / Providers** → **Email** → décocher
**« Allow new users to sign up »** → **Save**.

Ce sont deux protections indépendantes. Posez les deux.

### Étape 4 — Relier le site à la base

1. Menu de gauche → **Project Settings** (roue dentée) → **API**.
2. Y relever deux informations :
   - **Project URL** — ressemble à `https://abcdefgh.supabase.co`
   - **anon public** (section *Project API keys*) — une longue clé
3. Ouvrir le fichier `js/supabase-config.js` et les coller :

```js
const SUPABASE_CONFIG = {
  url: "https://abcdefgh.supabase.co",
  anonKey: "eyJhbGciOi...",   // la clé « anon public », en entier
  bucket: "photos",
};
```

4. Enregistrer, puis publier le site (voir plus bas).

> **La clé « anon public » est faite pour être publique.** Elle apparaît
> dans le code du site, c'est normal et voulu : ce sont les règles de
> sécurité de l'étape 2 qui protègent vos données. En revanche, la clé
> **service_role** de la même page ne doit **jamais** être copiée ici.

### Étape 5 — Premier enregistrement

1. Ouvrir `/admin/` et se connecter avec l'email de l'étape 3.
2. Le dashboard affiche les 14 produits actuels du site.
3. Cliquer sur **Enregistrer** en haut à droite.

Les produits passent alors dans la base. À partir de là, c'est la base
qui commande, et tout se modifie depuis le dashboard.

---

## Utilisation au quotidien

### Modifier un prix

Onglet **Produits** → **Modifier** sur le produit → changer le prix →
**Enregistrer** dans le tiroir → **Enregistrer** en haut à droite.

Un prix laissé vide affiche « Prix sur demande » sur le site, et la
commande WhatsApp indiquera « prix à confirmer ». C'est utile pour les
gâteaux sur mesure.

### Ajouter un produit

Onglet **Produits** → **+ Ajouter un produit**. Les champs importants :

- **Nom** — l'adresse de la fiche se remplit toute seule ;
- **Catégorie** ;
- **Description courte** — la phrase affichée sous le nom dans le menu ;
- **Photo du produit** — obligatoire ;
- **Photo en situation** — celle avec la cuisinière, qui apparaît sur la
  fiche du produit. Fortement recommandée : c'est elle qui donne envie.

### Ajouter ou changer une photo

1. Dans la fiche produit, cliquer sur **Choisir une photo**.
2. Sélectionner l'image (jusqu'à 25 Mo, depuis le téléphone directement).
3. **Recadrer** : faire glisser pour centrer, utiliser le zoom. Le cadre
   carré montre exactement ce qui apparaîtra sur le site.
4. **Utiliser cette photo**.

La photo est automatiquement réduite en deux tailles (une pour le menu,
une pour la fiche) et compressée. Une photo de 4 Mo prise au téléphone
descend ainsi à environ 150 Ko — indispensable pour que le site reste
rapide sur une connexion mobile.

> Il faut être connectée pour envoyer une photo : elle part directement
> dans la base.

### Retirer temporairement un produit

Décocher **Disponible** plutôt que de supprimer. Le produit reste visible
avec la mention « Indisponible », ne peut pas être commandé, et se
réactive en un clic.

### Modifier les textes du site

Onglet **Textes du site** :

- **Marque** — nom et sous-titre ;
- **Bandeau du haut** — les phrases qui défilent tout en haut ;
- **Grande image d'accueil** — titre, sous-titre, boutons ;
- **Section « La cuisine de… »** — présentation et points forts ;
- **Étapes de commande** — les quatre encadrés « Comment commander ? » ;
- **Engagements** — le bandeau foncé, avec le choix de l'icône ;
- **Appel final** — le dernier bloc avant le pied de page.

Onglet **Contact & livraison** : numéro WhatsApp, horaires, zones,
moyens de paiement, réseaux sociaux, devise.

### Témoignages

Onglet **Témoignages**. La section reste masquée sur le site tant
qu'aucun témoignage n'est saisi — mieux vaut rien que de faux avis.

---

## Publier le site

Le dashboard écrit dans la base : **les changements de produits, prix,
photos et textes sont visibles immédiatement**, sans rien republier.

Il faut republier le site uniquement quand un **fichier** change — par
exemple après avoir rempli `js/supabase-config.js` à l'étape 4 :

```bash
git add -A && git commit -m "Configuration Supabase" && git push
```

Vercel remet le site en ligne tout seul, en une minute environ.

---

## En cas de problème

**« Email ou mot de passe incorrect »**
Vérifier que *Auto Confirm User* était bien coché à la création du
compte. Sinon : Authentication → Users → les trois points → *Confirm
email*.

**« Votre session a expiré »**
Se reconnecter. Par sécurité, la connexion ne dure pas indéfiniment.

**Le bouton Enregistrer reste grisé**
Rien n'a été modifié. Dès qu'une modification est faite, il s'active.

**« Compte non autorisé »**
Vous êtes bien connectée, mais l'étape 3 bis n'a pas été faite pour ce
compte. Lancez `select zf_admin.promouvoir_administrateur('votre@email');`
dans le SQL Editor.

**« Base injoignable — mode consultation »**
Le dashboard affiche les dernières données connues mais ne peut rien
enregistrer. Le plus souvent, le projet Supabase gratuit s'est mis en
pause : ouvrez Supabase, cliquez sur *Restore*, puis rechargez la page.
**Le site public, lui, continue de fonctionner normalement** pendant ce
temps.

**« Le site a été modifié ailleurs »**
Quelqu'un a enregistré depuis un autre appareil (ou un autre onglet)
depuis que vous avez ouvert cette page. Rien n'a été écrasé : notez vos
modifications, rechargez, puis refaites-les. C'est ce garde-fou qui
empêche un onglet oublié sur un téléphone de supprimer des produits
ajoutés depuis l'ordinateur.

**Le dashboard affiche « Base de données pas encore reliée »**
`js/supabase-config.js` est vide, ou le site n'a pas été republié après
l'avoir rempli.

**Une photo ne s'affiche pas sur le site**
Vérifier dans Supabase → Storage → `photos` que le dossier est bien
**public** (relancer le script SQL le corrige).

**Le site affiche d'anciens produits**
La base est probablement injoignable (projet en pause) : le site est
retombé sur ses fichiers de secours. Réveiller le projet dans Supabase.

---

## Sécurité

Le site repose sur **trois barrières**, indépendantes les unes des autres :

1. **Il faut un compte** pour se connecter au dashboard ;
2. **Il faut être déclarée administratrice** pour enregistrer quoi que ce
   soit — c'est la table `administrateurs`, remplie uniquement depuis le
   SQL Editor de Supabase. Un compte ordinaire ne peut pas s'y ajouter
   lui-même, même en connaissant la clé publique du site ;
3. **L'inscription libre est fermée**, si l'étape 3 ter a été faite.

Au quotidien :

- Ne jamais partager le mot de passe du compte.
- Sur un téléphone ou ordinateur partagé, **se déconnecter** après usage.
- Ne jamais copier la clé **service_role** dans le site. La clé
  **anon public**, elle, est faite pour être publique : elle ne permet
  que de lire.
- Pour retirer un accès :
  ```sql
  select zf_admin.retirer_administrateur('adresse@exemple.com');
  ```
  puis supprimer l'utilisateur dans Authentication → Users.

> **Si vous relancez un jour le script SQL**, il referme l'écriture à
> tout le monde : il faut alors refaire l'étape 3 bis. C'est voulu — un
> script d'installation ne doit jamais laisser une porte ouverte.

---

## Ce que le dashboard ne fait pas encore

- **Les commandes** n'y apparaissent pas : elles arrivent sur WhatsApp.
- **Les statistiques de visite** ne sont pas suivies.
- **La vidéo d'accueil** se remplace dans les fichiers du site
  (`assets/video/`), pas depuis le dashboard.
