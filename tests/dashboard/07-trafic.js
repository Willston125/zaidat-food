/* AUDIT 7 — Combien d appels reseau pour changer UN SEUL prix ? */
const A = require('../outils/supabase-simule.js');

(async () => {
  const browser = await A.chromium.launch({ executablePath: A.EXE });
  const base = [];
  for (let i = 1; i <= 21; i++) base.push(A.ligne(i));
  const etat = A.etatNeuf({ base });
  const { c, p, erreurs } = await A.ouvrir(browser, etat);
  await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await A.connecter(p);
  await p.click('.adm-nav__item[data-vue="produits"]');
  await p.waitForTimeout(800);

  await p.click('.adm-produit[data-index="0"] [data-action="modifier"]');
  await p.waitForTimeout(500);
  await p.fill('#p-prix', '1234');
  await p.dispatchEvent('#p-prix', 'input');
  await p.click('#tiroir-valider');
  await p.waitForTimeout(500);

  etat.appels.length = 0;                      /* on ne compte que l enregistrement */
  const t0 = Date.now();
  await A.enregistrer(p, 15000);
  const duree = ((Date.now() - t0) / 1000).toFixed(1);

  const patch = etat.appels.filter(a => a.startsWith('PATCH')).length;
  const post  = etat.appels.filter(a => a.startsWith('POST') && a.includes('produits')).length;
  const get   = etat.appels.filter(a => a.startsWith('GET')).length;
  console.log('\n  Un seul prix modifie sur 21 produits :');
  console.log('    PATCH produits : ' + patch);
  console.log('    POST  produits : ' + post);
  console.log('    GET            : ' + get);
  console.log('    total appels   : ' + etat.appels.length + '   duree : ' + duree + ' s');

  console.log('\n  Champs qui different, pour les 3 premieres reecritures :');
  etat.diffs.slice(0, 3).forEach(d => console.log('    ' + d.id + ' -> ' + JSON.stringify(d.diff)));

  A.tv('seul le produit reellement modifie est reecrit', patch <= 1,
       patch + ' produits reecrits sur 21 — un seul a change');
  A.tv('les 21 produits sont intacts en base', etat.base.length === 21, String(etat.base.length));
  A.tv('le bon prix est en base', (etat.base.find(l => l.id === 'id-1')||{}).prix === 1234);
  A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  await c.close();
  await browser.close();
  process.exit(A.bilan('AUDIT 7 — trafic reseau') ? 1 : 0);
})();
