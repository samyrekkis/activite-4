# 2. Spécificités Algérie

## 2.1 Le numéro de téléphone : la vraie difficulté

Vapi, Twilio et Telnyx **ne vendent pas de numéros algériens (+213)**. Il y a trois façons de faire, de la plus
simple à la plus professionnelle.

### Option A : renvoi d'appel vers un numéro étranger (pilote rapide)

- Achète un numéro Vapi (US, gratuit en test) ou un numéro français via Twilio/Telnyx, importé dans Vapi.
- Le cabinet programme un **renvoi d'appel** de sa ligne vers ce numéro : en cas de non-réponse ou d'occupation, ou
  pour tous les appels hors horaires.
- ✅ En service en 1 heure, idéal pour une **démo** ou un **pilote gratuit de 14 jours**.
- ❌ Chaque appel renvoyé est facturé au cabinet **au tarif international** par son opérateur. Vérifie le tarif avec
  lui avant de vendre.

### Option B : passerelle GSM + SIM algérienne (recommandée en production)

```
Patient ─▶ ligne du cabinet ─(renvoi local)─▶ SIM Djezzy/Mobilis/Ooredoo
          dans une passerelle GSM-SIP (au cabinet ou chez toi)
          ─(Internet, SIP)─▶ Asterisk sur ton VPS ─(SIP trunk)─▶ Vapi
```

- Matériel : passerelle GSM vers SIP à 1, 2 ou 4 SIM (Yeastar TG, Dinstar, GoIP…), compter quelques dizaines de
  milliers de DA, plus une SIM avec un forfait.
- Le renvoi depuis la ligne du cabinet vers la SIM est un **appel local**, souvent inclus dans le forfait. Le
  cabinet peut aussi communiquer directement le numéro mobile comme « numéro de rendez-vous ».
- La passerelle s'enregistre sur un **Asterisk** (ou FreeSWITCH) hébergé sur ton VPS. L'adresse IP fixe est alors
  côté VPS, pas côté cabinet. Asterisk relaie l'appel vers Vapi, qui accepte les trunks SIP fournis par le client
  (« BYO SIP trunk ») : crée le trunk et le numéro dans Vapi, puis renseigne `vapi_phone_number_id` dans le fichier
  client.
- Avantage : un seul VPS Asterisk sert tous tes clients. Ajouter un cabinet revient à ajouter une passerelle (ou
  une SIM) et une route.
- ⚠️ **Avant de déployer chez des clients**, vérifie auprès de l'opérateur et de la réglementation (ARPCE) les
  conditions d'utilisation d'une SIM dans une passerelle. Certains opérateurs l'interdisent dans leurs conditions
  générales. Reste sur un usage **entrant**, pour le propre numéro du cabinet.

### Option C : sans téléphone, via le site web ou Facebook

- Vapi propose un **widget web** : un bouton « Parler à l'assistante » sur le site ou la page du cabinet, sans aucun
  coût télécom. Crée un assistant avec `python -m scripts.vapi_provision clients/x.json --assistant`, puis intègre
  le widget avec la clé publique Vapi.
- C'est un bon complément, et un argument de démo très fort en rendez-vous de vente.

## 2.2 Payer les services (Vapi, LLM, ElevenLabs, VPS)

Ces services se paient en **dollars ou en euros par carte internationale**. Les cartes CIB et Edahabia ne passent
pas. Solutions courantes :

- une **carte Visa/Mastercard internationale** adossée à un compte en devises dans une banque algérienne ;
- un associé ou un proche à l'étranger, avec une facturation claire entre vous.

Ta marge doit couvrir le **risque de change**. Le dinar sur le marché parallèle varie : fixe tes prix en DA avec une
marge de sécurité, et révise-les chaque année (une clause est prévue dans l'offre, voir `05-offre-commerciale.md`).

## 2.3 Données personnelles : loi 18-07

La **loi n° 18-07 du 10 juin 2018** encadre les données personnelles en Algérie. Son autorité de contrôle est
l'**ANPDP**. Les données de santé sont des **données sensibles**. Concrètement :

- Le message d'accueil annonce l'enregistrement (« l'appel peut être enregistré »). C'est déjà le cas par défaut.
  Si le cabinet refuse l'enregistrement, mets `"enregistrement": false`.
- L'assistante ne collecte que le minimum : nom, téléphone, motif court. **Aucun diagnostic** ne doit être stocké.
- Le contrat avec le cabinet précise que **tu es sous-traitant** : le cabinet reste responsable du traitement, et
  c'est à lui (ou à toi pour son compte) de faire les déclarations auprès de l'ANPDP. Fais valider la rédaction par
  un juriste.
- Les fournisseurs (Vapi, LLM, TTS) traitent la voix à l'étranger. Mentionne-le dans le contrat. Configure la
  rétention minimale dans Vapi et purge les enregistrements après N jours.

*Ceci n'est pas un avis juridique.* Fais relire ton contrat type par un avocat algérien. C'est d'ailleurs un bon
premier client pour la niche « avocat ».

## 2.4 Langues et habitudes

- La **darija** est la langue par défaut, avec les mots français que tout le monde utilise. L'agent passe en
  français ou en arabe selon l'appelant. Pour une clientèle surtout francophone (certains quartiers d'Alger, certaines
  spécialités), mets `"langue_principale": "francais"`.
- **Tamazight** : non géré de façon fiable par les moteurs actuels. L'agent propose poliment de continuer en darija
  ou en français, ou de prendre un message. En Kabylie, teste avant de vendre et annonce cette limite au client.
- **Semaine** : le vendredi est généralement fermé, souvent le samedi après-midi aussi. Les modèles de niche
  utilisent samedi → jeudi. Adapte selon le client.
- **Fêtes** : ajoute chaque année les jours fériés dans `fermetures`. Les fêtes fixes sont le 1er janvier, Yennayer
  (12 janvier), le 1er mai, le 5 juillet et le 1er novembre. Les fêtes religieuses (Aïd el-Fitr, Aïd el-Adha, 1er
  Moharram, Achoura, Mawlid) changent de date chaque année.
- **Ramadan** : les horaires changent. Garde une copie des horaires Ramadan de chaque client. Remplace le bloc
  `horaires` au début du mois, puis appelle `/admin/reload`. Fais l'inverse après l'Aïd.
- **Numéros** : tous les formats sont normalisés (`0550…`, `00213…`, `+213…`). L'agent relit le numéro par groupes
  (« 0550, 12, 34, 56 »).
