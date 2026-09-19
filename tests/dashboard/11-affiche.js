/* Affiche d'annonce : l'ecran du dashboard, du geste jusqu'a la base. */
const A = require('../outils/supabase-simule.js');
const PHOTO = require('path').join(__dirname, '..', 'media', 'photo.jpg');
(async () => {
  const b = await A.chromium.launch(A.EXE ? { executablePath: A.EXE } : {});
  const etat = A.etatNeuf();
  const { c, p, erreurs } = await A.ouvrir(b, etat);
  p.on('dialog', d => d.accept());
  await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await A.connecter(p);
  await p.click('.adm-nav__item[data-vue="affiche"]');
  await p.waitForTimeout(700);

  A.tv('l ecran Affiche s ouvre', await p.evaluate(() => /Affiche/.test(document.querySelector('#adm-vue h1').textContent)));
  A.tv('etat initial : desactivee', await p.evaluate(() => /Désactivée/.test(document.querySelector('#adm-vue').innerText)));
  const nLiens = await p.evaluate(() => document.querySelectorAll('#af-lien option').length);
  A.tv('le choix du lien liste les produits', nLiens > 3, nLiens + ' options');

  await p.setInputFiles('#af-fichier', PHOTO);
  await p.waitForTimeout(2500);
  const crop = await p.evaluate(() => !!document.querySelector('#zone-crop'));
  A.tv('le recadrage s ouvre', crop);
  const forme = await p.evaluate(() => {
    const s = document.querySelector('.crop-stage'); if (!s) return null;
    const r = s.getBoundingClientRect();
    return { ratio: +(r.width / r.height).toFixed(3), texte: /vertical/.test(document.querySelector('.adm-modale .aide').textContent) };
  });
  A.tv('le cadre est vertical 9:16', forme && Math.abs(forme.ratio - 1080/1920) < 0.02, JSON.stringify(forme));
  A.tv('la consigne dit « vertical »', forme && forme.texte);

  await p.click('.adm-modale [data-valider]');
  await p.waitForTimeout(4000);
  A.tv('l affiche est envoyee et previsualisee', await p.evaluate(() => !!document.querySelector('.affiche-apercu img')));
  A.tv('elle s active toute seule', await p.evaluate(() => document.querySelector('#af-actif').checked));
  const envois = etat.appels.filter(a => a.includes('/storage/') && a.startsWith('POST'));
  A.tv('deposee dans le dossier affiches', envois.some(a => a.includes('/affiches/')), envois.join(' | ').slice(0, 160));

  await p.fill('#af-alt', "Gateaux de l'Aid jusqu'au 28");
  await p.dispatchEvent('#af-alt', 'input');
  await p.selectOption('#af-lien', { index: 1 });
  await p.evaluate(() => { const f = document.querySelector('#af-fin'); f.value = '2030-01-01'; f.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(500);
  A.tv('le dashboard signale la modification', /non enregistr/i.test(await p.evaluate(() => document.querySelector('#etat-modifs').textContent)));

  const r = await A.enregistrer(p, 10000);
  const site = etat.reglages.site || {};
  console.log('    affiche en base : ' + JSON.stringify(site.affiche));
  A.tv('L AFFICHE ARRIVE EN BASE', !!(site.affiche && site.affiche.image && site.affiche.actif));
  A.tv('avec son texte, son lien et sa date',
       site.affiche && site.affiche.alt && site.affiche.lien && site.affiche.finLe === '2030-01-01');
  A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  await c.close(); await b.close();
  process.exit(A.bilan('AFFICHE — dashboard') ? 1 : 0);
})();
