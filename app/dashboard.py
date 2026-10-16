"""Tableau de bord du cabinet (HTML simple, sans dépendance) et statistiques."""
from __future__ import annotations

from datetime import datetime, timezone
from html import escape
from typing import Any

from .db import Database
from .scheduling import FORMAT, libelle_creneau, parse_local, telephone_lisible
from .tenants import Tenant


def stats(db: Database, t: Tenant, mois: str | None = None) -> dict[str, Any]:
    """Statistiques mensuelles (mois = 'AAAA-MM', défaut : mois courant)."""
    mois = mois or datetime.now(t.fuseau).strftime("%Y-%m")
    like = f"{mois}%"
    appels = db.query(
        "SELECT COUNT(*) n, COALESCE(SUM(duree_s),0) s, COALESCE(SUM(cout),0) c "
        "FROM appels WHERE tenant=? AND cree_le LIKE ?", (t.id, like))[0]
    rdv = db.query(
        "SELECT COUNT(*) n FROM rendez_vous WHERE tenant=? AND source='agent' AND cree_le LIKE ?",
        (t.id, like))[0]["n"]
    annules = db.query(
        "SELECT COUNT(*) n FROM rendez_vous WHERE tenant=? AND statut='annule' AND modifie_le LIKE ?",
        (t.id, like))[0]["n"]
    messages = db.query(
        "SELECT COUNT(*) n FROM messages WHERE tenant=? AND cree_le LIKE ?", (t.id, like))[0]["n"]
    valeur = int(t.get("valeur_moyenne_rdv_da", 0) or 0)
    return {
        "mois": mois,
        "appels": appels["n"],
        "minutes": round(appels["s"] / 60, 1),
        "cout_usd": round(appels["c"], 2),
        "rdv_pris_par_agent": rdv,
        "rdv_annules": annules,
        "messages": messages,
        "valeur_estimee_da": rdv * valeur,
    }


def _local(t: Tenant, ts_utc: str | None) -> str:
    """Horodatage SQLite (UTC) -> heure locale du cabinet."""
    if not ts_utc:
        return ""
    try:
        dt = datetime.strptime(ts_utc[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return ts_utc
    return dt.astimezone(t.fuseau).strftime("%d/%m %H:%M")


CSS = """
:root{--bg:#f6f7f9;--card:#fff;--txt:#1c2430;--mut:#5d6b7a;--acc:#0b7a5a;--bd:#e3e7ec;--warn:#b42318}
@media (prefers-color-scheme:dark){:root{--bg:#0f141a;--card:#18202a;--txt:#e7edf3;--mut:#9aa8b6;--acc:#3ccf9a;--bd:#2a3542;--warn:#ff6b5e}}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--txt)}
main{max-width:1100px;margin:0 auto;padding:20px 16px}h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 10px}
.mut{color:var(--mut)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:16px}
.card{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:14px}.big{font-size:26px;font-weight:650}
.tbl{overflow-x:auto;background:var(--card);border:1px solid var(--bd);border-radius:10px}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--bd);vertical-align:top}
th{font-size:13px;color:var(--mut);font-weight:600}tr:last-child td{border-bottom:0}
.urg{color:var(--warn);font-weight:600}button{font:inherit;border:1px solid var(--bd);background:transparent;color:var(--txt);border-radius:6px;padding:3px 9px;cursor:pointer}
a{color:var(--acc)}form{display:inline}summary{cursor:pointer;font-weight:600}
.ajout{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.ajout input,.ajout select{font:inherit;padding:5px 8px;border:1px solid var(--bd);border-radius:6px;background:var(--bg);color:var(--txt);max-width:100%}
details{margin-bottom:10px}
"""


def _table(entetes: list[str], lignes: list[list[str]], vide: str) -> str:
    if not lignes:
        return f'<div class="card mut">{escape(vide)}</div>'
    th = "".join(f"<th>{escape(h)}</th>" for h in entetes)
    trs = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in l) + "</tr>" for l in lignes)
    return f'<div class="tbl"><table><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table></div>'


def page(db: Database, t: Tenant, key: str) -> str:
    s = stats(db, t)
    maintenant = datetime.now(t.fuseau).replace(tzinfo=None).strftime(FORMAT)
    k = escape(key, quote=True)

    rdvs = db.query(
        "SELECT * FROM rendez_vous WHERE tenant=? AND statut='confirme' AND debut>=? ORDER BY debut LIMIT 100",
        (t.id, maintenant))
    lignes_rdv = [[
        escape(libelle_creneau(parse_local(r["debut"]))),
        escape(r["nom"]),
        f'<a href="tel:{escape(r["telephone"])}">{escape(telephone_lisible(r["telephone"]))}</a>',
        escape(r["service"]),
        escape(r["notes"]),
        f'<form method="post" action="/dashboard/{escape(t.id)}/rdv/{r["id"]}/annuler?key={k}" '
        f'onsubmit="return confirm(\'Annuler ce rendez-vous ?\')"><button>Annuler</button></form>',
    ] for r in rdvs]

    msgs = db.query(
        "SELECT * FROM messages WHERE tenant=? AND traite=0 ORDER BY urgent DESC, cree_le DESC LIMIT 100", (t.id,))
    lignes_msg = [[
        escape(_local(t, m["cree_le"])),
        ('<span class="urg">URGENT</span> ' if m["urgent"] else "") + escape(m["nom"]),
        f'<a href="tel:{escape(m["telephone"])}">{escape(telephone_lisible(m["telephone"]))}</a>',
        escape(m["motif"]),
        f'<form method="post" action="/dashboard/{escape(t.id)}/message/{m["id"]}/traite?key={k}"><button>Traité</button></form>',
    ] for m in msgs]

    appels = db.query("SELECT * FROM appels WHERE tenant=? ORDER BY cree_le DESC LIMIT 50", (t.id,))
    lignes_appels = [[
        escape(_local(t, a["cree_le"])),
        escape(telephone_lisible(a["numero"] or "")),
        f'{round((a["duree_s"] or 0) / 60, 1)} min',
        escape(a["resume"] or ""),
        f'<a href="{escape(a["enregistrement_url"])}" target="_blank" rel="noopener">écouter</a>' if a["enregistrement_url"] else "",
    ] for a in appels]

    options_services = "".join(
        f'<option value="{escape(sv.id)}">{escape(sv.nom)} ({sv.duree} min)</option>' for sv in t.services)
    valeur = f'<div class="card"><div class="mut">Valeur estimée</div><div class="big">{s["valeur_estimee_da"]:,} DA</div></div>'.replace(",", " ") if s["valeur_estimee_da"] else ""
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(t.nom)} — Assistant</title>
<style>{CSS}</style></head><body><main>
<h1>{escape(t.nom)}</h1><div class="mut">Assistante vocale {escape(t.nom_assistant)} · statistiques du mois {escape(s['mois'])}</div>
<div class="grid">
<div class="card"><div class="mut">Appels traités</div><div class="big">{s['appels']}</div></div>
<div class="card"><div class="mut">RDV pris par l'IA</div><div class="big">{s['rdv_pris_par_agent']}</div></div>
<div class="card"><div class="mut">Messages</div><div class="big">{s['messages']}</div></div>
<div class="card"><div class="mut">Minutes</div><div class="big">{s['minutes']}</div></div>
{valeur}
</div>
<h2>Prochains rendez-vous</h2>
<details class="card"><summary>Ajouter un RDV pris au cabinet / bloquer un créneau</summary>
<form class="ajout" method="post" action="/dashboard/{escape(t.id)}/rdv?key={k}">
<input name="nom" placeholder="Nom (ou « Bloqué »)" required>
<input name="telephone" placeholder="Téléphone">
<select name="service">{options_services}</select>
<input type="date" name="date" required><input type="time" name="heure" step="300" required>
<input type="number" name="duree" min="5" step="5" placeholder="Durée (min, optionnel)">
<button>Ajouter</button></form></details>
{_table(["Date", "Nom", "Téléphone", "Service", "Notes", ""], lignes_rdv, "Aucun rendez-vous à venir.")}
<p><a href="/dashboard/{escape(t.id)}/export.csv?key={k}">Exporter tous les rendez-vous (CSV)</a></p>
<h2>Messages à rappeler</h2>
{_table(["Reçu le", "Nom", "Téléphone", "Motif", ""], lignes_msg, "Aucun message en attente.")}
<h2>Derniers appels</h2>
{_table(["Date", "Numéro", "Durée", "Résumé", "Enregistrement"], lignes_appels, "Aucun appel pour l'instant.")}
</main></body></html>"""
