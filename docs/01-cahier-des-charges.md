# Talbi (طلبي) — Cahier des charges

> **Version** : 0.1 (brouillon de travail)
> **Date** : octobre 2026
> **Porteur du projet** : Samy Rekkis
> **Statut** : à valider

---

## Sommaire

1. [Vision du projet](#1-vision-du-projet)
2. [Périmètre](#2-périmètre)
3. [Les utilisateurs (acteurs)](#3-les-utilisateurs-acteurs)
4. [Le parcours d'une mission](#4-le-parcours-dune-mission)
5. [Fonctionnalités](#5-fonctionnalités)
6. [Modèle économique](#6-modèle-économique)
7. [Exigences de qualité (non fonctionnelles)](#7-exigences-de-qualité-non-fonctionnelles)
8. [Architecture et choix techniques](#8-architecture-et-choix-techniques)
9. [Feuille de route](#9-feuille-de-route)
10. [Risques et réponses](#10-risques-et-réponses)
11. [Décisions restant à prendre](#11-décisions-restant-à-prendre)
12. [Glossaire](#12-glossaire)

---

## 1. Vision du projet

### 1.1 En une phrase

**Talbi est la plateforme algérienne où le client publie son besoin et où les prestataires lui envoient leurs offres.** C'est un *reverse marketplace* (marketplace inversée), sur le modèle d'Upwork, adapté au marché algérien.

### 1.2 Le problème

En Algérie, trouver un prestataire fiable, qu'il s'agisse d'un plombier à Oran ou d'un graphiste à distance, passe aujourd'hui par :

- **le bouche-à-oreille** : lent, et limité au cercle de connaissances ;
- **les groupes Facebook et les petites annonces** : pas de vérification, pas d'avis fiables, des prix opaques, des arnaques fréquentes ;
- **les plateformes étrangères** (Upwork, Fiverr) : en devises, en anglais, inaccessibles aux services sur place et difficiles à payer depuis l'Algérie.

Côté prestataires, la difficulté est inverse : trouver des clients coûte cher (publicité, temps) et rien ne garantit le paiement.

### 1.3 La solution

| Pour le **client** | Pour le **prestataire** |
|---|---|
| Publier son besoin en 2 minutes, gratuitement | Recevoir des demandes ciblées sans payer de publicité |
| Recevoir plusieurs offres et comparer les prix | Se construire une réputation (avis, badge vérifié) |
| Choisir des prestataires notés et vérifiés | Être payé de façon garantie (séquestre) |
| Payer en dinars, argent protégé jusqu'à la livraison | Gérer ses missions et ses revenus au même endroit |

### 1.4 Ce qui différencie Talbi

1. **Services à distance ET sur place** : Upwork ne couvre pas les artisans et techniciens locaux. Talbi couvre les deux, avec un filtrage par wilaya et commune.
2. **100 % algérien** : dinar, Edahabia/CIB, BaridiMob, interface en français et en arabe, découpage en wilayas et communes.
3. **La confiance comme produit** : vérification d'identité, avis vérifiés (seulement après une vraie mission), paiement sous séquestre, médiation en cas de litige.
4. **L'IA au service de l'utilisateur** : aide à rédiger une demande claire, estimation de prix, détection des fraudes.

---

## 2. Périmètre

### 2.1 Deux types de services

| | **À distance** | **Sur place** |
|---|---|---|
| Exemples | Développement web, design, traduction, montage vidéo, rédaction, marketing digital, comptabilité, cours en ligne | Plomberie, électricité, peinture, climatisation, déménagement, ménage, réparation électroménager, cours à domicile, BTP léger |
| Zone | Toute l'Algérie (et diaspora) | Wilaya / commune du client |
| Paiement typique | En ligne, sous séquestre | En ligne ou en espèces à la fin (voir §6.3) |
| Devis | Souvent prix fixe | Souvent « sur devis » après visite |

### 2.2 Catégories de départ (configurables)

La plateforme est **généraliste** : les catégories et leurs champs spécifiques se gèrent depuis l'administration, sans toucher au code.

Catégories prévues au lancement (liste indicative) :

- **Numérique** : développement web et mobile, design graphique, montage vidéo, marketing digital, rédaction et traduction
- **Maison et travaux** : plomberie, électricité, peinture, climatisation et chauffage, menuiserie, maçonnerie
- **Services à la personne** : ménage, déménagement, cours particuliers, garde
- **Réparation** : électroménager, téléphones et ordinateurs, auto (mécanique à domicile)
- **Événementiel** : photographe, traiteur, décoration
- **Business** : comptabilité, juridique, conseil

> **Stratégie de lancement** : la plateforme accepte toutes les catégories, mais le marketing de départ se concentre sur **3 ou 4 catégories phares** dans **2 ou 3 grandes villes** (Alger, Oran, Constantine) afin d'atteindre rapidement assez d'offres et de demandes. Voir §10.

### 2.3 Hors périmètre (pour la V1)

- Vente de produits physiques (Talbi vend des **services**)
- Application mobile native (la V1 est un site web installable sur téléphone, voir §7)
- Paiement en devises étrangères

---

## 3. Les utilisateurs (acteurs)

| Acteur | Description | Ce qu'il peut faire |
|---|---|---|
| **Visiteur** | Personne non connectée | Parcourir les catégories, voir les missions publiques et les profils de prestataires, s'inscrire |
| **Client** | Particulier ou entreprise qui a un besoin | Publier des missions, recevoir et comparer des propositions, discuter, signer un contrat, payer, noter |
| **Prestataire** | Freelancer, artisan, technicien ou petite entreprise | Créer son profil pro, répondre aux missions, gérer ses contrats, recevoir ses paiements, noter |
| **Modérateur** | Membre de l'équipe Talbi | Valider les identités, modérer les contenus, traiter les signalements et les litiges |
| **Administrateur** | Gestionnaire de la plateforme | Tout ce que fait le modérateur, plus : catégories, commissions, prix des jetons, statistiques, gestion de l'équipe |

> **Choix important** : **un seul compte peut être client ET prestataire**, avec un bouton pour passer d'un mode à l'autre. Un électricien peut ainsi lui-même chercher un comptable sur Talbi, sans créer un second compte.

---

## 4. Le parcours d'une mission

### 4.1 Le parcours en 7 étapes

```
 CLIENT                          TALBI                          PRESTATAIRE
   │                               │                                 │
 1 │── Publie une mission ────────▶│                                 │
   │                               │── 2. Notifie les prestataires ─▶│
   │                               │      pertinents (catégorie,     │
   │                               │      wilaya, compétences)       │
   │                               │◀─ 3. Envoie une proposition ────│
   │◀─ Reçoit les propositions ────│      (prix, délai, message)     │
 4 │◀──────────── Messagerie : questions, négociation ──────────────▶│
 5 │── Accepte une proposition ───▶│── Crée le contrat ─────────────▶│
   │── Paie (argent bloqué) ──────▶│   (séquestre)                   │
   │                               │◀─ 6. Réalise et livre ──────────│
   │── Valide la livraison ───────▶│── Libère le paiement ──────────▶│
 7 │◀──────────────── Notation mutuelle ────────────────────────────▶│
```

### 4.2 Les statuts d'une mission

| Statut | Signification |
|---|---|
| **Brouillon** | Le client rédige, rien n'est visible |
| **Publiée** | Visible, les prestataires peuvent proposer |
| **Attribuée** | Le client a choisi une proposition, un contrat est créé |
| **En cours** | Le travail a commencé (paiement sécurisé si paiement en ligne) |
| **Livrée** | Le prestataire déclare avoir terminé, le client doit valider |
| **Terminée** | Le client a validé, le paiement est libéré, les avis sont ouverts |
| **Annulée** | Annulée avant attribution, ou d'un commun accord |
| **Expirée** | Aucune proposition retenue après le délai (30 jours par défaut) |
| **En litige** | Désaccord, un modérateur intervient |

### 4.3 Les statuts d'une proposition

**Envoyée** → **Vue** par le client → **Présélectionnée** → **Acceptée** / **Refusée** / **Retirée** par le prestataire

### 4.4 Règles automatiques

- Si le client ne valide pas une livraison sous **7 jours** et n'ouvre pas de litige, la mission passe automatiquement en « Terminée » et le prestataire est payé. Cela protège le prestataire contre un client qui disparaît.
- Une mission sans activité depuis 30 jours expire automatiquement.
- Un prestataire ne peut envoyer **qu'une seule proposition** par mission (modifiable tant qu'elle n'est pas acceptée).

---

## 5. Fonctionnalités

Les fonctionnalités sont classées par version :

- **V1 (MVP)** : l'indispensable pour lancer
- **V2** : ce qui renforce la croissance et les revenus
- **V3** : les évolutions à plus long terme

### 5.1 Comptes et profils

| Fonctionnalité | Version |
|---|---|
| Inscription par e-mail ou numéro de téléphone (code SMS) | V1 |
| Connexion avec Google | V1 |
| Mot de passe oublié, double authentification (obligatoire pour l'équipe) | V1 |
| Profil client : nom, photo, wilaya, type (particulier / entreprise) | V1 |
| Profil prestataire : titre, description, compétences, catégories, wilayas couvertes, tarifs indicatifs, portfolio (photos, liens), langues parlées, disponibilité | V1 |
| Vérification d'identité (pièce d'identité + selfie) → badge « Vérifié » | V1 |
| Statistiques publiques : note moyenne, missions terminées, taux de réponse, ancienneté | V1 |
| Niveaux de prestataire (Nouveau → Confirmé → Top Talbi) selon les performances | V2 |
| Vérification du registre de commerce ou de la carte d'auto-entrepreneur → badge « Pro » | V2 |
| Comptes entreprise avec plusieurs membres | V3 |

### 5.2 Missions (demandes des clients)

| Fonctionnalité | Version |
|---|---|
| Création d'une mission : titre, description, catégorie, photos et pièces jointes | V1 |
| Mode : **à distance** ou **sur place** (wilaya + commune, adresse précise révélée seulement au prestataire retenu) | V1 |
| Type de budget : **prix fixe**, **fourchette**, ou **sur devis** (utile pour les travaux qui nécessitent une visite) | V1 |
| Date souhaitée, option « Urgent » | V1 |
| Champs spécifiques par catégorie (ex. : surface pour la peinture, marque pour l'électroménager) | V1 |
| Visibilité : publique, ou sur invitation (le client invite des prestataires précis) | V1 |
| **Assistant IA** : transforme une demande vague en mission claire et complète | V2 |
| **Estimation de prix IA** à partir des missions similaires terminées | V2 |
| Missions récurrentes (ex. : ménage chaque semaine) | V3 |

### 5.3 Propositions (offres des prestataires)

| Fonctionnalité | Version |
|---|---|
| Proposition : prix, délai, message personnalisé, pièces jointes | V1 |
| Proposition découpée en étapes (jalons) pour les grosses missions | V1 |
| Coût en **jetons** pour envoyer une proposition (voir §6) | V1 |
| Tableau de comparaison des propositions pour le client (prix, délai, note, badge) | V1 |
| Présélection et refus avec message automatique poli | V1 |
| Remboursement des jetons si la mission est annulée par le client sans attribution | V1 |
| Proposition « boostée » (mise en avant payante en tête de liste) | V2 |

### 5.4 Recherche et mise en relation

| Fonctionnalité | Version |
|---|---|
| Recherche de missions par mot-clé, catégorie, wilaya, budget, mode | V1 |
| Recherche de prestataires (pour les inviter) | V1 |
| Alertes : le prestataire est notifié des nouvelles missions qui correspondent à son profil | V1 |
| **Recommandation intelligente** : classement des missions et des prestataires selon la pertinence (compétences, distance, note, historique) | V2 |
| Recherche tolérante aux fautes, en français, en arabe et en darija transcrite | V2 |

### 5.5 Messagerie

| Fonctionnalité | Version |
|---|---|
| Messagerie en temps réel entre client et prestataire | V1 |
| Envoi de fichiers et de photos | V1 |
| Indicateurs « vu » et « en train d'écrire » | V1 |
| **Protection anti-contournement** : avant la signature du contrat, les numéros de téléphone et e-mails écrits dans les messages sont détectés et masqués (voir §10) | V1 |
| Signalement d'un message ou d'un utilisateur | V1 |
| Messages vocaux | V2 |

### 5.6 Contrats et paiements

| Fonctionnalité | Version |
|---|---|
| Création automatique du contrat à l'acceptation d'une proposition | V1 |
| Contrat avec jalons : chaque étape est payée et validée séparément | V1 |
| **Paiement sous séquestre** : le client paie, l'argent est bloqué, puis libéré au prestataire après validation | V1 |
| Paiement par carte **Edahabia** et **CIB** (via une passerelle de paiement agréée) | V1 |
| Paiement par **virement BaridiMob / CCP** avec envoi du reçu et validation par l'équipe | V1 |
| Paiement **en espèces** pour les services sur place (sans séquestre, voir §6.3) | V1 |
| **Portefeuille** prestataire : solde disponible, solde en attente, historique | V1 |
| Demande de retrait vers CCP ou compte bancaire | V1 |
| Factures et reçus automatiques en PDF (bilingues) | V1 |
| Achat de packs de jetons | V1 |
| Pourboire après la mission | V2 |

> **Note réglementaire** : la conservation de fonds pour le compte de tiers (séquestre) doit être réalisée **avec un partenaire de paiement ou une banque agréée** par la Banque d'Algérie. C'est à vérifier auprès d'un juriste avant le lancement. Le système est conçu pour fonctionner avec ou sans séquestre, selon la solution retenue.

### 5.7 Avis et réputation

| Fonctionnalité | Version |
|---|---|
| Notation mutuelle (1 à 5 étoiles + commentaire) uniquement après une mission terminée | V1 |
| Avis « à l'aveugle » : chaque partie voit l'avis de l'autre seulement après avoir laissé le sien (ou après 14 jours), ce qui évite les avis de représailles | V1 |
| Critères détaillés : qualité, ponctualité, communication, rapport qualité/prix | V1 |
| Droit de réponse public du prestataire | V1 |
| Détection des faux avis | V2 |

### 5.8 Litiges

| Fonctionnalité | Version |
|---|---|
| Ouverture d'un litige par le client ou le prestataire, avec motif et preuves | V1 |
| Gel automatique du paiement concerné | V1 |
| Médiation par un modérateur : remboursement total, partiel, ou paiement du prestataire | V1 |
| Historique complet des échanges accessible au modérateur | V1 |

### 5.9 Notifications

| Fonctionnalité | Version |
|---|---|
| Notifications dans l'application | V1 |
| E-mails (nouvelle proposition, contrat, paiement…) | V1 |
| SMS pour les événements critiques (code de connexion, paiement reçu) | V1 |
| Notifications push sur le téléphone | V1 |
| Préférences de notification par l'utilisateur | V1 |
| Notifications WhatsApp | V3 |

### 5.10 Administration (back-office)

| Fonctionnalité | Version |
|---|---|
| Tableau de bord : inscriptions, missions, propositions, volume d'affaires, revenus | V1 |
| Gestion des utilisateurs : recherche, suspension, bannissement | V1 |
| File de validation des identités | V1 |
| Validation des virements BaridiMob / CCP et des demandes de retrait | V1 |
| Modération des missions, profils, avis et signalements | V1 |
| Traitement des litiges | V1 |
| Gestion des catégories et de leurs champs spécifiques | V1 |
| Paramètres : taux de commission, prix des jetons, durées automatiques | V1 |
| Journal de toutes les actions de l'équipe (traçabilité) | V1 |
| Détection automatique des comportements suspects (fraude, contournement) | V2 |
| Gestion des campagnes promotionnelles (codes promo, jetons offerts) | V2 |

---

## 6. Modèle économique

> Les chiffres ci-dessous sont des **hypothèses de départ**. Ils seront validés dans l'étude de marché et le modèle financier.

### 6.1 Sources de revenus

| Source | Principe | Version | Hypothèse de départ |
|---|---|---|---|
| **Commission** | Pourcentage prélevé sur chaque mission payée via Talbi | V1 | 10 % côté prestataire |
| **Jetons** | Le prestataire dépense des jetons pour envoyer une proposition (comme les « Connects » d'Upwork) | V1 | 1 à 4 jetons selon le budget de la mission ; pack de 20 jetons ≈ 1 000 DA ; quelques jetons offerts chaque mois |
| **Mise en avant** | Proposition boostée, profil en tête des recherches, mission « à la une » | V2 | Prix fixe par mise en avant |
| **Abonnement Pro** | Jetons mensuels inclus, commission réduite, statistiques avancées, outils de gestion | V3 | Abonnement mensuel |
| **Offre entreprises** | Comptes multi-utilisateurs, facturation centralisée | V3 | Sur devis |

### 6.2 Pourquoi les jetons sont essentiels

1. **Revenu immédiat**, même quand la mission se paie en espèces hors plateforme.
2. **Qualité** : les prestataires ne répondent pas n'importe comment à toutes les missions, ce qui évite de noyer le client sous des propositions inutiles.
3. **Rentabilité dès le départ**, avant même que le paiement en ligne soit massivement adopté.

### 6.3 Services sur place payés en espèces

En Algérie, beaucoup de clients paieront un artisan en espèces. Talbi l'accepte, avec ces règles :

- le prestataire a payé ses **jetons** pour proposer, c'est le revenu de Talbi sur ces missions ;
- le contrat, les avis et la réputation restent sur Talbi ;
- les missions payées en ligne offrent des avantages (protection du séquestre, badge « Paiement sécurisé », meilleur classement), ce qui pousse progressivement vers le paiement en ligne.

---

## 7. Exigences de qualité (non fonctionnelles)

### 7.1 Langues et accessibilité

- Interface complète en **français** et en **arabe**, avec affichage de droite à gauche (RTL) pour l'arabe
- Changement de langue à tout moment, langue mémorisée
- Dates, nombres et montants en dinars (DA / دج) formatés selon la langue
- Contrastes et tailles de texte lisibles, navigation au clavier

### 7.2 Performance

- **Rapide sur mobile et en 3G/4G faible** : pages légères, images compressées automatiquement
- Première page affichée en moins de 2,5 secondes sur un téléphone moyen
- **Site installable sur téléphone** (PWA) : icône sur l'écran d'accueil, notifications push, sans passer par le Play Store

### 7.3 Sécurité

- Mots de passe chiffrés, connexions en HTTPS uniquement
- Protection contre les attaques courantes (référentiel OWASP Top 10)
- Limitation des tentatives de connexion, protection anti-robots
- Pièces d'identité stockées chiffrées, accessibles uniquement aux modérateurs
- Double authentification obligatoire pour l'équipe
- Sauvegardes automatiques quotidiennes de la base de données, testées régulièrement

### 7.4 Conformité légale (à valider avec un juriste)

- **Loi 18-05 relative au commerce électronique** : inscription au registre du commerce électronique (CNRC), mentions légales, conditions générales de vente, et exigences d'hébergement en Algérie
- **Loi 18-07 relative à la protection des données personnelles** : déclaration auprès de l'ANPDP, consentement, droit d'accès et de suppression des données
- Conditions générales d'utilisation, politique de confidentialité et charte de la communauté, en français et en arabe

### 7.5 Fiabilité et suivi

- Surveillance permanente de la disponibilité et alertes en cas de panne
- Suivi automatique des erreurs
- Objectif de disponibilité : 99,5 %
- Mise en ligne des nouvelles versions sans interruption de service

### 7.6 Visibilité sur Google (SEO)

- Pages de catégories et de villes optimisées (ex. : « Plombier à Oran », « سباك في وهران »)
- Profils publics des prestataires indexables

---

## 8. Architecture et choix techniques

### 8.1 Les grands principes

1. **Une seule base de code bien organisée** (monolithe modulaire) : plus simple à maintenir pour une petite équipe, et découpable plus tard si la croissance l'exige.
2. **Une API claire** : une application mobile native pourra s'y brancher en V3 sans tout refaire.
3. **Portable** : l'application tourne dans des conteneurs (Docker), elle peut donc être hébergée chez n'importe quel hébergeur, y compris un **hébergeur algérien** pour respecter la loi.
4. **Sécurisée et testée dès le départ**, pas « après ».

### 8.2 La stack technique

| Besoin | Technologie retenue | Pourquoi |
|---|---|---|
| Langage | **TypeScript** | Un seul langage pour tout le projet, erreurs détectées avant la mise en ligne |
| Application web | **Next.js** (React) | Standard du marché, rapide, très bon pour le référencement Google |
| Design | **Tailwind CSS + shadcn/ui** | Interface moderne et cohérente, compatible avec l'arabe (RTL) |
| Traduction | **next-intl** | Gestion du français et de l'arabe |
| Base de données | **PostgreSQL** | Fiable, robuste, idéale pour les transactions financières |
| Accès aux données | **Prisma** | Manipulation sûre de la base, historique des évolutions du schéma |
| Authentification | **Better Auth** | Open source, e-mail/téléphone/Google, double authentification |
| Temps réel | **WebSockets** (Socket.IO) | Messagerie et notifications instantanées |
| Tâches en arrière-plan | **Redis + BullMQ** | Envoi des e-mails et SMS, expirations automatiques, alertes |
| Fichiers | **Stockage compatible S3** | Photos, portfolios, pièces jointes, pièces d'identité (chiffrées) |
| Recherche | PostgreSQL (V1), puis **Meilisearch** (V2) | Recherche rapide, tolérante aux fautes, multilingue |
| Paiement | Passerelle algérienne agréée (ex. : Chargily Pay pour Edahabia/CIB) | Paiement en dinars |
| IA | API d'un modèle de langage (Claude) | Assistant de rédaction, estimation de prix, détection de fraude |
| Tests | **Vitest** (unitaires) + **Playwright** (parcours complets) | Chaque fonctionnalité est vérifiée automatiquement |
| Déploiement | **Docker + GitHub Actions** | Tests et mise en ligne automatiques à chaque modification |
| Suivi | Sentry (erreurs) + outil de surveillance de disponibilité | Être alerté avant les utilisateurs |

### 8.3 Schéma simplifié

```
   Téléphone / Ordinateur (site web installable, FR / AR)
                         │  HTTPS
                         ▼
              ┌─────────────────────┐
              │  Application Next.js │──── WebSockets (messagerie temps réel)
              │  (pages + API)       │
              └──────────┬──────────┘
          ┌──────────────┼──────────────┬───────────────┐
          ▼              ▼              ▼               ▼
    PostgreSQL        Redis        Stockage        Services externes
    (données)     (files d'attente  fichiers      (paiement, SMS, e-mail,
                   et cache)                         IA)
                         │
                         ▼
                 Travailleurs en arrière-plan
       (e-mails, SMS, expirations, libérations automatiques)
```

### 8.4 Principaux objets de la base de données

`Utilisateur` · `ProfilPrestataire` · `Vérification` · `Catégorie` · `Wilaya` / `Commune` · `Mission` · `Proposition` · `Contrat` · `Jalon` · `Paiement` · `Transaction` · `Portefeuille` · `Retrait` · `PackJetons` / `MouvementJetons` · `Conversation` / `Message` · `Avis` · `Litige` · `Signalement` · `Notification` · `JournalAdmin`

> Le schéma détaillé fera l'objet du prochain document (`02-modele-de-donnees.md`).

### 8.5 Règle d'or pour l'argent

Tous les mouvements d'argent et de jetons sont enregistrés dans un **grand livre** (comme en comptabilité) : chaque opération crée des lignes qui ne sont **jamais modifiées ni supprimées**. Le solde d'un portefeuille est toujours la somme de ses lignes. Ainsi, aucun dinar ne peut « disparaître », et tout est vérifiable en cas de litige ou de contrôle.

---

## 9. Feuille de route

| Période | Technique | Business |
|---|---|---|
| **Oct – Nov 2026** | Cahier des charges ✅, modèle de données, maquettes des écrans, mise en place du projet | Étude de marché, concurrence, personas |
| **Déc 2026 – Jan 2027** | Comptes et profils, catégories, missions, propositions, jetons | Business model détaillé, stratégie de lancement |
| **Fév – Mars 2027** | Messagerie temps réel, contrats, paiements et portefeuille, avis, notifications, FR/AR | Modèle financier sur 3 ans |
| **Avril 2027** | Back-office, litiges, vérification d'identité, sécurité, tests | Business plan rédigé, démarches juridiques préparées |
| **Mai 2027** | Mise en ligne (version bêta), données de démonstration, corrections | Présentations, recrutement des premiers prestataires |
| **Juin 2027** | Soutenance, bêta privée avec de vrais utilisateurs | Soutenance, premiers retours terrain |
| **Après juin 2027** | V2 : IA, recommandation, mise en avant, Meilisearch | Lancement public, label Startup, recherche de financement |

---

## 10. Risques et réponses

| Risque | Pourquoi c'est grave | Réponse prévue |
|---|---|---|
| **L'œuf et la poule** : pas de clients sans prestataires, et inversement | Une marketplace vide meurt | Lancement par catégories et villes ciblées ; recrutement manuel des premiers prestataires (jetons offerts) ; publication de missions réelles par l'équipe au démarrage |
| **Contournement** : le client et le prestataire se mettent d'accord par téléphone, hors de Talbi | Perte de la commission | Revenu par les jetons (payés avant tout contact) ; masquage des coordonnées avant contrat ; avantages réservés aux missions payées sur Talbi (protection, avis, classement) |
| **Méfiance et arnaques** | Les utilisateurs partent à la première mauvaise expérience | Vérification d'identité, avis uniquement après une vraie mission, séquestre, médiation, détection de fraude |
| **Faible usage du paiement en ligne** | Moins de commissions | Espèces acceptées pour le sur place ; BaridiMob ; jetons comme revenu principal au départ |
| **Réglementation** (e-commerce, séquestre, données personnelles) | Blocage du lancement | Consultation juridique avant le lancement public ; partenaire de paiement agréé ; architecture adaptable |
| **Copie par un concurrent** | Perte de l'avance | Vitesse d'exécution, réputation accumulée (les avis ne se copient pas), communauté |

---

## 11. Décisions restant à prendre

- [ ] Vérifier la disponibilité du nom **Talbi** : domaine `.dz`, marque INAPI, réseaux sociaux
- [ ] Taux de commission définitif et prix des jetons (après l'étude de marché)
- [ ] Choix de la passerelle de paiement et solution de séquestre (avec un juriste)
- [ ] Liste définitive des catégories phares et des villes de lancement
- [ ] Identité visuelle : logo, couleurs
- [ ] Fournisseur SMS

---

## 12. Glossaire

| Terme | Explication simple |
|---|---|
| **Reverse marketplace** | Plateforme où c'est l'acheteur qui publie son besoin et les vendeurs qui viennent à lui |
| **Mission** | Le besoin publié par un client |
| **Proposition** | L'offre (prix, délai, message) qu'un prestataire envoie pour une mission |
| **Jalon** | Une étape d'une grosse mission, payée séparément |
| **Séquestre (escrow)** | L'argent du client est bloqué par un tiers de confiance et versé au prestataire seulement quand le travail est validé |
| **Jetons** | Monnaie interne que le prestataire dépense pour envoyer des propositions |
| **MVP** | « Produit minimum viable » : la première version avec l'essentiel, pour lancer vite |
| **Back-office** | L'espace d'administration réservé à l'équipe Talbi |
| **PWA** | Site web qui s'installe sur le téléphone comme une application |
| **RTL** | *Right to left* : affichage de droite à gauche, pour l'arabe |
| **API** | La « porte d'entrée » qui permet à d'autres applications (ex. : une future app mobile) de communiquer avec Talbi |
| **Stack technique** | L'ensemble des technologies utilisées pour construire l'application |
| **SEO** | Techniques pour bien apparaître dans les résultats Google |
| **Contournement** | Quand un client et un prestataire concluent leur affaire hors de la plateforme pour éviter la commission |
