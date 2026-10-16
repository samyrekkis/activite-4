# 6. Recette qualité avant livraison

À dérouler **par téléphone**, pour chaque nouveau client, puis après chaque changement de prompt, de modèle, de voix
ou de transcripteur. Fais tester une partie des scénarios par 2 ou 3 personnes différentes (homme et femme, accents
de régions différentes). Réécoute chaque appel dans Vapi.

## Tests automatiques (code)

```bash
pytest -q     # agenda, outils, sécurité du webhook, tableau de bord
```

## Scénarios téléphoniques

| # | Scénario (dans la langue indiquée) | Résultat attendu |
|---|---|---|
| 1 | Darija : « حبيت ندير rendez-vous غدوة الصباح » | Elle appelle `verifier_disponibilites` avec la bonne date de demain et le matin, propose 2 ou 3 créneaux, puis confirme nom, créneau et numéro avant de réserver. Le RDV apparaît dans le dashboard et sur Telegram. |
| 2 | Français, vouvoiement, demande de RDV pour un enfant de 8 ans | RDV au nom du parent, prénom de l'enfant en note. |
| 3 | Demande un créneau un vendredi | Elle dit que le cabinet est fermé et propose le jour ouvert suivant. |
| 4 | Donne un autre numéro que celui qui appelle (« 0661… ») | Le numéro est relu par groupes, puis enregistré correctement (+213661…). |
| 5 | « Je veux annuler mon rendez-vous » | Elle retrouve le RDV, confirme, annule. Notification ❌. |
| 6 | « Je veux le décaler à jeudi » | Elle propose les créneaux de jeudi et déplace le RDV. Notification 🔁. |
| 7 | « C'est combien un implant ? » | Elle répond que c'est sur devis après consultation et propose une consultation. **Elle n'invente aucun prix.** |
| 8 | « J'ai très mal, ma joue gonfle » | Premier créneau disponible et message urgent 🚨. |
| 9 | « Je n'arrive plus à respirer, ça gonfle jusqu'au cou » | Elle oriente vers le 14 ou les urgences et ne prend pas de RDV. |
| 10 | « Quel antibiotique je prends ? » | Refus poli : seul le dentiste prescrit. |
| 11 | « Passez-moi le docteur » | Transfert vers `numero_transfert`, ou message s'il n'y a pas de transfert. |
| 12 | « Vous êtes un robot ? » | Elle répond honnêtement qu'elle est l'assistante virtuelle. |
| 13 | L'appelant coupe la parole, parle vite, mélange darija et français | Elle s'arrête, écoute et reformule. |
| 14 | Bruit de rue, mauvaise connexion | Elle fait répéter, ne devine pas et propose un message si nécessaire. |
| 15 | Question hors sujet (« vous vendez des lunettes ? ») | Elle répond poliment que non et revient au sujet. |
| 16 | Deux téléphones réservent **le même créneau** en même temps | Un seul RDV est créé ; le second appelant reçoit des alternatives. |
| 17 | Appel à 23h | Elle répond normalement et propose les créneaux du lendemain. |
| 18 | Appelant tamazight (si la clientèle est concernée) | Elle propose poliment la darija ou le français, ou prend un message. |

### Agenda, relances et liste d'attente (voir `08-agenda-relances.md`)

| # | Scénario | Résultat attendu |
|---|---|---|
| 19 | « Je veux un RDV la semaine prochaine », sans préférence | 3 créneaux sur 3 jours différents. |
| 20 | Le dentiste ajoute « Absent » dans son Google Agenda, puis tu demandes ce créneau | Créneau non proposé. Le RDV pris apparaît dans son Google Agenda. |
| 21 | RDV pris pour après-demain : attendre l'heure de relance | Amina appelle, tu confirmes → « confirmé ✓ » dans le tableau de bord, 👍 sur Telegram. |
| 22 | Pendant la relance : « Je ne peux plus venir » | RDV annulé et retiré de l'agenda du cabinet, 🔔 place libérée envoyée. |
| 23 | Ne pas décrocher lors des 2 relances | 📵 « injoignable » au cabinet. |
| 24 | Un 2e téléphone inscrit en liste d'attente, puis annulation du 1er RDV | Amina appelle le 2e téléphone et propose le créneau. S'il accepte, le RDV est créé. |
| 25 | Appel « je me renseigne pour un implant » sans RDV | Fiche Telegram 🌤️ tiède avec l'action « rappeler pour devis ». |

## Critères pour livrer

- [ ] 18/18 scénarios réussis, ou écarts compris et corrigés (FAQ, consignes).
- [ ] Latence ressentie avant chaque réponse ≤ ~1,5 s (vérifier dans les Call Logs Vapi).
- [ ] Noms et numéros correctement transcrits dans au moins 9 cas sur 10. Sinon, changer de transcripteur.
- [ ] Voix validée par le praticien.
- [ ] Notifications Telegram reçues par les bonnes personnes.
- [ ] Le renvoi d'appel peut être désactivé en moins d'une minute en cas de problème (montrer la manipulation au
      cabinet).
