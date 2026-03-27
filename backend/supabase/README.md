# Supabase Migration (PostgreSQL)

Этот каталог содержит SQL для переноса текущей SQLite-базы в Supabase Postgres.

## Файлы

- `01_schema.sql` — схема таблиц PostgreSQL.
- `02_data.sql` — данные из `backend/database.db`.

## Обновить SQL из текущей SQLite

```bash
cd backend
python scripts/export_supabase_sql.py
```

## Импорт в Supabase

Вариант A (Supabase SQL Editor):

1. Открой `01_schema.sql` и выполни.
2. Открой `02_data.sql` и выполни.

Вариант B (`psql`):

```bash
psql "postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?sslmode=require" -f backend/supabase/01_schema.sql
psql "postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?sslmode=require" -f backend/supabase/02_data.sql
```

Вариант C (готовый скрипт):

```bash
cd backend
export DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?sslmode=require"
./scripts/apply_supabase_sql.sh
```

## Настройка backend

В `backend/.env` укажи:

```env
DATABASE_URL=postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?sslmode=require
STORAGE_BACKEND=supabase
SUPABASE_URL=https://<PROJECT_REF>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
SUPABASE_STORAGE_BUCKET=edu-kernel
SUPABASE_STORAGE_PREFIX=uploads
SUPABASE_STORAGE_PUBLIC=true
SUPABASE_STORAGE_AUTO_CREATE_BUCKET=true
```

`config.py` уже поддерживает `DATABASE_URL`.

## Что уже работает в Supabase-режиме backend

- SQLAlchemy подключается к Supabase Postgres через `DATABASE_URL`.
- Все новые загрузки backend уходят в Supabase Storage (если `STORAGE_BACKEND=supabase`):
  - аватары (`/users/avatar`)
  - чат-файлы (`/chat/media`)
  - поддержка (`/support/media`)
  - домашние задания (`/homework/media`)
  - новости (`/news/image`)
  - библиотека (файлы/обложки книг)
- Старые локальные пути остаются совместимыми: роуты медиа сначала читают локальный файл, затем делают redirect на Supabase объект.

## Минимальный запуск backend с Supabase

```bash
cd backend
cp .env.supabase.example .env
# отредактируй .env: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
source .venv/bin/activate
pip install -r requirements.txt
./scripts/apply_supabase_sql.sh
python scripts/migrate_uploads_to_supabase.py
python run.py
```

## Проверка сохранности данных

Сверьте количества строк после импорта с файлом:

- `backend/supabase/03_source_counts.md`
