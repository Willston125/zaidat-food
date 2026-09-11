/* AUDIT 9 — Listes, retraits, session expiree. */
const A = require('../outils/supabase-simule.js');
const PHOTO = require('path').join(__dirname, '..', 'media', 'photo.jpg');

async function dash(browser, etat, vue) {
  const { c, p, erreurs } = await A.ouvrir(browser, etat);
  p.on('dialog', d => d.accept());
  await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await A.connecter(p);
  if (vue) { await p.click('.adm-nav__item[data-vue="' + vue + '"]'); await p.waitForTimeout(700); }
  return { c, p, erreurs };
}

(async () => {
  const browser = await A.chromium.launch({ executablePath: A.EXE });

  /* ---------- 1. Listes (zones de livraison, engagements…) ---------- */
  for (const vue of ['contact', 'textes']) {
    console.log('\n=== 1. Listes de l ecran « ' + vue + ' » ===');
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await dash(browser, etat, vue);
    const n = await p.evaluate(() => document.querySelectorAll('[data-ajout-liste]').length);
    if (!n) { console.log('    (aucune liste sur cet ecran)'); await c.close(); continue; }
    console.log('    ' + n + ' liste(s) sur cet ecran');

    const avant = await p.evaluate(() => document.querySelectorAll('[data-liste]').length);
    await p.click('[data-ajout-liste]');
    await p.waitForTimeout(500);
    const apres = await p.evaluate(() => document.querySelectorAll('[data-liste]').length);
    A.tv('« ajouter une ligne » ajoute bien une ligne (' + vue + ')', apres === avant + 1, avant + ' -> ' + apres);

    await p.click('[data-liste]');
    await p.keyboard.type('LIGNE AUDIT', { delay: 30 });
    await p.waitForTimeout(400);
    const etatBarre = await p.evaluate(() => document.querySelector('#etat-modifs').textContent);
    A.tv('la saisie dans une liste est signalee (' + vue + ')', /non enregistr/i.test(etatBarre), etatBarre);

    const r = await A.enregistrer(p, 8000);
    A.tv('LA LIGNE ARRIVE EN BASE (' + vue + ')',
         JSON.stringify(etat.reglages).includes('LIGNE AUDIT'),
         r.boutonGrise ? 'bouton grise' : 'enregistre');
    A.tv('aucune erreur JavaScript (' + vue + ')', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* Les retraits (galerie, temoignages) sont couverts par l audit 10,
     avec les selecteurs reels du balisage. */

  /* ---------- 4. Session expiree pendant le travail ---------- */
  console.log('\n=== 4. La session expire pendant que je travaille ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await dash(browser, etat, 'produits');
    await p.click('.adm-produit[data-index="0"] [data-action="modifier"]');
    await p.waitForTimeout(400);
    await p.fill('#p-prix', '4321');
    await p.dispatchEvent('#p-prix', 'input');
    await p.click('#tiroir-valider');
    await p.waitForTimeout(500);

    /* Le jeton devient invalide cote serveur */
    etat.admin = false;
    const r = await A.enregistrer(p, 8000);
    const texte = (r.corps || '') + ' ' + (r.toast || '') + ' ' + (r.titre || '');
    console.log('    ' + JSON.stringify(texte).slice(0, 240));
    A.tv('la perte de droits est expliquee, pas silencieuse',
         /autoris|administrat|connect/i.test(texte), texte.slice(0, 120));
    A.tv('rien n a ete ecrit a moitie', etat.base.every(l => l.prix !== 4321));
    const modifsGardees = await p.evaluate(() =>
      /non enregistr/i.test(document.querySelector('#etat-modifs').textContent));
    A.tv('les modifications restent a l ecran', modifsGardees);
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  await browser.close();
  process.exit(A.bilan('AUDIT 9 — restes') ? 1 : 0);
})();
