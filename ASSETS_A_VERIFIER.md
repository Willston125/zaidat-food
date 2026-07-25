# ASSETS À VÉRIFIER — ZAIDAT FOOD

Toutes les images fournies ont été inspectées visuellement une par une.
Les 13 paires produit ↔ lifestyle sont cohérentes (même plat, même personnage officiel).
Les points ci-dessous nécessitent une confirmation de la cuisinière.

---

## 1. Image lifestyle manquante

| Produit | Image produit trouvée | Image lifestyle | Problème | Action recommandée |
|---|---|---|---|---|
| Gâteau au chocolat | `produits/gateau au chocolat.png` ✔ | **ABSENTE** | Aucun fichier lifestyle ne correspond à ce produit (les 13 fichiers lifestyle ont tous été attribués à d'autres produits, vérification visuelle à l'appui). | Créer/fournir une photo du personnage dégustant ces moelleux fourrés au chocolat. |

> **Conséquence visible :** c'est le **seul produit sur 14** qui ne bénéficie pas de
> l'effet de bascule (survol / clic révélant la cuisinière) ni de la visionneuse
> à deux vues sur sa fiche. Tout se comporte proprement — aucun bug, aucune image
> d'un autre produit affichée à la place — mais le produit est moins vendeur que
> les autres.
>
> **Pour l'activer**, une fois la photo créée :
> 1. la placer en `assets/img/lifestyle/gateau-chocolat-900.jpg` et
>    `gateau-chocolat-450.jpg` (900 px et 450 px de large) ;
> 2. dans `js/products.js`, produit `p-gateau-chocolat`, remplacer :
>    ```js
>    lifestyleImage: null,
>    lifestyleThumb: null,
>    ```
>    par :
>    ```js
>    lifestyleImage: "assets/img/lifestyle/gateau-chocolat-900.jpg",
>    lifestyleThumb: "assets/img/lifestyle/gateau-chocolat-450.jpg",
>    ```
> L'effet s'active alors automatiquement, sans autre modification.

## 2. Noms de fichiers ne correspondant pas au visuel

Ces produits sont en ligne avec un nom choisi d'après **ce que montre réellement la photo**.
À confirmer (ou corriger dans `js/products.js`, champ `name`) :

| Fichier original | Visuel réel constaté | Nom affiché sur le site | À confirmer |
|---|---|---|---|
| `produits/petit crepe.png` | Biscuits sablés (cœurs, étoiles, fleurs) — pas des crêpes | « Biscuits maison » | Le vrai nom commercial de ce produit |
| `produits/crepes salée.png` | Pile de pancakes épais nature — rien de visiblement salé | « Pancakes moelleux » | S'il s'agit bien de crêpes salées, fournir la bonne photo ou confirmer le nom |
| `produits/gateau au chocolat.png` | Petits pancakes fourrés à la pâte à tartiner (façon dorayaki) — pas un gâteau classique | « Gâteau au chocolat » (nom d'origine conservé, description fidèle au visuel) | Nom exact du produit |
| `produits/mini pizza.png` | Pizza entière découpée en 6 parts, taille standard | « Mini pizza » (nom d'origine conservé) | Confirmer s'il s'agit de minis individuelles ou d'une pizza à partager |
| `produits/desert.png` | Flans au caramel en pots individuels | « Flan au caramel » | OK a priori (nom déduit du visuel) |
| `lifestyle produit/grace lifestyle.png` | Personnage dégustant la glace maison | Attribuée au produit « Glace maison » | OK a priori (« grace » = faute de frappe pour « glace ») |
| `lifestyle produit/ChatGPT Image 25 juil. 2026, 00_08_15 (7).png` | Personnage dégustant la pile de pancakes | Attribuée au produit « Pancakes moelleux » | OK a priori (vérifié visuellement) |

## 3. Dossier `archive/`

Le dossier `archive/` contient 26 fichiers (photos réelles de plats, anciennes générations, photo WhatsApp).
Conformément à son nom, **aucun de ces fichiers n'a été utilisé** sur le site.
Si certaines photos réelles doivent apparaître (galerie, témoignages), les désigner explicitement.

## 4. Données commerciales manquantes (non inventées)

| Donnée | Statut | Où la renseigner |
|---|---|---|
| Prix des 14 produits | **Aucun prix fourni** → le site affiche « Prix sur demande » et les totaux « à confirmer » | `js/products.js` → `price: 1500` (montant en KMF) |
| Numéro WhatsApp de commande | ✅ **Configuré : +269 488 03 43** (`2694880343`) — les commandes partent bien sur WhatsApp | `js/config.js` |
| Horaires, réseaux sociaux, témoignages clients | Non fournis → sections masquées ou libellés neutres | `js/config.js` |
