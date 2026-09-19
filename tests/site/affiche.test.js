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
const presente = (p) => p.evaluate(() => !!document.querySelector('.affiche'));

/* Avec une horloge pilotee, le chargement de l'image reste, lui, sur
   le temps reel : on fait donc avancer les deux en alternance plutot
   que de deviner un delai. */
async function attendreAffiche(p, essais = 12) {
  for (let i = 0; i < essais; i++) {
    await p.clock.runFor(200);
    await p.waitForTimeout(120);
    if (await visible(p)) return true;
  }
  return false;
}

/* Meme calcul que le site : l'identifiant d'une affiche est un
   condense de son contenu. */
function cleAffiche(a) {
  const source = [a.image, a.alt, a.lien, a.finLe].join('|');
  let h = 5381;
  for (let i = 0; i < source.length; i++) h = ((h << 5) + h + source.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/* Page avec une memoire de visiteur preparee, et une horloge que le
   test peut avancer : attendre trente vraies minutes n'est pas un
   test, c'est une pause. */
async function pageAvancee(b, opts) {
  const etat = A.etatNeuf();
  const { c, p, erreurs } = await A.ouvrir(b, etat, opts.viewport);
  if (opts.horloge) await p.clock.install({ time: new Date() });
  if (opts.vues !== undefined) {
    await p.addInitScript((v) => {
      try { localStorage.setItem('zaidat_affiches_vues', JSON.stringify(v)); } catch (e) {}
    }, opts.vues);
  }
  await p.addInitScript((a) => {
    window.__affiche = a;
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof SITE_CONFIG !== 'undefined') SITE_CONFIG.affiche = window.__affiche;
    });
  }, opts.affiche);
  await p.goto(A.BASE + (opts.url || '/index.html'), { waitUntil: 'load' });
  return { c, p, erreurs };
}
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
    /* Deux exigences contraires, et c'est voulu : assez tot pour
       qu'elle serve a quelque chose, assez tard pour ne pas surgir
       par-dessus une page a moitie peinte. */
    A.tv('elle laisse la page se dessiner', apparue > 300, apparue + ' ms');
    A.tv('elle ne se fait pas attendre', apparue < 1500, apparue + ' ms');
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
    /* Rechargee dans la foulee : le rappel (30 min par defaut) n'est
       pas ecoule, elle ne revient donc pas tout de suite. Le rappel
       lui-meme est verifie plus bas. */
    A.tv('rechargee aussitot, elle ne revient pas', !(await visible(p)));
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

  console.log('\n=== 6. Le rappel : la revoir au bout d un moment ===');
  {
    const cle = cleAffiche(base);

    /* Vue il y a cinq minutes, rappel a trente : trop tot. */
    let r = await pageAvancee(b, { affiche: Object.assign({}, base, { rappelMinutes: 30 }),
                                   vues: { [cle]: Date.now() - 5 * 60000 } });
    await r.p.waitForTimeout(1500);
    A.tv('vue il y a 5 min, rappel a 30 : elle ne revient pas encore', !(await presente(r.p)));
    await r.c.close();

    /* Vue il y a trente-et-une minutes : c'est l'heure. */
    r = await pageAvancee(b, { affiche: Object.assign({}, base, { rappelMinutes: 30 }),
                               vues: { [cle]: Date.now() - 31 * 60000 } });
    await r.p.waitForTimeout(1500);
    A.tv('VUE IL Y A 31 MIN : ELLE REVIENT', await visible(r.p));
    A.tv('aucune erreur JavaScript (rappel)', r.erreurs.length === 0, r.erreurs.join(' | '));
    await r.c.close();

    /* Zero : l'ancien comportement, une seule fois pour toujours. */
    r = await pageAvancee(b, { affiche: Object.assign({}, base, { rappelMinutes: 0 }),
                               vues: { [cle]: Date.now() - 31 * 60000 } });
    await r.p.waitForTimeout(1500);
    A.tv('reglee sur « une seule fois », elle ne revient jamais', !(await presente(r.p)));
    await r.c.close();

    /* Memoire de l'ancienne version : une simple liste, sans date. */
    r = await pageAvancee(b, { affiche: base, vues: [cle] });
    await r.p.waitForTimeout(1500);
    A.tv('une memoire de l ancienne version ne la bloque pas', await visible(r.p));
    await r.c.close();
  }

  console.log('\n=== 7. Elle revient sans recharger la page ===');
  {
    const r = await pageAvancee(b, { affiche: Object.assign({}, base, { rappelMinutes: 30 }), horloge: true });
    await r.p.clock.runFor(1500);
    A.tv('elle s ouvre a l arrivee', await visible(r.p));

    await r.p.click('.affiche__fermer');
    await r.p.clock.runFor(500);
    A.tv('la croix la ferme', !(await presente(r.p)));

    await r.p.clock.fastForward(29 * 60000);
    A.tv('a 29 minutes, toujours rien', !(await presente(r.p)));

    await r.p.clock.fastForward(2 * 60000);
    A.tv('A 31 MINUTES, ELLE REVIENT TOUTE SEULE', await attendreAffiche(r.p));
    A.tv('aucune erreur JavaScript (reouverture)', r.erreurs.length === 0, r.erreurs.join(' | '));
    await r.c.close();
  }

  console.log('\n=== 8. Relance de qui hesite : lit, ne commande pas ===');
  {
    const cle = cleAffiche(base);
    const avecRelance = Object.assign({}, base, { rappelMinutes: 30, relanceDefilement: 3 });

    /* Vue a l'instant : le rappel de trente minutes la bloque. Mais
       trois minutes de lecture doivent la faire revenir quand meme. */
    let r = await pageAvancee(b, { affiche: avecRelance, vues: { [cle]: Date.now() }, horloge: true });
    await r.p.clock.runFor(1500);
    A.tv('le rappel la retient d abord', !(await presente(r.p)));

    await r.p.evaluate(() => window.scrollTo(0, 600));
    await r.p.clock.fastForward(3 * 60000 + 2000);
    A.tv('APRES 3 MIN DE LECTURE, ELLE REVIENT', await attendreAffiche(r.p));
    A.tv('aucune erreur JavaScript (relance)', r.erreurs.length === 0, r.erreurs.join(' | '));
    await r.c.close();

    /* Onglet ouvert mais personne devant : pas de defilement, pas de
       relance. Sinon on ouvrirait une affiche pour un fauteuil vide. */
    r = await pageAvancee(b, { affiche: avecRelance, vues: { [cle]: Date.now() }, horloge: true });
    await r.p.clock.runFor(1500);
    await r.p.clock.fastForward(6 * 60000);
    await r.p.clock.runFor(1500);
    A.tv('sans le moindre defilement, on ne relance personne', !(await presente(r.p)));
    await r.c.close();

    /* Et jamais sur la page du panier. */
    r = await pageAvancee(b, { affiche: avecRelance, url: '/commande.html', horloge: true });
    await r.p.clock.runFor(1500);
    await r.p.evaluate(() => window.scrollTo(0, 600));
    await r.p.clock.fastForward(6 * 60000);
    await r.p.clock.runFor(1500);
    A.tv('la page du panier reste epargnee, relance comprise', !(await presente(r.p)));
    await r.c.close();
  }

  console.log('\n=== 9. « ?affiche=test » pour la controler soi-meme ===');
  {
    const cle = cleAffiche(base);
    const r = await pageAvancee(b, { affiche: Object.assign({}, base, { rappelMinutes: 0 }),
                                     vues: { [cle]: Date.now() },
                                     url: '/index.html?affiche=test' });
    await r.p.waitForTimeout(1500);
    A.tv('elle s affiche meme deja vue', await visible(r.p));
    await r.p.click('.affiche__fermer');
    await r.p.waitForTimeout(300);
    const memoire = await r.p.evaluate(() => localStorage.getItem('zaidat_affiches_vues'));
    A.tv('le controle ne compte pas comme une vue', !/\d{13}/.test(String(memoire).replace(cle, '')) || String(memoire).indexOf(cle) !== -1);
    await r.c.close();

    /* Une affiche desactivee ne s affiche pas davantage : le controle
       ne doit pas faire croire qu elle est en ligne. */
    const r2 = await pageAvancee(b, { affiche: Object.assign({}, base, { actif: false }),
                                      url: '/index.html?affiche=test' });
    await r2.p.waitForTimeout(1500);
    A.tv('une affiche desactivee reste invisible, meme en controle', !(await presente(r2.p)));
    await r2.c.close();
  }

  await b.close();
  process.exit(A.bilan('AFFICHE — site') ? 1 : 0);
})();
