#!/usr/bin/env bash
# =========================================================
# Lance toutes les verifications du site et du tableau de bord.
#
#   npm test                 tout
#   npm run test:statique    seulement ce qui ne demande pas de navigateur
#
# Un serveur local est demarre si le port est libre, puis arrete
# a la fin. La base Supabase n'est jamais contactee : les tests
# repondent a sa place (voir tests/outils/supabase-simule.js).
# =========================================================
set -u
cd "$(dirname "$0")/.." || exit 1

PORT="${ZF_PORT:-8123}"
BASE="http://127.0.0.1:$PORT"
export ZF_BASE="$BASE"

ROUGE=$'\033[31m'; VERT=$'\033[32m'; GRIS=$'\033[90m'; RAZ=$'\033[0m'
suites_ko=0

# --- Serveur local ------------------------------------------------
notre_serveur=""
if curl -s -o /dev/null -m 2 "$BASE/index.html" 2>/dev/null; then
  echo "${GRIS}Serveur deja en ecoute sur $BASE${RAZ}"
else
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
  notre_serveur=$!
  for _ in $(seq 1 20); do
    curl -s -o /dev/null -m 1 "$BASE/index.html" 2>/dev/null && break
    sleep 0.5
  done
  if ! curl -s -o /dev/null -m 2 "$BASE/index.html" 2>/dev/null; then
    echo "${ROUGE}Impossible de demarrer le serveur local sur $PORT${RAZ}"; exit 1
  fi
  echo "${GRIS}Serveur local demarre sur $BASE${RAZ}"
fi
arreter() { [ -n "$notre_serveur" ] && kill "$notre_serveur" 2>/dev/null; }
trap arreter EXIT

# --- Une suite ----------------------------------------------------
executer() {
  local titre="$1"; local fichier="$2"
  local sortie; sortie=$(node "$fichier" 2>&1)
  local code=$?
  local resume; resume=$(echo "$sortie" | grep -E '^===' | tail -1)
  if [ "$code" = "0" ]; then
    printf "  %s%-34s%s %s\n" "$VERT" "$titre" "$RAZ" "${resume:-termine}"
  else
    printf "  %s%-34s%s %s\n" "$ROUGE" "$titre" "$RAZ" "${resume:-ECHEC}"
    echo "$sortie" | grep -E 'ECHEC|Error|error' | head -12 | sed 's/^/      /'
    suites_ko=$((suites_ko+1))
  fi
}

echo
echo "── Controles statiques ────────────────────────────────"
if bash tests/statique.sh > /tmp/zf-statique.$$ 2>&1; then
  tail -1 /tmp/zf-statique.$$ | sed 's/^/  /'
else
  cat /tmp/zf-statique.$$ | grep -E 'ECHEC|====' | sed 's/^/  /'
  suites_ko=$((suites_ko+1))
fi
rm -f /tmp/zf-statique.$$

echo
echo "── Site public ────────────────────────────────────────"
for f in tests/site/*.js; do executer "$(basename "$f" .test.js)" "$f"; done

echo
echo "── Tableau de bord ────────────────────────────────────"
for f in tests/dashboard/*.js; do executer "$(basename "$f" .js | sed 's/\.test$//')" "$f"; done

echo
if [ "$suites_ko" = "0" ]; then
  echo "${VERT}Toutes les suites passent.${RAZ}"
else
  echo "${ROUGE}$suites_ko suite(s) en echec.${RAZ}"
fi
exit "$suites_ko"
