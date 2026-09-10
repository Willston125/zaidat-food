/* Exécute les fonctions api/ exactement comme Vercel le ferait :
   même handler, même objet requête/réponse, aucun navigateur.
   C'est ce que verrait un robot WhatsApp ou Facebook. */
process.chdir(require('path').join(__dirname, '..', '..'));

const RACINE = require('path').join(__dirname, '..', '..');
const handlerProduit = require(RACINE + '/api/produit.js');
const handlerSitemap = require(RACINE + '/api/sitemap.js');

let ok = 0, ko = 0;
function tv(nom, cond, detail) {
  if (cond) { ok++; console.log('  OK    ' + nom + (detail ? '  [' + detail + ']' : '')); }
  else { ko++; console.log('  ECHEC ' + nom + (detail ? '  [' + detail + ']' : '')); }
}

function fausseReponse() {
  return {
    statusCode: 0, entetes: {}, corps: '',
    setHeader(k, v) { this.entetes[k.toLowerCase()] = v; },
    end(c) { this.corps = c || ''; this.fini = true; },
  };
}

function requete(url, hote) {
  return {
    url: url,
    headers: {
      host: hote || 'zaidat-food.vercel.app',
      'x-forwarded-host': hote || 'zaidat-food.vercel.app',
      'x-forwarded-proto': 'https',
      'user-agent': 'WhatsApp/2.23 facebookexternalhit/1.1',
    },
  };
}

function meta(html, propriete) {
  const re = new RegExp('<meta\\s+(?:property|name)="' + propriete + '"\\s+content="([^"]*)"', 'i');
  const m = html.match(re);
  return m ? m[1] : null;
}
function titre(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1] : null;
}
function canonical(html) {
  const m = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i);
  return m ? m[1] : null;
}

(async () => {
  console.log('\n=== CNF-1 : ce que voit un robot WhatsApp, sans JavaScript ===');

  // --- Supabase injoignable : repli sur le catalogue du site ---
  const vraiFetch = global.fetch;
  global.fetch = () => Promise.reject(new Error('reseau coupe'));

  {
    const res = fausseReponse();
    await handlerProduit(requete('/produit.html?p=samoussas'), res);
    const h = res.corps;
    console.log('\n-- /produit.html?p=samoussas (Supabase injoignable) --');
    console.log('   title      : ' + titre(h));
    console.log('   og:title   : ' + meta(h, 'og:title'));
    console.log('   og:image   : ' + meta(h, 'og:image'));
    console.log('   og:url     : ' + meta(h, 'og:url'));
    console.log('   canonical  : ' + canonical(h));
    tv('reponse HTTP 200', res.statusCode === 200, String(res.statusCode));
    tv('titre propre au produit', /Samoussas/i.test(titre(h) || ''), titre(h));
    tv('og:title propre au produit', /Samoussas/i.test(meta(h, 'og:title') || ''));
    tv('plus de titre generique', !/Produit maison/.test(h));
    tv('og:image absolue', /^https:\/\//.test(meta(h, 'og:image') || ''), meta(h, 'og:image'));
    tv('og:url absolue et exacte',
       meta(h, 'og:url') === 'https://zaidat-food.vercel.app/produit.html?p=samoussas', meta(h, 'og:url'));
    tv('canonical presente', !!canonical(h), canonical(h));
    tv('twitter:card presente', meta(h, 'twitter:card') === 'summary_large_image');
    tv('og:description non vide', (meta(h, 'og:description') || '').length > 10, meta(h, 'og:description'));
    tv('la page reste complete pour les humains',
       h.includes('id="product-root"') && h.includes('js/product.js'));
    tv('aucun marqueur residuel', !h.includes('ZF:META-DEBUT') && !h.includes('ZF:META-FIN'));
  }

  // --- Chaque fiche a bien SA propre metadonnee (aucune generique) ---
  {
    console.log('\n-- les 14 fiches, une par une --');
    const src = require('fs').readFileSync(RACINE + '/js/products.js', 'utf8');
    const slugs = [...src.matchAll(/slug:\s*"([a-z0-9-]+)"/g)].map(m => m[1]);
    let distincts = new Set(), tousBons = true, exemples = [];
    for (const slug of slugs) {
      const res = fausseReponse();
      await handlerProduit(requete('/produit.html?p=' + slug), res);
      const t = titre(res.corps), img = meta(res.corps, 'og:image');
      distincts.add(t);
      if (!t || /Produit maison|^Produit —/.test(t) || !/^https:\/\//.test(img || '')) {
        tousBons = false; exemples.push(slug + ' -> ' + t);
      }
    }
    tv(slugs.length + ' fiches testees, toutes avec titre et image propres', tousBons, exemples.join(' | ') || 'toutes bonnes');
    tv('titres tous distincts', distincts.size === slugs.length, distincts.size + '/' + slugs.length);
  }

  // --- Produit inconnu ---
  {
    const res = fausseReponse();
    await handlerProduit(requete('/produit.html?p=nexistepas'), res);
    console.log('\n-- produit inconnu --');
    tv('page servie sans erreur', res.statusCode === 200);
    tv('marquee noindex', /noindex/.test(meta(res.corps, 'robots') || ''), meta(res.corps, 'robots'));
    tv('canonical renvoyee vers l accueil', /index\.html$/.test(canonical(res.corps) || ''), canonical(res.corps));
  }

  // --- Injection dans les donnees ---
  {
    global.fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve([{
        slug: 'piege',
        nom: 'Gateau "><script>alert(1)</script>',
        description_courte: 'Texte avec " et < et >',
        image_produit: 'javascript:alert(1)',
        image_lifestyle: '',
        prix: 1500, disponible: true,
      }]),
    });
    const res = fausseReponse();
    await handlerProduit(requete('/produit.html?p=piege'), res);
    const h = res.corps;
    console.log('\n-- donnees piegees venues de la base --');
    tv('script non injecte', !h.includes('<script>alert(1)</script>'));
    tv('guillemets et chevrons echappes', h.includes('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;'));
    tv('aucun chevron brut dans un attribut content', !/content="[^"]*<[^"]*"/.test(h));
    tv('image javascript: refusee, repli utilise',
       /^https:\/\/zaidat-food\.vercel\.app\/assets\//.test(meta(h, 'og:image') || ''), meta(h, 'og:image'));
  }

  // --- Domaine deduit de la requete ---
  {
    global.fetch = () => Promise.reject(new Error('hors ligne'));
    const res = fausseReponse();
    await handlerProduit(requete('/produit.html?p=pilaou', 'menu.zaidatfood.km'), res);
    console.log('\n-- domaine personnalise --');
    tv('og:url suit le domaine reel',
       (meta(res.corps, 'og:url') || '').startsWith('https://menu.zaidatfood.km/'), meta(res.corps, 'og:url'));
  }

  // --- Cache CDN ---
  {
    const res = fausseReponse();
    await handlerProduit(requete('/produit.html?p=pilaou'), res);
    tv('cache CDN configure', /s-maxage/.test(res.entetes['cache-control'] || ''), res.entetes['cache-control']);
  }

  // --- sitemap.xml ---
  {
    const res = fausseReponse();
    await handlerSitemap(requete('/sitemap.xml'), res);
    console.log('\n-- sitemap.xml --');
    const n = (res.corps.match(/<url>/g) || []).length;
    tv('XML bien forme', res.corps.startsWith('<?xml') && res.corps.includes('</urlset>'));
    tv('contient l accueil et les produits', n >= 10, n + ' adresses');
    tv('adresses absolues', !/[<]loc[>](?!https:\/\/)/.test(res.corps));
    tv('type de contenu XML', /xml/.test(res.entetes['content-type'] || ''), res.entetes['content-type']);
  }

  global.fetch = vraiFetch;
  console.log('\n=== ' + ok + ' reussis, ' + ko + ' echoues ===');
  process.exit(ko ? 1 : 0);
})();
