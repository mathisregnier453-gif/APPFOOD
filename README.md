# Sauge — assistant alimentaire intelligent

Application mobile (iOS / Android) qui scanne le réfrigérateur, le congélateur et les placards grâce à l'IA, tient l'inventaire à jour, alerte avant la péremption, propose des recettes avec ce qu'il y a à la maison, organise la semaine et prépare la liste de courses.

**État : les 6 phases du cahier des charges sont développées** (scanner et inventaire ; recettes et notifications ; planning, courses, code-barres ; abonnements ; foyer partagé ; administration, observabilité, charge, préparation des stores). Prochaine étape : configuration des services externes et tests sur appareils ([docs/STORE_RELEASE.md](docs/STORE_RELEASE.md)). — voir [docs/ROADMAP.md](docs/ROADMAP.md).

| Document | Contenu |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture, arborescence, parcours de scan, base de données |
| [docs/SECURITY.md](docs/SECURITY.md) | RLS, secrets, RGPD, check-list avant publication |
| [docs/AI_COSTS.md](docs/AI_COSTS.md) | Optimisation et suivi du coût de chaque scan, choix du modèle |
| [docs/BILLING.md](docs/BILLING.md) | Offres, RevenueCat, droits, mise en place des stores |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Tâches planifiées, surveillance, administrateurs, test de charge, sauvegardes |
| [docs/STORE_RELEASE.md](docs/STORE_RELEASE.md) | Publication : check-list, confidentialité, fiche store |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phases 1 à 6 |

## Stack

React Native + Expo SDK 58 + TypeScript + Expo Router · Supabase (Auth, PostgreSQL + RLS, Storage, Realtime, Edge Functions) · couche IA interchangeable (Anthropic par défaut).

## Démarrage

Prérequis : Node 22+, [Supabase CLI](https://supabase.com/docs/guides/cli), un compte Supabase, une clé API du fournisseur IA.

```bash
npm install
```

```bash
cp .env.example .env   # puis renseigner l'URL et la clé anon du projet Supabase
```

Backend :

```bash
supabase link --project-ref <votre-projet>
```

```bash
supabase db push
```

```bash
supabase secrets set ANTHROPIC_API_KEY=<clé> AI_VISION_MODEL=claude-opus-5-5 AI_VISION_EFFORT=low AI_RECIPE_MODEL=claude-opus-5-5 AI_RECIPE_EFFORT=low CRON_SECRET=<aléatoire>
```

```bash
supabase functions deploy scan-analyze && supabase functions deploy recipes-generate && supabase functions deploy meal-plan-generate && supabase functions deploy barcode-lookup && supabase functions deploy subscription-sync && supabase functions deploy revenuecat-webhook --no-verify-jwt && supabase functions deploy push-dispatch --no-verify-jwt && supabase functions deploy delete-account && supabase functions deploy purge-scan-photos
```

Abonnements : voir [docs/BILLING.md](docs/BILLING.md) (produits stores, RevenueCat, secrets `REVENUECAT_*`).

Tâches planifiées (Supabase Cron → requête HTTP POST avec l'en-tête `x-cron-secret`) : `purge-scan-photos` toutes les heures, `push-dispatch` chaque minute. Notifications push : lancer `npx eas-cli@latest init` pour obtenir `extra.eas.projectId`.

App (les modules natifs utilisés — appareil photo, notifications, Reanimated — nécessitent un *development build*) :

```bash
npx expo run:ios
```

```bash
npx expo run:android
```

## Tests

```bash
npm run typecheck && npm test
```

```bash
cd supabase && npm install && npm run typecheck && npm test
```

`supabase/tests/sql/run.sh` exécute toutes les migrations et 142 tests de sécurité et de logique métier sur une base PostgreSQL jetable (nécessite `psql`/`createdb` locaux).

`supabase/tests/load/run.sh` lance le test de charge (10 000 foyers, `pgbench`).

## Règles du projet

- Aucun secret dans l'app mobile ; quotas et coûts vérifiés côté serveur uniquement.
- L'IA n'invente jamais une date de péremption ni une quantité exacte : `null` = inconnu.
- Pas de données de démonstration en production (les seules données insérées par les migrations sont des référentiels : catégories et offres).
