# Déploiement via l'API de gestion Supabase (sans la CLI).
# Usage : cd supabase && SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=xxxx python3 scripts/migrate.py
import glob, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from sbquery import query
code, body = query("""create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
select version from supabase_migrations.schema_migrations;""")
done = {r["version"] for r in body} if code < 300 else set()
for path in sorted(glob.glob("migrations/*.sql")):
    base = os.path.basename(path)[:-4]
    version, name = base.split("_", 1)
    if version in done:
        print("déjà appliquée :", base); continue
    sql = open(path).read()
    wrapped = ("begin;\n" + sql + "\n;insert into supabase_migrations.schema_migrations (version, name, statements) values ('"
               + version + "', '" + name + "', array[]::text[]);\ncommit;")
    code, body = query(wrapped)
    print(("OK   " if code < 300 else "ERREUR ") + base, "" if code < 300 else body)
    if code >= 300:
        query("rollback;"); sys.exit(1)
