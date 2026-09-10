/* =========================================================
   Résolution du navigateur de test
   ---------------------------------------------------------
   Playwright cherche par défaut une version précise de
   Chromium. Sur une machine où c'est une autre version qui
   est installée, il échoue avec « Executable doesn't exist ».
   On cherche donc nous-mêmes, dans cet ordre :

     1. la variable ZF_CHROMIUM, si elle est renseignée ;
     2. les Chromium présents sous PLAYWRIGHT_BROWSERS_PATH ;
     3. le choix par défaut de Playwright.

   `ouvrir()` renvoie un navigateur déjà lancé.
   ========================================================= */

"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

/* Adresse du serveur local qui sert le site pendant les tests. */
const BASE = process.env.ZF_BASE || "http://127.0.0.1:8123";

/* Le projet Supabase du site : les tests interceptent tout ce qui
   part vers ce domaine et répondent à la place de la vraie base. */
const PROJET = "dhhhdlthsxvscantcyir.supabase.co";

/* Racine du dépôt, quel que soit l'endroit d'où le test est lancé. */
const RACINE = path.join(__dirname, "..", "..");

function chercherChromium() {
  if (process.env.ZF_CHROMIUM) return process.env.ZF_CHROMIUM;

  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !fs.existsSync(base)) return null;

  /* Les dossiers s'appellent « chromium », « chromium-1194 »… On
     prend le plus récent, en comparant les numéros comme des
     nombres : sinon « chromium-999 » passerait après « chromium-1194 ». */
  const numero = (nom) => {
    const m = nom.match(/-(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  };
  const candidats = fs.readdirSync(base)
    .filter((d) => /^chromium(-\d+)?$/.test(d))
    .sort((a, b) => numero(b) - numero(a));

  for (const dossier of candidats) {
    const exe = path.join(base, dossier, "chrome-linux", "chrome");
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

const EXE = chercherChromium();

function ouvrir(options) {
  const o = Object.assign({}, options);
  if (EXE) o.executablePath = EXE;
  return chromium.launch(o);
}

module.exports = { chromium, ouvrir, EXE, BASE, PROJET, RACINE };
