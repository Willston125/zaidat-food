/* AUDIT 2 — « ce que je change n est pas mis a jour » : et si l enregistrement
   marchait mais que le site public affichait encore l ancienne version ? */
const A = require('../outils/supabase-simule.js');

(async () => {
  const browser = await A.chromium.launch({ executablePath: A.EXE });

  /* ---------- 1. Le site public voit-il un tarif change ? ---------- */
  console.log('\n=== 1. Le site public reflete-t-il un tarif change en base ? ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await A.ouvrir(browser, etat);
    /* Premiere visite : le cache local se remplit */
    await p.goto(A.BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(2500);
    const prixVu1 = await p.evaluate(() =>
      Array.from(document.querySelectorAll('.card')).map(e => e.innerText.replace(/\s+/g,' ')).slice(0,3));
    console.log('    1re visite : ' + JSON.stringify(prixVu1).slice(0, 200));
    const cacheRempli = await p.evaluate(() => !!localStorage.getItem('zaidat_donnees_v1'));
    A.tv('le cache local se remplit a la premiere visite', cacheRempli);

    /* La cuisiniere change le tarif en base */
    etat.base[0].prix = 4242;
    etat.base[0].modifie_le = new Date().toISOString();

    /* Deuxieme visite */
    await p.goto(A.BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(600);
    const tot = await p.evaluate(() => document.body.innerText);
    const vuImmediatement = /4\s?242/.test(tot);
    await p.waitForTimeout(3000);
    const totApres = await p.evaluate(() => document.body.innerText);
    const vuApres = /4\s?242/.test(totApres);
    console.log('    apres 0,6 s : ' + (vuImmediatement ? 'nouveau tarif' : 'ancien tarif (cache)') +
                '  |  apres 3,6 s : ' + (vuApres ? 'nouveau tarif' : 'ANCIEN TARIF'));
    A.tv('LE NOUVEAU TARIF FINIT PAR S AFFICHER SANS VIDER LE CACHE', vuApres,
         vuImmediatement ? 'immediat' : 'apres rafraichissement silencieux');
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 2. Un produit ajoute apparait-il sur le site ? ---------- */
  console.log('\n=== 2. Un produit ajoute en base apparait-il sur le site ? ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await A.ouvrir(browser, etat);
    await p.goto(A.BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(2500);
    const n1 = await p.evaluate(() => document.querySelectorAll('.card').length);

    etat.base.push(A.ligne(9, { slug: 'nouveaute-audit', nom: 'Nouveaute audit', prix: 3333 }));
    await p.goto(A.BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(3500);
    const n2 = await p.evaluate(() => document.querySelectorAll('.card').length);
    const visible = await p.evaluate(() => /Nouveaute audit/.test(document.body.innerText));
    A.tv('LE NOUVEAU PRODUIT APPARAIT SUR LE SITE', visible && n2 === n1 + 1, n1 + ' -> ' + n2 + ' cartes');
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 3. Deux enregistrements de suite ---------- */
  console.log('\n=== 3. Deux enregistrements successifs (faux conflit ?) ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await A.ouvrir(browser, etat);
    await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await A.connecter(p);
    await p.click('.adm-nav__item[data-vue="produits"]');
    await p.waitForTimeout(500);

    for (const [tour, prix] of [[1, 5551], [2, 5552]]) {
      await p.click('.adm-produit[data-index="0"] [data-action="modifier"]');
      await p.waitForTimeout(400);
      await p.fill('#p-prix', String(prix));
      await p.dispatchEvent('#p-prix', 'input');
      await p.click('#tiroir-valider');
      await p.waitForTimeout(400);
      const r = await A.enregistrer(p);
      const conflit = /modifi[ée] ailleurs|conflit/i.test((r.corps || '') + (r.toast || ''));
      const enBase = etat.base.find(l => l.id === 'id-1');
      A.tv('enregistrement n' + tour + ' accepte sans faux conflit', !conflit,
           'prix en base = ' + (enBase ? enBase.prix : '?'));
      if (!r.modale) break;
      await p.evaluate(() => { document.querySelector('#modale-publier').hidden = true; });
      await p.waitForTimeout(300);
    }
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 4. Supprimer, dupliquer, reordonner ---------- */
  console.log('\n=== 4. Supprimer / dupliquer / reordonner ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await A.ouvrir(browser, etat);
    p.on('dialog', d => d.accept());
    await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await A.connecter(p);
    await p.click('.adm-nav__item[data-vue="produits"]');
    await p.waitForTimeout(500);

    /* Dupliquer */
    const avantDup = await p.evaluate(() => document.querySelectorAll('.adm-produit').length);
    await p.click('.adm-produit[data-index="0"] [data-action="dupliquer"]');
    await p.waitForTimeout(500);
    const apresDup = await p.evaluate(() => document.querySelectorAll('.adm-produit').length);
    A.tv('la duplication ajoute bien une ligne', apresDup === avantDup + 1, avantDup + ' -> ' + apresDup);

    /* Descendre le premier */
    const ordreAvant = await p.evaluate(() =>
      Array.from(document.querySelectorAll('.adm-produit__nom')).map(e => e.textContent).slice(0,3));
    await p.click('.adm-produit[data-index="0"] [data-action="descendre"]');
    await p.waitForTimeout(500);
    const ordreApres = await p.evaluate(() =>
      Array.from(document.querySelectorAll('.adm-produit__nom')).map(e => e.textContent).slice(0,3));
    A.tv('le bouton descendre change l ordre', JSON.stringify(ordreAvant) !== JSON.stringify(ordreApres),
         JSON.stringify(ordreAvant.slice(0,2)) + ' -> ' + JSON.stringify(ordreApres.slice(0,2)));

    /* Supprimer le dernier */
    const avantSup = await p.evaluate(() => document.querySelectorAll('.adm-produit').length);
    await p.click('.adm-produit:last-child [data-action="supprimer"]');
    await p.waitForTimeout(600);
    const apresSup = await p.evaluate(() => document.querySelectorAll('.adm-produit').length);
    A.tv('la suppression retire bien une ligne', apresSup === avantSup - 1, avantSup + ' -> ' + apresSup);

    const nBaseAvant = etat.base.length;
    const r = await A.enregistrer(p, 5000);
    console.log('    modale : ' + JSON.stringify(r.corps || r).slice(0, 250));
    A.tv('LA BASE REFLETE LES CHANGEMENTS', etat.base.length === apresSup,
         'dashboard ' + apresSup + ' produits / base ' + nBaseAvant + ' -> ' + etat.base.length);
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  await browser.close();
  process.exit(A.bilan('AUDIT 2 — apres enregistrement') ? 1 : 0);
})();
