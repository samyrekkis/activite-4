"""Stockage SQLite : rendez-vous, messages laissés et appels."""
from __future__ import annotations

import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

SCHEMA = """
CREATE TABLE IF NOT EXISTS rendez_vous (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant TEXT NOT NULL,
    nom TEXT NOT NULL,
    telephone TEXT NOT NULL,
    service TEXT NOT NULL,
    debut TEXT NOT NULL,          -- ISO local 'YYYY-MM-DDTHH:MM'
    fin TEXT NOT NULL,
    statut TEXT NOT NULL DEFAULT 'confirme',   -- confirme | annule
    notes TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'agent',      -- agent | cabinet
    call_id TEXT,
    cree_le TEXT NOT NULL DEFAULT (datetime('now')),
    modifie_le TEXT,
    external_id TEXT,              -- identifiant dans l'agenda / le CRM du cabinet
    confirmation TEXT,             -- NULL | appel_en_cours | confirme | injoignable | annule_relance
    relance_tentatives INTEGER NOT NULL DEFAULT 0,
    relance_derniere TEXT          -- heure locale du dernier appel de confirmation
);
CREATE INDEX IF NOT EXISTS idx_rdv_tenant_debut ON rendez_vous(tenant, debut);
CREATE INDEX IF NOT EXISTS idx_rdv_tenant_tel ON rendez_vous(tenant, telephone);

CREATE TABLE IF NOT EXISTS liste_attente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant TEXT NOT NULL,
    nom TEXT NOT NULL,
    telephone TEXT NOT NULL,
    service TEXT NOT NULL,
    preference TEXT NOT NULL DEFAULT '',
    statut TEXT NOT NULL DEFAULT 'en_attente',  -- en_attente | contacte | servi | expire
    offre_debut TEXT,          -- créneau proposé lors du dernier appel
    contacte_le TEXT,
    cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attente_tenant ON liste_attente(tenant, statut);

CREATE TABLE IF NOT EXISTS wa_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant TEXT NOT NULL,
    telephone TEXT NOT NULL,
    nom_profil TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',     -- 'pub' si la personne arrive par une publicité « clic vers WhatsApp »
    messages TEXT NOT NULL DEFAULT '[]', -- historique complet pour l'IA (ajout uniquement)
    nb_messages INTEGER NOT NULL DEFAULT 0,
    dernier_texte TEXT NOT NULL DEFAULT '',
    debut TEXT NOT NULL DEFAULT (datetime('now')),
    dernier_message TEXT NOT NULL DEFAULT (datetime('now')),
    fiche TEXT,                          -- JSON : score d'intérêt, catégorie, action
    fiche_envoyee INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_wa_tenant_tel ON wa_conversations(tenant, telephone, dernier_message);

CREATE TABLE IF NOT EXISTS wa_vus (
    message_id TEXT PRIMARY KEY,         -- Meta peut renvoyer le même message : on ne le traite qu'une fois
    recu_le TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant TEXT NOT NULL,
    nom TEXT NOT NULL,
    telephone TEXT NOT NULL,
    motif TEXT NOT NULL,
    urgent INTEGER NOT NULL DEFAULT 0,
    traite INTEGER NOT NULL DEFAULT 0,
    call_id TEXT,
    cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS appels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id TEXT UNIQUE,
    tenant TEXT NOT NULL,
    numero TEXT,
    debut TEXT,
    fin TEXT,
    duree_s REAL,
    cout REAL,
    raison_fin TEXT,
    resume TEXT,
    transcript TEXT,
    enregistrement_url TEXT,
    questions_sans_reponse TEXT,  -- JSON : questions auxquelles la fiche ne répondait pas
    fiche TEXT,                   -- JSON : fiche d'appel (score d'intérêt, catégorie, action)
    mode TEXT,                    -- entrant | relance | offre
    cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_appels_tenant ON appels(tenant, cree_le);
"""


class Database:
    def __init__(self, path: Path | str):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        # Une seule connexion partagée ; les écritures critiques passent par transaction().
        self.conn = sqlite3.connect(self.path, check_same_thread=False, isolation_level=None)
        self.conn.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.executescript(SCHEMA)
        # Bases créées avec une version précédente : ajout des colonnes manquantes.
        self._ajouter_colonnes("appels", {"questions_sans_reponse": "TEXT", "fiche": "TEXT", "mode": "TEXT"})
        self._ajouter_colonnes("rendez_vous", {
            "external_id": "TEXT", "confirmation": "TEXT",
            "relance_tentatives": "INTEGER NOT NULL DEFAULT 0", "relance_derniere": "TEXT"})

    def _ajouter_colonnes(self, table: str, colonnes: dict[str, str]) -> None:
        existantes = {r["name"] for r in self.conn.execute(f"PRAGMA table_info({table})")}
        for nom, type_ in colonnes.items():
            if nom not in existantes:
                self.conn.execute(f"ALTER TABLE {table} ADD COLUMN {nom} {type_}")

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        """Transaction exclusive : empêche deux appels simultanés de prendre le même créneau."""
        with self._lock:
            self.conn.execute("BEGIN IMMEDIATE")
            try:
                yield self.conn
                self.conn.execute("COMMIT")
            except BaseException:
                self.conn.execute("ROLLBACK")
                raise

    def query(self, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
        with self._lock:
            return self.conn.execute(sql, params).fetchall()

    def execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        with self._lock:
            return self.conn.execute(sql, params)
