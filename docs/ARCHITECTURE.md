# Architecture technique — Sauge

## Vue d'ensemble

```
┌──────────────────────────┐        HTTPS (TLS)         ┌──────────────────────────────────────┐
│  App mobile (Expo / RN)  │ ─────────────────────────▶ │ Supabase                             │
│  TypeScript, Expo Router │   clé "anon" publique +     │  • Auth (e-mail / mot de passe)      │
│                          │   JWT utilisateur           │  • PostgreSQL + RLS                  │
│  • compresse les photos  │                             │  • Storage privé (scan-photos)       │
│  • aucune clé secrète    │                             │  • Realtime (sync du foyer)          │
└──────────────────────────┘                             │  • Edge Functions (Deno)             │
                                                         │      scan-analyze ──┐                │
                                                         │      recipes-gen ───┤                │
                                                         │      meal-plan ─────┤                │
                                                         │      barcode ───────┼──▶ Open Food Facts
                                                         │      delete-account │                │
                                                         │      purge-photos   │                │
                                                         └─────────────────────┼────────────────┘
                                                                               │ clé API (secret serveur)
                                                                               ▼
                                                              Couche IA interchangeable
                                                              (_shared/ai : FoodVisionProvider)
                                                              → Anthropic aujourd'hui
```

Principes :

1. **Le serveur décide** : quotas, statut des scans, coûts, abonnements ne sont jamais modifiables par l'app.
2. **Tout appartient à un foyer** (`household_id`). Chaque inscrit reçoit un foyer personnel : le partage Famille (phase 5) n'exige aucune migration de données.
3. **L'IA est derrière une interface** (`FoodVisionProvider`). Changer de fournisseur = un fichier dans `providers/` + une variable d'environnement.
4. **Rien d'inventé** : quantité et date sont `null` si inconnues ; la normalisation serveur rejette toute date non lue sur l'emballage.

## Arborescence

```
sauge/
├── src/
│   ├── app/                      # Routes Expo Router (1 fichier = 1 écran)
│   │   ├── _layout.tsx           # Garde d'auth + consentement RGPD
│   │   ├── (auth)/               # Connexion, inscription
│   │   ├── onboarding/consent    # Consentement au traitement des photos
│   │   ├── (tabs)/               # Accueil, Mon stock, Recettes, Planning, Courses (+ Scanner flottant)
│   │   ├── scan/                 # Capture → analyse → vérification
│   │   ├── recipe/               # Génération (filtres), fiche recette
│   │   ├── preferences.tsx       # Régimes, allergies, aliments évités
│   │   ├── profile.tsx           # Compte, offre, quota, notifications, RGPD
│   │   ├── paywall.tsx           # Offres, achat, restauration
│   │   ├── household/            # Mon foyer, rejoindre avec un code
│   │   ├── admin/                # Tableau de bord, utilisateurs, offres, finances, erreurs
│   │   ├── planning/             # Créneau, génération de la semaine, planifier une recette
│   │   ├── shopping/             # Ranger les achats dans le stock
│   │   └── item/                 # Ajout manuel, fiche aliment
│   ├── components/               # UI réutilisable (Button, Card, Chip, …)
│   ├── features/                 # Logique par domaine (auth, inventory, scan)
│   ├── lib/                      # Client Supabase, types, catalogue, dates
│   └── theme/                    # Couleurs, espacements, typographie
├── supabase/
│   ├── migrations/               # Schéma, fonctions, RLS, référentiels
│   ├── functions/
│   │   ├── _shared/ai/           # Couche IA indépendante du fournisseur
│   │   ├── scan-analyze/         # Analyse d'un scan (quota, cache, coûts)
│   │   ├── recipes-generate/     # Recettes depuis le stock réel (quota, cache, coûts)
│   │   ├── meal-plan-generate/   # Semaine de repas (créneaux libres, anti-gaspi)
│   │   ├── barcode-lookup/       # Open Food Facts + cache partagé
│   │   ├── revenuecat-webhook/   # Événements d'abonnement (authentifiés, idempotents)
│   │   ├── subscription-sync/    # Application immédiate des droits après achat
│   │   ├── push-dispatch/        # Notifications d'activité du foyer (tâche planifiée)
│   │   ├── delete-account/       # Droit à l'effacement
│   │   └── purge-scan-photos/    # Politique de conservation des photos
│   └── tests/                    # Tests SQL (RLS) + tests unitaires IA
├── tests/                        # Tests unitaires de l'app (logique pure)
└── docs/
```

## Parcours de scan (phase 1)

1. L'app crée une `scan_session` (`status = draft`) — RLS interdit tout autre statut.
2. Chaque photo est **redimensionnée (1280 px) et compressée (JPEG 70 %)** sur le téléphone, puis envoyée dans `scan-photos/{household}/{session}/{n}.jpg` (bucket privé, 2 Mo max, JPEG uniquement).
3. L'app appelle `scan-analyze`. La fonction :
   - vérifie JWT, compte non suspendu, consentement RGPD, appartenance au foyer ;
   - renvoie le résultat existant si la session est déjà analysée (**aucun double appel**) ;
   - vérifie le nombre de photos autorisé par l'offre ;
   - calcule l'empreinte SHA-256 des photos : si identiques à un scan déjà analysé du foyer → **résultat en cache, 0 scan décompté, 0 € d'IA** ;
   - verrouille la session (`processing`) contre les doubles clics ;
   - décrémente le quota **atomiquement** (`consume_scan_quota`, refus net si quota atteint : aucun dépassement facturé) ;
   - appelle le fournisseur IA (toutes les photos en **un seul appel**), normalise la sortie ;
   - en cas d'échec : **rembourse le scan**, journalise l'erreur ;
   - journalise tokens, modèle, coût, latence dans `ai_usage_logs` et `scan_sessions`.
4. L'utilisateur vérifie/corrige/supprime/ajoute, choisit l'emplacement, puis valide.
5. `confirm_scan` (RPC transactionnelle) crée les `food_items` et clôt la session.
6. `purge-scan-photos` (tâche horaire) supprime les photos des scans validés/annulés, et toutes celles de plus de 7 jours.

## Parcours recettes (phase 2)

1. L'utilisateur choisit ses envies (anti-gaspi, avec mon stock, rapide, économique, équilibré, protéiné, végétarien), le type de repas, le temps, le nombre de personnes, le budget et la difficulté.
2. `recipes-generate` lit **lui-même** le stock du foyer et les préférences (régimes, allergies, aliments non aimés) : l'app n'envoie que des filtres validés.
3. Cache 24 h sur l'empreinte (stock + filtres + préférences) ; sinon le quota de recettes est réservé atomiquement (`consume_recipe_quota` accorde au plus ce qui reste).
4. L'IA reçoit le stock sous forme de références locales (`#1 | Tomates cerises | 250 g | expire dans 1 j`) et renvoie un JSON structuré.
5. Validation serveur (`_shared/ai/recipes.ts`) :
   - un ingrédient n'est « dans le stock » que si sa référence existe **et** que son nom correspond à l'aliment ; sinon il devient « à acheter » ;
   - recette écartée si elle contient un allergène déclaré (14 allergènes réglementaires + saisie libre) ou contredit un régime végétarien/végétalien, ou dépasse le temps demandé ;
   - les recettes non livrées sont remboursées.
6. Les recettes sont enregistrées (`recipes`, `recipe_ingredients.food_item_id`). À l'affichage, la disponibilité est **recalculée sur le stock actuel** (un aliment terminé depuis redevient « à acheter »).
7. Pas de photo générée : une illustration sobre (catégorie de l'ingrédient principal + type de repas) évite un coût supplémentaire et toute image trompeuse.

## Notifications (phase 2)

Notifications **locales** (programmées sur le téléphone, aucune donnée envoyée à un service de push) :
- rappel de péremption : un seul rappel par jour, à 9 h, regroupant les produits qui atteignent le délai d'alerte choisi (1 à 5 jours) ; reprogrammé à chaque changement du stock ; 30 rappels maximum ;
- quota de scans : quand il ne reste qu'un scan, puis plus aucun (une fois par mois).
Chaque type est activable dans le Profil (`profiles.notification_prefs`). Les notifications serveur (foyer, courses, repas) viendront avec les phases 3 et 5.

## Organisation (phase 3)

**Planning** (`meal_plans`, un repas par jour et par créneau). `meal-plan-generate` repère les créneaux libres, lance une génération par type de repas **en parallèle** (service partagé `_shared/recipe-service.ts`, mêmes garanties que les recettes : stock serveur, allergènes, quota, remboursement), puis place les recettes qui utilisent les produits les plus urgents en début de semaine. Un trigger refuse toute recette d'un autre foyer.

**Courses** : une liste active par foyer. `add_shopping_items` fusionne les doublons (nom normalisé + unité, y compris unité inconnue) en mode *somme* (ajout manuel, recette) ou *max* (régénération depuis le planning : pas de double comptage). Le calcul du manquant est fait par l'app (`features/planning/shopping.ts`, testé) : portions, conversions g/kg et ml/l, stock partagé entre plusieurs repas, quantité de stock inconnue = considéré disponible. `purchase_shopping_items` range les achats dans le stock et les retire de la liste, en une transaction.

**Recette cuisinée** : l'app propose les quantités restantes ; l'utilisateur valide ; `cook_recipe` applique les déductions (uniquement sur des aliments du foyer de la recette), les historise (`reason = recipe`) et marque le repas comme cuisiné.

**Code-barres** : lecture EAN/UPC sur le téléphone (`expo-camera`, aucune image enregistrée) → `barcode-lookup` → cache partagé `product_cache` (30 jours, 24 h pour un produit introuvable) → Open Food Facts. Les requêtes partent du serveur : l'IP et l'identité de l'utilisateur ne sont pas transmises à OFF.

## Abonnements (phase 4)

Voir [BILLING.md](BILLING.md). `effective_plan(household)` reste l'unique source des droits côté base ; `plan_has_feature` et `get_entitlements` s'appuient dessus.

## Foyer partagé (phase 5)

- Droit d'écriture : `can_write_household(h)` = membre actif **et** (propriétaire **ou** offre du foyer avec `shared_household`). Utilisé par toutes les policies d'écriture, les RPC (`confirm_scan`, `update_item_quantity`, courses, `cook_recipe`) et les edge functions (`household_write_allowed`). La lecture reste ouverte à tous les membres.
- Invitations : `create_household_invitation` (propriétaire, offre Famille, place disponible), `accept_household_invitation` (renvoie NULL pour un code invalide : l'essai est enregistré, une exception l'aurait annulé), `leave_household`, `remove_household_member`, `get_household_members`, `get_my_households`.
- Le foyer courant (`profiles.current_household_id`) est toujours un foyer dont l'utilisateur est membre (trigger).
- L'abonnement reste attaché au foyer où il a été souscrit tant que le payeur en est membre.
- Activité : triggers de niveau instruction sur `food_items` / `shopping_list_items` + RPC d'achat → `household_activity` (fusion des ajouts d'une même personne sur 2 minutes, foyers d'au moins 2 membres uniquement). `push-dispatch` (chaque minute) regroupe et envoie via Expo Push.

## Administration et observabilité (phase 6)

- Fonctions `admin_*` (security definer + `assert_admin()`), journalisées dans `admin_audit_log` ; données financières et d'audit invisibles aux autres comptes (RLS).
- `admin_dashboard(from, to)` calcule tous les indicateurs en une requête (abonnements hors sandbox via `paying_subscriptions()`).
- `error_logs` alimenté par les edge functions (`logServerError`) ; erreurs de l'app dans Sentry.
- `ai_usage_daily` + `purge_old_logs()` pour garder des tables de journaux de taille bornée.
- Voir [OPERATIONS.md](OPERATIONS.md) (tâches planifiées, surveillance, test de charge) et [STORE_RELEASE.md](STORE_RELEASE.md).

## Base de données

Tables (cf. `supabase/migrations/20261118000001_init_schema.sql`) :

| Domaine | Tables |
|---|---|
| Comptes & foyers | `profiles`, `households`, `household_members`, `household_invitations` |
| Inventaire | `storage_locations`, `food_categories`, `food_items`, `consumption_logs` |
| Scanner | `scan_sessions`, `scan_photos`, `scan_detections` |
| Recettes & organisation | `recipes`, `recipe_ingredients`, `favorites`, `meal_plans`, `shopping_lists`, `shopping_list_items`, `dietary_preferences` |
| Monétisation & coûts | `plans`, `subscriptions`, `usage_quotas`, `ai_usage_logs` |

Choix notables :
- `food_items.quantity` et `expiry_date` **nullables** + `quantity_is_estimate` : on distingue « inconnu », « estimé », « exact ».
- `expiry_kind` (`dlc` / `ddm`) : messages différents selon le type de date.
- Un aliment terminé n'est pas supprimé (`finished_at`) : l'historique de consommation reste exploitable (anti-gaspillage, statistiques).
- `plans` contient quotas et prix : modifiables depuis l'admin sans redéployer l'app.
- `shopping_list_items` : contrainte d'unicité sur le nom normalisé → pas de doublons.
- Index partiels sur le stock actif et les dates de péremption.

## RPC exposées à l'app

| Fonction | Rôle |
|---|---|
| `get_quota_status(household)` | Scans utilisés / restants, offre, date de renouvellement |
| `confirm_scan(session, items)` | Validation transactionnelle d'un scan |
| `cancel_scan(session)` | Abandon d'un scan |
| `update_item_quantity(item, qty, reason, finish)` | Quantité + historique de consommation |

Phase 3 : `get_active_shopping_list`, `add_shopping_items`, `purchase_shopping_items`, `cook_recipe`.

Réservées au serveur (`service_role`) : `consume_scan_quota`, `refund_scan_quota`, `consume_recipe_quota`, `refund_recipe_quota`.

Depuis la phase 2, les recettes ne peuvent être créées que par le serveur (l'app peut les lire, les supprimer de son historique et les mettre en favori).

## Variables d'environnement

| Où | Variable | Secret ? |
|---|---|---|
| App (`.env`) | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Non (publiques, protégées par RLS) |
| Edge functions (`supabase secrets set`) | `ANTHROPIC_API_KEY` | **Oui** |
| | `AI_PROVIDER` (`anthropic`), `AI_VISION_MODEL`, `AI_VISION_EFFORT` (`low`) | Non |
| | `AI_RECIPE_MODEL`, `AI_RECIPE_EFFORT` (`low`) | Non |
| | `OFF_USER_AGENT` (identifiant de l'app auprès d'Open Food Facts) | Non |
| | `REVENUECAT_SECRET_KEY`, `REVENUECAT_WEBHOOK_AUTH` | **Oui** |
| | `EXPO_ACCESS_TOKEN` (optionnel, sécurise l'envoi push) | **Oui** |
| `app.json` | `extra.eas.projectId` (créé par `eas init`, nécessaire aux jetons push) | Non |
| App (`.env`) | `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST` | Non (publics) |
| EAS | `SENTRY_AUTH_TOKEN` (envoi des source maps) | **Oui** |
| App (`.env`) | `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | Non (clés SDK publiques) |
| | `CRON_SECRET`, `SCAN_PHOTO_RETENTION_DAYS` (7) | `CRON_SECRET` oui |

## Montée en charge

- Toutes les requêtes de l'app sont indexées par `household_id` ; RLS repose sur des fonctions `security definer` stables (une sous-requête indexée).
- L'appel IA est le seul traitement lourd : il est fait en edge function (scalable horizontalement), avec timeout 90 s et 2 tentatives.
- Les photos ne transitent jamais en base ; elles sont purgées rapidement (coût de stockage quasi nul).
- Point à surveiller à partir de ~10 000 utilisateurs actifs : volume de `ai_usage_logs` (partitionnement mensuel ou agrégation) — prévu phase 6.
