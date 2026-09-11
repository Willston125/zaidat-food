/* Serveur statique des tests. Reproduit la seule règle de Vercel qui
   compte ici : /produit.html et /produit servent le gabarit de fiche,
   qui n'existe pas sous ce nom (voir gabarit-produit.html). */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const RACINE = path.join(__dirname, "..", "..");
const PORT = parseInt(process.env.ZF_PORT || "8123", 10);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml",
  ".woff2": "font/woff2", ".mp4": "video/mp4", ".ico": "image/x-icon" };
const REECRITURES = { "/produit.html": "/gabarit-produit.html", "/produit": "/gabarit-produit.html",
  "/commande": "/commande.html", "/mentions-legales": "/mentions-legales.html",
  "/confidentialite": "/confidentialite.html", "/": "/index.html", "/admin": "/admin/index.html",
  "/admin/": "/admin/index.html" };
http.createServer((req, res) => {
  let chemin = decodeURIComponent(new URL(req.url, "http://x").pathname);
  chemin = REECRITURES[chemin] || chemin;
  const fichier = path.normalize(path.join(RACINE, chemin));
  if (!fichier.startsWith(RACINE) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("404");
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(fichier)] || "application/octet-stream" });
  fs.createReadStream(fichier).pipe(res);
}).listen(PORT, "127.0.0.1");
