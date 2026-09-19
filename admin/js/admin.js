/* =========================================================
   ZAIDAT FOOD — Dashboard : application principale
   ---------------------------------------------------------
   Charge les données du site, permet de tout modifier, puis
   les enregistre dans la base Supabase. Le site lit cette base
   à chaque visite : les changements sont visibles aussitôt.
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
  var vueCourante = "produits";
  var donneesDepuisBase = false;

  /* Mode consultation : les données sont affichées mais rien ne peut
     être enregistré. Trois causes possibles, chacune avec son message :
       • "non-configure"    : js/supabase-config.js n'est pas rempli ;
       • "base-injoignable" : coupure réseau, ou projet Supabase en pause ;
       • "non-autorise"     : compte connecté mais pas administrateur. */
  var lectureSeule = false;
  var motifLectureSeule = null;
  var detailLectureSeule = "";
  var dateCache = null;

  /* Résultat du contrôle d'autorisation, mis à jour après connexion. */
  var estAdministrateur = false;

  function peutEnregistrer() {
    return BACK.estConnecte() && estAdministrateur && !lectureSeule;
  }

  /* Recontrôle l'autorisation auprès de la base, puis rafraîchit l'écran. */
  function verifierAutorisation() {
    if (!BACK.estConnecte()) {
      estAdministrateur = false;
      return Promise.resolve(false);
    }
    return BACK.estAdministrateur().then(function (v) {
      estAdministrateur = v;
      if (!v && !lectureSeule) {
        lectureSeule = true;
        motifLectureSeule = "non-autorise";
      } else if (v && motifLectureSeule === "non-autorise") {
        lectureSeule = false;
        motifLectureSeule = null;
      }
      return v;
    }).catch(function () {
      estAdministrateur = false;
      return false;
    });
  }

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
    return instantane() !== original;
  }

  /* Une seule phrase explique toujours pourquoi on ne peut pas
     enregistrer. Un écran muet ou figé donne l'impression d'une panne. */
  function raisonBlocage() {
    if (motifLectureSeule === "non-configure") {
      return "Base de données pas encore reliée — consultation seule";
    }
    if (motifLectureSeule === "base-injoignable") {
      return "Base injoignable — consultation seule";
    }
    if (motifLectureSeule === "non-autorise") {
      return "Compte non autorisé à modifier le site";
    }
    if (!BACK.estConnecte()) return "Connectez-vous pour enregistrer";
    return null;
  }

  function majEtat() {
    var modif = aDesModifs();
    var blocage = raisonBlocage();
    var el = $("#etat-modifs");

    if (blocage && modif) {
      el.textContent = "Non enregistré — " + blocage.toLowerCase();
      el.classList.add("a-publier");
    } else if (blocage) {
      el.textContent = blocage;
      el.classList.remove("a-publier");
    } else if (modif) {
      el.textContent = "Modifications non enregistrées";
      el.classList.add("a-publier");
    } else {
      el.textContent = "Tout est enregistré";
      el.classList.remove("a-publier");
    }

    /* Le bouton reste cliquable même bloquée : un bouton grisé sans
       explication laisse croire que le site est cassé. Le clic explique
       alors ce qui manque et emmène au bon endroit. */
    var btn = $("#btn-publier");
    btn.disabled = !modif;
    btn.title = !modif
      ? "Aucune modification à enregistrer"
      : (blocage || "Enregistrer sur le site");

    majBarreEnregistrer(modif);

    $("#nb-produits").textContent = D.produits.length;
    $("#pastille-connexion").hidden = peutEnregistrer();
  }

  /* Barre fixe en bas d'écran dès qu'un enregistrement est en attente.
     Le bouton de l'en-tête passait inaperçu, surtout sur téléphone :
     des tarifs modifiés restaient « en attente » sans que personne ne
     comprenne pourquoi le site ne changeait pas. */
  function majBarreEnregistrer(modif) {
    var barre = $("#barre-enregistrer");
    if (!barre) {
      barre = document.createElement("div");
      barre.id = "barre-enregistrer";
      barre.hidden = true;
      barre.innerHTML =
        "<span>Des modifications ne sont pas encore sur le site.</span>" +
        '<button class="btn btn--primary" type="button">Enregistrer maintenant</button>';
      document.body.appendChild(barre);
      $("button", barre).addEventListener("click", ouvrirPublication);

      /* La barre s'élargit sur deux lignes quand l'écran est étroit :
         sa hauteur ne peut pas être devinée, il faut la mesurer. */
      if (window.ResizeObserver) {
        new ResizeObserver(reserverPlaceBarre).observe(barre);
      } else {
        window.addEventListener("resize", reserverPlaceBarre);
      }
    }
    barre.hidden = !modif;
    reserverPlaceBarre();
  }

  /* La barre est fixée en bas de l'écran : sans marge équivalente sous
     le contenu, elle recouvrait le dernier produit de la liste — et
     donc ses boutons Modifier et Supprimer, exactement au moment où
     l'on travaille dessus. */
  function reserverPlaceBarre() {
    var barre = $("#barre-enregistrer");
    var hauteur = barre && !barre.hidden ? barre.getBoundingClientRect().height : 0;
    document.body.style.setProperty("--hauteur-barre", Math.ceil(hauteur) + "px");
    document.body.classList.toggle("a-barre-enregistrer", hauteur > 0);
  }

  /* Même problème en haut : la barre d'onglets se colle sous l'en-tête,
     dont la hauteur change selon la largeur de l'écran (il passe sur
     deux ou trois lignes sur un téléphone). Une valeur écrite en dur
     faisait disparaître les onglets derrière l'en-tête au défilement. */
  function mesurerEnTete() {
    var entete = $(".adm-header");
    if (!entete) return;
    var h = Math.ceil(entete.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--hauteur-entete", h + "px");
  }

  /* Évite de perdre un travail en cours en fermant l'onglet */
  window.addEventListener("beforeunload", function (e) {
    if (aDesModifs()) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- Chargement des données ---------- */
  function charger() {
    var vue = $("#adm-vue");
    vue.innerHTML = '<div class="adm-chargement">Chargement des données du site…</div>';

    return BACK.charger()
      .then(function (d) {
        D.categories = d.categories;
        D.produits = d.produits;
        D.config = d.config;
        D.baseVide = !!d.baseVide;

        lectureSeule = !!d.lectureSeule;
        motifLectureSeule = d.motif || null;
        detailLectureSeule = d.erreur || "";
        dateCache = d.dateCache || null;

        /* La bannière « Mode consultation » ne doit apparaître que si
           les données ne viennent PAS de la base. */
        donneesDepuisBase = d.source === "supabase";

        BACK.memoriserGalerie(d.config);
        original = instantane();

        return verifierAutorisation();
      })
      .then(function () {
        majEtat();
        rendre();
      })
      .catch(function (err) {
        /* Ne devrait plus arriver — BACK.charger() se rabat désormais
           tout seul. On garde un message utile plutôt qu'un écran figé. */
        lectureSeule = true;
        motifLectureSeule = "base-injoignable";
        detailLectureSeule = err && err.message;
        vue.innerHTML =
          '<div class="message message--erreur"><strong>Impossible de charger les données</strong>' +
          esc(err && err.message ? err.message : "Erreur inconnue") + "</div>" +
          '<p>Ouvrez l\'onglet <strong>Connexion</strong> pour vérifier les réglages.</p>';
        majEtat();
      });
  }

  /* Bandeau affiché en tête de chaque écran quand l'enregistrement est
     impossible. Il dit toujours trois choses : ce qui est affiché,
     pourquoi c'est bloqué, et quoi faire. */
  function banniereEtat() {
    if (!lectureSeule && donneesDepuisBase) return "";

    var titre, corps;
    if (motifLectureSeule === "non-configure") {
      titre = "Base de données pas encore reliée";
      corps = "Vous voyez les produits inscrits dans les fichiers du site. " +
        "Pour activer l'enregistrement, remplissez <code>js/supabase-config.js</code> — " +
        "la marche à suivre est dans <code>admin/GUIDE_DASHBOARD.md</code>.";
    } else if (motifLectureSeule === "base-injoignable") {
      var quand = dateCache
        ? " Ces données datent du " + new Date(dateCache).toLocaleString("fr-FR") + "."
        : " Ce sont les produits inscrits dans les fichiers du site.";
      titre = "Base injoignable — mode consultation";
      corps = "Vos modifications ne peuvent pas être enregistrées pour l'instant." + quand +
        " Le site public, lui, continue de fonctionner normalement. " +
        "Le projet Supabase est peut-être en pause : réveillez-le, puis rechargez cette page." +
        (detailLectureSeule ? "<br><small>Détail technique : " + esc(detailLectureSeule) + "</small>" : "");
    } else if (motifLectureSeule === "non-autorise") {
      titre = "Compte non autorisé";
      corps = "Vous êtes bien connectée, mais ce compte n'a pas le droit de modifier le site. " +
        "Il doit être déclaré administrateur dans Supabase : " +
        "<code>select zf_admin.promouvoir_administrateur('votre@email');</code> " +
        "dans le SQL Editor. Voir <code>admin/GUIDE_DASHBOARD.md</code>.";
    } else {
      titre = "Mode consultation";
      corps = "Les données affichées viennent des fichiers du site. " +
        "Connectez-vous pour pouvoir enregistrer vos modifications.";
    }

    return '<div class="message message--alerte"><strong>' + esc(titre) + "</strong>" + corps + "</div>";
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

  /* Une photo vient soit de la base (adresse complète), soit des
     fichiers du site (chemin relatif, à préfixer pour l'aperçu). */
  function apercuImage(chemin) {
    if (!chemin) return null;
    if (/^(https?:|data:|blob:)/.test(chemin)) return chemin;
    return "/" + chemin;
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
  /* Vrai dès qu'un champ de la fiche est modifié, remis à zéro à la
     validation : permet de prévenir avant de perdre une saisie. */
  var brouillonTouche = false;

  function produitVierge() {
    return {
      id: "", slug: "", name: "", shortDescription: "", description: "",
      price: null, currency: D.config.currency || "KMF",
      category: (D.categories[0] || {}).id || "",
      productImage: "", productThumb: "", lifestyleImage: "", lifestyleThumb: "",
      gallery: [], available: true, featured: false, bestseller: false, options: [],
    };
  }

  var detectionSaisieBranchee = false;
  function brancherDetectionSaisie() {
    if (detectionSaisieBranchee) return;
    detectionSaisieBranchee = true;
    var corps = $("#tiroir-corps");
    ["input", "change"].forEach(function (ev) {
      corps.addEventListener(ev, function () { brouillonTouche = true; });
    });
  }

  function ouvrirEditeur(index) {
    editionIndex = index;
    montrerErreursProduit([]);
    brouillon = index === null ? produitVierge() : JSON.parse(JSON.stringify(D.produits[index]));
    $("#tiroir-titre").textContent = index === null ? "Nouveau produit" : "Modifier : " + brouillon.name;
    $("#tiroir-corps").innerHTML = formulaireProduit(brouillon);
    brancherFormulaireProduit();
    /* Toute saisie marque la fiche comme « en cours » (délégué :
       couvre aussi les champs d'options ajoutés dynamiquement).
       `#tiroir-corps` est un élément permanent : ces écouteurs ne
       doivent être posés QU'UNE FOIS, sinon ils s'accumulent à
       chaque ouverture de fiche sans jamais être retirés. */
    brouillonTouche = false;
    brancherDetectionSaisie();
    $("#adm-tiroir").hidden = false;
    $("#adm-overlay").hidden = false;
    document.body.style.overflow = "hidden";
    var premier = $("#p-nom");
    if (premier) premier.focus();
  }

  function fermerEditeur() {
    /* Des saisies non validées ? On demande avant de les jeter.
       Sans ce garde-fou, modifier un prix puis fermer la fiche
       perdait le travail en silence — et le bouton Enregistrer
       ne s'activait jamais, sans explication. */
    if (brouillonTouche &&
        !confirm("Cette fiche contient des modifications non validées.\nFermer sans les garder ?")) {
      return;
    }
    brouillonTouche = false;
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
      slotPhoto("produit", "Photo du produit (obligatoire)",
                "Le plat seul, bien visible. C'est l'image de la carte du menu. " +
                "Renseignez d'abord le nom du produit : la photo est rangee sous ce nom.", p.productImage) +
      slotPhoto("lifestyle", "Photo en situation (facultative)",
                "La cuisinière avec ce même produit. Elle apparaît sur la fiche, sous la photo principale.", p.lifestyleImage) +
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

      /* On prévient AVANT le recadrage : découvrir qu'il faut se
         connecter après avoir cadré sa photo est décourageant. */
      if (!peutEnregistrer()) {
        toast(raisonBlocage() + " : la photo ne peut pas être envoyée", true);
        input.value = "";
        return;
      }
      if (!brouillon.slug) {
        toast("Renseignez d'abord le nom du produit", true);
        input.value = "";
        return;
      }

      Cropper.chargerFichier(fichier)
        .then(function (img) { ouvrirRecadrage(img, cle, slot); })
        .catch(function (err) { toast(err.message, true); });
      input.value = "";
    });
  }

  /* Recadrage + envoi, commun aux photos de produits et à la galerie.
     `options` : { dossier, nom, surSucces(grande, petite, poidsKo) } */
  function ouvrirRecadrageGenerique(image, options) {
    var modale = document.createElement("div");
    modale.className = "adm-modale";
    modale.innerHTML =
      '<div class="adm-modale__boite">' +
      "<h2>Recadrer la photo</h2>" +
      '<p class="aide" style="margin-top:-0.4rem;color:var(--ink-soft);font-size:0.88rem">' +
      "Faites glisser la photo pour la centrer, et utilisez le zoom. Le cadre " +
      esc(options.formeCadre || "carré") +
      " correspond exactement à ce qui s'affichera sur le site.</p>" +
      '<div id="zone-crop"></div>' +
      '<div class="adm-modale__actions">' +
      '<button class="btn btn--ghost" data-annuler>Annuler</button>' +
      '<button class="btn btn--primary" data-valider>Utiliser cette photo</button>' +
      "</div></div>";
    document.body.appendChild(modale);

    var formats = options.formats || Cropper.FORMATS_CARRES;
    var crop = Cropper.creer($("#zone-crop", modale), image, { formats: formats });

    function fermer() { modale.remove(); }
    $("[data-annuler]", modale).addEventListener("click", fermer);
    modale.addEventListener("click", function (e) { if (e.target === modale) fermer(); });

    var valider = $("[data-valider]", modale);
    valider.addEventListener("click", function () {
      if (!peutEnregistrer()) {
        toast(raisonBlocage() + " : la photo ne peut pas être envoyée", true);
        return;
      }

      var sorties = crop.exporter();
      var poids = sorties.reduce(function (t, s) { return t + Cropper.poidsKo(s.dataURL); }, 0);

      valider.disabled = true;
      valider.textContent = "Envoi de la photo…";

      /* Les deux tailles partent l'une après l'autre : sur une connexion
         mobile, deux envois simultanés échouent plus souvent qu'ils
         n'accélèrent quoi que ce soit. */
      var urls = {};
      var chaine = Promise.resolve();
      sorties.forEach(function (s) {
        chaine = chaine.then(function () {
          return BACK.envoyerPhoto(s.dataURL, options.nom, options.dossier, s.taille)
            .then(function (url) { urls[s.taille] = url; });
        });
      });

      var grandeTaille = formats[0].taille;
      var petiteTaille = formats[formats.length - 1].taille;

      chaine
        .then(function () {
          fermer();
          options.surSucces(urls[grandeTaille] || urls[petiteTaille],
                            urls[petiteTaille] || urls[grandeTaille], poids);
          toast("Photo envoyée (" + poids + " Ko)");
        })
        .catch(function (err) {
          valider.disabled = false;
          valider.textContent = "Réessayer";
          toast(err.message, true);
        });
    });
  }

  function ouvrirRecadrage(image, cle, slot) {
    ouvrirRecadrageGenerique(image, {
      dossier: cle === "produit" ? "produits" : "lifestyle",
      nom: brouillon.slug,
      surSucces: function (grande, petite) {
        if (cle === "produit") {
          brouillon.productImage = grande;
          brouillon.productThumb = petite;
        } else {
          brouillon.lifestyleImage = grande;
          brouillon.lifestyleThumb = petite;
        }
        rafraichirSlot(slot, cle);
        majEtat();
      },
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
  /* Liste, de facon persistante, ce qui empeche de valider la fiche. */
  function montrerErreursProduit(erreurs) {
    var zone = $("#err-produit");
    if (!zone) return;
    if (!erreurs.length) { zone.hidden = true; zone.innerHTML = ""; return; }
    zone.innerHTML = "Pour valider cette fiche, il manque :<ul>" +
      erreurs.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ul>";
    zone.hidden = false;
  }

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

    if (erreurs.length) {
      montrerErreursProduit(erreurs);
      toast(erreurs[0], true);
      return false;
    }
    montrerErreursProduit([]);

    brouillon.currency = D.config.currency || "KMF";
    if (!brouillon.id) brouillon.id = "p-" + brouillon.slug;
    if (!brouillon.gallery) brouillon.gallery = [];
    /* Champs vides : on les retire plutôt que d'écrire des chaînes vides */
    ["preparationTime", "portions"].forEach(function (c) {
      if (!brouillon[c]) delete brouillon[c];
    });

    if (editionIndex === null) D.produits.push(brouillon);
    else D.produits[editionIndex] = brouillon;

    /* La saisie est validée : la fermeture ne doit plus demander
       de confirmation. */
    brouillonTouche = false;

    majEtat();
    rendre();
    return true;
  }


  /* =========================================================
     VUE : AFFICHE D'ANNONCE
     ========================================================= */
  /* Date du jour au format AAAA-MM-JJ, dans le fuseau de la
     personne qui publie — c'est celui qui compte pour elle. */
  function dateDuJour() {
    var d = new Date();
    var m = String(d.getMonth() + 1), j = String(d.getDate());
    return d.getFullYear() + "-" + (m.length < 2 ? "0" + m : m) + "-" + (j.length < 2 ? "0" + j : j);
  }

  function afficheCourante() {
    if (!D.config.affiche || typeof D.config.affiche !== "object") {
      D.config.affiche = {
        actif: false, image: "", imagePetite: "", alt: "", lien: "", finLe: "",
        fermetureAuto: 0, rappelMinutes: 30, relanceDefilement: 0,
      };
    }
    return D.config.affiche;
  }

  /* Le lien se choisit dans une liste plutôt qu'en tapant une
     adresse : personne ne devrait avoir à connaître la forme
     « produit.html?p=pilaou » pour renvoyer vers un gâteau. */
  function optionsLienAffiche(valeur) {
    var choix = [
      { v: "", t: "Aucun — l'affiche n'est pas cliquable" },
      { v: "index.html#menu", t: "Le menu du site" },
      { v: "commande.html", t: "Le panier" },
    ];
    D.produits.forEach(function (p) {
      choix.push({ v: "produit.html?p=" + p.slug, t: "Produit : " + p.name });
    });
    if (valeur && !choix.some(function (c) { return c.v === valeur; })) {
      choix.push({ v: valeur, t: "Adresse enregistrée : " + valeur });
    }
    return choix.map(function (c) {
      return '<option value="' + esc(c.v) + '"' + (c.v === valeur ? " selected" : "") + ">" + esc(c.t) + "</option>";
    }).join("");
  }

  function vueAffiche() {
    var a = afficheCourante();
    var duree = [0, 10, 20].map(function (n) {
      return '<option value="' + n + '"' + (Number(a.fermetureAuto) === n ? " selected" : "") + ">" +
        (n === 0 ? "Non — elle reste jusqu'au clic" : "Après " + n + " secondes") + "</option>";
    }).join("");

    var rappelActuel = a.rappelMinutes === undefined ? 30 : Number(a.rappelMinutes);
    var rappel = [
      { v: 0, t: "Une seule fois — elle ne revient jamais" },
      { v: 15, t: "Au bout de 15 minutes" },
      { v: 30, t: "Au bout de 30 minutes" },
      { v: 60, t: "Au bout d'une heure" },
      { v: 180, t: "Au bout de trois heures" },
      { v: 1440, t: "Une fois par jour" },
    ].map(function (o) {
      return '<option value="' + o.v + '"' + (rappelActuel === o.v ? " selected" : "") + ">" + o.t + "</option>";
    }).join("");

    var relanceActuelle = Number(a.relanceDefilement) || 0;
    var relance = [
      { v: 0, t: "Non" },
      { v: 2, t: "Après 2 minutes de lecture" },
      { v: 3, t: "Après 3 minutes de lecture" },
      { v: 5, t: "Après 5 minutes de lecture" },
      { v: 10, t: "Après 10 minutes de lecture" },
    ].map(function (o) {
      return '<option value="' + o.v + '"' + (relanceActuelle === o.v ? " selected" : "") + ">" + o.t + "</option>";
    }).join("");

    var expiree = a.finLe && a.finLe < dateDuJour();
    var etat = !a.actif
      ? '<span class="etiquette etiquette--off">Désactivée</span>'
      : (!a.image ? '<span class="etiquette etiquette--off">Sans image</span>'
        : (expiree ? '<span class="etiquette etiquette--off">Date passée</span>'
          : '<span class="etiquette etiquette--prix">Visible sur le site</span>'));

    return (
      '<div class="adm-vue__tete"><div><h1>Affiche</h1>' +
      "<p>Une annonce en grand, montrée une seule fois à chaque visiteur en arrivant sur le site. " +
      "Pour un événement, une fermeture, une nouveauté.</p></div></div>" +

      '<div class="bloc"><h3>État ' + etat + "</h3>" +
      '<label class="interrupteur"><input type="checkbox" id="af-actif"' + (a.actif ? " checked" : "") +
      "> Afficher cette annonce sur le site</label>" +
      '<p class="aide">Chaque visiteur la voit <strong>une seule fois</strong>. ' +
      "Elle ne s'affiche jamais sur la page du panier, pour ne pas interrompre une commande en cours. " +
      "Si vous changez l'image ou le texte, elle sera revue une fois par tout le monde.</p></div>" +

      '<div class="bloc"><h3>Image</h3>' +
      '<p class="bloc__note">Format vertical, comme une story Instagram (1080 × 1920). ' +
      "Une affiche préparée dans Canva ou sur votre téléphone convient parfaitement.</p>" +
      '<div class="affiche-editeur">' +
      '<div class="affiche-apercu">' +
      (a.image
        ? '<img src="' + esc(apercuImage(a.imagePetite || a.image)) + '" alt="">'
        : '<div class="affiche-apercu__vide">Aucune affiche</div>') +
      "</div>" +
      '<div class="affiche-editeur__corps">' +
      '<div class="photo-slot__actions">' +
      '<button type="button" class="btn-mini" id="af-choisir">' + (a.image ? "Remplacer l'affiche" : "Choisir une affiche") + "</button>" +
      (a.image ? '<button type="button" class="btn-mini btn-mini--danger" id="af-retirer">Retirer</button>' : "") +
      "</div>" +
      '<input type="file" id="af-fichier" accept="image/*" hidden>' +

      '<div class="champ"><label for="af-alt">Que dit cette affiche ?</label>' +
      '<input type="text" id="af-alt" maxlength="200" value="' + esc(a.alt || "") + '" ' +
      'placeholder="Ex. Gâteaux de l\'Aïd — commandes jusqu\'au 28 septembre">' +
      '<p class="aide">Lu à voix haute par les lecteurs d\'écran, et affiché si l\'image ne charge pas. ' +
      "Écrivez ce qu'on lit sur l'affiche.</p></div>" +
      "</div></div></div>" +

      '<div class="bloc"><h3>Comportement</h3>' +
      '<div class="champ-double">' +
      '<div class="champ"><label for="af-fin">Dernier jour d\'affichage</label>' +
      '<input type="date" id="af-fin" value="' + esc(a.finLe || "") + '" min="' + dateDuJour() + '">' +
      '<p class="aide">Passé ce jour, l\'affiche disparaît toute seule. ' +
      "Sans date, elle reste jusqu'à ce que vous la désactiviez.</p></div>" +
      '<div class="champ"><label for="af-duree">Fermeture automatique</label>' +
      '<select id="af-duree">' + duree + "</select>" +
      '<p class="aide">Nous conseillons « Non » : la croix suffit, et une affiche qui disparaît ' +
      "toute seule pendant qu'on la lit agace plus qu'elle n'aide.</p></div>" +
      "</div>" +
      '<div class="champ"><label for="af-lien">Où mène un clic sur l\'affiche ?</label>' +
      '<select id="af-lien">' + optionsLienAffiche(a.lien || "") + "</select></div>" +
      "</div>" +

      '<div class="bloc"><h3>Quand la revoit-on ?</h3>' +
      '<p class="bloc__note">Une annonce vue une seule fois et jamais revue ne pousse personne à ' +
      "commander ; revue à chaque page, elle fait fuir. Ces deux réglages sont le curseur entre les deux. " +
      "Dans tous les cas, elle ne s'affiche jamais sur la page du panier : on n'interrompt pas une " +
      "commande en cours.</p>" +
      '<div class="champ-double">' +
      '<div class="champ"><label for="af-rappel">La remontrer</label>' +
      '<select id="af-rappel">' + rappel + "</select>" +
      '<p class="aide">Le compte repart à chaque fois que le visiteur la ferme, ' +
      "qu'il reste sur le site ou qu'il revienne plus tard.</p></div>" +
      '<div class="champ"><label for="af-relance">Relancer un visiteur qui hésite</label>' +
      '<select id="af-relance">' + relance + "</select>" +
      '<p class="aide">Quelqu\'un qui parcourt le menu depuis plusieurs minutes sans aller ' +
      "commander hésite : l'affiche revient une fois, sans attendre le délai ci-contre. " +
      "Seul le temps passé vraiment devant la page est compté.</p></div>" +
      "</div></div>" +

      '<div class="message message--info"><strong>Comment la voir vous-même</strong>' +
      "Ajoutez <code>?affiche=test</code> à l'adresse du site — par exemple " +
      "<code>zaidatfood.online/?affiche=test</code> — et elle s'affichera à chaque rechargement, " +
      "sans attendre le délai et sans être retenue comme vue. Une affiche désactivée ou dont la date " +
      "est passée ne s'affichera pas davantage : ce contrôle ne ment pas.</div>"
    );
  }

  function brancherAffiche() {
    var a = afficheCourante();

    $("#af-actif").addEventListener("change", function () {
      a.actif = this.checked; majEtat(); rendre();
    });
    $("#af-alt").addEventListener("input", function () { a.alt = this.value; majEtat(); });
    $("#af-fin").addEventListener("change", function () { a.finLe = this.value; majEtat(); rendre(); });
    $("#af-duree").addEventListener("change", function () {
      a.fermetureAuto = parseInt(this.value, 10) || 0; majEtat();
    });
    $("#af-lien").addEventListener("change", function () { a.lien = this.value; majEtat(); });
    $("#af-rappel").addEventListener("change", function () {
      a.rappelMinutes = parseInt(this.value, 10) || 0; majEtat();
    });
    $("#af-relance").addEventListener("change", function () {
      a.relanceDefilement = parseInt(this.value, 10) || 0; majEtat();
    });

    var retirer = $("#af-retirer");
    if (retirer) {
      retirer.addEventListener("click", function () {
        a.image = ""; a.imagePetite = "";
        majEtat(); rendre();
      });
    }

    var input = $("#af-fichier");
    $("#af-choisir").addEventListener("click", function () {
      /* Prévenir avant le recadrage plutôt qu'après : cadrer une
         affiche pour apprendre ensuite qu'on ne peut pas l'envoyer
         est décourageant. */
      if (!peutEnregistrer()) {
        toast(raisonBlocage() + " : l'affiche ne peut pas être envoyée", true);
        return;
      }
      input.click();
    });

    input.addEventListener("change", function () {
      var fichier = input.files && input.files[0];
      input.value = "";
      if (!fichier) return;
      if (fichier.size > 25 * 1024 * 1024) { toast("Image trop lourde (25 Mo maximum)", true); return; }

      Cropper.chargerFichier(fichier)
        .then(function (img) {
          ouvrirRecadrageGenerique(img, {
            dossier: "affiches",
            nom: "affiche",
            formeCadre: "vertical",
            formats: Cropper.FORMATS_AFFICHE,
            surSucces: function (grande, petite) {
              a.image = grande;
              a.imagePetite = petite;
              if (!a.actif) a.actif = true;   /* on vient de la choisir : elle est faite pour être vue */
              majEtat(); rendre();
            },
          });
        })
        .catch(function (err) { toast(err.message, true); });
    });
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
        var champ = input.getAttribute("data-champ");

        /* `reecrire` : faut-il remettre au propre le contenu du champ ?
           On ne le fait qu'à la sortie du champ. Normaliser à chaque
           frappe empêcherait de taper une espace dans l'identifiant. */
        function appliquer(reecrire) {
          if (champ === "id") {
            var ancien = D.categories[i].id;
            var nouveau = versSlug(input.value) || ancien;
            /* Les produits suivent le renommage */
            D.produits.forEach(function (p) { if (p.category === ancien) p.category = nouveau; });
            D.categories[i].id = nouveau;
            if (reecrire) input.value = nouveau;
          } else {
            D.categories[i][champ] = input.value;
          }
          majEtat();
        }

        /* « input » et pas seulement « change » : sans lui, un nom de
           catégorie tapé au clavier restait invisible pour le dashboard,
           qui gardait « Tout est enregistré » et laissait le bouton
           Enregistrer grisé. Tous les autres écrans écoutent « input ». */
        input.addEventListener("input", function () { appliquer(false); });
        input.addEventListener("change", function () { appliquer(true); });
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
    /* Filet : une base enregistrée avant l'ajout de ces sections ne
       les contient pas encore. On repart des valeurs du site plutôt
       que de casser l'écran. */
    if (!c.steps) c.steps = { eyebrow: "", title: "", items: [] };
    if (!Array.isArray(c.steps.items)) c.steps.items = [];
    if (!c.promises) c.promises = { eyebrow: "", title: "", items: [] };
    if (!Array.isArray(c.promises.items)) c.promises.items = [];
    if (!c.ctaFinal) c.ctaFinal = { title: "", text: "", button: "" };
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
      listeTextes("about.points", c.about.points) + "</div>" +

      '<div class="bloc"><h3>Étapes de commande</h3>' +
      '<p class="bloc__note">La section « Comment commander ? » de la page d\'accueil.</p>' +
      champTexte("steps.eyebrow", "Petite phrase au-dessus du titre", c.steps.eyebrow) +
      champTexte("steps.title", "Titre de la section", c.steps.title) +
      listeCouples("steps.items", c.steps.items, "Étape", false) + "</div>" +

      '<div class="bloc"><h3>Engagements</h3>' +
      '<p class="bloc__note">Le bandeau foncé « Ce que ZAIDAT FOOD vous promet ».</p>' +
      champTexte("promises.eyebrow", "Petite phrase au-dessus du titre", c.promises.eyebrow) +
      champTexte("promises.title", "Titre de la section", c.promises.title) +
      listeCouples("promises.items", c.promises.items, "Engagement", true) + "</div>" +

      '<div class="bloc"><h3>Appel final</h3>' +
      '<p class="bloc__note">Le dernier bloc de la page d\'accueil, juste avant le pied de page.</p>' +
      champTexte("ctaFinal.title", "Titre", c.ctaFinal.title) +
      champZone("ctaFinal.text", "Texte", c.ctaFinal.text) +
      champTexte("ctaFinal.button", "Texte du bouton", c.ctaFinal.button) + "</div>"
    );
  }

  /* Liste d'éléments « titre + texte », avec icône facultative.
     Sert aux étapes de commande et aux engagements. */
  function listeCouples(chemin, items, libelle, avecIcone) {
    var lignes = (items || []).map(function (e, i) {
      var icones = avecIcone
        ? '<div class="champ" style="margin:0 0 0.5rem"><label>Icône</label>' +
          '<select data-couple="' + chemin + '" data-i="' + i + '" data-champ="icon">' +
          ICONES_DISPO.concat(["bag", "scooter", "users", "sparkle", "check-circle", "clock", "wallet"])
            .filter(function (v, k, t) { return t.indexOf(v) === k; })
            .map(function (ic) {
              return '<option value="' + ic + '"' + (ic === e.icon ? " selected" : "") + ">" + ic + "</option>";
            }).join("") + "</select></div>"
        : "";
      return (
        '<div class="bloc" style="background:var(--cream-soft);padding:0.8rem;margin-bottom:0.6rem">' +
        '<div class="champ" style="margin:0 0 0.5rem"><label>' + esc(libelle) + " " + (i + 1) + " — titre</label>" +
        '<input type="text" data-couple="' + chemin + '" data-i="' + i + '" data-champ="title" value="' + esc(e.title || "") + '"></div>' +
        '<div class="champ" style="margin:0 0 0.5rem"><label>Texte</label>' +
        '<input type="text" data-couple="' + chemin + '" data-i="' + i + '" data-champ="text" value="' + esc(e.text || "") + '"></div>' +
        icones +
        '<button type="button" class="btn-mini btn-mini--danger" data-suppr-couple="' + chemin + '" data-i="' + i + '">Retirer</button>' +
        "</div>"
      );
    }).join("");
    return lignes +
      '<button type="button" class="btn-mini" data-ajout-couple="' + chemin + '">+ Ajouter</button>';
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
     VUE : GALERIE
     Photos libres (ambiance, cuisine, événements…), indépendantes
     des produits. Si la liste est vide, le site retombe sur les
     photos en situation des produits : la section n'est jamais vide.
     ========================================================= */
  function vueGalerie() {
    var g = D.config.galerie || [];
    var lignes = g.map(function (x, i) {
      return (
        '<div class="bloc galerie-ligne" data-galerie="' + i + '">' +
        '<img class="galerie-vignette" src="' + esc(x.urlPetite || x.url) + '" alt="">' +
        '<div class="galerie-ligne__corps">' +
        '<div class="champ"><label>Légende (facultative)</label>' +
        '<input type="text" data-champ="legende" value="' + esc(x.legende || "") + '" ' +
        'placeholder="Ex. « Préparation des samboussas »"></div>' +
        '<p class="aide">Sert de description pour les personnes malvoyantes et les moteurs de recherche.</p>' +
        "</div>" +
        '<div class="galerie-ligne__actions">' +
        '<button class="btn-mini" data-monter title="Monter">↑</button>' +
        '<button class="btn-mini" data-descendre title="Descendre">↓</button>' +
        '<button class="btn-mini btn-mini--danger" data-suppr>Retirer</button>' +
        "</div></div>"
      );
    }).join("");

    return (
      '<div class="adm-vue__tete"><div><h1>Galerie</h1>' +
      "<p>Les photos d'ambiance affichées en bas de la page d'accueil. " +
      "Ajoutez ce que vous voulez : votre cuisine, un buffet, un événement…</p></div>" +
      '<button class="btn btn--primary" id="ajouter-photo-galerie">+ Ajouter une photo</button></div>' +
      '<input type="file" id="fichier-galerie" accept="image/*" hidden>' +
      (g.length
        ? lignes
        : '<div class="vide">Aucune photo pour l\'instant.<br>' +
          "En attendant, le site affiche automatiquement les photos en situation de vos produits.</div>")
    );
  }

  function brancherGalerie() {
    var input = $("#fichier-galerie");
    var btn = $("#ajouter-photo-galerie");

    if (btn && input) {
      btn.addEventListener("click", function () {
        if (!peutEnregistrer()) {
          toast(raisonBlocage() + " : la photo ne peut pas être envoyée", true);
          return;
        }
        input.click();
      });

      input.addEventListener("change", function () {
        var fichier = input.files && input.files[0];
        input.value = "";
        if (!fichier) return;
        if (fichier.size > 25 * 1024 * 1024) { toast("Photo trop lourde (25 Mo maximum)", true); return; }

        Cropper.chargerFichier(fichier)
          .then(function (img) {
            ouvrirRecadrageGenerique(img, {
              dossier: "galerie",
              nom: "photo",
              surSucces: function (grande, petite) {
                D.config.galerie = D.config.galerie || [];
                D.config.galerie.push({ url: grande, urlPetite: petite, legende: "" });
                majEtat();
                rendre();
              },
            });
          })
          .catch(function (err) { toast(err.message, true); });
      });
    }

    $all("[data-galerie]").forEach(function (bloc) {
      var i = parseInt(bloc.getAttribute("data-galerie"), 10);
      var liste = D.config.galerie;

      $all("[data-champ]", bloc).forEach(function (champ) {
        champ.addEventListener("input", function () {
          liste[i][champ.getAttribute("data-champ")] = champ.value;
          majEtat();
        });
      });

      $("[data-monter]", bloc).addEventListener("click", function () {
        if (i === 0) return;
        liste.splice(i - 1, 0, liste.splice(i, 1)[0]);
        majEtat(); rendre();
      });
      $("[data-descendre]", bloc).addEventListener("click", function () {
        if (i >= liste.length - 1) return;
        liste.splice(i + 1, 0, liste.splice(i, 1)[0]);
        majEtat(); rendre();
      });
      $("[data-suppr]", bloc).addEventListener("click", function () {
        if (!confirm("Retirer cette photo de la galerie ?")) return;
        liste.splice(i, 1);
        majEtat(); rendre();
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
    /* Listes « titre + texte » : étapes de commande, engagements. */
    $all("[data-couple]").forEach(function (el) {
      var maj = function () {
        var t = lire(el.getAttribute("data-couple"));
        var i = parseInt(el.getAttribute("data-i"), 10);
        if (!Array.isArray(t) || !t[i]) return;
        t[i][el.getAttribute("data-champ")] = el.value;
        majEtat();
      };
      el.addEventListener("input", maj);
      el.addEventListener("change", maj);
    });
    $all("[data-suppr-couple]").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = lire(b.getAttribute("data-suppr-couple"));
        if (!Array.isArray(t)) return;
        t.splice(parseInt(b.getAttribute("data-i"), 10), 1);
        majEtat(); rendre();
      });
    });
    $all("[data-ajout-couple]").forEach(function (b) {
      b.addEventListener("click", function () {
        var chemin = b.getAttribute("data-ajout-couple");
        var t = lire(chemin);
        if (!Array.isArray(t)) { ecrire(chemin, []); t = lire(chemin); }
        t.push({ title: "", text: "", icon: "sparkle" });
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
    var configure = BACK.estConfigure();
    var connecte = BACK.estConnecte();
    var email = BACK.email();

    return (
      '<div class="adm-vue__tete"><div><h1>Connexion</h1>' +
      "<p>Connectez-vous pour enregistrer vos modifications. Elles apparaissent sur le site aussitôt.</p></div></div>" +

      (!configure
        ? '<div class="message message--alerte"><strong>Base de données pas encore reliée</strong>' +
          "Le dashboard fonctionne en consultation : vous voyez les produits, mais le bouton Enregistrer reste inactif.<br>" +
          "Pour l'activer, remplissez <code>js/supabase-config.js</code> — la marche à suivre est dans <code>admin/GUIDE_DASHBOARD.md</code>.</div>"
        : connecte
          ? (estAdministrateur && !lectureSeule
              ? '<div class="message message--ok"><strong>Connectée et autorisée</strong>Vous êtes identifiée comme <code>' +
                esc(email || "") + "</code>. Vos modifications sont enregistrées directement.</div>"
              : banniereEtat() ||
                '<div class="message message--alerte"><strong>Enregistrement indisponible</strong>' +
                "Vous êtes connectée comme <code>" + esc(email || "") + "</code>, mais rien ne peut être enregistré pour l'instant.</div>")
          : '<div class="message message--alerte"><strong>Pas encore connectée</strong>Vous pouvez tout consulter et préparer, mais pas enregistrer.</div>') +

      (configure && !connecte
        ? '<div class="bloc"><h3>Se connecter</h3>' +
          '<div class="champ"><label for="sb-email">Adresse email</label>' +
          '<input type="email" id="sb-email" autocomplete="username" placeholder="vous@exemple.com"></div>' +
          '<div class="champ"><label for="sb-mdp">Mot de passe</label>' +
          '<input type="password" id="sb-mdp" autocomplete="current-password"></div>' +
          '<button class="btn btn--primary" id="sb-connecter">Se connecter</button>' +
          '<div id="sb-resultat" style="margin-top:1rem"></div></div>'
        : "") +

      (connecte
        ? '<div class="bloc"><h3>Session</h3>' +
          "<p>Restez connectée sur votre téléphone ou votre ordinateur personnel. Sur un appareil partagé, déconnectez-vous après usage.</p>" +
          '<button class="btn btn--ghost" id="sb-deconnecter">Se déconnecter</button></div>'
        : "") +

      '<div class="bloc"><h3>Où sont enregistrées les données ?</h3>' +
      "<p>Les produits, les prix et les textes sont dans une base de données Supabase. Les photos sont stockées au même endroit. " +
      "Le site les lit à chaque visite : dès que vous enregistrez, tout le monde voit la nouvelle version.</p>" +
      "<p>Si la base devient injoignable, le site continue de fonctionner avec les produits inscrits dans ses fichiers : " +
      "vos visiteurs ne tombent jamais sur une page vide.</p></div>"
    );
  }

  function brancherConnexion() {
    var btn = $("#sb-connecter");
    if (btn) {
      var resultat = $("#sb-resultat");
      var lancer = function () {
        var email = $("#sb-email").value.trim();
        var mdp = $("#sb-mdp").value;
        if (!email || !mdp) {
          resultat.innerHTML = '<div class="message message--erreur">Renseignez votre email et votre mot de passe.</div>';
          return;
        }
        btn.disabled = true;
        resultat.innerHTML = '<div class="message message--info">Connexion…</div>';
        BACK.connexion(email, mdp)
          .then(function () {
            /* Être connectée ne suffit pas : encore faut-il être
               autorisée à écrire. On le vérifie tout de suite, pour
               ne pas laisser préparer un travail qui sera refusé. */
            return verifierAutorisation();
          })
          .then(function (autorisee) {
            if (!autorisee) {
              toast("Connectée, mais ce compte n'est pas autorisé à modifier le site", true);
              majEtat();
              rendre();
              return;
            }
            /* Recharger écraserait le travail en cours : on ne le fait
               que si rien n'a été modifié. Sinon on garde les
               modifications, prêtes à être enregistrées. */
            if (aDesModifs()) {
              toast("Connectée — vos modifications sont intactes, cliquez sur Enregistrer");
              majEtat();
              rendre();
              return;
            }
            toast("Connexion réussie");
            majEtat();
            return charger();
          })
          .catch(function (err) {
            btn.disabled = false;
            resultat.innerHTML = '<div class="message message--erreur"><strong>Échec</strong>' + esc(err.message) + "</div>";
          });
      };
      btn.addEventListener("click", lancer);
      $("#sb-mdp").addEventListener("keydown", function (e) { if (e.key === "Enter") lancer(); });
    }

    var dec = $("#sb-deconnecter");
    if (dec) dec.addEventListener("click", function () {
      if (aDesModifs() && !confirm("Des modifications ne sont pas enregistrées. Se déconnecter quand même ?")) return;
      BACK.deconnexion().then(function () {
        majEtat(); rendre();
        toast("Déconnectée");
      });
    });
  }

  /* =========================================================
     PUBLICATION
     ========================================================= */
  function ouvrirPublication() {
    /* On ne reste jamais muet : on explique ce qui bloque et on emmène
       au bon endroit, plutôt que de laisser croire à une panne.

       L'ordre compte. Quand la base est injoignable ou pas encore
       reliée, se connecter n'y changerait rien : proposer la connexion
       enverrait la cuisinière saisir un mot de passe pour rien. Ces
       deux cas passent donc AVANT le contrôle de connexion. */
    if (motifLectureSeule === "base-injoignable" || motifLectureSeule === "non-configure") {
      allerA("connexion");
      toast(raisonBlocage() + " — vos modifications sont conservées.", true);
      return;
    }
    if (!BACK.estConnecte()) {
      allerA("connexion");
      toast("Connectez-vous d'abord : vos modifications sont conservées.", true);
      var champ = $("#sb-email");
      if (champ) champ.focus();
      return;
    }
    if (lectureSeule) {
      /* Aucun faux enregistrement : compte non autorisé. */
      allerA("connexion");
      toast(raisonBlocage() + " — vos modifications sont conservées.", true);
      return;
    }

    var controle = Serialize.verifier(D.categories, D.produits, D.config);

    var html = "";
    if (controle.erreurs.length) {
      html += '<div class="message message--erreur"><strong>À corriger avant d\'enregistrer</strong><ul>' +
        controle.erreurs.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ul></div>";
    }
    if (controle.alertes.length) {
      html += '<div class="message message--alerte"><strong>Points à vérifier (sans blocage)</strong><ul>' +
        controle.alertes.slice(0, 8).map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") +
        (controle.alertes.length > 8 ? "<li>… et " + (controle.alertes.length - 8) + " autre(s)</li>" : "") +
        "</ul></div>";
    }

    html += '<div class="message message--info"><strong>Ce qui va être enregistré</strong>' +
      D.produits.length + " produit(s), " + D.categories.length + " catégorie(s), et les textes du site." +
      "<br>Le site affiche la nouvelle version immédiatement, dès le prochain rafraîchissement.</div>";

    $("#pub-corps").innerHTML = html;
    $("#pub-confirmer").disabled = !controle.valide;
    $("#pub-confirmer").textContent = "Enregistrer maintenant";
    $("#modale-publier").hidden = false;

    $("#pub-confirmer").onclick = lancerPublication;
  }

  function lancerPublication() {
    var bouton = $("#pub-confirmer");
    bouton.disabled = true;
    var journal = document.createElement("div");
    journal.className = "message message--info";
    journal.innerHTML = '<strong>Enregistrement en cours</strong><span id="pub-etape">Préparation…</span>';
    $("#pub-corps").appendChild(journal);

    BACK.enregistrer(D, function (fait, total, nom) {
      var etape = $("#pub-etape");
      if (etape) etape.textContent = fait + " / " + total + " — " + nom;
    })
      .then(function (menage) {
        original = instantane();
        /* Premier enregistrement d'une base qui était vide : les
           données sont maintenant bien dans Supabase, la bannière
           « Mode consultation » n'a plus lieu d'être. */
        donneesDepuisBase = true;
        D.baseVide = false;
        majEtat();

        var complement = "";
        if (menage && menage.supprimees) {
          complement = "<br><small>" + menage.supprimees +
            " ancienne(s) photo(s) supprimée(s) du stockage.</small>";
        }
        if (menage && menage.echecs && menage.echecs.length) {
          complement += "<br><small>" + menage.echecs.length +
            " ancienne(s) photo(s) n'ont pas pu être supprimées. " +
            "Sans conséquence pour le site : elles occupent seulement de la place. " +
            "Elles seront reproposées au prochain enregistrement.</small>";
        }

        journal.className = "message message--ok";
        journal.innerHTML =
          "<strong>Enregistré</strong>Le site est à jour. " +
          'Ouvrez <a href="/index.html" target="_blank" rel="noopener">le site</a> pour vérifier.' +
          complement;
        bouton.textContent = "Fermer";
        bouton.disabled = false;
        bouton.onclick = function () { $("#modale-publier").hidden = true; rendre(); };
        toast("Modifications enregistrées");
      })
      .catch(function (err) {
        journal.className = "message message--erreur";

        if (err && err.conflit) {
          /* Conflit : rien n'a été écrit. On propose l'unique action
             sensée — recharger — plutôt qu'un « Réessayer » qui
             écraserait le travail de l'autre appareil. */
          journal.innerHTML =
            "<strong>Enregistrement annulé — le site a changé ailleurs</strong>" +
            esc(err.message) +
            "<br><br><strong>Aucune modification n'a été perdue côté base.</strong> " +
            "Vos changements sont toujours affichés à l'écran : notez-les avant de recharger.";
          bouton.disabled = false;
          bouton.textContent = "Recharger les données du site";
          bouton.onclick = function () {
            if (!confirm("Recharger effacera vos modifications non enregistrées.\nContinuer ?")) return;
            $("#modale-publier").hidden = true;
            charger();
          };
          toast("Le site a été modifié ailleurs — rien n'a été écrasé", true);
          return;
        }

        journal.innerHTML = "<strong>Échec de l'enregistrement</strong>" + esc(err.message) +
          "<br>Vos modifications sont toujours là : vous pouvez réessayer.";
        bouton.disabled = false;
        bouton.textContent = "Réessayer";
        bouton.onclick = lancerPublication;
        toast("L'enregistrement a échoué", true);
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
    else if (vueCourante === "galerie") { vue.innerHTML = vueGalerie(); brancherGalerie(); }
    else if (vueCourante === "temoignages") { vue.innerHTML = vueTemoignages(); brancherTemoignages(); }
    else if (vueCourante === "affiche") { vue.innerHTML = vueAffiche(); brancherAffiche(); }
    else if (vueCourante === "connexion") { vue.innerHTML = vueConnexion(); brancherConnexion(); }

    if (vueCourante !== "connexion") {
      var banniere = banniereEtat();
      if (banniere) vue.insertAdjacentHTML("afterbegin", banniere);
    }
    majEtat();
    mesurerEnTete();
  }

  /* Bascule vers un écran donné, aussi bien depuis le menu que
     depuis le code (par exemple pour emmener à la connexion). */
  function allerA(vue) {
    vueCourante = vue;
    $all(".adm-nav__item").forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-vue") === vue);
    });
    rendre();
    window.scrollTo(0, 0);
  }

  function initNavigation() {
    $all(".adm-nav__item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        allerA(btn.getAttribute("data-vue"));
      });
    });

    $("#tiroir-fermer").addEventListener("click", fermerEditeur);
    $("#tiroir-annuler").addEventListener("click", fermerEditeur);
    $("#adm-overlay").addEventListener("click", fermerEditeur);
    $("#tiroir-valider").addEventListener("click", function () {
      if (validerProduit()) { fermerEditeur(); toast("Produit validé — cliquez sur « Enregistrer » pour mettre le site à jour"); }
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

    /* L'en-tête change de hauteur selon la largeur de l'écran et la
       longueur de l'état affiché : on la mesure au lieu de la deviner. */
    mesurerEnTete();
    if (window.ResizeObserver) {
      new ResizeObserver(mesurerEnTete).observe($(".adm-header"));
    } else {
      window.addEventListener("resize", mesurerEnTete);
    }

    if (!BACK.estConnecte()) {
      vueCourante = "connexion";
      $all(".adm-nav__item").forEach(function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-vue") === "connexion");
      });
    }
    charger();
  });
})();
