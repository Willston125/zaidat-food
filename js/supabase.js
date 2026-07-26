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

  function creerProduit(p) {
    return appel("/rest/v1/produits", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(p),
    }).then(function (d) { return d && d[0]; });
  }

  function majProduit(id, p) {
    return appel("/rest/v1/produits?id=eq." + encodeURIComponent(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(p),
    }).then(function (d) { return d && d[0]; });
  }

  function supprimerProduit(id) {
    return appel("/rest/v1/produits?id=eq." + encodeURIComponent(id), { method: "DELETE" });
  }

  /* ---------- Réglages (textes, contact, horaires…) ---------- */

  function lireReglages() {
    return appel("/rest/v1/reglages?select=cle,valeur").then(function (lignes) {
      var o = {};
      (lignes || []).forEach(function (l) { o[l.cle] = l.valeur; });
      return o;
    });
  }

  /* `upsert` : crée la clé si absente, la remplace sinon */
  function enregistrerReglage(cle, valeur) {
    return appel("/rest/v1/reglages", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ cle: cle, valeur: valeur }),
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

  function supprimerPhoto(nomFichier) {
    return assurerJetonValide()
      .then(function () {
        return fetch(base() + "/storage/v1/object/" + config().bucket + "/" + nomFichier, {
          method: "DELETE",
          headers: entetes(),
        });
      })
      .catch(function () { /* sans gravité : la photo devient orpheline */ });
  }

  /* Vérifie que l'adresse et la clé fonctionnent vraiment */
  function tester() {
    return appel("/rest/v1/produits?select=id&limit=1")
      .then(function () { return { ok: true }; })
      .catch(function (e) { return { ok: false, message: e.message }; });
  }

  return {
    estConfigure: estConfigure,
    estConnecte: estConnecte,
    emailConnecte: emailConnecte,
    connexion: connexion,
    deconnexion: deconnexion,
    lireProduits: lireProduits,
    creerProduit: creerProduit,
    majProduit: majProduit,
    supprimerProduit: supprimerProduit,
    lireReglages: lireReglages,
    enregistrerReglage: enregistrerReglage,
    televerserPhoto: televerserPhoto,
    supprimerPhoto: supprimerPhoto,
    urlPublique: urlPublique,
    tester: tester,
  };
})();
