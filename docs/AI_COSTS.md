# Coûts IA — conception et suivi

> **Depuis le 18/11/2026, l'ajout d'aliments est 100 % gratuit** : codes-barres (Open Food Facts, cache partagé), ticket de caisse et date de péremption lus sur le téléphone (OCR ML Kit, hors ligne). Aucun appel d'IA payante pour le stock. Le scan photo par IA décrit ci-dessous reste dans le code mais n'est plus proposé (réactivable avec `EXPO_PUBLIC_AI_PHOTO_SCAN=true`).
>
> L'IA payante ne sert plus qu'aux **recettes** et au **planning** (sections plus bas). Le tableau de bord admin (section *Scanner*) suit : ajouts par méthode, part traitée gratuitement, taux de reconnaissance correcte, corrections, coût IA payant par ajout et par utilisateur.


## Ce qui est déjà en place (phase 1)

| Levier | Effet |
|---|---|
| Redimensionnement 1280 px + JPEG 70 % sur le téléphone | ~1 600 tokens par photo au lieu de payer une image pleine résolution |
| Toutes les photos d'un espace en **un seul appel** | Le prompt système n'est payé qu'une fois par scan |
| Appel IA **uniquement** quand l'utilisateur appuie sur « Analyser » | Aucun appel en arrière-plan |
| Session idempotente + verrou `processing` | Pas de double appel (double clic, réseau instable) |
| Cache par empreinte SHA-256 des photos | Même photos = 0 appel, 0 scan décompté |
| Effort de raisonnement `low` | Extraction visuelle, pas besoin de raisonnement long |
| Nombre de photos plafonné par offre (4 gratuit, 6 payant) | Coût maximal borné par scan |
| Remboursement automatique si l'IA échoue | L'utilisateur ne paie jamais un échec |
| Journalisation par appel (`ai_usage_logs`) | Coût réel par scan, par utilisateur, par modèle |

## Estimation par scan (4 photos)

Hypothèse : ~7 300 tokens en entrée (4 × ~1 640 + consignes), ~2 300 en sortie (inventaire JSON d'une trentaine de produits). À **remplacer par les valeurs réelles** de `ai_usage_logs` dès les premiers scans.

| Modèle (`AI_VISION_MODEL`) | Coût / scan | Premium, usage typique (8 scans) | Premium, quota plein (30 scans) |
|---|---:|---:|---:|
| `claude-opus-5-5` (défaut actuel) | ~0,075 $ | ~0,60 $ | ~2,25 $ |
| `claude-sonnet-5-5` | ~0,038 $ | ~0,30 $ | ~1,14 $ |
| `claude-haiku-5-5` | ~0,002 $ | ~0,02 $ | ~0,06 $ |

Objectif du cahier des charges : **0,40 € par abonné Premium et par mois**.

**Conclusion** : le modèle par défaut (le plus performant) privilégie la priorité n°1 — la qualité de reconnaissance — mais **dépasse l'objectif de coût** dès un usage moyen. Démarche recommandée :

1. Constituer un jeu de 30 à 50 vraies photos de frigos/placards (variées : éclairage, désordre, étiquettes) avec l'inventaire attendu.
2. Mesurer pour chaque modèle : précision des noms, rappel (produits oubliés), erreurs de dates.
3. Retenir le modèle le moins cher qui tient le niveau de qualité, et le régler par simple variable d'environnement :

   ```bash
   supabase secrets set AI_VISION_MODEL=claude-haiku-5-5
   ```

Aucune mise à jour de l'app n'est nécessaire pour changer de modèle ou de fournisseur.

## Recettes (phase 2)

Leviers en place : stock lu côté serveur et limité à 120 lignes compactes (~15 tokens/ligne), 3 recettes par appel (le prompt n'est payé qu'une fois pour 3 idées), cache 24 h (même stock + mêmes filtres = 0 appel), seules les recettes réellement livrées sont décomptées, effort `low`, modèle réglable séparément (`AI_RECIPE_MODEL`).

Hypothèse par demande (3 recettes) : ~2 000 tokens en entrée, ~3 300 en sortie.

| Modèle (`AI_RECIPE_MODEL`) | Coût / demande | Gratuit (10 recettes ≈ 4 demandes) | Premium, 20 demandes / mois |
|---|---:|---:|---:|
| `claude-opus-5-5` (défaut actuel) | ~0,074 $ | ~0,30 $ | ~1,48 $ |
| `claude-sonnet-5-5` | ~0,037 $ | ~0,15 $ | ~0,74 $ |
| `claude-haiku-5-5` | ~0,002 $ | ~0,01 $ | ~0,04 $ |

⚠️ Avec le modèle par défaut, **un utilisateur gratuit actif coûte ~0,30 $/mois en recettes**, et le plafond « usage raisonnable » Premium (300 recettes) représenterait ~7 $ dans le pire cas. La génération de recettes est une tâche de texte où un modèle plus léger est généralement suffisant : c'est le premier réglage à tester (`AI_RECIPE_MODEL=claude-haiku-5-5` ou `claude-sonnet-5-5`), en comparant la qualité sur une dizaine de stocks réels. Le plafond `fair_use_recipe_cap` est modifiable dans la table `plans`.

## Planning de la semaine (phase 3)

Une génération de semaine = une génération de recettes par type de repas (7 recettes pour les dîners d'une semaine, 14 avec les déjeuners), décomptées du quota de recettes comme des recettes ordinaires. Coût ≈ coût par recette × nombre de repas : ~0,17 $ (Opus) / ~0,09 $ (Sonnet) / ~0,005 $ (Haiku) pour 7 dîners. Remplir la semaine avec des recettes déjà enregistrées ne coûte rien.

À surveiller : une génération de 7 recettes prend environ une minute ; la limite d'exécution des edge functions Supabase (150 s sur l'offre gratuite) est suffisante, mais un modèle plus rapide réduit l'attente.

Code-barres : aucun coût IA (Open Food Facts est gratuit ; cache partagé de 30 jours).

## Requêtes de suivi (en attendant le tableau de bord admin, phase 6)

```sql
-- Coût IA du mois, par fonctionnalité et par modèle
select feature, model, count(*) appels, sum(cost_usd) cout_usd, avg(cost_usd) cout_moyen, avg(latency_ms) latence_ms
from ai_usage_logs where created_at >= date_trunc('month', now()) group by feature, model;

-- Utilisateurs les plus coûteux du mois (détection d'abus)
select user_id, count(*) scans, sum(cost_usd) cout_usd
from ai_usage_logs where feature = 'scan' and created_at >= date_trunc('month', now())
group by user_id order by cout_usd desc limit 20;

-- Taux d'échec et de cache
select count(*) filter (where status = 'failed')  * 1.0 / count(*) taux_echec,
       count(*) filter (where from_cache) * 1.0 / count(*) taux_cache
from scan_sessions where created_at >= now() - interval '7 days';
```
