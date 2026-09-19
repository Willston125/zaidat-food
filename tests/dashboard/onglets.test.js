const { chromium } = require('playwright');
const EXE = require('../outils/navigateur').EXE;
const PROJET = 'dhhhdlthsxvscantcyir.supabase.co';
const LIGNES = [1,2].map(i => ({
  id:'id'+i, slug:'p'+i, nom:'Produit '+i, description_courte:'c', description:'d',
  prix:1000, categorie:'snacks',
  image_produit:'https://'+PROJET+'/storage/v1/object/public/photos/produits/p'+i+'-900-a.jpg',
  image_produit_petite:'https://'+PROJET+'/storage/v1/object/public/photos/produits/p'+i+'-450-a.jpg',
  image_lifestyle:'', image_lifestyle_petite:'', disponible:true, en_avant:false,
  populaire:false, options:[], ordre:i, modifie_le:'2026-09-01T10:00:0'+i+'+00:00' }));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');

(async () => {
  const b = await chromium.launch(EXE ? { executablePath: EXE } : {});
  let ko = 0;
  for (const largeur of [360, 1440]) {
    const c = await b.newContext({ viewport: { width: largeur, height: 900 } });
    await c.route('**://'+PROJET+'/storage/**', r => r.fulfill({status:200,contentType:'image/png',body:PNG}));
    await c.route('**://'+PROJET+'/**', r => {
      const u = r.request().url();
      const j = (x) => r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(x)});
      if (u.includes('/auth/v1/token')) {
        const ch = Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
        return j({access_token:'a.'+ch+'.b', refresh_token:'r', user:{email:'c@z.test'}});
      }
      if (u.includes('rpc/est_administrateur')) return j(true);
      if (u.includes('/rest/v1/administrateurs')) return j([{id:'u1'}]);
      if (u.includes('/rest/v1/produits')) return j(LIGNES);
      return j([]);
    });
    const p = await c.newPage();
    const err = [];
    p.on('pageerror', e => err.push(e.message));
    p.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) err.push(m.text()); });
    await p.goto('http://127.0.0.1:8123/admin/index.html', { waitUntil:'load' });
    await p.waitForTimeout(1200);
    await p.click('.adm-nav__item[data-vue="connexion"]'); await p.waitForTimeout(300);
    await p.fill('#sb-email','c@z.test'); await p.fill('#sb-mdp','x');
    await p.click('#sb-connecter'); await p.waitForTimeout(1500);

    console.log('\n--- dashboard a ' + largeur + ' px ---');
    for (const vue of ['produits','categories','textes','contact','galerie','temoignages','affiche','connexion']) {
      const avant = err.length;
      await p.click('.adm-nav__item[data-vue="'+vue+'"]');
      await p.waitForTimeout(700);
      const d = await p.evaluate(() => ({
        contenu: document.querySelector('#adm-vue').innerText.trim().length,
        h1: (document.querySelector('#adm-vue h1')||{}).textContent,
        debordement: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      const nouvelles = err.slice(avant);
      const bon = d.contenu > 30 && nouvelles.length === 0 && d.debordement === 0;
      if (!bon) ko++;
      console.log(`  ${bon?'OK   ':'ECHEC'} onglet ${vue.padEnd(13)} « ${(d.h1||'?').padEnd(22)} » ${d.contenu} car., debordement ${d.debordement}px` +
                  (nouvelles.length ? ' ERREURS: ' + nouvelles.join(' | ') : ''));
    }
    // Ouvrir le tiroir d'edition et la modale, puis fermer
    await p.click('.adm-nav__item[data-vue="produits"]'); await p.waitForTimeout(400);
    const avant = err.length;
    await p.click('.adm-produit[data-index="0"] button[data-action="modifier"]'); await p.waitForTimeout(500);
    const tiroir = await p.evaluate(() => ({
      ouvert: !document.querySelector('#adm-tiroir').hidden,
      champs: document.querySelectorAll('#tiroir-corps input, #tiroir-corps select, #tiroir-corps textarea').length,
    }));
    await p.click('#tiroir-fermer'); await p.waitForTimeout(400);
    const ferme = await p.evaluate(() => document.querySelector('#adm-tiroir').hidden);
    const bon = tiroir.ouvert && tiroir.champs > 8 && ferme && err.length === avant;
    if (!bon) ko++;
    console.log(`  ${bon?'OK   ':'ECHEC'} tiroir produit  ${tiroir.champs} champs, ouverture et fermeture`);
    await c.close();
  }
  await b.close();
  console.log('\n=== ' + (ko ? ko + ' ECHECS' : 'tous les ecrans du dashboard fonctionnent') + ' ===');
  process.exit(ko?1:0);
})();
