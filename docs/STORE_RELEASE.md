# Publication sur l'App Store et Google Play

## 1. Prérequis techniques

- [ ] Remplacer les valeurs provisoires de `app.json` : `ios.bundleIdentifier` / `android.package` (`com.sauge.app`), `extra.privacyPolicyUrl`, `extra.termsUrl`, `extra.supportEmail`, organisation Sentry dans le plugin `@sentry/react-native/expo`.
- [ ] `npx eas-cli@latest init` (identifiant de projet, nécessaire aux notifications push) puis renseigner `submit.production.ios.ascAppId` dans `eas.json`.
- [ ] Projet Supabase de **production** en région UE, migrations appliquées, secrets définis (voir README), tâches planifiées ([OPERATIONS.md](OPERATIONS.md)), PITR activé.
- [ ] Choix des modèles IA validé sur un jeu de vraies photos ([AI_COSTS.md](AI_COSTS.md)).
- [ ] Abonnements créés et testés en sandbox ([BILLING.md](BILLING.md)).
- [ ] `SENTRY_AUTH_TOKEN` défini dans les secrets EAS (envoi des source maps des builds de production).
- [ ] Build : `npx eas-cli@latest build --profile production --platform all`, puis tests sur TestFlight et piste de test interne Google.

## 2. Points de contrôle des stores

| Exigence | État dans l'app |
|---|---|
| Suppression du compte depuis l'app (Apple 5.1.1(v)) | Profil → Supprimer mon compte |
| Restauration des achats | Paywall → Restaurer mes achats |
| Mentions d'abonnement à renouvellement automatique + liens CGU / confidentialité sur le paywall (Apple 3.1.2) | Présentes ; liens à renseigner |
| Prix affichés = prix du store | Oui, via RevenueCat |
| Pas de fonction factice, pas de données de démonstration | Aucune donnée insérée hors référentiels (catégories, offres) |
| Sign in with Apple | Non requis : connexion par e-mail uniquement, sans service tiers |
| Textes des autorisations (caméra, photos, notifications) | Définis dans `app.json`, en français |
| Chiffrement (export compliance) | `usesNonExemptEncryption: false` (HTTPS standard) |

**Compte de démonstration pour la revue** : créer un compte dédié sur le projet de production (aucune donnée fictive dans l'app), lui attribuer temporairement l'offre Premium via la sandbox, et fournir ses identifiants dans les notes de revue. Préciser que le scan nécessite de photographier des aliments réels.

## 3. Confidentialité (déclarations des stores)

Données collectées, **liées à l'utilisateur**, non utilisées pour le suivi publicitaire, non vendues :

| Donnée | Finalité | Apple (App Privacy) | Google (Sécurité des données) |
|---|---|---|---|
| Adresse e-mail | Compte | Coordonnées → E-mail | Informations personnelles → Adresse e-mail |
| Prénom (facultatif) | Affichage dans le foyer | Coordonnées → Nom | Informations personnelles → Nom |
| Photos des espaces de stockage | Reconnaissance des aliments (supprimées sous 7 jours) | Photos ou vidéos | Photos et vidéos → Photos |
| Stock, recettes, planning, courses | Fonctionnement de l'app | Contenu utilisateur → Autre | Activité dans les applis → Autre contenu généré |
| Allergies et régimes | Filtrage des recettes | Données de santé | Santé et remise en forme → Informations de santé |
| Historique d'achats | Abonnement | Achats | Informations financières → Historique des achats |
| Diagnostics de plantage | Correction des erreurs (Sentry, sans identité) | Diagnostics → Données de plantage (non liées) | Infos et performances de l'appli |
| Statistiques d'usage (si acceptées) | Amélioration du produit (PostHog UE, anonyme) | Données d'utilisation → Interaction (non liées) | Activité dans les applis → Interactions |

Chiffrement en transit : oui. Suppression à la demande : oui (dans l'app).

## 4. Fiche store (proposition)

**Nom** : Sauge — Frigo & recettes
**Sous-titre** (30 car.) : Scannez, cuisinez, gaspillez moins

**Description** :

> Ouvrez le frigo, prenez une photo : Sauge reconnaît vos aliments et tient votre stock à jour.
>
> • Scanner IA du réfrigérateur, du congélateur et des placards — vous vérifiez, Sauge enregistre.
> • Dates de péremption et rappels avant qu'il ne soit trop tard.
> • Des recettes avec ce que vous avez déjà, en priorité ce qui doit être consommé vite.
> • Planning de la semaine et liste de courses générée automatiquement : seulement ce qui manque.
> • Code-barres, ajout manuel, historique de consommation.
> • Foyer partagé : stock, courses et repas synchronisés pour toute la famille.
>
> Gratuit pour découvrir (scanner illimité et 6 idées de recettes par mois). Premium et Famille pour aller plus loin. Vos photos ne servent qu'à reconnaître vos aliments et sont supprimées sous 7 jours.

**Mots-clés** (iOS, 100 car.) : frigo,anti-gaspi,recettes,courses,péremption,inventaire,repas,planning,cuisine,stock

**Catégorie** : Cuisine et boissons (iOS) / Alimentation et boissons (Android). **Âge** : 4+ / Tout public.

Captures à prévoir (6,7" et 5,5" iOS, téléphone Android) : scan → vérification, stock, alerte de péremption, recette « réalisable maintenant », planning, liste de courses.
