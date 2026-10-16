"""WhatsApp Business (API officielle « Cloud API » de Meta) : réception et envoi des messages.

Un seul compte Meta Business (celui de l'agence) peut gérer les numéros WhatsApp de tous les cabinets.
Chaque cabinet a son propre numéro, identifié par son `phone_number_id` dans le fichier client :

  "whatsapp": {"phone_number_id": "1234567890", "relance": true, "modele_relance": "rappel_rdv",
               "langue_modele": "fr"}

Variables d'environnement : WHATSAPP_TOKEN (jeton d'accès permanent d'un utilisateur système),
WHATSAPP_APP_SECRET (signature des webhooks), WHATSAPP_VERIFY_TOKEN (vérification du webhook).
"""
from __future__ import annotations

import hashlib
import hmac
import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

log = logging.getLogger("whatsapp")

GRAPH = "https://graph.facebook.com"


@dataclass
class MessageRecu:
    message_id: str
    phone_number_id: str     # numéro WhatsApp du cabinet qui reçoit
    expediteur: str          # numéro de la personne, format international sans « + » (ex. 213550123456)
    nom_profil: str
    texte: str
    bouton: str = ""         # charge utile d'un bouton cliqué (ex. "rdv:41:confirmer")
    depuis_pub: bool = False  # la conversation a été ouverte par une publicité « clic vers WhatsApp »
    pub: dict[str, Any] = field(default_factory=dict)


def signature_valide(corps: bytes, entete: str | None, app_secret: str) -> bool:
    if not app_secret:
        return True  # signature non configurée (tests en local)
    if not entete or not entete.startswith("sha256="):
        return False
    attendu = hmac.new(app_secret.encode(), corps, hashlib.sha256).hexdigest()
    return hmac.compare_digest(entete[7:], attendu)


def extraire_messages(payload: dict[str, Any]) -> list[MessageRecu]:
    """Messages entrants d'une notification Meta (les accusés de lecture sont ignorés)."""
    recus = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            valeur = change.get("value") or {}
            phone_id = (valeur.get("metadata") or {}).get("phone_number_id", "")
            noms = {c.get("wa_id"): (c.get("profile") or {}).get("name", "") for c in valeur.get("contacts", [])}
            for m in valeur.get("messages", []):
                type_ = m.get("type")
                texte, bouton = "", ""
                if type_ == "text":
                    texte = (m.get("text") or {}).get("body", "")
                elif type_ == "button":  # bouton de réponse rapide d'un modèle
                    texte = (m.get("button") or {}).get("text", "")
                    bouton = (m.get("button") or {}).get("payload", "")
                elif type_ == "interactive":
                    rep = (m.get("interactive") or {})
                    choix = rep.get("button_reply") or rep.get("list_reply") or {}
                    texte, bouton = choix.get("title", ""), choix.get("id", "")
                elif type_ in ("audio", "voice"):
                    texte = "[message vocal]"
                elif type_ in ("image", "video", "document", "sticker", "location"):
                    texte = f"[{type_}] " + ((m.get(type_) or {}).get("caption") or "")
                else:
                    continue
                referral = m.get("referral") or {}
                recus.append(MessageRecu(
                    message_id=m.get("id", ""), phone_number_id=phone_id, expediteur=m.get("from", ""),
                    nom_profil=noms.get(m.get("from"), ""), texte=texte.strip(), bouton=bouton,
                    depuis_pub=bool(referral), pub={k: referral.get(k) for k in ("headline", "source_url", "ctwa_clid")
                                                   if referral.get(k)},
                ))
    return recus


class ClientWhatsApp:
    def __init__(self, token: str, version: str = "v23.0", client: httpx.Client | None = None):
        self.token = token
        self.version = version
        self.http = client or httpx.Client(timeout=15)

    def _post(self, phone_number_id: str, corps: dict[str, Any]) -> dict[str, Any]:
        r = self.http.post(
            f"{GRAPH}/{self.version}/{phone_number_id}/messages",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"messaging_product": "whatsapp", **corps},
        )
        if r.is_error:
            raise RuntimeError(f"WhatsApp {r.status_code}: {r.text}")
        return r.json()

    def envoyer_texte(self, phone_number_id: str, destinataire: str, texte: str) -> None:
        for morceau in _decouper(texte, 4000):
            self._post(phone_number_id, {"to": destinataire, "type": "text",
                                         "text": {"body": morceau, "preview_url": False}})

    def marquer_lu(self, phone_number_id: str, message_id: str) -> None:
        """Coches bleues + indicateur « en train d'écrire » pendant que l'IA prépare la réponse."""
        try:
            self._post(phone_number_id, {"status": "read", "message_id": message_id,
                                         "typing_indicator": {"type": "text"}})
        except Exception as e:  # noqa: BLE001 — purement cosmétique
            log.debug("marquer_lu: %s", e)

    def envoyer_modele(self, phone_number_id: str, destinataire: str, nom_modele: str, langue: str,
                       variables: list[str], boutons: list[str]) -> None:
        """Message modèle (validé par Meta), avec boutons de réponse rapide dont on fixe la charge utile."""
        composants: list[dict[str, Any]] = [
            {"type": "body", "parameters": [{"type": "text", "text": v} for v in variables]}]
        composants += [
            {"type": "button", "sub_type": "quick_reply", "index": str(i),
             "parameters": [{"type": "payload", "payload": p}]}
            for i, p in enumerate(boutons)]
        self._post(phone_number_id, {"to": destinataire, "type": "template", "template": {
            "name": nom_modele, "language": {"code": langue}, "components": composants}})


def _decouper(texte: str, taille: int) -> list[str]:
    texte = texte.strip()
    if len(texte) <= taille:
        return [texte] if texte else []
    morceaux, courant = [], ""
    for para in texte.split("\n"):
        if len(courant) + len(para) + 1 > taille and courant:
            morceaux.append(courant)
            courant = ""
        courant = f"{courant}\n{para}" if courant else para
    if courant:
        morceaux.append(courant)
    return [m[i:i + taille] for m in morceaux for i in range(0, len(m), taille)]
