#!/usr/bin/env python3
"""
Export PostgreSQL schema + data SQL for Supabase from current SQLite database.

Outputs:
- backend/supabase/01_schema.sql
- backend/supabase/02_data.sql
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
import sys

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateIndex, CreateTable


BASE_DIR = Path(__file__).resolve().parents[1]
SQLITE_DB_PATH = BASE_DIR / "database.db"
OUT_DIR = BASE_DIR / "supabase"
SCHEMA_SQL_PATH = OUT_DIR / "01_schema.sql"
DATA_SQL_PATH = OUT_DIR / "02_data.sql"
COUNTS_MD_PATH = OUT_DIR / "03_source_counts.md"


def _quote_ident(name: str) -> str:
    return '"' + str(name).replace('"', '""') + '"'


def _to_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on", "да"}
    return bool(value)


def _to_sql_literal(value, column: sa.Column) -> str:
    if value is None:
        return "NULL"

    if isinstance(column.type, sa.Boolean):
        return "TRUE" if _to_bool(value) else "FALSE"

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)

    text_value = str(value)
    text_value = text_value.replace("\\", "\\\\").replace("'", "''")
    return f"'{text_value}'"


def _table_has_serial_id(table: sa.Table) -> bool:
    for column in table.columns:
        if column.name != "id":
            continue
        if not column.primary_key:
            continue
        if isinstance(column.type, sa.Integer):
            return True
    return False


def export_schema(metadata: sa.MetaData):
    dialect = postgresql.dialect()
    with SCHEMA_SQL_PATH.open("w", encoding="utf-8") as fh:
        generated_at = datetime.now(timezone.utc).isoformat()
        fh.write("-- Auto-generated for Supabase/PostgreSQL\n")
        fh.write(f"-- Generated at: {generated_at}\n\n")
        fh.write("BEGIN;\n\n")

        for table in metadata.sorted_tables:
            fh.write(f"-- Table: {table.name}\n")
            table_sql = str(CreateTable(table).compile(dialect=dialect)).strip()
            fh.write(f"{table_sql};\n\n")

        for table in metadata.sorted_tables:
            for index in sorted(table.indexes, key=lambda idx: idx.name or ""):
                index_sql = str(CreateIndex(index).compile(dialect=dialect)).strip()
                if index_sql:
                    fh.write(f"{index_sql};\n")

        fh.write("\nCOMMIT;\n")


def export_data(metadata: sa.MetaData):
    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row

    table_counts: dict[str, int] = {}

    with conn, DATA_SQL_PATH.open("w", encoding="utf-8") as fh:
        generated_at = datetime.now(timezone.utc).isoformat()
        fh.write("-- Auto-generated data export from SQLite for Supabase/PostgreSQL\n")
        fh.write(f"-- Generated at: {generated_at}\n\n")
        fh.write("BEGIN;\n\n")

        sqlite_tables = {
            row["name"]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            ).fetchall()
        }

        for table in metadata.sorted_tables:
            if table.name not in sqlite_tables:
                continue

            rows = conn.execute(f'SELECT * FROM "{table.name}"').fetchall()
            table_counts[table.name] = len(rows)
            if not rows:
                continue

            columns = [column for column in table.columns if column.name in rows[0].keys()]
            if not columns:
                continue

            fh.write(f"-- Data: {table.name} ({len(rows)} rows)\n")
            column_sql = ", ".join(_quote_ident(column.name) for column in columns)
            table_sql = _quote_ident(table.name)

            for row in rows:
                values_sql = ", ".join(
                    _to_sql_literal(row[column.name], column) for column in columns
                )
                fh.write(f"INSERT INTO {table_sql} ({column_sql}) VALUES ({values_sql});\n")

            fh.write("\n")

        for table in metadata.sorted_tables:
            if table.name not in sqlite_tables:
                continue
            if not _table_has_serial_id(table):
                continue

            table_sql = _quote_ident(table.name)
            fh.write(
                "SELECT setval("
                f"pg_get_serial_sequence('public.{table_sql}', 'id'), "
                f"COALESCE((SELECT MAX({_quote_ident('id')}) FROM {table_sql}), 1), "
                f"(SELECT MAX({_quote_ident('id')}) IS NOT NULL FROM {table_sql})"
                ");\n"
            )

        fh.write("\nCOMMIT;\n")

    with COUNTS_MD_PATH.open("w", encoding="utf-8") as fh:
        generated_at = datetime.now(timezone.utc).isoformat()
        fh.write("# Source SQLite Counts\n\n")
        fh.write(f"Generated at: `{generated_at}`\n\n")
        fh.write("| Table | Rows |\n")
        fh.write("|---|---:|\n")
        for table_name in sorted(table_counts.keys()):
            fh.write(f"| `{table_name}` | {table_counts[table_name]} |\n")


def main():
    if not SQLITE_DB_PATH.exists():
        raise FileNotFoundError(f"SQLite database not found: {SQLITE_DB_PATH}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    sys.path.insert(0, str(BASE_DIR))
    from app.models import db  # noqa: WPS433
    import app.models  # noqa: F401,WPS433

    metadata = db.metadata

    export_schema(metadata)
    export_data(metadata)

    print(f"Schema SQL: {SCHEMA_SQL_PATH}")
    print(f"Data SQL:   {DATA_SQL_PATH}")
    print(f"Counts MD:  {COUNTS_MD_PATH}")


if __name__ == "__main__":
    main()
