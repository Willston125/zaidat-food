/* =========================================================
   ZAIDAT FOOD — Liens et messages WhatsApp (partagés)
   ---------------------------------------------------------
   Objectif : commander le plus vite possible.
   • Depuis une fiche produit  → 1 clic = WhatsApp pré-rempli
   • Depuis le panier          → 1 clic = WhatsApp pré-rempli
   • Bouton flottant           → discussion directe, sans commande
   Les coordonnées du client sont facultatives : elles se règlent
   naturellement dans la conversation WhatsApp.
   ========================================================= */

window.ZF = window.ZF || {};

(function () {
  "use strict";

  /* Le numéro est-il configuré ? (voir js/config.js) */
  function isConfigured() {
    return !!String(SITE_CONFIG.WHATSAPP_ORDER_NUMBER || "").trim();
  }

  /* Construit l'URL wa.me avec le message correctement encodé */
  function link(message) {
    var number = String(SITE_CONFIG.WHATSAPP_ORDER_NUMBER || "").trim();
    if (!number) return null;
    return "https://wa.me/" + number + (message ? "?text=" + encodeURIComponent(message) : "");
  }

  /* Référence courte, utile à la cuisinière pour suivre la commande */
  function makeRef() {
    return "ZF-" + Date.now().toString(36).toUpperCase().slice(-4);
  }

  /* Une ligne de commande : « - 2 × Samoussas : 3 000 KMF » + ses options */
  function formatLine(name, qty, price, options) {
    var priceTxt = price !== null && price !== undefined
      ? formatPrice(price * qty)
      : "prix à confirmer";
    var out = ["- " + qty + " × " + name + " : " + priceTxt];
    Object.keys(options || {}).forEach(function (k) {
      out.push("   · " + k + " : " + options[k]);
    });
    return out.join("\n");
  }

  /* Ligne de total, tolérante aux produits sans prix renseigné */
  function totalLine(amount, complete) {
    if (complete) return "Total : " + formatPrice(amount);
    if (amount > 0) return "Total partiel : " + formatPrice(amount) + " (hors produits « prix à confirmer »)";
    return "Total : à confirmer";
  }

  /* Bloc coordonnées — uniquement les champs réellement remplis */
  function customerBlock(customer) {
    if (!customer) return [];
    var rows = [];
    if (customer.name) rows.push("Nom : " + customer.name);
    if (customer.phone) rows.push("Téléphone : " + customer.phone);
    if (customer.mode) rows.push("Mode de récupération : " + customer.mode);
    if (customer.zone) rows.push("Zone / adresse : " + customer.zone);
    if (customer.date) rows.push("Date souhaitée : " + customer.date);
    if (customer.heure) rows.push("Heure souhaitée : " + customer.heure);
    if (customer.paiement) rows.push("Paiement : " + customer.paiement);
    if (customer.remarque) rows.push("Remarque : " + customer.remarque);
    return rows;
  }

  /* --- Message de commande à partir du panier --- */
  function orderMessage(customer, ref) {
    var items = Cart.getItems();
    var lines = ["Bonjour ZAIDAT FOOD,", "", "Je souhaite commander :", ""];

    items.forEach(function (line) {
      var p = getProductBySlug(line.slug);
      if (!p) return;
      lines.push(formatLine(p.name, line.qty, p.price, line.options));
    });

    var st = Cart.subtotal();
    lines.push("", totalLine(st.amount, st.complete));

    var infos = customerBlock(customer);
    if (infos.length) lines.push("", infos.join("\n"));

    lines.push("", "Merci de me confirmer la disponibilité et le prix.");
    lines.push("(réf. " + (ref || makeRef()) + ")");
    return lines.join("\n");
  }

  /* --- Message pour un seul produit (commande express depuis la fiche) --- */
  function productMessage(product, qty, options) {
    var lines = ["Bonjour ZAIDAT FOOD,", "", "Je souhaite commander :", ""];
    lines.push(formatLine(product.name, qty, product.price, options));
    if (typeof product.price === "number") {
      lines.push("", "Total : " + formatPrice(product.price * qty));
    }
    lines.push("", "Merci de me confirmer la disponibilité et le prix.");
    lines.push("(réf. " + makeRef() + ")");
    return lines.join("\n");
  }

  /* --- Message du bouton flottant : simple prise de contact --- */
  function contactMessage() {
    return SITE_CONFIG.whatsappGreeting ||
      "Bonjour ZAIDAT FOOD, j'aimerais avoir des informations sur vos plats.";
  }

  ZF.wa = {
    isConfigured: isConfigured,
    link: link,
    makeRef: makeRef,
    orderMessage: orderMessage,
    productMessage: productMessage,
    contactMessage: contactMessage,
    totalLine: totalLine,
  };
})();
