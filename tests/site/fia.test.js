const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8123';
const EXE = require('../outils/navigateur').EXE;

const LIGNES = [{
  id: 'a1', slug: 'samoussas', nom: 'Samoussas croustillants',
  description_courte: 'Croustillants et dorés', description: 'Longue description',
  prix: 1500, categorie: 'snacks',
  image_produit: 'https://ex.supabase.co/storage/v1/object/public/photos/produits/samoussas-900-a.jpg',
  image_produit_petite: 'https://ex.supabase.co/storage/v1/object/public/photos/produits/samoussas-450-a.jpg',
  image_lifestyle: 'https://ex.supabase.co/storage/v1/object/public/photos/lifestyle/samoussas-900-a.jpg',
  image_lifestyle_petite: 'https://ex.supabase.co/storage/v1/object/public/photos/lifestyle/samoussas-450-a.jpg',
  disponible: true, en_avant: true, populaire: true, options: [], ordre: 0,
}];

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
let ok = 0, ko = 0;
function t(nom, reel, attendu) {
  const bon = JSON.stringify(reel) === JSON.stringify(attendu);
  if (bon) { ok++; console.log('  OK    ' + nom); }
  else { ko++; console.log('  ECHEC ' + nom + '\n        attendu ' + JSON.stringify(attendu) + '\n        recu    ' + JSON.stringify(reel)); }
}
function tv(nom, cond, detail) {
  if (cond) { ok++; console.log('  OK    ' + nom + (detail ? '  [' + detail + ']' : '')); }
  else { ko++; console.log('  ECHEC ' + nom + (detail ? '  [' + detail + ']' : '')); }
}

async function ctx(browser, opts = {}) {
  const c = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 780 } });
  await c.route('**://fonts.googleapis.com/**', r => r.abort());
  await c.route('**://fonts.gstatic.com/**', r => r.abort());
  await c.route('**://ex.supabase.co/storage/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  if (opts.supabase === 'normal' || opts.supabase === 'lent') {
    await c.route('**/rest/v1/produits**', async r => {
      if (opts.supabase === 'lent') await new Promise(res => setTimeout(res, 4000));
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LIGNES) });
    });
    await c.route('**/rest/v1/reglages**', async r => {
      if (opts.supabase === 'lent') await new Promise(res => setTimeout(res, 4000));
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  } else if (opts.supabase === 'injoignable') {
    await c.route('**/rest/v1/**', r => r.abort('connectionrefused'));
  }
  return c;
}

(async () => {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});

  console.log('\n=== FIA-1 : le site utilise-t-il les vignettes 450 px ? ===');
  {
    const c = await ctx(browser, { supabase: 'normal' });
    const p = await c.newPage();
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.ZF && window.ZF.sourceDonnees === 'supabase', null, { timeout: 10000 });
    await p.waitForTimeout(400);
    const d = await p.evaluate(() => ({
      thumb: PRODUCTS[0].productThumb, image: PRODUCTS[0].productImage,
      lifeThumb: PRODUCTS[0].lifestyleThumb, lifeImage: PRODUCTS[0].lifestyleImage,
      carteProduit: document.querySelector('.card__img--product').getAttribute('src'),
      carteVie: document.querySelector('.card__img--life').getAttribute('src'),
    }));
    tv('carte du menu : vignette 450 px', /-450-/.test(d.carteProduit), d.carteProduit.split('/').pop());
    tv('carte du menu : scene de vie 450 px', /-450-/.test(d.carteVie), d.carteVie.split('/').pop());
    tv('productThumb = petite', /-450-/.test(d.thumb), d.thumb.split('/').pop());
    tv('lifestyleThumb = petite', /-450-/.test(d.lifeThumb), d.lifeThumb.split('/').pop());
    tv('productImage reste la grande (fiche produit)', /-900-/.test(d.image), d.image.split('/').pop());
    tv('lifestyleImage reste la grande', /-900-/.test(d.lifeImage), d.lifeImage.split('/').pop());

    const pp = await c.newPage();
    await pp.goto(BASE + '/produit.html?p=samoussas', { waitUntil: 'load' });
    await pp.waitForFunction(() => window.ZF && window.ZF.sourceDonnees === 'supabase', null, { timeout: 10000 });
    await pp.waitForTimeout(600);
    const fiche = await pp.evaluate(() => ({
      grande: document.querySelector('#stage-product') && document.querySelector('#stage-product').getAttribute('src'),
      vie: document.querySelector('#stage-life') && document.querySelector('#stage-life').getAttribute('src'),
    }));
    tv('fiche produit : grande image 900 px', /-900-/.test(fiche.grande), (fiche.grande || '').split('/').pop());
    tv('fiche produit : scene de vie 900 px', /-900-/.test(fiche.vie), (fiche.vie || '').split('/').pop());
    await c.close();
  }

  console.log('\n=== FIA-2 : la page attend-elle encore Supabase ? (base lente 4 s) ===');
  {
    const c = await ctx(browser, { supabase: 'lent' });
    const p = await c.newPage();
    const t0 = Date.now();
    await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(700);
    const etat = await p.evaluate(() => ({
      cartes: document.querySelectorAll('.card').length,
      filtres: document.querySelectorAll('.cat-pill').length,
      barreInfo: document.querySelector('#info-bar').textContent.trim().length,
      footerCategories: document.querySelector('#footer-categories').children.length,
      footerContact: document.querySelector('#footer-contact').children.length,
      tiroirPanier: !!document.querySelector('#cart-drawer'),
      barreMobile: !!document.querySelector('.mobile-bar'),
      boutonWa: !!document.querySelector('.wa-fab'),
      aboutPoints: document.querySelector('#about-points').children.length,
      source: window.ZF.sourceDonnees,
    }));
    console.log('  etat a T+' + (Date.now() - t0) + ' ms : ' + JSON.stringify(etat));
    tv('cartes produits affichees', etat.cartes > 0, etat.cartes + ' cartes');
    tv('filtres de categories affiches', etat.filtres > 0, etat.filtres + ' filtres');
    tv('barre d information remplie', etat.barreInfo > 0);
    tv('pied de page rempli', etat.footerCategories > 0 && etat.footerContact > 0);
    tv('tiroir panier present', etat.tiroirPanier);
    tv('barre mobile presente', etat.barreMobile);
    tv('bouton WhatsApp present', etat.boutonWa);
    tv('points A propos remplis', etat.aboutPoints > 0);

    await p.waitForFunction(() => window.ZF.sourceDonnees === 'supabase', null, { timeout: 15000 });
    await p.waitForTimeout(500);
    const apres = await p.evaluate(() => ({
      cartes: document.querySelectorAll('.card').length,
      nom: document.querySelector('.card__title a').textContent,
      src: document.querySelector('.card__img--product').getAttribute('src'),
    }));
    tv('mise a jour silencieuse quand la base repond', apres.nom === 'Samoussas croustillants' && /-450-/.test(apres.src),
       apres.nom + ' / ' + apres.src.split('/').pop());
    await c.close();
  }

  console.log('\n=== FIA-4 : cache local reutilise a la visite suivante ===');
  {
    const c = await ctx(browser, { supabase: 'normal' });
    const p = await c.newPage();
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.ZF.sourceDonnees === 'supabase', null, { timeout: 10000 });
    const cache = await p.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('zaidat_donnees_v1'));
      return { v: d.v, produits: d.produits.length, prix: d.produits[0].prix };
    });
    tv('cache ecrit apres reponse de la base', cache.produits === 1 && cache.prix === 1500, JSON.stringify(cache));
    await c.close();

    // Nouvelle visite, base injoignable : le cache doit servir
    const c2 = await browser.newContext({ viewport: { width: 390, height: 780 }, storageState: undefined });
    await c2.route('**://fonts.googleapis.com/**', r => r.abort());
    await c2.route('**://ex.supabase.co/storage/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    await c2.route('**/rest/v1/**', r => r.abort('connectionrefused'));
    const p2 = await c2.newPage();
    await p2.goto(BASE + '/index.html', { waitUntil: 'load' });
    // On injecte le cache tel qu'il aurait ete laisse par la visite precedente
    await p2.evaluate((lignes) => {
      localStorage.setItem('zaidat_donnees_v1', JSON.stringify({ v: 1, at: Date.now(), produits: lignes, reglages: {} }));
    }, LIGNES);
    await p2.reload({ waitUntil: 'load' });
    await p2.waitForTimeout(800);
    const r2 = await p2.evaluate(() => ({
      source: window.ZF.sourceDonnees,
      cartes: document.querySelectorAll('.card').length,
      prix: document.querySelector('.card__price') && document.querySelector('.card__price').textContent,
      nom: document.querySelector('.card__title a') && document.querySelector('.card__title a').textContent,
    }));
    console.log('  ' + JSON.stringify(r2));
    tv('base injoignable : le cache prend le relais', /cache/.test(r2.source), r2.source);
    tv('les vrais prix survivent a la panne', /1\s*500/.test(r2.prix || ''), r2.prix);
    tv('pas de page vide', r2.cartes > 0, r2.cartes + ' cartes');
    await c2.close();
  }

  console.log('\n=== FIA-2 bis : pages legales sans appel a la base ===');
  {
    const c = await ctx(browser, { supabase: 'normal' });
    const p = await c.newPage();
    const appels = [];
    p.on('request', r => { if (/\/rest\/v1\//.test(r.url())) appels.push(r.url()); });
    await p.goto(BASE + '/confidentialite.html', { waitUntil: 'load' });
    await p.waitForTimeout(1200);
    tv('page confidentialite : aucun appel Supabase', appels.length === 0, appels.length + ' appel(s)');
    const rendu = await p.evaluate(() => ({
      footer: document.querySelector('#footer-year').textContent,
      panier: !!document.querySelector('#cart-drawer'),
    }));
    tv('page legale correctement rendue', rendu.panier && rendu.footer.length === 4, JSON.stringify(rendu));
    await c.close();
  }

  await browser.close();
  console.log('\n=== ' + ok + ' reussis, ' + ko + ' echoues ===');
  process.exit(ko ? 1 : 0);
})();
