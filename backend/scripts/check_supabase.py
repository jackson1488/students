#!/usr/bin/env python3
"""
Быстрая проверка подключения backend к Supabase.

Запуск:
  cd backend
  ./.venv/bin/python scripts/check_supabase.py
"""

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

import psycopg
from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def main():
    load_dotenv(ROOT_DIR / ".env")
    db_url = str(os.getenv("DATABASE_URL") or "").strip()
    storage_backend = str(os.getenv("STORAGE_BACKEND") or "").strip()
    supabase_url = str(os.getenv("SUPABASE_URL") or "").strip()
    bucket = str(os.getenv("SUPABASE_STORAGE_BUCKET") or "").strip()

    print("DATABASE_URL:", db_url)
    print("STORAGE_BACKEND:", storage_backend)
    print("SUPABASE_URL:", supabase_url)
    print("SUPABASE_STORAGE_BUCKET:", bucket)

    if not db_url:
        print("DB CONNECT FAILED: DATABASE_URL is empty")
        raise SystemExit(1)

    parsed = urlparse(db_url)
    print("DB HOST:", parsed.hostname)
    print("DB PORT:", parsed.port)

    host = str(parsed.hostname or "")
    if host.startswith("db.") and host.endswith(".supabase.co"):
        print(
            "WARNING: detected direct DB host (db.<ref>.supabase.co). "
            "Use Pooler URI instead: aws-0-<region>.pooler.supabase.com:6543"
        )

    try:
        with psycopg.connect(db_url, connect_timeout=10) as conn:
            with conn.cursor() as cur:
                cur.execute("select current_database(), current_user")
                row = cur.fetchone()
        print("DB CONNECT OK:", row)
    except Exception as exc:
        print("DB CONNECT FAILED:", repr(exc))
        print(
            "Tip: use Supabase Pooler URI in DATABASE_URL "
            "(Project Settings -> Database -> Connection string -> Pooler)"
        )
        raise SystemExit(1)


if __name__ == "__main__":
    main()
