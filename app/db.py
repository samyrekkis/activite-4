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
    modifie_le TEXT
);
CREATE INDEX IF NOT EXISTS idx_rdv_tenant_debut ON rendez_vous(tenant, debut);
CREATE INDEX IF NOT EXISTS idx_rdv_tenant_tel ON rendez_vous(tenant, telephone);

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
        colonnes = {r["name"] for r in self.conn.execute("PRAGMA table_info(appels)")}
        if "questions_sans_reponse" not in colonnes:  # bases créées avant cette colonne
            self.conn.execute("ALTER TABLE appels ADD COLUMN questions_sans_reponse TEXT")

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
