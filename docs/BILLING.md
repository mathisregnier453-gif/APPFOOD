# Abonnements — RevenueCat

## Offres

| Offre | Mensuel | Annuel (-20 %) | Scans / mois | Recettes / mois | Fonctions |
|---|---:|---:|---:|---:|---|
| Gratuit | 0 € | — | 3 | 10 | Stock, scan, recettes, liste de courses manuelle, rappel de péremption (2 jours avant) |
| Premium | 4,99 € | 47,90 € | 30 | illimité* | + planning, génération de la semaine, liste de courses de la semaine, favoris, historique de consommation, rappels intelligents (délai personnalisé, repas, ingrédients manquants) |
| Famille | 6,99 € | 67,10 € | 60 (foyer) | illimité* | + foyer partagé jusqu'à 6 personnes (stock, courses, planning, scans), notifications d'activité |

\* « usage raisonnable » : plafond `fair_use_recipe_cap` (300 / 600), modifiable dans la table `plans`.

Quotas, fonctions, identifiants produits et prix de référence sont dans la table **`plans`** (modifiable depuis l'admin, phase 6). Les **prix affichés** viennent toujours du store via RevenueCat : ce sont ceux que l'utilisateur paie réellement.

## Qui vérifie quoi

| Droit | Vérification serveur | Interface |
|---|---|---|
| Quota de scans | `consume_scan_quota` (atomique) | compteur, paywall au quota |
| Quota de recettes | `consume_recipe_quota` (atomique) | compteur, paywall au quota |
| Planning | RLS `meal_plans` + `meal-plan-generate` (`feature_locked`) | onglet verrouillé |
| Favoris | RLS `favorites` | paywall sur le cœur |
| Historique de consommation | RLS en lecture (toujours enregistré) | carte « Premium » |
| Rappels intelligents | — (notifications locales, sans coût serveur) | réglages verrouillés |
| Foyer partagé | invitations / adhésion (`plans.max_members`), écriture des membres (`can_write_household`) | bouton « Inviter », lecture seule signalée |

Après une expiration, l'utilisateur repasse en gratuit **sans perte de données** : planning et favoris restent lisibles, l'historique redevient visible dès un nouvel abonnement.

Aucun achat consommable (pack de scans) n'existe : impossible de facturer un scan sans l'accord explicite de l'utilisateur. Tout achat passe par la fenêtre de confirmation du store.

## Flux

```
App ──purchasePackage──▶ Store ──▶ RevenueCat ──webhook──▶ revenuecat-webhook ─┐
 │                                     ▲                                      │ relit l'état de référence
 └──subscription-sync (juste après l'achat / la restauration)─────────────────┤ GET /v1/subscribers/{id}
                                                                              ▼
                                                                      table subscriptions
                                                                              ▼
                                                     effective_plan() → quotas et droits (RLS)
```

- `app_user_id` RevenueCat = identifiant Supabase de l'utilisateur (`Purchases.logIn`).
- Le webhook n'est **pas** cru sur parole : il déclenche une relecture de l'état chez RevenueCat (`_shared/revenuecat.ts`, testé). L'ordre d'arrivée des événements est donc sans importance.
- Idempotence : `revenuecat_events` (un événement rejoué n'est traité qu'une fois) ; erreur => HTTP 500 => RevenueCat réessaie.
- Résiliation : droits conservés jusqu'à la fin de la période payée. Période de grâce (problème de paiement) : droits conservés. Remboursement : droits retirés.
- Changement d'offre : iOS via le groupe d'abonnements ; Android via `GoogleProductChangeInfo` (remplacement de l'abonnement en cours).
- L'abonnement couvre le foyer courant du payeur (Famille : tout le foyer).

## Mise en place

1. **App Store Connect** : un groupe d'abonnements « Sauge » contenant `sauge_premium_monthly`, `sauge_premium_yearly`, `sauge_family_monthly`, `sauge_family_yearly` (Famille au niveau supérieur). Adhérer au *Small Business Program* (commission 15 %).
2. **Google Play Console** : 4 abonnements avec les mêmes identifiants (un *base plan* chacun).
3. **RevenueCat** :
   - entitlements `premium` et `family` ;
   - offering `default` contenant les 4 produits ;
   - webhook vers `https://<projet>.supabase.co/functions/v1/revenuecat-webhook` avec un en-tête `Authorization` secret.
4. **Secrets Supabase** :

   ```bash
   supabase secrets set REVENUECAT_SECRET_KEY=sk_... REVENUECAT_WEBHOOK_AUTH="Bearer <valeur aléatoire longue>"
   ```

5. **App** (`.env`) : `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (clés SDK publiques).
6. Remplacer `extra.termsUrl` et `extra.privacyPolicyUrl` dans `app.json` (liens obligatoires sur le paywall pour Apple).
7. Tester en *sandbox* (TestFlight / piste de test interne) : achat, renouvellement accéléré, résiliation, restauration, passage Premium → Famille. Les achats sandbox sont marqués `subscriptions.is_sandbox` et doivent être exclus des statistiques de revenus (phase 6).

## Rentabilité (rappel)

Pour 4,99 € TTC : TVA ~0,83 €, commission store ~0,62 € (15 %), reste ~3,54 € avant coûts variables. Le budget IA par abonné (objectif 0,40 €) dépend directement des modèles choisis : voir [AI_COSTS.md](AI_COSTS.md). Les coûts réels par abonné seront suivis dans le tableau de bord admin (phase 6) à partir de `ai_usage_logs` et `subscriptions`.
