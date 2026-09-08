/* =========================================================
   ZAIDAT FOOD — sitemap.xml
   ---------------------------------------------------------
   Généré à la demande plutôt qu'écrit une fois pour toutes : les
   produits changent depuis le dashboard, un fichier figé serait
   faux le lendemain.

   N'y figurent que les pages destinées aux moteurs : l'accueil et
   les fiches produits disponibles. Le panier, le dashboard et les
   pages légales sont volontairement absents (voir robots.txt).
   ========================================================= */

"use strict";

const P = require("./_partage");

module.exports = async function handler(req, res) {
  const base = P.origine(req);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  let produits = [];
  try {
    produits = await P.tousLesProduits();
  } catch (e) {
    produits = [];
  }

  const entrees = [
    { loc: base + "/index.html", priorite: "1.0", frequence: "weekly" },
  ];

  produits
    .filter((p) => p && p.slug && p.disponible !== false)
    .forEach((p) => {
      entrees.push({
        loc: base + "/produit.html?p=" + encodeURIComponent(p.slug),
        priorite: "0.8",
        frequence: "weekly",
      });
    });

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entrees
      .map(
        (e) =>
          "  <url>\n" +
          "    <loc>" + P.esc(e.loc) + "</loc>\n" +
          "    <lastmod>" + aujourdhui + "</lastmod>\n" +
          "    <changefreq>" + e.frequence + "</changefreq>\n" +
          "    <priority>" + e.priorite + "</priority>\n" +
          "  </url>"
      )
      .join("\n") +
    "\n</urlset>\n";

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  res.end(xml);
};
