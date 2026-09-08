# Polices du site — comment retrouver Fraunces et Nunito Sans

Le site n'appelle plus Google Fonts. Il s'affiche aujourd'hui avec une pile
de polices système cohérente : instantané, sans dépendance, sans transmettre
l'adresse IP des visiteurs à un tiers.

Les polices d'origine restent utilisables. Il suffit de déposer quatre
fichiers ici, puis de décommenter un bloc. Environ cinq minutes.

## Pourquoi ce n'est pas déjà fait

Les fichiers de police ne sont pas dans le dépôt : ils doivent être
téléchargés depuis Google Fonts, ce que l'environnement où ces corrections
ont été réalisées ne pouvait pas faire (accès réseau sortant fermé). Aucun
fichier n'a été récupéré depuis une source non officielle.

## Ce qu'il faut faire

### 1. Récupérer les fichiers

Sur un poste ayant accès à Internet :

```bash
cd assets/fonts

# Fraunces — titres (graisses 600 et 700)
curl -sL "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" \
     -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" \
  | grep -o "https://fonts.gstatic.com[^)]*\.woff2"

# Nunito Sans — texte courant (graisses 400 et 700)
curl -sL "https://fonts.googleapis.com/css2?family=Nunito+Sans:opsz,wght@6..12,400;6..12,700&display=swap" \
     -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" \
  | grep -o "https://fonts.gstatic.com[^)]*\.woff2"
```

L'en-tête `User-Agent` d'un navigateur récent est indispensable : sans lui,
Google renvoie d'anciens formats (`.ttf`, `.woff`) beaucoup plus lourds.

Télécharger ensuite chaque adresse obtenue et l'enregistrer sous ces noms
exacts, dans ce dossier :

| Fichier attendu         | Police       | Graisse |
|-------------------------|--------------|---------|
| `fraunces-600.woff2`    | Fraunces     | 600     |
| `fraunces-700.woff2`    | Fraunces     | 700     |
| `nunito-sans-400.woff2` | Nunito Sans  | 400     |
| `nunito-sans-700.woff2` | Nunito Sans  | 700–800 |

> Alternative sans ligne de commande : sur <https://gwfh.mranftl.com/fonts>,
> choisir la police, la graisse, cocher **woff2**, télécharger, puis
> renommer les fichiers comme ci-dessus.

### 2. Activer le bloc

Dans `assets/fonts/polices.css`, retirer les deux marqueurs de commentaire
qui encadrent les règles `@font-face` (les lignes qui le signalent sont
explicites).

Rien d'autre à modifier : `css/styles.css` et `admin/css/admin.css` nomment
déjà « Fraunces » et « Nunito Sans » en tête de leurs piles de polices. Elles
reprennent la main dès que les fichiers sont présents.

### 3. Vérifier

Ouvrir le site, puis les outils de développement → onglet **Réseau**, filtre
**Font** : les quatre fichiers doivent se charger depuis votre propre domaine,
et aucune requête ne doit partir vers `fonts.googleapis.com` ou
`fonts.gstatic.com`.

## Licence

Fraunces et Nunito Sans sont publiées sous SIL Open Font License 1.1, qui
autorise l'hébergement sur votre propre serveur. Conserver le fichier de
licence fourni avec les polices dans ce dossier.

## Si vous ne faites rien

Le site fonctionne parfaitement en l'état. La pile système utilisée
(Iowan Old Style / Palatino / Georgia pour les titres, la police d'interface
du système pour le texte) reste proche de l'esprit d'origine : un serif
chaleureux pour les titres, un sans-serif lisible pour le reste.
