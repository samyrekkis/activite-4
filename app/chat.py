"""Chatbot WhatsApp : la même assistante, en texte, avec les mêmes outils et le même agenda.

L'IA (Claude, via l'API Anthropic) reçoit l'historique de la conversation, appelle les outils
(créneaux, RDV, liste d'attente…) et répond. L'historique est conservé tel quel : on ajoute
toujours à la fin, sans jamais réécrire les messages précédents.
Une conversation est close après 24 h sans message (la suivante repart de zéro).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Any

from .db import Database
from .prompts import system_prompt
from .scheduling import libelle_date, normaliser_telephone
from .tenants import Tenant
from .tools import ContexteAppel, Evenement, executer
from .vapi import SCHEMA_FICHE, definitions_outils
from .whatsapp import MessageRecu

log = logging.getLogger("chat")

FORMAT_SQL = "%Y-%m-%d %H:%M:%S"
MAX_TOURS_OUTILS = 6
MAX_MESSAGES = 120  # au-delà, nouvelle conversation (évite un historique sans fin)
MODELES_AVEC_REPLI = ("claude-opus", "claude-sonnet", "claude-fable")

EXCUSE = {
    "darija": "سمحلي، ما قدرتش نجاوبك دروك. الـ cabinet غادي يعيطلك في أقرب وقت.",
    "francais": "Désolée, je ne peux pas répondre pour le moment. Le cabinet vous recontactera rapidement.",
}


def _horodatage(maintenant: datetime) -> str:
    return f"[{libelle_date(maintenant.date())}, {maintenant.strftime('%H:%M')}]"


def _bloc(b: Any) -> dict[str, Any]:
    """Bloc de réponse de l'API -> dict renvoyable tel quel dans l'historique."""
    return b.model_dump(mode="json", by_alias=True, exclude_none=True)


def _clore(historique: list[dict[str, Any]], texte: str) -> None:
    """Laisse un historique valide pour le prochain message (chaque appel d'outil a sa réponse)."""
    dernier = historique[-1]
    if dernier["role"] == "assistant":
        en_suspens = [b["id"] for b in dernier["content"] if b.get("type") == "tool_use"]
        if not en_suspens:
            return  # la réponse de l'assistante est déjà le dernier message
        historique.append({"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": i, "content": "interrompu", "is_error": True} for i in en_suspens]})
    historique.append({"role": "assistant", "content": [{"type": "text", "text": texte}]})


class AgentTexte:
    def __init__(self, db: Database, modele: str = "claude-opus-5-5", effort: str = "low", client: Any = None):
        self.db = db
        self.modele = modele
        self.effort = effort
        self._client = client

    @property
    def client(self) -> Any:
        if self._client is None:
            import anthropic
            self._client = anthropic.Anthropic()  # ANTHROPIC_API_KEY
        return self._client

    # ------------------------------------------------------------------ conversation

    def conversation(self, t: Tenant, telephone: str, maintenant_utc: datetime) -> Any:
        limite = (maintenant_utc - timedelta(hours=24)).strftime(FORMAT_SQL)
        rows = self.db.query(
            "SELECT * FROM wa_conversations WHERE tenant=? AND telephone=? AND dernier_message >= ? "
            "AND nb_messages < ? ORDER BY id DESC LIMIT 1", (t.id, telephone, limite, MAX_MESSAGES))
        if rows:
            return rows[0]
        cur = self.db.execute("INSERT INTO wa_conversations (tenant, telephone) VALUES (?, ?)", (t.id, telephone))
        return self.db.query("SELECT * FROM wa_conversations WHERE id=?", (cur.lastrowid,))[0]

    def ajouter_echange(self, conv_id: int, texte_patient: str, texte_assistante: str, maintenant: datetime) -> None:
        """Échange traité hors IA (bouton « Je confirme »…), ajouté à l'historique pour le contexte."""
        rows = self.db.query("SELECT messages, nb_messages FROM wa_conversations WHERE id=?", (conv_id,))
        historique = json.loads(rows[0]["messages"])
        historique += [
            {"role": "user", "content": [{"type": "text", "text": f"{_horodatage(maintenant)} {texte_patient}"}]},
            {"role": "assistant", "content": [{"type": "text", "text": texte_assistante}]},
        ]
        self._sauver(conv_id, historique, texte_patient)

    def _sauver(self, conv_id: int, historique: list[dict[str, Any]], dernier_texte: str,
                nom_profil: str = "", source: str = "") -> None:
        self.db.execute(
            "UPDATE wa_conversations SET messages=?, nb_messages=?, dernier_texte=?, dernier_message=datetime('now'), "
            "nom_profil=CASE WHEN ?!='' THEN ? ELSE nom_profil END, source=CASE WHEN ?!='' THEN ? ELSE source END, "
            "fiche_envoyee=0 WHERE id=?",
            (json.dumps(historique, ensure_ascii=False), len(historique), dernier_texte[:500],
             nom_profil, nom_profil, source, source, conv_id))

    # ------------------------------------------------------------------ appel au modèle

    def _creer(self, **kwargs: Any) -> Any:
        if self.modele.startswith(MODELES_AVEC_REPLI):
            # Si un filtre de sécurité refuse la requête, l'API la relance sur un autre modèle (repli serveur).
            return self.client.beta.messages.create(
                betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kwargs)
        return self.client.beta.messages.create(**kwargs)

    def _appel(self, t: Tenant, historique: list[dict[str, Any]]) -> Any:
        outils = [{"name": d["name"], "description": d["description"], "input_schema": d["parameters"]}
                  for d in definitions_outils(t, "whatsapp")]
        return self._creer(
            model=self.modele,
            max_tokens=4096,
            system=system_prompt(t, canal="whatsapp"),
            tools=outils,
            messages=historique,
            cache_control={"type": "ephemeral"},  # le prompt et l'historique sont relus à chaque message
            output_config={"effort": self.effort},
        )

    # ------------------------------------------------------------------ tour de conversation

    def repondre(self, t: Tenant, recu: MessageRecu, maintenant: datetime,
                 maintenant_utc: datetime) -> tuple[str, list[Evenement]]:
        telephone = normaliser_telephone("+" + recu.expediteur.lstrip("+"))
        conv = self.conversation(t, telephone, maintenant_utc)
        historique: list[dict[str, Any]] = json.loads(conv["messages"])
        ctx = ContexteAppel(tenant=t, db=self.db, call_id=f"wa:{conv['id']}", numero_appelant=telephone,
                            mode="whatsapp")

        entete = _horodatage(maintenant)
        if recu.depuis_pub and not historique:
            titre = recu.pub.get("headline")
            entete += f" [arrivée par la publicité{f' « {titre} »' if titre else ''}]"
        if recu.nom_profil and not historique:
            entete += f" [nom du profil WhatsApp : {recu.nom_profil}]"
        historique.append({"role": "user", "content": [{"type": "text", "text": f"{entete} {recu.texte}"}]})

        texte = ""
        try:
            for _ in range(MAX_TOURS_OUTILS):
                reponse = self._appel(t, historique)
                if reponse.stop_reason == "refusal":
                    texte = EXCUSE.get(t.langue_principale, EXCUSE["francais"])
                    historique.append({"role": "assistant", "content": [{"type": "text", "text": texte}]})
                    ctx.evenements.append(Evenement(
                        "message", f"📩 Message WhatsApp à traiter à la main\n{telephone}\n« {recu.texte[:300]} »",
                        {"telephone": telephone}))
                    break
                historique.append({"role": "assistant", "content": [_bloc(b) for b in reponse.content]})
                appels = [b for b in reponse.content if b.type == "tool_use"]
                if reponse.stop_reason == "tool_use" and appels:
                    resultats = []
                    for b in appels:
                        r = executer(ctx, b.name, dict(b.input or {}))
                        log.info("[%s/wa] outil %s %s -> %s", t.id, b.name, b.input, r)
                        resultats.append({"type": "tool_result", "tool_use_id": b.id,
                                          "content": json.dumps(r, ensure_ascii=False),
                                          **({"is_error": True} if "erreur" in r else {})})
                    historique.append({"role": "user", "content": resultats})
                    continue
                texte = "\n".join(b.text for b in reponse.content if b.type == "text").strip()
                break
        except Exception:  # noqa: BLE001 — l'API ou un outil a échoué : on prévient au lieu de se taire
            log.exception("[%s] erreur du chatbot WhatsApp", t.id)
            texte = EXCUSE.get(t.langue_principale, EXCUSE["francais"])
            ctx.evenements.append(Evenement(
                "alerte", f"⚠️ Le chatbot WhatsApp n'a pas pu répondre à {telephone}. À rappeler.\n« {recu.texte[:300]} »",
                {"telephone": telephone}))

        if not texte:
            texte = EXCUSE.get(t.langue_principale, EXCUSE["francais"])
        _clore(historique, texte)
        self._sauver(conv["id"], historique, recu.texte, recu.nom_profil, "pub" if recu.depuis_pub else "")
        return texte, ctx.evenements

    # ------------------------------------------------------------------ fiche prospect (Telegram)

    def conversations_a_ficher(self, t: Tenant, maintenant_utc: datetime, inactivite_min: int = 30) -> list[Any]:
        limite = (maintenant_utc - timedelta(minutes=inactivite_min)).strftime(FORMAT_SQL)
        return self.db.query(
            "SELECT * FROM wa_conversations WHERE tenant=? AND fiche_envoyee=0 AND nb_messages >= 2 "
            "AND dernier_message <= ?", (t.id, limite))

    def fiche(self, conv: Any) -> dict[str, Any]:
        """Score d'intérêt de la conversation (sortie JSON structurée)."""
        lignes = []
        for m in json.loads(conv["messages"]):
            for b in m["content"]:
                if b.get("type") == "text":
                    lignes.append(f"{'Patient' if m['role'] == 'user' else 'Assistante'} : {b['text']}")
        schema = {
            "type": "object",
            "properties": {**{k: v for k, v in SCHEMA_FICHE["properties"].items() if k != "questions_sans_reponse"},
                           "resume": {"type": "string", "description": "Résumé en français, 2 phrases maximum."}},
            "required": ["nom_appelant", "score_interet", "categorie", "soin_evoque", "prochaine_action", "resume"],
            "additionalProperties": False,
        }
        reponse = self.client.messages.create(
            model=self.modele, max_tokens=2048,
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": schema}},
            messages=[{"role": "user", "content":
                       "Voici une conversation WhatsApp entre un cabinet et une personne. Remplis la fiche pour le "
                       "cabinet.\n\n" + "\n".join(lignes)}],
        )
        if reponse.stop_reason == "refusal":
            return {}
        texte = "".join(b.text for b in reponse.content if b.type == "text")
        return json.loads(texte) if texte else {}
