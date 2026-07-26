/* =========================================================
   ZAIDAT FOOD — Sauvegarde du dashboard (Supabase)
   ---------------------------------------------------------
   Couche d'enregistrement du dashboard. Ici, « Enregistrer »
   écrit directement dans la base : le site est à jour dans la
   seconde, sans manipulation technique.

   Le dashboard reste utilisable même sans Supabase : il lit alors
   les fichiers du site en lecture seule, pour qu'on puisse voir
   les produits en attendant la configuration.
   ========================================================= */

window.BACK = (function () {
  "use strict";

  function configure() { return typeof SB !== "undefined" && SB.estConfigure(); }
  function connecte() { return configure() && SB.estConnecte(); }

  /* ---------- Conversions base ⇄ site ---------- */

  /* Ligne de la base → produit tel que le site l'attend */
  function versProduit(l) {
    var opts = l.options;
    if (typeof opts === "string") { try { opts = JSON.parse(opts); } catch (e) { opts = []; } }
    return {
      _id: l.id,
      slug: l.slug,
      name: l.nom,
      shortDescription: l.description_courte || "",
      description: l.description || "",
      price: typeof l.prix === "number" ? l.prix : null,
      currency: "KMF",
      category: l.categorie,
      productImage: l.image_produit || "",
      productThumb: l.image_produit_petite || l.image_produit || "",
      lifestyleImage: l.image_lifestyle || "",
      lifestyleThumb: l.image_lifestyle_petite || l.image_lifestyle || "",
      gallery: [],
      available: l.disponible !== false,
      featured: !!l.en_avant,
      bestseller: !!l.populaire,
      preparationTime: l.temps_preparation || "",
      portions: l.portions || "",
      options: Array.isArray(opts) ? opts : [],
    };
  }

  /* Produit du site → ligne de la base */
  function versLigne(p, ordre) {
    return {
      slug: p.slug,
      nom: p.name,
      description_courte: p.shortDescription || "",
      description: p.description || "",
      prix: typeof p.price === "number" ? p.price : null,
      categorie: p.category,
      image_produit: p.productImage || "",
      image_produit_petite: p.productThumb || p.productImage || "",
      image_lifestyle: p.lifestyleImage || "",
      image_lifestyle_petite: p.lifestyleThumb || p.lifestyleImage || "",
      disponible: p.available !== false,
      en_avant: !!p.featured,
      populaire: !!p.bestseller,
      temps_preparation: p.preparationTime || "",
      portions: p.portions || "",
      options: p.options || [],
      ordre: ordre,
    };
  }

  /* ---------- Lecture ---------- */

  /* Lit les fichiers du site : sert de point de départ quand la
     base est encore vide, et de mode consultation sans Supabase. */
  function lireFichiersLocaux() {
    return Promise.all([
      fetch("/js/products.js").then(function (r) { return r.text(); }),
      fetch("/js/config.js").then(function (r) { return r.text(); }),
    ]).then(function (s) {
      var f = new Function(
        s[0] + "\n" + s[1] +
        "\nreturn { CATEGORIES: CATEGORIES, PRODUCTS: PRODUCTS, SITE_CONFIG: SITE_CONFIG };"
      );
      var d = f();
      return { categories: d.CATEGORIES, produits: d.PRODUCTS, config: d.SITE_CONFIG, source: "fichiers" };
    });
  }

  function charger() {
    if (!configure()) {
      return lireFichiersLocaux().then(function (d) {
        d.lectureSeule = true;
        return d;
      });
    }
    return Promise.all([SB.lireProduits(), SB.lireReglages()])
      .then(function (r) {
        var lignes = r[0] || [];
        var reglages = r[1] || {};

        /* Base vide : on part des fichiers du site, que la cuisinière
           pourra enregistrer d'un clic pour amorcer la base. */
        if (lignes.length === 0) {
          return lireFichiersLocaux().then(function (d) {
            d.source = "fichiers";
            d.baseVide = true;
            if (reglages.site) fusionner(d.config, reglages.site);
            if (Array.isArray(reglages.categories) && reglages.categories.length) d.categories = reglages.categories;
            return d;
          });
        }

        /* Les textes viennent de la base ; ceux absents gardent la
           valeur du fichier config.js pour ne jamais afficher du vide. */
        return lireFichiersLocaux().then(function (base) {
          var config = base.config;
          if (reglages.site) fusionner(config, reglages.site);
          var categories = (Array.isArray(reglages.categories) && reglages.categories.length)
            ? reglages.categories : base.categories;
          return {
            categories: categories,
            produits: lignes.map(versProduit),
            config: config,
            source: "supabase",
          };
        });
      });
  }

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

  /* ---------- Écriture ---------- */

  /* Enregistre tout : produits (création, modification, suppression)
     puis les textes. `surAvancement` sert à afficher la progression. */
  function enregistrer(D, surAvancement) {
    if (!connecte()) return Promise.reject(new Error("Connectez-vous avant d'enregistrer."));
    var avance = surAvancement || function () {};

    return SB.lireProduits().then(function (existants) {
      var parSlug = {};
      (existants || []).forEach(function (l) { parSlug[l.slug] = l; });

      var slugsGardes = {};
      var total = D.produits.length + 1;
      var fait = 0;

      /* Les produits sont traités l'un après l'autre : plus lent,
         mais un échec n'entraîne pas de perte silencieuse. */
      var chaine = Promise.resolve();
      D.produits.forEach(function (p, i) {
        slugsGardes[p.slug] = true;
        chaine = chaine.then(function () {
          avance(++fait, total, p.name);
          var ligne = versLigne(p, i);
          var ancien = parSlug[p.slug];
          return ancien ? SB.majProduit(ancien.id, ligne) : SB.creerProduit(ligne);
        });
      });

      /* Produits retirés du dashboard → supprimés de la base */
      (existants || []).forEach(function (l) {
        if (!slugsGardes[l.slug]) {
          chaine = chaine.then(function () { return SB.supprimerProduit(l.id); });
        }
      });

      chaine = chaine.then(function () {
        avance(++fait, total, "Textes du site");
        return Promise.all([
          SB.enregistrerReglage("site", D.config),
          SB.enregistrerReglage("categories", D.categories),
        ]);
      });

      return chaine;
    });
  }

  /* ---------- Photos ---------- */

  function dataURLversBlob(dataURL) {
    var parts = dataURL.split(",");
    var type = (parts[0].match(/:(.*?);/) || [])[1] || "image/jpeg";
    var binaire = atob(parts[1]);
    var n = binaire.length;
    var tampon = new Uint8Array(n);
    while (n--) tampon[n] = binaire.charCodeAt(n);
    return new Blob([tampon], { type: type });
  }

  /* Nom unique : évite qu'une nouvelle photo reste masquée par
     l'ancienne dans le cache du navigateur ou du CDN. */
  function nomPhoto(slug, genre, taille) {
    var jeton = Date.now().toString(36);
    return genre + "/" + slug + "-" + taille + "-" + jeton + ".jpg";
  }

  function envoyerPhoto(dataURL, slug, genre, taille) {
    if (!connecte()) return Promise.reject(new Error("Connectez-vous pour envoyer une photo."));
    return SB.televerserPhoto(dataURLversBlob(dataURL), nomPhoto(slug, genre, taille));
  }

  return {
    estConfigure: configure,
    estConnecte: connecte,
    email: function () { return configure() ? SB.emailConnecte() : null; },
    connexion: function (e, m) { return SB.connexion(e, m); },
    deconnexion: function () { return SB.deconnexion(); },
    charger: charger,
    enregistrer: enregistrer,
    envoyerPhoto: envoyerPhoto,
    tester: function () { return SB.tester(); },
  };
})();
