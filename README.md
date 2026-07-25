# ZAIDAT FOOD — Site de commande en ligne

Site e-commerce alimentaire complet pour ZAIDAT FOOD (cuisine artisanale comorienne) :
menu interactif, fiches produits immersives (photo produit + scène lifestyle),
panier persistant et tunnel de commande WhatsApp.

**Stack : HTML / CSS / JavaScript pur — aucun build, aucune dépendance.**
Le site fonctionne sur n'importe quel hébergement statique.

---

## Lancer le site en local

Avec Node.js installé :

```bash
npx serve -l 8123 .
```

Puis ouvrir <http://localhost:8123>.

> Le fichier `serve.json` (`cleanUrls: false`) est indispensable avec `serve` :
> sans lui, la redirection `produit.html → /produit` perd le paramètre `?p=slug`.

## Dépôt GitHub

Le code est publié sur **<https://github.com/Willston125/zaidat-food>** (dépôt privé).

```bash
git add -A
git commit -m "Description de la modification"
git push
```

## Déployer sur Vercel (recommandé)

1. Aller sur <https://vercel.com/new> et se connecter avec le compte GitHub ;
2. importer le dépôt **zaidat-food** ;
3. laisser tous les réglages par défaut — Framework : *Other*, aucune commande
   de build, dossier racine `/` (le site est statique, `vercel.json` fait le reste) ;
4. cliquer sur **Deploy**.

Ensuite, **chaque `git push` redéploie le site automatiquement**.

Le fichier `vercel.json` est déjà configuré : `cleanUrls: false` (indispensable
pour que les liens `produit.html?p=slug` fonctionnent), cache long sur les
images et la vidéo, cache court sur le HTML/CSS/JS.

## Autres hébergeurs

Le site est 100 % statique. Les dossiers `archive/`, `produits/`,
`lifestyle produit/` et les fichiers sources lourds (`hero vidéo.mp4`,
`hero image.png`, `zaidat food logo.png`) **ne sont pas versionnés** : ce sont
vos originaux de sauvegarde, conservés uniquement sur votre ordinateur. Les
versions optimisées pour le web se trouvent dans `assets/`.

- **Netlify** : glisser-déposer le dossier — conserve les `.html` par défaut ;
- **GitHub Pages** : activer Pages sur le dépôt.

Après déploiement :
1. renseigner le domaine dans `robots.txt` (ligne `Sitemap:` en commentaire) ;
2. vérifier la commande sur téléphone (envoi WhatsApp réel).

## Configuration — les 2 réglages indispensables

### 1. Numéro WhatsApp de commande — `js/config.js` ✅ configuré

```js
WHATSAPP_ORDER_NUMBER: "2694880343",   // +269 488 03 43
phoneDisplay: "+269 488 03 43",
```

Le format est **international, sans `+` ni espaces** (indicatif Comores `269`
suivi des 7 chiffres). Pour changer de numéro plus tard, modifier ces deux
lignes. Si `WHATSAPP_ORDER_NUMBER` est vidé, le site bascule automatiquement en
mode dégradé : avertissement clair et bouton « copier le message ».

### 2. Les prix — `js/products.js`

Aucun prix n'a été inventé. Chaque produit a `price: null`, affiché
« Prix sur demande ». Pour activer un prix :

```js
price: 1500,        // en KMF → affiché automatiquement « 1 500 KMF »
```

Dès qu'un prix existe, les totaux du panier et du message WhatsApp se
calculent automatiquement.

## Ajouter ou modifier un produit

Tout se passe dans **`js/products.js`** (source unique) :

1. Ajouter les images optimisées dans `assets/img/products/`
   (`mon-produit-900.jpg` + `mon-produit-450.jpg`) et dans
   `assets/img/lifestyle/` (`mon-produit-900.jpg` + `mon-produit-450.jpg` —
   la version 450 sert à la bascule au survol sur les cartes) ;
2. Copier un bloc produit existant dans le tableau `PRODUCTS` et adapter :
   `slug` (unique, sans accents), `name`, descriptions, `category`
   (`plats`, `snacks`, `desserts`, `gateaux`, `douceurs`), chemins d'images,
   `available`, `featured`/`bestseller` ;
3. C'est tout : menu, filtres, fiche produit, panier et footer se mettent à jour seuls.

Pour désactiver temporairement un produit : `available: false`
(carte grisée « Indisponible », ajout au panier bloqué).

La catégorie d'un produit détermine son icône, définie dans le tableau
`CATEGORIES` en haut de `js/products.js` (champ `icon`, à choisir parmi les noms
disponibles dans `js/icons.js`, sans le préfixe `i-`).

## Les icônes

Le site utilise **41 icônes vectorielles maison** (`js/icons.js`), et non des
emoji : elles restent identiques sur tous les téléphones, s'affichent nettes à
toute taille et prennent automatiquement les couleurs de la marque.

Pour en utiliser une :

```html
<svg class="icon" aria-hidden="true"><use href="#i-basket"></use></svg>
```
```js
ZF.icon("cake")             // taille normale
ZF.icon("heart", "icon--xl") // grande taille
```

Tailles disponibles : `icon--sm`, normale, `icon--lg`, `icon--xl`.
La liste complète des noms se trouve en tête de `js/icons.js`.

Les autres contenus modifiables (textes du hero, barre d'info, section
« La cuisine de Zaidat », horaires, témoignages, réseaux sociaux, modes de
livraison, moyens de paiement) sont dans **`js/config.js`**, commentés ligne
par ligne.

## Structure du projet

```
├── index.html              Accueil (hero, catégories, menu, sections)
├── produit.html            Fiche produit (?p=slug — URL partageable)
├── commande.html           Panier + tunnel de commande WhatsApp (3 étapes)
├── mentions-legales.html   Page légale minimale
├── confidentialite.html    Politique de confidentialité
├── css/styles.css          Design system complet (terracotta/crème/doré)
├── js/
│   ├── config.js           ⚙️ Configuration centrale (WhatsApp, textes…)
│   ├── products.js         ⚙️ Produits + table de correspondance images
│   ├── icons.js            Jeu de 41 icônes vectorielles (sprite SVG)
│   ├── whatsapp.js         Messages et liens wa.me (partagés)
│   ├── cart.js             Panier (localStorage)
│   ├── ui.js               UI partagée (header, tiroir panier, toasts…)
│   ├── home.js             Accueil (filtres, recherche, galerie)
│   ├── product.js          Fiche produit
│   └── checkout.js         Tunnel de commande + message WhatsApp
├── assets/img/             Images optimisées pour le web (JPEG)
├── produits/               🔒 Photos produits ORIGINALES (non modifiées)
├── lifestyle produit/      🔒 Photos lifestyle ORIGINALES (non modifiées)
├── archive/                🔒 Anciennes images (non utilisées)
├── serve.json              Config du serveur statique (cleanUrls off)
└── robots.txt              SEO (pages techniques non indexées)
```

## Fonctionnalités réalisées

- Accueil complet : barre d'info, header compact au scroll, hero avec l'image
  officielle du personnage, catégories filtrantes réelles (sans rechargement),
  recherche instantanée, produits populaires d'abord, section signature,
  « Comment commander », promesses, occasions/gâteaux sur commande,
  témoignages (masqués tant qu'aucun vrai témoignage n'est saisi),
  galerie lifestyle, CTA final, footer complet ;
- **Effet signature — la scène de vie se révèle** : chaque carte du menu
  superpose la photo du produit seul et la scène avec la cuisinière.
  Au survol de la souris, l'image bascule en fondu ; au tactile, un bouton
  👩🏽‍🍳 fait la même chose ; au clic, la scène se révèle avant l'ouverture
  de la fiche ;
- Fiche produit immersive : visionneuse à deux vues qui **s'ouvre sur la scène
  de vie** (« Un moment à savourer »), avec vignettes « En situation » /
  « Le produit » pour revenir à la photo commerciale en un clic — le même plat,
  le même personnage ; prix ou « Prix sur demande », disponibilité,
  personnalisation libre pour les gâteaux, quantité, ajout panier /
  commande directe, produits similaires, données structurées ;
- **Commande express — pensée pour aller vite** : depuis une fiche produit, un
  clic sur « Commander sur WhatsApp » envoie le message déjà rempli (produit,
  quantité, options). Depuis le panier, un clic envoie toute la commande.
  **Aucun formulaire obligatoire** : les coordonnées se règlent naturellement
  dans la conversation. Un formulaire facultatif reste disponible pour ceux qui
  veulent préciser nom, zone, date ou remarque — ses informations s'ajoutent
  automatiquement au message ;
- **Bouton WhatsApp flottant** sur toutes les pages : permet de discuter
  directement avec ZAIDAT FOOD sans commander (question, prix, disponibilité) ;
- Panier : tiroir accessible partout, quantités, suppression, vidage,
  totaux (gérant les prix non renseignés), persistance localStorage,
  deux options différentes = deux lignes distinctes, compteur animé ;
- Tunnel en 3 étapes avec validation des champs et messages d'erreur clairs ;
- Message WhatsApp formaté (n° de commande, produits, options, quantités,
  totaux, coordonnées, date/heure, mode de récupération, remarque) et
  correctement encodé dans l'URL `wa.me` ;
- Mobile-first : barre d'action mobile (Accueil/Menu/Panier/WhatsApp),
  menu burger, hero recadré sans couper le visage, zones tactiles ≥ 40 px ;
- Accessibilité : skip-link, navigation clavier, piège de focus dans le
  tiroir, fermeture Échap, `aria-*`, alt descriptifs, focus visible,
  `prefers-reduced-motion` respecté ;
- Performance : images divisées par ~20 (2 Mo → 25-160 Ko), lazy-loading,
  hero prioritaire, zéro dépendance JS ;
- États gérés : panier vide, produit introuvable, produit indisponible,
  catégorie/recherche sans résultat, image manquante (fallback), numéro
  WhatsApp non configuré, hors connexion (avertissement à l'envoi).

## Reste à configurer (données réelles, jamais inventées)

1. **Prix** de chaque produit (`js/products.js`) — seul réglage bloquant restant ;
2. Horaires, réseaux sociaux, vrais témoignages (`js/config.js`) ;
3. Image lifestyle du « Gâteau au chocolat » + noms à confirmer → voir `ASSETS_A_VERIFIER.md` ;
4. Coordonnées de l'éditeur dans `mentions-legales.html`.

✅ Numéro WhatsApp de commande configuré : **+269 488 03 43**.

## Résultats des tests (2026-07-25)

Testé en local dans Chrome (voir détail dans `CHANGELOG_ZAIDAT_FOOD.md`) :
navigation, filtres, recherche, les 14 produits et leurs images vérifiées une à
une (aucune inversion produit/lifestyle), panier complet, persistance,
tunnel de commande, validation des formulaires, message WhatsApp encodé/décodé,
états vides et d'erreur, absence de débordement horizontal, console sans
aucune erreur ni avertissement.

Point d'attention : les largeurs exactes 360 px et ≥ 1280 px n'ont pas pu être
émulées dans l'environnement de test (panneau non affiché) — la CSS est fluide
et vérifiée à 666-729 px ; un contrôle visuel rapide sur vrai téléphone et
grand écran est recommandé avant mise en ligne.
