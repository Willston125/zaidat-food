/* =========================================================
   ZAIDAT FOOD — Page commande (commande.html)
   ---------------------------------------------------------
   Priorité : la commande doit partir vite.
   • Le panier est modifiable directement.
   • Un seul bouton envoie la commande sur WhatsApp.
   • Le formulaire est FACULTATIF : s'il est rempli, ses
     informations enrichissent le message ; sinon, tout se
     règle dans la conversation WhatsApp.
   ========================================================= */

(function () {
  "use strict";

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  var esc = function (s) { return ZF.esc(s); };

  /* Une référence par visite, stable tant que la page reste ouverte */
  var orderRef = ZF.wa.makeRef();

  /* ---------- Résumé du panier (modifiable) ---------- */
  function renderCart() {
    var wrap = $("#step-1-content");
    var items = Cart.getItems();

    if (items.length === 0) {
      wrap.innerHTML =
        '<div class="cart-empty">' + ZF.icon("basket", "icon--xl") +
        "<p><strong>Votre panier est vide.</strong><br>Ajoutez des produits pour commander.</p>" +
        '<a class="btn btn--primary" href="index.html#menu">Découvrir le menu</a></div>';
      return;
    }

    wrap.innerHTML = items.map(function (line) {
      var p = getProductBySlug(line.slug);
      var key = Cart.lineKey(line.slug, line.options);
      var optsTxt = Object.keys(line.options || {}).map(function (k) {
        return esc(k) + " : " + esc(String(line.options[k]));
      }).join(" · ");
      var lineTotal = p.price !== null ? formatPrice(p.price * line.qty) : PRICE_TBC_LABEL;
      return (
        '<div class="cart-line" data-key="' + esc(key) + '">' +
        '<img src="' + esc(p.productThumb) + '" alt="" width="64" height="64" loading="lazy" data-fallback>' +
        '<div class="cart-line__info">' +
        '<p class="cart-line__name">' + esc(p.name) + "</p>" +
        (optsTxt ? '<p class="cart-line__opts">' + optsTxt + "</p>" : "") +
        '<div class="qty-stepper">' +
        '<button type="button" data-action="dec" aria-label="Diminuer la quantité de ' + esc(p.name) + '">' + ZF.icon("minus") + "</button>" +
        "<output>" + line.qty + "</output>" +
        '<button type="button" data-action="inc" aria-label="Augmenter la quantité de ' + esc(p.name) + '">' + ZF.icon("plus") + "</button>" +
        "</div></div>" +
        '<div style="text-align:right;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;">' +
        '<span class="cart-line__price">' + lineTotal + "</span>" +
        '<button class="cart-line__remove" type="button" data-action="remove">Retirer</button>' +
        "</div></div>"
      );
    }).join("") + totalHtml();

    ZF.bindImageFallbacks(wrap);
  }

  function totalHtml() {
    var st = Cart.subtotal();
    var inner;
    if (st.complete) {
      inner = "<span>Total</span><span>" + formatPrice(st.amount) + "</span>";
    } else if (st.amount > 0) {
      inner = "<span>Total partiel<small>hors produits « prix sur demande »</small></span><span>" + formatPrice(st.amount) + "</span>";
    } else {
      inner = "<span>Total</span><span>À confirmer</span>";
    }
    return '<p class="cart-total" style="margin-top:1rem">' + inner + "</p>" +
      (!st.complete ? '<p class="cart-note">Les prix manquants sont confirmés par ZAIDAT FOOD dans la conversation.</p>' : "");
  }

  /* ---------- Informations facultatives ---------- */
  function readCustomer() {
    var get = function (id) {
      var el = $("#" + id);
      return el ? (el.value || "").trim() : "";
    };
    var c = {
      name: get("f-nom"),
      phone: get("f-tel"),
      mode: get("f-mode"),
      zone: get("f-zone"),
      date: get("f-date"),
      heure: get("f-heure"),
      paiement: get("f-paiement"),
      remarque: get("f-remarque"),
    };
    /* Aucun champ rempli → on n'ajoute aucun bloc au message */
    var filled = Object.keys(c).some(function (k) { return !!c[k]; });
    return filled ? c : null;
  }

  /* Le téléphone est le seul champ vérifié, et seulement s'il est saisi */
  function phoneWarning() {
    var el = $("#f-tel");
    var err = $("#f-tel-error");
    if (!el || !err) return true;
    var val = (el.value || "").trim();
    var ok = !val || /^[+0-9 ().-]{7,20}$/.test(val);
    err.textContent = ok ? "" : "Ce numéro semble incomplet — vérifiez-le.";
    el.closest(".field").classList.toggle("has-error", !ok);
    return ok;
  }

  /* ---------- Bouton de commande + aperçu ---------- */
  function refresh() {
    renderCart();
    renderActions();
    renderPreview();
  }

  function currentMessage() {
    return ZF.wa.orderMessage(readCustomer(), orderRef);
  }

  function renderActions() {
    var wrap = $("#order-actions");
    if (!wrap) return;
    var empty = Cart.getItems().length === 0;

    if (empty) { wrap.innerHTML = ""; return; }

    if (!ZF.wa.isConfigured()) {
      wrap.innerHTML =
        '<div class="config-warning"><strong>Numéro WhatsApp non configuré.</strong> ' +
        "Le numéro de commande n'a pas encore été renseigné " +
        "(<code>js/config.js → WHATSAPP_ORDER_NUMBER</code>). " +
        "En attendant, copiez le message ci-dessous et envoyez-le manuellement.</div>" +
        '<button class="btn btn--primary btn--block" type="button" id="wa-copy">' +
        ZF.icon("copy") + " Copier le message de commande</button>";
      bindCopy();
      return;
    }

    wrap.innerHTML =
      '<a class="btn btn--whatsapp btn--block btn--lg" id="wa-send" href="' + esc(ZF.wa.link(currentMessage())) +
      '" target="_blank" rel="noopener">' + ZF.icon("whatsapp") + " Envoyer ma commande sur WhatsApp</a>" +
      '<p class="buy-hint">Un seul clic : votre message s\'ouvre pré-rempli dans WhatsApp, il ne reste qu\'à appuyer sur « Envoyer ».</p>' +
      '<button class="cart-clear" type="button" id="wa-copy">Copier le message à la place</button>';

    var send = $("#wa-send");
    send.addEventListener("pointerdown", syncLink);
    send.addEventListener("click", function () {
      syncLink();
      if (!navigator.onLine) {
        ZF.toast("Vous semblez hors connexion — réessayez dès que le réseau revient", true);
      }
    });
    bindCopy();
  }

  function syncLink() {
    var send = $("#wa-send");
    if (send) send.setAttribute("href", ZF.wa.link(currentMessage()));
  }

  function bindCopy() {
    var btn = $("#wa-copy");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var msg = currentMessage();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(msg).then(
          function () { ZF.toast("Message copié — collez-le dans WhatsApp"); },
          function () { ZF.toast("Impossible de copier — sélectionnez le texte de l'aperçu", true); }
        );
      } else {
        ZF.toast("Impossible de copier — sélectionnez le texte de l'aperçu", true);
      }
    });
  }

  function renderPreview() {
    var pre = $("#wa-preview");
    var panel = $("#preview-panel");
    if (!pre || !panel) return;
    if (Cart.getItems().length === 0) {
      panel.setAttribute("hidden", "");
      return;
    }
    panel.removeAttribute("hidden");
    pre.textContent = currentMessage();
  }

  /* ---------- Champs du formulaire facultatif ---------- */
  function initForm() {
    var modeSel = $("#f-mode");
    SITE_CONFIG.delivery.modes.forEach(function (m) {
      var opt = document.createElement("option");
      opt.value = m; opt.textContent = m;
      modeSel.appendChild(opt);
    });

    var paySel = $("#f-paiement");
    var blank = document.createElement("option");
    blank.value = ""; blank.textContent = "Non précisé";
    paySel.appendChild(blank);
    SITE_CONFIG.paymentMethods.forEach(function (m) {
      var opt = document.createElement("option");
      opt.value = m; opt.textContent = m;
      paySel.appendChild(opt);
    });

    var dateInput = $("#f-date");
    if (dateInput) dateInput.min = new Date().toISOString().slice(0, 10);

    var form = $("#order-form");
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    /* Chaque frappe met à jour le lien WhatsApp et l'aperçu */
    form.addEventListener("input", function () {
      phoneWarning();
      syncLink();
      renderPreview();
    });
    form.addEventListener("change", function () {
      syncLink();
      renderPreview();
    });
  }

  /* ---------- Démarrage ---------- */
  ZF.pret(function () {
    initForm();
    refresh();

    /* Modification du panier depuis la page */
    $("#step-1-content").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-action]");
      if (!btn) return;
      var lineEl = btn.closest(".cart-line");
      if (!lineEl) return;
      var key = lineEl.getAttribute("data-key");
      var line = Cart.getItems().find(function (l) { return Cart.lineKey(l.slug, l.options) === key; });
      if (!line) return;
      var action = btn.getAttribute("data-action");
      if (action === "inc") Cart.setQty(key, line.qty + 1);
      if (action === "dec") Cart.setQty(key, line.qty - 1);
      if (action === "remove") Cart.removeLine(key);
    });

    Cart.onChange(refresh);
  });
})();
