#!/usr/bin/env bash
# Test de charge de la base (RLS et RPC réels) sur une base PostgreSQL jetable.
# Usage : bash supabase/tests/load/run.sh [clients=20] [durée_s=30]
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="sauge_load_$$"; C="${1:-20}"; T="${2:-30}"
createdb "$DB"; trap 'dropdb --if-exists "$DB"' EXIT
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")
cat tests/sql/00_supabase_stub.sql migrations/*.sql tests/load/seed.sql | "${PSQL[@]}"
pgbench -n -c "$C" -j 4 -T "$T" -f tests/load/read.pgbench "$DB"
pgbench -n -c "$C" -j 4 -T "$T" -f tests/load/write.pgbench "$DB"
