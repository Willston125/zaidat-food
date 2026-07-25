/* =========================================================
   ZAIDAT FOOD — Source des données du site
   ---------------------------------------------------------
   Le site sait fonctionner de deux façons, sans rien changer
   à son code d'affichage :

     • Supabase non configuré → les produits de js/products.js
       et les textes de js/config.js sont utilisés tels quels.
     • Supabase configuré     → produits, prix, photos et textes
       viennent du dashboard, et remplacent les valeurs par défaut.

   Si Supabase est injoignable (coupure réseau, projet en pause),
   le site retombe automatiquement sur les données locales plutôt
   que d'afficher une page vide.

   Les pages attendent `ZF.donneesPretes` avant de s'afficher.
   ========================================================= */

window.ZF = window.ZF || {};

/* Attend à la fois le chargement de la page ET l'arrivée des données.
   Les pages appellent ZF.pret(...) au lieu d'écouter DOMContentLoaded. */
ZF.pret = function (callback) {
  var page = new Promise(function (resolve) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", resolve);
    } else {
      resolve();
    }
  });
  Promise.all([page, ZF.donneesPretes]).then(function () { callback(); });
};

ZF.donneesPretes = (function () {
  "use strict";

  /* Une ligne de la base → la forme attendue par le site.
     Les noms de colonnes sont en français côté base (plus lisible
     pour qui ouvre Supabase), en anglais côté site (code existant). */
  function versProduit(l) {
    var options = [];
    if (l.options) {
      try {
        options = typeof l.options === "string" ? JSON.parse(l.options) : l.options;
      } catch (e) {
        options = [];
      }
    }
    var photo = l.image_produit || "";
    var life = l.image_lifestyle || "";
    return {
      id: l.id,
      slug: l.slug,
      name: l.nom,
      shortDescription: l.description_courte || "",
      description: l.description || "",
      price: typeof l.prix === "number" ? l.prix : null,
      currency: "KMF",
      category: l.categorie,
      productImage: photo,
      productThumb: photo,
      lifestyleImage: life,
      lifestyleThumb: life,
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
    var convertis = lignes.map(versProduit).filter(function (p) {
      return p.slug && p.name;
    });
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
      if (v && typeof v === "object" && !Array.isArray(v) && cible[k] && typeof cible[k] === "object" && !Array.isArray(cible[k])) {
        fusionner(cible[k], v);
      } else if (v !== null && v !== undefined) {
        cible[k] = v;
      }
    });
  }

  function appliquerReglages(reglages) {
    if (!reglages) return;
    /* Chaque clé de la table `reglages` correspond à une section
       de SITE_CONFIG (hero, about, contact…), sauf `categories`. */
    Object.keys(reglages).forEach(function (cle) {
      if (cle === "categories") {
        var cats = reglages.categories;
        if (Array.isArray(cats) && cats.length) {
          CATEGORIES.length = 0;
          cats.forEach(function (c) { CATEGORIES.push(c); });
        }
        return;
      }
      if (cle === "site") {
        fusionner(SITE_CONFIG, reglages.site);
        return;
      }
      if (SITE_CONFIG[cle] !== undefined) {
        if (typeof SITE_CONFIG[cle] === "object" && !Array.isArray(SITE_CONFIG[cle])) {
          fusionner(SITE_CONFIG[cle], reglages[cle]);
        } else {
          SITE_CONFIG[cle] = reglages[cle];
        }
      } else {
        SITE_CONFIG[cle] = reglages[cle];
      }
    });
  }

  /* Sans Supabase, on répond immédiatement : aucun délai ajouté. */
  if (typeof SB === "undefined" || !SB.estConfigure()) {
    ZF.sourceDonnees = "fichiers";
    return Promise.resolve({ source: "fichiers" });
  }

  /* Filet de sécurité : si la base ne répond pas en 6 secondes,
     on affiche le site avec les données locales. Mieux vaut un
     site un peu daté qu'un écran blanc. */
  function avecDelaiMax(promesse, ms) {
    return new Promise(function (resolve) {
      var fini = false;
      var minuteur = setTimeout(function () {
        if (!fini) { fini = true; resolve({ expire: true }); }
      }, ms);
      promesse.then(function (v) {
        if (!fini) { fini = true; clearTimeout(minuteur); resolve({ valeur: v }); }
      }, function (e) {
        if (!fini) { fini = true; clearTimeout(minuteur); resolve({ erreur: e }); }
      });
    });
  }

  return avecDelaiMax(
    Promise.all([SB.lireProduits(), SB.lireReglages()]),
    6000
  ).then(function (r) {
    if (r.valeur) {
      var lignes = r.valeur[0] || [];
      var reglages = r.valeur[1] || {};
      var okProduits = remplacerProduits(lignes);
      appliquerReglages(reglages);
      ZF.sourceDonnees = okProduits ? "supabase" : "fichiers (base vide)";
      return { source: ZF.sourceDonnees };
    }
    /* En cas d'échec, on n'interrompt pas l'affichage du site. */
    ZF.sourceDonnees = "fichiers (repli)";
    if (r.erreur && window.console) {
      console.warn("ZAIDAT FOOD — lecture Supabase impossible, affichage des données locales.", r.erreur.message);
    }
    return { source: ZF.sourceDonnees };
  });
})();
