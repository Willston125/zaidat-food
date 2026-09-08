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

  /* ---------- Session (conservée dans ce navigateur) ---------- */

  function lireSession() {
    try {
      return JSON.parse(localStorage.getItem(CLE_SESSION)) || null;
    } catch (e) {
      return null;
    }
  }

  function ecrireSession(s) {
    if (s) localStorage.setItem(CLE_SESSION, JSON.stringify(s));
    else localStorage.removeItem(CLE_SESSION);
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

  /* Garantit un jeton encore valide AVANT d'envoyer quoi que ce soit.
     Indispensable pour les photos : un envoi part en une seule fois,
     et Supabase refuse un jeton périmé avec « exp claim check failed ».
     Marge de 2 minutes, le temps que l'envoi aboutisse. */
  function assurerJetonValide() {
    if (!estConnecte()) return Promise.resolve();
    if (Date.now() < expirationJeton() - 120000) return Promise.resolve();
    return rafraichir().catch(function () {
      ecrireSession(null);
      throw new Error("Votre session a expiré. Reconnectez-vous, vos modifications sont conservées.");
    });
  }

  /* Un jeton expire au bout d'une heure : on le renouvelle en
     silence pour que la cuisinière ne soit pas déconnectée. */
  function rafraichir() {
    var s = lireSession();
    if (!s || !s.refresh_token) return Promise.reject(new Error("Session absente"));
    return fetch(base() + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: config().anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("Session expirée")); })
      .then(function (d) { ecrireSession(d); return d; });
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
        return rafraichir()
          .then(function () { return appel(chemin, options, true); })
          .catch(function () {
            ecrireSession(null);
            throw new Error("Votre session a expiré, reconnectez-vous.");
          });
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
            return rafraichir()
              .then(function () { return televerserPhoto(blob, nomFichier, true); })
              .catch(function () {
                ecrireSession(null);
                throw new Error("Votre session a expiré. Reconnectez-vous, puis renvoyez la photo.");
              });
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
    if (!/^(produits|lifestyle|galerie)\/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|jpeg|png|webp)$/i.test(chemin)) {
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
