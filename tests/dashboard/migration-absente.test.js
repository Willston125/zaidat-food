const { chromium } = require('playwright');
const EXE = require('../outils/navigateur').EXE;
const PROJET = 'dhhhdlthsxvscantcyir.supabase.co';
(async () => {
  const b = await chromium.launch(EXE ? { executablePath: EXE } : {});
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await c.route('**://'+PROJET+'/**', r => {
    const u = r.request().url();
    const j = (x,s=200) => r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(x)});
    if (u.includes('/auth/v1/token')) {
      const ch = Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
      return j({access_token:'a.'+ch+'.b',refresh_token:'r',user:{email:'c@z.test'}});
    }
    if (u.includes('rpc/est_administrateur')) return j(true);
    if (u.includes('/rest/v1/administrateurs')) return j([{id:'u1'}]);
    if (u.includes('modifie_le')) {
      // Ce que PostgREST renvoie vraiment quand la colonne n'existe pas
      return j({ code:'42703', message:'column produits.modifie_le does not exist' }, 400);
    }
    if (u.includes('/rest/v1/produits')) return j([{id:'i1',slug:'p1',nom:'P1',categorie:'snacks',
      image_produit:'assets/img/products/samoussas-900.jpg',prix:1000,disponible:true,options:[],ordre:0}]);
    return j([]);
  });
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:8123/admin/index.html', { waitUntil:'load' });
  await p.waitForTimeout(1200);
  await p.click('.adm-nav__item[data-vue="connexion"]'); await p.waitForTimeout(300);
  await p.fill('#sb-email','c@z.test'); await p.fill('#sb-mdp','x');
  await p.click('#sb-connecter'); await p.waitForTimeout(1500);
  await p.click('.adm-nav__item[data-vue="produits"]'); await p.waitForTimeout(500);
  await p.click('.adm-produit[data-index="0"] button[data-action="modifier"]'); await p.waitForTimeout(400);
  await p.fill('#p-prix','1234'); await p.click('#tiroir-valider'); await p.waitForTimeout(400);
  await p.click('#btn-publier'); await p.waitForTimeout(500);
  await p.click('#pub-confirmer'); await p.waitForTimeout(2000);
  const msg = await p.evaluate(() => document.querySelector('#pub-corps').innerText);
  const utile = /supabase-installation\.sql/.test(msg);
  console.log('  message affiche :', msg.split('\n').filter(l=>/colonne|script/i.test(l)).join(' ').slice(0,200));
  console.log(utile ? '  OK    message actionnable, pas d erreur technique brute'
                    : '  ECHEC message incomprehensible : ' + msg.slice(0,200));
  await b.close();
  process.exit(utile?0:1);
})();
