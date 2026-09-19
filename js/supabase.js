/* =========================================================
   ZAIDAT FOOD — Client Supabase (sans librairie externe)
   ---------------------------------------------------------
   Supabase expose une API HTTP toute simple : on peut donc s'en
   servir avec `fetch`, sans charger de bibliothèque depuis un CDN.
   Le site reste léger et ne dépend d'aucun service tiers pour
   s'afficher — ce qui compte sur une connexion mobile limitée.

   Trois usages :
     • lecture publique  : produits et textes affichés sur le site
     • authentification  : connexion de la cuisinière au dashboard
     • écriture          : uniquement une fois connectée
   ========================================================= */

window.SB = (function () {
  "use strict";

  var CLE_SESSION = "zaidat_session_v1";

  function config() {
    return typeof SUPABASE_CONFIG !== "undefined" ? SUPABASE_CONFIG : null;
  }

  function estConfigure() {
    var c = config();
    return !!(c && c.url && c.anonKey);
  }

  function base() {
    return String(config().url).replace(/\/+$/, "");
  }

  /* ---------- Session (conservée dans ce navigateur) ----------
     Le stockage du navigateur est la mémoire longue : c'est lui qui
     permet de rester connectée d'un jour sur l'autre. Il peut être
     refusé (navigation privée de certains navigateurs, cookies tiers
     bloqués, quota plein) et `setItem` lève alors une exception. La
     session est donc aussi gardée en mémoire : elle sera perdue au
     rechargement, ce qui reste très préférable à une déconnexion au
     milieu d'un enregistrement. */

  var sessionMemoire = null;

  function lireSession() {
    try {
      var brut = localStorage.getItem(CLE_SESSION);
      if (brut) {
        var s = JSON.parse(brut);
        if (s) return s;
      }
    } catch (e) { /* stockage refusé, ou contenu illisible */ }
    return sessionMemoire;
  }

  function ecrireSession(s) {
    sessionMemoire = s || null;
    try {
      if (s) localStorage.setItem(CLE_SESSION, JSON.stringify(s));
      else localStorage.removeItem(CLE_SESSION);
    } catch (e) { /* on garde au moins la session en mémoire */ }
  }

  /* Session réellement terminée : le jeton de rafraîchissement n'est
     plus valable, il n'y a rien à sauver. À n'appeler QUE dans ce
     cas — voir `erreurSession` plus bas. */
  function terminerSession() {
    ecrireSession(null);
    oublierAutorisation();
  }

  function estConnecte() {
    var s = lireSession();
    return !!(s && s.access_token);
  }

  function emailConnecte() {
    var s = lireSession();
    return s && s.user ? s.user.email : null;
  }

  /* En-têtes : la clé publique identifie le projet, le jeton
     identifie la personne connectée (absent = simple visiteur). */
  function entetes(extra) {
    var c = config();
    var s = lireSession();
    var h = {
      apikey: c.anonKey,
      Authorization: "Bearer " + (s && s.access_token ? s.access_token : c.anonKey),
    };
    Object.keys(extra || {}).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  /* Date d'expiration inscrite dans le jeton lui-même (champ `exp`).
     Renvoie 0 si elle est illisible : on considère alors le jeton
     comme périmé, ce qui déclenche un renouvellement inoffensif. */
  function expirationJeton() {
    var s = lireSession();
    if (!s || !s.access_token) return 0;
    try {
      var charge = s.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      while (charge.length % 4) charge += "=";
      return (JSON.parse(atob(charge)).exp || 0) * 1000;
    } catch (e) {
      return 0;
    }
  }

  /* Marge avant expiration : on renouvelle le jeton un peu en avance
     plutôt que de découvrir qu'il est périmé au milieu d'un envoi.
     Cinq minutes, parce qu'une photo d'affiche (1080 × 1920) part en
     une seule requête et qu'une connexion mobile lente peut mettre
     plus de deux minutes à la téléverser. */
  var MARGE_EXPIRATION = 300000;

  /* Garantit un jeton encore valide AVANT d'envoyer quoi que ce soit.
     Indispensable pour les photos : un envoi part en une seule fois,
     et Supabase refuse un jeton périmé avec « exp claim check failed ». */
  /* Horodatage du dernier échec passager, et durée pendant laquelle
     on ne réessaie pas. Un enregistrement enchaîne des dizaines de
     requêtes : sans ce répit, chacune rejouerait la même panne et
     l'attente se multiplierait par le nombre de produits. */
  var echecRenouvellement = 0;
  var REPIT_ECHEC = 15000;

  function assurerJetonValide() {
    if (!estConnecte()) return Promise.resolve();
    var expire = expirationJeton();
    var maintenant = Date.now();
    if (maintenant < expire - MARGE_EXPIRATION) return Promise.resolve();
    /* Le jeton reste utilisable encore un moment (5 s de garde, le
       temps que la requête parte) et un renouvellement vient
       d'échouer : on part avec le jeton actuel sans réessayer. */
    if (maintenant - echecRenouvellement < REPIT_ECHEC && maintenant < expire - 5000) {
      return Promise.resolve();
    }
    return rafraichir().catch(function (e) {
      if (e && !e.sessionFinie) {
        echecRenouvellement = Date.now();
        /* Renouvellement impossible pour une raison passagère, mais le
           jeton actuel n'est pas encore périmé : on part avec lui plutôt
           que de bloquer un enregistrement qui aurait parfaitement
           abouti. C'est tout l'intérêt de renouveler en avance. */
        if (Date.now() < expire - 5000) return null;
      }
      return traiterEchecRenouvellement(e);
    });
  }

  /* Un échec de renouvellement n'a pas toujours le même sens, et
     confondre les deux cas coûte une déconnexion :

       • le serveur refuse le jeton de rafraîchissement (400 ou 401) :
         la session est réellement finie, il faut se reconnecter ;
       • le réseau a lâché, ou Supabase a répondu 429 / 500 : la
         session est intacte. L'effacer déconnecterait la cuisinière
         pour une coupure de trois secondes, au milieu d'un
         enregistrement, sans aucun moyen de revenir en arrière.

     `sessionFinie` porte cette distinction jusqu'aux appelants. */
  function erreurSession(message, finie) {
    var e = new Error(message);
    e.sessionFinie = !!finie;
    return e;
  }

  /* Seule une session réellement finie est effacée. Sur une coupure,
     le jeton de rafraîchissement est conservé : la tentative suivante
     repartira de là, sans reconnexion. */
  function traiterEchecRenouvellement(e) {
    if (e && e.sessionFinie) {
      terminerSession();
      throw new Error("Votre session a expiré. Reconnectez-vous, vos modifications sont conservées.");
    }
    throw new Error(
      "Connexion au serveur perdue. Réessayez dans un instant — " +
      "vous êtes toujours connectée et vos modifications sont conservées."
    );
  }

  /* Un jeton expire au bout d'une heure : on le renouvelle en
     silence pour que la cuisinière ne soit pas déconnectée.

     UN SEUL renouvellement à la fois. Le jeton de rafraîchissement
     est à usage unique : Supabase en délivre un nouveau et invalide
     l'ancien. Or le dashboard part sur plusieurs requêtes en
     parallèle — produits et réglages au chargement, textes et
     catégories à l'enregistrement. Sans ce garde-fou elles
     présentent toutes le MÊME jeton : la première le consomme, les
     autres se font refuser, et une session parfaitement valide est
     effacée. C'était la cause des déconnexions au retour sur le
     dashboard. Tous les appels partagent donc la même promesse. */
  var renouvellement = null;

  function rafraichir() {
    if (renouvellement) return renouvellement;

    var s = lireSession();
    if (!s || !s.refresh_token) {
      return Promise.reject(erreurSession("Session absente", true));
    }

    var promesse = envoyerRenouvellement(s.refresh_token, 1);
    renouvellement = promesse;
    function liberer() { if (renouvellement === promesse) renouvellement = null; }
    promesse.then(liberer, liberer);
    return promesse;
  }

  function attendre(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /* Une coupure réseau mérite une seconde tentative : sur une
     connexion mobile, la première échoue parfois sans raison. Un
     jeton refusé, lui, ne le sera pas moins au deuxième essai.

     Réessayer vite n'est pas un hasard : si la première requête a
     abouti côté serveur mais que la réponse s'est perdue, le jeton
     a déjà été consommé. Supabase tolère qu'on le represente dans
     les secondes qui suivent et renvoie alors la même session. */
  function envoyerRenouvellement(jeton, essaisRestants) {
    return fetch(base() + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: config().anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: jeton }),
    })
      .then(
        function (r) {
          if (r.ok) return r.json();
          /* 400 et 401 : c'est le jeton qui est rejeté. Tout le reste
             (429, 500, 502, 504…) est passager. */
          throw erreurSession(
            "Renouvellement refusé (" + r.status + ")",
            r.status === 400 || r.status === 401
          );
        },
        function () { throw erreurSession("Serveur injoignable", false); }
      )
      .then(function (d) {
        if (!d || !d.access_token) throw erreurSession("Réponse inattendue", false);
        ecrireSession(d);
        echecRenouvellement = 0;
        return d;
      })
      .catch(function (e) {
        if (!e.sessionFinie && essaisRestants > 0) {
          return attendre(1500).then(function () {
            return envoyerRenouvellement(jeton, essaisRestants - 1);
          });
        }
        throw e;
      });
  }

  /* Appel générique : réessaie une fois après renouvellement du jeton */
  function appel(chemin, options, dejaReessaye) {
    var o = options || {};
    /* Jeton vérifié en amont : un enregistrement enchaîne des dizaines
       d'appels, et l'heure d'expiration peut tomber au milieu. */
    return assurerJetonValide().then(function () {
      return fetch(base() + chemin, {
        method: o.method || "GET",
        headers: entetes(o.headers),
        body: o.body,
      });
    }).then(function (r) {
      if (r.status === 401 && estConnecte() && !dejaReessaye) {
        /* Le gestionnaire d'échec est passé en second argument, et non
           dans un `.catch` : sinon il attraperait aussi les erreurs du
           nouvel appel et ferait passer un refus de la base pour une
           session expirée. */
        return rafraichir().then(
          function () { return appel(chemin, options, true); },
          traiterEchecRenouvellement
        );
      }
      if (!r.ok) {
        return r.text().then(function (t) {
          var msg = t;
          try { msg = JSON.parse(t).message || JSON.parse(t).error_description || t; } catch (e) {}
          throw new Error(msg || ("Erreur " + r.status));
        });
      }
      if (r.status === 204) return null;
      var type = r.headers.get("content-type") || "";
      return type.indexOf("application/json") !== -1 ? r.json() : r.text();
    });
  }

  /* ---------- Autorisation ----------
     Être connectée ne suffit pas à modifier le site : encore
     faut-il figurer dans la table `administrateurs` de la base.
     Cette distinction est le cœur de la sécurité — sans elle,
     n'importe quel compte créé librement pourrait tout réécrire.
     Le résultat est mis en cache le temps de la session pour ne
     pas interroger la base à chaque clic. */

  var cacheAdmin = { jeton: null, valeur: null };

  function estAdministrateur() {
    if (!estConnecte()) return Promise.resolve(false);
    var s = lireSession();
    if (cacheAdmin.jeton === s.access_token && cacheAdmin.valeur !== null) {
      return Promise.resolve(cacheAdmin.valeur);
    }
    return appel("/rest/v1/rpc/est_administrateur", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then(function (r) {
        var v = r === true || r === "true";
        cacheAdmin = { jeton: s.access_token, valeur: v };
        return v;
      })
      .catch(function () {
        /* Fonction absente (script SQL pas encore relancé) : on se
           rabat sur la lecture de sa propre ligne, autorisée par la
           règle « lecture de son propre acces ». */
        return appel("/rest/v1/administrateurs?select=id&limit=1")
          .then(function (lignes) {
            var v = Array.isArray(lignes) && lignes.length > 0;
            cacheAdmin = { jeton: s.access_token, valeur: v };
            return v;
          })
          .catch(function () { return false; });
      });
  }

  function oublierAutorisation() {
    cacheAdmin = { jeton: null, valeur: null };
  }

  /* Message unique, pour ne pas laisser croire à une panne quand
     il s'agit en réalité d'un droit manquant. */
  var MSG_NON_ADMIN =
    "Ce compte n'est pas autorisé à modifier le site. " +
    "Demandez à ce qu'il soit déclaré administrateur dans Supabase " +
    "(voir admin/GUIDE_DASHBOARD.md).";

  /* ---------- Authentification ---------- */

  function connexion(email, motDePasse) {
    return fetch(base() + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: config().anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: motDePasse }),
    })
      .then(function (r) {
        if (r.ok) return r.json();
        return r.json().then(function (d) {
          var m = d.error_description || d.msg || d.message || "";
          if (/invalid/i.test(m)) throw new Error("Email ou mot de passe incorrect.");
          throw new Error(m || "Connexion impossible.");
        });
      })
      .then(function (d) { ecrireSession(d); return d; });
  }

  function deconnexion() {
    var s = lireSession();
    ecrireSession(null);
    oublierAutorisation();
    if (!s || !s.access_token) return Promise.resolve();
    return fetch(base() + "/auth/v1/logout", {
      method: "POST",
      headers: { apikey: config().anonKey, Authorization: "Bearer " + s.access_token },
    }).catch(function () { /* la session locale est déjà effacée */ });
  }

  /* ---------- Produits ---------- */

  function lireProduits() {
    return appel("/rest/v1/produits?select=*&order=ordre.asc,cree_le.asc");
  }

  /* Signature légère de l'état de la base : sert à détecter qu'un
     autre appareil a enregistré depuis le chargement (voir backend.js).

     La colonne `modifie_le` est ajoutée par admin/supabase-installation.sql.
     Si elle manque, c'est que le script n'a pas été relancé : on le dit
     clairement plutôt que de laisser passer une erreur technique
     incompréhensible — ou, pire, de continuer sans garde-fou. */
  function lireVersions() {
    return appel("/rest/v1/produits?select=id,slug,modifie_le").catch(function (e) {
      if (/modifie_le/.test(e.message || "")) {
        throw new Error(
          "La base n'est pas à jour : la colonne « modifie_le » est absente. " +
          "Relancez le script admin/supabase-installation.sql en entier dans le " +
          "SQL Editor de Supabase, puis rechargez cette page. " +
          "(Cette colonne protège vos données contre l'écrasement par un autre appareil.)"
        );
      }
      throw e;
    });
  }

  /* IMPORTANT — une écriture refusée par les règles de sécurité ne
     produit PAS d'erreur HTTP : PostgREST renvoie simplement zéro
     ligne modifiée. Sans la vérification ci-dessous, le dashboard
     annoncerait « Enregistré » alors que rien n'a changé. */
  function creerProduit(p) {
    return appel("/rest/v1/produits", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(p),
    }).then(function (d) {
      if (!d || !d[0]) throw new Error(MSG_NON_ADMIN);
      return d[0];
    });
  }

  function majProduit(id, p) {
    return appel("/rest/v1/produits?id=eq." + encodeURIComponent(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(p),
    }).then(function (d) {
      if (!d || !d[0]) throw new Error(MSG_NON_ADMIN);
      return d[0];
    });
  }

  function supprimerProduit(id) {
    return appel("/rest/v1/produits?id=eq." + encodeURIComponent(id), {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    }).then(function (d) {
      if (!d || !d[0]) throw new Error(MSG_NON_ADMIN);
      return d[0];
    });
  }

  /* ---------- Réglages (textes, contact, horaires…) ---------- */

  function lireReglages() {
    return appel("/rest/v1/reglages?select=cle,valeur").then(function (lignes) {
      var o = {};
      (lignes || []).forEach(function (l) { o[l.cle] = l.valeur; });
      return o;
    });
  }

  /* `upsert` : crée la clé si absente, la remplace sinon.
     `return=representation` n'est pas décoratif : c'est lui qui
     permet de constater que la ligne a réellement été écrite. */
  function enregistrerReglage(cle, valeur) {
    return appel("/rest/v1/reglages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({ cle: cle, valeur: valeur }),
    }).then(function (d) {
      if (!d || !d[0]) throw new Error(MSG_NON_ADMIN);
      return d[0];
    });
  }

  /* ---------- Photos ---------- */

  /* `blob` vient du recadrage : une image déjà redimensionnée et
     compressée, pour ne pas envoyer 4 Mo depuis un téléphone. */
  function televerserPhoto(blob, nomFichier, dejaReessaye) {
    var c = config();
    var chemin = c.bucket + "/" + nomFichier;

    /* Le jeton est vérifié avant l'envoi, puis une seconde chance est
       laissée si Supabase le refuse quand même (horloges décalées). */
    return assurerJetonValide()
      .then(function () {
        return fetch(base() + "/storage/v1/object/" + chemin, {
          method: "POST",
          headers: entetes({ "Content-Type": blob.type || "image/jpeg", "x-upsert": "true" }),
          body: blob,
        });
      })
      .then(function (r) {
        if (r.ok) return urlPublique(nomFichier);

        return r.text().then(function (t) {
          var perime = r.status === 401 || r.status === 403 ||
            /exp.*claim|jwt expired|Unauthorized/i.test(t);
          if (perime && estConnecte() && !dejaReessaye) {
            return rafraichir().then(
              function () { return televerserPhoto(blob, nomFichier, true); },
              traiterEchecRenouvellement
            );
          }
          throw new Error("Envoi de la photo impossible : " + t);
        });
      });
  }

  function urlPublique(nomFichier) {
    return base() + "/storage/v1/object/public/" + config().bucket + "/" + nomFichier;
  }

  /* Chemin de stockage à partir d'une adresse publique.
     « https://…/object/public/photos/produits/x-900-ab.jpg »
       -> « produits/x-900-ab.jpg »
     Renvoie null si l'adresse ne vient pas de NOTRE dossier de
     photos : on ne supprime jamais un fichier qu'on ne reconnaît
     pas, et surtout pas d'après une adresse arbitraire. */
  function cheminDepuisUrl(url) {
    if (!url) return null;
    var prefixe = base() + "/storage/v1/object/public/" + config().bucket + "/";
    var u = String(url);
    if (u.indexOf(prefixe) !== 0) return null;
    var chemin = u.slice(prefixe.length).split("?")[0];
    /* Mêmes dossiers que ceux autorisés par les règles de la base. */
    if (!/^(produits|lifestyle|galerie|affiches)\/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|jpeg|png|webp)$/i.test(chemin)) {
      return null;
    }
    return chemin;
  }

  /* Supprime une photo du stockage. Contrairement à la version
     précédente, l'échec n'est plus avalé en silence : l'appelant
     décide quoi en faire (un nettoyage raté ne doit jamais faire
     perdre la nouvelle photo, mais il doit être signalé). */
  function supprimerPhoto(nomFichier) {
    if (!nomFichier) return Promise.resolve({ ok: false, raison: "chemin vide" });
    return assurerJetonValide()
      .then(function () {
        return fetch(base() + "/storage/v1/object/" + config().bucket + "/" + nomFichier, {
          method: "DELETE",
          headers: entetes(),
        });
      })
      .then(function (r) {
        if (r.ok) return { ok: true };
        return r.text().then(function (t) {
          return { ok: false, raison: t || ("Erreur " + r.status) };
        });
      })
      .catch(function (e) { return { ok: false, raison: e.message }; });
  }

  return {
    estConfigure: estConfigure,
    estConnecte: estConnecte,
    estAdministrateur: estAdministrateur,
    oublierAutorisation: oublierAutorisation,
    emailConnecte: emailConnecte,
    connexion: connexion,
    deconnexion: deconnexion,
    lireProduits: lireProduits,
    lireVersions: lireVersions,
    creerProduit: creerProduit,
    majProduit: majProduit,
    supprimerProduit: supprimerProduit,
    lireReglages: lireReglages,
    enregistrerReglage: enregistrerReglage,
    televerserPhoto: televerserPhoto,
    supprimerPhoto: supprimerPhoto,
    cheminDepuisUrl: cheminDepuisUrl,
    urlPublique: urlPublique,
  };
})();
