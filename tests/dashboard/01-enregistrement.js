/* AUDIT 1 — Le coeur de la plainte : « j'enregistre et rien ne change ». */
const A = require('../outils/supabase-simule.js');

(async () => {
  const browser = await A.chromium.launch({ executablePath: A.EXE });

  /* ---------- 1. Changer un tarif ---------- */
  console.log('\n=== 1. Modifier le tarif d un produit existant ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await A.ouvrir(browser, etat);
    await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await A.connecter(p);
    await p.click('.adm-nav__item[data-vue="produits"]');
    await p.waitForTimeout(500);

    const prixAvant = etat.base[0].prix;
    /* Ouvrir le premier produit */
    await p.click('.adm-produit[data-index="0"] [data-action="modifier"]');
    await p.waitForTimeout(500);
    const tiroirOuvert = await p.evaluate(() => !document.querySelector('#adm-tiroir').hidden);
    A.tv('le tiroir d edition s ouvre', tiroirOuvert);

    await p.fill('#p-prix', '7777');
    await p.dispatchEvent('#p-prix', 'input');
    await p.waitForTimeout(300);
    await p.click('#tiroir-valider');
    await p.waitForTimeout(500);
    const tiroirFerme = await p.evaluate(() => document.querySelector('#adm-tiroir').hidden);
    A.tv('le tiroir se ferme apres validation', tiroirFerme,
         await p.evaluate(() => (document.querySelector('#adm-toast')||{}).textContent || ''));

    const etatBarre = await p.evaluate(() => document.querySelector('#etat-modifs').textContent);
    A.tv('le dashboard signale une modification en attente', /non enregistr/i.test(etatBarre), etatBarre);

    const r = await A.enregistrer(p);
    console.log('    modale : ' + JSON.stringify(r).slice(0, 400));

    const enBase = etat.base.find(l => l.id === 'id-1');
    A.tv('LE NOUVEAU TARIF EST BIEN EN BASE', enBase && enBase.prix === 7777,
         'avant ' + prixAvant + ' -> en base ' + (enBase ? enBase.prix : 'ligne disparue'));
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 2. Ajouter un nouveau produit ---------- */
  console.log('\n=== 2. Ajouter un nouveau produit ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await A.ouvrir(browser, etat);
    await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await A.connecter(p);
    await p.click('.adm-nav__item[data-vue="produits"]');
    await p.waitForTimeout(500);

    const avant = etat.base.length;
    await p.click('#ajouter-produit');
    await p.waitForTimeout(500);
    A.tv('le formulaire « Nouveau produit » s ouvre',
         await p.evaluate(() => /Nouveau produit/.test(document.querySelector('#tiroir-titre').textContent)));

    await p.fill('#p-nom', 'Gateau test');
    await p.dispatchEvent('#p-nom', 'input');
    await p.waitForTimeout(300);
    await p.fill('#p-prix', '2500');
    await p.dispatchEvent('#p-prix', 'input');
    const cats = await p.evaluate(() => Array.from(document.querySelectorAll('#p-cat option')).map(o => o.value));
    if (cats.length) { await p.selectOption('#p-cat', cats.find(v => v) || cats[0]); }
    await p.waitForTimeout(300);

    const slugAuto = await p.evaluate(() => document.querySelector('#p-slug').value);
    A.tv('l adresse de la fiche est proposee automatiquement', !!slugAuto, slugAuto);

    await p.click('#tiroir-valider');
    await p.waitForTimeout(600);
    const toastValidation = await p.evaluate(() => (document.querySelector('#adm-toast')||{}).textContent || '');
    const tiroirEncoreOuvert = await p.evaluate(() => !document.querySelector('#adm-tiroir').hidden);
    console.log('    apres « Valider ce produit » : tiroir ouvert = ' + tiroirEncoreOuvert +
                ' | message = ' + JSON.stringify(toastValidation));
    A.tv('un produit sans photo peut etre valide OU le refus est explique',
         !tiroirEncoreOuvert || /photo/i.test(toastValidation), toastValidation);

    if (tiroirEncoreOuvert) { await c.close(); }
    else {
      const r = await A.enregistrer(p);
      console.log('    modale : ' + JSON.stringify(r).slice(0, 400));
      A.tv('LE NOUVEAU PRODUIT EST BIEN EN BASE', etat.base.length === avant + 1,
           avant + ' -> ' + etat.base.length);
      A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
      await c.close();
    }
  }

  /* ---------- 3. Modifier un texte du site ---------- */
  console.log('\n=== 3. Modifier un texte du site ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await A.ouvrir(browser, etat);
    await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await A.connecter(p);
    await p.click('.adm-nav__item[data-vue="textes"]');
    await p.waitForTimeout(600);
    const champs = await p.evaluate(() => document.querySelectorAll('#adm-vue [data-config]').length);
    A.tv('la page « Textes du site » propose des champs', champs > 0, champs + ' champ(s)');

    if (champs) {
      await p.evaluate(() => {
        const el = document.querySelector('#adm-vue [data-config]');
        el.value = 'TEXTE AUDIT 42';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await p.waitForTimeout(400);
      const r = await A.enregistrer(p);
      console.log('    modale : ' + JSON.stringify(r).slice(0, 300));
      const site = etat.reglages.site;
      const trouve = site && JSON.stringify(site).includes('TEXTE AUDIT 42');
      A.tv('LE TEXTE MODIFIE EST BIEN EN BASE', !!trouve,
           site ? 'reglage « site » ecrit' : 'aucun reglage ecrit');
    }
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 4. Le compte n'est pas administrateur ---------- */
  console.log('\n=== 4. Compte connecte mais NON declare administrateur ===');
  {
    const etat = A.etatNeuf({ admin: false });
    const { c, p, erreurs } = await A.ouvrir(browser, etat);
    await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await A.connecter(p);
    await p.click('.adm-nav__item[data-vue="produits"]');
    await p.waitForTimeout(500);
    await p.click('.adm-produit[data-index="0"] [data-action="modifier"]');
    await p.waitForTimeout(400);
    await p.fill('#p-prix', '9999');
    await p.dispatchEvent('#p-prix', 'input');
    await p.click('#tiroir-valider');
    await p.waitForTimeout(500);

    const r = await A.enregistrer(p);
    console.log('    resultat : ' + JSON.stringify(r).slice(0, 500));
    const texte = (r.corps || '') + ' ' + (r.toast || '');
    A.tv('le refus est explicite (pas un echec muet)', /autoris|administrat/i.test(texte), texte.slice(0, 160));
    A.tv('rien n a ete ecrit en base', etat.base.every(l => l.prix !== 9999));
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  await browser.close();
  process.exit(A.bilan('AUDIT 1 — enregistrement') ? 1 : 0);
})();
