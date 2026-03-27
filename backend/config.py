"""
Модуль `config.py`

Назначение:
- Конфигурация приложения: безопасность, JWT, база данных и пути загрузок.

Ключевые константы и значения:
- `BASE_DIR`: используется как конфигурационный или справочный набор значений в этом модуле.

Классы и методы:
- `Config`: модель/класс, инкапсулирующий связанную логику и данные.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

import os
from datetime import timedelta
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover - optional in runtime before deps install
    def load_dotenv(*_args, **_kwargs):
        return False


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(Path(BASE_DIR) / ".env")


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-me")
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRES_IN = timedelta(hours=12)

    _database_url = os.getenv("DATABASE_URL", "").strip()
    if _database_url.startswith("postgres://"):
        _database_url = _database_url.replace("postgres://", "postgresql://", 1)

    scheme_part = _database_url.split("://", 1)[0]
    if _database_url.startswith("postgresql://") and "+" not in scheme_part:
        preferred_driver = os.getenv("POSTGRES_DRIVER", "psycopg").strip()
        if preferred_driver:
            _database_url = _database_url.replace(
                "postgresql://",
                f"postgresql+{preferred_driver}://",
                1,
            )

    SQLALCHEMY_DATABASE_URI = _database_url or f"sqlite:///{os.path.join(BASE_DIR, 'database.db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
    }

    STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local").strip().lower()
    SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "edu-kernel").strip()
    SUPABASE_STORAGE_PREFIX = os.getenv("SUPABASE_STORAGE_PREFIX", "uploads").strip()
    SUPABASE_STORAGE_PUBLIC = os.getenv("SUPABASE_STORAGE_PUBLIC", "true").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    SUPABASE_STORAGE_AUTO_CREATE_BUCKET = (
        os.getenv("SUPABASE_STORAGE_AUTO_CREATE_BUCKET", "true").strip().lower()
        in {"1", "true", "yes", "on"}
    )

    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads", "books")
