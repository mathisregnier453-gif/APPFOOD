# Déploiement via l'API de gestion Supabase (sans la CLI).
# Usage : cd supabase && SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=xxxx python3 scripts/sbquery.py
import json, os, sys, urllib.request
REF = os.environ.get("SUPABASE_PROJECT_REF", "fnkoiofhvgpgqvocnwcc")
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "proxy-injected")
def query(sql):
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": sql}).encode(), method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:2000]
if __name__ == "__main__":
    sql = sys.stdin.read()
    code, body = query(sql)
    print("HTTP", code); print(json.dumps(body, ensure_ascii=False)[:3000] if not isinstance(body, str) else body)
