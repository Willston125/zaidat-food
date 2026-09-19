/* =========================================================
   Quand la regle de securite du stockage refuse un dossier,
   Supabase repond « new row violates row-level security policy ».
   Ce message ne dit rien a la personne qui doit le reparer, et il
   arrive en 403 — le meme code qu'un jeton perime, ce qui faisait
   renvoyer la photo pour se faire refuser a l'identique.

   On verifie donc deux choses : le message nomme le dossier et la
   marche a suivre, et aucun renouvellement inutile n'est tente.
   ========================================================= */
const A = require('../outils/supabase-simule.js');
const PHOTO = require('path').join(__dirname, '..', 'media', 'photo.jpg');

(async () => {
  const b = await A.chromium.launch(A.EXE ? { executablePath: A.EXE } : {});
  const etat = A.etatNeuf({ refusStockage: true });
  const { c, p, erreurs } = await A.ouvrir(b, etat);
  await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await A.connecter(p);

  await p.click('.adm-nav__item[data-vue="affiche"]');
  await p.waitForTimeout(700);
  await p.setInputFiles('#af-fichier', PHOTO);
  await p.waitForTimeout(2500);
  await p.click('.adm-modale [data-valider]');
  await p.waitForTimeout(3000);

  const toast = await p.evaluate(() => (document.querySelector('#adm-toast') || {}).textContent || '');
  console.log('    message affiche : ' + toast);

  A.tv('LE MESSAGE NOMME LE DOSSIER REFUSE', /affiches/.test(toast), toast.slice(0, 90));
  A.tv('il dit quoi faire', /supabase-installation\.sql/.test(toast));
  A.tv('il rassure sur la photo', /toujours là|rien n'a été envoyé/i.test(toast));
  A.tv('il ne montre plus le charabia de la base',
       !/statusCode|AccessDenied|row-level/.test(toast));

  const envois = etat.appels.filter(a => a.startsWith('POST /storage/'));
  A.tv('la photo n est pas renvoyee pour rien', envois.length === 1, envois.length + ' envoi(s)');
  const renouv = etat.appels.filter(a => a.includes('grant_type=refresh_token'));
  A.tv('aucun renouvellement de jeton inutile', renouv.length === 0, renouv.length + ' renouvellement(s)');

  A.tv('le bouton propose de reessayer',
       /Réessayer/.test(await p.evaluate(() => {
         const btn = document.querySelector('.adm-modale [data-valider]');
         return btn ? btn.textContent : '';
       })));
  A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));

  await c.close(); await b.close();
  process.exit(A.bilan('STOCKAGE — dossier refuse par la base') ? 1 : 0);
})();
