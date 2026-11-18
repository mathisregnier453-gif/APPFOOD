# Feuille de route

## ✅ Phase 1 — MVP (livrée dans ce dépôt)

- Inscription, connexion, profil, consentement RGPD
- Foyer personnel créé automatiquement (base du partage Famille)
- Scanner IA : choix de l'espace, plusieurs photos, compression, analyse serveur, quotas, cache, remboursement en cas d'échec
- Vérification des résultats : modifier, supprimer, ajouter, choisir l'emplacement, valider
- Inventaire : 3 espaces, catégories, recherche, tri par catégorie ou par date
- Ajout manuel, correction rapide des quantités, déplacement, « terminé », « jeté », suppression, historique
- Dates DLC/DDM saisies et alertes visuelles (avec messages de vérification, jamais alarmistes)
- Suppression de compte, purge des photos
- Schéma complet de la base (toutes les tables des phases suivantes) + RLS testé

**Vérifié** : typecheck app + edge functions, 17 tests unitaires (normalisation IA, coûts, dates), 27 tests SQL (RLS, quotas, scans), bundle Android Metro.
**Non vérifié** : exécution sur un appareil réel, appel IA réel (nécessite les clés et un projet Supabase).

## ✅ Phase 2 — Intelligence alimentaire (livrée)

- Rappels de péremption (notifications locales groupées, délai réglable), alerte de quota de scans, réglages par type
- Génération de recettes depuis le stock réel, priorité anti-gaspi ; disponible / à acheter / basiques calculés par le serveur puis recalculés sur le stock actuel
- Envies : anti-gaspi, avec mon stock, rapide, économique, équilibré, protéiné, végétarien ; filtres : type de repas, temps, personnes, budget, difficulté
- Préférences alimentaires : régimes, 14 allergènes réglementaires + saisie libre, aliments évités — filtrage serveur des recettes
- Onglet Recettes (idées, favoris, « réalisables maintenant »), fiche recette, favoris
- Accueil : recettes recommandées
- Quota de recettes (10/mois en gratuit, plafond « usage raisonnable » en payant), cache 24 h

**Vérifié** : typecheck, 32 tests unitaires serveur + app, 40 tests SQL, bundle iOS Metro.
**Non vérifié** : appel IA réel, notifications sur appareil réel.
**Reporté** : code-barres Open Food Facts → phase 3 (fait) ; réservation des favoris / notifications intelligentes à l'offre Premium → phase 4 (avec le paywall, pour ne pas bloquer une fonction sans moyen de s'abonner).

## ✅ Phase 3 — Organisation (livrée)

- Onglets définitifs : Accueil, Mon stock, Recettes, Planning, Courses + bouton Scanner flottant sur tous les onglets ; Profil depuis l'avatar de l'Accueil
- Planning hebdomadaire (petit-déjeuner optionnel, déjeuner, dîner), navigation par semaine, repas libres (« Restes », « Repas dehors »)
- Génération IA de la semaine : stock, préférences, personnes, budget, temps ; produits urgents placés en début de semaine ; repas déjà choisis jamais écrasés (sauf option)
- Remplacer un repas : par une recette enregistrée, une nouvelle idée IA ou un repas libre ; planifier depuis une fiche recette
- Liste de courses : générée depuis le planning (seul le manquant, à l'échelle des personnes, stock partagé entre repas, unités agrégées), depuis une recette, ou à la main (« 2 kg pommes de terre ») ; classement par catégorie ; anti-doublons côté base ; cases à cocher ; synchronisation temps réel
- Achats rangés dans le stock (emplacement proposé selon la catégorie, date de péremption facultative)
- « J'ai cuisiné » : quantités restantes proposées (conversion g/kg, ml/l, portions), validées par l'utilisateur, historisées
- Code-barres : lecture EAN/UPC, fiche Open Food Facts via le serveur (cache partagé), pré-remplissage de l'ajout manuel
- Notifications : heure du repas prévu ; ingrédient manquant la veille à 17 h
- Accueil : prochain repas

**Vérifié** : typecheck, 45 tests unitaires (app + serveur), 61 tests SQL, bundle Android Metro.
**Non vérifié** : appareil réel (caméra, notifications), appels IA et Open Food Facts réels.
**Reporté** : notification « liste de courses mise à jour » et activité du foyer → phase 5 (n'a de sens qu'avec plusieurs membres).

## ✅ Phase 4 — Monétisation (livrée)

- Offres Gratuit / Premium / Famille, mensuel et annuel (-20 %), décrites dans la table `plans` (quotas, fonctions, produits)
- RevenueCat : achat, changement d'offre (iOS et Android), restauration, gestion de l'abonnement, synchronisation immédiate après achat
- Webhook RevenueCat authentifié et idempotent ; droits recalculés depuis l'API RevenueCat (résiliation, grâce, remboursement, transfert)
- Droits vérifiés côté serveur : planning, génération de la semaine, favoris, historique ; quotas déjà serveur depuis les phases 1-2
- Paywall contextuel (quota de scans, de recettes, favoris, planning, historique, rappels) ; prix issus du store ; mentions légales d'abonnement
- Retour à l'offre gratuite sans perte de données ; aucun achat consommable (aucun scan facturé sans accord)
- Suppression de compte : données RevenueCat effacées

**Vérifié** : typecheck, 57 tests unitaires, 79 tests SQL, bundle iOS Metro.
**Non vérifié** : achats réels/sandbox (nécessite les comptes stores, RevenueCat et un *development build*).
Détails et mise en place : [BILLING.md](BILLING.md).

## ✅ Phase 5 — Famille et partage (livrée)

- Écran « Mon foyer » : membres (noms uniquement, jamais les e-mails), renommage, invitations, retrait d'un membre, départ, changement de foyer
- Invitations par code de 8 caractères (sans caractères ambigus), à usage unique, valable 7 jours, un seul code actif, partage via la feuille de partage du téléphone
- Anti force brute : 10 essais infructueux par heure et par utilisateur
- Offre Famille requise pour inviter et rejoindre ; plafond de membres lu dans `plans.max_members` (6)
- Stock, liste de courses, planning et scans partagés en temps réel (Realtime déjà branché)
- Fin de l'offre Famille : le propriétaire garde la main, les autres membres passent en lecture seule (aucune perte de données)
- Départ du propriétaire : propriété transmise au membre le plus ancien ; un membre sans foyer retrouve un foyer personnel ; l'abonnement d'un membre le suit
- Recettes et planning : allergies de **tous** les membres exclues
- Fil « Activité du foyer » sur l'Accueil, alimenté par la base (ajouts regroupés : un scan de 20 produits = une entrée)
- Notifications push serveur (Expo) : activité du foyer et liste de courses, regroupées sur une minute, selon les préférences de chacun, jamais à l'auteur

**Vérifié** : typecheck, 63 tests unitaires, 113 tests SQL, bundle Android Metro.
**Non vérifié** : deux appareils réels (temps réel, push) — nécessite un projet EAS et des appareils.

## ✅ Phase 6 — Optimisation et lancement (livrée)

- Espace administrateur (réservé aux comptes `is_admin`, vérifié par le serveur, actions journalisées) :
  - tableau de bord : inscrits, actifs, gratuits / Premium / Famille, MRR brut et net, scans, coût IA total, par scan, par abonné et par utilisateur gratuit, hébergement, marge estimée par abonné Premium vs objectif, conversion, résiliation ;
  - détection des coûts anormaux (utilisateurs > 5× la moyenne, fonctionnalités > 10 % d'échecs) ;
  - utilisateurs : recherche, suspension / réactivation, scans offerts ;
  - offres : quotas, fonctions, prix de référence ; paramètres financiers (TVA, commission, change, hébergement, objectif) ;
  - erreurs techniques (serveur, IA, paiements)
- Journal des erreurs serveur dans toutes les edge functions
- Sentry (app) sans données personnelles ; PostHog (UE) uniquement avec consentement, événements anonymes en liste blanche
- Agrégation quotidienne des coûts IA et rétention des journaux
- Test de charge reproductible (10 000 foyers) ; index manquant détecté et corrigé (lecture × 5,5)
- Préparation des stores : identifiants, permissions minimales, profils EAS, déclarations de confidentialité, fiche store, check-list ([STORE_RELEASE.md](STORE_RELEASE.md))

**Vérifié** : typecheck, 63 tests unitaires, 142 tests SQL, test de charge, bundle iOS Metro, configuration Expo valide.
**Non vérifié** : builds natifs EAS, appareils réels, services externes (IA, RevenueCat, Expo Push, Sentry, PostHog, Open Food Facts) — nécessitent les comptes et clés.

## ✅ Scanner 100 % gratuit (18/11/2026)

- Codes-barres en rafale, ticket de caisse (OCR local), lecture des dates de péremption (OCR local), saisie manuelle
- Aucun appel d'IA payante pour le stock ; le scan photo par IA reste désactivable par configuration
- Mesure de qualité (corrections, suppressions) et nouvelle section *Scanner* du tableau de bord admin
- Offres : le scanner est gratuit et illimité pour tous ; les offres payantes portent sur les recettes, le planning, les favoris, l'historique et le foyer

**Vérifié** : 33 tests unitaires app (dont tickets et dates), 151 tests SQL, migration appliquée en production, bundle Android.
**Non vérifié** : OCR sur appareil réel (nécessite la version compilée) — à tester sur de vrais tickets et emballages.

## ✅ Recettes et planning 100 % gratuits (18/11/2026)

- Moteur de recettes sans IA : base de 39 recettes originales (petits-déjeuners, plats, végétarien, poisson, desserts), choisies selon le stock réel
- Mêmes garanties : liens vérifiés vers les vrais aliments du stock, allergies de tout le foyer, régimes, aliments non aimés, filtres stricts, priorité anti-gaspi, quantités adaptées au nombre de personnes, variété (idées récentes reléguées)
- Le planning de la semaine utilise le même moteur ; plus aucune clé d'IA nécessaire

**À faire** : enrichir la base de recettes (objectif 150+) — c'est désormais le principal levier de qualité.
