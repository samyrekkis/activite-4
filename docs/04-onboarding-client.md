# 4. Onboarding d'un nouveau cabinet (checklist)

Durée cible : **2 à 3 jours** entre la signature et la mise en service.

## Jour 1 : collecte (rendez-vous de 45 min avec le cabinet)

- [ ] Nom exact du cabinet, nom du praticien, adresse **avec repères** (« à côté de la pharmacie… »).
- [ ] Ligne actuelle du cabinet et numéro de **transfert** (secrétaire ou mobile du praticien).
- [ ] Horaires réels, jour par jour. Pauses, jours fermés, congés prévus, horaires Ramadan.
- [ ] Liste des actes et services : **durée réelle** de chacun, prix ou « sur devis ».
- [ ] Nombre de rendez-vous en parallèle (`capacite` : fauteuils ou praticiens).
- [ ] Délai minimum avant un RDV (ex. pas de RDV dans l'heure) et horizon (ex. 30 jours).
- [ ] Informations pratiques : paiement (espèces, CIB/Edahabia), CNAS, parking, accès, documents à apporter.
- [ ] Les 10 questions les plus posées au téléphone, avec **leurs réponses** → `faq`.
- [ ] Ce que l'assistante **ne doit jamais dire** → `consignes`.
- [ ] Langue principale (darija ou français) et prénom de l'assistante.
- [ ] Valeur moyenne d'un RDV en DA (`valeur_moyenne_rdv_da`), pour le rapport mensuel de rentabilité.
- [ ] Qui reçoit les notifications Telegram ?
- [ ] Accord écrit sur l'enregistrement des appels et sur le contrat (voir `02-algerie.md`).
- [ ] **Agenda existant** : s'il est sur papier, l'assistante devient l'agenda de référence ; il est consultable dans
      le tableau de bord. S'il existe un logiciel, prévoir une synchronisation par `webhook_url` → n8n.

## Jour 2 : configuration

```bash
python -m scripts.nouveau_client --id <id> --niche <niche> --nom "<Nom>" --ville "<Ville>"
# compléter clients/<id>.json avec les informations collectées
python -m scripts.vapi_provision clients/<id>.json --afficher   # relire le prompt généré
```

- [ ] Choisir et configurer le numéro (option A, B ou C de `02-algerie.md`), puis renseigner `vapi_phone_number_id`.
- [ ] `python -m scripts.vapi_provision clients/<id>.json --numero`
- [ ] `/admin/reload`
- [ ] Saisir dans le tableau de bord (formulaire « Ajouter un RDV / bloquer un créneau ») les RDV déjà pris dans
      l'agenda papier, ainsi que les absences du praticien. L'assistante ne les proposera plus.
- [ ] Dérouler **toute la recette** de `06-tests-qualite.md`.

## Jour 3 : mise en service

- [ ] Appel de démonstration avec le praticien : il appelle lui-même et essaie de « piéger » l'assistante.
- [ ] Activer le renvoi d'appel : d'abord **hors horaires et en cas de non-réponse**, puis sur tous les appels quand
      le cabinet est en confiance.
- [ ] Donner au cabinet le lien du tableau de bord : `https://<serveur>/dashboard/<id>?key=<dashboard_key>`. Montrer
      comment l'ajouter à l'écran d'accueil du téléphone.
- [ ] Les 7 premiers jours, réécouter chaque jour 5 appels dans Vapi et ajuster la FAQ et les consignes.
- [ ] Fin du 1er mois : envoyer le **rapport mensuel** (appels, RDV pris par l'IA, valeur estimée) depuis
      `/api/<id>/stats?key=…`. C'est ce qui justifie le renouvellement.
