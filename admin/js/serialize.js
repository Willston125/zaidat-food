/* =========================================================
   ZAIDAT FOOD — Dashboard : contrôles avant enregistrement
   ---------------------------------------------------------
   Mieux vaut refuser d'enregistrer que casser le site en ligne.
   Ce fichier ne contient qu'une chose : la liste des vérifications
   passées sur les données avant qu'elles ne partent dans la base.

   Deux niveaux :
     • erreurs — bloquantes, l'enregistrement est refusé ;
     • alertes — signalées, mais on peut enregistrer quand même
       (un prix non renseigné, par exemple, est un choix légitime).

   Note historique : ce fichier servait aussi à reconstruire
   js/products.js et js/config.js, à l'époque où le dashboard
   publiait en réécrivant les fichiers du site. Depuis le passage
   à Supabase, cette partie ne servait plus et a été retirée — elle
   décrivait un fonctionnement qui n'existe plus.
   ========================================================= */

window.Serialize = (function () {
  "use strict";

  /* Date du jour au format AAAA-MM-JJ, dans le fuseau de la
     personne qui publie — c'est celui qui compte pour elle. */
  function dateDuJour() {
    var d = new Date();
    var m = String(d.getMonth() + 1), j = String(d.getDate());
    return d.getFullYear() + "-" + (m.length < 2 ? "0" + m : m) + "-" + (j.length < 2 ? "0" + j : j);
  }

  function verifier(categories, produits, config) {
    var erreurs = [], alertes = [];

    if (!Array.isArray(produits) || produits.length === 0) {
      erreurs.push("Aucun produit : le menu du site serait vide.");
    }

    var slugsVus = {}, idsVus = {};
    produits.forEach(function (p, i) {
      var ou = "Produit " + (i + 1) + " (« " + (p.name || "sans nom") + " »)";
      if (!p.name || !p.name.trim()) erreurs.push(ou + " : le nom est obligatoire.");
      if (!p.slug || !/^[a-z0-9-]+$/.test(p.slug)) {
        erreurs.push(ou + " : identifiant d'adresse invalide (lettres minuscules, chiffres et tirets seulement).");
      }
      if (slugsVus[p.slug]) erreurs.push(ou + " : l'identifiant « " + p.slug + " » est déjà utilisé.");
      slugsVus[p.slug] = true;
      /* `id` est un identifiant interne facultatif (non utilisé pour
         l'affichage du site, qui se base sur `slug`). Les produits
         chargés depuis Supabase n'en ont pas tant qu'ils n'ont pas
         été validés une fois dans le dashboard — plusieurs `id`
         absents en même temps ne sont donc pas de vrais doublons. */
      if (p.id && idsVus[p.id]) erreurs.push(ou + " : l'identifiant interne « " + p.id + " » est déjà utilisé.");
      if (p.id) idsVus[p.id] = true;

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

    /* Le numéro WhatsApp est la donnée la plus sensible du site :
       c'est lui qui décide où arrivent les commandes. Un format
       invalide est bloquant, pas seulement signalé. */
    if (!config.WHATSAPP_ORDER_NUMBER) {
      alertes.push("Numéro WhatsApp vide : les clients ne pourront pas envoyer leur commande.");
    } else if (!/^\d{6,15}$/.test(config.WHATSAPP_ORDER_NUMBER)) {
      erreurs.push("Numéro WhatsApp invalide : chiffres uniquement, sans + ni espaces (ex. 2694880343).");
    }

    /* Les liens de réseaux sociaux deviennent cliquables sur toutes
       les pages : seul https est accepté. */
    Object.keys((config && config.socials) || {}).forEach(function (k) {
      var url = config.socials[k];
      if (url && !/^https:\/\//i.test(String(url).trim())) {
        erreurs.push("Lien " + k + " : l'adresse doit commencer par « https:// ».");
      }
    });

    /* L'affiche est facultative, mais une affiche active incomplète
       serait invisible sans que personne comprenne pourquoi. */
    var af = config && config.affiche;
    if (af && af.actif) {
      if (!af.image) {
        erreurs.push("Affiche activée mais sans image : rien ne s'afficherait.");
      }
      if (!af.alt) {
        alertes.push("Affiche : pas de texte de remplacement — les personnes malvoyantes n'en sauront rien.");
      }
      if (!af.finLe) {
        alertes.push("Affiche sans date de fin : elle restera visible jusqu'à ce que vous la désactiviez.");
      } else if (af.finLe < dateDuJour()) {
        alertes.push("Affiche : la date de fin est passée, elle ne s'affiche plus sur le site.");
      }
      /* « index.html#menu » est un lien légitime : l'ancre compte
         autant que le paramètre. */
      if (af.lien && !/^https:\/\//i.test(af.lien) && !/^[a-z0-9._~-]+\.html([?#]|$)/i.test(af.lien)) {
        erreurs.push("Affiche : le lien doit être une page du site (ex. produit.html?p=pilaou) ou une adresse https.");
      }
    }

    return { erreurs: erreurs, alertes: alertes, valide: erreurs.length === 0 };
  }

  return { verifier: verifier };
})();
