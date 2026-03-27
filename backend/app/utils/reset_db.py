"""
Модуль `app/utils/reset_db.py`

Назначение:
- Сброс и восстановление SQLite базы в разных режимах (full/schema/demo).

Ключевые константы и значения:
- `BACKEND_DIR`: используется как конфигурационный или справочный набор значений в этом модуле.
- `DB_PATH`: используется как конфигурационный или справочный набор значений в этом модуле.
- `SQL_DIR`: используется как конфигурационный или справочный набор значений в этом модуле.

Функции модуля:
- `_delete_db`: Удаляет сущность или помечает ее удаленной.
- `_run_sql_script`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_seed_demo`: Заполняет систему начальными данными.
- `main`: Точка входа сценария при запуске файла как скрипта.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

import argparse
import sqlite3
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[2]
DB_PATH = BACKEND_DIR / "database.db"
SQL_DIR = BACKEND_DIR / "sql"


def _delete_db():
    if DB_PATH.exists():
        DB_PATH.unlink()


def _run_sql_script(script_path: Path):
    if not script_path.exists():
        raise FileNotFoundError(f"SQL file not found: {script_path}")

    sql = script_path.read_text(encoding="utf-8")
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(sql)
        conn.commit()


def _seed_demo():
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))
    from app.utils.seed_pcs_demo import main as seed_demo_main

    seed_demo_main()


def main():
    parser = argparse.ArgumentParser(
        description="Reset and restore EDU Kernel SQLite database.",
    )
    parser.add_argument(
        "--mode",
        choices=["full", "schema", "demo"],
        default="full",
        help="full: restore from full_backup.sql, schema: schema only, demo: recreate and seed pcs-1-23 demo data",
    )
    args = parser.parse_args()

    _delete_db()

    if args.mode == "full":
        _run_sql_script(SQL_DIR / "full_backup.sql")
        print(f"DB restored from: {SQL_DIR / 'full_backup.sql'}")
        return

    if args.mode == "schema":
        _run_sql_script(SQL_DIR / "schema.sql")
        print(f"DB schema restored from: {SQL_DIR / 'schema.sql'}")
        return

    # demo mode
    _seed_demo()
    print("DB recreated and demo data seeded (pcs-1-23).")


if __name__ == "__main__":
    main()
