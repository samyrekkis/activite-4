"""Configuration lue depuis les variables d'environnement."""
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    public_base_url: str
    vapi_api_key: str
    vapi_webhook_secret: str
    telegram_bot_token: str
    admin_token: str
    database_path: Path
    clients_dir: Path
    niches_dir: Path


def load_settings() -> Settings:
    return Settings(
        public_base_url=os.getenv("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/"),
        vapi_api_key=os.getenv("VAPI_API_KEY", ""),
        vapi_webhook_secret=os.getenv("VAPI_WEBHOOK_SECRET", ""),
        telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", ""),
        admin_token=os.getenv("ADMIN_TOKEN", ""),
        database_path=Path(os.getenv("DATABASE_PATH", "data/agent.db")),
        clients_dir=Path(os.getenv("CLIENTS_DIR", "clients")),
        niches_dir=Path(os.getenv("NICHES_DIR", "niches")),
    )
