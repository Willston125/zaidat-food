/* =========================================================
   ZAIDAT FOOD — Affiche d'annonce
   ---------------------------------------------------------
   Une affiche verticale, publiée depuis le dashboard, montrée
   à l'arrivée sur le site : « Gâteaux pour l'Aïd, commandes
   avant jeudi », « Fermé samedi »…

   Trois règles la rendent supportable, et elles comptent autant
   que l'affichage lui-même :

     • une seule fois par visiteur et par affiche. La revoir à
       chaque page ferait fuir quelqu'un qui consulte le menu ;
     • jamais sur la page panier : on n'interrompt pas une
       personne en train de commander ;
     • une date de fin, tenue par le site. Sans elle, l'annonce
       de l'Aïd reste affichée en novembre.

   Elle se ferme à la croix, à l'Échap, ou en cliquant à côté.
   La fermeture automatique est facultative et désactivée par
   défaut : forcer quelqu'un à attendre ne le fait pas lire.
   ========================================================= */

(function () {
  "use strict";

  var CLE_VUES = "zaidat_affiches_vues";
  var DELAI_OUVERTURE = 1200;   /* laisse la page s'afficher d'abord */
  var MAX_MEMOIRE = 8;          /* affiches retenues comme « déjà vues » */

  var dejaOuverte = false;
  var chargementEnCours = false;
  var elements = null;
  var minuteur = null;
  var decompte = null;
  var focusPrecedent = null;

  /* ---------- Mémoire du visiteur ----------
     Conservée dans le navigateur, jamais envoyée nulle part.
     Un navigateur privé ou un stockage refusé renvoie une liste
     vide : l'affiche se montrera de nouveau, ce qui est le bon
     comportement par défaut. */
  function vues() {
    try {
      var brut = JSON.parse(localStorage.getItem(CLE_VUES));
      return Array.isArray(brut) ? brut : [];
    } catch (e) {
      return [];
    }
  }
  function marquerVue(cle) {
    try {
      var liste = vues().filter(function (c) { return c !== cle; });
      liste.push(cle);
      localStorage.setItem(CLE_VUES, JSON.stringify(liste.slice(-MAX_MEMOIRE)));
    } catch (e) { /* stockage indisponible : tant pis, on n'insiste pas */ }
  }

  /* Identifiant d'une affiche, calculé sur son contenu : modifier
     l'image, le texte, le lien ou la date en fait une nouvelle,
     que les visiteurs reverront une fois. */
  function cleAffiche(a) {
    var source = [a.image, a.alt, a.lien, a.finLe].join("|");
    var h = 5381;
    for (var i = 0; i < source.length; i++) {
      h = ((h << 5) + h + source.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
  }

  /* ---------- Faut-il la montrer ? ---------- */
  function aujourdhui() {
    var d = new Date();
    var m = String(d.getMonth() + 1);
    var j = String(d.getDate());
    return d.getFullYear() + "-" + (m.length < 2 ? "0" + m : m) + "-" + (j.length < 2 ? "0" + j : j);
  }

  function pageDeCommande() {
    return /\/commande(\.html)?$/.test(window.location.pathname);
  }

  function aMontrer() {
    if (dejaOuverte || pageDeCommande()) return null;
    if (typeof SITE_CONFIG === "undefined") return null;

    var a = SITE_CONFIG.affiche;
    if (!a || !a.image || a.actif === false) return null;
    /* La date de fin est une date de dernier jour inclus. */
    if (a.finLe && a.finLe < aujourdhui()) return null;
    if (vues().indexOf(cleAffiche(a)) !== -1) return null;
    return a;
  }

  /* ---------- Fermeture ---------- */
  function fermer(a) {
    if (!elements) return;
    clearTimeout(minuteur); minuteur = null;
    clearInterval(decompte); decompte = null;

    document.removeEventListener("keydown", surTouche, true);
    elements.racine.remove();
    document.body.classList.remove("a-affiche-ouverte");
    elements = null;

    marquerVue(cleAffiche(a));
    if (focusPrecedent && document.contains(focusPrecedent)) focusPrecedent.focus();
    focusPrecedent = null;
  }

  /* Échap ferme ; Tab reste prisonnier de l'affiche tant qu'elle
     est ouverte, sinon le clavier part naviguer dans une page
     qu'on ne voit plus. */
  var fermerCourant = null;
  function surTouche(ev) {
    if (!elements) return;
    if (ev.key === "Escape") { ev.preventDefault(); fermerCourant(); return; }
    if (ev.key !== "Tab") return;

    var focusables = elements.boite.querySelectorAll("a[href], button:not([disabled])");
    if (!focusables.length) return;
    var premier = focusables[0];
    var dernier = focusables[focusables.length - 1];
    if (ev.shiftKey && document.activeElement === premier) {
      ev.preventDefault(); dernier.focus();
    } else if (!ev.shiftKey && document.activeElement === dernier) {
      ev.preventDefault(); premier.focus();
    }
  }

  /* ---------- Construction ----------
     Tout est construit par le DOM plutôt que par du HTML assemblé :
     le texte de l'affiche vient de la base, et une chaîne concaténée
     demanderait un échappement de plus à ne pas oublier. */
  function construire(a, image) {
    var racine = document.createElement("div");
    racine.className = "affiche";
    racine.setAttribute("role", "dialog");
    racine.setAttribute("aria-modal", "true");
    racine.setAttribute("aria-label", a.alt || "Annonce de ZAIDAT FOOD");

    var voile = document.createElement("div");
    voile.className = "affiche__voile";
    racine.appendChild(voile);

    var boite = document.createElement("div");
    boite.className = "affiche__boite";

    var visuel;
    if (a.lien) {
      visuel = document.createElement("a");
      visuel.className = "affiche__visuel";
      visuel.href = a.lien;
      /* Suivre le lien vaut pour « vue » : sinon elle réapparaît
         sur la page d'arrivée. */
      visuel.addEventListener("click", function () { marquerVue(cleAffiche(a)); });
    } else {
      visuel = document.createElement("div");
      visuel.className = "affiche__visuel";
    }

    image.className = "affiche__image";
    image.alt = a.alt || "";
    visuel.appendChild(image);
    boite.appendChild(visuel);

    var fermeture = document.createElement("button");
    fermeture.type = "button";
    fermeture.className = "affiche__fermer";
    fermeture.setAttribute("aria-label", "Fermer l'annonce");
    fermeture.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" ' +
      'stroke-width="2.5" stroke-linecap="round"/></svg>';
    boite.appendChild(fermeture);

    var compte = null;
    if (a.fermetureAuto > 0) {
      compte = document.createElement("p");
      compte.className = "affiche__compte";
      /* Annoncé, jamais subi : on dit combien de temps il reste
         plutôt que de faire disparaître l'affiche sans prévenir. */
      compte.textContent = "Fermeture dans " + a.fermetureAuto + " s";
      boite.appendChild(compte);
    }

    racine.appendChild(boite);
    return { racine: racine, boite: boite, voile: voile, fermeture: fermeture, compte: compte };
  }

  function ouvrir(a, image) {
    dejaOuverte = true;
    focusPrecedent = document.activeElement;

    elements = construire(a, image);
    fermerCourant = function () { fermer(a); };

    elements.fermeture.addEventListener("click", fermerCourant);
    elements.voile.addEventListener("click", fermerCourant);
    document.addEventListener("keydown", surTouche, true);

    document.body.appendChild(elements.racine);
    document.body.classList.add("a-affiche-ouverte");
    /* Laisse un rendu passer avant la transition d'entrée. */
    requestAnimationFrame(function () {
      if (elements) elements.racine.classList.add("est-visible");
    });
    elements.fermeture.focus();

    if (a.fermetureAuto > 0) {
      var reste = a.fermetureAuto;
      decompte = setInterval(function () {
        reste -= 1;
        if (elements && elements.compte && reste > 0) {
          elements.compte.textContent = "Fermeture dans " + reste + " s";
        }
      }, 1000);
      minuteur = setTimeout(fermerCourant, a.fermetureAuto * 1000);
    }
  }

  /* ---------- Déclenchement ----------
     L'image est chargée avant l'ouverture : une affiche qui
     apparaît vide puis se remplit est pire que pas d'affiche. */
  function essayer() {
    if (chargementEnCours) return;
    var a = aMontrer();
    if (!a) return;
    chargementEnCours = true;

    var image = new Image();
    image.decoding = "async";
    image.width = 1080;
    image.height = 1920;
    if (a.imagePetite && a.imagePetite !== a.image) {
      image.srcset = a.imagePetite + " 540w, " + a.image + " 1080w";
      image.sizes = "(max-width: 480px) 88vw, 340px";
    }
    image.onload = function () {
      chargementEnCours = false;
      /* La situation a pu changer pendant le chargement. */
      if (aMontrer()) ouvrir(a, image);
    };
    image.onerror = function () {
      chargementEnCours = false;   /* image introuvable : on n'affiche rien */
    };
    image.src = a.image;
  }

  function planifier() {
    setTimeout(essayer, DELAI_OUVERTURE);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", planifier);
  } else {
    planifier();
  }
  /* Le site démarre sur son cache local : l'affiche publiée il y a
     deux minutes n'arrive qu'avec les données fraîches. On repasse
     par `planifier` et non par `essayer` : une base qui répond vite
     faisait surgir l'affiche au bout de deux cents millisecondes,
     par-dessus une page encore en train de se dessiner. */
  if (window.ZF && typeof ZF.surMajDonnees === "function") {
    ZF.surMajDonnees(function () { if (!dejaOuverte) planifier(); });
  }
})();
