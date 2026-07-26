/* =========================================================
   ZAIDAT FOOD — UI partagée (toutes pages)
   Header, tiroir panier, toasts, barre mobile, révélations.
   ========================================================= */

(function () {
  "use strict";

  /* ---------- Utilitaires ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  window.ZF = window.ZF || {};
  ZF.$ = $; ZF.$all = $all; ZF.esc = esc;

  /* Libellé de prix d'un produit (ou "Prix sur demande") */
  ZF.priceLabel = function (product) {
    var f = formatPrice(product.price);
    return f !== null ? f : PRICE_TBC_LABEL;
  };

  /* ---------- Carte produit (accueil + produits similaires) ----------
     Deux images superposées : la photo du produit seul, et la scène
     de vie avec la cuisinière qui l'utilise. La bascule se fait au
     survol (souris), au bouton dédié (tactile/clavier) et pendant
     l'animation de clic qui précède l'ouverture de la fiche.        */
  ZF.cardHtml = function (p, opts) {
    var options = opts || {};
    var cat = getCategoryById(p.category);
    var price = formatPrice(p.price);
    var hasLife = !!p.lifestyleImage;
    var lifeSrc = p.lifestyleThumb || p.lifestyleImage;

    var priceHtml = price !== null
      ? '<span class="card__price">' + price + "</span>"
      : '<span class="card__price card__price--tbc">' + PRICE_TBC_LABEL + "</span>";

    return (
      '<article class="card' +
      (p.available ? "" : " card--off") +
      (hasLife ? " card--duo" : "") +
      (options.reveal === false ? "" : " reveal") +
      '" data-slug="' + esc(p.slug) + '">' +
      '<div class="card__imgwrap">' +
      '<img class="card__img card__img--product" src="' + esc(p.productThumb) + '" alt="' + esc(p.name) + '" loading="lazy" width="450" height="450" data-fallback>' +
      (hasLife
        ? '<img class="card__img card__img--life" src="' + esc(lifeSrc) + '" alt="" aria-hidden="true" loading="lazy" width="450" height="450">'
        : "") +
      '<span class="card__badge">' + esc(cat ? cat.name : "") + "</span>" +
      (p.bestseller && p.available
        ? '<span class="card__badge card__badge--best">' + ZF.icon("star", "icon--sm") + " Populaire</span>"
        : "") +
      (!p.available ? '<span class="card__badge card__badge--off">Indisponible</span>' : "") +
      (hasLife ? '<span class="card__lifelabel">En situation</span>' : "") +
      (hasLife
        ? '<button class="card__peek" type="button" data-peek aria-pressed="false" aria-label="Voir ' +
          esc(p.name) + ' en situation">' + ZF.icon("chef-hat") + "</button>"
        : "") +
      "</div>" +
      '<div class="card__body">' +
      '<h3 class="card__title"><a href="produit.html?p=' + esc(p.slug) + '">' + esc(p.name) + "</a></h3>" +
      (options.compact ? "" : '<p class="card__desc">' + esc(p.shortDescription) + "</p>") +
      '<div class="card__foot">' + priceHtml +
      (p.available && !options.compact
        ? '<button class="card__add" type="button" data-add="' + esc(p.slug) +
          '" aria-label="Ajouter ' + esc(p.name) + ' au panier">' + ZF.icon("plus") + "</button>"
        : "") +
      "</div></div></article>"
    );
  };

  /* Bascule produit ⇄ scène de vie sur une carte (tactile / clavier) */
  function initCardPeek() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-peek]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var card = btn.closest(".card");
      if (!card) return;
      var on = card.classList.toggle("is-peeking");
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  /* Clic sur une carte : la scène de vie se révèle, puis la fiche s'ouvre */
  function initCardReveal() {
    /* Retour arrière depuis une fiche : on remet les cartes à l'état normal
       (sans cela, la carte cliquée resterait figée sur la scène de vie). */
    window.addEventListener("pageshow", function () {
      $all(".card.is-revealing").forEach(function (c) { c.classList.remove("is-revealing"); });
    });

    document.addEventListener("click", function (e) {
      if (e.defaultPrevented) return;
      /* On respecte les clics « ouvrir dans un nouvel onglet » */
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var link = e.target.closest('.card__title a[href^="produit.html"]');
      if (!link) return;
      var card = link.closest(".card");
      if (!card || !card.classList.contains("card--duo")) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      e.preventDefault();
      card.classList.add("is-revealing");

      /* Délai volontairement court : au-delà, le clic est ressenti
         comme « mort ». 160 ms suffisent à percevoir la bascule. */
      var href = link.getAttribute("href");
      setTimeout(function () { window.location.href = href; }, 160);
    });
  }

  /* Fallback si une image manque : bloc coloré avec l'icône « plat servi » */
  ZF.bindImageFallbacks = function (root) {
    $all("img[data-fallback]", root || document).forEach(function (img) {
      img.addEventListener("error", function () {
        var ph = document.createElement("div");
        ph.setAttribute("role", "img");
        ph.setAttribute("aria-label", img.alt || "Image indisponible");
        ph.style.cssText = "width:100%;height:100%;min-height:120px;display:flex;align-items:center;justify-content:center;font-size:2rem;color:var(--terracotta);background:var(--coral-soft);";
        ph.innerHTML = ZF.icon("cloche");
        if (img.parentNode) img.parentNode.replaceChild(ph, img);
      }, { once: true });
    });
  };

  /* ---------- Toast ---------- */
  var toastEl = null, toastTimer = null;
  ZF.toast = function (message, isError) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = ZF.icon(isError ? "unavailable" : "check-circle") + "<span>" + esc(message) + "</span>";
    toastEl.classList.toggle("toast--error", !!isError);
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("is-visible"); }, 2600);
  };

  /* Menu mobile : en-tête, icônes devant chaque lien, et actions en pied.
     Les icônes rendent la lecture plus rapide sur petit écran. */
  function enrichirMenuMobile(nav) {
    if ($(".main-nav__head", nav)) return;

    var head = document.createElement("div");
    head.className = "main-nav__head";
    head.innerHTML =
      "<strong>Menu</strong>" +
      '<button class="icon-btn" type="button" data-close-nav aria-label="Fermer le menu">' +
      ZF.icon("close") + "</button>";
    nav.insertBefore(head, nav.firstChild);
    head.querySelector("[data-close-nav]").addEventListener("click", function () {
      if (ZF.closeNav) ZF.closeNav();
    });

    var icones = { accueil: "house", menu: "cloche", "catégories": "grid",
                   "à propos": "chef-hat", contact: "chat" };
    $all("a", nav).forEach(function (a) {
      var cle = a.textContent.trim().toLowerCase();
      var nom = icones[cle];
      if (nom) a.innerHTML = ZF.icon(nom) + "<span>" + esc(a.textContent.trim()) + "</span>";
    });

    var cta = document.createElement("div");
    cta.className = "main-nav__cta";
    var wa = SITE_CONFIG.WHATSAPP_ORDER_NUMBER;
    cta.innerHTML =
      '<a class="btn btn--primary" href="index.html#menu">Commander maintenant</a>' +
      (wa ? '<a class="btn btn--whatsapp" href="https://wa.me/' + esc(wa) +
        '" target="_blank" rel="noopener">' + ZF.icon("whatsapp") + " Discuter sur WhatsApp</a>" : "");
    nav.appendChild(cta);
  }

  /* ---------- Header : ombre au scroll + burger ---------- */
  function initHeader() {
    var header = $(".site-header");
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    var toggle = $(".nav-toggle");
    var nav = $(".main-nav");
    if (toggle && nav) {
      enrichirMenuMobile(nav);

      /* Voile sombre : met le menu en valeur et se ferme au toucher */
      var overlay = document.createElement("div");
      overlay.className = "nav-overlay";
      document.body.appendChild(overlay);

      var setOpen = function (open) {
        nav.classList.toggle("is-open", open);
        overlay.classList.toggle("is-open", open);
        header.classList.toggle("nav-is-open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute("aria-label", open ? "Fermer la navigation" : "Ouvrir la navigation");
        toggle.innerHTML = ZF.icon(open ? "close" : "menu");
        /* On empêche la page de défiler derrière le menu ouvert */
        document.body.style.overflow = open ? "hidden" : "";
        if (open) {
          var premier = $("a", nav);
          if (premier) premier.focus();
        }
      };
      ZF.closeNav = function () { setOpen(false); };

      toggle.addEventListener("click", function () {
        setOpen(!nav.classList.contains("is-open"));
      });
      overlay.addEventListener("click", function () { setOpen(false); });
      nav.addEventListener("click", function (e) {
        if (e.target.closest("a")) setOpen(false);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && nav.classList.contains("is-open")) {
          setOpen(false);
          toggle.focus();
        }
      });
    }

    var searchBtn = $("#search-toggle");
    var searchBar = $("#search-bar");
    if (searchBtn && searchBar) {
      searchBtn.addEventListener("click", function () {
        var hidden = searchBar.hasAttribute("hidden");
        if (hidden) {
          searchBar.removeAttribute("hidden");
          searchBtn.setAttribute("aria-expanded", "true");
          var input = $("input", searchBar);
          if (input) input.focus();
        } else {
          searchBar.setAttribute("hidden", "");
          searchBtn.setAttribute("aria-expanded", "false");
        }
      });
    }
  }

  /* ---------- Tiroir panier (injecté sur toutes les pages) ---------- */
  var lastFocused = null;

  function drawerMarkup() {
    return (
      '<div class="drawer-overlay" id="drawer-overlay"></div>' +
      '<aside class="cart-drawer" id="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title" aria-hidden="true">' +
      '  <div class="cart-drawer__head">' +
      '    <h2 id="cart-drawer-title">Votre panier</h2>' +
      '    <button class="icon-btn" id="cart-drawer-close" aria-label="Fermer le panier">' + ZF.icon("close") + '</button>' +
      "  </div>" +
      '  <div class="cart-drawer__body" id="cart-drawer-body"></div>' +
      '  <div class="cart-drawer__foot" id="cart-drawer-foot"></div>' +
      "</aside>"
    );
  }

  function renderDrawer() {
    var body = $("#cart-drawer-body");
    var foot = $("#cart-drawer-foot");
    if (!body || !foot) return;
    var items = Cart.getItems();

    if (items.length === 0) {
      body.innerHTML =
        '<div class="cart-empty">' + ZF.icon("basket", "icon--xl") +
        "<p><strong>Votre panier est vide.</strong><br>Laissez-vous tenter par nos plats et douceurs maison.</p>" +
        '<a class="btn btn--primary btn--sm" href="index.html#menu">Voir le menu</a></div>';
      foot.innerHTML = "";
      return;
    }

    body.innerHTML = items.map(function (line) {
      var p = getProductBySlug(line.slug);
      var key = Cart.lineKey(line.slug, line.options);
      var optsTxt = Object.keys(line.options || {}).map(function (k) {
        return esc(String(line.options[k]));
      }).filter(Boolean).join(" · ");
      var unit = formatPrice(p.price);
      var lineTotal = p.price !== null ? formatPrice(p.price * line.qty) : PRICE_TBC_LABEL;
      return (
        '<div class="cart-line" data-key="' + esc(key) + '">' +
        '<img src="' + esc(p.productThumb) + '" alt="" width="64" height="64" loading="lazy">' +
        '<div class="cart-line__info">' +
        '<p class="cart-line__name">' + esc(p.name) + "</p>" +
        (optsTxt ? '<p class="cart-line__opts">' + optsTxt + "</p>" : "") +
        '<div class="qty-stepper" aria-label="Quantité pour ' + esc(p.name) + '">' +
        '<button type="button" data-action="dec" aria-label="Diminuer la quantité">' + ZF.icon("minus") + "</button>" +
        "<output>" + line.qty + "</output>" +
        '<button type="button" data-action="inc" aria-label="Augmenter la quantité">' + ZF.icon("plus") + "</button>" +
        "</div></div>" +
        '<div style="text-align:right;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;">' +
        '<span class="cart-line__price">' + (unit !== null ? lineTotal : '<span class="card__price--tbc">' + PRICE_TBC_LABEL + "</span>") + "</span>" +
        '<button class="cart-line__remove" type="button" data-action="remove">Retirer</button>' +
        "</div></div>"
      );
    }).join("");

    var st = Cart.subtotal();
    var totalHtml;
    if (st.complete) {
      totalHtml = "<span>Total</span><span>" + formatPrice(st.amount) + "</span>";
    } else if (st.amount > 0) {
      totalHtml = "<span>Total partiel<small>hors produits « prix sur demande »</small></span><span>" + formatPrice(st.amount) + "</span>";
    } else {
      totalHtml = "<span>Total</span><span>À confirmer</span>";
    }
    /* Commande express : un seul clic envoie tout le panier sur WhatsApp */
    var waConfigured = ZF.wa.isConfigured();
    var waHref = waConfigured ? ZF.wa.link(ZF.wa.orderMessage(null)) : null;

    foot.innerHTML =
      '<p class="cart-total">' + totalHtml + "</p>" +
      (!st.complete ? '<p class="cart-note">Les prix seront confirmés dans la conversation WhatsApp.</p>' : "") +
      (waConfigured
        ? '<a class="btn btn--whatsapp" style="width:100%" id="cart-wa-order" href="' + esc(waHref) +
          '" target="_blank" rel="noopener">' + ZF.icon("whatsapp") + " Commander sur WhatsApp</a>" +
          '<a class="cart-secondary-link" href="commande.html">Ajouter mes informations (facultatif)</a>'
        : '<a class="btn btn--primary" style="width:100%" href="commande.html">Passer la commande</a>') +
      '<button class="cart-clear" type="button" id="cart-clear">Vider le panier</button>';

    var clearBtn = $("#cart-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        Cart.clear();
        ZF.toast("Panier vidé");
      });
    }
    ZF.bindImageFallbacks(body);
  }

  function openDrawer() {
    lastFocused = document.activeElement;
    renderDrawer();
    $("#cart-drawer").classList.add("is-open");
    $("#cart-drawer").setAttribute("aria-hidden", "false");
    $("#drawer-overlay").classList.add("is-open");
    document.body.style.overflow = "hidden";
    var closeBtn = $("#cart-drawer-close");
    if (closeBtn) closeBtn.focus();
  }

  function closeDrawer() {
    var d = $("#cart-drawer");
    if (!d || !d.classList.contains("is-open")) return;
    d.classList.remove("is-open");
    d.setAttribute("aria-hidden", "true");
    $("#drawer-overlay").classList.remove("is-open");
    document.body.style.overflow = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  ZF.openCart = openDrawer;

  function initDrawer() {
    document.body.insertAdjacentHTML("beforeend", drawerMarkup());
    $("#drawer-overlay").addEventListener("click", closeDrawer);
    $("#cart-drawer-close").addEventListener("click", closeDrawer);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrawer();
      /* Piège de focus simple dans le tiroir */
      if (e.key === "Tab") {
        var d = $("#cart-drawer");
        if (!d.classList.contains("is-open")) return;
        var focusables = $all("button, a[href], input, output", d).filter(function (el) { return el.offsetParent !== null; });
        if (focusables.length === 0) return;
        var first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    /* Délégation : steppers et suppression dans le tiroir */
    $("#cart-drawer-body").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-action]");
      if (!btn) return;
      var lineEl = btn.closest(".cart-line");
      if (!lineEl) return;
      var key = lineEl.getAttribute("data-key");
      var items = Cart.getItems();
      var line = items.find(function (l) { return Cart.lineKey(l.slug, l.options) === key; });
      if (!line) return;
      var action = btn.getAttribute("data-action");
      if (action === "inc") Cart.setQty(key, line.qty + 1);
      if (action === "dec") Cart.setQty(key, line.qty - 1);
      if (action === "remove") { Cart.removeLine(key); ZF.toast("Produit retiré du panier"); }
    });
  }

  /* ---------- Badge panier ---------- */
  function updateBadges() {
    var n = Cart.count();
    $all("[data-cart-count]").forEach(function (el) {
      el.textContent = n;
      if (n > 0) el.removeAttribute("hidden"); else el.setAttribute("hidden", "");
      el.classList.add("is-bump");
      setTimeout(function () { el.classList.remove("is-bump"); }, 250);
    });
  }

  /* ---------- Barre mobile ---------- */
  function initMobileBar() {
    var bar = document.createElement("nav");
    bar.className = "mobile-bar";
    bar.setAttribute("aria-label", "Navigation rapide");
    bar.innerHTML =
      '<a href="index.html">' + ZF.icon("house", "icon--lg") + "Accueil</a>" +
      '<a href="index.html#menu">' + ZF.icon("cloche", "icon--lg") + "Menu</a>" +
      '<button type="button" data-open-cart>' + ZF.icon("basket", "icon--lg") +
      'Panier<span class="cart-badge" data-cart-count hidden>0</span></button>';
    document.body.appendChild(bar);
  }

  /* ---------- Bouton WhatsApp flottant ----------
     Toujours accessible : permet de discuter directement avec
     ZAIDAT FOOD sans passer par le panier ni par un formulaire. */
  function initWhatsAppFab() {
    if (!ZF.wa.isConfigured()) return;
    var href = ZF.wa.link(ZF.wa.contactMessage());
    var fab = document.createElement("a");
    fab.className = "wa-fab";
    fab.href = href;
    fab.target = "_blank";
    fab.rel = "noopener";
    fab.setAttribute("aria-label", "Discuter directement avec ZAIDAT FOOD sur WhatsApp");
    fab.innerHTML =
      '<span class="wa-fab__pulse" aria-hidden="true"></span>' +
      ZF.icon("whatsapp") +
      '<span class="wa-fab__label">Discuter sur WhatsApp</span>';
    document.body.appendChild(fab);
  }

  /* ---------- Révélation au scroll ---------- */
  function initReveal() {
    var els = $all(".reveal");
    if (!("IntersectionObserver" in window) ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      /* Sans observateur : tout est visible d'emblée, y compris ce qui
         sera ajouté plus tard (d'où la fonction exposée plus bas). */
      els.forEach(function (el) { el.classList.add("is-visible"); });
      ZF.suivreReveal = function (racine) {
        $all(".reveal", racine || document).forEach(function (el) { el.classList.add("is-visible"); });
      };
      return;
    }
    var observateurADeclenche = false;
    var io = new IntersectionObserver(function (entries) {
      observateurADeclenche = true;
      /* Apparition en cascade : les éléments qui entrent ensemble à l'écran
         se révèlent l'un après l'autre. Le décalage reste court (60 ms) et
         plafonné, pour rester élégant sans jamais faire attendre. */
      var visibles = entries.filter(function (e) { return e.isIntersecting; });
      visibles.sort(function (a, b) {
        return a.boundingClientRect.top - b.boundingClientRect.top ||
               a.boundingClientRect.left - b.boundingClientRect.left;
      });
      visibles.forEach(function (entry, i) {
        entry.target.style.transitionDelay = Math.min(i * 60, 300) + "ms";
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });

    /* Tout ce qui est rendu APRÈS le démarrage (produits, témoignages,
       galerie… qui arrivent de la base) doit aussi être surveillé.
       Sans cela, ces éléments gardent `opacity: 0` pour toujours :
       présents dans la page, mais invisibles à l'écran. */
    ZF.suivreReveal = function (racine) {
      $all(".reveal", racine || document).forEach(function (el) {
        if (!el.classList.contains("is-visible")) io.observe(el);
      });
    };

    /* Dernier filet. L'animation d'apparition ne doit JAMAIS pouvoir
       rendre du contenu définitivement invisible. Si l'observateur n'a
       rien signalé au bout de 3 secondes, c'est qu'il ne fonctionne pas
       dans ce navigateur : on affiche tout sans animation. */
    setTimeout(function () {
      if (observateurADeclenche) return;
      $all(".reveal").forEach(function (el) { el.classList.add("is-visible"); });
    }, 3000);

    /* Filet automatique : aucun appelant n'a besoin d'y penser. */
    if ("MutationObserver" in window) {
      new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          Array.prototype.forEach.call(m.addedNodes, function (n) {
            if (n.nodeType !== 1) return;
            if (n.classList && n.classList.contains("reveal") && !n.classList.contains("is-visible")) {
              io.observe(n);
            }
            if (n.querySelectorAll) {
              Array.prototype.forEach.call(n.querySelectorAll(".reveal:not(.is-visible)"), function (el) {
                io.observe(el);
              });
            }
          });
        });
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  /* ---------- Barre d'info + pied de page (toutes pages) ---------- */
  function initChrome() {
    var bar = $("#info-bar");
    if (bar) {
      var bits = SITE_CONFIG.infoBar.map(function (t) { return esc(t); });
      if (SITE_CONFIG.phoneDisplay) {
        bits.push(ZF.icon("phone", "icon--sm") + " " + esc(SITE_CONFIG.phoneDisplay));
      }
      bar.innerHTML = bits.map(function (t) { return "<span>" + t + "</span>"; }).join("");
    }

    var y = $("#footer-year");
    if (y) y.textContent = String(new Date().getFullYear());

    var cats = $("#footer-categories");
    if (cats) {
      cats.innerHTML = getNonEmptyCategories().map(function (c) {
        return '<li><a href="index.html#menu">' + ZF.icon(c.icon, "icon--sm") + " " + esc(c.name) + "</a></li>";
      }).join("");
    }

    var contact = $("#footer-contact");
    if (contact) {
      var rows = [];
      if (SITE_CONFIG.WHATSAPP_ORDER_NUMBER) {
        rows.push('<li><a href="https://wa.me/' + esc(SITE_CONFIG.WHATSAPP_ORDER_NUMBER) +
          '" target="_blank" rel="noopener">' + ZF.icon("whatsapp", "icon--sm") + " Commander sur WhatsApp</a></li>");
      }
      if (SITE_CONFIG.phoneDisplay) {
        rows.push("<li>" + ZF.icon("phone", "icon--sm") + " " + esc(SITE_CONFIG.phoneDisplay) + "</li>");
      }
      rows.push("<li>" + ZF.icon("basket", "icon--sm") + " Commande en ligne via le panier du site</li>");
      if (SITE_CONFIG.hours && SITE_CONFIG.hours.length) {
        SITE_CONFIG.hours.forEach(function (h) {
          rows.push("<li>" + ZF.icon("clock", "icon--sm") + " " + esc(h) + "</li>");
        });
      } else {
        rows.push("<li>" + ZF.icon("clock", "icon--sm") + " Sur commande — réponse rapide</li>");
      }
      Object.keys(SITE_CONFIG.socials || {}).forEach(function (k) {
        var url = SITE_CONFIG.socials[k];
        if (!url) return;
        var known = { instagram: "instagram", facebook: "facebook", tiktok: "tiktok" };
        var ic = known[k] ? ZF.icon(known[k], "icon--sm") + " " : "";
        rows.push('<li><a href="' + esc(url) + '" target="_blank" rel="noopener">' + ic +
          esc(k.charAt(0).toUpperCase() + k.slice(1)) + "</a></li>");
      });
      contact.innerHTML = rows.join("");
    }

    var dn = $("#delivery-note");
    if (dn && SITE_CONFIG.delivery && SITE_CONFIG.delivery.note) dn.textContent = SITE_CONFIG.delivery.note;
  }

  /* ---------- Démarrage ---------- */
  ZF.pret(function () {
    initHeader();
    initDrawer();
    initMobileBar();
    initWhatsAppFab();
    initReveal();
    initCardPeek();
    initCardReveal();
    initChrome();
    updateBadges();
    Cart.onChange(function () {
      updateBadges();
      renderDrawer();
    });
    /* Tous les déclencheurs d'ouverture du panier */
    document.addEventListener("click", function (e) {
      var trigger = e.target.closest("[data-open-cart]");
      if (trigger) { e.preventDefault(); openDrawer(); }
    });
    ZF.bindImageFallbacks(document);
  });
})();
