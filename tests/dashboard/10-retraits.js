/* AUDIT 10 — Retraits, avec les vrais selecteurs ; et perte de droits en cours de route. */
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

  console.log('\n=== 1. Retirer une photo de la galerie (bouton reel) ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await dash(browser, etat, 'galerie');
    await p.setInputFiles('#fichier-galerie', PHOTO);
    await p.waitForTimeout(2500);
    if (await p.evaluate(() => !!document.querySelector('#zone-crop'))) {
      await p.click('.adm-modale [data-valider]');
      await p.waitForTimeout(3500);
    }
    const n1 = await p.evaluate(() => document.querySelectorAll('[data-galerie]').length);
    A.tv('la photo est ajoutee a la galerie', n1 > 0, n1 + ' bloc(s)');
    await p.click('[data-galerie] [data-suppr]');
    await p.waitForTimeout(700);
    const n2 = await p.evaluate(() => document.querySelectorAll('[data-galerie]').length);
    A.tv('la photo est retiree de la galerie', n2 === n1 - 1, n1 + ' -> ' + n2);

    await A.enregistrer(p, 8000);
    const g = JSON.stringify((etat.reglages.site || {}).galerie || (etat.reglages.site || {}).gallery || []);
    A.tv('LA GALERIE EN BASE EST BIEN VIDE', g === '[]' || g === 'null' || g === '""', g.slice(0, 80));
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  console.log('\n=== 2. Retirer un temoignage (bouton reel) ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await dash(browser, etat, 'temoignages');
    await p.click('#ajouter-temoin');
    await p.waitForTimeout(500);
    await p.click('[data-champ="name"]');
    await p.keyboard.type('Aicha', { delay: 30 });
    await p.waitForTimeout(300);
    const n1 = await p.evaluate(() => document.querySelectorAll('[data-champ="text"]').length);
    const sel = await p.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#adm-vue button'))
        .find(x => x.hasAttribute('data-suppr'));
      return b ? 'ok' : 'aucun';
    });
    A.tv('un bouton de retrait existe', sel === 'ok', sel);
    if (sel === 'ok') {
      await p.evaluate(() => {
        Array.from(document.querySelectorAll('#adm-vue button')).find(x => x.hasAttribute('data-suppr')).click();
      });
      await p.waitForTimeout(700);
      const n2 = await p.evaluate(() => document.querySelectorAll('[data-champ="text"]').length);
      A.tv('le temoignage est retire', n2 === n1 - 1, n1 + ' -> ' + n2);
    }
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  console.log('\n=== 3. Les droits disparaissent pendant l enregistrement ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await dash(browser, etat, 'produits');
    await p.click('.adm-produit[data-index="0"] [data-action="modifier"]');
    await p.waitForTimeout(400);
    await p.fill('#p-prix', '4321');
    await p.dispatchEvent('#p-prix', 'input');
    await p.click('#tiroir-valider');
    await p.waitForTimeout(500);

    etat.admin = false;                         /* les droits tombent */
    await p.click('#btn-publier');
    await p.waitForTimeout(700);
    await p.click('#pub-confirmer');
    await p.waitForTimeout(3500);

    const journal = await p.evaluate(() => {
      const e = document.querySelector('#pub-corps .message--erreur, #pub-corps .message--ok');
      return e ? e.innerText.replace(/\n/g, ' / ') : '(aucun journal final)';
    });
    console.log('    journal final : ' + JSON.stringify(journal).slice(0, 260));
    A.tv('l echec est annonce comme un echec', /[ÉE]chec|autoris/i.test(journal), journal.slice(0, 120));
    A.tv('le message parle bien du droit manquant', /autoris|administrat/i.test(journal), journal.slice(0, 120));
    A.tv('rien n a ete ecrit', etat.base.every(l => l.prix !== 4321));
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  await browser.close();
  process.exit(A.bilan('AUDIT 10 — retraits et perte de droits') ? 1 : 0);
})();
