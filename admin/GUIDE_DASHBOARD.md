# Guide du dashboard — ZAIDAT FOOD

Le dashboard permet de gérer tout le site sans toucher au code :
produits, prix, photos, textes, contact, livraison.

**Adresse :** `https://votre-site.vercel.app/admin/`

---

## 1. Première connexion (à faire une seule fois)

Le dashboard enregistre les modifications dans votre dépôt GitHub, et Vercel
remet le site en ligne à jour tout seul. Il lui faut donc une **clé d'accès**.

### Créer la clé sur GitHub

1. Sur GitHub, cliquez sur votre photo de profil → **Settings** ;
2. tout en bas du menu de gauche → **Developer settings** ;
3. **Personal access tokens** → **Fine-grained tokens** → **Generate new token** ;
4. remplissez :
   - **Token name** : `Dashboard ZAIDAT`
   - **Expiration** : 90 jours ou 1 an (à renouveler ensuite)
   - **Repository access** : *Only select repositories* → choisissez le dépôt du site
5. **Permissions** → **Repository permissions** → réglez **Contents** sur
   **Read and write**. C'est la **seule** permission nécessaire ;
6. **Generate token**, puis **copiez la clé affichée** (elle n'est montrée qu'une fois).

### Renseigner le dashboard

Ouvrez `/admin/`, onglet **Connexion GitHub**, puis remplissez :

| Champ | Valeur |
|---|---|
| Compte GitHub | votre nom d'utilisateur |
| Nom du dépôt | le nom du dépôt du site |
| Branche | `main` |
| Clé d'accès | la clé copiée |

Cliquez **Vérifier et enregistrer**. Un message vert confirme la connexion.

> La clé reste **dans votre navigateur** et n'est envoyée qu'à GitHub.
> Elle n'apparaît jamais sur le site public.

---

## 2. Gérer les produits

Onglet **Produits**. L'ordre affiché est celui du menu sur le site
(les produits « mis en avant » remontent automatiquement en tête).

### Modifier un produit

**Modifier** → le panneau s'ouvre à droite :

- **Nom** et **adresse de la fiche** (celle-ci se remplit toute seule) ;
- **Catégorie** et **prix** — laisser le prix vide affiche « Prix sur demande » ;
- **Description courte** : la phrase sous le nom, sur la carte du menu ;
- **Description complète** : le texte de la fiche produit ;
- **Délai de préparation** et **portions** (facultatifs) ;
- **Disponible** : décoché, le produit reste visible mais ne peut plus être commandé ;
- **Mis en avant** : le produit remonte en tête du menu ;
- **Populaire** : ajoute le badge étoilé sur la carte.

### Les deux photos

Chaque produit a **deux** photos, avec des rôles différents :

| Photo | Rôle |
|---|---|
| **Photo du produit** | Le plat seul. C'est l'image de la carte du menu. |
| **Photo en situation** | La cuisinière avec ce même produit. Elle apparaît sur la fiche. |

Choisissez un fichier, **recadrez** (faites glisser pour centrer, curseur pour
zoomer), puis **Utiliser cette photo**. Deux tailles sont créées
automatiquement : 900 px pour la fiche, 450 px pour la carte.

> Vérifiez bien que la photo en situation montre **le même produit** que la
> photo principale : c'est tout l'intérêt du site.

### Ajouter, dupliquer, supprimer

- **+ Ajouter un produit** : formulaire vierge. Nom, catégorie et photo de
  produit sont obligatoires ;
- **Dupliquer** : pratique pour créer une variante (autre parfum, autre taille) ;
- **Supprimer** : demande confirmation, et n'est effectif qu'après publication.

---

## 3. Les autres onglets

| Onglet | Ce qu'on y règle |
|---|---|
| **Catégories** | Les filtres du menu. Une catégorie sans produit reste masquée sur le site. |
| **Textes du site** | Nom de la marque, bandeau du haut, grande image d'accueil, section « La cuisine de… ». |
| **Contact & livraison** | Numéro WhatsApp, téléphone affiché, horaires, modes de livraison, moyens de paiement, réseaux sociaux. |
| **Témoignages** | Retours clients. Tant que la liste est vide, la section n'apparaît pas. |

### Le numéro WhatsApp

C'est le réglage le plus important : **toutes les commandes y arrivent**.
Format international, **chiffres uniquement**, sans `+` ni espaces.

Exemple pour les Comores : `2694880343` (pour +269 488 03 43).

---

## 4. Publier

Le bandeau du haut indique en permanence s'il reste des modifications à publier.

1. Cliquez **Publier les modifications** ;
2. une fenêtre récapitule ce qui va partir, et signale :
   - les **erreurs** (en rouge) — elles bloquent la publication,
   - les **points à vérifier** (en jaune) — informatifs, sans blocage ;
3. **Publier maintenant** ;
4. le site en ligne se met à jour **environ une minute** après.

### Ce qui est vérifié avant publication

- deux produits ne peuvent pas avoir la même adresse de fiche ;
- chaque produit a un nom, une catégorie existante et une photo ;
- les prix sont des nombres positifs (ou vides) ;
- le numéro WhatsApp est au bon format ;
- **les fichiers générés sont exécutés à blanc** avant l'envoi : s'ils
  comportaient la moindre erreur, rien n'est publié.

Tout part en **un seul enregistrement** : le site n'est jamais dans un état
incohérent, par exemple un produit qui pointerait vers une photo pas encore
envoyée.

---

## 5. Questions courantes

**Puis-je travailler depuis mon téléphone ?**
Oui. Le dashboard s'adapte au mobile, y compris le recadrage des photos.

**J'ai fermé l'onglet sans publier.**
Les modifications non publiées sont perdues — le navigateur affiche un
avertissement avant de fermer. Publiez régulièrement.

**Je me suis trompé après avoir publié.**
Rien n'est perdu : chaque publication est un enregistrement daté dans GitHub.
Demandez à revenir à la version précédente.

**Le site n'est pas à jour après la publication.**
Attendez une minute, puis rechargez avec **Ctrl+Shift+R**. Vercel doit
reconstruire le site après chaque enregistrement.

**Quelqu'un peut-il ouvrir mon dashboard ?**
La page est accessible à qui connaît l'adresse, mais **sans la clé d'accès,
elle ne permet rien** : ni modification, ni publication. La clé est stockée
dans votre navigateur uniquement. Pour plus de sécurité, vous pouvez activer
la protection par mot de passe de Vercel (option payante).

**La clé a expiré.**
Créez-en une nouvelle (étape 1) et remplacez-la dans l'onglet
**Connexion GitHub**.

---

## 6. Limites connues

- **Le hero et le logo** ne sont pas modifiables depuis le dashboard : ce sont
  des fichiers fixes (`assets/img/hero-*`, `assets/img/logo-256.png`). Ils se
  remplacent directement dans le dépôt ;
- **renommer l'adresse d'une fiche** ne renomme pas les fichiers photos déjà
  publiés : ils continuent de fonctionner sous leur ancien nom. Pour repartir
  proprement, réimportez les photos après le changement ;
- **les anciennes photos remplacées ne sont pas effacées** du dépôt. Elles ne
  sont plus utilisées, mais occupent un peu d'espace ;
- **pas de gestion de plusieurs utilisateurs** : chacun utilise sa propre clé.
  Si deux personnes publient en même temps, la seconde publication peut être
  refusée — il suffit alors de recharger et de republier.
