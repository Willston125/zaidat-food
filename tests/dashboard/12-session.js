/* =========================================================
   La session du dashboard doit survivre a deux choses :

     1. un retour le lendemain, quand le jeton d'acces a expire.
        Le dashboard part alors sur PLUSIEURS requetes en parallele,
        et le jeton de rafraichissement Supabase ne sert qu'une fois :
        sans precaution, la premiere le consomme et les suivantes se
        font refuser — deconnexion d'une session parfaitement valide ;

     2. une coupure reseau au milieu d'un enregistrement. Elle ne doit
        jamais effacer la session : le jeton de rafraichissement est
        la seule chose qui evite de retaper son mot de passe.

   Le faux serveur applique ici la regle du jeton a usage unique,
   comme le vrai GoTrue.
   ========================================================= */
const A = require('../outils/supabase-simule.js');

const EMAIL = 'cuisiniere@zaidat.test';
function sessionStockee(jeton, refresh) {
  return JSON.stringify({ access_token: jeton, refresh_token: refresh, user: { email: EMAIL } });
}
async function lireStockage(p) {
  return p.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('zaidat_session_v1')); } catch (e) { return null; }
  });
}

(async () => {
  const b = await A.chromium.launch(A.EXE ? { executablePath: A.EXE } : {});

  /* ---------- 1. Retour le lendemain : jeton d'acces perime ---------- */
  {
    const etat = A.etatNeuf({ auth: A.authNeuve() });
    const { c, p, erreurs } = await A.ouvrir(b, etat);
    await c.addInitScript((s) => {
      try { localStorage.setItem('zaidat_session_v1', s); } catch (e) {}
    }, sessionStockee(A.jeton(-60), 'r0'));

    await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(3000);

    A.tv('un seul renouvellement malgre les appels paralleles',
         etat.auth.appels === 1, etat.auth.appels + ' appel(s)');
    A.tv('aucun jeton refuse', etat.auth.refus === 0, etat.auth.refus + ' refus');

    const sess = await lireStockage(p);
    A.tv('LA SESSION EST CONSERVEE', !!(sess && sess.access_token), JSON.stringify(sess && Object.keys(sess)));
    A.tv('le jeton de rafraichissement a bien tourne',
         !!(sess && sess.refresh_token === 'r1'), sess && sess.refresh_token);

    await p.click('.adm-nav__item[data-vue="connexion"]');
    await p.waitForTimeout(400);
    const texte = await p.evaluate(() => document.querySelector('#adm-vue').innerText);
    A.tv('le dashboard la reconnait toujours', /Connectée et autorisée/.test(texte),
         texte.split('\n').slice(0, 2).join(' / '));
    A.tv('les produits sont bien charges',
         await p.evaluate(() => !!document.querySelector('#adm-vue')) && etat.appels.some(x => x.includes('/produits')));
    A.tv('aucune erreur JavaScript (1)', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 2. Coupure reseau pendant un enregistrement ---------- */
  {
    const etat = A.etatNeuf({ auth: A.authNeuve() });
    const { c, p, erreurs } = await A.ouvrir(b, etat);
    /* Jeton encore bon 60 s : dans la marge de renouvellement, donc
       chaque requete voudra le renouveler — et le serveur repondra 503. */
    await c.addInitScript((s) => {
      try { localStorage.setItem('zaidat_session_v1', s); } catch (e) {}
    }, sessionStockee(A.jeton(60), 'r0'));
    etat.auth.forcer = 503;

    await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(5000);

    const sess = await lireStockage(p);
    A.tv('UNE PANNE PASSAGERE N EFFACE PAS LA SESSION', !!(sess && sess.refresh_token === 'r0'),
         JSON.stringify(sess && sess.refresh_token));
    A.tv('le serveur a bien refuse', etat.auth.refus > 0, etat.auth.refus + ' refus');
    A.tv('les donnees sont quand meme lues avec le jeton encore valide',
         etat.appels.some(x => x.startsWith('GET /rest/v1/produits')));
    /* Le repit evite de rejouer la panne a chaque requete. */
    A.tv('le renouvellement n est pas rejoue a chaque appel',
         etat.auth.appels <= 4, etat.auth.appels + ' tentatives');

    /* Le reseau revient : la session repart sans reconnexion. */
    etat.auth.forcer = null;
    await p.evaluate(() => document.querySelector('.adm-nav__item[data-vue="connexion"]').click());
    await p.waitForTimeout(400);
    const texte = await p.evaluate(() => document.querySelector('#adm-vue').innerText);
    A.tv('elle reste connectee pendant la coupure', /Connectée/.test(texte),
         texte.split('\n').slice(0, 2).join(' / '));
    A.tv('aucune erreur JavaScript (2)', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 3. Session vraiment finie : la, il faut se reconnecter ---------- */
  {
    const etat = A.etatNeuf({ auth: A.authNeuve() });
    const { c, p } = await A.ouvrir(b, etat);
    await c.addInitScript((s) => {
      try { localStorage.setItem('zaidat_session_v1', s); } catch (e) {}
    }, sessionStockee(A.jeton(-60), 'perime'));   /* jeton inconnu du serveur -> 400 */

    await p.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(3000);

    A.tv('un jeton refuse termine bien la session', (await lireStockage(p)) === null);
    A.tv('le serveur a repondu « Already Used »', etat.auth.refus > 0, etat.auth.refus + ' refus');
    A.tv('aucune insistance inutile', etat.auth.appels <= 2, etat.auth.appels + ' tentatives');

    await p.click('.adm-nav__item[data-vue="connexion"]');
    await p.waitForTimeout(400);
    const texte = await p.evaluate(() => document.querySelector('#adm-vue').innerText);
    A.tv('le formulaire de connexion est propose', /Pas encore connectée|Se connecter/.test(texte),
         texte.split('\n').slice(0, 2).join(' / '));
    await c.close();
  }

  /* ---------- 4. Deux onglets ouverts sur le meme dashboard ----------
     Ils partagent le stockage du navigateur, donc le meme jeton, mais
     chacun a son propre code : le garde-fou d'un onglet n'aide pas
     l'autre. Les deux partent avec « r0 », un seul peut l'utiliser —
     et celui qui se fait refuser ne doit pas deconnecter les deux. */
  {
    const etat = A.etatNeuf({ auth: A.authNeuve({ delai: 800 }) });
    const { c, erreurs } = await A.ouvrir(b, etat);
    await c.addInitScript((s) => {
      try { localStorage.setItem('zaidat_session_v1', s); } catch (e) {}
    }, sessionStockee(A.jeton(-60), 'r0'));

    const p1 = await c.newPage();
    const p2 = await c.newPage();
    await Promise.all([
      p1.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' }),
      p2.goto(A.BASE + '/admin/index.html', { waitUntil: 'load' }),
    ]);
    await p1.waitForTimeout(6000);

    A.tv('les deux onglets ont bien tente de renouveler',
         etat.auth.appels === 2, etat.auth.appels + ' appel(s)');
    A.tv('l un des deux s est fait refuser', etat.auth.refus === 1, etat.auth.refus + ' refus');

    const sess = await lireStockage(p1);
    A.tv('LES DEUX ONGLETS RESTENT CONNECTES', !!(sess && sess.access_token),
         JSON.stringify(sess && sess.refresh_token));
    for (const [n, pg] of [['1', p1], ['2', p2]]) {
      await pg.click('.adm-nav__item[data-vue="connexion"]');
      await pg.waitForTimeout(400);
      const texte = await pg.evaluate(() => document.querySelector('#adm-vue').innerText);
      A.tv('onglet ' + n + ' : toujours reconnu', /Connectée et autorisée/.test(texte),
           texte.split('\n').slice(0, 2).join(' / '));
    }
    A.tv('aucune erreur JavaScript (4)', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  await b.close();
  process.exit(A.bilan('SESSION — conservation et coupures') ? 1 : 0);
})();
