# Analyse de projets open source de référence

> **Date** : octobre 2026
> **Projets étudiés** : `vcashwin/upwork-clone`, `TrickyVikram/freelancehub-laravel`, `anaghakarade/freelance-marketplace`
> **Objectif** : étudier des clones d'Upwork existants pour **s'en inspirer** et **identifier les erreurs à ne pas reproduire** dans Talbi. Aucun code n'est repris.

---

## 1. `vcashwin/upwork-clone`

| | |
|---|---|
| Lien | https://github.com/vcashwin/upwork-clone |
| Technologies | React (Create React App), Tailwind CSS |
| Dernière mise à jour | janvier 2023 |
| Licence | **aucune** (le code ne peut donc pas être réutilisé légalement, seulement observé) |

### Ce que c'est

Une **copie visuelle de la page d'accueil d'Upwork**, sans aucune fonctionnalité : pas de comptes, pas de base de données, pas de missions réelles. C'est un exercice d'intégration web.

### Ce qu'on retient

- L'**organisation de la page d'accueil** : barre de recherche, catégories populaires, cartes de missions, appel à l'action pour s'inscrire.
- La **carte de mission** : titre, budget, niveau, compétences sous forme d'étiquettes, date de publication.
- Une palette sobre (vert foncé + blanc) qui inspire confiance.

### Ce qu'on ne reprend pas

- Create React App est **abandonné** par ses créateurs. Talbi utilise Next.js, qui gère aussi le référencement Google (indispensable pour les pages « Plombier à Oran »).
- Aucune adaptation à l'arabe ni à l'affichage de droite à gauche.

**Verdict** : utile uniquement comme **inspiration visuelle**.

---

## 2. `TrickyVikram/freelancehub-laravel`

| | |
|---|---|
| Lien | https://github.com/TrickyVikram/freelancehub-laravel |
| Technologies | PHP 8.3, Laravel 11, Blade, MySQL |
| Dernière mise à jour | octobre 2025 |
| Licence | MIT |

### Ce que c'est

Un **projet d'apprentissage** (Hacktoberfest) qui annonce les fonctionnalités d'Upwork. En réalité, seuls l'inscription, la publication d'offres et l'envoi de propositions existent. **Les contrats, les paiements, la messagerie et les avis ne sont pas codés**, malgré ce qu'annonce la présentation.

### Ce qu'on retient (bonnes idées)

- La séparation des rôles : freelancer, client, entreprise, administrateur.
- Le parcours de recrutement : présélection → entretien → embauche.
- La connexion via Google.
- La présence de tests automatiques, même s'ils sont peu nombreux.

### Failles relevées

| # | Faille | Gravité | Conséquence concrète | Ce que fait Talbi |
|---|---|---|---|---|
| 1 | **N'importe qui peut modifier ou supprimer n'importe quelle offre**, même sans être connecté. Les règles d'autorisation existent dans le code mais ne sont jamais appliquées. | 🔴 Critique | Un concurrent peut effacer toutes les missions du site en quelques minutes | Chaque action vérifie côté serveur que l'utilisateur est connecté **et** qu'il est le propriétaire. Tests automatiques sur chaque règle. |
| 2 | **Page « connexion rapide » accessible en production** : un simple lien connecte n'importe qui à un compte de test, sans mot de passe. | 🔴 Critique | Porte d'entrée ouverte sur la plateforme | Aucun raccourci de test dans la version en ligne. Les comptes de démonstration n'existent que dans l'environnement de développement. |
| 3 | **Propositions anonymes attribuées à l'utilisateur n°1** : si personne n'est connecté, la proposition est enregistrée au nom du premier compte (souvent l'administrateur). | 🔴 Critique | Usurpation d'identité, spam au nom de l'admin | Envoyer une proposition exige d'être connecté, prestataire, et de payer ses jetons. |
| 4 | **Envoi de fichiers sans contrôle du type**, stockés dans un dossier public. | 🟠 Élevée | Hébergement de virus ou de pages piégées sous le nom de domaine du site | Types de fichiers autorisés limités (images, PDF), vérification du contenu réel du fichier, stockage privé avec liens temporaires. |
| 5 | **Fusion automatique des comptes par e-mail** lors d'une connexion Google/GitHub. | 🟠 Élevée | Risque de prise de contrôle d'un compte existant | Liaison d'un compte externe seulement si l'e-mail est vérifié par le fournisseur, ou après confirmation par l'utilisateur. |
| 6 | **Aucune limite de tentatives de connexion.** | 🟠 Élevée | Un robot peut essayer des milliers de mots de passe | Limitation des tentatives, blocage temporaire, protection anti-robots. |
| 7 | **Rien n'empêche d'envoyer plusieurs propositions sur la même mission**, de proposer sur sa propre mission ou sur une mission fermée. | 🟡 Moyenne | Spam, triche sur le classement | Une seule proposition par prestataire et par mission (contrainte en base de données), statut de la mission vérifié. |
| 8 | **Toutes les offres de tout le monde s'affichent dans « Mes offres ».** | 🟡 Moyenne | Fuite d'informations | Filtrage systématique par propriétaire. |
| 9 | **Paiements inexistants** (prévus « plus tard » avec Stripe, non disponible en Algérie) ; monnaie par défaut : dollar. | — | Le cœur économique d'une marketplace est absent | Paiements en dinars dès la V1, séquestre, grand livre comptable inaltérable. |

**Verdict** : utile pour la **liste des fonctionnalités** et le **parcours de recrutement**, mais **à ne surtout pas utiliser comme base de code** : il n'est pas sécurisé et l'essentiel (paiement, contrats, messagerie, avis) n'existe pas.

---

## 3. `anaghakarade/freelance-marketplace` (WorkStream)

| | |
|---|---|
| Lien | https://github.com/anaghakarade/freelance-marketplace |
| Technologies | React 18 + Vite (interface), Go + Gin (serveur), PostgreSQL |
| Dernière mise à jour | octobre 2026 |
| Licence | MIT annoncée dans la présentation, mais **aucun fichier de licence** dans le dépôt |

### Ce que c'est

Le **plus abouti des trois**. Il couvre tout le cycle d'Upwork : projets, propositions, contrats, jalons, livraisons, paiement sous séquestre (simulé), portefeuille, grand livre, messagerie, avis, modération, recherche et recommandation. Il compte une vingtaine de fichiers de tests automatiques.

### Ce qu'on retient (bonnes idées)

- **Montants stockés en nombres entiers de centimes** dans les tables de paiement : pas d'erreurs d'arrondi.
- **Cycle de vie précis d'un jalon** : en attente → en cours → livré → approuvé, ou → corrections demandées → en cours…
- **Historique des livraisons** : chaque rendu du prestataire est conservé avec la réponse du client.
- **Verrouillage pendant les opérations d'argent** : la base bloque le paiement pendant qu'on le libère, pour éviter un double versement.
- **Protections de base** : limitation du nombre de requêtes, en-têtes de sécurité, taille maximale des envois, journal d'audit des actions admin.
- **Niveaux de confiance** des prestataires selon leur historique.

### Failles relevées

| # | Faille | Gravité | Conséquence concrète | Ce que fait Talbi |
|---|---|---|---|---|
| 1 | **Le client peut se faire rembourser seul, à tout moment**, même après que le prestataire a livré le travail. | 🔴 Critique | Le client récupère le travail **et** son argent. Aucun prestataire sérieux ne restera. | Après la livraison, le remboursement n'est possible que par accord des deux parties ou par décision d'un modérateur (litige). |
| 2 | **Le montant d'un jalon reste modifiable après son paiement**, et **par les deux parties**, y compris le prestataire. | 🔴 Critique | Le montant affiché ne correspond plus à l'argent bloqué ; un prestataire peut gonfler un jalon avant que le client paie. | Un jalon payé est figé. Toute modification de montant est une proposition que l'autre partie doit accepter. |
| 3 | **Le portefeuille peut ne pas être crédité alors que le paiement est marqué « versé »** : la mise à jour du solde peut échouer sans que l'opération soit annulée. | 🟠 Élevée | De l'argent « disparaît » entre le séquestre et le portefeuille | Le solde n'est pas stocké séparément : il est **calculé à partir du grand livre**, donc il ne peut pas diverger. |
| 4 | **Grand livre à une seule entrée**, sans sens (débit/crédit), modifiable, et soldes stockés à part. | 🟠 Élevée | Impossible de prouver que les comptes sont justes | **Comptabilité en partie double** : chaque opération s'équilibre à zéro ; lignes **non modifiables** (bloquées par la base de données). |
| 5 | **Le prestataire peut commencer un jalon qui n'a pas été payé.** | 🟠 Élevée | Le prestataire travaille sans garantie de paiement | En paiement en ligne, un jalon ne démarre qu'une fois l'argent bloqué. |
| 6 | **Montants en nombres à virgule** (`float`) dans les contrats et les jalons, alors que les paiements utilisent des entiers. | 🟡 Moyenne | Écarts d'arrondi entre ce qui est affiché et ce qui est payé | Entiers en centimes **partout**. |
| 7 | **Identifiants de paiement générés avec un compteur en mémoire** du serveur. | 🟡 Moyenne | Doublons dès qu'on lance deux serveurs en parallèle | Identifiants uniques universels (UUID) générés par la base. |
| 8 | **Supprimer un utilisateur supprime ses contrats** en cascade. | 🟡 Moyenne | Perte de l'historique comptable et des preuves en cas de litige | Les comptes sont anonymisés, jamais supprimés physiquement quand ils ont un historique financier. |
| 9 | Monnaie fixée en roupie indienne (INR) / dollar ; prestataires de paiement indiens (Razorpay). | — | Inadapté à l'Algérie | Dinar et passerelles algériennes. |

**Verdict** : une **bonne référence d'architecture** (découpage du code, cycle des jalons, verrouillage), mais **les règles d'argent sont fausses** sur des points essentiels. On s'inspire de sa structure, pas de sa logique de paiement.

---

## 4. Leçons appliquées à Talbi

1. **Autorisation systématique côté serveur** : chaque action vérifie qui fait quoi, et un test automatique prouve que l'accès est refusé aux autres.
2. **Aucun raccourci de test en production** : la configuration en ligne est séparée et vérifiée avant chaque mise en ligne.
3. **Les règles métier sont aussi dans la base de données** (ex. : une seule proposition par mission), pas seulement dans l'interface.
4. **Les fichiers envoyés sont considérés comme dangereux** jusqu'à preuve du contraire.
5. **L'argent d'abord** : paiements, séquestre et grand livre font partie du cœur de la V1, pas d'un « plus tard ».
6. **Tester les cas d'attaque**, pas seulement les cas normaux.
7. **Comptabilité en partie double** : le solde se calcule à partir du grand livre, il n'est jamais stocké à part.
8. **Ce qui est payé est figé** : aucun montant ne change sans l'accord des deux parties.
9. **Personne ne décide seul de l'argent de l'autre** : après livraison, seul un accord mutuel ou un modérateur peut rembourser.
