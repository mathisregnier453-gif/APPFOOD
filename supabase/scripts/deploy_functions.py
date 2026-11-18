# Déploiement via l'API de gestion Supabase (sans la CLI).
# Usage : SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=xxxx cd supabase && python3 scripts/deploy_functions.py
import glob, json, os, sys, uuid, urllib.request, tomllib
REF = os.environ.get("SUPABASE_PROJECT_REF", "fnkoiofhvgpgqvocnwcc")
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "proxy-injected")
cfg = tomllib.load(open("config.toml", "rb")).get("functions", {})
shared = [p for p in glob.glob("functions/_shared/**/*.ts", recursive=True)]

def deploy(slug):
    files = [p for p in glob.glob(f"functions/{slug}/**/*", recursive=True) if os.path.isfile(p)] + shared
    meta = {"name": slug, "entrypoint_path": f"{slug}/index.ts", "import_map_path": f"{slug}/deno.json",
            "verify_jwt": cfg.get(slug, {}).get("verify_jwt", True)}
    boundary = uuid.uuid4().hex
    parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n{json.dumps(meta)}\r\n'.encode()]
    for p in files:
        rel = os.path.relpath(p, "functions")
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{rel}"\r\nContent-Type: application/typescript\r\n\r\n'.encode()
                     + open(p, "rb").read() + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REF}/functions/deploy?slug={slug}",
        data=b"".join(parts), method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "Authorization": f"Bearer {TOKEN}"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            body = json.loads(r.read())
            return True, f"v{body.get('version')} {body.get('status')} verify_jwt={meta['verify_jwt']}"
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code} {e.read().decode()[:800]}"

slugs = sys.argv[1:] or sorted(d for d in os.listdir("functions") if os.path.isdir(f"functions/{d}") and not d.startswith("_"))
ok = True
for s in slugs:
    success, info = deploy(s)
    ok &= success
    print(("OK      " if success else "ERREUR  ") + s.ljust(20), info)
sys.exit(0 if ok else 1)
