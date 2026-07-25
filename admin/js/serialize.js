/* =========================================================
   ZAIDAT FOOD — Dashboard : écriture des fichiers du site
   ---------------------------------------------------------
   Reconstruit js/products.js et js/config.js à partir des
   données modifiées dans le dashboard.

   Les données sont écrites en JSON, qui est un sous-ensemble
   de JavaScript : l'échappement des apostrophes, accents et
   retours à la ligne est donc géré par JSON.stringify, sans
   risque de produire un fichier invalide.

   Les fonctions utilitaires du site (formatPrice,
   getProductBySlug…) sont recopiées telles quelles en fin de
   fichier : le dashboard ne touche qu'aux données.
   ========================================================= */

window.Serialize = (function () {
  "use strict";

  var ENTETE =
    "/* =========================================================\n" +
    "   ZAIDAT FOOD — fichier généré par le dashboard\n" +
    "   ---------------------------------------------------------\n" +
    "   Ne pas modifier à la main : toute modification serait\n" +
    "   écrasée à la prochaine publication depuis le dashboard.\n" +
    "   Dernière publication : %DATE%\n" +
    "   ========================================================= */\n\n";

  /* Fonctions d'accès aux données, identiques à l'original */
  var AIDES_PRODUITS =
    "\n/* --------- Aides d'accès aux données --------- */\n" +
    "function getProductBySlug(slug) {\n" +
    "  return PRODUCTS.find(function (p) { return p.slug === slug; }) || null;\n" +
    "}\n" +
    "function getProductsByCategory(catId) {\n" +
    "  return PRODUCTS.filter(function (p) { return p.category === catId; });\n" +
    "}\n" +
    "function getCategoryById(catId) {\n" +
    "  return CATEGORIES.find(function (c) { return c.id === catId; }) || null;\n" +
    "}\n" +
    "/* Catégories réellement non vides, dans l'ordre défini */\n" +
    "function getNonEmptyCategories() {\n" +
    "  return CATEGORIES.filter(function (c) { return getProductsByCategory(c.id).length > 0; });\n" +
    "}\n";

  var AIDES_CONFIG =
    "\n/* Format d'un prix en KMF : 1500 -> \"1 500 KMF\" (espace insécable).\n" +
    "   Retourne null si le prix n'est pas renseigné. */\n" +
    "function formatPrice(amount) {\n" +
    "  if (amount === null || amount === undefined || isNaN(amount)) return null;\n" +
    "  return amount.toLocaleString(\"fr-FR\").replace(/\\s/g, \"\\u00A0\") + \"\\u00A0\" + SITE_CONFIG.currency;\n" +
    "}\n\n" +
    "/* Libellé affiché quand le prix n'est pas encore renseigné */\n" +
    "const PRICE_TBC_LABEL = \"Prix sur demande\";\n";

  function entete() {
    return ENTETE.replace("%DATE%", new Date().toLocaleString("fr-FR"));
  }

  /* Ordre des champs fixé : les fichiers restent lisibles et les
     différences d'une publication à l'autre restent minimales. */
  var ORDRE_PRODUIT = [
    "id", "slug", "name", "shortDescription", "description", "price", "currency",
    "category", "productImage", "productThumb", "lifestyleImage", "lifestyleThumb",
    "gallery", "available", "featured", "bestseller", "preparationTime", "portions", "options",
  ];

  function rangerProduit(p) {
    var out = {};
    ORDRE_PRODUIT.forEach(function (cle) {
      if (p[cle] !== undefined) out[cle] = p[cle];
    });
    /* Champs supplémentaires éventuels, conservés en fin d'objet */
    Object.keys(p).forEach(function (cle) {
      if (out[cle] === undefined) out[cle] = p[cle];
    });
    return out;
  }

  function produitsJS(categories, produits) {
    return (
      entete() +
      "/* `icon` = nom d'une icône de js/icons.js (sans le préfixe « i- ») */\n" +
      "const CATEGORIES = " + JSON.stringify(categories, null, 2) + ";\n\n" +
      "const PRODUCTS = " + JSON.stringify(produits.map(rangerProduit), null, 2) + ";\n" +
      AIDES_PRODUITS
    );
  }

  function configJS(config) {
    return (
      entete() +
      "const SITE_CONFIG = " + JSON.stringify(config, null, 2) + ";\n" +
      AIDES_CONFIG
    );
  }

  /* ---------- Contrôles avant publication ----------
     Mieux vaut refuser de publier que casser le site en ligne. */
  function verifier(categories, produits, config) {
    var erreurs = [], alertes = [];

    if (!Array.isArray(produits) || produits.length === 0) {
      erreurs.push("Aucun produit : le menu du site serait vide.");
    }

    var slugsVus = {}, idsVus = {};
    produits.forEach(function (p, i) {
      var ou = 'Produit ' + (i + 1) + ' (« ' + (p.name || "sans nom") + ' »)';
      if (!p.name || !p.name.trim()) erreurs.push(ou + " : le nom est obligatoire.");
      if (!p.slug || !/^[a-z0-9-]+$/.test(p.slug)) {
        erreurs.push(ou + " : identifiant d'adresse invalide (lettres minuscules, chiffres et tirets seulement).");
      }
      if (slugsVus[p.slug]) erreurs.push(ou + " : l'identifiant « " + p.slug + " » est déjà utilisé.");
      slugsVus[p.slug] = true;
      if (idsVus[p.id]) erreurs.push(ou + " : l'identifiant interne « " + p.id + " » est déjà utilisé.");
      idsVus[p.id] = true;

      if (!p.category) erreurs.push(ou + " : aucune catégorie choisie.");
      else if (!categories.some(function (c) { return c.id === p.category; })) {
        erreurs.push(ou + " : la catégorie « " + p.category + " » n'existe pas.");
      }
      if (!p.productImage) erreurs.push(ou + " : aucune photo de produit.");
      if (p.price !== null && (typeof p.price !== "number" || p.price < 0 || isNaN(p.price))) {
        erreurs.push(ou + " : le prix doit être un nombre positif, ou vide.");
      }
      if (p.price === null) alertes.push(ou + " : prix non renseigné, le site affichera « Prix sur demande ».");
      if (!p.lifestyleImage) alertes.push(ou + " : pas de photo en situation, la fiche n'aura qu'une seule image.");
      if (!p.shortDescription) alertes.push(ou + " : pas de description courte sous le nom.");
    });

    categories.forEach(function (c) {
      if (!c.id || !c.name) erreurs.push("Une catégorie est incomplète (identifiant ou nom manquant).");
      var n = produits.filter(function (p) { return p.category === c.id; }).length;
      if (n === 0) alertes.push("Catégorie « " + c.name + " » : aucun produit, elle ne s'affichera pas sur le site.");
    });

    if (!config || !config.brand || !config.brand.name) erreurs.push("Le nom de la marque est vide.");
    if (!config.WHATSAPP_ORDER_NUMBER) {
      alertes.push("Numéro WhatsApp vide : les clients ne pourront pas envoyer leur commande.");
    } else if (!/^\d{6,15}$/.test(config.WHATSAPP_ORDER_NUMBER)) {
      erreurs.push("Numéro WhatsApp invalide : chiffres uniquement, sans + ni espaces (ex. 2694880343).");
    }

    return { erreurs: erreurs, alertes: alertes, valide: erreurs.length === 0 };
  }

  /* Relit le fichier produit pour s'assurer qu'il s'exécute vraiment.
     Un fichier invalide rendrait tout le site blanc : on vérifie avant. */
  function testerFichierGenere(source, nomAttendu) {
    try {
      var f = new Function(source + "\nreturn typeof " + nomAttendu + " !== 'undefined' ? " + nomAttendu + " : null;");
      var valeur = f();
      if (valeur === null || valeur === undefined) {
        return { ok: false, message: nomAttendu + " est introuvable dans le fichier généré." };
      }
      return { ok: true, valeur: valeur };
    } catch (e) {
      return { ok: false, message: "Le fichier généré comporte une erreur : " + e.message };
    }
  }

  return {
    produitsJS: produitsJS,
    configJS: configJS,
    verifier: verifier,
    testerFichierGenere: testerFichierGenere,
  };
})();
