/* =========================================================
   ZAIDAT FOOD — Fiche produit servie avec ses vraies métadonnées
   ---------------------------------------------------------
   Sert exactement la même page que produit.html, mais avec le
   titre, la description, la photo et l'adresse canonique du
   produit demandé déjà écrits dans le HTML.

   POURQUOI CETTE FONCTION EXISTE : les robots d'aperçu de
   WhatsApp, Facebook et Telegram n'exécutent pas le JavaScript.
   Remplir les balises `og:` depuis le navigateur, comme le faisait
   la version précédente, ne les atteint jamais. Résultat : chaque
   fiche produit partagée affichait le même titre générique et
   aucune photo — sur le canal par lequel passe toute l'activité.

   La page reste strictement identique pour les visiteurs : seul
   le contenu du <head> change.

   En cas de problème (Supabase muet, fichier illisible), la page
   statique est servie telle quelle : jamais d'erreur affichée.
   ========================================================= */

"use strict";

const P = require("./_partage");

const MARQUEUR_DEBUT = "<!-- ZF:META-DEBUT";
const MARQUEUR_FIN = "<!-- ZF:META-FIN -->";

/* Description de repli, pour un produit dont la fiche est encore vide. */
const DESCRIPTION_PAR_DEFAUT =
  "Cuisine artisanale comorienne : plats, gâteaux, snacks et douceurs maison, " +
  "préparés sur commande par ZAIDAT FOOD.";

function couperA(texte, longueur) {
  const t = String(texte || "").replace(/\s+/g, " ").trim();
  if (t.length <= longueur) return t;
  return t.slice(0, longueur - 1).replace(/\s+\S*$/, "") + "…";
}

function baliseMeta(produit, base, slug) {
  const esc = P.esc;
  const url = base + "/produit.html?p=" + encodeURIComponent(slug);

  if (!produit) {
    /* Produit inconnu : on ne raconte pas d'histoire, on renvoie
       vers le menu avec une description honnête. */
    return [
      "  <title>Produit introuvable — ZAIDAT FOOD</title>",
      '  <meta name="description" content="' + esc(DESCRIPTION_PAR_DEFAUT) + '">',
      '  <meta name="robots" content="noindex, follow">',
      '  <link rel="canonical" href="' + esc(base + "/index.html") + '">',
      '  <meta property="og:type" content="website">',
      '  <meta property="og:site_name" content="ZAIDAT FOOD">',
      '  <meta property="og:title" content="ZAIDAT FOOD — Cuisine artisanale comorienne">',
      '  <meta property="og:description" content="' + esc(DESCRIPTION_PAR_DEFAUT) + '">',
      '  <meta property="og:url" content="' + esc(base + "/index.html") + '">',
      '  <meta property="og:image" content="' + esc(base + "/assets/img/hero-1672.jpg") + '">',
      '  <meta property="og:locale" content="fr_FR">',
      '  <meta name="twitter:card" content="summary_large_image">',
    ].join("\n");
  }

  const nom = produit.nom || "Produit";
  const titre = nom + " — ZAIDAT FOOD";
  const description = couperA(
    produit.description_courte || produit.description || DESCRIPTION_PAR_DEFAUT, 200
  );

  /* La photo en situation donne un aperçu bien plus appétissant que
     le produit seul : c'est elle qu'on met en avant au partage. */
  const image =
    P.imageAbsolue(produit.image_lifestyle, base) ||
    P.imageAbsolue(produit.image_produit, base) ||
    base + "/assets/img/hero-1672.jpg";

  const lignes = [
    "  <title>" + esc(titre) + "</title>",
    '  <meta name="description" content="' + esc(description) + '">',
    '  <link rel="canonical" href="' + esc(url) + '">',
    '  <meta property="og:type" content="product">',
    '  <meta property="og:site_name" content="ZAIDAT FOOD">',
    '  <meta property="og:title" content="' + esc(titre) + '">',
    '  <meta property="og:description" content="' + esc(description) + '">',
    '  <meta property="og:url" content="' + esc(url) + '">',
    '  <meta property="og:image" content="' + esc(image) + '">',
    '  <meta property="og:image:alt" content="' + esc(nom + " — ZAIDAT FOOD") + '">',
    '  <meta property="og:locale" content="fr_FR">',
    '  <meta name="twitter:card" content="summary_large_image">',
    '  <meta name="twitter:title" content="' + esc(titre) + '">',
    '  <meta name="twitter:description" content="' + esc(description) + '">',
    '  <meta name="twitter:image" content="' + esc(image) + '">',
  ];

  if (typeof produit.prix === "number" && produit.prix >= 0) {
    lignes.push('  <meta property="product:price:amount" content="' + esc(produit.prix) + '">');
    lignes.push('  <meta property="product:price:currency" content="KMF">');
  }
  lignes.push(
    '  <meta property="product:availability" content="' +
    (produit.disponible === false ? "out of stock" : "in stock") + '">'
  );

  return lignes.join("\n");
}

module.exports = async function handler(req, res) {
  const base = P.origine(req);
  const url = new URL(req.url, base);
  const slug = (url.searchParams.get("p") || "").trim();

  let gabarit;
  try {
    gabarit = P.lireFichierStatique("produit.html");
  } catch (e) {
    /* Le gabarit n'a pas pu être lu. Plutôt qu'une erreur, on renvoie
       le visiteur vers la page statique, servie directement par le
       CDN grâce au paramètre qui désactive cette réécriture. */
    res.statusCode = 302;
    res.setHeader("Location", "/produit.html?__raw=1" + (slug ? "&p=" + encodeURIComponent(slug) : ""));
    res.end();
    return;
  }

  let produit = null;
  if (slug && /^[a-z0-9-]{1,80}$/.test(slug)) {
    try {
      const lignes = await P.tousLesProduits();
      produit = lignes.find((l) => l && l.slug === slug) || null;
    } catch (e) {
      produit = null;
    }
  }

  const debut = gabarit.indexOf(MARQUEUR_DEBUT);
  const fin = gabarit.indexOf(MARQUEUR_FIN);
  let html = gabarit;
  if (debut !== -1 && fin !== -1 && fin > debut) {
    html =
      gabarit.slice(0, debut) +
      baliseMeta(produit, base, slug).trimStart() +
      gabarit.slice(fin + MARQUEUR_FIN.length);
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  /* Le CDN garde la page cinq minutes et continue de la servir
     pendant qu'il la rafraîchit : les robots de partage et les
     visiteurs n'attendent jamais Supabase. */
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=86400");
  res.end(html);
};

/* Exporté pour les tests hors ligne. */
module.exports.baliseMeta = baliseMeta;
module.exports.couperA = couperA;
