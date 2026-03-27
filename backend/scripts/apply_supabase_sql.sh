#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_SQL="${ROOT_DIR}/supabase/01_schema.sql"
DATA_SQL="${ROOT_DIR}/supabase/02_data.sql"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed. Using Python fallback (psycopg)."
  if [[ -x "${ROOT_DIR}/.venv/bin/python" ]]; then
    "${ROOT_DIR}/.venv/bin/python" "${ROOT_DIR}/scripts/apply_supabase_sql.py"
    exit $?
  fi
  if command -v python >/dev/null 2>&1; then
    python "${ROOT_DIR}/scripts/apply_supabase_sql.py"
    exit $?
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 "${ROOT_DIR}/scripts/apply_supabase_sql.py"
    exit $?
  fi
  echo "Neither psql nor python/python3 found."
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]] && [[ -f "${ROOT_DIR}/.env" ]]; then
  # Load backend/.env for local usage (psql path)
  set -a
  # shellcheck source=/dev/null
  source "${ROOT_DIR}/.env"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set."
  echo "Export your Supabase Postgres URL and run again."
  exit 1
fi

echo "Applying schema: ${SCHEMA_SQL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${SCHEMA_SQL}"

echo "Applying data: ${DATA_SQL}"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${DATA_SQL}"

echo "Done."
