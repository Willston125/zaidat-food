const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8123';
const EXE = require('../outils/navigateur').EXE;
let ok = 0, ko = 0;
function tv(nom, cond, detail) {
  if (cond) { ok++; console.log('  OK    ' + nom + (detail ? '  [' + detail + ']' : '')); }
  else { ko++; console.log('  ECHEC ' + nom + (detail ? '  [' + detail + ']' : '')); }
}

(async () => {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
  for (const w of [320, 360, 390, 1440]) {
    const c = await browser.newContext({ viewport: { width: w, height: 800 } });
    await c.route('**/rest/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    const p = await c.newPage();
    const erreurs = [];
    p.on('pageerror', e => erreurs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') erreurs.push('[console] ' + m.text()); });
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(700);
    const d = await p.evaluate(() => {
      const strong = document.querySelector('.brand strong');
      const rs = strong.getBoundingClientRect();
      // Un élément opaque recouvre-t-il le nom de la marque ?
      const milieu = document.elementFromPoint(rs.left + rs.width - 3, rs.top + rs.height / 2);
      const add = document.querySelector('.card__add');
      const ra = add ? add.getBoundingClientRect() : null;
      const petitsLiens = [];
      document.querySelectorAll('.site-footer li a, .footer-note a, .card__title a').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.height < 24) petitsLiens.push(el.textContent.trim().slice(0, 20) + ' h=' + Math.round(r.height));
      });
      return {
        marqueLargeurNecessaire: strong.scrollWidth,
        marqueLargeurDisponible: Math.round(rs.width),
        marqueRecouverte: !!(milieu && !strong.contains(milieu) && milieu !== strong),
        recouvrePar: milieu ? (milieu.tagName + '.' + (milieu.className || '')).slice(0, 40) : null,
        boutonAjout: ra ? Math.round(ra.width) + 'x' + Math.round(ra.height) : null,
        petitsLiens: petitsLiens,
        debordement: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        police: getComputedStyle(strong).fontFamily.split(',')[0],
      };
    });
    console.log('\n--- ' + w + ' px ---');
    tv('nom de la marque entierement visible', !d.marqueRecouverte,
       d.marqueLargeurNecessaire + 'px necessaires / ' + d.marqueLargeurDisponible + 'px alloues' +
       (d.marqueRecouverte ? ' recouvert par ' + d.recouvrePar : ''));
    tv('bouton + au moins 44x44', d.boutonAjout === null || (parseInt(d.boutonAjout) >= 44), d.boutonAjout || 'absent');
    tv('aucun lien sous 24 px', d.petitsLiens.length === 0, d.petitsLiens.join(' | ') || 'aucun');
    tv('aucun debordement horizontal', d.debordement === 0, d.debordement + 'px');
    tv('aucune erreur console', erreurs.length === 0, erreurs.join(' | ') || 'aucune');
    await c.close();
  }
  await browser.close();
  console.log('\n=== ' + ok + ' reussis, ' + ko + ' echoues ===');
  process.exit(ko ? 1 : 0);
})();
