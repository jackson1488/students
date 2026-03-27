#!/usr/bin/env python3
"""
Применение supabase SQL-файлов без psql-клиента (через psycopg).

Использует:
- DATABASE_URL из окружения или backend/.env
- backend/supabase/01_schema.sql
- backend/supabase/02_data.sql
"""

import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[1]
SCHEMA_SQL = ROOT_DIR / "supabase" / "01_schema.sql"
DATA_SQL = ROOT_DIR / "supabase" / "02_data.sql"


def _load_text(path: Path):
    if not path.exists():
        raise FileNotFoundError(f"Missing SQL file: {path}")
    return path.read_text(encoding="utf-8")


def _execute_sql(conn, label: str, sql_text: str):
    print(f"Applying {label} ...")
    with conn.cursor() as cur:
        cur.execute(sql_text)
    print(f"Done {label}")


def _table_exists(conn, table_name: str):
    with conn.cursor() as cur:
        cur.execute("select to_regclass(%s)", (f"public.{table_name}",))
        row = cur.fetchone()
    return bool(row and row[0])


def _table_count(conn, table_name: str):
    with conn.cursor() as cur:
        cur.execute(f"select count(*) from {table_name}")
        row = cur.fetchone()
    return int(row[0] if row else 0)


def main():
    load_dotenv(ROOT_DIR / ".env")
    db_url = str(os.getenv("DATABASE_URL") or "").strip()
    if not db_url:
        raise SystemExit("DATABASE_URL is not set")

    schema_sql = _load_text(SCHEMA_SQL)
    data_sql = _load_text(DATA_SQL)

    force_apply = str(os.getenv("FORCE_APPLY_SQL", "")).strip().lower() in {"1", "true", "yes", "on"}

    with psycopg.connect(db_url, autocommit=True) as conn:
        schema_exists = _table_exists(conn, "users")
        if schema_exists and not force_apply:
            print("Skip 01_schema.sql: schema already exists (users table found).")
        else:
            _execute_sql(conn, "01_schema.sql", schema_sql)

        data_exists = False
        if _table_exists(conn, "users"):
            try:
                data_exists = _table_count(conn, "users") > 0
            except Exception:
                data_exists = False

        if data_exists and not force_apply:
            print("Skip 02_data.sql: data already exists (users table has rows).")
        else:
            _execute_sql(conn, "02_data.sql", data_sql)

    print("All SQL applied successfully.")


if __name__ == "__main__":
    main()
