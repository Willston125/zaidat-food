/* =========================================================
   ZAIDAT FOOD — Fiche produit (produit.html?p=slug)
   Image produit + scène lifestyle, options, quantité,
   ajout panier, commande directe, produits similaires.
   ========================================================= */

(function () {
  "use strict";

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  var esc = function (s) { return ZF.esc(s); };

  function getSlug() {
    var params = new URLSearchParams(window.location.search);
    return params.get("p") || "";
  }

  /* Aucun produit à afficher : plutôt qu'un cul-de-sac, on propose
     directement le menu complet pour que le visiteur puisse repartir
     en un clic (cas d'un lien incomplet ou d'un produit retiré). */
  function notFound(root, slugDemande) {
    var titre = slugDemande
      ? "<strong>Ce produit est introuvable.</strong><br>Il a peut-être été retiré du menu."
      : "<strong>Choisissez un produit</strong><br>Voici tout ce que prépare ZAIDAT FOOD en ce moment.";

    root.innerHTML =
      '<div class="grid-empty" style="margin:2rem 0 1.5rem">' +
      "<p>" + titre + "</p>" +
      '<a class="btn btn--primary" href="index.html#menu">Voir tout le menu</a></div>' +
      '<div class="product-grid" id="fallback-grid" style="margin-bottom:2rem"></div>';

    var grid = document.getElementById("fallback-grid");
    grid.innerHTML = PRODUCTS.filter(function (p) { return p.available; })
      .slice(0, 8)
      .map(function (p) { return ZF.cardHtml(p, { compact: true, reveal: false }); })
      .join("");
    ZF.bindImageFallbacks(grid);

    var section = $("#similar-section");
    if (section) section.setAttribute("hidden", "");
  }

  function collectOptions(product) {
    var chosen = {};
    var valid = true;
    (product.options || []).forEach(function (opt) {
      var el = document.getElementById("opt-" + opt.id);
      if (!el) return;
      var val = (el.value || "").trim();
      var err = document.getElementById("opt-" + opt.id + "-error");
      if (opt.required && !val) {
        valid = false;
        if (err) err.textContent = "Ce champ est requis.";
        el.closest(".option-field").classList.add("has-error");
      } else {
        if (err) err.textContent = "";
        el.closest(".option-field").classList.remove("has-error");
        if (val) chosen[opt.name] = val;
      }
    });
    return { values: chosen, valid: valid };
  }

  function render() {
    var root = $("#product-root");
    if (!root) return;
    var slug = getSlug();
    var product = getProductBySlug(slug);
    if (!product) { notFound(root, slug); return; }

    var cat = getCategoryById(product.category);
    var price = formatPrice(product.price);
    document.title = product.name + " — ZAIDAT FOOD";
    var metaDesc = $('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", product.shortDescription);

    /* Données structurées produit */
    var ld = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.shortDescription,
      image: product.productImage,
      category: cat ? cat.name : undefined,
    };
    if (typeof product.price === "number") {
      ld.offers = { "@type": "Offer", price: product.price, priceCurrency: "KMF",
        availability: product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" };
    }
    var ldEl = document.createElement("script");
    ldEl.type = "application/ld+json";
    ldEl.textContent = JSON.stringify(ld);
    document.head.appendChild(ldEl);

    var priceHtml = price !== null
      ? price
      : '<span class="tbc">' + PRICE_TBC_LABEL + " — confirmé à la commande</span>";

    var optionsHtml = (product.options || []).map(function (opt) {
      if (opt.type === "text") {
        return (
          '<div class="option-field">' +
          '<label for="opt-' + esc(opt.id) + '">' + esc(opt.name) + (opt.required ? ' <span class="required">*</span>' : "") + "</label>" +
          '<input type="text" id="opt-' + esc(opt.id) + '" maxlength="120" placeholder="' + esc(opt.placeholder || "") + '"' +
          (opt.required ? ' required aria-required="true"' : "") + ' aria-describedby="opt-' + esc(opt.id) + '-error">' +
          '<p class="field-error" id="opt-' + esc(opt.id) + '-error" aria-live="polite"></p>' +
          "</div>"
        );
      }
      return "";
    }).join("");

    var metaItems = [];
    metaItems.push(
      "<li>" + ZF.icon(product.available ? "check-circle" : "unavailable") +
      '<span class="availability ' + (product.available ? "availability--ok" : "availability--off") + '">' +
      (product.available ? "Disponible à la commande" : "Indisponible pour le moment") + "</span></li>"
    );
    if (product.preparationTime) {
      metaItems.push("<li>" + ZF.icon("clock") + "<span>" + esc(product.preparationTime) + "</span></li>");
    }
    if (product.portions) {
      metaItems.push("<li>" + ZF.icon("cloche") + "<span>" + esc(product.portions) + "</span></li>");
    }
    metaItems.push("<li>" + ZF.icon("chef-hat") + "<span>Cuisine maison ZAIDAT FOOD</span></li>");

    /* Visionneuse : la scène de vie s'affiche d'abord (c'est elle qu'on
       vient de voir apparaître sur la carte), la photo du produit seul
       reste accessible en un clic juste en dessous. */
    var hasLife = !!product.lifestyleImage;
    var galleryHtml =
      '<div class="product-gallery">' +
      '<div class="product-gallery__stage">' +
      (hasLife
        ? '<img class="stage-img is-active" id="stage-life" src="' + esc(product.lifestyleImage) + '" alt="' +
          esc(product.name) + ' présenté et dégusté par la cuisinière ZAIDAT FOOD" width="900" height="900" fetchpriority="high" data-fallback>'
        : "") +
      '<img class="stage-img' + (hasLife ? "" : " is-active") + '" id="stage-product" src="' + esc(product.productImage) +
      '" alt="' + esc(product.name) + '" width="900" height="900"' + (hasLife ? ' loading="lazy"' : ' fetchpriority="high"') + " data-fallback>" +
      (hasLife ? '<p class="product-gallery__caption is-visible" id="stage-caption">Un moment à savourer</p>' : "") +
      "</div>" +
      (hasLife
        ? '<div class="product-gallery__thumbs" role="group" aria-label="Choisir la vue du produit">' +
          '<button class="gallery-thumb" type="button" data-view="life" aria-pressed="true">' +
          '<img src="' + esc(product.lifestyleThumb || product.lifestyleImage) + '" alt="" width="48" height="48">' +
          "<span>En situation</span></button>" +
          '<button class="gallery-thumb" type="button" data-view="product" aria-pressed="false">' +
          '<img src="' + esc(product.productThumb) + '" alt="" width="48" height="48">' +
          "<span>Le produit</span></button>" +
          "</div>"
        : "") +
      "</div>";

    root.innerHTML =
      '<nav class="breadcrumb" aria-label="Fil d\'Ariane">' +
      '<a href="index.html">Accueil</a> › <a href="index.html#menu">Menu</a> › ' +
      "<span>" + esc(product.name) + "</span></nav>" +
      '<div class="product-layout">' +
      '<div class="product-media">' + galleryHtml + "</div>" +
      '<div class="product-info">' +
      '<span class="product-info__cat">' + esc(cat ? cat.name : "") + "</span>" +
      "<h1>" + esc(product.name) + "</h1>" +
      '<p class="product-info__price">' + priceHtml + "</p>" +
      '<p class="product-info__desc">' + esc(product.description) + "</p>" +
      '<ul class="product-meta">' + metaItems.join("") + "</ul>" +
      optionsHtml +
      '<div class="buy-row">' +
      '<div class="qty-stepper" aria-label="Quantité">' +
      '<button type="button" id="qty-dec" aria-label="Diminuer la quantité">' + ZF.icon("minus") + "</button>" +
      '<output id="qty-value" aria-live="polite">1</output>' +
      '<button type="button" id="qty-inc" aria-label="Augmenter la quantité">' + ZF.icon("plus") + "</button>" +
      "</div>" +
      "</div>" +
      /* Action principale : commander tout de suite, sans formulaire */
      '<div class="buy-actions">' +
      (product.available && ZF.wa.isConfigured()
        ? '<a class="btn btn--whatsapp btn--block" id="order-whatsapp" href="#" target="_blank" rel="noopener">' +
          ZF.icon("whatsapp") + " Commander sur WhatsApp</a>"
        : "") +
      '<button class="btn ' + (ZF.wa.isConfigured() ? "btn--secondary" : "btn--primary") +
      ' btn--block" type="button" id="add-to-cart"' + (product.available ? "" : " disabled") + ">" +
      ZF.icon("basket") + " Ajouter au panier</button>" +
      "</div>" +
      (product.available && ZF.wa.isConfigured()
        ? '<p class="buy-hint">Commande directe : votre message part sur WhatsApp, ZAIDAT FOOD vous répond et confirme. Aucun formulaire à remplir.</p>'
        : "") +
      (!product.available ? '<p class="cart-note">Ce produit est momentanément indisponible — revenez bientôt !</p>' : "") +
      '<p><a href="index.html#menu">' + ZF.icon("arrow-left", "icon--sm") + " Continuer les achats</a></p>" +
      "</div></div>";

    ZF.bindImageFallbacks(root);
    initGallery();

    /* Quantité */
    var qty = 1;
    var qtyOut = $("#qty-value");
    var waLink = $("#order-whatsapp");

    /* Le lien WhatsApp reflète en permanence la quantité et les options
       choisies, pour qu'un simple clic parte avec les bonnes informations. */
    function refreshWaLink() {
      if (!waLink) return;
      var chosen = {};
      (product.options || []).forEach(function (opt) {
        var el = document.getElementById("opt-" + opt.id);
        var val = el ? (el.value || "").trim() : "";
        if (val) chosen[opt.name] = val;
      });
      waLink.setAttribute("href", ZF.wa.link(ZF.wa.productMessage(product, qty, chosen)));
    }

    function setQty(n) {
      qty = Math.max(1, Math.min(99, n));
      qtyOut.textContent = qty;
      refreshWaLink();
    }
    $("#qty-inc").addEventListener("click", function () { setQty(qty + 1); });
    $("#qty-dec").addEventListener("click", function () { setQty(qty - 1); });

    (product.options || []).forEach(function (opt) {
      var el = document.getElementById("opt-" + opt.id);
      if (el) el.addEventListener("input", refreshWaLink);
    });

    if (waLink) {
      refreshWaLink();
      /* Sécurité : on rafraîchit juste avant l'ouverture du lien */
      waLink.addEventListener("pointerdown", refreshWaLink);
      waLink.addEventListener("click", function () {
        refreshWaLink();
        ZF.toast("Votre commande s'ouvre dans WhatsApp");
      });
    }

    $("#add-to-cart").addEventListener("click", function () {
      var opts = collectOptions(product);
      if (!opts.valid) return;
      var res = Cart.add(product.slug, qty, opts.values);
      if (!res.ok) {
        ZF.toast("Ce produit est indisponible pour le moment", true);
        return;
      }
      ZF.toast(product.name + " ajouté au panier");
      ZF.openCart();
    });

    renderSimilar(product);
  }

  /* ---------- Visionneuse : scène de vie ⇄ produit seul ---------- */
  function initGallery() {
    var thumbs = ZF.$all(".gallery-thumb");
    if (thumbs.length === 0) return;
    var life = $("#stage-life");
    var prod = $("#stage-product");
    var caption = $("#stage-caption");

    function show(view) {
      var isLife = view === "life";
      if (life) life.classList.toggle("is-active", isLife);
      if (prod) prod.classList.toggle("is-active", !isLife);
      if (caption) caption.classList.toggle("is-visible", isLife);
      thumbs.forEach(function (t) {
        t.setAttribute("aria-pressed", t.getAttribute("data-view") === view ? "true" : "false");
      });
    }

    thumbs.forEach(function (t) {
      t.addEventListener("click", function () { show(t.getAttribute("data-view")); });
    });

    /* L'image elle-même bascule d'une vue à l'autre : accessible aussi
       au clavier, et annoncée comme un bouton aux lecteurs d'écran. */
    var stage = $(".product-gallery__stage");
    if (stage) {
      function toggleView() {
        var current = ZF.$all('.gallery-thumb[aria-pressed="true"]')[0];
        show(current && current.getAttribute("data-view") === "life" ? "product" : "life");
      }
      stage.setAttribute("role", "button");
      stage.setAttribute("tabindex", "0");
      stage.setAttribute("aria-label", "Changer de vue : produit seul ou en situation");
      stage.style.cursor = "pointer";
      stage.addEventListener("click", toggleView);
      stage.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleView();
        }
      });
    }
  }

  /* ---------- Produits similaires ---------- */
  function renderSimilar(product) {
    var section = $("#similar-section");
    var grid = $("#similar-grid");
    if (!section || !grid) return;
    var list = getProductsByCategory(product.category).filter(function (p) { return p.slug !== product.slug; });
    if (list.length === 0) {
      /* À défaut, d'autres produits populaires */
      list = PRODUCTS.filter(function (p) { return p.slug !== product.slug && p.featured; });
    }
    list = list.slice(0, 4);
    if (list.length === 0) { section.setAttribute("hidden", ""); return; }
    grid.innerHTML = list.map(function (p) {
      return ZF.cardHtml(p, { compact: true, reveal: false });
    }).join("");
    ZF.bindImageFallbacks(grid);
  }

  ZF.pret(render);
})();
