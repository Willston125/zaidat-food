/* Affiche d'annonce : ce que voit le visiteur, et ce qui la retient. */
const A = require('../outils/supabase-simule.js');
const IMG = '/assets/img/partage-1200x630.jpg';   /* une image reelle du site */

async function page(b, affiche, url, viewport) {
  const etat = A.etatNeuf();
  const { c, p, erreurs } = await A.ouvrir(b, etat, viewport);
  await p.addInitScript((a) => {
    window.__affiche = a;
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof SITE_CONFIG !== 'undefined') SITE_CONFIG.affiche = window.__affiche;
    });
  }, affiche);
  await p.goto(A.BASE + (url || '/index.html'), { waitUntil: 'load' });
  return { c, p, erreurs };
}
const visible = (p) => p.evaluate(() => !!document.querySelector('.affiche.est-visible'));
const demain = () => { const d = new Date(Date.now() + 864e5); return d.toISOString().slice(0, 10); };
const hier   = () => { const d = new Date(Date.now() - 864e5); return d.toISOString().slice(0, 10); };
const base = { actif: true, image: IMG, imagePetite: IMG, alt: "Gateaux de l'Aid", lien: '', finLe: '', fermetureAuto: 0 };

(async () => {
  const b = await A.chromium.launch(A.EXE ? { executablePath: A.EXE } : {});

  console.log('\n=== 1. Elle apparait, et se ferme a la croix ===');
  {
    const { c, p, erreurs } = await page(b, base);
    /* Mesure depuis le debut de la navigation, pas depuis l'instant
       ou la sonde demarre : l'affiche pouvait deja etre la. */
    const apparue = await p.evaluate(() => new Promise((ok) => {
      const quand = () => Math.round(performance.now());
      if (document.querySelector('.affiche')) return ok(quand());
      const obs = new MutationObserver(() => {
        if (document.querySelector('.affiche')) { obs.disconnect(); ok(quand()); }
      });
      obs.observe(document.body, { childList: true });
      setTimeout(() => { obs.disconnect(); ok(-1); }, 6000);
    }));
    console.log('    apparue ' + apparue + ' ms apres le debut de la navigation');
    A.tv('elle apparait', apparue >= 0);
    A.tv('elle laisse la page s afficher d abord', apparue > 1000, apparue + ' ms');
    await p.waitForTimeout(600);
    const d = await p.evaluate(() => {
      const r = document.querySelector('.affiche');
      const btn = r.querySelector('.affiche__fermer').getBoundingClientRect();
      return { role: r.getAttribute('role'), modal: r.getAttribute('aria-modal'), label: r.getAttribute('aria-label'),
               btn: Math.round(btn.width) + 'x' + Math.round(btn.height),
               focus: document.activeElement.className, fige: getComputedStyle(document.body).overflow };
    });
    console.log('    ' + JSON.stringify(d));
    A.tv('c est bien une boite de dialogue annoncee', d.role === 'dialog' && d.modal === 'true' && /Aid/.test(d.label));
    A.tv('la croix fait au moins 44 px', d.btn === '44x44', d.btn);
    A.tv('le focus va sur la croix', /affiche__fermer/.test(d.focus));
    A.tv('le fond ne defile plus', d.fige === 'hidden');
    await p.click('.affiche__fermer');
    await p.waitForTimeout(400);
    A.tv('la croix la ferme', !(await p.evaluate(() => !!document.querySelector('.affiche'))));
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2600);
    A.tv('UNE SEULE FOIS : elle ne revient pas', !(await visible(p)));
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  console.log('\n=== 2. Echap, clic a cote, et piege a focus ===');
  for (const [nom, geste] of [['Echap', async p => p.keyboard.press('Escape')],
                              ['clic a cote', async p => p.click('.affiche__voile', { position: { x: 5, y: 5 } })]]) {
    const { c, p } = await page(b, base);
    await p.waitForTimeout(2600);
    A.tv('ouverte avant le geste (' + nom + ')', await visible(p));
    await geste(p); await p.waitForTimeout(400);
    A.tv(nom + ' la ferme', !(await p.evaluate(() => !!document.querySelector('.affiche'))));
    await c.close();
  }
  {
    const { c, p } = await page(b, Object.assign({}, base, { lien: 'index.html#menu' }));
    await p.waitForTimeout(2600);
    const suite = [];
    for (let i = 0; i < 4; i++) { await p.keyboard.press('Tab'); suite.push(await p.evaluate(() => document.activeElement.className)); }
    A.tv('le clavier reste dans l affiche', suite.every(cl => /affiche__/.test(cl)), JSON.stringify(suite));
    await c.close();
  }

  console.log('\n=== 3. Les regles qui la retiennent ===');
  const cas = [
    ['desactivee', Object.assign({}, base, { actif: false }), '/index.html', false],
    ['date passee', Object.assign({}, base, { finLe: hier() }), '/index.html', false],
    ['date de fin aujourd hui ou plus tard', Object.assign({}, base, { finLe: demain() }), '/index.html', true],
    ['page panier', base, '/commande.html', false],
    ['image introuvable', Object.assign({}, base, { image: '/assets/img/inexistante.jpg', imagePetite: '' }), '/index.html', false],
  ];
  for (const [nom, af, url, attendu] of cas) {
    const { c, p, erreurs } = await page(b, af, url);
    await p.waitForTimeout(2800);
    A.tv(nom + ' -> ' + (attendu ? 'affichee' : 'pas d affiche'), (await visible(p)) === attendu);
    A.tv('aucune erreur JavaScript (' + nom + ')', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  console.log('\n=== 4. Fermeture automatique et decompte ===');
  {
    const { c, p } = await page(b, Object.assign({}, base, { fermetureAuto: 20 }));
    await p.waitForTimeout(2600);
    const lire = () => p.evaluate(() => {
      const e = document.querySelector('.affiche__compte');
      const m = e && e.textContent.match(/Fermeture dans (\d+) s/);
      return m ? Number(m[1]) : null;
    });
    const t1 = await lire();
    A.tv('le decompte est annonce', t1 !== null && t1 >= 15 && t1 <= 20, 'reste ' + t1 + ' s');
    await p.waitForTimeout(1100);
    const t2 = await lire();
    A.tv('il descend', t2 !== null && t1 !== null && t2 < t1, t1 + ' s -> ' + t2 + ' s');
    await p.evaluate(() => {   /* on ne va pas attendre vingt secondes */
      const e = document.querySelector('.affiche__fermer'); if (e) e.click();
    });
    await p.waitForTimeout(400);
    A.tv('elle se ferme quand le minuteur ou la croix agit', !(await p.evaluate(() => !!document.querySelector('.affiche'))));
    await c.close();
  }

  console.log('\n=== 5. Telephone 360 px ===');
  {
    const { c, p, erreurs } = await page(b, base, '/index.html', { width: 360, height: 740 });
    await p.waitForTimeout(2600);
    const d = await p.evaluate(() => {
      const r = document.querySelector('.affiche__boite').getBoundingClientRect();
      return { l: Math.round(r.width), h: Math.round(r.height), dansEcran: r.top >= -1 && r.bottom <= innerHeight + 1,
               debord: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth) };
    });
    console.log('    ' + JSON.stringify(d));
    A.tv('l affiche tient dans l ecran', d.dansEcran && d.l <= 360);
    A.tv('aucun debordement horizontal', d.debord === 0, d.debord + 'px');
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  await b.close();
  process.exit(A.bilan('AFFICHE — site') ? 1 : 0);
})();
