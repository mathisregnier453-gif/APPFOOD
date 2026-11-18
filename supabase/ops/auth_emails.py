# E-mails d'authentification Sauge (français) — appliqués via l'API de gestion Supabase.
# Usage : cd supabase && python3 -I ops/auth_emails.py
import json, os, urllib.request
REF = os.environ.get("SUPABASE_PROJECT_REF", "fnkoiofhvgpgqvocnwcc")
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "proxy-injected")

def page(title, body):
    return f"""<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1f2a24">
<div style="width:48px;height:48px;border-radius:16px;background:#6b8f71;color:#fff;font-size:24px;font-weight:700;text-align:center;line-height:48px">S</div>
<h1 style="font-size:22px;margin:24px 0 12px">{title}</h1>
{body}
<p style="font-size:13px;color:#6b756f;margin-top:32px">Vous n'êtes pas à l'origine de cette demande ? Ignorez simplement cet e-mail.<br>— L'équipe Sauge</p>
</div>"""

BUTTON = '<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#6b8f71;color:#fff;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:600">%s</a></p>'
CODE = '<p style="font-size:32px;letter-spacing:6px;font-weight:700;margin:16px 0">{{ .Token }}</p>'

config = {
    "mailer_subjects_confirmation": "Confirmez votre adresse e-mail",
    "mailer_templates_confirmation_content": page("Bienvenue sur Sauge 🌿",
        "<p>Ouvrez ce lien <b>depuis votre téléphone</b> pour activer votre compte : Sauge s'ouvrira et vous serez connecté.</p>" + BUTTON % "Confirmer mon e-mail"),
    "mailer_subjects_recovery": "Votre code pour changer de mot de passe",
    "mailer_templates_recovery_content": page("Changer votre mot de passe",
        "<p>Saisissez ce code dans l'application Sauge :</p>" + CODE + "<p style='color:#6b756f'>Il est valable 1 heure.</p>"),
    "mailer_subjects_email_change": "Confirmez votre nouvelle adresse e-mail",
    "mailer_templates_email_change_content": page("Nouvelle adresse e-mail",
        "<p>Confirmez que <b>{{ .NewEmail }}</b> est bien votre nouvelle adresse :</p>" + BUTTON % "Confirmer"),
    "mailer_subjects_magic_link": "Votre lien de connexion Sauge",
    "mailer_templates_magic_link_content": page("Connexion à Sauge", "<p>Votre code de connexion :</p>" + CODE),
    "mailer_subjects_reauthentication": "Votre code de vérification Sauge",
    "mailer_templates_reauthentication_content": page("Code de vérification", CODE),
    "mailer_subjects_invite": "Vous êtes invité sur Sauge",
    "mailer_templates_invite_content": page("Rejoignez Sauge", BUTTON % "Accepter l'invitation"),
}
req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REF}/config/auth", data=json.dumps(config).encode(),
    method="PATCH", headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"})
with urllib.request.urlopen(req, timeout=60) as r:
    d = json.load(r)
    print("HTTP", r.status, "|", d["mailer_subjects_confirmation"], "|", d["mailer_subjects_recovery"])
