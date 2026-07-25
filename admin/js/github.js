/* =========================================================
   ZAIDAT FOOD — Dashboard : liaison avec GitHub
   ---------------------------------------------------------
   Lit et écrit les fichiers du dépôt via l'API GitHub.

   La publication passe par la « Git Data API » plutôt que par
   l'API Contents : elle permet d'envoyer TOUS les fichiers
   (données + images) dans UN SEUL commit. Le site n'est donc
   jamais dans un état incohérent, par exemple un produit qui
   référencerait une photo pas encore envoyée.

   La clé d'accès reste dans ce navigateur (localStorage) et
   n'est transmise qu'à api.github.com.
   ========================================================= */

window.GH = (function () {
  "use strict";

  var API = "https://api.github.com";
  var CLE_STOCKAGE = "zaidat_admin_github";

  /* ---------- Réglages de connexion ---------- */
  function lireReglages() {
    try {
      return JSON.parse(localStorage.getItem(CLE_STOCKAGE)) || {};
    } catch (e) {
      return {};
    }
  }

  function ecrireReglages(r) {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(r));
  }

  function effacerReglages() {
    localStorage.removeItem(CLE_STOCKAGE);
  }

  function estConnecte() {
    var r = lireReglages();
    return !!(r.token && r.owner && r.repo);
  }

  /* ---------- Appel générique ---------- */
  function appel(chemin, options) {
    var r = lireReglages();
    var opts = options || {};
    var entetes = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (r.token) entetes.Authorization = "Bearer " + r.token;
    if (opts.body) entetes["Content-Type"] = "application/json";

    return fetch(API + chemin, {
      method: opts.method || "GET",
      headers: entetes,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      if (res.status === 401) throw new Error("Clé d'accès refusée. Vérifiez qu'elle est correcte et non expirée.");
      if (res.status === 403) throw new Error("Accès interdit. La clé n'a probablement pas le droit d'écriture sur ce dépôt.");
      if (res.status === 404) throw new Error("Introuvable : vérifiez le nom du compte et du dépôt (" + chemin + ").");
      if (!res.ok) {
        return res.json().then(
          function (j) { throw new Error("GitHub : " + (j.message || res.status)); },
          function () { throw new Error("GitHub a renvoyé une erreur " + res.status + "."); }
        );
      }
      if (res.status === 204) return null;
      return res.json();
    });
  }

  function base() {
    var r = lireReglages();
    return "/repos/" + encodeURIComponent(r.owner) + "/" + encodeURIComponent(r.repo);
  }

  function branche() {
    return lireReglages().branch || "main";
  }

  /* ---------- Vérification de la connexion ---------- */
  function verifier() {
    return appel(base()).then(function (depot) {
      return {
        nom: depot.full_name,
        prive: depot.private,
        brancheParDefaut: depot.default_branch,
        peutEcrire: !!(depot.permissions && depot.permissions.push),
      };
    });
  }

  /* ---------- Lecture d'un fichier texte ---------- */
  function lireFichier(chemin) {
    return appel(base() + "/contents/" + chemin + "?ref=" + encodeURIComponent(branche()))
      .then(function (f) {
        /* atob ne gère que le latin-1 : on repasse par UTF-8 */
        var binaire = atob(f.content.replace(/\n/g, ""));
        var octets = new Uint8Array(binaire.length);
        for (var i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
        return { texte: new TextDecoder("utf-8").decode(octets), sha: f.sha };
      });
  }

  /* ---------- Publication atomique ----------
     fichiers = [{ chemin, contenu }]  (contenu = texte)
     images   = [{ chemin, base64 }]   (base64 = données binaires encodées)   */
  function publier(fichiers, images, message, surAvancement) {
    var avance = surAvancement || function () {};
    var b = base();
    var ref = "heads/" + branche();
    var shaCommitParent, shaArbreParent;

    avance("Lecture de l'état actuel du dépôt…");

    return appel(b + "/git/ref/" + ref)
      .then(function (r) {
        shaCommitParent = r.object.sha;
        return appel(b + "/git/commits/" + shaCommitParent);
      })
      .then(function (commit) {
        shaArbreParent = commit.tree.sha;

        /* Les images partent en blobs binaires ; les fichiers texte
           sont envoyés directement dans l'arbre. */
        var total = (images || []).length;
        var faits = 0;
        var envois = (images || []).map(function (img) {
          return appel(b + "/git/blobs", {
            method: "POST",
            body: { content: img.base64, encoding: "base64" },
          }).then(function (blob) {
            faits++;
            avance("Envoi des photos… " + faits + "/" + total);
            return { path: img.chemin, mode: "100644", type: "blob", sha: blob.sha };
          });
        });

        if (total) avance("Envoi des photos… 0/" + total);
        return Promise.all(envois);
      })
      .then(function (elementsImages) {
        avance("Préparation de la mise à jour…");
        var elementsTexte = (fichiers || []).map(function (f) {
          return { path: f.chemin, mode: "100644", type: "blob", content: f.contenu };
        });
        return appel(b + "/git/trees", {
          method: "POST",
          body: { base_tree: shaArbreParent, tree: elementsTexte.concat(elementsImages) },
        });
      })
      .then(function (arbre) {
        avance("Enregistrement…");
        return appel(b + "/git/commits", {
          method: "POST",
          body: { message: message, tree: arbre.sha, parents: [shaCommitParent] },
        });
      })
      .then(function (commit) {
        avance("Publication…");
        return appel(b + "/git/refs/" + ref, {
          method: "PATCH",
          body: { sha: commit.sha, force: false },
        }).then(function () {
          return { sha: commit.sha.slice(0, 7), url: commit.html_url };
        });
      });
  }

  /* ---------- Dernière publication, pour l'afficher dans le tableau de bord ---------- */
  function dernierCommit() {
    return appel(base() + "/commits/" + encodeURIComponent(branche())).then(function (c) {
      return {
        message: c.commit.message.split("\n")[0],
        date: c.commit.author.date,
        auteur: c.commit.author.name,
        sha: c.sha.slice(0, 7),
      };
    });
  }

  return {
    lireReglages: lireReglages,
    ecrireReglages: ecrireReglages,
    effacerReglages: effacerReglages,
    estConnecte: estConnecte,
    verifier: verifier,
    lireFichier: lireFichier,
    publier: publier,
    dernierCommit: dernierCommit,
  };
})();
