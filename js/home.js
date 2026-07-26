/* =========================================================
   ZAIDAT FOOD — Page d'accueil
   Catégories filtrantes, grille produits, recherche,
   témoignages (si réels), galerie.
   ========================================================= */

(function () {
  "use strict";

  var currentCategory = "all";
  var currentSearch = "";

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  var esc = function (s) { return ZF.esc(s); };

  /* ---------- Filtres ---------- */
  function matches(p) {
    var okCat = currentCategory === "all" || p.category === currentCategory;
    if (!okCat) return false;
    if (!currentSearch) return true;
    var hay = (p.name + " " + p.shortDescription + " " + p.description).toLowerCase();
    return hay.indexOf(currentSearch) !== -1;
  }

  function renderGrid() {
    var grid = $("#product-grid");
    if (!grid) return;
    var list = PRODUCTS.filter(matches);
    /* Produits mis en avant d'abord (tri stable) */
    list = list.slice().sort(function (a, b) {
      var sa = (a.featured ? 2 : 0) + (a.bestseller ? 1 : 0);
      var sb = (b.featured ? 2 : 0) + (b.bestseller ? 1 : 0);
      return sb - sa;
    });
    if (list.length === 0) {
      grid.innerHTML =
        '<div class="grid-empty" style="grid-column:1/-1">' +
        "<p><strong>Aucun produit ne correspond à votre recherche.</strong></p>" +
        '<button class="btn btn--secondary btn--sm" type="button" id="reset-filters">Tout afficher</button></div>';
      var rb = $("#reset-filters");
      if (rb) rb.addEventListener("click", function () {
        currentSearch = "";
        var si = $("#search-input");
        if (si) si.value = "";
        setCategory("all");
      });
      return;
    }
    grid.innerHTML = list.map(function (p) { return ZF.cardHtml(p); }).join("");
    ZF.bindImageFallbacks(grid);
    /* Les cartes déjà à l'écran apparaissent immédiatement */
    Array.prototype.forEach.call(grid.querySelectorAll(".reveal"), function (el) {
      el.classList.add("is-visible");
    });
  }

  function setCategory(catId) {
    currentCategory = catId;
    Array.prototype.forEach.call(document.querySelectorAll(".cat-pill"), function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-cat") === catId ? "true" : "false");
    });
    renderGrid();
  }

  function renderCategories() {
    var wrap = $("#cat-pills");
    if (!wrap) return;
    var pills = ['<button class="cat-pill" type="button" data-cat="all" aria-pressed="true">' +
      ZF.icon("grid") + " Tout voir</button>"];
    getNonEmptyCategories().forEach(function (c) {
      pills.push(
        '<button class="cat-pill" type="button" data-cat="' + esc(c.id) + '" aria-pressed="false">' +
        ZF.icon(c.icon) + " " + esc(c.name) + "</button>"
      );
    });
    wrap.innerHTML = pills.join("");
    wrap.addEventListener("click", function (e) {
      var btn = e.target.closest(".cat-pill");
      if (btn) setCategory(btn.getAttribute("data-cat"));
    });
  }

  /* ---------- Recherche ---------- */
  function initSearch() {
    var form = $("#search-form");
    var input = $("#search-input");
    if (!form || !input) return;
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    input.addEventListener("input", function () {
      currentSearch = input.value.trim().toLowerCase();
      renderGrid();
      var menu = $("#menu");
      if (menu && currentSearch) menu.scrollIntoView({ block: "start" });
    });
  }

  /* ---------- Contenus depuis la configuration ---------- */
  function renderConfigTexts() {
    var els = {
      "hero-title": SITE_CONFIG.hero.title,
      "hero-subtitle": SITE_CONFIG.hero.subtitle,
      "hero-reassurance": SITE_CONFIG.hero.reassurance,
      "about-title": SITE_CONFIG.about.title,
      "about-text": SITE_CONFIG.about.text,
    };
    Object.keys(els).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = els[id];
    });
    var ctaP = $("#hero-cta-primary"); if (ctaP) ctaP.textContent = SITE_CONFIG.hero.ctaPrimary;
    var ctaS = $("#hero-cta-secondary"); if (ctaS) ctaS.textContent = SITE_CONFIG.hero.ctaSecondary;
    var pts = $("#about-points");
    if (pts) {
      pts.innerHTML = SITE_CONFIG.about.points.map(function (t) {
        return "<li>" + ZF.icon("sparkle", "icon--sm") + "<span>" + esc(t) + "</span></li>";
      }).join("");
    }
  }

  /* ---------- Témoignages (uniquement s'ils existent) ---------- */
  function renderTestimonials() {
    var section = $("#testimonials-section");
    if (!section) return;
    /* Une ligne laissée vide dans le dashboard afficherait un bloc
       « “” — » sur le site : on ne garde que les témoignages remplis. */
    var list = (SITE_CONFIG.testimonials || []).filter(function (t) {
      return t && String(t.text || "").trim();
    });
    if (list.length === 0) { section.setAttribute("hidden", ""); return; }
    section.removeAttribute("hidden");
    $("#testimonials-grid").innerHTML = list.map(function (t) {
      var nom = String(t.name || "").trim();
      /* Sans nom, on n'affiche pas un tiret orphelin */
      return '<blockquote class="testimonial reveal">“' + esc(t.text) + "”" +
        (nom ? "<footer>— " + esc(nom) + "</footer>" : "") + "</blockquote>";
    }).join("");
  }

  /* ---------- Galerie (vraies images lifestyle) ---------- */
  function renderGallery() {
    var wrap = $("#gallery-grid");
    if (!wrap) return;

    /* Priorité aux photos choisies dans le dashboard. Tant qu'il n'y en
       a pas, on montre les scènes de vie des produits : la section reste
       vivante dès le premier jour, sans rien avoir à configurer. */
    var choisies = (SITE_CONFIG.galerie || []).filter(function (g) {
      return g && String(g.url || "").trim();
    });

    if (choisies.length) {
      wrap.innerHTML = choisies.map(function (g) {
        var alt = String(g.legende || "").trim() || "Photo ZAIDAT FOOD";
        return (
          '<figure><img src="' + esc(g.urlPetite || g.url) + '" alt="' + esc(alt) +
          '" loading="lazy" width="450" height="450" data-fallback>' +
          (String(g.legende || "").trim() ? "<figcaption>" + esc(g.legende) + "</figcaption>" : "") +
          "</figure>"
        );
      }).join("");
      ZF.bindImageFallbacks(wrap);
      return;
    }

    var withLifestyle = PRODUCTS.filter(function (p) { return p.lifestyleImage; }).slice(0, 6);
    wrap.innerHTML = withLifestyle.map(function (p) {
      return (
        '<a href="produit.html?p=' + esc(p.slug) + '" aria-label="Voir ' + esc(p.name) + '">' +
        '<img src="' + esc(p.lifestyleImage) + '" alt="' + esc(p.name) + ' — moment de dégustation" loading="lazy" width="450" height="450" data-fallback>' +
        "</a>"
      );
    }).join("");
    ZF.bindImageFallbacks(wrap);
  }

  /* ---------- Vidéo du hero ----------
     L'image d'attente (poster) s'affiche immédiatement. La vidéo n'est
     téléchargée que si la connexion s'y prête : aux Comores, on ne
     gaspille pas les données du visiteur. */
  function initHeroVideo() {
    var video = $("#hero-video");
    if (!video) return;

    var conn = navigator.connection || navigator.webkitConnection || {};

    /* Mode économie de données activé par le visiteur */
    if (conn.saveData) return;
    /* Connexion très lente : on garde l'image fixe */
    if (conn.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return;
    /* Le visiteur a demandé de réduire les animations */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var src = window.innerWidth >= 900
      ? "assets/video/hero-1280.mp4"
      : "assets/video/hero-854.mp4";

    var source = document.createElement("source");
    source.src = src;
    source.type = "video/mp4";
    video.appendChild(source);
    video.load();

    var attempt = video.play();
    if (attempt && attempt.catch) {
      /* Lecture refusée par le navigateur : le poster reste affiché */
      attempt.catch(function () {});
    }
  }

  /* ---------- Ajout rapide ---------- */
  function initQuickAdd() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-add]");
      if (!btn) return;
      var res = Cart.add(btn.getAttribute("data-add"), 1, {});
      if (res.ok) {
        ZF.toast(res.product.name + " ajouté au panier");
      } else {
        ZF.toast("Ce produit est indisponible pour le moment", true);
      }
    });
  }

  /* On attend les données (Supabase ou fichiers locaux) avant
     d'afficher, pour ne jamais montrer un prix qui va changer. */
  ZF.pret(function () {
    initHeroVideo();
    renderConfigTexts();
    renderCategories();
    renderGrid();
    initSearch();
    renderTestimonials();
    renderGallery();
    initQuickAdd();
  });
})();
