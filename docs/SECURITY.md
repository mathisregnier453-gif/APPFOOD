# Sécurité & RGPD

## Contrôle d'accès

- **RLS activé sur les 22 tables**. Règle générale : un utilisateur n'accède qu'aux lignes des foyers dont il est membre (`is_household_member`).
- Colonnes sensibles de `profiles` (`is_admin`, `suspended_at`) : **privilège UPDATE retiré** au rôle `authenticated` (seules les colonnes de préférences sont modifiables).
- `subscriptions`, `usage_quotas`, `ai_usage_logs`, `scan_detections` : **lecture seule** côté app ; écriture uniquement par le serveur.
- `scan_sessions` : l'app ne peut créer qu'un brouillon (`draft`, `scans_consumed = 0`) et ne peut jamais en modifier le statut.
- Fonctions de quota : `EXECUTE` révoqué pour `anon`/`authenticated`.
- Fonctions `security definer` : `search_path = ''` (protection contre le détournement de schéma), vérification explicite de l'appartenance au foyer et du statut du compte.
- Compte suspendu : plus aucune écriture (policies + RPC + edge functions).
- Stockage : bucket **privé** `scan-photos`, JPEG uniquement, 2 Mo max, accès limité au dossier du foyer.

Ces règles sont **testées automatiquement** : `supabase/tests/sql/` (142 vérifications : espace admin (accès refusé aux utilisateurs, actions journalisées, valeurs bornées, pas d'auto-suspension), indicateurs financiers vérifiés sur des données connues, foyer partagé (invitations à usage unique, anti force brute, capacité, lecture seule sans offre Famille, départ / retrait / transfert de propriété, foyer courant obligatoire, jetons push privés), droits par offre (gratuit / Premium / Famille / résilié / expiré), abonnements non falsifiables, isolation entre foyers, écriture croisée, élévation de privilèges, quotas de scans et de recettes, recettes non falsifiables par le client, favoris, liste de courses / achats / déductions limités au foyer, planning, cache produits en lecture seule, double validation, compte suspendu, stockage).

## Secrets

- Aucune clé secrète dans l'app : seules l'URL Supabase et la clé `anon` (publique par conception) y figurent.
- `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` : secrets des edge functions uniquement.
- `REVENUECAT_SECRET_KEY` et `REVENUECAT_WEBHOOK_AUTH` : secrets serveur ; l'app n'embarque que les clés SDK publiques RevenueCat.
- Webhook RevenueCat : secret comparé en temps constant ; contenu non cru sur parole (état relu via l'API RevenueCat).
- `.env` exclu du dépôt (`.gitignore`).

## RGPD

| Exigence | Mise en œuvre |
|---|---|
| Information & consentement | Écran de consentement obligatoire avant tout usage (`profiles.privacy_consent_at`) ; `scan-analyze` refuse l'analyse sans consentement. |
| Finalité des photos | Photos utilisées **uniquement** pour la reconnaissance des aliments ; jamais publiques, jamais réutilisées. |
| Conservation des photos | Suppression au passage suivant de la tâche horaire après validation/annulation ; **7 jours maximum** dans tous les cas (`purge-scan-photos`). |
| Droit à l'effacement | Profil → « Supprimer mon compte » → `delete-account` : foyers personnels, stock, photos, historique supprimés ; propriété des foyers partagés transférée ; journaux de coûts conservés **anonymisés**. |
| Notifications | Rappels **locaux** au téléphone : le contenu du stock n'est transmis à aucun service de push. |
| Données de santé | Les allergies déclarées servent uniquement à filtrer les recettes ; elles ne sont visibles que de l'utilisateur et des membres de son foyer. À mentionner dans la politique de confidentialité. |
| Code-barres | La caméra ne sert qu'à lire le code (aucune image enregistrée ni envoyée). La recherche Open Food Facts passe par le serveur : ni l'IP ni l'identité de l'utilisateur ne sont transmises. |
| Foyer partagé | Les membres voient les noms affichés des autres, jamais leur e-mail. Les allergies de chacun ne servent qu'à filtrer les recettes du foyer. Les notifications push ne contiennent que le prénom, un nombre et au plus 3 noms d'aliments. |
| Statistiques d'usage | Désactivées par défaut ; accord facultatif à l'inscription, modifiable dans le Profil ; événements anonymes (aucun identifiant de compte, aucun contenu), serveur UE. |
| Suivi des erreurs | Sentry sans e-mail, sans IP, sans corps de requête ; seul l'identifiant technique est joint. |
| Espace admin | Accès par rôle en base uniquement ; e-mails visibles des seuls administrateurs ; toutes les actions journalisées. |
| Minimisation | Photos réduites à 1280 px, métadonnées EXIF non conservées (`exif: false`). |
| Chiffrement | TLS pour toutes les communications ; chiffrement au repos assuré par Supabase. |
| Sous-traitants | Supabase (hébergement), fournisseur IA (analyse des photos) — à lister dans la politique de confidentialité, avec la région d'hébergement choisie (UE recommandée). |
| Sauvegardes | Sauvegardes quotidiennes Supabase (plan Pro) ; activer le Point-in-Time Recovery avant le lancement. |

## À faire avant publication sur les stores

- [ ] Rédiger la politique de confidentialité et les conditions d'utilisation, puis remplacer `extra.privacyPolicyUrl` et `extra.termsUrl` dans `app.json` (valeurs actuelles : placeholders).
- [ ] Choisir une région Supabase dans l'UE.
- [ ] Vérifier les conditions de conservation des données du fournisseur IA et les mentionner.
- [ ] Planifier `purge-scan-photos` (toutes les heures) et définir `CRON_SECRET`.
- [ ] Activer la confirmation d'e-mail et la protection contre les mots de passe compromis dans Supabase Auth.
- [ ] Activer PITR et tester une restauration.
