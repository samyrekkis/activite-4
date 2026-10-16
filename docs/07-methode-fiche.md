# 7. La méthode « fiche mémoire » appliquée à ton agence

Le guide *rayan-systemes-memoire* repose sur une idée simple : **une fiche que l'IA relit avant chaque réponse**.
Tu la tiens à jour, et l'IA te propose elle-même les lignes à ajouter.

L'agent vocal fonctionne déjà comme ça :

| Guide « fiche mémoire » | Agent vocal |
|---|---|
| Ta fiche personnelle | La fiche du cabinet : `clients/<id>.json` (horaires, services, prix, FAQ, consignes) |
| Claude la relit avant chaque réponse | Le serveur la recharge **à chaque appel** et la met dans le prompt |
| « N'invente rien, écris [À VÉRIFIER] » | « N'invente JAMAIS… » dans le prompt : sans information, l'assistante prend un message |
| « Propose-moi la ligne à ajouter » | Après chaque appel, les **questions sans réponse** sont relevées et affichées dans le tableau de bord, section « À ajouter à la fiche du cabinet » |
| Garde ta fiche à jour | Tu ajoutes les réponses dans la FAQ, puis tu fais `/admin/reload` |

Voici trois prompts à coller dans Claude (claude.ai) pour appliquer la méthode à ton activité.

---

## Prompt 1 : créer la fiche d'un nouveau cabinet (pendant le rendez-vous d'onboarding)

À utiliser dans une discussion Claude, en interrogeant le cabinet, ou en collant tes notes prises sur place.

```
Je configure une assistante téléphonique IA pour un cabinet en Algérie.
Pose-moi des questions une par une (20 maximum) pour remplir sa fiche.
Attends ma réponse avant de poser la question suivante.

Ce qu'il faut couvrir : nom du cabinet et du praticien, ville, adresse avec repères,
téléphone du cabinet, numéro de transfert, horaires jour par jour (samedi → jeudi, pauses,
vendredi), jours fériés et congés, liste des actes avec durée réelle et prix (ou « sur devis »),
nombre de RDV en parallèle, délai minimum avant un RDV, moyens de paiement, CNAS/CASNOS/Chifa,
parking et accès, les 10 questions que les patients posent le plus avec leurs réponses,
ce que l'assistante ne doit jamais dire, langue principale (darija ou français),
valeur moyenne d'un RDV en DA.

Règles :
- N'invente rien.
- Écris [À VÉRIFIER] à côté de tout ce dont tu n'es pas sûr.

Quand c'est fini, rédige la fiche au format JSON exact ci-dessous (mêmes clés),
prête à copier-coller dans clients/<id>.json :

[colle ici le contenu de clients/dentaire-exemple.json]
```

Relis le JSON, corrige tout ce qui est marqué [À VÉRIFIER], puis enregistre le fichier.

## Prompt 2 : mettre à jour la fiche chaque semaine

Copie la section « À ajouter à la fiche du cabinet » du tableau de bord, ainsi que les réponses du cabinet.

```
Voici la fiche actuelle d'un cabinet (JSON) :
[colle clients/<id>.json]

Voici des questions de patients auxquelles l'assistante n'a pas su répondre,
avec la réponse donnée par le cabinet :
[colle les questions + réponses]

Propose-moi uniquement les lignes exactes à ajouter ou à modifier dans la fiche
(entrées "faq", "infos" ou "consignes"), au format JSON. N'invente aucune réponse :
si une réponse manque, écris [À DEMANDER AU CABINET].
```

## Prompt 3 : ta propre fiche mémoire « agence » (instructions du projet Claude)

Crée un projet Claude « 7 Agents » et colle ceci dans ses **instructions**. Claude connaîtra alors ton
activité dans toutes tes discussions : prospection, réponses aux clients, devis, posts Facebook.

```
Voici ma fiche mémoire. Utilise-la dans toutes tes réponses, sans que j'aie besoin de la répéter.

# Qui je suis
- [Prénom], Alger. Je parle darija, français [, arabe].
- Mon agence s'appelle « 7 Agents ». Elle installe des assistantes téléphoniques IA
  pour les cabinets dentaires d'Alger (niche de départ).

# Mon offre
- Assistante vocale 24h/24 en darija / français / arabe : prise, report et annulation de RDV,
  réponses aux questions, urgences, transfert, messages ; notifications Telegram ; tableau de bord.
- Technique : Vapi + mon serveur (FastAPI), une fiche JSON par cabinet.
- Packs : Essentiel 25 000 DA/mois (hors horaires, 300 min), Pro 49 000 DA/mois (tous les appels,
  800 min), Cabinet+ sur devis. Mise en service à partir de 40 000 DA. Essai gratuit 14 jours.
- Niches : 1) dentistes 2) médecins spécialistes 3) imagerie/labos 4) beauté 5) avocats 6) garages 7) immobilier.

# Mes clients actuels
- [aucun pour l'instant / liste : cabinet, ville, pack, date de début]

# Mes objectifs
- [ex. 3 cabinets signés dans les 60 jours à Alger]

# Comment me répondre
- En français simple ; textes destinés aux clients en darija ou en français selon ce que je demande.
- Concret, court, prêt à copier-coller. Prix en DA.
- N'invente pas de chiffres sur le marché algérien : écris [À VÉRIFIER].

Quand je t'apprends une info importante (nouveau client, prix modifié, objection fréquente,
nouvelle niche), propose-moi la ligne exacte à ajouter ou à modifier dans cette fiche.
```

> Comme le dit le guide : **ne mets rien de sensible** dans ces fiches, ni clés API (`VAPI_API_KEY`, jeton Telegram),
> ni mots de passe, ni données de patients. Ces informations restent dans le fichier `.env` du serveur.
