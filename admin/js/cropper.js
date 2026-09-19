/* =========================================================
   ZAIDAT FOOD — Dashboard : recadrage des photos
   ---------------------------------------------------------
   Tout se passe dans le navigateur : aucune photo n'est envoyée
   ailleurs tant que vous ne publiez pas.

   Le cadre n'est pas toujours carré. Les photos de produits le
   sont (c'est le format des vignettes du menu), les affiches sont
   verticales comme une story Instagram. Le format demandé arrive
   dans `options.formats` ; le cadre à l'écran s'y adapte, et
   chaque taille est produite en refaisant le rendu depuis la photo
   d'origine plutôt qu'en agrandissant l'aperçu.
   ========================================================= */

window.Cropper = (function () {
  "use strict";

  /* Produits et galerie : 900 px pour la fiche, 450 px pour la vignette. */
  var FORMATS_CARRES = [
    { taille: 900, largeur: 900, hauteur: 900 },
    { taille: 450, largeur: 450, hauteur: 450 },
  ];
  var QUALITE = 0.82;

  /* Charge un fichier choisi par l'utilisateur en objet Image */
  function chargerFichier(fichier) {
    return new Promise(function (resoudre, rejeter) {
      if (!/^image\//.test(fichier.type)) {
        rejeter(new Error("Ce fichier n'est pas une image."));
        return;
      }
      var lecteur = new FileReader();
      lecteur.onerror = function () { rejeter(new Error("Lecture du fichier impossible.")); };
      lecteur.onload = function () {
        var img = new Image();
        img.onload = function () { resoudre(img); };
        img.onerror = function () { rejeter(new Error("Cette image ne peut pas être ouverte.")); };
        img.src = lecteur.result;
      };
      lecteur.readAsDataURL(fichier);
    });
  }

  /* ---------------------------------------------------------
     Éditeur de recadrage attaché à un conteneur.
     Le conteneur affiche la photo dans le cadre demandé ;
     on la déplace à la souris ou au doigt, on zoome au curseur.
     --------------------------------------------------------- */
  function creer(conteneur, image, options) {
    var formats = (options && options.formats) || FORMATS_CARRES;
    var refL = formats[0].largeur;
    var refH = formats[0].hauteur;
    /* Un cadre vertical occupe beaucoup de hauteur : on le laisse
       moins large pour qu'il tienne dans la fenêtre sans défilement. */
    var largeurMax = refH > refL ? 300 : 460;

    conteneur.innerHTML =
      '<div class="crop-stage" tabindex="0" aria-label="Zone de recadrage : faites glisser pour déplacer la photo">' +
      '<canvas class="crop-canvas"></canvas>' +
      '<div class="crop-guides" aria-hidden="true"></div>' +
      "</div>" +
      '<div class="crop-tools">' +
      '<label class="crop-zoom"><span>Zoom</span>' +
      '<input type="range" class="crop-zoom-input" min="100" max="300" value="100" aria-label="Zoom de la photo"></label>' +
      '<button type="button" class="btn-mini crop-reset">Recentrer</button>' +
      "</div>";

    var scene = conteneur.querySelector(".crop-stage");
    var canvas = conteneur.querySelector(".crop-canvas");
    var ctx = canvas.getContext("2d");
    var zoomInput = conteneur.querySelector(".crop-zoom-input");

    scene.style.setProperty("--crop-ratio", refL + " / " + refH);
    scene.style.setProperty("--crop-max", largeurMax + "px");

    var etat = { zoom: 1, dx: 0, dy: 0 };
    var cadreL = 0, cadreH = 0; /* cadre affiché, en pixels écran */

    function dimensionner() {
      cadreL = Math.max(120, Math.min(scene.clientWidth || largeurMax, largeurMax));
      cadreH = Math.round(cadreL * refH / refL);
      var ratio = window.devicePixelRatio || 1;
      canvas.width = cadreL * ratio;
      canvas.height = cadreH * ratio;
      canvas.style.width = cadreL + "px";
      canvas.style.height = cadreH + "px";
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      dessiner();
    }

    /* Échelle minimale pour que la photo couvre tout le cadre */
    function echelleCouvrante() {
      return Math.max(cadreL / image.naturalWidth, cadreH / image.naturalHeight);
    }

    /* Empêche de laisser apparaître du vide sur les bords */
    function borner() {
      var e = echelleCouvrante() * etat.zoom;
      var l = image.naturalWidth * e;
      var h = image.naturalHeight * e;
      var maxX = Math.max(0, (l - cadreL) / 2);
      var maxY = Math.max(0, (h - cadreH) / 2);
      etat.dx = Math.max(-maxX, Math.min(maxX, etat.dx));
      etat.dy = Math.max(-maxY, Math.min(maxY, etat.dy));
    }

    function dessiner() {
      borner();
      var e = echelleCouvrante() * etat.zoom;
      var l = image.naturalWidth * e;
      var h = image.naturalHeight * e;
      ctx.clearRect(0, 0, cadreL, cadreH);
      ctx.drawImage(image, (cadreL - l) / 2 + etat.dx, (cadreH - h) / 2 + etat.dy, l, h);
    }

    /* Déplacement à la souris et au doigt */
    var glisse = false, xDepart = 0, yDepart = 0, dxDepart = 0, dyDepart = 0;
    function debut(x, y) { glisse = true; xDepart = x; yDepart = y; dxDepart = etat.dx; dyDepart = etat.dy; }
    function bouge(x, y) {
      if (!glisse) return;
      etat.dx = dxDepart + (x - xDepart);
      etat.dy = dyDepart + (y - yDepart);
      dessiner();
    }
    function fin() { glisse = false; }

    scene.addEventListener("pointerdown", function (ev) {
      scene.setPointerCapture(ev.pointerId);
      debut(ev.clientX, ev.clientY);
    });
    scene.addEventListener("pointermove", function (ev) { bouge(ev.clientX, ev.clientY); });
    scene.addEventListener("pointerup", fin);
    scene.addEventListener("pointercancel", fin);

    /* Déplacement au clavier, pour un réglage fin */
    scene.addEventListener("keydown", function (ev) {
      var pas = ev.shiftKey ? 20 : 5;
      var touches = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] };
      if (touches[ev.key]) {
        ev.preventDefault();
        etat.dx += touches[ev.key][0];
        etat.dy += touches[ev.key][1];
        dessiner();
      }
    });

    zoomInput.addEventListener("input", function () {
      etat.zoom = parseInt(zoomInput.value, 10) / 100;
      dessiner();
    });

    conteneur.querySelector(".crop-reset").addEventListener("click", function () {
      etat.zoom = 1; etat.dx = 0; etat.dy = 0;
      zoomInput.value = 100;
      dessiner();
    });

    /* Le conteneur peut changer de taille (ouverture d'un panneau, rotation) */
    if (window.ResizeObserver) {
      new ResizeObserver(dimensionner).observe(scene);
    } else {
      window.addEventListener("resize", dimensionner);
    }
    dimensionner();

    /* ----- Production des JPEG finaux -----
       On refait le rendu à la taille cible plutôt que d'agrandir
       l'aperçu : la netteté est celle de la photo d'origine.      */
    function exporter() {
      return formats.map(function (f) {
        var c = document.createElement("canvas");
        c.width = f.largeur; c.height = f.hauteur;
        var g = c.getContext("2d");
        g.imageSmoothingQuality = "high";
        /* fond blanc : évite le noir si la photo a de la transparence */
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, f.largeur, f.hauteur);

        var facteur = f.largeur / cadreL;
        var e = echelleCouvrante() * etat.zoom * facteur;
        var l = image.naturalWidth * e;
        var h = image.naturalHeight * e;
        g.drawImage(image,
          (f.largeur - l) / 2 + etat.dx * facteur,
          (f.hauteur - h) / 2 + etat.dy * facteur,
          l, h);

        return {
          taille: f.taille,
          largeur: f.largeur,
          hauteur: f.hauteur,
          dataURL: c.toDataURL("image/jpeg", QUALITE),
        };
      });
    }

    return { exporter: exporter };
  }

  /* Retire l'en-tête "data:image/jpeg;base64," avant l'envoi */
  function base64Seul(dataURL) {
    return dataURL.substring(dataURL.indexOf(",") + 1);
  }

  /* Poids approximatif d'une image encodée, en Ko */
  function poidsKo(dataURL) {
    return Math.round(base64Seul(dataURL).length * 0.75 / 1024);
  }

  /* Story Instagram : 1080 × 1920, et une version allégée pour
     les connexions lentes. */
  var FORMATS_AFFICHE = [
    { taille: 1080, largeur: 1080, hauteur: 1920 },
    { taille: 540, largeur: 540, hauteur: 960 },
  ];

  return {
    chargerFichier: chargerFichier,
    creer: creer,
    poidsKo: poidsKo,
    FORMATS_CARRES: FORMATS_CARRES,
    FORMATS_AFFICHE: FORMATS_AFFICHE,
  };
})();
