/* =========================================================
   ZAIDAT FOOD — Source des données du site
   ---------------------------------------------------------
   HIÉRARCHIE DES SOURCES, de la plus fraîche à la plus sûre :

     1. Supabase          — la vérité, dès qu'elle répond ;
     2. cache local       — la dernière réponse Supabase valide,
                            conservée dans ce navigateur ;
     3. fichiers du site  — js/products.js et js/config.js, filet
                            de dernier recours, jamais vide.

   Le site N'ATTEND JAMAIS Supabase pour s'afficher. Il part
   immédiatement de la meilleure source déjà disponible (2, sinon 3),
   puis se met à jour en silence quand la base répond. C'est le
   principe « stale-while-revalidate » : mieux vaut un menu d'hier
   affiché tout de suite qu'une page blanche pendant six secondes
   sur une connexion mobile.

   Les pages appellent :
     • ZF.pret(fn)         — la page est prête à être construite ;
     • ZF.surMajDonnees(fn) — des données plus fraîches sont arrivées,
                              il faut réafficher.

   Tout ce qui vient de la base passe par js/valider.js avant
   d'être affiché : une valeur douteuse n'atteint jamais l'écran.
   ========================================================= */

window.ZF = window.ZF || {};

(function () {
  "use strict";

  var CLE_CACHE = "zaidat_donnees_v1";
  var VERSION_CACHE = 1;
  /* Au-delà, le cache est encore utilisé pour l'affichage immédiat,
     mais on prévient dans la console : il date probablement d'une
     période où la base était injoignable. */
  var AGE_SIGNALEMENT = 7 * 24 * 3600 * 1000;

  /* Copie de référence de la configuration livrée avec le site.
     Elle sert de valeur de repli à la validation : un numéro
     WhatsApp invalide reçu de la base ne doit jamais effacer le
     numéro officiel inscrit dans js/config.js. */
  var CONFIG_SECOURS = JSON.parse(JSON.stringify(
    typeof SITE_CONFIG !== "undefined" ? SITE_CONFIG : {}
  ));
  ZF.configSecours = CONFIG_SECOURS;

  /* ---------------------------------------------------------
     Conversion : une ligne de la base -> la forme attendue par le site
     Les noms de colonnes sont en français côté base (plus lisible
     pour qui ouvre Supabase), en anglais côté site (code existant).
     --------------------------------------------------------- */
  function versProduit(l) {
    var options = [];
    if (l.options) {
      try {
        options = typeof l.options === "string" ? JSON.parse(l.options) : l.options;
      } catch (e) {
        options = [];
      }
    }
    var grande = l.image_produit || "";
    var grandeVie = l.image_lifestyle || "";
    return {
      id: l.id,
      slug: l.slug,
      name: l.nom,
      shortDescription: l.description_courte || "",
      description: l.description || "",
      price: typeof l.prix === "number" ? l.prix : null,
      currency: "KMF",
      category: l.categorie,
      productImage: grande,
      /* Les vignettes 450 px sont fabriquées et envoyées par le
         dashboard : les ignorer revenait à charger l'image 900 px
         dans chaque carte du menu, soit environ quatre fois trop
         de données sur la page la plus visitée du site. */
      productThumb: l.image_produit_petite || grande,
      lifestyleImage: grandeVie,
      lifestyleThumb: l.image_lifestyle_petite || grandeVie,
      gallery: [],
      available: l.disponible !== false,
      featured: !!l.en_avant,
      bestseller: !!l.populaire,
      preparationTime: l.temps_preparation || undefined,
      portions: l.portions || undefined,
      options: Array.isArray(options) ? options : [],
    };
  }

  /* `PRODUCTS` est déclaré en `const` : on ne peut pas le remplacer,
     mais on peut vider et re-remplir le tableau, ce qui met à jour
     toutes les références déjà prises ailleurs dans le code. */
  function remplacerProduits(lignes) {
    var convertis = lignes
      .map(versProduit)
      .map(function (p) { return ZFV.nettoyerProduit(p); })
      .filter(function (p) { return p && p.productImage; });
    if (convertis.length === 0) return false;
    PRODUCTS.length = 0;
    convertis.forEach(function (p) { PRODUCTS.push(p); });
    return true;
  }

  /* Fusion en profondeur, pour qu'un réglage absent de la base
     garde sa valeur par défaut au lieu de devenir vide. */
  function fusionner(cible, source) {
    Object.keys(source || {}).forEach(function (k) {
      var v = source[k];
      if (v && typeof v === "object" && !Array.isArray(v) &&
          cible[k] && typeof cible[k] === "object" && !Array.isArray(cible[k])) {
        fusionner(cible[k], v);
      } else if (v !== null && v !== undefined) {
        cible[k] = v;
      }
    });
  }

  function appliquerReglages(reglages) {
    if (!reglages) return;
    Object.keys(reglages).forEach(function (cle) {
      if (cle === "categories") {
        var cats = reglages.categories;
        if (Array.isArray(cats) && cats.length) {
          CATEGORIES.length = 0;
          cats.forEach(function (c) {
            if (c && c.id && c.name) CATEGORIES.push(c);
          });
        }
        return;
      }
      if (cle === "site") {
        fusionner(SITE_CONFIG, reglages.site);
        return;
      }
      if (SITE_CONFIG[cle] !== undefined &&
          typeof SITE_CONFIG[cle] === "object" && !Array.isArray(SITE_CONFIG[cle])) {
        fusionner(SITE_CONFIG[cle], reglages[cle]);
      } else {
        SITE_CONFIG[cle] = reglages[cle];
      }
    });
    /* Dernier filtre avant affichage : liens, numéro, galerie. */
    ZFV.nettoyerConfig(SITE_CONFIG, CONFIG_SECOURS);
  }

  /* Applique un couple (produits, réglages) et dit si quelque chose
     a réellement changé — inutile de tout réafficher sinon. */
  function appliquer(lignes, reglages) {
    var avant = signature();
    var okProduits = Array.isArray(lignes) && lignes.length ? remplacerProduits(lignes) : false;
    appliquerReglages(reglages);
    return { okProduits: okProduits, aChange: signature() !== avant };
  }

  function signature() {
    try {
      return JSON.stringify({ p: PRODUCTS, c: CATEGORIES, s: SITE_CONFIG });
    } catch (e) {
      return String(Math.random());
    }
  }

  /* ---------------------------------------------------------
     Cache local : la dernière réponse valide de la base
     --------------------------------------------------------- */
  function lireCache() {
    var brut = null;
    try { brut = localStorage.getItem(CLE_CACHE); } catch (e) { return null; }
    if (!brut) return null;
    var d;
    try { d = JSON.parse(brut); } catch (e) { return null; }
    /* Validation stricte : un cache douteux est ignoré, pas réparé. */
    if (!d || typeof d !== "object") return null;
    if (d.v !== VERSION_CACHE) return null;
    if (typeof d.at !== "number" || !isFinite(d.at)) return null;
    if (!Array.isArray(d.produits) || d.produits.length === 0) return null;
    if (d.reglages && typeof d.reglages !== "object") return null;
    var valides = d.produits.filter(function (l) {
      return l && typeof l === "object" && typeof l.slug === "string" && typeof l.nom === "string";
    });
    if (valides.length === 0) return null;
    return { at: d.at, produits: valides, reglages: d.reglages || {} };
  }

  function ecrireCache(lignes, reglages) {
    try {
      localStorage.setItem(CLE_CACHE, JSON.stringify({
        v: VERSION_CACHE, at: Date.now(), produits: lignes, reglages: reglages || {},
      }));
    } catch (e) { /* navigation privée, quota plein : sans gravité */ }
  }

  ZF.viderCacheDonnees = function () {
    try { localStorage.removeItem(CLE_CACHE); } catch (e) {}
  };

  /* ---------------------------------------------------------
     Abonnés : prévenus quand des données plus fraîches arrivent
     --------------------------------------------------------- */
  var abonnes = [];
  ZF.surMajDonnees = function (fn) {
    if (typeof fn === "function") abonnes.push(fn);
  };
  function prevenir() {
    abonnes.forEach(function (fn) {
      try { fn(); } catch (e) { if (window.console) console.error(e); }
    });
  }

  /* ---------------------------------------------------------
     Départ immédiat : on affiche la meilleure source disponible
     --------------------------------------------------------- */
  var cache = lireCache();
  if (cache) {
    var r = appliquer(cache.produits, cache.reglages);
    ZF.sourceDonnees = r.okProduits ? "cache" : "fichiers";
    if (Date.now() - cache.at > AGE_SIGNALEMENT && window.console) {
      console.warn("ZAIDAT FOOD — données locales anciennes (" +
        Math.round((Date.now() - cache.at) / 86400000) + " jours). La base a-t-elle répondu récemment ?");
    }
  } else {
    /* Aucun cache : les fichiers du site font le travail. On les
       passe quand même par la validation, par principe. */
    ZFV.nettoyerConfig(SITE_CONFIG, CONFIG_SECOURS);
    ZF.sourceDonnees = "fichiers";
  }

  /* `ZF.donneesPretes` est conservée pour compatibilité, mais elle
     est désormais résolue tout de suite : plus rien n'attend le
     réseau pour s'afficher. */
  ZF.donneesPretes = Promise.resolve({ source: ZF.sourceDonnees });

  ZF.pret = function (callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      /* Asynchrone volontairement : le comportement reste identique
         à celui de l'ancienne promesse, quel que soit le moment où
         le script est exécuté. */
      Promise.resolve().then(callback);
    }
  };

  /* ---------------------------------------------------------
     Rafraîchissement en arrière-plan
     --------------------------------------------------------- */

  /* Les pages qui n'affichent ni produit ni réglage (mentions
     légales, confidentialité) n'ont aucune raison d'interroger la
     base : elles le déclarent avec `data-sans-donnees` sur <html>. */
  if (document.documentElement.hasAttribute("data-sans-donnees")) return;

  if (typeof SB === "undefined" || !SB.estConfigure()) return;

  Promise.all([SB.lireProduits(), SB.lireReglages()])
    .then(function (r) {
      var lignes = r[0] || [];
      var reglages = r[1] || {};
      if (!lignes.length) {
        /* Base joignable mais vide : le dashboard n'a pas encore
           publié. On garde ce qui est affiché. */
        ZF.sourceDonnees = ZF.sourceDonnees + " (base vide)";
        return;
      }
      var res = appliquer(lignes, reglages);
      if (res.okProduits) {
        ecrireCache(lignes, reglages);
        ZF.sourceDonnees = "supabase";
      }
      if (res.aChange) prevenir();
    })
    .catch(function (e) {
      /* La base ne répond pas : le site reste affiché avec le cache
         ou les fichiers. Aucune page blanche, aucune interruption. */
      ZF.sourceDonnees = ZF.sourceDonnees + " (repli, base injoignable)";
      if (window.console) {
        console.warn("ZAIDAT FOOD — lecture Supabase impossible, affichage des données locales.",
          e && e.message);
      }
    });
})();
