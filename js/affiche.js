/* =========================================================
   ZAIDAT FOOD — Affiche d'annonce
   ---------------------------------------------------------
   Une affiche verticale, publiée depuis le dashboard, montrée
   à l'arrivée sur le site : « Gâteaux pour l'Aïd, commandes
   avant jeudi », « Fermé samedi »…

   Quand la revoit-on ? C'est réglé depuis le dashboard, et
   ça compte autant que l'affichage lui-même :

     • un rappel au bout de N minutes (30 par défaut). Une
       annonce vue une fois et jamais revue ne pousse personne
       à commander ; revue à chaque page, elle fait fuir. Le
       délai est le curseur entre les deux ;
     • une relance après un moment de lecture, facultative :
       quelqu'un qui parcourt le menu depuis plusieurs minutes
       sans aller commander hésite, et c'est là que l'annonce
       sert à quelque chose ;
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
  /* Délai compté depuis le chargement de la page, et non depuis le
     moment où l'affiche devient connue : le temps que mettent les
     données à arriver a déjà laissé la page se dessiner. Assez court
     pour que l'affiche paraisse immédiate, assez long pour ne pas
     surgir par-dessus une page à moitié peinte. */
  var DELAI_OUVERTURE = 400;
  var DEBUT = Date.now();
  var MAX_MEMOIRE = 8;          /* affiches retenues comme « déjà vues » */
  var RAPPEL_DEFAUT = 30;       /* minutes, si le dashboard ne dit rien */

  var ouverte = false;          /* à l'écran en ce moment */
  var chargementEnCours = false;
  var forcerUneFois = false;    /* relance : passer outre le rappel, une fois */
  var elements = null;
  var minuteur = null;          /* fermeture automatique */
  var decompte = null;
  var rappel = null;            /* prochaine réouverture */
  var horloge = null;           /* temps de lecture */
  var focusPrecedent = null;

  /* ---------- Mémoire du visiteur ----------
     Conservée dans le navigateur, jamais envoyée nulle part.
     Un navigateur privé ou un stockage refusé renvoie une mémoire
     vide : l'affiche se montrera de nouveau, ce qui est le bon
     comportement par défaut. */
  function vues() {
    try {
      var brut = JSON.parse(localStorage.getItem(CLE_VUES));
      if (Array.isArray(brut)) {
        /* Ancien format : une simple liste de clés, sans date. On les
           tient pour vues il y a très longtemps — le rappel a donc
           déjà expiré et l'affiche se remontre, ce qui est justement
           le comportement voulu désormais. */
        var repris = {};
        brut.forEach(function (c) { if (typeof c === "string") repris[c] = 0; });
        return repris;
      }
      return (brut && typeof brut === "object") ? brut : {};
    } catch (e) {
      return {};
    }
  }

  function marquerVue(cle) {
    if (modeControle()) return;
    try {
      var m = vues();
      m[cle] = Date.now();
      /* On ne retient que les plus récentes : la mémoire d'un
         navigateur n'est pas un journal. */
      var garde = {};
      Object.keys(m)
        .sort(function (x, y) { return m[y] - m[x]; })
        .slice(0, MAX_MEMOIRE)
        .forEach(function (c) { garde[c] = m[c]; });
      localStorage.setItem(CLE_VUES, JSON.stringify(garde));
    } catch (e) { /* stockage indisponible : tant pis, on n'insiste pas */ }
  }

  /* Identifiant d'une affiche, calculé sur son contenu : modifier
     l'image, le texte, le lien ou la date en fait une nouvelle,
     que les visiteurs reverront tout de suite. */
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

  /* « ?affiche=test » : revoir l'affiche alors qu'on l'a déjà vue.
     Sert à la contrôler depuis son propre téléphone sans avoir à vider
     la mémoire du navigateur. Rien d'autre n'est contourné : une
     affiche désactivée ou périmée ne s'affiche pas davantage, sinon le
     contrôle ne prouverait rien. La visite n'est pas retenue non plus,
     pour pouvoir recharger autant de fois qu'on veut. */
  function modeControle() {
    return /[?&]affiche=test\b/.test(window.location.search);
  }

  function affiche() {
    if (typeof SITE_CONFIG === "undefined") return null;
    var a = SITE_CONFIG.affiche;
    if (!a || !a.image || a.actif === false) return null;
    /* La date de fin est une date de dernier jour inclus. */
    if (a.finLe && a.finLe < aujourdhui()) return null;
    return a;
  }

  /* Délai avant de la revoir, en millisecondes. 0 : une seule fois. */
  function rappelMs(a) {
    var m = Number(a.rappelMinutes);
    if (!isFinite(m) || m < 0) m = RAPPEL_DEFAUT;
    return Math.round(m) * 60000;
  }

  function aMontrer() {
    if (ouverte || pageDeCommande()) return null;
    var a = affiche();
    if (!a) return null;

    if (!modeControle() && !forcerUneFois) {
      var vue = vues()[cleAffiche(a)];
      if (vue !== undefined) {
        var attente = rappelMs(a);
        if (!attente) return null;                    /* une seule fois */
        if (Date.now() - vue < attente) return null;  /* pas encore l'heure */
      }
    }
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
    ouverte = false;

    marquerVue(cleAffiche(a));
    if (focusPrecedent && document.contains(focusPrecedent)) focusPrecedent.focus();
    focusPrecedent = null;

    programmerRappel(a);
  }

  /* Prochaine réouverture, sans attendre un rechargement de page :
     quelqu'un qui reste une demi-heure sur le menu doit la revoir
     comme celui qui revient le soir. */
  function programmerRappel(a) {
    clearTimeout(rappel); rappel = null;
    var attente = rappelMs(a);
    if (!attente) return;
    /* Une pincée de marge : le rappel se déclenche APRÈS l'échéance,
       jamais un battement de cœur avant. */
    rappel = setTimeout(essayer, attente + 250);
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
    ouverte = true;
    forcerUneFois = false;
    clearTimeout(rappel); rappel = null;
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
     L'image est chargée AVANT l'ouverture — une affiche qui apparaît
     vide puis se remplit est pire que pas d'affiche — mais le délai
     d'ouverture court en même temps : les deux attentes se recouvrent
     au lieu de s'additionner. */
  function essayer() {
    if (chargementEnCours) return;
    var a = aMontrer();
    if (!a) return;
    chargementEnCours = true;

    var image = new Image();
    image.decoding = "async";
    image.width = 1080;
    image.height = 1920;

    var chargee = false;
    var delaiEcoule = false;
    function ouvrirSiPret() {
      if (!chargee || !delaiEcoule) return;
      chargementEnCours = false;
      /* La situation a pu changer pendant le chargement. */
      if (aMontrer()) { ouvrir(a, image); affinerImage(a, image); }
    }

    var reste = Math.max(0, DELAI_OUVERTURE - (Date.now() - DEBUT));
    setTimeout(function () { delaiEcoule = true; ouvrirSiPret(); }, reste);

    image.onload = function () { chargee = true; ouvrirSiPret(); };
    image.onerror = function () {
      chargementEnCours = false;   /* image introuvable : on n'affiche rien */
    };
    /* La boîte fait 340 px de large au plus : la version allégée
       (540 × 960, quelques dizaines de Ko) y est déjà nette et arrive
       bien plus vite que la grande. C'est elle qu'on attend. */
    image.src = a.imagePetite || a.image;
  }

  /* Remplace l'aperçu léger par la pleine résolution, et seulement si
     l'écran en profite : l'élément a déjà sa taille définitive, rien
     ne bouge. Sur un écran ordinaire, la grande n'est pas téléchargée
     du tout. */
  function affinerImage(a, image) {
    if (!a.image || a.image === (a.imagePetite || a.image)) return;
    var largeur = Math.min(340, window.innerWidth * 0.88);
    if (largeur * (window.devicePixelRatio || 1) <= 560) return;
    var grande = new Image();
    grande.onload = function () { if (elements) image.src = a.image; };
    grande.src = a.image;
  }

  /* ---------- Relance après un moment de lecture ----------
     Quelqu'un qui parcourt le menu depuis plusieurs minutes sans aller
     commander hésite. On ne compte que le temps où l'onglet est
     réellement à l'écran, et on exige qu'il ait défilé au moins une
     fois : sinon une page oubliée en arrière-plan déclencherait toute
     seule, sur quelqu'un qui n'est pas là. */
  var tempsLecture = 0;          /* temps déjà passé à l'écran, figé */
  var depuis = 0;                /* début de la période visible en cours */
  var aDefile = false;

  /* Le temps se mesure à l'horloge, et non en comptant les battements
     d'un `setInterval` : un navigateur ralentit ses minuteries quand
     l'onglet passe en arrière-plan, et compter les tours donnerait
     trois minutes là où il s'en est écoulé dix. */
  function lecture() {
    return tempsLecture + (depuis ? Date.now() - depuis : 0);
  }

  function suivreLecture() {
    if (horloge || pageDeCommande()) return;
    var a = affiche();
    if (!a) return;
    var minutes = Number(a.relanceDefilement);
    if (!isFinite(minutes) || minutes <= 0) return;
    var seuil = Math.round(minutes) * 60000;

    window.addEventListener("scroll", function () { aDefile = true; }, { passive: true });

    depuis = document.visibilityState === "hidden" ? 0 : Date.now();
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        if (depuis) { tempsLecture += Date.now() - depuis; depuis = 0; }
      } else if (!depuis) {
        depuis = Date.now();
      }
    });

    horloge = setInterval(function () {
      if (ouverte || !aDefile || lecture() < seuil) return;
      clearInterval(horloge); horloge = null;
      /* Relance : elle passe outre le rappel en cours, une seule fois. */
      forcerUneFois = true;
      essayer();
    }, 1000);
  }

  function demarrer() {
    essayer();
    suivreLecture();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", demarrer);
  } else {
    demarrer();
  }
  /* Le site démarre sur son cache local : l'affiche publiée il y a
     deux minutes n'arrive qu'avec les données fraîches. Le délai
     d'ouverture étant compté depuis le chargement de la page, il est
     déjà écoulé à ce moment-là : rien ne s'additionne. */
  if (window.ZF && typeof ZF.surMajDonnees === "function") {
    ZF.surMajDonnees(demarrer);
  }
})();
