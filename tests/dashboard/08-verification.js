/* AUDIT 8 — Verification des trois correctifs, sur les gestes reels. */
const A = require('../outils/supabase-simule.js');
const PHOTO = require('path').join(__dirname, '..', 'media', 'photo.jpg');

(async () => {
  const browser = await A.chromium.launch({ executablePath: A.EXE });

  /* ---------- 1. Categorie : taper puis enregistrer, sans rien d autre ---------- */
  console.log('\n=== 1. Renommer une categorie et enregistrer (le defaut signale) ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await A.ouvrir(browser, etat);
    await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await A.connecter(p);
    await p.click('.adm-nav__item[data-vue="categories"]');
    await p.waitForTimeout(600);
    await p.click('.adm-produit:first-child [data-champ="name"]');
    await p.keyboard.type(' MAISON', { delay: 50 });
    await p.waitForTimeout(400);
    const r = await A.enregistrer(p, 8000);
    A.tv('le bouton Enregistrer est actif des la frappe', !r.boutonGrise, r.boutonGrise ? r.titre : 'actif');
    A.tv('LE NOUVEAU NOM ARRIVE EN BASE',
         JSON.stringify(etat.reglages.categories || '').includes('MAISON'));
    /* L identifiant doit rester propre malgre l ecoute a la frappe */
    await p.evaluate(() => { document.querySelector('#modale-publier').hidden = true; });
    await p.click('.adm-produit:first-child [data-champ="id"]');
    await p.keyboard.press('End');
    await p.keyboard.type(' avec espace', { delay: 40 });
    await p.waitForTimeout(300);
    const pendant = await p.evaluate(() => document.querySelector('.adm-produit:first-child [data-champ="id"]').value);
    await p.click('h1');
    await p.waitForTimeout(300);
    const apres = await p.evaluate(() => document.querySelector('.adm-produit:first-child [data-champ="id"]').value);
    A.tv('on peut taper une espace dans l identifiant', / /.test(pendant), JSON.stringify(pendant));
    A.tv('l identifiant est remis au propre en sortant du champ', !/ /.test(apres), JSON.stringify(apres));
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 2. Produit sans photo : le refus reste affiche ---------- */
  console.log('\n=== 2. Ajouter un produit sans photo : le refus reste-t-il lisible ? ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await A.ouvrir(browser, etat);
    await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await A.connecter(p);
    await p.click('.adm-nav__item[data-vue="produits"]');
    await p.waitForTimeout(600);
    await p.click('#ajouter-produit');
    await p.waitForTimeout(500);

    const ditObligatoire = await p.evaluate(() =>
      /obligatoire/i.test(document.querySelector('#tiroir-corps').innerText));
    A.tv('le formulaire annonce que la photo est obligatoire', ditObligatoire);

    await p.fill('#p-nom', 'Sans photo');
    await p.dispatchEvent('#p-nom', 'input');
    await p.waitForTimeout(300);
    await p.click('#tiroir-valider');
    await p.waitForTimeout(600);
    const visible = await p.evaluate(() => {
      const z = document.querySelector('#err-produit');
      return z && !z.hidden ? z.innerText.replace(/\n/g, ' / ') : '';
    });
    A.tv('le refus s affiche dans le tiroir', !!visible, visible.slice(0, 130));
    /* Et surtout : il est TOUJOURS la 5 secondes plus tard */
    await p.waitForTimeout(5000);
    const encore = await p.evaluate(() => {
      const z = document.querySelector('#err-produit');
      return z && !z.hidden && z.innerText.length > 0;
    });
    A.tv('le refus est TOUJOURS visible 5 secondes apres', encore);

    /* Puis on corrige : photo ajoutee -> le message doit disparaitre */
    await p.setInputFiles('.photo-slot[data-slot="produit"] [data-fichier]', PHOTO);
    await p.waitForTimeout(2500);
    if (await p.evaluate(() => !!document.querySelector('#zone-crop'))) {
      await p.click('.adm-modale [data-valider]');
      await p.waitForTimeout(3500);
    }
    const cats = await p.evaluate(() => Array.from(document.querySelectorAll('#p-cat option')).map(o => o.value).filter(Boolean));
    if (cats.length) await p.selectOption('#p-cat', cats[0]);
    await p.click('#tiroir-valider');
    await p.waitForTimeout(600);
    const ferme = await p.evaluate(() => document.querySelector('#adm-tiroir').hidden);
    A.tv('une fois la photo ajoutee, la fiche est acceptee', ferme,
         await p.evaluate(() => (document.querySelector('#adm-toast')||{}).textContent||''));
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 3. Non-regression : rien ne doit avoir casse ---------- */
  console.log('\n=== 3. Non-regression : ajout, suppression, ordre, textes ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await A.ouvrir(browser, etat);
    p.on('dialog', d => d.accept());
    await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await A.connecter(p);
    await p.click('.adm-nav__item[data-vue="produits"]');
    await p.waitForTimeout(600);

    const n0 = etat.base.length;
    await p.click('.adm-produit[data-index="0"] [data-action="dupliquer"]');
    await p.waitForTimeout(400);
    await p.click('.adm-produit[data-index="0"] [data-action="descendre"]');
    await p.waitForTimeout(400);
    await p.click('.adm-produit:last-child [data-action="supprimer"]');
    await p.waitForTimeout(500);
    const ecran = await p.evaluate(() => document.querySelectorAll('.adm-produit').length);

    await A.enregistrer(p, 10000);
    A.tv('la base suit exactement l ecran', etat.base.length === ecran,
         'ecran ' + ecran + ' / base ' + n0 + ' -> ' + etat.base.length);
    const ordres = etat.base.map(l => l.ordre).sort((a,b)=>a-b);
    A.tv('les positions restent une suite continue a partir de 0',
         ordres.every((o, i) => o === i), JSON.stringify(ordres));
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  await browser.close();
  process.exit(A.bilan('AUDIT 8 — verification des correctifs') ? 1 : 0);
})();
