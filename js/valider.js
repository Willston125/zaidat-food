/* =========================================================
   ZAIDAT FOOD — Validation des données venues de la base
   ---------------------------------------------------------
   Tout ce qui arrive de Supabase passe par ici avant d'être
   affiché. Les règles de sécurité de la base (RLS) empêchent
   déjà un inconnu d'y écrire ; cette couche est la seconde
   barrière, celle qui protège même si la première cède ou si
   une saisie malheureuse passe par le dashboard.

   Trois dangers traités :
     • une adresse « javascript: » dans un lien de réseau social
       deviendrait du code exécuté au clic du visiteur ;
     • un numéro WhatsApp erroné enverrait les commandes nulle
       part — ou, pire, chez quelqu'un d'autre ;
     • une adresse d'image inattendue ferait fuiter la visite
       vers un serveur tiers.

   Règle générale : une valeur invalide n'est jamais affichée,
   et ne remplace jamais la valeur de secours du site.
   ========================================================= */

window.ZFV = (function () {
  "use strict";

  /* Un lien cliquable doit être en https. On refuse « javascript: »,
     « data: », « vbscript: » et tout ce qui n'est pas explicitement
     autorisé, y compris les formes déguisées (« JaVaScRiPt: »,
     espaces ou caractères de contrôle en tête). */
  function lienHttps(valeur) {
    var v = String(valeur == null ? "" : valeur).replace(/[\u0000-\u0020\u007F]/g, "").trim();
    if (!v) return "";
    if (!/^https:\/\//i.test(v)) return "";
    try {
      var u = new URL(v);
      return u.protocol === "https:" ? u.href : "";
    } catch (e) {
      return "";
    }
  }

  /* Une image vient soit de la base (https, en général Supabase
     Storage), soit des fichiers du site (chemin relatif). Tout le
     reste est refusé : le site affiche alors son image de repli. */
  function adresseImage(valeur) {
    var v = String(valeur == null ? "" : valeur).replace(/[\u0000-\u0020\u007F]/g, "").trim();
    if (!v) return "";
    if (/^https:\/\//i.test(v)) return lienHttps(v);
    /* Chemin relatif : pas de protocole, pas de « // » en tête
       (qui vaut « même protocole, autre domaine »), pas de « ../ ». */
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return "";
    if (v.indexOf("//") === 0) return "";
    if (v.indexOf("..") !== -1) return "";
    return v;
  }

  /* Le numéro de commande est la donnée la plus sensible du site :
     c'est lui qui décide où arrivent les commandes des clients.
     Format attendu : international, chiffres uniquement, sans « + »
     ni espaces (ex. 2694880343 pour +269 488 03 43).

     Renvoie null si le numéro est inexploitable — l'appelant garde
     alors le numéro officiel inscrit dans js/config.js. */
  function numeroWhatsapp(valeur) {
    if (valeur == null) return null;
    var v = String(valeur).trim();
    /* Tolérance de saisie : on accepte « +269 488 03 43 » et on
       normalise, mais rien d'autre qu'un « + », des espaces, des
       points, des tirets et des parenthèses autour des chiffres. */
    if (!/^\+?[0-9()+.\- ]+$/.test(v)) return null;
    var chiffres = v.replace(/[^0-9]/g, "");
    if (!/^[0-9]{6,15}$/.test(chiffres)) return null;
    return chiffres;
  }

  /* Texte affiché : on borne la longueur pour qu'une valeur
     aberrante ne casse pas la mise en page. L'échappement HTML
     reste assuré par ZF.esc au moment de l'affichage. */
  function texte(valeur, maximum) {
    var v = String(valeur == null ? "" : valeur);
    var max = maximum || 2000;
    return v.length > max ? v.slice(0, max) : v;
  }

  /* Nettoie en place l'objet de configuration issu de la base.
     `secours` est la configuration du fichier js/config.js : elle
     sert de valeur de repli pour tout ce qui est invalide. */
  function nettoyerConfig(config, secours) {
    if (!config || typeof config !== "object") return config;
    var refus = [];

    /* --- Numéro de commande --- */
    var num = numeroWhatsapp(config.WHATSAPP_ORDER_NUMBER);
    if (num === null) {
      var repli = secours && secours.WHATSAPP_ORDER_NUMBER;
      if (config.WHATSAPP_ORDER_NUMBER) {
        refus.push("numéro WhatsApp invalide, numéro officiel du site conservé");
      }
      config.WHATSAPP_ORDER_NUMBER = repli || "";
    } else {
      config.WHATSAPP_ORDER_NUMBER = num;
    }

    /* --- Liens de réseaux sociaux --- */
    if (config.socials && typeof config.socials === "object") {
      Object.keys(config.socials).forEach(function (k) {
        var brut = config.socials[k];
        var propre = lienHttps(brut);
        if (brut && !propre) refus.push("lien « " + k + " » refusé (protocole non autorisé)");
        config.socials[k] = propre;
      });
    }

    /* --- Galerie --- */
    if (Array.isArray(config.galerie)) {
      config.galerie = config.galerie
        .map(function (g) {
          if (!g || typeof g !== "object") return null;
          var url = adresseImage(g.url);
          if (!url) return null;
          return {
            url: url,
            urlPetite: adresseImage(g.urlPetite) || url,
            legende: texte(g.legende, 200),
          };
        })
        .filter(Boolean);
    }

    /* --- Affiche --- */
    if ("affiche" in config) config.affiche = nettoyerAffiche(config.affiche);

    /* --- Témoignages --- */
    if (Array.isArray(config.testimonials)) {
      config.testimonials = config.testimonials
        .filter(function (t) { return t && typeof t === "object"; })
        .map(function (t) {
          return { name: texte(t.name, 80), text: texte(t.text, 600) };
        });
    }

    /* --- Listes de textes simples --- */
    ["infoBar", "hours", "paymentMethods", "promises", "steps"].forEach(function (cle) {
      if (Array.isArray(config[cle])) {
        config[cle] = config[cle].map(function (v) {
          return v && typeof v === "object" ? v : texte(v, 300);
        });
      }
    });

    if (refus.length && window.console && console.warn) {
      console.warn("ZAIDAT FOOD — données ignorées : " + refus.join(" ; "));
    }
    return config;
  }

  /* Nettoie l'affiche venue de la base. Renvoie null si elle n'est
     pas exploitable : sans image il n'y a rien à montrer, et une
     affiche à moitié valide vaut moins qu'une absence d'affiche. */
  function nettoyerAffiche(a) {
    if (!a || typeof a !== "object") return null;

    var image = adresseImage(a.image);
    if (!image) return null;

    /* Même règle que pour une image : une page du site, ou une
       adresse https. Tout le reste (javascript:, data:…) est refusé. */
    var lien = adresseImage(a.lien);

    /* Date de fin : une affiche sans échéance reste des mois après
       l'événement. On n'en invente pas, mais on refuse ce qui n'est
       pas une date lisible. */
    var finLe = "";
    var brut = String(a.finLe == null ? "" : a.finLe).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(brut) && !isNaN(Date.parse(brut + "T00:00:00Z"))) {
      finLe = brut;
    }

    var secondes = Number(a.fermetureAuto);
    if (!isFinite(secondes) || secondes < 0) secondes = 0;
    if (secondes > 120) secondes = 120;

    return {
      actif: a.actif !== false,
      image: image,
      imagePetite: adresseImage(a.imagePetite) || image,
      alt: texte(a.alt, 200),
      lien: lien,
      finLe: finLe,
      fermetureAuto: Math.round(secondes),
    };
  }

  /* Nettoie un produit venu de la base. Renvoie null si le produit
     est inexploitable (pas de slug, pas de nom) : mieux vaut une
     carte en moins qu'une fiche cassée. */
  function nettoyerProduit(p) {
    if (!p || typeof p !== "object") return null;
    if (!p.slug || !p.name) return null;
    if (!/^[a-z0-9-]+$/.test(String(p.slug))) return null;

    p.name = texte(p.name, 120);
    p.shortDescription = texte(p.shortDescription, 300);
    p.description = texte(p.description, 4000);
    p.productImage = adresseImage(p.productImage);
    p.productThumb = adresseImage(p.productThumb) || p.productImage;
    p.lifestyleImage = adresseImage(p.lifestyleImage);
    p.lifestyleThumb = adresseImage(p.lifestyleThumb) || p.lifestyleImage;

    if (typeof p.price !== "number" || !isFinite(p.price) || p.price < 0) p.price = null;

    p.options = Array.isArray(p.options)
      ? p.options
          .filter(function (o) { return o && typeof o === "object" && o.name; })
          .map(function (o, i) {
            return {
              id: String(o.id || "option-" + (i + 1)).replace(/[^a-z0-9-]/gi, "") || "option-" + (i + 1),
              name: texte(o.name, 120),
              type: "text",   /* seul type rendu par la fiche produit */
              required: !!o.required,
              placeholder: texte(o.placeholder, 120),
            };
          })
      : [];

    return p;
  }

  return {
    lienHttps: lienHttps,
    adresseImage: adresseImage,
    numeroWhatsapp: numeroWhatsapp,
    texte: texte,
    nettoyerConfig: nettoyerConfig,
    nettoyerAffiche: nettoyerAffiche,
    nettoyerProduit: nettoyerProduit,
  };
})();
