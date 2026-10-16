# 5. Offre commerciale

## Le problème que tu résous (à dire au client avec ses mots)

> « Docteur, combien d'appels ratez-vous pendant que vous êtes sur un patient, à midi, le soir, le vendredi ?
> Chaque appel raté, c'est un patient qui appelle le cabinet d'à côté. »

- Un cabinet rate souvent **20 à 40 % des appels** (ligne occupée, soins en cours, fermeture). **Mesure-le chez ton
  prospect** : demande-lui de compter ses appels manqués sur son portable pendant une semaine.
- La secrétaire passe une grande partie de sa journée au téléphone au lieu d'accueillir les patients.
- Les patients veulent pouvoir appeler le soir, après le travail.

**La promesse : « Plus aucun appel raté. Vos rendez-vous pris 24h/24, en darija, sans embaucher. »**

## Ton coût de revient (à mesurer pendant le pilote)

| Poste | Ordre de grandeur |
|---|---|
| Vapi (plateforme) | ~0,05 $/min |
| STT + TTS | ~0,01 à 0,05 $/min selon le fournisseur (ElevenLabs plus cher qu'Azure) |
| LLM | variable selon le modèle et la longueur du prompt, à lire dans les Call Logs Vapi |
| **Total à prévoir** | **~0,15 à 0,30 $/min**, soit **~40 à 80 DA/min** selon le taux de change |
| Serveur + domaine | ~10 à 15 €/mois, **partagés entre tous tes clients** |
| Numéro / SIM / passerelle | selon l'option (voir `02-algerie.md`) |

Le tableau de bord affiche les minutes et le coût réel de chaque client (`/api/<id>/stats`). **Vérifie ta marge
chaque mois.**

Volume type d'un cabinet dentaire : 15 à 30 appels par jour, d'environ 1,5 à 2 minutes chacun. Si l'agent prend
**tous** les appels, compte 600 à 1 500 min/mois. S'il ne prend que **les appels hors horaires et non répondus**,
compte 200 à 500 min/mois. D'où les deux packs ci-dessous.

## Packs (prix indicatifs, à ajuster après tes 3 premiers clients)

| | **Essentiel** | **Pro** | **Cabinet+** |
|---|---|---|---|
| Pour qui | Cabinet avec secrétaire | Cabinet sans secrétaire, ou très sollicité | Clinique, polyclinique, multi-praticiens |
| Appels pris | Hors horaires + non répondus | Tous les appels | Tous les appels, plusieurs agendas |
| Minutes incluses | 350 min/mois | 900 min/mois | sur devis |
| Darija / français / arabe | ✅ | ✅ | ✅ |
| Prise, report et annulation de RDV | ✅ | ✅ | ✅ |
| Notifications Telegram + tableau de bord | ✅ | ✅ | ✅ |
| Voix premium (ElevenLabs) | — | ✅ | ✅ |
| Rapport mensuel + ajustements | ✅ | ✅ + appel mensuel | ✅ + appel mensuel |
| **Abonnement** | **45 000 DA/mois** | **80 000 DA/mois** (offre principale) | **à partir de 140 000 DA/mois** |
| Mise en service | 40 000 DA | 50 000 DA, offerte avec un engagement de 12 mois | sur devis |
| Minute supplémentaire | 100 DA | 90 DA | — |

**Ta marge sur le Pro** : 900 minutes coûtent environ 35 000 à 65 000 DA selon le modèle d'IA, la voix et le taux
de change. Il te reste donc environ 15 000 à 45 000 DA par cabinet et par mois. Pour rester dans le haut de la
fourchette, mesure le coût réel par minute pendant le pilote (tableau de bord Vapi). Si besoin, passe le cabinet sur
un modèle plus rapide et moins cher, ou sur une voix Azure, après avoir vérifié la qualité en darija.

- **Engagement** de 6 mois, ou **-15 %** pour un paiement annuel d'avance (ce qui sécurise aussi ta trésorerie en devises).
- **Matériel** (passerelle GSM, SIM) : refacturé au prix coûtant ou inclus dans la mise en service.
- **Clause de révision** : prix indexé une fois par an (taux de change et coûts des fournisseurs).
- Argument principal, la rentabilité : à 3 000 DA le RDV, **27 RDV pris par l'assistante dans le mois remboursent
  le Pro**. Pour un cabinet qui reçoit 20 appels par jour, c'est un peu plus d'un RDV par jour ouvré. En plus, une
  seule prothèse ou un seul implant récupéré rapporte souvent plus que l'abonnement. Le rapport mensuel le prouve
  chiffres à l'appui (`valeur_moyenne_rdv_da`).
- Ne vends pas l'IA comme « moins chère qu'une secrétaire » : à ce prix, ce n'est pas l'argument. Vends ce qu'une
  secrétaire ne fait pas : **répondre la nuit, le vendredi, pendant les soins, et à deux appels en même temps**.
  L'IA ne la remplace pas, elle **la soulage**.
- Le prospect hésite à 80 000 DA ? Propose l'**Essentiel à 45 000 DA** (hors horaires seulement). Il passera au Pro
  quand il verra les chiffres du tableau de bord.

## Comment vendre (ce qui marche en Algérie)

1. **Commence par une niche et une ville.** Dentistes d'Alger, d'Oran ou de Constantine, par exemple. Tu deviens
   « le gars des dentistes », et le bouche-à-oreille entre confrères fait le reste.
2. **Prépare une démo locale.** Configure un faux cabinet de la ville du prospect (`clients/dentaire-exemple.json`)
   et un numéro de démo.
3. **Va sur place** en milieu d'après-midi, avec un rendez-vous ou en passant. Le contact direct marche beaucoup
   mieux qu'un message.
4. **Fais appeler le docteur lui-même, devant toi** : « Appelez ce numéro et essayez de prendre rendez-vous en darija. »
   C'est ce moment qui vend.
5. **Propose un pilote gratuit de 14 jours**, sur les appels hors horaires uniquement, avec l'option A (renvoi).
   Aucun risque pour lui.
6. **Fin du pilote** : montre le tableau de bord (« 37 appels pris, 14 RDV, 2 urgences, 42 000 DA de RDV ») et fais
   signer.
7. **Demande 2 recommandations** à chaque client satisfait (offre : 1 mois offert par recommandation signée).

### Message WhatsApp / Facebook (premier contact)

> Salam Docteur, je suis [Prénom], de 7 Agents. On a mis en place une assistante téléphonique intelligente qui parle
> darija et français : elle répond aux patients 24h/24, prend les rendez-vous et vous les envoie sur Telegram.
> Vous pouvez l'essayer tout de suite en appelant le [numéro de démo]. Si ça vous intéresse, je vous propose 14 jours
> d'essai gratuit, sans engagement. Je passe vous la montrer cette semaine ?

### Objections fréquentes

| Objection | Réponse |
|---|---|
| « Mes patients ne vont pas parler à un robot. » | « Appelez vous-même, maintenant. » Puis : « Elle prend surtout les appels que vous ratez déjà. Mieux vaut l'assistante qu'aucune réponse. » |
| « Elle ne comprendra pas la darija. » | Démo en darija avec des noms et des numéros. Si un appelant n'est pas compris, elle prend un message ou transfère : aucun patient perdu. |
| « C'est cher. » | « 27 RDV par mois, soit un par jour ouvré, et c'est remboursé. Le pilote gratuit de 14 jours vous montre le chiffre réel. » Sinon : l'Essentiel à 45 000 DA. |
| « Et si elle se trompe de rendez-vous ? » | Elle relit tout avant de confirmer et ne propose que des créneaux libres. Vous recevez chaque RDV sur Telegram et pouvez l'annuler en un clic. |
| « Et la confidentialité ? » | Enregistrement annoncé, aucun diagnostic stocké, contrat de sous-traitance conforme à la loi 18-07, données supprimées sur demande. |
| « J'ai déjà une secrétaire. » | Pack Essentiel : l'assistante ne prend que les appels hors horaires et quand la secrétaire est occupée. |

## Plan d'attaque : cabinets dentaires d'Alger (7 Agents)

**Cible** : cabinets privés d'un ou deux praticiens, sans secrétaire le soir. Ce sont eux qui ratent le plus
d'appels et qui décident vite, sans direction ni comptable.

**Zones à prospecter**, par ordre de priorité (forte densité de cabinets et clientèle qui appelle beaucoup) :
1. Hydra, Ben Aknoun, El Biar, Dely Ibrahim, Bir Mourad Raïs
2. Kouba, Hussein Dey, Bab Ezzouar, Dar El Beïda
3. Chéraga, Ouled Fayet, Draria, Saïd Hamdine
4. Alger-Centre, Sidi M'Hamed, Bab El Oued

**Listing** : Google Maps (« dentiste » + quartier), pages Facebook et Instagram des cabinets. Note dans un
tableur le nom, le quartier, le téléphone, si quelqu'un a décroché à 13h et à 18h, et si le cabinet a une
secrétaire. **Un cabinet qui ne décroche pas à ces heures-là est ton meilleur prospect.** Dis-le-lui : « J'ai
appelé hier à 18h, personne n'a répondu. »

**Rythme** : 10 cabinets visités par semaine, 3 démos, 1 pilote. Objectif : 3 cabinets payants en 60 jours.
Ensuite, fais-toi recommander dans les groupes de dentistes (associations, formations, fournisseurs de matériel
dentaire, qui connaissent tous les cabinets).

**Démo** : la fiche `clients/dentaire-exemple.json` est déjà un cabinet d'Hydra. Avant chaque visite, change le
quartier et l'adresse pour ceux du prospect : il entendra « son » assistante.

## Niches, par ordre de priorité

1. **Dentistes** : beaucoup d'appels, RDV de valeur, souvent sans secrétaire le soir.
2. **Médecins spécialistes** (gynéco, pédiatre, dermato, ophtalmo) : longues listes d'attente, appels très fréquents.
3. **Centres d'imagerie et laboratoires** : beaucoup de questions répétitives (horaires, préparation, tarifs).
4. **Salons de beauté et instituts** (surtout pour les forfaits mariée) : RDV le soir, clientèle qui appelle tard.
5. **Avocats et notaires** : qualification des demandes et prise de RDV de première consultation.
6. **Garages et concessionnaires** : RDV d'entretien et de diagnostic.
7. **Agences immobilières** : qualification des acheteurs et locataires, puis RDV de visite.

Pour chaque nouvelle niche : copier un fichier de `niches/`, adapter les services, urgences et consignes, et tester
avec la recette.

## Contrat : points à inclure (à faire valider par un juriste)

- Objet, durée, prix, révision, modalités de paiement, minutes incluses et dépassement.
- Obligation de moyens : l'IA peut se tromper. Le cabinet vérifie ses RDV dans le tableau de bord et sur Telegram.
- Le cabinet reste responsable des informations fournies (horaires, prix, consignes).
- Sous-traitance des données (loi 18-07), durée de conservation des enregistrements, sous-traitants étrangers.
- Disponibilité visée et procédure en cas de panne : le renvoi d'appel est désactivé et la ligne sonne au cabinet
  comme avant.
- Résiliation, export des données (CSV), suppression des données en fin de contrat.
