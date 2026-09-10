/* AUDIT 4 — La saisie au clavier est-elle prise en compte partout pareil ? */
const A = require('../outils/supabase-simule.js');

async function ouvrirVue(browser, etat, vue) {
  const { c, p, erreurs } = await A.ouvrir(browser, etat);
  p.on('dialog', d => d.accept());
  await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await A.connecter(p);
  await p.click('.adm-nav__item[data-vue="' + vue + '"]');
  await p.waitForTimeout(600);
  return { c, p, erreurs };
}
const etatBarre = (p) => p.evaluate(() => document.querySelector('#etat-modifs').textContent);
const barreBasse = (p) => p.evaluate(() => document.body.classList.contains('a-barre-enregistrer'));

(async () => {
  const browser = await A.chromium.launch({ executablePath: A.EXE });

  /* Sur chaque ecran : on TAPE au clavier (sans cliquer ailleurs) et on
     regarde si le dashboard signale qu il y a quelque chose a enregistrer. */
  const cas = [
    { vue: 'categories',   sel: '.adm-produit:first-child [data-champ="name"]', quoi: 'nom de categorie' },
    { vue: 'textes',       sel: '#adm-vue [data-config]',                       quoi: 'texte du site' },
    { vue: 'contact',      sel: '[data-config="delivery.note"]',                 quoi: 'note de livraison' },
  ];

  for (const c of cas) {
    console.log('\n=== Ecran « ' + c.vue + ' » : je tape dans le ' + c.quoi + ' ===');
    const etat = A.etatNeuf();
    const { c: ctx, p, erreurs } = await ouvrirVue(browser, etat, c.vue);
    const avant = await etatBarre(p);

    await p.click(c.sel);
    await p.keyboard.type('ZZZ', { delay: 60 });   /* frappe reelle : evenements « input » */
    await p.waitForTimeout(500);

    const pendantFrappe = await etatBarre(p);
    const barre = await barreBasse(p);
    console.log('    etat avant : ' + JSON.stringify(avant));
    console.log('    pendant la frappe : ' + JSON.stringify(pendantFrappe) + ' | barre du bas : ' + barre);
    A.tv('« ' + c.vue + ' » signale la modification DES la frappe',
         /non enregistr/i.test(pendantFrappe), pendantFrappe);

    /* Puis on clique « Enregistrer » : le changement arrive-t-il en base ? */
    const r = await A.enregistrer(p, 5000);
    const tout = JSON.stringify(etat.reglages);
    A.tv('la saisie de « ' + c.vue + ' » arrive bien en base', tout.includes('ZZZ'),
         tout.includes('ZZZ') ? 'trouve' : 'ABSENT de la base');
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await ctx.close();
  }

  /* ---------- Perte de saisie : je tape puis je change d onglet ---------- */
  console.log('\n=== Je tape un nom de categorie, puis je change d onglet et je reviens ===');
  {
    const etat = A.etatNeuf();
    const { c: ctx, p, erreurs } = await ouvrirVue(browser, etat, 'categories');
    await p.click('.adm-produit:first-child [data-champ="name"]');
    await p.keyboard.type(' MODIFIE', { delay: 50 });
    await p.waitForTimeout(300);
    await p.click('.adm-nav__item[data-vue="produits"]');
    await p.waitForTimeout(600);
    await p.click('.adm-nav__item[data-vue="categories"]');
    await p.waitForTimeout(600);
    const valeur = await p.evaluate(() =>
      document.querySelector('.adm-produit:first-child [data-champ="name"]').value);
    A.tv('la saisie survit au changement d onglet', /MODIFIE/.test(valeur), JSON.stringify(valeur));
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await ctx.close();
  }

  /* ---------- Meme chose sur telephone : je tape puis je touche la barre du bas ---------- */
  console.log('\n=== Telephone : je tape un nom de categorie puis je touche « Enregistrer maintenant » ===');
  {
    const etat = A.etatNeuf();
    const { c: ctx, p, erreurs } = await A.ouvrir(browser, etat, { width: 360, height: 740 });
    p.on('dialog', d => d.accept());
    await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await A.connecter(p);
    await p.click('.adm-nav__item[data-vue="categories"]');
    await p.waitForTimeout(600);
    await p.click('.adm-produit:first-child [data-champ="name"]');
    await p.keyboard.type(' TEL', { delay: 50 });
    await p.waitForTimeout(400);
    const barreVisible = await barreBasse(p);
    console.log('    barre « Enregistrer maintenant » visible pendant la frappe : ' + barreVisible);
    A.tv('la barre d enregistrement apparait pendant la frappe', barreVisible, String(barreVisible));
    await ctx.close();
  }

  await browser.close();
  process.exit(A.bilan('AUDIT 4 — saisie') ? 1 : 0);
})();
