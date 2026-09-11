const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8123';
const EXE = require('../outils/navigateur').EXE;
const PROJET = 'dhhhdlthsxvscantcyir.supabase.co';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

let ok = 0, ko = 0;
function tv(nom, cond, detail) {
  if (cond) { ok++; console.log('  OK    ' + nom + (detail ? '  [' + detail + ']' : '')); }
  else { ko++; console.log('  ECHEC ' + nom + (detail ? '  [' + detail + ']' : '')); }
}

const LIGNES = [{
  id: 'a1', slug: 'gateaux-coeur', nom: 'Gâteau petit format (cœur)',
  description_courte: 'Petit gâteau décoré', description: 'Un cœur moelleux',
  prix: 4500, categorie: 'gateaux',
  image_produit: 'https://' + PROJET + '/storage/v1/object/public/photos/produits/g-900-a.jpg',
  image_produit_petite: 'https://' + PROJET + '/storage/v1/object/public/photos/produits/g-450-a.jpg',
  image_lifestyle: 'https://' + PROJET + '/storage/v1/object/public/photos/lifestyle/g-900-a.jpg',
  image_lifestyle_petite: 'https://' + PROJET + '/storage/v1/object/public/photos/lifestyle/g-450-a.jpg',
  disponible: true, en_avant: true, populaire: true, ordre: 0,
  options: [{ id: 'personnalisation', name: 'Personnalisation (message)', type: 'text', required: false, placeholder: 'Joyeux anniversaire' }],
}];

async function ctx(browser, mode, viewport = { width: 390, height: 800 }) {
  const c = await browser.newContext({ viewport });
  await c.route('**://' + PROJET + '/storage/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  if (mode === 'normal' || mode === 'lent') {
    await c.route('**://' + PROJET + '/rest/v1/produits**', async r => {
      if (mode === 'lent') await new Promise(x => setTimeout(x, 4000));
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LIGNES) });
    });
    await c.route('**://' + PROJET + '/rest/v1/reglages**', async r => {
      if (mode === 'lent') await new Promise(x => setTimeout(x, 4000));
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  } else {
    await c.route('**://' + PROJET + '/**', r => r.abort('connectionrefused'));
  }
  return c;
}

(async () => {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});

  /* ============ PARCOURS DE COMMANDE COMPLET ============ */
  for (const mode of ['normal', 'injoignable']) {
    console.log('\n=== Parcours de commande complet — Supabase ' + mode + ' ===');
    const c = await ctx(browser, mode);
    const p = await c.newPage();
    const erreurs = [];
    p.on('pageerror', e => erreurs.push(e.message));
    p.on('console', m => {
      if (m.type() !== 'error') return;
      if (/Failed to load resource/.test(m.text())) return;
      erreurs.push('[console] ' + m.text());
    });

    // 1. Accueil
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(mode === 'normal' ? 1500 : 900);
    const accueil = await p.evaluate(() => ({
      cartes: document.querySelectorAll('.card').length,
      filtres: document.querySelectorAll('.cat-pill').length,
      source: window.ZF.sourceDonnees,
      etapes: document.querySelectorAll('#steps-grid .step').length,
      engagements: document.querySelectorAll('#promises-grid .promise').length,
      cta: document.querySelector('#cta-button').textContent,
    }));
    tv('accueil : cartes affichees', accueil.cartes > 0, accueil.cartes + ' cartes, source ' + accueil.source);
    tv('accueil : filtres de categories', accueil.filtres > 1, accueil.filtres);
    tv('accueil : 4 etapes de commande', accueil.etapes === 4, accueil.etapes);
    tv('accueil : 5 engagements', accueil.engagements === 5, accueil.engagements);
    tv('accueil : appel final', accueil.cta.length > 3, accueil.cta);

    // 2. Filtrer par categorie
    const catId = await p.evaluate(() => {
      const b = [...document.querySelectorAll('.cat-pill')][1];
      b.click(); return b.getAttribute('data-cat');
    });
    await p.waitForTimeout(400);
    const filtre = await p.evaluate(() => document.querySelectorAll('.card').length);
    tv('filtrage par categorie', filtre > 0, catId + ' -> ' + filtre + ' produits');
    await p.evaluate(() => document.querySelector('.cat-pill[data-cat="all"]').click());
    await p.waitForTimeout(300);

    // 3. Recherche
    await p.evaluate(() => { document.querySelector('#search-toggle').click(); });
    await p.waitForTimeout(200);
    await p.fill('#search-input', 'gateau');
    await p.waitForTimeout(400);
    const rech = await p.evaluate(() => document.querySelectorAll('.card, .grid-empty').length);
    tv('recherche instantanee', rech > 0, rech + ' resultats');
    await p.fill('#search-input', '');
    await p.waitForTimeout(300);

    // 4. Fiche produit + option personnalisee
    const slug = mode === 'normal' ? 'gateaux-coeur' : 'gateaux-coeur';
    await p.goto(BASE + '/produit.html?p=' + slug, { waitUntil: 'load' });
    await p.waitForTimeout(mode === 'normal' ? 1500 : 900);
    const fiche = await p.evaluate(() => ({
      titre: document.title,
      prix: document.querySelector('.product-info__price').textContent.trim(),
      option: !!document.querySelector('#opt-personnalisation'),
      wa: !!document.querySelector('#order-whatsapp'),
      vues: document.querySelectorAll('.gallery-thumb').length,
    }));
    tv('fiche produit affichee', /Gâteau|gateau/i.test(fiche.titre), fiche.titre);
    tv('prix affiche', fiche.prix.length > 0, fiche.prix);
    tv('option de personnalisation presente', fiche.option);
    tv('visionneuse deux vues', fiche.vues === 2, fiche.vues + ' vignettes');

    // 5. Saisie hostile + quantite + panier
    await p.fill('#opt-personnalisation', 'Joyeux <anniversaire> "Ali" & co');
    await p.click('#qty-inc');
    await p.waitForTimeout(200);
    const lienFiche = decodeURIComponent(await p.getAttribute('#order-whatsapp', 'href'));
    tv('lien WhatsApp fiche : bon numero', lienFiche.startsWith('https://wa.me/2694880343'), lienFiche.slice(0, 32));
    tv('lien WhatsApp fiche : quantite 2', /- 2 × /.test(lienFiche));
    tv('lien WhatsApp fiche : option transmise', /Joyeux <anniversaire> "Ali" & co/.test(lienFiche));
    await p.click('#add-to-cart');
    await p.waitForTimeout(700);
    const tiroir = await p.evaluate(() => ({
      ouvert: document.querySelector('#cart-drawer').classList.contains('is-open'),
      lignes: document.querySelectorAll('.cart-line').length,
      badge: document.querySelector('[data-cart-count]').textContent,
      injecte: !!document.querySelector('.cart-line__opts script'),
      opts: (document.querySelector('.cart-line__opts') || {}).textContent,
    }));
    tv('panier ouvert avec la ligne', tiroir.ouvert && tiroir.lignes === 1);
    tv('compteur a 2', tiroir.badge === '2', tiroir.badge);
    tv('aucune balise injectee dans le panier', !tiroir.injecte);
    tv('option affichee telle quelle (echappee)', tiroir.opts === 'Joyeux <anniversaire> "Ali" & co', tiroir.opts);

    // 6. Page commande
    await p.goto(BASE + '/commande.html', { waitUntil: 'load' });
    await p.waitForTimeout(mode === 'normal' ? 1500 : 900);
    await p.click('#details-panel > summary');
    await p.fill('#f-nom', 'Fatima');
    await p.fill('#f-tel', 'abc');
    await p.waitForTimeout(300);
    const err1 = await p.textContent('#f-tel-error');
    await p.fill('#f-tel', '+269 333 44 55');
    await p.waitForTimeout(300);
    const err2 = await p.textContent('#f-tel-error');
    tv('validation du telephone : erreur sur saisie invalide', err1.length > 0, err1);
    tv('validation du telephone : erreur effacee apres correction', err2 === '', JSON.stringify(err2));

    const modes = await p.evaluate(() => [...document.querySelectorAll('#f-mode option')].map(o => o.value));
    tv('modes de recuperation charges', modes.filter(Boolean).length >= 2, modes.filter(Boolean).join(', '));
    await p.selectOption('#f-mode', modes.filter(Boolean)[0]);
    await p.waitForTimeout(300);

    const lien = decodeURIComponent(await p.getAttribute('#wa-send', 'href'));
    const apercu = await p.textContent('#wa-preview');
    console.log('  --- message genere ---');
    console.log(lien.split('?text=')[1].split('\n').map(l => '    ' + l).join('\n'));
    tv('lien de commande : bon numero officiel', lien.startsWith('https://wa.me/2694880343?text='), lien.slice(0, 32));
    tv('message : produit et quantite', /- 2 × /.test(lien));
    tv('message : option personnalisee', /Joyeux <anniversaire> "Ali" & co/.test(lien));
    tv('message : coordonnees ajoutees', /Nom : Fatima/.test(lien) && /Téléphone : \+269 333 44 55/.test(lien));
    tv('message : mode de recuperation', /Mode de récupération : /.test(lien));
    tv('message : reference de commande', /\(réf\. ZF-[A-Z0-9]{4}\)/.test(lien), (lien.match(/\(réf\. [^)]*\)/) || [])[0]);
    tv('apercu identique au lien', apercu.trim() === lien.split('?text=')[1].trim());
    tv('encodage-decodage sans perte', decodeURIComponent(encodeURIComponent(lien)) === lien);
    tv('total calcule', /Total/.test(lien));
    tv('aucune erreur JavaScript sur tout le parcours', erreurs.length === 0, erreurs.join(' | ') || 'aucune');
    await c.close();
  }

  /* ============ TROIS ETATS SUPABASE ============ */
  console.log('\n=== Les trois etats de la base, sur l accueil ===');
  for (const mode of ['normal', 'lent', 'injoignable']) {
    const c = await ctx(browser, mode);
    const p = await c.newPage();
    const t0 = Date.now();
    await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => document.querySelectorAll('.card').length > 0, null, { timeout: 12000 });
    const delai = Date.now() - t0;
    const d = await p.evaluate(() => ({
      cartes: document.querySelectorAll('.card').length,
      source: window.ZF.sourceDonnees,
      wa: (document.querySelector('.wa-fab') || {}).href,
    }));
    tv('base « ' + mode + ' » : premieres cartes affichees rapidement', delai < 2500,
       delai + ' ms, ' + d.cartes + ' cartes, source « ' + d.source + ' »');
    tv('base « ' + mode + ' » : numero officiel preserve',
       (d.wa || '').includes('wa.me/2694880343'), (d.wa || '').slice(0, 40));
    await c.close();
  }

  /* ============ QUATRE LARGEURS ============ */
  console.log('\n=== Quatre largeurs, trois pages ===');
  for (const w of [320, 360, 390, 1440]) {
    const c = await ctx(browser, 'normal', { width: w, height: 800 });
    for (const page of ['/index.html', '/produit.html?p=gateaux-coeur', '/commande.html']) {
      const p = await c.newPage();
      const erreurs = [];
      p.on('pageerror', e => erreurs.push(e.message));
      await p.goto(BASE + page, { waitUntil: 'load' });
      await p.waitForTimeout(900);
      const d = await p.evaluate(() => ({
        debordement: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        cassees: [...document.images].filter(i => i.complete && i.naturalWidth === 0).length,
      }));
      tv(w + 'px ' + page.split('?')[0] + ' : aucun debordement ni image cassee',
         d.debordement === 0 && d.cassees === 0 && erreurs.length === 0,
         'debordement ' + d.debordement + 'px, ' + d.cassees + ' images cassees, ' + erreurs.length + ' erreurs');
      await p.close();
    }
    await c.close();
  }

  await browser.close();
  console.log('\n=== ' + ok + ' reussis, ' + ko + ' echoues ===');
  process.exit(ko ? 1 : 0);
})();
