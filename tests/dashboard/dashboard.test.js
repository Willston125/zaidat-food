const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8123';
const EXE = require('../outils/navigateur').EXE;
const PROJET = 'dhhhdlthsxvscantcyir.supabase.co';

let ok = 0, ko = 0;
function tv(nom, cond, detail) {
  if (cond) { ok++; console.log('  OK    ' + nom + (detail ? '  [' + detail + ']' : '')); }
  else { ko++; console.log('  ECHEC ' + nom + (detail ? '  [' + detail + ']' : '')); }
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
    ordre: i, modifie_le: '2026-09-01T10:00:0' + i + '+00:00',
  }, extra);
}

/* Faux serveur Supabase, pilotable depuis les tests */
function creerServeur(etat) {
  return async (route) => {
    const req = route.request();
    const url = req.url();
    const methode = req.method();
    etat.appels.push(methode + ' ' + url.replace('https://' + PROJET, ''));

    if (etat.hs) { await route.abort('connectionrefused'); return; }

    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.includes('/auth/v1/token')) {
      const charge = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      return json({ access_token: 'a.' + charge + '.b', refresh_token: 'r',
                    user: { email: etat.email } });
    }
    if (url.includes('/rpc/est_administrateur')) return json(etat.admin);
    if (url.includes('/rest/v1/administrateurs')) return json(etat.admin ? [{ id: 'u1' }] : []);
    if (url.includes('/rest/v1/reglages')) {
      if (methode === 'POST') {
        if (!etat.admin) return json([]);          // RLS : 0 ligne, sans erreur
        etat.reglagesEcrits.push(JSON.parse(req.postData()));
        return json([{ cle: 'x' }]);
      }
      return json([]);
    }
    if (url.includes('/rest/v1/produits')) {
      if (methode === 'GET') return json(etat.lignes);
      if (!etat.admin) return json([]);            // RLS : 0 ligne, sans erreur
      if (methode === 'POST') { etat.crees.push(JSON.parse(req.postData())); return json([{ id: 'neuf' }]); }
      if (methode === 'PATCH') { etat.modifies.push(url); return json([{ id: 'maj' }]); }
      if (methode === 'DELETE') { etat.supprimes.push(url); return json([{ id: 'sup' }]); }
    }
    if (url.includes('/storage/v1/object/')) {
      if (methode === 'DELETE') { etat.photosSupprimees.push(url.split('/photos/')[1]); return json({}); }
      return json({ Key: 'ok' });
    }
    return json({});
  };
}

async function ouvrir(browser, etat, viewport = { width: 1440, height: 900 }) {
  const c = await browser.newContext({ viewport });
  await c.route('**://' + PROJET + '/**', creerServeur(etat));
  const p = await c.newPage();
  const erreurs = [];
  p.on('pageerror', e => erreurs.push(e.message));
  p.on('console', m => {
    if (m.type() !== 'error') return;
    /* Un chargement de ressource refuse n'est pas une erreur du code :
       c'est exactement ce que « base injoignable » signifie. */
    if (/Failed to load resource/.test(m.text())) return;
    erreurs.push('[console] ' + m.text());
  });
  return { c, p, erreurs };
}

function etatNeuf(over = {}) {
  return Object.assign({
    admin: true, hs: false, email: 'cuisiniere@zaidat.test',
    lignes: [ligne(1), ligne(2), ligne(3)],
    appels: [], crees: [], modifies: [], supprimes: [], reglagesEcrits: [], photosSupprimees: [],
  }, over);
}

async function connecter(p) {
  await p.click('.adm-nav__item[data-vue="connexion"]');
  await p.waitForTimeout(300);
  await p.fill('#sb-email', 'cuisiniere@zaidat.test');
  await p.fill('#sb-mdp', 'motdepasse');
  await p.click('#sb-connecter');
  await p.waitForTimeout(1200);
}

(async () => {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});

  /* ---------- FIA-5 : base injoignable ---------- */
  console.log('\n=== FIA-5 : dashboard avec Supabase injoignable ===');
  {
    const etat = etatNeuf({ hs: true });
    const { c, p, erreurs } = await ouvrir(browser, etat, { width: 360, height: 740 });
    await p.goto(BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(2500);
    await p.click('.adm-nav__item[data-vue="produits"]');
    await p.waitForTimeout(500);
    const d = await p.evaluate(() => ({
      etat: document.querySelector('#etat-modifs').textContent,
      banniere: (document.querySelector('#adm-vue .message--alerte') || {}).innerText || '',
      produits: document.querySelectorAll('.adm-produit').length,
      figeSurChargement: /Chargement/.test(document.querySelector('#etat-modifs').textContent),
      ecranErreur: /Impossible de charger/.test(document.querySelector('#adm-vue').innerText),
    }));
    console.log('  etat : ' + JSON.stringify(d.etat));
    tv('plus jamais bloque sur « Chargement… »', !d.figeSurChargement, d.etat);
    tv('pas d ecran « Impossible de charger »', !d.ecranErreur);
    tv('les produits restent consultables', d.produits > 0, d.produits + ' produits');
    tv('banniere explicite « base injoignable »', /injoignable/i.test(d.banniere), d.banniere.split('\n')[0]);
    tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | ') || 'aucune');

    // Aucun faux enregistrement possible
    await p.click('.adm-produit[data-index="1"] button[data-action="monter"]');
    await p.waitForTimeout(400);
    const apres = await p.evaluate(() => {
      document.querySelector('#btn-publier').click();
      return { modale: !document.querySelector('#modale-publier').hidden };
    });
    await p.waitForTimeout(600);
    const toast = await p.evaluate(() => document.querySelector('#adm-toast').textContent);
    tv('l enregistrement est refuse, pas simule', !apres.modale, 'modale ouverte: ' + apres.modale);
    tv('message clair a l utilisateur', /injoignable|consultation/i.test(toast), toast);
    await c.close();
  }

  /* ---------- SEC-1 : compte non autorise ---------- */
  console.log('\n=== SEC-1 : compte connecte mais NON administrateur ===');
  {
    const etat = etatNeuf({ admin: false });
    const { c, p, erreurs } = await ouvrir(browser, etat);
    await p.goto(BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await connecter(p);
    const d = await p.evaluate(() => ({
      resultat: (document.querySelector('#sb-resultat') || {}).innerText || '',
      vue: document.querySelector('#adm-vue').innerText,
      toast: document.querySelector('#adm-toast').textContent,
    }));
    tv('connexion acceptee mais ecriture refusee', /non autoris/i.test(d.vue + d.toast), d.toast);
    await p.click('.adm-nav__item[data-vue="produits"]');
    await p.waitForTimeout(400);
    await p.click('.adm-produit[data-index="1"] button[data-action="monter"]');
    await p.waitForTimeout(300);
    await p.click('#btn-publier');
    await p.waitForTimeout(600);
    const bloque = await p.evaluate(() => ({
      modale: !document.querySelector('#modale-publier').hidden,
      toast: document.querySelector('#adm-toast').textContent,
    }));
    tv('publication bloquee', !bloque.modale);
    tv('aucune ecriture envoyee a la base', etat.crees.length === 0 && etat.modifies.length === 0,
       etat.crees.length + ' creations, ' + etat.modifies.length + ' modifications');
    tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | ') || 'aucune');
    await c.close();
  }

  /* ---------- Enregistrement nominal ---------- */
  console.log('\n=== Enregistrement nominal (administratrice) ===');
  {
    const etat = etatNeuf();
    const { c, p, erreurs } = await ouvrir(browser, etat);
    await p.goto(BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1200);
    await connecter(p);
    await p.click('.adm-nav__item[data-vue="produits"]');
    await p.waitForTimeout(400);
    // Modifier un prix via le tiroir
    await p.click('.adm-produit[data-index="0"] button[data-action="modifier"]');
    await p.waitForTimeout(400);
    await p.fill('#p-prix', '2500');
    await p.click('#tiroir-valider');
    await p.waitForTimeout(500);
    await p.click('#btn-publier');
    await p.waitForTimeout(500);
    const pub = await p.evaluate(() => ({
      ouverte: !document.querySelector('#modale-publier').hidden,
      confirmerActif: !document.querySelector('#pub-confirmer').disabled,
      corps: document.querySelector('#pub-corps').innerText,
    }));
    tv('fenetre de publication ouverte', pub.ouverte);
    tv('bouton de confirmation actif', pub.confirmerActif, pub.corps.split('\n')[0]);
    await p.click('#pub-confirmer');
    await p.waitForTimeout(2500);
    const fin = await p.evaluate(() => document.querySelector('#pub-corps').innerText);
    tv('enregistrement reussi', /Enregistr/.test(fin), fin.split('\n').slice(-2).join(' '));
    tv('les 3 produits ont ete ecrits', etat.modifies.length === 3, etat.modifies.length + ' PATCH');
    tv('les reglages ont ete ecrits', etat.reglagesEcrits.length === 2, etat.reglagesEcrits.length);
    const prixEcrit = etat.reglagesEcrits.length && etat.modifies.length;
    tv('aucune suppression intempestive', etat.supprimes.length === 0, etat.supprimes.length + ' DELETE');
    tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | ') || 'aucune');
    await c.close();
  }

  /* ---------- FIA-7 : conflit ---------- */
  console.log('\n=== FIA-7 : un autre appareil a enregistre entre-temps ===');
  {
    const etat = etatNeuf();
    const { c, p, erreurs } = await ouvrir(browser, etat);
    await p.goto(BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1200);
    await connecter(p);
    await p.click('.adm-nav__item[data-vue="produits"]');
    await p.waitForTimeout(400);
    await p.click('.adm-produit[data-index="1"] button[data-action="monter"]');
    await p.waitForTimeout(300);

    // Pendant ce temps, quelqu'un ajoute un produit et modifie un autre
    etat.lignes = [ligne(1, { modifie_le: '2026-09-08T12:00:00+00:00' }), ligne(2), ligne(3), ligne(4)];

    await p.click('#btn-publier');
    await p.waitForTimeout(500);
    await p.click('#pub-confirmer');
    await p.waitForTimeout(2000);
    const d = await p.evaluate(() => ({
      corps: document.querySelector('#pub-corps').innerText,
      bouton: document.querySelector('#pub-confirmer').textContent,
    }));
    console.log('  ' + d.corps.split('\n').slice(0, 2).join(' / '));
    tv('conflit detecte et enregistrement annule', /modifi.*ailleurs/i.test(d.corps), d.corps.split('\n')[0]);
    tv('AUCUNE ecriture envoyee', etat.crees.length === 0 && etat.modifies.length === 0 && etat.supprimes.length === 0,
       `${etat.crees.length} POST, ${etat.modifies.length} PATCH, ${etat.supprimes.length} DELETE`);
    tv('le produit ajoute ailleurs n a PAS ete supprime', etat.supprimes.length === 0);
    tv('proposition de recharger', /Recharger/i.test(d.bouton), d.bouton);
    tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | ') || 'aucune');
    await c.close();
  }

  /* ---------- FIA-6 : nettoyage des photos ---------- */
  console.log('\n=== FIA-6 : photos devenues orphelines ===');
  {
    const etat = etatNeuf();
    const { c, p, erreurs } = await ouvrir(browser, etat);
    await p.goto(BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1200);
    await connecter(p);
    await p.click('.adm-nav__item[data-vue="produits"]');
    await p.waitForTimeout(400);
    // Supprimer le produit 3 : ses deux photos deviennent orphelines
    p.once('dialog', d => d.accept());
    await p.click('.adm-produit[data-index="2"] button[data-action="supprimer"]');
    await p.waitForTimeout(500);
    await p.click('#btn-publier');
    await p.waitForTimeout(500);
    await p.click('#pub-confirmer');
    await p.waitForTimeout(3000);
    const fin = await p.evaluate(() => document.querySelector('#pub-corps').innerText);
    console.log('  photos supprimees : ' + JSON.stringify(etat.photosSupprimees));
    tv('la ligne du produit a bien ete supprimee en base', etat.supprimes.length === 1, etat.supprimes.length);
    tv('les 2 photos orphelines ont ete nettoyees', etat.photosSupprimees.length === 2,
       etat.photosSupprimees.join(', '));
    tv('seules les photos du produit retire sont touchees',
       etat.photosSupprimees.every(x => x.includes('p3-')), etat.photosSupprimees.join(', '));
    tv('le nettoyage est signale a l utilisateur', /photo/i.test(fin), fin.split('\n').slice(-1)[0]);
    tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | ') || 'aucune');
    await c.close();
  }

  /* ---------- IHM-2 et IHM-3 : mobile ---------- */
  console.log('\n=== IHM-2 et IHM-3 : dashboard a 360 px ===');
  {
    const etat = etatNeuf({ lignes: [1,2,3,4,5,6].map(i => ligne(i)) });
    const { c, p, erreurs } = await ouvrir(browser, etat, { width: 360, height: 740 });
    await p.goto(BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1200);
    await connecter(p);
    await p.click('.adm-nav__item[data-vue="produits"]');
    await p.waitForTimeout(500);
    await p.click('.adm-produit[data-index="1"] button[data-action="monter"]');
    await p.waitForTimeout(600);
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await p.waitForTimeout(500);
    const d = await p.evaluate(() => {
      const barre = document.querySelector('#barre-enregistrer').getBoundingClientRect();
      const rows = [...document.querySelectorAll('.adm-produit')];
      const last = rows[rows.length - 1].getBoundingClientRect();
      const nav = document.querySelector('.adm-nav').getBoundingClientRect();
      const head = document.querySelector('.adm-header').getBoundingClientRect();
      const dernierBouton = rows[rows.length - 1].querySelector('button[data-action="modifier"]').getBoundingClientRect();
      // Le bouton du dernier produit est-il reellement cliquable ?
      const cible = document.elementFromPoint(
        dernierBouton.left + dernierBouton.width / 2,
        dernierBouton.top + dernierBouton.height / 2);
      return {
        recouvrementBarre: Math.round(last.bottom - barre.top),
        dernierBoutonAtteignable: !!(cible && cible.closest('.adm-produit__actions')),
        navVisible: Math.round(nav.top - head.bottom),
        navTop: Math.round(nav.top), headBottom: Math.round(head.bottom),
        debordement: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    console.log('  ' + JSON.stringify(d));
    tv('la barre « Enregistrer » ne recouvre plus le dernier produit',
       d.recouvrementBarre <= 0, d.recouvrementBarre + 'px de recouvrement');
    tv('les boutons du dernier produit sont cliquables', d.dernierBoutonAtteignable);
    tv('les onglets restent visibles sous l en-tete',
       d.navVisible >= 0, 'nav a y=' + d.navTop + ', en-tete finit a y=' + d.headBottom);
    tv('aucun debordement horizontal', d.debordement === 0, d.debordement + 'px');
    tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | ') || 'aucune');
    await c.close();
  }

  /* ---------- IHM-4 : trois blocs de textes editables ---------- */
  console.log('\n=== IHM-4 : etapes, engagements et appel final editables ===');
  {
    const etat = etatNeuf();
    const { c, p, erreurs } = await ouvrir(browser, etat);
    await p.goto(BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1200);
    await connecter(p);
    await p.click('.adm-nav__item[data-vue="textes"]');
    await p.waitForTimeout(600);
    const d = await p.evaluate(() => {
      const titres = [...document.querySelectorAll('#adm-vue .bloc h3')].map(h => h.textContent);
      return {
        titres: titres,
        champsEtapes: document.querySelectorAll('[data-couple^="steps.items"]').length,
        champsEngagements: document.querySelectorAll('[data-couple^="promises.items"]').length,
        champCta: !!document.querySelector('[data-config="ctaFinal.title"]'),
      };
    });
    console.log('  blocs : ' + d.titres.join(' | '));
    tv('bloc « Étapes de commande » present', d.titres.includes('Étapes de commande'));
    tv('bloc « Engagements » present', d.titres.includes('Engagements'));
    tv('bloc « Appel final » present', d.titres.includes('Appel final'));
    tv('4 etapes editables (titre + texte)', d.champsEtapes === 8, d.champsEtapes + ' champs');
    tv('5 engagements editables (titre + texte + icone)', d.champsEngagements === 15, d.champsEngagements + ' champs');
    tv('appel final editable', d.champCta);

    // Modifier une etape et verifier que ca part bien en base
    await p.fill('[data-couple="steps.items"][data-i="0"][data-champ="title"]', 'Choisissez vos douceurs');
    await p.waitForTimeout(300);
    await p.click('#btn-publier');
    await p.waitForTimeout(500);
    await p.click('#pub-confirmer');
    await p.waitForTimeout(2500);
    const envoye = etat.reglagesEcrits.find(r => r.cle === 'site');
    tv('la modification part bien dans les reglages',
       envoye && envoye.valeur.steps.items[0].title === 'Choisissez vos douceurs',
       envoye ? envoye.valeur.steps.items[0].title : 'rien envoye');
    tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | ') || 'aucune');
    await c.close();
  }

  await browser.close();
  console.log('\n=== ' + ok + ' reussis, ' + ko + ' echoues ===');
  process.exit(ko ? 1 : 0);
})();
