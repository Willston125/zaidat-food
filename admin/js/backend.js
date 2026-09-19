/* =========================================================
   ZAIDAT FOOD — Sauvegarde du dashboard (Supabase)
   ---------------------------------------------------------
   Couche d'enregistrement du dashboard. « Enregistrer » écrit
   directement dans la base : le site est à jour dans la seconde.

   Trois garde-fous, chacun corrigeant un défaut constaté :

     • MODE CONSULTATION — si la base ne répond pas, le dashboard
       affiche quand même les données (dernier cache, sinon
       fichiers du site) et désactive l'enregistrement, au lieu de
       rester bloqué sur « Chargement… » ;

     • CONCURRENCE — avant d'écrire, on vérifie que personne n'a
       enregistré depuis le chargement. Sinon un onglet resté
       ouvert sur un téléphone pouvait supprimer des produits
       ajoutés depuis l'ordinateur ;

     • NETTOYAGE DES PHOTOS — les images remplacées ou devenues
       inutiles sont supprimées du stockage, mais seulement APRÈS
       que les nouvelles données ont bien été enregistrées.
   ========================================================= */

window.BACK = (function () {
  "use strict";

  function configure() { return typeof SB !== "undefined" && SB.estConfigure(); }
  function connecte() { return configure() && SB.estConnecte(); }

  /* Le dashboard lit le même cache que le site : c'est la dernière
     réponse valide de la base, et donc la meilleure source hors ligne. */
  var CLE_CACHE = "zaidat_donnees_v1";

  /* Empreinte de l'état de la base au moment du chargement.
     Sert uniquement à détecter un enregistrement concurrent. */
  var versionChargee = null;

  /* Photos présentes en base au chargement, par produit. Sert à
     savoir lesquelles sont devenues orphelines après modification. */
  var photosChargees = [];

  /* Idem pour les photos de la galerie, qui vivent dans les réglages. */
  var photosDeGalerieChargee = [];

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

  /* Une ligne est-elle deja identique en base ?
     Sans cette comparaison, enregistrer un seul prix reecrivait les
     vingt-et-un produits : vingt-et-un allers-retours reseau, plus de
     quinze secondes d'attente sur une connexion mobile, et autant
     d'occasions qu'un echec interrompe l'enregistrement en cours de
     route. On ne compare que les champs qu'on ecrit. */
  function memeLigne(existant, nouvelle) {
    if (!existant) return false;
    return Object.keys(nouvelle).every(function (cle) {
      var a = existant[cle], b = nouvelle[cle];
      if (a === b) return true;
      if (a === null || a === undefined) return b === null || b === undefined || b === "";
      if (typeof a === "object" || typeof b === "object") {
        return JSON.stringify(a) === JSON.stringify(b);
      }
      return false;
    });
  }

  /* ---------- Lecture ---------- */

  /* Catalogue livré avec le site : point de départ quand la base est
     encore vide, et filet de dernier recours hors ligne.

     Les fichiers js/products.js et js/config.js sont chargés
     normalement par admin/index.html et exposent leurs données en
     variables globales. La version précédente les téléchargeait
     puis les exécutait avec `new Function()` — ce qui obligeait à
     autoriser `unsafe-eval` dans la politique de sécurité du site,
     et donc à ouvrir une porte inutile. On lit désormais simplement
     les globales, avec une copie profonde pour que l'appelant puisse
     les modifier sans altérer la référence. */
  function lireFichiersLocaux() {
    function copie(v) { return JSON.parse(JSON.stringify(v)); }
    try {
      return Promise.resolve({
        categories: copie(CATEGORIES),
        produits: copie(PRODUCTS),
        config: copie(SITE_CONFIG),
        source: "fichiers",
      });
    } catch (e) {
      return Promise.reject(new Error(
        "Le catalogue de secours du site n'a pas pu être lu (js/products.js ou js/config.js)."
      ));
    }
  }

  /* Dernière réponse valide de la base, conservée par le site.
     Renvoie null si le cache est absent, périmé de format ou douteux. */
  function lireCacheSite() {
    var brut = null;
    try { brut = localStorage.getItem(CLE_CACHE); } catch (e) { return null; }
    if (!brut) return null;
    var d;
    try { d = JSON.parse(brut); } catch (e) { return null; }
    if (!d || d.v !== 1 || !Array.isArray(d.produits) || !d.produits.length) return null;
    var lignes = d.produits.filter(function (l) {
      return l && typeof l.slug === "string" && typeof l.nom === "string";
    });
    if (!lignes.length) return null;
    return { at: d.at, lignes: lignes, reglages: d.reglages || {} };
  }

  /* Assemble le résultat final à partir de lignes de base et de
     réglages, en complétant par les fichiers du site pour tout ce
     qui manque (jamais de champ vide affiché). */
  function assembler(lignes, reglages) {
    return lireFichiersLocaux().then(function (base) {
      var config = base.config;
      if (reglages.site) fusionner(config, reglages.site);
      var categories = (Array.isArray(reglages.categories) && reglages.categories.length)
        ? reglages.categories : base.categories;
      return {
        categories: categories,
        produits: lignes.map(versProduit),
        config: config,
      };
    });
  }

  function charger() {
    versionChargee = null;
    photosChargees = [];

    if (!configure()) {
      return lireFichiersLocaux().then(function (d) {
        d.lectureSeule = true;
        d.motif = "non-configure";
        return d;
      });
    }

    return Promise.all([SB.lireProduits(), SB.lireReglages()])
      .then(function (r) {
        var lignes = r[0] || [];
        var reglages = r[1] || {};

        /* Base joignable mais vide : on part des fichiers du site,
           que la cuisinière pourra enregistrer d'un clic. */
        if (lignes.length === 0) {
          return lireFichiersLocaux().then(function (d) {
            d.source = "fichiers";
            d.baseVide = true;
            if (reglages.site) fusionner(d.config, reglages.site);
            if (Array.isArray(reglages.categories) && reglages.categories.length) {
              d.categories = reglages.categories;
            }
            versionChargee = {};
            return d;
          });
        }

        versionChargee = empreinte(lignes);
        photosChargees = photosDeLignes(lignes);

        return assembler(lignes, reglages).then(function (d) {
          d.source = "supabase";
          return d;
        });
      })
      .catch(function (err) {
        /* LA BASE NE RÉPOND PAS.
           Avant, cette erreur laissait le dashboard sur un écran
           « Impossible de charger les données » et un état figé sur
           « Chargement… ». On bascule désormais en consultation, avec
           les meilleures données disponibles. */
        var cache = lireCacheSite();
        var suite = cache
          ? assembler(cache.lignes, cache.reglages).then(function (d) {
              d.source = "cache";
              d.dateCache = cache.at;
              return d;
            })
          : lireFichiersLocaux();

        return suite.then(function (d) {
          d.lectureSeule = true;
          d.motif = "base-injoignable";
          d.erreur = err && err.message;
          return d;
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

  /* ---------- Concurrence (FIA-7) ---------- */

  /* Empreinte : un produit connu, sa date de dernière modification.
     Deux empreintes identiques = personne n'a écrit entre-temps. */
  function empreinte(lignes) {
    var o = {};
    (lignes || []).forEach(function (l) {
      o[l.slug] = String(l.modifie_le || l.id || "");
    });
    return o;
  }

  function memeEmpreinte(a, b) {
    if (!a || !b) return false;
    var ca = Object.keys(a), cb = Object.keys(b);
    if (ca.length !== cb.length) return false;
    return ca.every(function (k) { return b[k] === a[k]; });
  }

  function ErreurConflit(message) {
    var e = new Error(message);
    e.conflit = true;
    return e;
  }

  /* ---------- Photos (FIA-6) ---------- */

  function photosDeLignes(lignes) {
    var urls = [];
    (lignes || []).forEach(function (l) {
      ["image_produit", "image_produit_petite", "image_lifestyle", "image_lifestyle_petite"]
        .forEach(function (c) { if (l[c]) urls.push(l[c]); });
    });
    return urls;
  }

  function photosUtilisees(D) {
    var urls = {};
    (D.produits || []).forEach(function (p) {
      [p.productImage, p.productThumb, p.lifestyleImage, p.lifestyleThumb]
        .forEach(function (u) { if (u) urls[u] = true; });
    });
    ((D.config && D.config.galerie) || []).forEach(function (g) {
      if (g.url) urls[g.url] = true;
      if (g.urlPetite) urls[g.urlPetite] = true;
    });
    var af = D.config && D.config.affiche;
    if (af) {
      if (af.image) urls[af.image] = true;
      if (af.imagePetite) urls[af.imagePetite] = true;
    }
    return urls;
  }

  /* Supprime les photos qui ne sont plus référencées nulle part.
     Appelée UNIQUEMENT après un enregistrement réussi : une photo
     ne disparaît jamais avant que la donnée qui la remplace soit
     sûrement en base. Un échec ici n'est pas bloquant. */
  function nettoyerPhotos(D, ancienneGalerie) {
    var utilisees = photosUtilisees(D);
    var candidates = photosChargees.concat(ancienneGalerie || []);
    var aSupprimer = {};

    candidates.forEach(function (url) {
      if (utilisees[url]) return;                    /* encore utilisée ailleurs */
      var chemin = SB.cheminDepuisUrl(url);          /* refuse tout ce qui n'est pas à nous */
      if (chemin) aSupprimer[chemin] = true;
    });

    var chemins = Object.keys(aSupprimer);
    if (!chemins.length) return Promise.resolve({ supprimees: 0, echecs: [] });

    var echecs = [];
    var chaine = Promise.resolve();
    chemins.forEach(function (chemin) {
      chaine = chaine.then(function () {
        return SB.supprimerPhoto(chemin).then(function (r) {
          if (!r.ok) echecs.push(chemin);
        });
      });
    });
    return chaine.then(function () {
      return { supprimees: chemins.length - echecs.length, echecs: echecs };
    });
  }

  /* ---------- Écriture ---------- */

  /* Enregistre tout : produits (création, modification, suppression)
     puis les textes. `surAvancement` sert à afficher la progression. */
  function enregistrer(D, surAvancement) {
    if (!connecte()) return Promise.reject(new Error("Connectez-vous avant d'enregistrer."));
    var avance = surAvancement || function () {};
    var ancienneGalerie = photosDeGalerieChargee;

    return SB.estAdministrateur()
      .then(function (estAdmin) {
        if (!estAdmin) {
          throw new Error(
            "Ce compte n'est pas autorisé à modifier le site. Demandez à ce qu'il soit " +
            "déclaré administrateur dans Supabase (voir admin/GUIDE_DASHBOARD.md)."
          );
        }
        return SB.lireVersions();
      })
      .then(function (actuelles) {
        /* Garde-fou de concurrence : on ne touche à rien tant qu'on
           n'est pas sûr de partir de l'état réellement en base. */
        var maintenant = empreinte(actuelles);
        if (versionChargee !== null && !memeEmpreinte(versionChargee, maintenant)) {
          throw ErreurConflit(
            "Le site a été modifié ailleurs depuis l'ouverture de cette page " +
            "(un autre appareil, ou un autre onglet). Rien n'a été enregistré, " +
            "pour ne pas écraser ces modifications. Rechargez les données, puis " +
            "refaites vos changements."
          );
        }

        var parSlug = {};
        (actuelles || []).forEach(function (l) { parSlug[l.slug] = l; });

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
            /* Produit inchange : rien a ecrire. */
            if (ancien && memeLigne(ancien, ligne)) return null;
            return ancien ? SB.majProduit(ancien.id, ligne) : SB.creerProduit(ligne);
          });
        });

        /* Produits retirés du dashboard → supprimés de la base */
        (actuelles || []).forEach(function (l) {
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
      })
      .then(function () {
        /* Les données sont en base : on peut maintenant nettoyer les
           photos devenues inutiles. Un échec de nettoyage est signalé
           mais ne remet rien en cause. */
        return nettoyerPhotos(D, ancienneGalerie).catch(function () {
          return { supprimees: 0, echecs: ["nettoyage interrompu"] };
        });
      })
      .then(function (menage) {
        /* On repart d'un état de référence à jour, pour que deux
           enregistrements successifs ne déclenchent pas un faux conflit. */
        return SB.lireVersions().then(function (lignes) {
          versionChargee = empreinte(lignes);
          return SB.lireProduits().then(function (completes) {
            photosChargees = photosDeLignes(completes);
            photosDeGalerieChargee = photosDeGalerie(D.config);
            return menage;
          });
        }).catch(function () { return menage; });
      });
  }

  /* Photos rangées dans les réglages plutôt que dans un produit :
     la galerie, et l'affiche d'annonce. Sert à repérer celles qui
     ont été remplacées, pour libérer le stockage. */
  function photosDeGalerie(config) {
    var urls = [];
    ((config && config.galerie) || []).forEach(function (g) {
      if (g.url) urls.push(g.url);
      if (g.urlPetite) urls.push(g.urlPetite);
    });
    var a = config && config.affiche;
    if (a) {
      if (a.image) urls.push(a.image);
      if (a.imagePetite) urls.push(a.imagePetite);
    }
    return urls;
  }

  /* ---------- Photos : envoi ---------- */

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
     l'ancienne dans le cache du navigateur ou du CDN. Le format
     correspond exactement à ce que les règles de la base acceptent :
     dossier/nom-taille-jeton.jpg */
  function nomPhoto(slug, genre, taille) {
    var jeton = Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    var propre = String(slug || "photo").toLowerCase().replace(/[^a-z0-9-]/g, "") || "photo";
    return genre + "/" + propre + "-" + taille + "-" + jeton + ".jpg";
  }

  function envoyerPhoto(dataURL, slug, genre, taille) {
    if (!connecte()) return Promise.reject(new Error("Connectez-vous pour envoyer une photo."));
    return SB.estAdministrateur().then(function (estAdmin) {
      if (!estAdmin) {
        throw new Error("Ce compte n'est pas autorisé à envoyer des photos.");
      }
      return SB.televerserPhoto(dataURLversBlob(dataURL), nomPhoto(slug, genre, taille));
    });
  }

  /* Mémorise l'état des photos de galerie au chargement, pour savoir
     lesquelles ont été retirées. Appelé par admin.js après charger(). */
  function memoriserGalerie(config) {
    photosDeGalerieChargee = photosDeGalerie(config);
  }

  return {
    estConfigure: configure,
    estConnecte: connecte,
    estAdministrateur: function () {
      return configure() ? SB.estAdministrateur() : Promise.resolve(false);
    },
    email: function () { return configure() ? SB.emailConnecte() : null; },
    connexion: function (e, m) { return SB.connexion(e, m); },
    deconnexion: function () { return SB.deconnexion(); },
    charger: charger,
    memoriserGalerie: memoriserGalerie,
    enregistrer: enregistrer,
    envoyerPhoto: envoyerPhoto,
  };
})();
