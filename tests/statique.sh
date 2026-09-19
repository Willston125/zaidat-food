#!/usr/bin/env bash
# =========================================================
# Contrôles qui ne demandent aucun navigateur.
# Rapides : à lancer avant tout le reste.
# =========================================================
cd "$(dirname "$0")/.." || exit 1

ok=0; ko=0
verdict() {
  if [ "$1" = "0" ]; then echo "  OK    $2"; ok=$((ok+1));
  else echo "  ECHEC $2"; ko=$((ko+1)); fi
}

echo "=== 1. Le code compile ==="
erreurs=0
for f in js/*.js admin/js/*.js api/*.js tests/outils/*.js; do
  node --check "$f" >/dev/null 2>&1 || { echo "      $f"; erreurs=1; }
done
verdict $erreurs "tous les fichiers JavaScript compilent"

python3 - <<'PY' && verdict 0 "toutes les feuilles CSS sont equilibrees" || verdict 1 "CSS desequilibree"
import sys
for p in ['css/styles.css','admin/css/admin.css','assets/fonts/polices.css']:
    s = open(p, encoding='utf-8').read()
    if s.count('{') != s.count('}'):
        print('     ', p, s.count('{'), '/', s.count('}')); sys.exit(1)
PY

python3 -c "import json; [json.load(open(f)) for f in ['vercel.json','serve.json','package.json']]" \
  && verdict 0 "tous les fichiers JSON sont valides" || verdict 1 "JSON invalide"

python3 - <<'PY' && verdict 0 "le script SQL est syntaxiquement valide" || verdict 1 "SQL invalide (ou pglast absent)"
import sys
try:
    import pglast
except ImportError:
    print('       pglast non installe — controle SQL ignore'); sys.exit(0)
try:
    n = len(pglast.parse_sql(open('admin/supabase-installation.sql', encoding='utf-8').read()))
    print('      ', n, 'instructions SQL analysees')
except Exception as e:
    print('      ', e); sys.exit(1)
PY

echo
echo "=== 2. Securite de la base ==="
n=$(grep -c "for all$" admin/supabase-installation.sql || true); n=${n:-0}
verdict $([ "$n" -eq 0 ] && echo 0 || echo 1) "aucune regle « for all » ($n)"
n=$(grep -c "with check (true)" admin/supabase-installation.sql || true); n=${n:-0}
verdict $([ "$n" -eq 0 ] && echo 0 || echo 1) "aucun « with check (true) » ($n)"
n=$(grep -c "public.est_administrateur()" admin/supabase-installation.sql || true); n=${n:-0}
verdict $([ "$n" -ge 6 ] && echo 0 || echo 1) "le controle administrateur protege les ecritures ($n references)"

echo
echo "=== 3. Aucun secret dans le depot ==="
python3 - <<'PY' && verdict 0 "aucun secret dans les fichiers suivis" || verdict 1 "secret potentiel detecte"
import re, subprocess, sys
suivis = subprocess.run(['git','ls-files'], capture_output=True, text=True).stdout.split()
fichiers = [f for f in suivis if f.endswith(('.js','.json','.sql','.html','.md','.css','.txt','.sh','.yml','.yaml'))]
motifs = [
  (r'service_role["\']?\s*[:=]\s*["\']', 'cle service_role'),
  (r'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY', 'cle privee'),
  (r'(?i)(password|mot_de_passe|secret|api[_-]?key)\s*[:=]\s*["\'][^"\']{8,}', 'secret en dur'),
]
trouve = False
for f in fichiers:
    try: contenu = open(f, encoding='utf-8').read()
    except Exception: continue
    for m, nom in motifs:
        for occ in re.finditer(m, contenu):
            ligne = contenu[:occ.start()].count('\n') + 1
            print('      %s:%d — %s : %s' % (f, ligne, nom, occ.group(0)[:40]))
            trouve = True
print('      %d fichiers suivis analyses' % len(fichiers))
sys.exit(1 if trouve else 0)
PY
# La cle « anon » est publique par conception : la securite repose sur les
# regles RLS, pas sur son secret. Elle doit donc etre presente, et seule.
grep -q "eyJ" js/supabase-config.js && verdict 0 "la cle publique Supabase est bien presente" \
  || verdict 1 "la cle publique Supabase a disparu de js/supabase-config.js"

echo
echo "=== 4. Le numero de commande officiel ==="
grep -q '2694880343' js/config.js && verdict 0 "numero WhatsApp 2694880343 present" || verdict 1 "numero WhatsApp absent"
grep -q '+269 488 03 43' js/config.js && verdict 0 "affichage « +269 488 03 43 » preserve" || verdict 1 "affichage du numero modifie"
n=$(grep -rn "269[0-9]\{7\}" --include=*.js js/ | grep -vc 2694880343 || true); n=${n:-0}
verdict $([ "$n" = "0" ] && echo 0 || echo 1) "aucun autre numero comorien dans le code ($n)"

echo
echo "=== 5. Catalogue de secours et images ==="
n=$(grep -c 'slug:' js/products.js || true); n=${n:-0}
verdict $([ "$n" -ge 10 ] && echo 0 || echo 1) "le catalogue livre avec le site est complet ($n produits)"
manquantes=0
for img in $(grep -o 'assets/img/[a-z/-]*\.jpg' js/products.js | sort -u); do
  [ -f "$img" ] || { echo "      manquante : $img"; manquantes=1; }
done
verdict $manquantes "toutes les images referencees existent"

echo
echo "=== 6. Pages HTML ==="
python3 - <<'PY' && verdict 0 "toutes les pages sont bien formees" || verdict 1 "HTML mal forme"
from html.parser import HTMLParser
import sys
VIDES = {'meta','link','img','br','hr','input','source','use','path','circle','rect',
         'area','col','embed','param','track','wbr'}
class V(HTMLParser):
    def __init__(s): super().__init__(); s.pile=[]; s.err=[]
    def handle_starttag(s,t,a):
        if t not in VIDES: s.pile.append(t)
    def handle_endtag(s,t):
        if s.pile and s.pile[-1]==t: s.pile.pop()
        elif t in s.pile:
            s.err.append('%s ferme hors ordre' % t)
            while s.pile and s.pile.pop()!=t: pass
mauvais = False
for f in ['index.html','gabarit-produit.html','commande.html','mentions-legales.html',
          'confidentialite.html','admin/index.html']:
    v=V(); v.feed(open(f,encoding='utf-8').read())
    reste=[t for t in v.pile if t!='svg']
    if v.err or reste:
        print('      ',f,reste,v.err); mauvais=True
sys.exit(1 if mauvais else 0)
PY
python3 - <<'PY' && verdict 0 "aucun identifiant HTML duplique" || verdict 1 "identifiants dupliques"
import re,sys,collections
mauvais=False
for f in ['index.html','gabarit-produit.html','commande.html','mentions-legales.html',
          'confidentialite.html','admin/index.html']:
    ids=re.findall(r'\sid="([^"]+)"', open(f,encoding='utf-8').read())
    d=[k for k,v in collections.Counter(ids).items() if v>1]
    if d: print('      ',f,d); mauvais=True
sys.exit(1 if mauvais else 0)
PY

echo
echo "=== 7. Dependances externes ==="
n=$(grep -rl "googleapis\|gstatic" --include=*.html --include=*.css . 2>/dev/null | grep -v node_modules | wc -l)
verdict $([ "$n" = "0" ] && echo 0 || echo 1) "aucun lien vers une police distante"
# Seuls le domaine du site et les liens de service sont admis dans le HTML.
n=$(grep -rn "https\?://" --include=*.html . | grep -v node_modules \
    | grep -vc "schema.org\|zaidatfood.online\|vercel.com\|supabase.com\|wa.me\|openapi.vercel" || true)
n=${n:-0}
verdict $([ "$n" = "0" ] && echo 0 || echo 1) "aucun domaine tiers inattendu dans le HTML ($n)"

echo
echo "=== 8. En-tetes de securite ==="
python3 - <<'PY' && verdict 0 "les cinq en-tetes exiges sont configures" || verdict 1 "en-tete manquant"
import json,sys
v=json.load(open('vercel.json'))
cles={h['key'] for b in v['headers'] for h in b['headers']}
requis={'Content-Security-Policy','X-Content-Type-Options','Referrer-Policy',
        'X-Frame-Options','Permissions-Policy'}
manque=requis-cles
if manque: print('      manquants :',manque)
csp=[h['value'] for b in v['headers'] for h in b['headers']
     if h['key']=='Content-Security-Policy'][0]
if 'unsafe-eval' in csp: print('      unsafe-eval present'); manque.add('csp')
if "frame-ancestors 'none'" not in csp: print('      frame-ancestors absent'); manque.add('csp')
sys.exit(1 if manque else 0)
PY

echo
echo "=== 9. Dossiers de photos : le site, le menage et la base d'accord ==="
# Trois endroits nomment la meme liste de dossiers, et rien ne les
# reliait : le dashboard qui depose les photos, le nettoyage qui les
# libere, et la regle SQL qui autorise l'ecriture. Le jour ou « affiches »
# a ete ajoute aux deux premiers sans l'etre au troisieme, l'envoi a ete
# refuse par la base avec un message illisible. Ce controle les compare.
python3 - <<'PY' && verdict 0 "les dossiers de photos concordent partout" || verdict 1 "listes de dossiers divergentes"
import re, sys

def lire(f):
    return open(f, encoding='utf-8').read()

# 1. Ce que le dashboard depose reellement. Un dossier s'ecrit soit en
#    clair (dossier: "affiches"), soit par un choix (cle === "produit"
#    ? "produits" : "lifestyle") : les deux formes sont relevees.
admin = lire('admin/js/admin.js')
deposes = set()
for bloc in re.findall(r'dossier:\s*([^\n]+)', admin):
    # Dans un choix, seules les branches comptent : la valeur testee
    # a gauche du « ? » n'est pas un nom de dossier.
    if '?' in bloc: bloc = bloc.split('?', 1)[1]
    deposes |= set(re.findall(r'"([a-z]+)"', bloc))

# 2. Ce que le nettoyage reconnait comme etant a nous
m = re.search(r'\^\(([a-z|]+)\)\\/\[A-Za-z0-9\]', lire('js/supabase.js'))
menage = set(m.group(1).split('|')) if m else set()

# 3. Ce que la base autorise a l'ecriture
m = re.search(r"\^\(([a-z|]+)\)/\[A-Za-z0-9\]", lire('admin/supabase-installation.sql'))
base = set(m.group(1).split('|')) if m else set()

if not menage: print('      regex introuvable dans js/supabase.js')
if not base:   print('      regex introuvable dans admin/supabase-installation.sql')

mauvais = False
if menage != base:
    print('      nettoyage', sorted(menage), '!= base', sorted(base)); mauvais = True
manquants = deposes - base
if manquants:
    print('      deposes par le dashboard mais refuses par la base :', sorted(manquants)); mauvais = True
if not mauvais:
    print('      dossiers :', ' '.join(sorted(base)))
sys.exit(1 if (mauvais or not menage or not base) else 0)
PY

echo
echo "==================== $ok reussis, $ko echoues ===================="
[ "$ko" = "0" ]
