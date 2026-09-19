/* Socle commun de l'audit : faux Supabase pilotable + ouverture du dashboard. */
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8123';
const EXE = require('../outils/navigateur').EXE;
const PROJET = 'dhhhdlthsxvscantcyir.supabase.co';

let ok = 0, ko = 0;
const constats = [];
function tv(nom, cond, detail) {
  if (cond) { ok++; console.log('  OK    ' + nom + (detail ? '  [' + detail + ']' : '')); }
  else { ko++; console.log('  ECHEC ' + nom + (detail ? '  [' + detail + ']' : '')); constats.push(nom + (detail ? ' — ' + detail : '')); }
  return !!cond;
}
function bilan(titre) {
  console.log('\n=== ' + titre + ' : ' + ok + ' reussis, ' + ko + ' echoues ===');
  if (constats.length) { console.log('\nCONSTATS :'); constats.forEach((c, i) => console.log('  ' + (i + 1) + '. ' + c)); }
  return ko;
}

/* Jeton d'acces credible : seul son champ `exp` est lu par le site. */
function jeton(secondes) {
  const charge = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + secondes })).toString('base64url');
  return 'a.' + charge + '.b';
}

/* Etat d'authentification facultatif, a joindre a `etatNeuf` pour que
   le faux serveur applique la regle du jeton a usage unique. */
function authNeuve(over = {}) {
  return Object.assign({ courant: 'r0', appels: 0, refus: 0, forcer: null }, over);
}

function ligne(i, extra = {}) {
  return Object.assign({
    id: 'id-' + i, slug: 'produit-' + i, nom: 'Produit ' + i,
    description_courte: 'court ' + i, description: 'long ' + i,
    prix: 1000 + i, categorie: 'snacks',
    image_produit: 'https://' + PROJET + '/storage/v1/object/public/photos/produits/p' + i + '-900-a.jpg',
    image_produit_petite: 'https://' + PROJET + '/storage/v1/object/public/photos/produits/p' + i + '-450-a.jpg',
    image_lifestyle: '', image_lifestyle_petite: '',
    disponible: true, en_avant: false, populaire: false, options: [],
    ordre: i - 1, modifie_le: '2026-09-01T10:00:0' + i + '+00:00',
  }, extra);
}

/* Faux Supabase. `etat.base` se comporte comme une vraie table :
   ce qui y est ecrit est relu ensuite, pour verifier de bout en bout. */
function creerServeur(etat) {
  return async (route) => {
    const req = route.request();
    const url = req.url().replace('https://' + PROJET, '');
    const methode = req.method();
    etat.appels.push(methode + ' ' + url);
    if (etat.hs) { await route.abort('connectionrefused'); return; }
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.includes('/auth/v1/token')) {
      /* Sans `etat.auth`, l'authentification dit toujours oui : c'est
         ce dont les autres suites ont besoin. Avec, elle se comporte
         comme le vrai GoTrue — le jeton de rafraichissement ne sert
         QU'UNE FOIS, le represente vaut « Already Used ». */
      const a = etat.auth;
      if (a && url.includes('grant_type=refresh_token')) {
        a.appels++;
        if (a.forcer) { a.refus++; return json({ message: 'panne simulee' }, a.forcer); }
        const envoye = (JSON.parse(req.postData() || '{}') || {}).refresh_token;
        if (envoye !== a.courant) {
          a.refus++;
          return json({ error: 'invalid_grant',
                        error_description: 'Invalid Refresh Token: Already Used' }, 400);
        }
        a.courant = 'r' + a.appels;
      }
      return json({ access_token: jeton(3600),
                    refresh_token: (a && a.courant) || 'r', user: { email: etat.email } });
    }
    if (url.includes('/rpc/est_administrateur')) return json(etat.admin);
    if (url.includes('/rest/v1/administrateurs')) return json(etat.admin ? [{ id: 'u1' }] : []);

    if (url.includes('/rest/v1/reglages')) {
      if (methode === 'POST') {
        if (!etat.admin) return json([]);
        const c = JSON.parse(req.postData());
        (Array.isArray(c) ? c : [c]).forEach(r => { etat.reglages[r.cle] = r.valeur; });
        return json([{ cle: 'x' }]);
      }
      return json(Object.keys(etat.reglages).map(k => ({ cle: k, valeur: etat.reglages[k] })));
    }

    if (url.includes('/rest/v1/produits')) {
      if (methode === 'GET') return json(etat.base);
      if (!etat.admin) return json([]);           /* RLS : 0 ligne, sans erreur HTTP */
      if (methode === 'POST') {
        const c = JSON.parse(req.postData());
        const neuf = Object.assign({ id: 'neuf-' + (++etat.compteur), modifie_le: new Date().toISOString() }, c);
        etat.base.push(neuf);
        return json([neuf]);
      }
      if (methode === 'PATCH') {
        const id = decodeURIComponent((url.match(/id=eq\.([^&]+)/) || [])[1] || '');
        const c = JSON.parse(req.postData());
        const l = etat.base.find(x => x.id === id);
        if (l) {
          /* Journalise ce qui differe reellement : sinon on devine. */
          const diff = Object.keys(c).filter(k => JSON.stringify(l[k]) !== JSON.stringify(c[k]))
            .map(k => k + ': ' + JSON.stringify(l[k]) + ' -> ' + JSON.stringify(c[k]));
          etat.diffs.push({ id, diff });
          Object.assign(l, c, { modifie_le: new Date().toISOString() }); return json([l]);
        }
        return json([]);
      }
      if (methode === 'DELETE') {
        const id = decodeURIComponent((url.match(/id=eq\.([^&]+)/) || [])[1] || '');
        const i = etat.base.findIndex(x => x.id === id);
        if (i >= 0) { const [l] = etat.base.splice(i, 1); return json([l]); }
        return json([]);
      }
    }
    if (url.includes('/storage/v1/object/')) {
      if (methode === 'DELETE') { etat.photosSupprimees.push(url.split('/photos/')[1]); return json({}); }
      return json({ Key: 'ok' });
    }
    return json({});
  };
}

function etatNeuf(over = {}) {
  return Object.assign({
    admin: true, hs: false, email: 'cuisiniere@zaidat.test',
    base: [ligne(1), ligne(2), ligne(3)],
    reglages: {}, compteur: 0,
    appels: [], photosSupprimees: [], diffs: [],
  }, over);
}

async function ouvrir(browser, etat, viewport = { width: 1440, height: 900 }) {
  const c = await browser.newContext({ viewport });
  await c.route('**://' + PROJET + '/**', creerServeur(etat));
  const p = await c.newPage();
  const erreurs = [];
  p.on('pageerror', e => erreurs.push(e.message));
  p.on('console', m => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(m.text())) return;
    erreurs.push('[console] ' + m.text());
  });
  return { c, p, erreurs };
}

async function connecter(p, email) {
  await p.click('.adm-nav__item[data-vue="connexion"]');
  await p.waitForTimeout(300);
  await p.fill('#sb-email', email || 'cuisiniere@zaidat.test');
  await p.fill('#sb-mdp', 'motdepasse');
  await p.click('#sb-connecter');
  await p.waitForTimeout(1200);
}

/* Clique « Enregistrer » puis confirme, et renvoie ce que la modale raconte. */
async function enregistrer(p, attente = 3000) {
  /* Un bouton grise ne se clique pas : c'est un resultat en soi. */
  const grise = await p.evaluate(() => document.querySelector('#btn-publier').disabled);
  if (grise) {
    return { boutonGrise: true, modale: false,
             titre: await p.evaluate(() => document.querySelector('#btn-publier').title),
             etat: await p.evaluate(() => document.querySelector('#etat-modifs').textContent) };
  }
  await p.click('#btn-publier');
  await p.waitForTimeout(600);
  const modaleOuverte = await p.evaluate(() => !document.querySelector('#modale-publier').hidden);
  if (!modaleOuverte) {
    return { modale: false, toast: await p.evaluate(() => (document.querySelector('#adm-toast') || {}).textContent || ''),
             vue: await p.evaluate(() => (document.querySelector('.adm-nav__item.is-active') || {}).textContent || '') };
  }
  const bloque = await p.evaluate(() => document.querySelector('#pub-confirmer').disabled);
  if (bloque) {
    return { modale: true, bloque: true, corps: await p.evaluate(() => document.querySelector('#pub-corps').innerText) };
  }
  await p.click('#pub-confirmer');
  /* On attend la fin REELLE (le bouton repasse a « Fermer » ou l'echec
     s'affiche), pas une duree arbitraire : sinon toute mesure de temps
     ne mesure que l'attente qu'on s'est imposee. */
  try {
    await p.waitForFunction(() => {
      const b = document.querySelector('#pub-confirmer');
      const j = document.querySelector('#pub-corps');
      return (b && !b.disabled && /Fermer|Recharger|Reessayer|Réessayer/.test(b.textContent))
          || (j && /message--ok|message--erreur/.test(j.innerHTML));
    }, { timeout: attente });
  } catch (e) { /* delai depasse : on rend l'etat tel quel */ }
  await p.waitForTimeout(150);
  return { modale: true, bloque: false,
           corps: await p.evaluate(() => document.querySelector('#pub-corps').innerText),
           toast: await p.evaluate(() => (document.querySelector('#adm-toast') || {}).textContent || '') };
}

module.exports = { chromium, BASE, EXE, PROJET, tv, bilan, ligne, etatNeuf, ouvrir, connecter, enregistrer,
                   jeton, authNeuve, compteurs: () => ({ ok, ko }) };
