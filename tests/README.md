# Tests

Ces tests rejouent les gestes réels d'une utilisatrice dans un vrai
navigateur, puis vérifient ce qui part effectivement vers la base.
Ils ont été écrits à l'occasion d'un audit qui a trouvé trois défauts
du tableau de bord ; ils sont là pour que ces défauts ne reviennent pas.

## Lancer

```bash
npm install     # une seule fois
npm test        # tout
```

Un serveur local est démarré automatiquement sur le port 8123, puis
arrêté à la fin. Le code de sortie vaut 0 si tout passe.

Plus rapide, sans navigateur :

```bash
npm run test:statique
```

## La base n'est jamais contactée

Aucun test ne parle au vrai projet Supabase. `tests/outils/supabase-simule.js`
intercepte tout ce qui part vers son domaine et répond à sa place, avec une
table en mémoire : ce qu'un test écrit, il peut le relire ensuite. C'est ce
qui permet de vérifier qu'un tarif modifié arrive bien en base — et de
simuler un compte non autorisé, ou une base injoignable, sans rien casser
en production.

## Organisation

| Dossier | Contenu |
|---|---|
| `outils/` | Le faux Supabase, et la résolution du navigateur |
| `site/` | Site public : partage WhatsApp, validation des données, affichage, accessibilité |
| `dashboard/` | Tableau de bord : enregistrement, écrans, cas limites |
| `media/` | Une vraie photo, pour tester recadrage et envoi |

Dans `dashboard/`, les fichiers numérotés viennent de l'audit et sont
classés par sujet plutôt que par ordre d'importance :

| Fichier | Ce qu'il vérifie |
|---|---|
| `01-enregistrement` | Tarif, nouveau produit, texte — et le refus d'un compte non autorisé |
| `02-apres-enregistrement` | Le site public reflète bien ce qui vient d'être enregistré |
| `03-parcours-complet` | Chaque écran, du geste jusqu'à la base |
| `04-saisie` / `05-saisie-bis` | La frappe au clavier est prise en compte partout |
| `06-zones-restantes` | Options, galerie, abandon de saisie, 21 produits, cas limites |
| `07-trafic` | Un seul prix modifié ne doit réécrire qu'un seul produit |
| `08-verification` | Les trois correctifs de l'audit, sur les gestes qui échouaient |
| `09-restes` | Listes, et perte de droits en cours de route |
| `10-retraits` | Retirer une photo, un témoignage |

## Écrire un nouveau test

Partez de `dashboard/01-enregistrement.js` : il montre le schéma habituel —
ouvrir le tableau de bord, se connecter, faire le geste, cliquer sur
Enregistrer, puis regarder `etat.base` pour voir ce qui a réellement été
écrit. Une vérification s'écrit `A.tv('ce qu on attend', condition, detail)`.

Deux pièges rencontrés en écrivant ceux-ci, qui font perdre du temps :

- `page.fill()` ne déclenche pas d'évènement `input`. Pour reproduire une
  vraie frappe, utilisez `page.keyboard.type()`, ou ajoutez explicitement
  `dispatchEvent('input')`. C'est précisément cette différence qui a
  révélé le défaut de l'écran Catégories.
- N'attendez pas une durée fixe après avoir cliqué sur Enregistrer :
  toute mesure de temps ne mesurerait plus que votre propre attente.
  `A.enregistrer()` attend la fin réelle.

## Le navigateur

`tests/outils/navigateur.js` cherche un Chromium utilisable plutôt que
d'en exiger une version précise. Pour en imposer un :

```bash
ZF_CHROMIUM=/chemin/vers/chrome npm test
```
