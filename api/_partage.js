/* =========================================================
   ZAIDAT FOOD — Outils communs aux fonctions de partage
   ---------------------------------------------------------
   Les robots de WhatsApp, Facebook, Messenger ou Telegram
   n'exécutent PAS le JavaScript de la page : ils lisent le HTML
   tel qu'il arrive. Des balises `og:` remplies côté navigateur
   sont donc invisibles pour eux — c'est pour cela qu'un lien de
   fiche produit partagé sur WhatsApp n'affichait ni titre ni
   photo, alors que le site est justement conçu autour de ce
   partage.

   Ce module fournit ce dont les fonctions `api/` ont besoin :
   lire les produits, connaître l'adresse publique du site, et
   échapper correctement ce qui est inséré dans du HTML.
   ========================================================= */

"use strict";

const fs = require("fs");
const path = require("path");

/* Adresse publique du site.
   Déduite de la requête, ce qui la rend juste automatiquement sur
   un déploiement de test, sur *.vercel.app comme sur un domaine
   personnalisé, sans rien reconfigurer. La variable
   d'environnement ZF_SITE_ORIGIN permet de forcer une valeur. */
function origine(req) {
  if (process.env.ZF_SITE_ORIGIN) {
    return String(process.env.ZF_SITE_ORIGIN).replace(/\/+$/, "");
  }
  const hote =
    (req && req.headers && (req.headers["x-forwarded-host"] || req.headers.host)) ||
    "zaidatfood.online";
  const protocole =
    (req && req.headers && req.headers["x-forwarded-proto"]) ||
    (/^localhost|^127\./.test(hote) ? "http" : "https");
  return protocole + "://" + hote;
}

/* Échappement HTML. Les valeurs viennent de la base : elles sont
   déjà contrôlées à l'écriture, mais on ne construit jamais du HTML
   avec du texte non échappé. */
function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Une adresse d'image doit être absolue pour les robots de partage,
   et ne peut pointer que vers notre domaine ou vers le stockage
   Supabase. Tout le reste est refusé. */
function imageAbsolue(url, base) {
  const v = String(url || "").trim();
  if (!v) return null;
  if (/^https:\/\//i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null;   /* javascript:, data:… */
  if (v.startsWith("//")) return null;
  if (v.includes("..")) return null;
  return base + "/" + v.replace(/^\/+/, "");
}

/* ---------- Lecture des produits ----------
   Supabase d'abord ; en cas d'échec, le catalogue livré avec le
   site. Un robot de partage n'attend pas : le délai est court. */

function configSupabase() {
  try {
    const src = fs.readFileSync(
      path.join(process.cwd(), "js", "supabase-config.js"), "utf8"
    );
    const url = (src.match(/url:\s*"([^"]+)"/) || [])[1];
    const cle = (src.match(/anonKey:\s*"([^"]+)"/) || [])[1];
    if (url && cle) return { url: url.replace(/\/+$/, ""), cle: cle };
  } catch (e) { /* fichier absent : on passera au catalogue local */ }
  return null;
}

function avecDelai(promesse, ms) {
  return Promise.race([
    promesse,
    new Promise((_, rejeter) => setTimeout(() => rejeter(new Error("délai dépassé")), ms)),
  ]);
}

function produitsDepuisSupabase(limite) {
  const c = configSupabase();
  if (!c) return Promise.reject(new Error("Supabase non configuré"));
  const champs = "slug,nom,description_courte,description,prix,image_produit,image_lifestyle,disponible,ordre";
  const url = c.url + "/rest/v1/produits?select=" + champs +
    "&order=ordre.asc" + (limite ? "&limit=" + limite : "");
  return avecDelai(
    fetch(url, { headers: { apikey: c.cle, Authorization: "Bearer " + c.cle } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))),
    2500
  );
}

/* Catalogue de secours : les produits inscrits dans js/products.js.
   Lu par expression régulière plutôt qu'exécuté — une fonction
   serveur n'a aucune raison d'évaluer du code. */
function produitsDeSecours() {
  try {
    const src = fs.readFileSync(path.join(process.cwd(), "js", "products.js"), "utf8");
    const debut = src.indexOf("const PRODUCTS = [");
    if (debut === -1) return [];
    const tableau = src.slice(debut + "const PRODUCTS = ".length);
    const fin = tableau.lastIndexOf("];");
    if (fin === -1) return [];
    /* On ne garde que les champs utiles au partage, extraits un par un. */
    const blocs = tableau.slice(0, fin + 1).split(/\n  \{/);
    return blocs
      .map((b) => {
        const champ = (nom) => {
          const m = b.match(new RegExp(nom + ':\\s*"((?:[^"\\\\]|\\\\.)*)"'));
          return m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\") : "";
        };
        const slug = champ("slug");
        if (!slug) return null;
        return {
          slug: slug,
          nom: champ("name"),
          description_courte: champ("shortDescription"),
          description: champ("description"),
          image_produit: champ("productImage"),
          image_lifestyle: champ("lifestyleImage"),
          prix: null,
          disponible: !/available:\s*false/.test(b),
        };
      })
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

function tousLesProduits(limite) {
  return produitsDepuisSupabase(limite)
    .then((lignes) => (Array.isArray(lignes) && lignes.length ? lignes : produitsDeSecours()))
    .catch(() => produitsDeSecours());
}

/* Lit un fichier statique du projet (produit.html…).
   `includeFiles` dans vercel.json garantit sa présence à côté de
   la fonction déployée. */
function lireFichierStatique(nom) {
  return fs.readFileSync(path.join(process.cwd(), nom), "utf8");
}

module.exports = {
  origine,
  esc,
  imageAbsolue,
  tousLesProduits,
  produitsDeSecours,
  lireFichierStatique,
};
