/* AUDIT 3 — Tous les ecrans du dashboard, du geste reel jusqu a la base. */
const A = require('../outils/supabase-simule.js');
const PHOTO = require('path').join(__dirname, '..', 'media', 'photo.jpg');

async function session(browser, etat, vue, viewport) {
  const { c, p, erreurs } = await A.ouvrir(browser, etat, viewport);
  p.on('dialog', d => d.accept());
  await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await A.connecter(p);
  if (vue) { await p.click('.adm-nav__item[data-vue="' + vue + '"]'); await p.waitForTimeout(600); }
  return { c, p, erreurs };
}

(async () => {
  const browser = await A.chromium.launch({ executablePath: A.EXE });

  /* ---------- 1. Ajouter un produit AVEC photo, de bout en bout ---------- */
  console.log('\n=== 1. Ajouter un produit avec sa photo (parcours reel) ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await session(browser, etat, 'produits');
    const avant = etat.base.length;

    await p.click('#ajouter-produit');
    await p.waitForTimeout(500);
    await p.fill('#p-nom', 'Beignets audit');
    await p.dispatchEvent('#p-nom', 'input');
    await p.waitForTimeout(400);
    await p.fill('#p-prix', '1500');
    await p.dispatchEvent('#p-prix', 'input');
    const cats = await p.evaluate(() => Array.from(document.querySelectorAll('#p-cat option')).map(o => o.value).filter(Boolean));
    if (cats.length) await p.selectOption('#p-cat', cats[0]);
    await p.waitForTimeout(300);

    /* Choisir la photo produit */
    await p.setInputFiles('.photo-slot[data-slot="produit"] [data-fichier]', PHOTO);
    await p.waitForTimeout(2500);
    const recadrageOuvert = await p.evaluate(() => !!document.querySelector('#zone-crop'));
    A.tv('la fenetre de recadrage s ouvre', recadrageOuvert);

    if (recadrageOuvert) {
      await p.click('.adm-modale [data-valider]');
      await p.waitForTimeout(3500);
      const modaleFermee = await p.evaluate(() => !document.querySelector('#zone-crop'));
      const toast = await p.evaluate(() => (document.querySelector('#adm-toast')||{}).textContent || '');
      A.tv('la photo est envoyee et la fenetre se ferme', modaleFermee, toast);
      const apercu = await p.evaluate(() => !!document.querySelector('.photo-slot[data-slot="produit"] img'));
      A.tv('l apercu de la photo s affiche dans le formulaire', apercu);
    }

    await p.click('#tiroir-valider');
    await p.waitForTimeout(600);
    const valide = await p.evaluate(() => document.querySelector('#adm-tiroir').hidden);
    A.tv('le produit est accepte',
         valide, await p.evaluate(() => (document.querySelector('#adm-toast')||{}).textContent || ''));

    if (valide) {
      const r = await A.enregistrer(p, 5000);
      A.tv('LE PRODUIT NEUF EST BIEN EN BASE', etat.base.length === avant + 1, avant + ' -> ' + etat.base.length);
      const neuf = etat.base[etat.base.length - 1];
      A.tv('avec son nom, son tarif et sa photo',
           neuf && neuf.nom === 'Beignets audit' && neuf.prix === 1500 && !!neuf.image_produit,
           neuf ? JSON.stringify({nom: neuf.nom, prix: neuf.prix, photo: !!neuf.image_produit, vignette: !!neuf.image_produit_petite}) : '-');
    }
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 2. Reordonner (avec le bon selecteur) ---------- */
  console.log('\n=== 2. Reordonner les produits ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await session(browser, etat, 'produits');
    const noms = () => p.evaluate(() =>
      Array.from(document.querySelectorAll('.adm-produit__nom')).map(e => e.textContent));
    const avant = await noms();
    await p.click('.adm-produit[data-index="0"] [data-action="descendre"]');
    await p.waitForTimeout(500);
    const apres = await noms();
    A.tv('le bouton « descendre » change l ordre a l ecran',
         JSON.stringify(avant) !== JSON.stringify(apres),
         JSON.stringify(avant) + ' -> ' + JSON.stringify(apres));

    await A.enregistrer(p, 5000);
    const ordreBase = etat.base.slice().sort((a,b) => a.ordre - b.ordre).map(l => l.nom);
    A.tv('L ORDRE EST BIEN ENREGISTRE EN BASE',
         JSON.stringify(ordreBase) === JSON.stringify(apres), JSON.stringify(ordreBase));
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 3. Categories ---------- */
  console.log('\n=== 3. Categories ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await session(browser, etat, 'categories');
    const n0 = await p.evaluate(() => document.querySelectorAll('.adm-produit').length);
    A.tv('la page categories affiche des lignes', n0 > 0, n0 + ' categorie(s)');
    await p.click('#ajouter-categorie');
    await p.waitForTimeout(500);
    const n1 = await p.evaluate(() => document.querySelectorAll('.adm-produit').length);
    A.tv('« Ajouter » cree une categorie', n1 === n0 + 1, n0 + ' -> ' + n1);

    await p.evaluate(() => {
      const el = document.querySelector('.adm-produit:last-child [data-champ="name"]');
      el.value = 'Boissons audit';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await p.waitForTimeout(400);
    await A.enregistrer(p, 5000);
    const cats = etat.reglages.categories;
    A.tv('LA CATEGORIE EST BIEN ENREGISTREE',
         !!cats && JSON.stringify(cats).includes('Boissons audit'),
         cats ? cats.length + ' categories en base' : 'aucune categorie ecrite');
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 4. Contact & livraison : le numero WhatsApp ---------- */
  console.log('\n=== 4. Contact & livraison (numero WhatsApp) ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await session(browser, etat, 'contact');
    const champs = await p.evaluate(() =>
      Array.from(document.querySelectorAll('#adm-vue [data-config]')).map(e => e.getAttribute('data-config')));
    console.log('    champs : ' + JSON.stringify(champs).slice(0, 300));
    A.tv('la page contact propose des champs', champs.length > 0, champs.length + ' champ(s)');

    const champWa = champs.find(c => /whats|phone|tel/i.test(c));
    if (champWa) {
      /* Saisie fautive : lettres et espaces */
      await p.evaluate((sel) => {
        const el = document.querySelector('[data-config="' + sel + '"]');
        el.value = 'appelez-moi';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, champWa);
      await p.waitForTimeout(400);
      const r = await A.enregistrer(p, 5000);
      const texte = (r.corps || '') + (r.toast || '');
      console.log('    numero invalide -> ' + JSON.stringify(texte).slice(0, 260));
      A.tv('un numero WhatsApp invalide est signale', /num[ée]ro|whatsapp|corriger/i.test(texte), texte.slice(0, 120));
    } else {
      A.tv('un champ numero WhatsApp existe', false, 'aucun champ trouve parmi : ' + JSON.stringify(champs));
    }
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 5. Galerie et temoignages ---------- */
  for (const vue of ['galerie', 'temoignages']) {
    console.log('\n=== 5. Ecran « ' + vue + ' » ===');
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await session(browser, etat, vue);
    const contenu = await p.evaluate(() => document.querySelector('#adm-vue').innerText.slice(0, 200));
    const vide = await p.evaluate(() => document.querySelector('#adm-vue').innerText.trim().length < 40);
    A.tv('l ecran « ' + vue + ' » affiche quelque chose', !vide, contenu.replace(/\n/g, ' / ').slice(0, 120));
    A.tv('aucune erreur JavaScript sur « ' + vue + ' »', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 6. Telephone 360 px ---------- */
  console.log('\n=== 6. Dashboard sur telephone (360 px) ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await session(browser, etat, 'produits', { width: 360, height: 740 });
    const debord = await p.evaluate(() =>
      Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
    A.tv('aucun debordement horizontal', debord === 0, debord + 'px');
    const boutonVisible = await p.evaluate(() => {
      const b = document.querySelector('#btn-publier');
      if (!b) return 'absent';
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? 'visible' : 'invisible';
    });
    A.tv('le bouton Enregistrer reste accessible', boutonVisible === 'visible', boutonVisible);
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  await browser.close();
  process.exit(A.bilan('AUDIT 3 — parcours complet') ? 1 : 0);
})();
