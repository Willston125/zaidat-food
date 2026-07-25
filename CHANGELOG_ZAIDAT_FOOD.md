# CHANGELOG — ZAIDAT FOOD

## 2026-07-25 — v5 : commande express, le formulaire devient facultatif

Demande : *« laisser un bouton WhatsApp pour discuter directement… je veux que
les commandes aillent vite, le formulaire va retarder la rétention, aux Comores
les gens veulent aller vite. »*

### Bouton WhatsApp flottant (nouveau)

Présent sur **toutes les pages**, toujours visible, en bas à droite :

- sur ordinateur, pastille verte allongée « Discuter sur WhatsApp » ;
- sur téléphone, pastille ronde de 56 px placée **au-dessus** de la barre de
  navigation (aucun chevauchement, vérifié à 375 px) ;
- ouvre WhatsApp avec un simple message d'accueil, **sans passer par le panier
  ni par la commande** — pour poser une question, demander un prix, etc. ;
- halo discret pour attirer l'œil, désactivé si l'utilisateur a demandé de
  réduire les animations ;
- passe **sous** le panier quand celui-ci s'ouvre (z-index 95 < 130 < 140).

L'entrée WhatsApp de la barre mobile a été retirée pour éviter le doublon :
la barre affiche maintenant Accueil / Menu / Panier.

### Fiche produit : deux actions claires, zéro friction

- **« Commander sur WhatsApp »** (vert, action principale) — un clic et le
  message part, déjà rempli avec le produit, **la quantité choisie et les
  options saisies**. Le lien se met à jour en direct à chaque changement.
- **« Ajouter au panier »** (action secondaire) — pour commander plusieurs
  produits d'un coup.
- L'ancien bouton « Commander directement », qui renvoyait vers le formulaire,
  a disparu.

### Panier : commande en un clic

Le pied du tiroir affiche **« Commander sur WhatsApp »** en vert : tout le
panier part immédiatement. Un lien discret en dessous, *« Ajouter mes
informations (facultatif) »*, reste disponible pour ceux qui le souhaitent.

### Page commande : plus de tunnel en 3 étapes

- Le parcours obligatoire panier → formulaire → validation est **supprimé** ;
- la page affiche le panier modifiable et, juste en dessous, un grand bouton
  **« Envoyer ma commande sur WhatsApp »**, actif dès l'arrivée ;
- le formulaire devient un bloc dépliable **« Ajouter mes informations
  (facultatif) »** : **plus aucun champ obligatoire** (0 champ `required`) ;
- s'il est rempli, les informations enrichissent automatiquement le message, en
  direct, à chaque frappe ; sinon elles ne figurent tout simplement pas ;
- le numéro de téléphone n'est plus bloquant : un simple avertissement s'affiche
  s'il semble incomplet, le bouton reste actif ;
- un second bloc dépliable permet de relire le message avant l'envoi.

### Technique

- Nouveau module partagé `js/whatsapp.js` : construction des messages et des
  liens `wa.me` utilisée par la fiche produit, le panier et la page commande —
  fin de la duplication, un seul format de message à maintenir ;
- chaque commande porte une référence courte (`réf. ZF-XXXX`) pour le suivi ;
- `whatsappGreeting` ajouté dans `js/config.js` pour le message du bouton flottant.

### Tests

Commande express depuis une fiche (quantité et option correctement reprises
dans le lien), commande depuis le panier (message mis à jour à chaque ajout),
page commande sans rien remplir puis avec informations partielles, avertissement
téléphone non bloquant, produit indisponible (bouton WhatsApp masqué, ajout au
panier refusé, bouton flottant toujours accessible — testé en rendant réellement
un produit indisponible, données restaurées ensuite), position du bouton flottant
à 375 px et 729 px, ordre d'empilement avec le panier, aucun débordement
horizontal, console propre.

---

## 2026-07-25 — v4 : jeu d'icônes professionnel (fin des emoji)

Demande : *« les icônes ne font pas professionnel, on doit avoir des icônes
professionnelles, du métier et belles. »*

### Le problème des emoji

Les emoji (🧺 🎂 🛵 …) sont **rendus par le système d'exploitation** : ils
changent d'aspect entre un iPhone, un Android et un PC, sont multicolores et
enfantins, ne s'alignent pas proprement avec le texte et ne peuvent pas prendre
les couleurs de la marque. Ils ont tous été supprimés.

### Le nouveau jeu d'icônes — `js/icons.js`

**41 icônes vectorielles dessinées sur mesure** pour ZAIDAT FOOD, dans un style
ligne fine unifié (grille 24×24, épaisseur 1,6, extrémités arrondies) :

- **métier / catégories** : bol de riz fumant, samoussa, flan, gâteau à bougies,
  pile de pancakes, cloche de service, plateau, toque de chef, feuille ;
- **commerce** : panier, sac, scooter de livraison, portefeuille, étoile pleine,
  cœur, étincelle, maison, personnes ;
- **interface** : recherche, menu, fermer, plus, moins, flèche, grille,
  corbeille, copier, œil, horloge, validation, indisponible, épingle, calendrier ;
- **contact** : téléphone, bulle, et les logos officiels WhatsApp, Instagram,
  Facebook, TikTok.

Points techniques :

- un **sprite SVG unique** injecté une seule fois par page — aucune police
  d'icônes, aucun fichier externe, aucun appel réseau supplémentaire ;
- les icônes **prennent automatiquement la couleur du texte** (`currentColor`),
  donc elles s'adaptent au terracotta, au blanc sur fond sombre, au doré ;
- **rendu net à toute taille** (contrairement aux emoji), 4 tailles disponibles
  (`icon--sm`, normale, `icon--lg`, `icon--xl`) ;
- toutes marquées `aria-hidden="true"` : les lecteurs d'écran lisent le texte
  ou l'`aria-label` du bouton, jamais l'icône — l'accessibilité est préservée ;
- ajout d'une icône : une entrée dans `js/icons.js`, puis `ZF.icon("nom")` en
  JavaScript ou `<svg class="icon"><use href="#i-nom"></use></svg>` en HTML.

### Remplacements effectués

Header (recherche, panier, menu), pastilles de catégories, badge « Populaire »,
bouton « voir en situation », boutons +/− de quantité, tiroir panier (fermeture,
panier vide), barre d'action mobile, barre d'information, promesses de la marque,
étiquettes d'occasions, puces de la section signature, informations produit
(disponibilité, délai, cuisine maison), encadré « Bon à savoir », pied de page,
notifications, boutons WhatsApp et « copier », et l'image de remplacement
affichée si une photo venait à manquer.

Le menu burger alterne désormais proprement entre l'icône « menu » et « fermer »,
avec le libellé d'accessibilité correspondant.

### Tests

41 symboles définis, **69 icônes affichées sur l'accueil, aucune référence
cassée, aucune icône vide ou de taille nulle**, géométrie valide vérifiée icône
par icône, icônes pleines (étoile, réseaux) bien distinguées des icônes ligne,
**plus aucun emoji dans aucune page**, console propre sur les 5 pages, aucun
débordement horizontal.

---

## 2026-07-25 — v3 : numéro WhatsApp de commande activé

Numéro fourni par la cuisinière : **+269 488 03 43**.

- `js/config.js` : `WHATSAPP_ORDER_NUMBER: "2694880343"` (format international
  attendu par WhatsApp : indicatif Comores `269` + les 7 chiffres, sans `+`
  ni espaces) et `phoneDisplay: "+269 488 03 43"` pour l'affichage lisible ;
- Le mode dégradé (avertissement + « copier le message ») disparaît
  automatiquement : le bouton **« 📲 Envoyer sur WhatsApp »** est désormais actif ;
- Le numéro apparaît aussi dans la barre d'information, le pied de page et la
  barre d'action mobile (bouton WhatsApp direct), sans autre modification —
  tous ces emplacements lisent la configuration centrale.

Vérifié : lien généré `https://wa.me/2694880343?text=…`, message complet
correctement encodé (828 caractères, aucun retour à la ligne brut dans l'URL)
et fidèlement décodé — produits, quantités, coordonnées, date/heure, mode de
récupération et remarque. Console propre.

---

## 2026-07-25 — v2 : la scène de vie devient la révélation

Demande : *« quand on clique sur un produit, la carte doit s'animer en montrant
la photo du personnage qui utilise le produit… ou sinon quand on passe la
souris sur la photo, la photo change en celle où on voit le personnage. »*

Les deux comportements ont été mis en place.

### Sur les cartes du menu

- Chaque carte contient désormais **deux photos superposées** : le produit seul
  et la scène de vie correspondante ;
- **Au survol de la souris** : fondu enchaîné vers la scène de vie, avec un
  léger zoom et l'étiquette « En situation » ;
- **Au tactile** (pas de survol possible) : un bouton 👩🏽‍🍳 en bas à droite de
  la photo bascule l'affichage sans ouvrir la fiche (`aria-pressed` géré) ;
- **Au clic sur la carte** : la scène de vie se révèle pendant 420 ms, puis la
  fiche s'ouvre — l'utilisateur voit le personnage avant même l'ouverture ;
  Ctrl/⌘+clic et clic milieu restent normaux (ouverture en nouvel onglet), et
  `prefers-reduced-motion` désactive l'animation au profit d'une navigation
  immédiate.

### Sur la fiche produit

- Le bloc lifestyle séparé est remplacé par une **visionneuse à deux vues** ;
- Elle **s'ouvre sur la scène de vie** (c'est la continuité de l'animation de
  la carte), avec la légende « Un moment à savourer » ;
- Deux vignettes légendées — **« En situation »** et **« Le produit »** —
  permettent de basculer ; un clic sur l'image elle-même alterne aussi les vues.
  La photo commerciale du produit seul reste donc à un clic, jamais supprimée.

### Technique

- Vignettes lifestyle 450 px générées (33-45 Ko au lieu de 108-142 Ko) pour ne
  pas alourdir les cartes ; champ `lifestyleThumb` ajouté aux 14 produits ;
- Le gabarit de carte est désormais **partagé** (`ZF.cardHtml` dans `js/ui.js`)
  entre l'accueil et les produits similaires — le code dupliqué a été supprimé ;
- Le produit **« Gâteau au chocolat »**, seul sans photo lifestyle, se comporte
  proprement : pas de bascule, pas de bouton, pas de vignettes, navigation
  directe. L'effet s'activera automatiquement dès que l'image sera fournie
  (voir `ASSETS_A_VERIFIER.md`).

### Tests (identiques au protocole v1, tous ✅)

Mapping des 13 paires vérifié après filtrage et re-rendu (aucune carte
n'affiche la scène d'un autre produit), bascule tactile aller-retour, ajout au
panier toujours fonctionnel sans navigation parasite, visionneuse dans les deux
sens, produit sans lifestyle, aucun débordement horizontal, console propre.

> Note de méthode : le panneau navigateur de l'environnement de test ne compose
> pas d'images, ce qui fige les transitions CSS en cours. Les états ont donc été
> vérifiés en neutralisant temporairement les transitions pour lire les valeurs
> cibles (opacités 0 ⇄ 1 conformes dans tous les états). Le rendu animé lui-même
> mérite un coup d'œil sur un vrai navigateur.

---

## 2026-07-25 — Création du site complet (v1)

### Contexte de départ (audit)

Le dossier du projet ne contenait **aucun code** : uniquement les assets
(logo, image hero, 14 photos produits, 13 photos lifestyle, dossier archive).
Il n'y avait donc rien à casser ni à migrer : le site a été construit autour
des assets officiels existants, **sans modifier ni supprimer aucun fichier
original** (les dossiers `produits/`, `lifestyle produit/`, `archive/` et les
fichiers `hero image.png` / `zaidat food logo.png` sont intacts — ils servent
de sauvegarde des originaux).

### Audit des assets

- Les 27 images produit/lifestyle ont été inspectées visuellement une à une ;
- 13 paires produit ↔ lifestyle confirmées (même plat, même personnage) ;
- 1 produit sans lifestyle (« gâteau au chocolat ») ;
- 3 incohérences nom de fichier / visuel documentées dans `ASSETS_A_VERIFIER.md` ;
- fichiers ambigus résolus : `grace lifestyle.png` → glace ;
  `ChatGPT Image … (7).png` → pancakes (vérifié contre `crepes salée.png`).

### Ajouté

- **Optimisation des images** (originaux intacts) : copies JPEG renommées en
  slugs propres dans `assets/img/` — produits en 900 px (fiche) + 450 px
  (cartes), lifestyle en 900 px, hero en 1672 px (167 Ko au lieu de 2 Mo)
  + 960 px pour mobile, logo 256 px, favicon 64 px ;
- **Données centralisées** : `js/config.js` (WhatsApp, textes, horaires,
  livraison, paiement, témoignages) et `js/products.js` (14 produits,
  5 catégories, table de correspondance images en en-tête de fichier) ;
- **Accueil** (`index.html`) : 13 sections — barre d'info, header sticky
  compact au scroll avec recherche et panier, hero avec l'image officielle,
  catégories filtrantes, grille produits (populaires d'abord), signature,
  étapes de commande, promesses, occasions, témoignages administrables,
  galerie lifestyle, CTA final, footer complet ;
- **Fiche produit** (`produit.html?p=slug`) : URL partageable, photo produit
  en priorité + bloc lifestyle « Un moment à savourer », prix/disponibilité,
  option de personnalisation pour les gâteaux, quantité, ajout au panier,
  commande directe, produits similaires, JSON-LD, état « introuvable » ;
- **Panier** (`js/cart.js` + tiroir dans `js/ui.js`) : localStorage,
  lignes distinctes par options, quantités, suppression, vidage, totaux
  tolérants aux prix non renseignés, compteur header + barre mobile ;
- **Tunnel de commande** (`commande.html`) : 3 étapes (panier → informations
  → validation), validation champ par champ, récapitulatif, message WhatsApp
  complet correctement encodé (`wa.me`), n° de commande généré, mode dégradé
  « copier le message » tant que `WHATSAPP_ORDER_NUMBER` n'est pas configuré ;
- **Pages légales** minimales + `robots.txt` (pages techniques non indexées) ;
- **Design system** (`css/styles.css`) : palette terracotta/crème/brun/corail/
  doré/vert accordée au logo bordeaux-or, polices Fraunces + Nunito Sans,
  animations légères avec `prefers-reduced-motion`, mobile-first, barre
  d'action mobile ;
- `serve.json` (`cleanUrls: false`) + `.claude/launch.json` pour le dev local.

### Décisions importantes (aucune donnée inventée)

- **Prix** : aucun fourni → `price: null` partout, affichage « Prix sur
  demande », totaux « à confirmer » ; le calcul complet s'active dès que les
  prix sont saisis ;
- **WhatsApp** : aucun numéro fourni → variable `WHATSAPP_ORDER_NUMBER` vide,
  avertissement clair + fallback copie ;
- **Témoignages** : aucun réel → structure prête dans la config, section
  masquée tant que la liste est vide ;
- **Noms de produits** : fidèles au visuel réel des photos, divergences
  documentées dans `ASSETS_A_VERIFIER.md` ;
- Dossier `archive/` non utilisé (conforme à son nom).

### Corrigé pendant les tests

- Redirection `cleanUrls` de `serve` qui supprimait `?p=slug` sur les fiches
  produit → `serve.json` ;
- Débordement horizontal causé par les panneaux hors-écran (nav mobile,
  tiroir panier) → `overflow-x: clip` + `visibility: hidden` à l'état fermé
  (corrige aussi la tabulation clavier vers des éléments invisibles) ;
- Ancre `#menu` mal positionnée ; emoji corrompu dans la section occasions ;
  formatage des prix avec espace insécable (`1 500 KMF`).

### Tests effectués (Chrome local, 25/07/2026)

| Test | Résultat |
|---|---|
| Correspondance produit/lifestyle des 14 produits (aucune inversion) | ✅ |
| Existence HTTP 200 des 32 images optimisées | ✅ |
| Filtres catégories (3 gâteaux ⇄ 14 produits) sans rechargement | ✅ |
| Recherche (résultat unique, état vide, réinitialisation) | ✅ |
| Ajout rapide, badge, toast, tiroir (+/−, retirer, vider, Échap, focus) | ✅ |
| Fiche produit : bonnes images, option, quantité, similaires | ✅ |
| 2 options différentes → 2 lignes distinctes au panier | ✅ |
| Produit indisponible / introuvable → états gérés | ✅ |
| Persistance du panier entre pages et rechargements | ✅ |
| Tunnel : validations (nom/tél/mode/zone-livraison), 3 étapes | ✅ |
| Message WhatsApp conforme, encodage/décodage URL `wa.me` | ✅ |
| Numéro WhatsApp absent → avertissement + copie | ✅ |
| Mobile ≤ 820 px : barre mobile, burger, hero empilé, grille 2 col. | ✅ |
| Débordement horizontal | ✅ aucun |
| Console navigateur (toutes pages) | ✅ 0 erreur, 0 avertissement |
| Largeurs exactes 360/1280 px | ⚠️ non émulables dans l'environnement de test — CSS fluide, contrôle visuel recommandé |
