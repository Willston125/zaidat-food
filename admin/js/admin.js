/* =========================================================
   ZAIDAT FOOD — Dashboard : application principale
   ---------------------------------------------------------
   Charge les données du site, permet de tout modifier, puis
   republie les fichiers sur GitHub. Vercel remet le site à
   jour automatiquement dans la minute qui suit.
   ========================================================= */

(function () {
  "use strict";

  /* ---------- Raccourcis ---------- */
  function $(s, c) { return (c || document).querySelector(s); }
  function $all(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  var ICONES_DISPO = ["bowl", "samosa", "flan", "cake", "pancakes", "cloche", "tray", "leaf", "heart", "chef-hat"];

  /* ---------- État ---------- */
  var D = { categories: [], produits: [], config: null };
  var original = "";
  var imagesEnAttente = {};   /* chemin -> dataURL */
  var vueCourante = "produits";
  var chargeDepuisGitHub = false;

  /* ---------- Messages ---------- */
  var toastTimer = null;
  function toast(msg, erreur) {
    var t = $("#adm-toast");
    t.textContent = msg;
    t.classList.toggle("est-erreur", !!erreur);
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("is-visible"); }, 3400);
  }

  /* ---------- Détection des modifications ---------- */
  function instantane() {
    return JSON.stringify({ c: D.categories, p: D.produits, g: D.config });
  }
  function aDesModifs() {
    return instantane() !== original || Object.keys(imagesEnAttente).length > 0;
  }
  function majEtat() {
    var modif = aDesModifs();
    var nbImg = Object.keys(imagesEnAttente).length;
    var el = $("#etat-modifs");
    if (modif) {
      el.textContent = "Modifications non publiées" + (nbImg ? " (" + nbImg + " photo" + (nbImg > 1 ? "s" : "") + ")" : "");
      el.classList.add("a-publier");
    } else {
      el.textContent = "Tout est publié";
      el.classList.remove("a-publier");
    }
    $("#btn-publier").disabled = !modif || !GH.estConnecte();
    $("#nb-produits").textContent = D.produits.length;
    $("#pastille-connexion").hidden = GH.estConnecte();
  }

  /* Évite de perdre un travail en cours en fermant l'onglet */
  window.addEventListener("beforeunload", function (e) {
    if (aDesModifs()) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- Chargement des données ---------- */
  function extraireDonnees(sourceProduits, sourceConfig) {
    var f = new Function(
      sourceProduits + "\n" + sourceConfig +
      "\nreturn { CATEGORIES: CATEGORIES, PRODUCTS: PRODUCTS, SITE_CONFIG: SITE_CONFIG };"
    );
    return f();
  }

  function charger() {
    var vue = $("#adm-vue");
    vue.innerHTML = '<div class="adm-chargement">Chargement des données du site…</div>';

    var lecture;
    if (GH.estConnecte()) {
      chargeDepuisGitHub = true;
      lecture = Promise.all([GH.lireFichier("js/products.js"), GH.lireFichier("js/config.js")])
        .then(function (r) { return [r[0].texte, r[1].texte]; });
    } else {
      chargeDepuisGitHub = false;
      lecture = Promise.all([
        fetch("../js/products.js").then(function (r) { return r.text(); }),
        fetch("../js/config.js").then(function (r) { return r.text(); }),
      ]);
    }

    return lecture
      .then(function (sources) {
        var d = extraireDonnees(sources[0], sources[1]);
        D.categories = d.CATEGORIES;
        D.produits = d.PRODUCTS;
        D.config = d.SITE_CONFIG;
        original = instantane();
        imagesEnAttente = {};
        majEtat();
        rendre();
      })
      .catch(function (err) {
        vue.innerHTML =
          '<div class="message message--erreur"><strong>Impossible de charger les données</strong>' +
          esc(err.message) + "</div>" +
          '<p>Ouvrez l\'onglet <strong>Connexion GitHub</strong> pour vérifier les réglages.</p>';
      });
  }

  /* =========================================================
     VUE : PRODUITS
     ========================================================= */
  function vueProduits() {
    var lignes = D.produits.map(function (p, i) {
      var cat = D.categories.filter(function (c) { return c.id === p.category; })[0];
      var prix = (p.price === null || p.price === undefined)
        ? '<span class="etiquette etiquette--sansprix">Prix sur demande</span>'
        : '<span class="etiquette etiquette--prix">' + esc(formaterPrix(p.price)) + "</span>";
      var vignette = apercuImage(p.productThumb || p.productImage);

      return (
        '<div class="adm-produit" data-index="' + i + '">' +
        (vignette
          ? '<img class="adm-produit__vignette" src="' + esc(vignette) + '" alt="">'
          : '<div class="adm-produit__vignette"></div>') +
        "<div>" +
        '<div class="adm-produit__nom">' + esc(p.name) + "</div>" +
        '<div class="adm-produit__meta">' +
        '<span class="etiquette etiquette--cat">' + esc(cat ? cat.name : "sans catégorie") + "</span>" +
        prix +
        (p.available ? "" : '<span class="etiquette etiquette--off">Indisponible</span>') +
        (p.lifestyleImage ? "" : '<span class="etiquette etiquette--nolife">Pas de photo en situation</span>') +
        "</div></div>" +
        '<div class="adm-produit__actions">' +
        '<button class="btn-mini" data-action="monter" title="Monter">↑</button>' +
        '<button class="btn-mini" data-action="descendre" title="Descendre">↓</button>' +
        '<button class="btn-mini" data-action="dupliquer">Dupliquer</button>' +
        '<button class="btn-mini" data-action="modifier">Modifier</button>' +
        '<button class="btn-mini btn-mini--danger" data-action="supprimer">Supprimer</button>' +
        "</div></div>"
      );
    }).join("");

    return (
      '<div class="adm-vue__tete"><div>' +
      "<h1>Produits</h1>" +
      "<p>L'ordre ci-dessous est celui du menu sur le site. Les produits mis en avant remontent automatiquement en tête.</p>" +
      '</div><button class="btn btn--primary" id="ajouter-produit">+ Ajouter un produit</button></div>' +
      (D.produits.length
        ? '<div class="adm-produits">' + lignes + "</div>"
        : '<div class="vide">Aucun produit pour le moment. Cliquez sur « Ajouter un produit ».</div>')
    );
  }

  function formaterPrix(v) {
    return Number(v).toLocaleString("fr-FR") + " " + (D.config.currency || "KMF");
  }

  /* Une image peut être déjà publiée (chemin) ou en attente (dataURL) */
  function apercuImage(chemin) {
    if (!chemin) return null;
    if (imagesEnAttente[chemin]) return imagesEnAttente[chemin];
    return "../" + chemin;
  }

  function brancherProduits() {
    var ajouter = $("#ajouter-produit");
    if (ajouter) ajouter.addEventListener("click", function () { ouvrirEditeur(null); });

    $all(".adm-produit").forEach(function (ligne) {
      ligne.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-action]");
        if (!btn) return;
        var i = parseInt(ligne.getAttribute("data-index"), 10);
        var action = btn.getAttribute("data-action");

        if (action === "modifier") { ouvrirEditeur(i); return; }
        if (action === "monter" && i > 0) {
          D.produits.splice(i - 1, 0, D.produits.splice(i, 1)[0]);
        }
        if (action === "descendre" && i < D.produits.length - 1) {
          D.produits.splice(i + 1, 0, D.produits.splice(i, 1)[0]);
        }
        if (action === "dupliquer") {
          var copie = JSON.parse(JSON.stringify(D.produits[i]));
          copie.name = copie.name + " (copie)";
          copie.slug = slugUnique(copie.slug + "-copie");
          copie.id = "p-" + copie.slug;
          copie.featured = false; copie.bestseller = false;
          D.produits.splice(i + 1, 0, copie);
          toast("Produit dupliqué — pensez à modifier son nom et ses photos");
        }
        if (action === "supprimer") {
          if (!confirm("Supprimer « " + D.produits[i].name + " » du site ?\n\nCette suppression ne sera effective qu'après publication.")) return;
          D.produits.splice(i, 1);
          toast("Produit retiré");
        }
        majEtat();
        rendre();
      });
    });
  }

  function slugUnique(base) {
    var s = base, n = 2;
    while (D.produits.some(function (p) { return p.slug === s; })) { s = base + "-" + n; n++; }
    return s;
  }

  /* « Gâteau au chocolat » -> « gateau-au-chocolat » */
  function versSlug(txt) {
    return String(txt || "").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")  /* retire les accents */
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  }

  /* =========================================================
     ÉDITEUR DE PRODUIT (tiroir)
     ========================================================= */
  var editionIndex = null;
  var brouillon = null;

  function produitVierge() {
    return {
      id: "", slug: "", name: "", shortDescription: "", description: "",
      price: null, currency: D.config.currency || "KMF",
      category: (D.categories[0] || {}).id || "",
      productImage: "", productThumb: "", lifestyleImage: "", lifestyleThumb: "",
      gallery: [], available: true, featured: false, bestseller: false, options: [],
    };
  }

  function ouvrirEditeur(index) {
    editionIndex = index;
    brouillon = index === null ? produitVierge() : JSON.parse(JSON.stringify(D.produits[index]));
    $("#tiroir-titre").textContent = index === null ? "Nouveau produit" : "Modifier : " + brouillon.name;
    $("#tiroir-corps").innerHTML = formulaireProduit(brouillon);
    brancherFormulaireProduit();
    $("#adm-tiroir").hidden = false;
    $("#adm-overlay").hidden = false;
    document.body.style.overflow = "hidden";
    var premier = $("#p-nom");
    if (premier) premier.focus();
  }

  function fermerEditeur() {
    $("#adm-tiroir").hidden = true;
    $("#adm-overlay").hidden = true;
    document.body.style.overflow = "";
    /* On vide le formulaire : sans cela, ses champs resteraient dans la
       page et se mélangeraient aux vues suivantes. */
    $("#tiroir-corps").innerHTML = "";
    brouillon = null;
  }

  function formulaireProduit(p) {
    var options = D.categories.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (c.id === p.category ? " selected" : "") + ">" + esc(c.name) + "</option>";
    }).join("");

    return (
      '<div class="bloc"><h3>Informations</h3>' +
      '<div class="champ"><label for="p-nom">Nom du produit</label>' +
      '<input type="text" id="p-nom" value="' + esc(p.name) + '" placeholder="Ex. Samoussas croustillants">' +
      '<p class="erreur" id="err-nom"></p></div>' +

      '<div class="champ"><label for="p-slug">Adresse de la fiche</label>' +
      '<input type="text" id="p-slug" value="' + esc(p.slug) + '" placeholder="samoussas">' +
      '<p class="aide">Se remplit tout seul d\'après le nom. Apparaît dans le lien : <code>produit.html?p=<span id="apercu-slug">' + esc(p.slug || "…") + "</span></code></p>" +
      '<p class="erreur" id="err-slug"></p></div>' +

      '<div class="champ-double">' +
      '<div class="champ"><label for="p-cat">Catégorie</label><select id="p-cat">' + options + "</select></div>" +
      '<div class="champ"><label for="p-prix">Prix en ' + esc(D.config.currency || "KMF") + "</label>" +
      '<input type="number" id="p-prix" min="0" step="50" value="' + (p.price === null || p.price === undefined ? "" : p.price) + '" placeholder="Laisser vide = prix sur demande">' +
      '<p class="aide">Vide : le site affiche « Prix sur demande ».</p></div>' +
      "</div>" +

      '<div class="champ"><label for="p-court">Description courte</label>' +
      '<input type="text" id="p-court" maxlength="120" value="' + esc(p.shortDescription) + '" placeholder="Une phrase, sous le nom sur la carte">' +
      '<p class="aide">Visible sur la carte du menu. 120 caractères maximum.</p></div>' +

      '<div class="champ"><label for="p-long">Description complète</label>' +
      '<textarea id="p-long" placeholder="Le texte de la fiche produit : ingrédients, préparation, occasions…">' + esc(p.description) + "</textarea></div>" +

      '<div class="champ-double">' +
      '<div class="champ"><label for="p-prep">Délai de préparation</label>' +
      '<input type="text" id="p-prep" value="' + esc(p.preparationTime || "") + '" placeholder="Ex. 24 h à l\'avance"></div>' +
      '<div class="champ"><label for="p-portions">Portions</label>' +
      '<input type="text" id="p-portions" value="' + esc(p.portions || "") + '" placeholder="Ex. 6 à 8 personnes"></div>' +
      "</div>" +

      '<div class="interrupteurs">' +
      '<label class="interrupteur"><input type="checkbox" id="p-dispo"' + (p.available ? " checked" : "") + "> Disponible à la commande</label>" +
      '<label class="interrupteur"><input type="checkbox" id="p-featured"' + (p.featured ? " checked" : "") + "> Mis en avant</label>" +
      '<label class="interrupteur"><input type="checkbox" id="p-best"' + (p.bestseller ? " checked" : "") + '> Badge « Populaire »</label>' +
      "</div></div>" +

      '<div class="bloc"><h3>Photos</h3>' +
      '<p class="bloc__note">Les photos sont recadrées en carré, puis enregistrées en deux tailles (900 px et 450 px) automatiquement.</p>' +
      '<div class="photos-duo">' +
      slotPhoto("produit", "Photo du produit", "Le plat seul, bien visible. C'est l'image de la carte du menu.", p.productImage) +
      slotPhoto("lifestyle", "Photo en situation", "La cuisinière avec ce même produit. Elle apparaît sur la fiche, sous la photo principale.", p.lifestyleImage) +
      "</div></div>" +

      '<div class="bloc"><h3>Options de commande</h3>' +
      '<p class="bloc__note">Champs proposés au client sur la fiche (message sur un gâteau, parfum…). Laissez vide si le produit n\'en a pas.</p>' +
      '<div id="liste-options"></div>' +
      '<button type="button" class="btn-mini" id="ajouter-option">+ Ajouter une option</button>' +
      "</div>"
    );
  }

  function slotPhoto(cle, titre, aide, chemin) {
    var src = apercuImage(chemin);
    return (
      '<div class="photo-slot" data-slot="' + cle + '">' +
      "<h4>" + esc(titre) + "</h4>" +
      '<p class="aide">' + esc(aide) + "</p>" +
      '<div class="photo-slot__apercu" data-apercu>' +
      (src ? '<img src="' + esc(src) + '" alt="">' : "Aucune photo") +
      "</div>" +
      '<div class="photo-slot__actions">' +
      '<button type="button" class="btn-mini" data-choisir>' + (src ? "Remplacer" : "Choisir une photo") + "</button>" +
      (src ? '<button type="button" class="btn-mini btn-mini--danger" data-retirer>Retirer</button>' : "") +
      "</div>" +
      '<input type="file" accept="image/*" data-fichier>' +
      "</div>"
    );
  }

  function brancherFormulaireProduit() {
    var nom = $("#p-nom"), slug = $("#p-slug");

    /* Le slug suit le nom tant qu'il n'a pas été modifié à la main */
    var slugManuel = !!brouillon.slug;
    nom.addEventListener("input", function () {
      brouillon.name = nom.value;
      if (!slugManuel) {
        slug.value = versSlug(nom.value);
        brouillon.slug = slug.value;
        $("#apercu-slug").textContent = slug.value || "…";
      }
    });
    slug.addEventListener("input", function () {
      slugManuel = true;
      slug.value = versSlug(slug.value);
      brouillon.slug = slug.value;
      $("#apercu-slug").textContent = slug.value || "…";
    });

    $("#p-cat").addEventListener("change", function () { brouillon.category = this.value; });
    $("#p-prix").addEventListener("input", function () {
      brouillon.price = this.value === "" ? null : Number(this.value);
    });
    $("#p-court").addEventListener("input", function () { brouillon.shortDescription = this.value; });
    $("#p-long").addEventListener("input", function () { brouillon.description = this.value; });
    $("#p-prep").addEventListener("input", function () { brouillon.preparationTime = this.value; });
    $("#p-portions").addEventListener("input", function () { brouillon.portions = this.value; });
    $("#p-dispo").addEventListener("change", function () { brouillon.available = this.checked; });
    $("#p-featured").addEventListener("change", function () { brouillon.featured = this.checked; });
    $("#p-best").addEventListener("change", function () { brouillon.bestseller = this.checked; });

    $all(".photo-slot").forEach(brancherSlotPhoto);
    rendreOptions();
    $("#ajouter-option").addEventListener("click", function () {
      brouillon.options = brouillon.options || [];
      brouillon.options.push({ id: "option-" + (brouillon.options.length + 1), name: "", type: "text", required: false, placeholder: "" });
      rendreOptions();
    });
  }

  function rendreOptions() {
    var hote = $("#liste-options");
    var opts = brouillon.options || [];
    if (!opts.length) { hote.innerHTML = '<p class="aide" style="margin:0 0 0.6rem">Aucune option.</p>'; return; }
    hote.innerHTML = opts.map(function (o, i) {
      return (
        '<div class="bloc" style="background:var(--cream-soft);padding:0.8rem;margin-bottom:0.6rem" data-opt="' + i + '">' +
        '<div class="champ"><label>Intitulé vu par le client</label>' +
        '<input type="text" data-champ="name" value="' + esc(o.name) + '" placeholder="Ex. Message à écrire sur le gâteau"></div>' +
        '<div class="champ"><label>Texte d\'exemple (facultatif)</label>' +
        '<input type="text" data-champ="placeholder" value="' + esc(o.placeholder || "") + '" placeholder="Ex. Joyeux anniversaire…"></div>' +
        '<label class="interrupteur"><input type="checkbox" data-champ="required"' + (o.required ? " checked" : "") + "> Obligatoire</label> " +
        '<button type="button" class="btn-mini btn-mini--danger" data-suppr-opt>Supprimer cette option</button>' +
        "</div>"
      );
    }).join("");

    $all("[data-opt]", hote).forEach(function (bloc) {
      var i = parseInt(bloc.getAttribute("data-opt"), 10);
      $all("[data-champ]", bloc).forEach(function (input) {
        input.addEventListener("input", function () {
          var champ = input.getAttribute("data-champ");
          brouillon.options[i][champ] = input.type === "checkbox" ? input.checked : input.value;
          if (champ === "name") brouillon.options[i].id = versSlug(input.value) || "option-" + (i + 1);
        });
        input.addEventListener("change", function () {
          if (input.type === "checkbox") brouillon.options[i][input.getAttribute("data-champ")] = input.checked;
        });
      });
      $("[data-suppr-opt]", bloc).addEventListener("click", function () {
        brouillon.options.splice(i, 1);
        rendreOptions();
      });
    });
  }

  /* ---------- Choix et recadrage d'une photo ---------- */
  function brancherSlotPhoto(slot) {
    var cle = slot.getAttribute("data-slot");
    var input = $("[data-fichier]", slot);

    $("[data-choisir]", slot).addEventListener("click", function () { input.click(); });

    var retirer = $("[data-retirer]", slot);
    if (retirer) {
      retirer.addEventListener("click", function () {
        if (cle === "produit") { brouillon.productImage = ""; brouillon.productThumb = ""; }
        else { brouillon.lifestyleImage = ""; brouillon.lifestyleThumb = ""; }
        rafraichirSlot(slot, cle);
      });
    }

    input.addEventListener("change", function () {
      var fichier = input.files && input.files[0];
      if (!fichier) return;
      if (fichier.size > 25 * 1024 * 1024) { toast("Photo trop lourde (25 Mo maximum)", true); return; }

      Cropper.chargerFichier(fichier)
        .then(function (img) { ouvrirRecadrage(img, cle, slot); })
        .catch(function (err) { toast(err.message, true); });
      input.value = "";
    });
  }

  function ouvrirRecadrage(image, cle, slot) {
    var modale = document.createElement("div");
    modale.className = "adm-modale";
    modale.innerHTML =
      '<div class="adm-modale__boite">' +
      "<h2>Recadrer la photo</h2>" +
      '<p class="aide" style="margin-top:-0.4rem;color:var(--ink-soft);font-size:0.88rem">' +
      "Faites glisser la photo pour la centrer, et utilisez le zoom. Le cadre carré correspond exactement à ce qui s'affichera sur le site.</p>" +
      '<div id="zone-crop"></div>' +
      '<div class="adm-modale__actions">' +
      '<button class="btn btn--ghost" data-annuler>Annuler</button>' +
      '<button class="btn btn--primary" data-valider>Utiliser cette photo</button>' +
      "</div></div>";
    document.body.appendChild(modale);

    var crop = Cropper.creer($("#zone-crop", modale), image);

    function fermer() { modale.remove(); }
    $("[data-annuler]", modale).addEventListener("click", fermer);
    modale.addEventListener("click", function (e) { if (e.target === modale) fermer(); });

    $("[data-valider]", modale).addEventListener("click", function () {
      if (!brouillon.slug) { toast("Renseignez d'abord le nom du produit", true); fermer(); return; }
      var sorties = crop.exporter();
      var dossier = cle === "produit" ? "products" : "lifestyle";
      var poids = 0;

      sorties.forEach(function (s) {
        var chemin = "assets/img/" + dossier + "/" + brouillon.slug + "-" + s.taille + ".jpg";
        imagesEnAttente[chemin] = s.dataURL;
        poids += Cropper.poidsKo(s.dataURL);
        if (s.taille === 900) {
          if (cle === "produit") brouillon.productImage = chemin; else brouillon.lifestyleImage = chemin;
        } else {
          if (cle === "produit") brouillon.productThumb = chemin; else brouillon.lifestyleThumb = chemin;
        }
      });

      fermer();
      rafraichirSlot(slot, cle);
      majEtat();
      toast("Photo prête (" + poids + " Ko au total)");
    });
  }

  function rafraichirSlot(slot, cle) {
    var chemin = cle === "produit" ? brouillon.productImage : brouillon.lifestyleImage;
    var titre = $("h4", slot).textContent;
    var aide = $(".aide", slot).textContent;
    slot.outerHTML = slotPhoto(cle, titre, aide, chemin);
    brancherSlotPhoto($('.photo-slot[data-slot="' + cle + '"]'));
  }

  /* ---------- Enregistrement du produit ---------- */
  function validerProduit() {
    var erreurs = [];
    if (!brouillon.name.trim()) erreurs.push("Le nom est obligatoire.");
    if (!brouillon.slug) erreurs.push("L'adresse de la fiche est obligatoire.");
    if (!brouillon.category) erreurs.push("Choisissez une catégorie.");
    if (!brouillon.productImage) erreurs.push("Une photo de produit est nécessaire.");

    var conflit = D.produits.some(function (p, i) {
      return p.slug === brouillon.slug && i !== editionIndex;
    });
    if (conflit) erreurs.push("Cette adresse de fiche est déjà utilisée par un autre produit.");

    if (erreurs.length) { toast(erreurs[0], true); return false; }

    brouillon.currency = D.config.currency || "KMF";
    if (!brouillon.id) brouillon.id = "p-" + brouillon.slug;
    if (!brouillon.gallery) brouillon.gallery = [];
    /* Champs vides : on les retire plutôt que d'écrire des chaînes vides */
    ["preparationTime", "portions"].forEach(function (c) {
      if (!brouillon[c]) delete brouillon[c];
    });

    if (editionIndex === null) D.produits.push(brouillon);
    else D.produits[editionIndex] = brouillon;

    majEtat();
    rendre();
    return true;
  }

  /* =========================================================
     VUE : CATÉGORIES
     ========================================================= */
  function vueCategories() {
    var lignes = D.categories.map(function (c, i) {
      var nb = D.produits.filter(function (p) { return p.category === c.id; }).length;
      var icones = ICONES_DISPO.map(function (ic) {
        return '<option value="' + ic + '"' + (ic === c.icon ? " selected" : "") + ">" + ic + "</option>";
      }).join("");
      return (
        '<div class="adm-produit" data-index="' + i + '">' +
        "<div></div><div>" +
        '<div class="champ" style="margin:0 0 0.5rem"><label>Nom affiché</label>' +
        '<input type="text" data-champ="name" value="' + esc(c.name) + '"></div>' +
        '<div class="champ-double" style="margin:0">' +
        '<div class="champ" style="margin:0"><label>Identifiant</label>' +
        '<input type="text" data-champ="id" value="' + esc(c.id) + '"></div>' +
        '<div class="champ" style="margin:0"><label>Icône</label>' +
        '<select data-champ="icon">' + icones + "</select></div></div>" +
        '<p class="aide">' + nb + " produit" + (nb > 1 ? "s" : "") +
        (nb === 0 ? " — cette catégorie ne s'affichera pas sur le site" : "") + "</p>" +
        "</div>" +
        '<div class="adm-produit__actions">' +
        '<button class="btn-mini" data-action="monter">↑</button>' +
        '<button class="btn-mini" data-action="descendre">↓</button>' +
        '<button class="btn-mini btn-mini--danger" data-action="supprimer">Supprimer</button>' +
        "</div></div>"
      );
    }).join("");

    return (
      '<div class="adm-vue__tete"><div><h1>Catégories</h1>' +
      "<p>Les onglets de filtrage du menu. Une catégorie sans produit reste masquée sur le site.</p></div>" +
      '<button class="btn btn--primary" id="ajouter-categorie">+ Ajouter</button></div>' +
      '<div class="adm-produits">' + lignes + "</div>" +
      '<div class="message message--info" style="margin-top:1rem"><strong>Attention à l\'identifiant</strong>' +
      "Si vous le modifiez, les produits qui l'utilisent seront réaffectés automatiquement.</div>"
    );
  }

  function brancherCategories() {
    var btn = $("#ajouter-categorie");
    if (btn) btn.addEventListener("click", function () {
      D.categories.push({ id: "categorie-" + (D.categories.length + 1), name: "Nouvelle catégorie", icon: "cloche" });
      majEtat(); rendre();
    });

    $all(".adm-produit").forEach(function (ligne) {
      var i = parseInt(ligne.getAttribute("data-index"), 10);

      $all("[data-champ]", ligne).forEach(function (input) {
        input.addEventListener("change", function () {
          var champ = input.getAttribute("data-champ");
          if (champ === "id") {
            var ancien = D.categories[i].id;
            var nouveau = versSlug(input.value) || ancien;
            /* Les produits suivent le renommage */
            D.produits.forEach(function (p) { if (p.category === ancien) p.category = nouveau; });
            D.categories[i].id = nouveau;
            input.value = nouveau;
          } else {
            D.categories[i][champ] = input.value;
          }
          majEtat();
        });
      });

      ligne.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-action]");
        if (!b) return;
        var a = b.getAttribute("data-action");
        if (a === "monter" && i > 0) D.categories.splice(i - 1, 0, D.categories.splice(i, 1)[0]);
        if (a === "descendre" && i < D.categories.length - 1) D.categories.splice(i + 1, 0, D.categories.splice(i, 1)[0]);
        if (a === "supprimer") {
          var nb = D.produits.filter(function (p) { return p.category === D.categories[i].id; }).length;
          if (nb) { toast("Impossible : " + nb + " produit(s) utilisent encore cette catégorie", true); return; }
          if (!confirm("Supprimer la catégorie « " + D.categories[i].name + " » ?")) return;
          D.categories.splice(i, 1);
        }
        majEtat(); rendre();
      });
    });
  }

  /* =========================================================
     VUE : TEXTES DU SITE
     ========================================================= */
  function vueTextes() {
    var c = D.config;
    return (
      '<div class="adm-vue__tete"><div><h1>Textes du site</h1>' +
      "<p>Tous les textes visibles sur la page d'accueil. Les modifications apparaissent après publication.</p></div></div>" +

      '<div class="bloc"><h3>Marque</h3>' +
      champTexte("brand.name", "Nom de la marque", c.brand.name) +
      champTexte("brand.tagline", "Sous-titre", c.brand.tagline) +
      "</div>" +

      '<div class="bloc"><h3>Bandeau du haut</h3>' +
      '<p class="bloc__note">Les petites phrases qui défilent tout en haut du site.</p>' +
      listeTextes("infoBar", c.infoBar) + "</div>" +

      '<div class="bloc"><h3>Grande image d\'accueil</h3>' +
      champTexte("hero.title", "Titre principal", c.hero.title) +
      champZone("hero.subtitle", "Sous-titre", c.hero.subtitle) +
      '<div class="champ-double">' +
      champTexte("hero.ctaPrimary", "Bouton principal", c.hero.ctaPrimary) +
      champTexte("hero.ctaSecondary", "Bouton secondaire", c.hero.ctaSecondary) +
      "</div>" +
      champTexte("hero.reassurance", "Petite phrase de réassurance", c.hero.reassurance) +
      "</div>" +

      '<div class="bloc"><h3>Section « La cuisine de… »</h3>' +
      champTexte("about.title", "Titre", c.about.title) +
      champZone("about.text", "Texte de présentation", c.about.text) +
      '<label style="display:block;font-weight:800;font-size:0.88rem;margin-bottom:0.3rem">Points forts</label>' +
      listeTextes("about.points", c.about.points) + "</div>"
    );
  }

  /* =========================================================
     VUE : CONTACT & LIVRAISON
     ========================================================= */
  function vueContact() {
    var c = D.config;
    return (
      '<div class="adm-vue__tete"><div><h1>Contact &amp; livraison</h1>' +
      "<p>Le numéro WhatsApp est le point le plus important : c'est là qu'arrivent toutes les commandes.</p></div></div>" +

      '<div class="bloc"><h3>WhatsApp</h3>' +
      champTexte("WHATSAPP_ORDER_NUMBER", "Numéro de commande", c.WHATSAPP_ORDER_NUMBER,
        "Format international, chiffres uniquement, sans + ni espaces. Exemple pour les Comores : 2694880343") +
      champTexte("phoneDisplay", "Téléphone affiché sur le site", c.phoneDisplay, "Version lisible, ex. +269 488 03 43") +
      champZone("whatsappGreeting", "Message du bouton flottant", c.whatsappGreeting) +
      "</div>" +

      '<div class="bloc"><h3>Horaires</h3>' +
      '<p class="bloc__note">Laissez vide tant qu\'ils ne sont pas fixés : le site affichera « Sur commande — réponse rapide ».</p>' +
      listeTextes("hours", c.hours) + "</div>" +

      '<div class="bloc"><h3>Livraison et retrait</h3>' +
      champZone("delivery.note", "Phrase affichée au client", c.delivery.note) +
      '<label style="display:block;font-weight:800;font-size:0.88rem;margin-bottom:0.3rem">Modes proposés</label>' +
      listeTextes("delivery.modes", c.delivery.modes) + "</div>" +

      '<div class="bloc"><h3>Moyens de paiement</h3>' +
      '<p class="bloc__note">Proposés lors de la commande. Aucun paiement en ligne n\'est encaissé par le site.</p>' +
      listeTextes("paymentMethods", c.paymentMethods) + "</div>" +

      '<div class="bloc"><h3>Réseaux sociaux</h3>' +
      '<p class="bloc__note">Adresse complète, ou vide si le compte n\'existe pas.</p>' +
      champTexte("socials.instagram", "Instagram", c.socials.instagram) +
      champTexte("socials.facebook", "Facebook", c.socials.facebook) +
      champTexte("socials.tiktok", "TikTok", c.socials.tiktok) +
      "</div>" +

      '<div class="bloc"><h3>Devise</h3>' +
      champTexte("currency", "Code affiché après les prix", c.currency, "Ex. KMF. Aucune conversion n'est faite.") +
      "</div>"
    );
  }

  /* =========================================================
     VUE : TÉMOIGNAGES
     ========================================================= */
  function vueTemoignages() {
    var t = D.config.testimonials || [];
    var lignes = t.map(function (x, i) {
      return (
        '<div class="bloc" data-temoin="' + i + '">' +
        '<div class="champ"><label>Prénom</label><input type="text" data-champ="name" value="' + esc(x.name) + '"></div>' +
        '<div class="champ"><label>Témoignage</label><textarea data-champ="text">' + esc(x.text) + "</textarea></div>" +
        '<button class="btn-mini btn-mini--danger" data-suppr>Supprimer</button></div>'
      );
    }).join("");

    return (
      '<div class="adm-vue__tete"><div><h1>Témoignages</h1>' +
      "<p>N'ajoutez que de <strong>vrais</strong> retours de clients. Tant que la liste est vide, la section reste masquée sur le site.</p></div>" +
      '<button class="btn btn--primary" id="ajouter-temoin">+ Ajouter</button></div>' +
      (t.length ? lignes : '<div class="vide">Aucun témoignage. La section n\'apparaît pas sur le site.</div>')
    );
  }

  function brancherTemoignages() {
    var btn = $("#ajouter-temoin");
    if (btn) btn.addEventListener("click", function () {
      D.config.testimonials = D.config.testimonials || [];
      D.config.testimonials.push({ name: "", text: "" });
      majEtat(); rendre();
    });
    $all("[data-temoin]").forEach(function (bloc) {
      var i = parseInt(bloc.getAttribute("data-temoin"), 10);
      $all("[data-champ]", bloc).forEach(function (input) {
        input.addEventListener("input", function () {
          D.config.testimonials[i][input.getAttribute("data-champ")] = input.value;
          majEtat();
        });
      });
      $("[data-suppr]", bloc).addEventListener("click", function () {
        D.config.testimonials.splice(i, 1); majEtat(); rendre();
      });
    });
  }

  /* =========================================================
     CHAMPS GÉNÉRIQUES liés à SITE_CONFIG par chemin ("hero.title")
     ========================================================= */
  function lire(chemin) {
    return chemin.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, D.config);
  }
  function ecrire(chemin, valeur) {
    var parts = chemin.split("."), dernier = parts.pop();
    var cible = parts.reduce(function (o, k) { return o[k]; }, D.config);
    cible[dernier] = valeur;
  }

  function champTexte(chemin, label, valeur, aide) {
    return (
      '<div class="champ"><label for="f-' + chemin + '">' + esc(label) + "</label>" +
      '<input type="text" id="f-' + chemin + '" data-config="' + chemin + '" value="' + esc(valeur || "") + '">' +
      (aide ? '<p class="aide">' + esc(aide) + "</p>" : "") + "</div>"
    );
  }
  function champZone(chemin, label, valeur) {
    return (
      '<div class="champ"><label for="f-' + chemin + '">' + esc(label) + "</label>" +
      '<textarea id="f-' + chemin + '" data-config="' + chemin + '">' + esc(valeur || "") + "</textarea></div>"
    );
  }
  function listeTextes(chemin, tableau) {
    var lignes = (tableau || []).map(function (v, i) {
      return (
        '<div class="liste-textes__ligne">' +
        '<input type="text" data-liste="' + chemin + '" data-i="' + i + '" value="' + esc(v) + '">' +
        '<button type="button" class="btn-mini btn-mini--danger" data-suppr-liste="' + chemin + '" data-i="' + i + '">Retirer</button>' +
        "</div>"
      );
    }).join("");
    return (
      '<div class="liste-textes">' + lignes + "</div>" +
      '<button type="button" class="btn-mini" data-ajout-liste="' + chemin + '">+ Ajouter une ligne</button>'
    );
  }

  function brancherChampsConfig() {
    $all("[data-config]").forEach(function (el) {
      el.addEventListener("input", function () {
        ecrire(el.getAttribute("data-config"), el.value);
        majEtat();
      });
    });
    $all("[data-liste]").forEach(function (el) {
      el.addEventListener("input", function () {
        var t = lire(el.getAttribute("data-liste"));
        t[parseInt(el.getAttribute("data-i"), 10)] = el.value;
        majEtat();
      });
    });
    $all("[data-suppr-liste]").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = lire(b.getAttribute("data-suppr-liste"));
        t.splice(parseInt(b.getAttribute("data-i"), 10), 1);
        majEtat(); rendre();
      });
    });
    $all("[data-ajout-liste]").forEach(function (b) {
      b.addEventListener("click", function () {
        var chemin = b.getAttribute("data-ajout-liste");
        var t = lire(chemin);
        if (!Array.isArray(t)) { ecrire(chemin, []); t = lire(chemin); }
        t.push("");
        majEtat(); rendre();
      });
    });
  }

  /* =========================================================
     VUE : CONNEXION GITHUB
     ========================================================= */
  function vueConnexion() {
    var r = GH.lireReglages();
    return (
      '<div class="adm-vue__tete"><div><h1>Connexion GitHub</h1>' +
      "<p>C'est ce qui permet au bouton « Publier » d'envoyer vos modifications sur le site en ligne.</p></div></div>" +

      (GH.estConnecte()
        ? '<div class="message message--ok"><strong>Connecté</strong>Dépôt <code>' + esc(r.owner) + "/" + esc(r.repo) + "</code>, branche <code>" + esc(r.branch || "main") + "</code>.</div>"
        : '<div class="message message--alerte"><strong>Pas encore connecté</strong>Vous pouvez consulter et préparer des modifications, mais pas les publier.</div>') +

      '<div class="bloc"><h3>Réglages du dépôt</h3>' +
      '<div class="champ-double">' +
      '<div class="champ"><label for="g-owner">Compte GitHub</label>' +
      '<input type="text" id="g-owner" value="' + esc(r.owner || "") + '" placeholder="Willston125"></div>' +
      '<div class="champ"><label for="g-repo">Nom du dépôt</label>' +
      '<input type="text" id="g-repo" value="' + esc(r.repo || "") + '" placeholder="zaidat-food"></div>' +
      "</div>" +
      '<div class="champ"><label for="g-branch">Branche</label>' +
      '<input type="text" id="g-branch" value="' + esc(r.branch || "main") + '"></div>' +
      '<div class="champ"><label for="g-token">Clé d\'accès</label>' +
      '<input type="password" id="g-token" value="' + esc(r.token || "") + '" placeholder="github_pat_…" autocomplete="off">' +
      '<p class="aide">Elle reste dans ce navigateur et n\'est envoyée qu\'à GitHub. Elle n\'est jamais publiée sur le site.</p></div>' +
      '<button class="btn btn--primary" id="g-verifier">Vérifier et enregistrer</button> ' +
      (GH.estConnecte() ? '<button class="btn btn--ghost" id="g-deconnecter">Se déconnecter</button>' : "") +
      '<div id="g-resultat" style="margin-top:1rem"></div></div>' +

      '<div class="bloc"><h3>Comment créer la clé d\'accès</h3>' +
      "<ol style=\"padding-left:1.2rem;line-height:1.8\">" +
      "<li>Sur GitHub, ouvrez <strong>Settings</strong> (menu de votre photo de profil), tout en bas <strong>Developer settings</strong>.</li>" +
      "<li>Cliquez <strong>Personal access tokens</strong> puis <strong>Fine-grained tokens</strong>, et <strong>Generate new token</strong>.</li>" +
      "<li>Donnez un nom (ex. « Dashboard ZAIDAT »), une date d'expiration, et dans <strong>Repository access</strong> choisissez <strong>Only select repositories</strong> → votre dépôt.</li>" +
      "<li>Dans <strong>Permissions → Repository permissions</strong>, réglez <strong>Contents</strong> sur <strong>Read and write</strong>. C'est la seule permission nécessaire.</li>" +
      "<li>Validez, copiez la clé affichée, et collez-la ci-dessus.</li>" +
      "</ol>" +
      '<div class="message message--alerte" style="margin-top:0.8rem"><strong>À savoir</strong>' +
      "Cette clé donne le droit de modifier votre dépôt. Ne la partagez pas, et ne l'utilisez que sur un ordinateur ou un téléphone qui vous appartient. " +
      "En cas de doute, supprimez-la sur GitHub et créez-en une nouvelle.</div></div>"
    );
  }

  function brancherConnexion() {
    var btn = $("#g-verifier");
    if (!btn) return;

    btn.addEventListener("click", function () {
      var reglages = {
        owner: $("#g-owner").value.trim(),
        repo: $("#g-repo").value.trim(),
        branch: $("#g-branch").value.trim() || "main",
        token: $("#g-token").value.trim(),
      };
      if (!reglages.owner || !reglages.repo || !reglages.token) {
        $("#g-resultat").innerHTML = '<div class="message message--erreur">Remplissez les quatre champs.</div>';
        return;
      }
      GH.ecrireReglages(reglages);
      $("#g-resultat").innerHTML = '<div class="message message--info">Vérification…</div>';

      GH.verifier()
        .then(function (info) {
          if (!info.peutEcrire) {
            $("#g-resultat").innerHTML =
              '<div class="message message--erreur"><strong>Lecture seule</strong>' +
              "La clé n'a pas le droit d'écriture sur ce dépôt. Vérifiez que <code>Contents</code> est réglé sur <code>Read and write</code>.</div>";
            return;
          }
          return GH.dernierCommit().then(function (c) {
            $("#g-resultat").innerHTML =
              '<div class="message message--ok"><strong>Connexion réussie</strong>' +
              "Dépôt <code>" + esc(info.nom) + "</code>" + (info.prive ? " (privé)" : "") + ".<br>" +
              "Dernière publication : « " + esc(c.message) + " » le " +
              new Date(c.date).toLocaleString("fr-FR") + ".</div>";
            majEtat();
            return charger();
          });
        })
        .catch(function (err) {
          $("#g-resultat").innerHTML = '<div class="message message--erreur"><strong>Échec</strong>' + esc(err.message) + "</div>";
          majEtat();
        });
    });

    var dec = $("#g-deconnecter");
    if (dec) dec.addEventListener("click", function () {
      if (!confirm("Se déconnecter ? La clé sera effacée de ce navigateur.")) return;
      GH.effacerReglages();
      majEtat(); rendre();
      toast("Déconnecté");
    });
  }

  /* =========================================================
     PUBLICATION
     ========================================================= */
  function ouvrirPublication() {
    var controle = Serialize.verifier(D.categories, D.produits, D.config);
    var sourceProduits = Serialize.produitsJS(D.categories, D.produits);
    var sourceConfig = Serialize.configJS(D.config);

    /* Filet de sécurité : on exécute les fichiers générés avant de les envoyer */
    var testP = Serialize.testerFichierGenere(sourceProduits, "PRODUCTS");
    var testC = Serialize.testerFichierGenere(sourceConfig, "SITE_CONFIG");

    var html = "";
    if (!testP.ok || !testC.ok) {
      html += '<div class="message message--erreur"><strong>Publication bloquée</strong>' +
        esc((testP.ok ? "" : testP.message) + " " + (testC.ok ? "" : testC.message)) +
        "<br>Rien n'a été envoyé. Signalez ce message : c'est un défaut du dashboard, pas de vos données.</div>";
    }
    if (controle.erreurs.length) {
      html += '<div class="message message--erreur"><strong>À corriger avant de publier</strong><ul>' +
        controle.erreurs.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ul></div>";
    }
    if (controle.alertes.length) {
      html += '<div class="message message--alerte"><strong>Points à vérifier (sans blocage)</strong><ul>' +
        controle.alertes.slice(0, 8).map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") +
        (controle.alertes.length > 8 ? "<li>… et " + (controle.alertes.length - 8) + " autre(s)</li>" : "") +
        "</ul></div>";
    }

    var nbImages = Object.keys(imagesEnAttente).length;
    var poids = Object.keys(imagesEnAttente).reduce(function (t, k) { return t + Cropper.poidsKo(imagesEnAttente[k]); }, 0);

    html += '<div class="message message--info"><strong>Ce qui va être envoyé</strong>' +
      D.produits.length + " produit(s), " + D.categories.length + " catégorie(s), et les textes du site." +
      (nbImages ? "<br>" + nbImages + " fichier(s) photo, " + poids + " Ko au total." : "<br>Aucune nouvelle photo.") +
      "<br>Le site en ligne se met à jour tout seul, environ une minute après.</div>";

    $("#pub-corps").innerHTML = html;
    $("#pub-confirmer").disabled = !controle.valide || !testP.ok || !testC.ok;
    $("#pub-confirmer").textContent = "Publier maintenant";
    $("#modale-publier").hidden = false;

    $("#pub-confirmer").onclick = function () { lancerPublication(sourceProduits, sourceConfig); };
  }

  function lancerPublication(sourceProduits, sourceConfig) {
    var bouton = $("#pub-confirmer");
    bouton.disabled = true;
    var journal = document.createElement("div");
    journal.className = "message message--info";
    journal.innerHTML = "<strong>Publication en cours</strong><span id=\"pub-etape\">Préparation…</span>";
    $("#pub-corps").appendChild(journal);

    var images = Object.keys(imagesEnAttente).map(function (chemin) {
      return { chemin: chemin, base64: Cropper.base64Seul(imagesEnAttente[chemin]) };
    });

    var message = "Mise a jour du site depuis le dashboard\n\n" +
      D.produits.length + " produits, " + D.categories.length + " categories" +
      (images.length ? ", " + images.length + " fichiers photo" : "");

    GH.publier(
      [
        { chemin: "js/products.js", contenu: sourceProduits },
        { chemin: "js/config.js", contenu: sourceConfig },
      ],
      images,
      message,
      function (etape) { $("#pub-etape").textContent = etape; }
    )
      .then(function (res) {
        original = instantane();
        imagesEnAttente = {};
        majEtat();
        journal.className = "message message--ok";
        journal.innerHTML =
          "<strong>Publié</strong>Enregistré sous <code>" + esc(res.sha) + "</code>. " +
          "Le site en ligne se met à jour dans la minute qui suit.<br>" +
          '<a href="' + esc(res.url) + '" target="_blank" rel="noopener">Voir la modification sur GitHub</a>';
        bouton.textContent = "Fermer";
        bouton.disabled = false;
        bouton.onclick = function () { $("#modale-publier").hidden = true; rendre(); };
        toast("Modifications publiées");
      })
      .catch(function (err) {
        journal.className = "message message--erreur";
        journal.innerHTML = "<strong>Échec de la publication</strong>" + esc(err.message) +
          "<br>Vos modifications sont toujours là : vous pouvez réessayer.";
        bouton.disabled = false;
        bouton.textContent = "Réessayer";
        toast("La publication a échoué", true);
      });
  }

  /* =========================================================
     RENDU ET NAVIGATION
     ========================================================= */
  function rendre() {
    var vue = $("#adm-vue");
    if (!D.config) return;

    if (vueCourante === "produits") { vue.innerHTML = vueProduits(); brancherProduits(); }
    else if (vueCourante === "categories") { vue.innerHTML = vueCategories(); brancherCategories(); }
    else if (vueCourante === "textes") { vue.innerHTML = vueTextes(); brancherChampsConfig(); }
    else if (vueCourante === "contact") { vue.innerHTML = vueContact(); brancherChampsConfig(); }
    else if (vueCourante === "temoignages") { vue.innerHTML = vueTemoignages(); brancherTemoignages(); }
    else if (vueCourante === "connexion") { vue.innerHTML = vueConnexion(); brancherConnexion(); }

    if (!chargeDepuisGitHub && vueCourante !== "connexion") {
      vue.insertAdjacentHTML("afterbegin",
        '<div class="message message--alerte"><strong>Mode consultation</strong>' +
        "Les données affichées viennent des fichiers locaux. Connectez-vous à GitHub pour pouvoir publier.</div>");
    }
    majEtat();
  }

  function initNavigation() {
    $all(".adm-nav__item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $all(".adm-nav__item").forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        vueCourante = btn.getAttribute("data-vue");
        rendre();
        window.scrollTo(0, 0);
      });
    });

    $("#tiroir-fermer").addEventListener("click", fermerEditeur);
    $("#tiroir-annuler").addEventListener("click", fermerEditeur);
    $("#adm-overlay").addEventListener("click", fermerEditeur);
    $("#tiroir-valider").addEventListener("click", function () {
      if (validerProduit()) { fermerEditeur(); toast("Produit enregistré — pensez à publier"); }
    });

    $("#btn-publier").addEventListener("click", ouvrirPublication);
    $("#pub-annuler").addEventListener("click", function () { $("#modale-publier").hidden = true; });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!$("#modale-publier").hidden) { $("#modale-publier").hidden = true; return; }
      if (!$("#adm-tiroir").hidden) fermerEditeur();
    });
  }

  /* ---------- Démarrage ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initNavigation();
    if (!GH.estConnecte()) {
      vueCourante = "connexion";
      $all(".adm-nav__item").forEach(function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-vue") === "connexion");
      });
    }
    charger();
  });
})();
