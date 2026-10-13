#!/usr/bin/env bash
# Testa as migrations, o seed e o isolamento entre contas (RLS).
#   scripts/test-db.sh                 → Postgres descartável (precisa dos binários do PostgreSQL 16) com stub do Supabase
#   DATABASE_URL=... scripts/test-db.sh → banco já migrado (ex.: Supabase local: postgresql://postgres:postgres@127.0.0.1:54322/postgres)
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -n "${DATABASE_URL:-}" ]]; then
  for t in supabase/tests/rls.sql supabase/tests/missions.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$t"; done
  exit 0
fi
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[[ -x "$BIN/initdb" ]] || { echo "PostgreSQL não encontrado (defina PG_BIN ou DATABASE_URL)."; exit 2; }
DIR="$(mktemp -d)"; SOCK="$(mktemp -d /tmp/pgsock.XXXX)"; PORT="${PG_PORT:-54339}"
trap '"$BIN/pg_ctl" -D "$DIR" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DIR" "$SOCK"' EXIT
"$BIN/initdb" -D "$DIR" -U postgres -A trust >/dev/null
"$BIN/pg_ctl" -D "$DIR" -o "-p $PORT -k $SOCK -c listen_addresses=''" -l "$DIR/log" start >/dev/null
P=(psql -h "$SOCK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${P[@]}" -f supabase/tests/stub-supabase.sql
for f in supabase/migrations/*.sql; do "${P[@]}" -f "$f"; done
"${P[@]}" -f supabase/seed.sql
"${P[@]}" -f supabase/tests/rls.sql
"${P[@]}" -f supabase/tests/missions.sql
