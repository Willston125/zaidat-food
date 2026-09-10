/* AUDIT 6 — Options, galerie, abandon de saisie, volume reel, cas limites. */
const A = require('../outils/supabase-simule.js');
const PHOTO = require('path').join(__dirname, '..', 'media', 'photo.jpg');

async function dash(browser, etat, vue, viewport) {
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

  /* ---------- 1. Options de personnalisation d un produit ---------- */
  console.log('\n=== 1. Options de personnalisation (ex. message sur le gateau) ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await dash(browser, etat, 'produits');
    await p.click('.adm-produit[data-index="0"] [data-action="modifier"]');
    await p.waitForTimeout(500);
    const btn = await p.evaluate(() => !!document.querySelector('#ajouter-option'));
    A.tv('le bouton « ajouter une option » existe', btn);
    if (btn) {
      await p.click('#ajouter-option');
      await p.waitForTimeout(400);
      const champs = await p.evaluate(() => document.querySelectorAll('#liste-options [data-champ]').length);
      A.tv('une option vierge apparait', champs > 0, champs + ' champ(s)');
      await p.click('#liste-options [data-champ="name"]');
      await p.keyboard.type('Message sur le gateau', { delay: 25 });
      await p.waitForTimeout(300);
      await p.click('#tiroir-valider');
      await p.waitForTimeout(500);
      const ok = await p.evaluate(() => document.querySelector('#adm-tiroir').hidden);
      A.tv('le produit avec option est valide', ok,
           await p.evaluate(() => (document.querySelector('#adm-toast')||{}).textContent||''));
      if (ok) {
        await A.enregistrer(p, 5000);
        const l = etat.base.find(x => x.id === 'id-1');
        A.tv('L OPTION ARRIVE EN BASE', l && JSON.stringify(l.options||[]).includes('Message sur le gateau'),
             JSON.stringify(l ? l.options : null).slice(0, 120));
      }
    }
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 2. Galerie : ajouter une photo ---------- */
  console.log('\n=== 2. Galerie : ajouter une photo d ambiance ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await dash(browser, etat, 'galerie');
    const aBouton = await p.evaluate(() => !!document.querySelector('#ajouter-photo-galerie'));
    A.tv('le bouton d ajout de photo existe', aBouton);
    if (aBouton) {
      await p.setInputFiles('#fichier-galerie', PHOTO);
      await p.waitForTimeout(2500);
      const recadrage = await p.evaluate(() => !!document.querySelector('#zone-crop'));
      A.tv('le recadrage s ouvre pour la galerie', recadrage);
      if (recadrage) {
        await p.click('.adm-modale [data-valider]');
        await p.waitForTimeout(3500);
        const n = await p.evaluate(() => document.querySelectorAll('#adm-vue img').length);
        A.tv('la photo apparait dans la galerie', n > 0, n + ' photo(s)');
        await A.enregistrer(p, 5000);
        A.tv('LA GALERIE ARRIVE EN BASE',
             JSON.stringify(etat.reglages.site || {}).includes('storage'),
             JSON.stringify((etat.reglages.site||{}).galerie || (etat.reglages.site||{}).gallery || '').slice(0,120));
      }
    }
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 3. Abandon d une saisie produit ---------- */
  console.log('\n=== 3. Je modifie un produit puis je ferme sans valider ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await dash(browser, etat, 'produits');
    let question = null;
    p.removeAllListeners('dialog');
    p.on('dialog', d => { question = d.message(); d.dismiss(); });
    await p.click('.adm-produit[data-index="0"] [data-action="modifier"]');
    await p.waitForTimeout(400);
    await p.fill('#p-prix', '8888');
    await p.dispatchEvent('#p-prix', 'input');
    await p.waitForTimeout(300);
    await p.click('#tiroir-fermer');
    await p.waitForTimeout(600);
    A.tv('une confirmation protege la saisie non validee', !!question,
         question ? question.slice(0, 90) : 'AUCUNE — fermeture silencieuse');
    const encoreOuvert = await p.evaluate(() => !document.querySelector('#adm-tiroir').hidden);
    A.tv('refuser la confirmation garde le tiroir ouvert', encoreOuvert);
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 4. Volume reel : 21 produits ---------- */
  console.log('\n=== 4. Volume reel (21 produits) ===');
  {
    const base = [];
    for (let i = 1; i <= 21; i++) base.push(A.ligne(i));
    const etat = A.etatNeuf({ base });
    const t0 = Date.now();
    const { c, p, erreurs } = await dash(browser, etat, 'produits', { width: 360, height: 740 });
    const affiches = await p.evaluate(() => document.querySelectorAll('.adm-produit').length);
    A.tv('les 21 produits s affichent', affiches === 21, affiches + ' affiche(s) en ' + (Date.now()-t0) + ' ms');
    const debord = await p.evaluate(() =>
      Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
    A.tv('aucun debordement sur telephone', debord === 0, debord + 'px');

    await p.click('.adm-produit[data-index="5"] [data-action="modifier"]');
    await p.waitForTimeout(500);
    await p.fill('#p-prix', '6666');
    await p.dispatchEvent('#p-prix', 'input');
    await p.click('#tiroir-valider');
    await p.waitForTimeout(500);
    const t1 = Date.now();
    const r = await A.enregistrer(p, 12000);
    A.tv('un enregistrement de 21 produits aboutit', !r.boutonGrise && /Enregistr/i.test(r.corps || ''),
         ((Date.now()-t1)/1000).toFixed(1) + ' s — ' + String(r.corps || '').split('\n')[0]);
    const l = etat.base.find(x => x.id === 'id-6');
    A.tv('le bon produit a ete modifie', l && l.prix === 6666, l ? String(l.prix) : '?');
    A.tv('les 21 produits sont toujours en base', etat.base.length === 21, String(etat.base.length));
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  /* ---------- 5. Cas limites ---------- */
  console.log('\n=== 5. Cas limites ===');
  {
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await dash(browser, etat, 'produits');
    /* Deux produits avec la meme adresse de fiche */
    await p.click('.adm-produit[data-index="1"] [data-action="modifier"]');
    await p.waitForTimeout(400);
    await p.fill('#p-slug', 'produit-1');
    await p.dispatchEvent('#p-slug', 'input');
    await p.waitForTimeout(300);
    await p.click('#tiroir-valider');
    await p.waitForTimeout(500);
    const refuse = await p.evaluate(() => !document.querySelector('#adm-tiroir').hidden);
    const msg = await p.evaluate(() => (document.querySelector('#adm-toast')||{}).textContent||'');
    A.tv('une adresse de fiche en double est refusee', refuse && /d[ée]j[àa]/i.test(msg), msg.slice(0, 90));
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }
  {
    /* Supprimer une categorie qui contient des produits */
    const etat = A.etatNeuf();
    const { c, p, erreurs } = await dash(browser, etat, 'categories');
    let question = null;
    p.removeAllListeners('dialog');
    p.on('dialog', d => { question = d.message(); d.dismiss(); });
    const nbAvant = await p.evaluate(() => document.querySelectorAll('.adm-produit').length);
    const cible = await p.evaluate(() => {
      const l = Array.from(document.querySelectorAll('.adm-produit'))
        .find(e => /[1-9] produit/.test(e.innerText));
      if (!l) return null;
      l.setAttribute('data-cible', '1');
      return l.querySelector('[data-champ="name"]').value;
    });
    if (cible) {
      await p.click('.adm-produit[data-cible="1"] [data-action="supprimer"]');
      await p.waitForTimeout(500);
      /* Le refus passe par un message, pas par un dialogue : c'est plus
         clair qu'un « OK / Annuler » sur une action qu'on va refuser. */
      const msg = await p.evaluate(() => (document.querySelector('#adm-toast')||{}).textContent || '');
      const encoreLa = await p.evaluate(() => document.querySelectorAll('.adm-produit').length);
      A.tv('supprimer une categorie utilisee est refuse avec une explication',
           /impossible|produit\(s\) utilisent/i.test(msg), msg.slice(0, 110));
      A.tv('la categorie est toujours la', encoreLa === nbAvant, nbAvant + ' -> ' + encoreLa);
    } else {
      A.tv('une categorie contient des produits (pour le test)', false, 'aucune trouvee');
    }
    A.tv('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
    await c.close();
  }

  await browser.close();
  process.exit(A.bilan('AUDIT 6 — zones restantes') ? 1 : 0);
})();
