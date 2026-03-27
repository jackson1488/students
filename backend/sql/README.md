# SQL Recovery Guide

Эта папка хранит файлы для восстановления SQLite базы `backend/database.db`.

## Файлы

- `schema.sql`  
  Только структура таблиц (без данных).

- `full_backup.sql`  
  Полный дамп: структура + данные.

## Когда какой файл использовать

- Нужна пустая база с таблицами:  
  `python backend/app/utils/reset_db.py --mode schema`

- Нужно восстановить текущее состояние один-в-один:  
  `python backend/app/utils/reset_db.py --mode full`

- Нужен быстрый тестовый набор с группой `pcs-1-23`, преподавателями, студентами, расписанием и тестами:  
  `python backend/app/utils/reset_db.py --mode demo`

## Ручное восстановление через sqlite3

### Полный дамп

```bash
rm -f backend/database.db
sqlite3 backend/database.db < backend/sql/full_backup.sql
```

### Только схема

```bash
rm -f backend/database.db
sqlite3 backend/database.db < backend/sql/schema.sql
```

## Важно

Перед восстановлением остановите backend-сервер, иначе файл БД может быть занят процессом.

