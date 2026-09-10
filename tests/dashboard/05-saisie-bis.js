/* AUDIT 5 — Contre-verification : chaque ecran, avec un champ SANS validation. */
const A = require('../outils/supabase-simule.js');

(async () => {
  const browser = await A.chromium.launch({ executablePath: A.EXE });

  const cas = [
    { vue: 'contact', sel: '[data-config="delivery.note"]',  nom: 'note de livraison' },
    { vue: 'contact', sel: '[data-config="whatsappGreeting"]', nom: 'message WhatsApp' },
  ];

  for (const c of cas) {
    console.log('\n=== contact / ' + c.nom + ' ===');
    const etat = A.etatNeuf();
    const { c: ctx, p, erreurs } = await A.ouvrir(browser, etat);
    await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await A.connecter(p);
    await p.click('.adm-nav__item[data-vue="contact"]');
    await p.waitForTimeout(600);
    const existe = await p.evaluate(s => !!document.querySelector(s), c.sel);
    if (!A.tv('le champ « ' + c.nom + ' » existe', existe)) { await ctx.close(); continue; }

    await p.click(c.sel);
    await p.keyboard.type(' ZZZ', { delay: 50 });
    await p.waitForTimeout(400);
    const r = await A.enregistrer(p, 5000);
    console.log('    ' + JSON.stringify(r).slice(0, 260));
    A.tv('la saisie « ' + c.nom + ' » arrive en base',
         JSON.stringify(etat.reglages).includes('ZZZ'),
         JSON.stringify(etat.reglages).includes('ZZZ') ? 'trouve' : 'ABSENT');
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await ctx.close();
  }

  /* ---------- Temoignages : ajouter puis saisir ---------- */
  console.log('\n=== temoignages : ajouter un temoignage et le saisir ===');
  {
    const etat = A.etatNeuf();
    const { c: ctx, p, erreurs } = await A.ouvrir(browser, etat);
    p.on('dialog', d => d.accept());
    await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    await A.connecter(p);
    await p.click('.adm-nav__item[data-vue="temoignages"]');
    await p.waitForTimeout(600);
    await p.click('#ajouter-temoin');
    await p.waitForTimeout(500);
    await p.click('[data-champ="name"]');
    await p.keyboard.type('Fatima ZZZ', { delay: 40 });
    await p.click('[data-champ="text"]');
    await p.keyboard.type('Tres bon, merci', { delay: 20 });
    await p.waitForTimeout(400);
    const etatBarre = await p.evaluate(() => document.querySelector('#etat-modifs').textContent);
    A.tv('la saisie d un temoignage est signalee', /non enregistr/i.test(etatBarre), etatBarre);
    const r = await A.enregistrer(p, 5000);
    console.log('    ' + JSON.stringify(r).slice(0, 200));
    A.tv('LE TEMOIGNAGE ARRIVE EN BASE', JSON.stringify(etat.reglages).includes('Fatima ZZZ'),
         JSON.stringify(etat.reglages).includes('Fatima ZZZ') ? 'trouve' : 'ABSENT');
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await ctx.close();
  }

  /* Le defaut « bouton grise apres la frappe » etait reproduit ici avant
     correction. Il ne se reproduit plus : le comportement corrige est
     verifie par l audit 08, sur le meme geste. */

  await browser.close();
  process.exit(A.bilan('AUDIT 5 — contre-verification') ? 1 : 0);
})();
