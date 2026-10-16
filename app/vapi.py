"""Intégration Vapi : construction de l'assistant et lecture des webhooks.

Vapi gère la téléphonie, la reconnaissance vocale (STT), le LLM et la synthèse
vocale (TTS). Notre serveur fournit :
- la configuration de l'assistant à chaque appel (`assistant-request`) ;
- l'exécution des outils (`tool-calls`) ;
- l'archivage de l'appel (`end-of-call-report`).
"""
from __future__ import annotations

import json
from typing import Any

from .prompts import first_message, system_prompt
from .tenants import Tenant

# Valeurs par défaut, surchargeables par client (champs "modele", "voix", "transcripteur").
# Pas de "temperature" : les modèles Claude récents la refusent.
MODELE_DEFAUT = {"provider": "anthropic", "model": "claude-opus-5-5"}

VOIX_DEFAUT = {
    # Voix Azure à accent algérien : bonne base, gratuite côté Vapi.
    # Pour une voix plus naturelle (darija + français mélangés), utiliser ElevenLabs :
    # {"provider": "11labs", "voiceId": "<id>", "model": "eleven_flash_v2_5"}
    "darija": {"provider": "azure", "voiceId": "ar-DZ-AminaNeural"},
    "arabe": {"provider": "azure", "voiceId": "ar-DZ-AminaNeural"},
    "francais": {"provider": "azure", "voiceId": "fr-FR-DeniseNeural"},
}

TRANSCRIPTEUR_DEFAUT = {
    "darija": {"provider": "azure", "language": "ar-DZ"},
    "arabe": {"provider": "azure", "language": "ar-DZ"},
    "francais": {"provider": "deepgram", "model": "nova-3", "language": "fr"},
}

ATTENTE = {
    "darija": "لحظة برك، نشوف...",
    "arabe": "لحظة من فضلك...",
    "francais": "Un instant, je regarde...",
}


def _fn(name: str, description: str, properties: dict[str, Any], required: list[str]) -> dict[str, Any]:
    return {
        "name": name,
        "description": description,
        "parameters": {"type": "object", "properties": properties, "required": required},
    }


def _definitions_outils(t: Tenant) -> list[dict[str, Any]]:
    services = [s.id for s in t.services]
    service_prop = {"type": "string", "enum": services, "description": "Identifiant du service demandé."}
    tel_prop = {
        "type": "string",
        "description": "Numéro de téléphone de la personne (ex. 0550123456). Laisser vide pour utiliser le numéro de l'appelant.",
    }
    return [
        _fn(
            "verifier_disponibilites",
            "Cherche les créneaux libres. Toujours l'appeler avant de proposer un horaire. "
            "Renvoie aussi la date du jour.",
            {
                "service": service_prop,
                "date": {"type": "string", "description": "Date souhaitée AAAA-MM-JJ (optionnel). Calcule-la à partir de la date du jour pour « demain », « samedi prochain », etc."},
                "moment": {"type": "string", "enum": ["matin", "apres-midi", "soir"], "description": "Moment préféré (optionnel)."},
                "heure_souhaitee": {"type": "string", "description": "Heure souhaitée HH:MM (optionnel)."},
            },
            ["service"],
        ),
        _fn(
            "prendre_rendez_vous",
            "Enregistre le rendez-vous. Uniquement après confirmation orale du nom, du service, du créneau et du téléphone.",
            {
                "nom": {"type": "string", "description": "Nom et prénom de la personne."},
                "telephone": tel_prop,
                "service": service_prop,
                "debut": {"type": "string", "description": "Valeur 'debut' exacte d'un créneau renvoyé par verifier_disponibilites (AAAA-MM-JJTHH:MM)."},
                "notes": {"type": "string", "description": "Motif ou précision utile pour le cabinet (optionnel, court)."},
            },
            ["nom", "service", "debut"],
        ),
        _fn(
            "chercher_rendez_vous",
            "Liste les rendez-vous à venir d'une personne (par son téléphone).",
            {"telephone": tel_prop},
            [],
        ),
        _fn(
            "annuler_rendez_vous",
            "Annule un rendez-vous après confirmation de l'appelant.",
            {
                "rendez_vous_id": {"type": "integer", "description": "Identifiant renvoyé par chercher_rendez_vous."},
                "telephone": tel_prop,
                "motif": {"type": "string", "description": "Motif de l'annulation (optionnel)."},
            },
            ["rendez_vous_id"],
        ),
        _fn(
            "deplacer_rendez_vous",
            "Déplace un rendez-vous existant vers un nouveau créneau libre.",
            {
                "rendez_vous_id": {"type": "integer", "description": "Identifiant renvoyé par chercher_rendez_vous."},
                "nouveau_debut": {"type": "string", "description": "Valeur 'debut' d'un créneau renvoyé par verifier_disponibilites."},
                "telephone": tel_prop,
            },
            ["rendez_vous_id", "nouveau_debut"],
        ),
        _fn(
            "laisser_message",
            "Transmet un message au cabinet pour qu'il rappelle la personne (question hors de ton rôle, demande de rappel, urgence).",
            {
                "nom": {"type": "string"},
                "telephone": tel_prop,
                "motif": {"type": "string", "description": "Motif de l'appel en une ou deux phrases."},
                "urgent": {"type": "boolean", "description": "true si la situation est urgente."},
            },
            ["motif"],
        ),
    ]


def server_url(base_url: str, t: Tenant) -> str:
    return f"{base_url}/vapi/webhook?tenant={t.id}"


def build_assistant(t: Tenant, base_url: str, secret: str = "") -> dict[str, Any]:
    langue = t.langue_principale if t.langue_principale in VOIX_DEFAUT else "darija"
    server: dict[str, Any] = {"url": server_url(base_url, t)}
    if secret:
        server["headers"] = {"x-vapi-secret": secret}

    tools: list[dict[str, Any]] = [
        {
            "type": "function",
            "function": f,
            "messages": [{"type": "request-start", "content": ATTENTE[langue]}],
            "server": server,
        }
        for f in _definitions_outils(t)
    ]
    transfert = t.get("numero_transfert")
    if transfert:
        tools.append({
            "type": "transferCall",
            "destinations": [{
                "type": "number",
                "number": transfert,
                "message": "Je vous mets en relation avec le cabinet, un instant." if langue == "francais"
                else "دقيقة، راني نحولك للـ cabinet.",
            }],
        })
    tools.append({"type": "endCall"})

    modele = {**MODELE_DEFAUT, **(t.get("modele") or {})}
    modele["messages"] = [{"role": "system", "content": system_prompt(t)}]
    modele["tools"] = tools

    return {
        "name": f"{t.nom_assistant} — {t.nom}"[:40],
        "firstMessage": first_message(t),
        "model": modele,
        "voice": t.get("voix") or VOIX_DEFAUT[langue],
        "transcriber": t.get("transcripteur") or TRANSCRIPTEUR_DEFAUT[langue],
        "server": server,
        "serverMessages": ["end-of-call-report", "tool-calls"],
        "endCallMessage": "Merci pour votre appel, bonne journée." if langue == "francais"
        else "يعطيك الصحة، نهارك مبروك.",
        "silenceTimeoutSeconds": 30,
        "maxDurationSeconds": int(t.get("duree_max_appel_s", 600)),
        "backgroundSound": "off",
        "recordingEnabled": bool(t.get("enregistrement", True)),
        "analysisPlan": {
            "summaryPlan": {
                "messages": [
                    {"role": "system", "content": (
                        "Résume cet appel en français en 2 phrases maximum pour le cabinet : "
                        "qui a appelé, pourquoi, et ce qui a été fait (RDV pris/annulé, message, transfert)."
                    )},
                    {"role": "user", "content": "Transcription :\n\n{{transcript}}"},
                ]
            },
            # Boucle d'amélioration : on relève les questions que la fiche du cabinet ne couvrait pas,
            # pour les proposer dans le tableau de bord (« À ajouter à la fiche »).
            "structuredDataPlan": {
                "enabled": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "questions_sans_reponse": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": (
                                "Questions précises de l'appelant auxquelles l'assistante n'a pas pu répondre "
                                "faute d'information (ex. « Acceptez-vous la carte Chifa ? »). Reformulées en "
                                "français, courtes. Liste vide si tout a été répondu."
                            ),
                        }
                    },
                },
            },
        },
        "metadata": {"tenant": t.id},
    }


def parse_arguments(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            data = json.loads(raw)
            return data if isinstance(data, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def extraire_appels_outils(message: dict[str, Any]) -> list[tuple[str, str, dict[str, Any]]]:
    """Renvoie [(tool_call_id, nom, arguments)] depuis un message `tool-calls`."""
    appels = []
    liste = message.get("toolCallList") or message.get("toolCalls") or []
    for tc in liste:
        fn = tc.get("function") or {}
        appels.append((tc.get("id", ""), fn.get("name", tc.get("name", "")),
                       parse_arguments(fn.get("arguments", tc.get("arguments")))))
    return appels


def numero_appelant(message: dict[str, Any]) -> str | None:
    call = message.get("call") or {}
    customer = call.get("customer") or message.get("customer") or {}
    return customer.get("number")
