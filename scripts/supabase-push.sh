#!/usr/bin/env bash
# Envia supabase/config.toml ao projeto na nuvem com os segredos do .env.local (SMTP, Google, Apple),
# sem imprimir valores. Só a parte de Auth/API; Storage fica como está.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
. <(grep -E '^(SMTP_PASS|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|APPLE_SERVICES_ID|APPLE_SECRET)=' .env.local)
set +a
printf 'y\nn\n' | npx supabase config push 2>&1 | grep -oE '"message":"[^"]*"|Error.*'
