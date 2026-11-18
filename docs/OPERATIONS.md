# Exploitation

## Tâches planifiées

| Tâche | Fréquence | Comment |
|---|---|---|
| `push-dispatch` | chaque minute | Supabase Cron → POST vers l'edge function, en-tête `x-cron-secret` |
| `purge-scan-photos` | toutes les heures | idem |
| Agrégation des coûts IA + rétention | chaque nuit | SQL ci-dessous (pg_cron) |

```sql
select cron.schedule('sauge-ai-rollup', '17 2 * * *',
  $$select public.rollup_ai_usage(current_date - 1); select public.purge_old_logs();$$);
```

Rétention : journaux IA bruts 13 mois (agrégats quotidiens conservés), erreurs serveur 6 mois, activité du foyer 3 mois, essais d'invitation 1 jour, événements RevenueCat traités 13 mois.

## Surveillance

| Quoi | Où |
|---|---|
| Crash et erreurs de l'app | Sentry (`EXPO_PUBLIC_SENTRY_DSN`) — sans e-mail, sans IP, URL tronquées |
| Erreurs serveur, échecs IA, paiements | Espace admin → Erreurs techniques (`error_logs`, `ai_usage_logs`, `revenuecat_events`) |
| Coûts, marge, conversion, résiliation | Espace admin → tableau de bord |
| Usage produit | PostHog (serveur UE), uniquement pour les utilisateurs qui l'ont accepté |

Seuils à surveiller chaque semaine dans le tableau de bord :
- **IA / abonné / mois** au-dessus de 0,40 € → changer de modèle (`AI_VISION_MODEL`, `AI_RECIPE_MODEL`), voir [AI_COSTS.md](AI_COSTS.md) ;
- **Marge / Premium** sous l'objectif (3 €) ;
- utilisateurs signalés « coût anormal » (plus de 5 fois la moyenne) → vérifier, suspendre en cas d'abus ;
- fonctionnalité avec plus de 10 % d'échecs ;
- événements de paiement en erreur (droits possiblement non appliqués).

Renseigner dans *Paramètres financiers* le coût d'hébergement réel (facture Supabase) et vérifier le taux de change : la marge affichée en dépend.

## Administrateurs

Un administrateur se désigne en base (aucune interface ne permet de s'auto-promouvoir) :

```sql
update public.profiles set is_admin = true where id = '<uuid>';
```

Toutes les actions (suspension, scans offerts, offres, paramètres financiers) sont journalisées dans `admin_audit_log`. Un administrateur ne peut pas se suspendre lui-même.

## Test de charge

`bash supabase/tests/load/run.sh [clients] [durée]` crée une base jetable avec **10 000 foyers, 300 000 aliments, 80 000 articles de courses, 100 000 journaux IA**, puis mesure avec `pgbench` les parcours réels de l'app, **RLS activé** :

- *lecture* (ouverture de l'app) : stock, quota, liste de courses ;
- *écriture* : ajout d'un aliment puis consommation (RPC).

Résultats mesurés (conteneur 4 vCPU, PostgreSQL 16, 30 s par test) :

| Parcours | Clients | Transactions / s | Latence moyenne | Échecs |
|---|---:|---:|---:|---:|
| Lecture — avant correction | 20 | 518 | 38,6 ms | 0 |
| Lecture — après ajout des index | 20 | 2 849 | 7,0 ms | 0 |
| Lecture — après ajout des index | 100 | 2 718 | 36,8 ms | 0 |
| Écriture | 20 | 1 840 | 10,9 ms | 0 |

Le test a révélé une lecture de la liste de courses en parcours complet de table (aucun index sur `household_id`) : corrigé dans la migration de la phase 6, débit de lecture multiplié par 5,5. Ces chiffres portent sur la base seule ; l'appel IA (plusieurs secondes) n'est pas limitant côté serveur puisqu'il s'exécute dans des edge functions sans état.

## Sauvegardes

- Plan Supabase Pro : sauvegardes quotidiennes ; activer le **Point-in-Time Recovery** avant le lancement.
- Tester une restauration sur un projet de préproduction au moins une fois avant la publication.
- Les migrations (`supabase/migrations`) permettent de recréer le schéma à l'identique.
