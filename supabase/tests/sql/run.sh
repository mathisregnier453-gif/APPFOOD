#!/usr/bin/env bash
# Exécute les migrations + tests RLS sur une base PostgreSQL jetable.
# Usage : bash supabase/tests/sql/run.sh   (variables PG* standard pour la connexion)
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="sauge_test_$$"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
cat tests/sql/00_supabase_stub.sql | "${PSQL[@]}"
for f in migrations/*.sql; do cat "$f" | "${PSQL[@]}"; done
cat tests/sql/[1-9]*_*.sql | "${PSQL[@]}"   # une seule session : les fichiers partagent leurs variables de test
