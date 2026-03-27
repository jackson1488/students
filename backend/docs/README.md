# Backend Docs (для новичка)

Эта папка — «человеческое» описание backend-кода.

Принцип: для каждого Python-файла есть markdown-дубль с тем же путем и именем + `.md`.

## Карта документации

### Корень backend
- [config.py.md](./config.py.md)
- [run.py.md](./run.py.md)

### app/
- [app/__init__.py.md](./app/__init__.py.md)
- [app/extensions.py.md](./app/extensions.py.md)

### app/middleware/
- [app/middleware/__init__.py.md](./app/middleware/__init__.py.md)
- [app/middleware/auth.py.md](./app/middleware/auth.py.md)

### app/models/
- [app/models/__init__.py.md](./app/models/__init__.py.md)
- [app/models/entities.py.md](./app/models/entities.py.md)

### app/routes/
- [app/routes/__init__.py.md](./app/routes/__init__.py.md)
- [app/routes/academy.py.md](./app/routes/academy.py.md)
- [app/routes/attendance.py.md](./app/routes/attendance.py.md)
- [app/routes/auth.py.md](./app/routes/auth.py.md)
- [app/routes/books.py.md](./app/routes/books.py.md)
- [app/routes/chat.py.md](./app/routes/chat.py.md)
- [app/routes/exports.py.md](./app/routes/exports.py.md)
- [app/routes/grades.py.md](./app/routes/grades.py.md)
- [app/routes/homework.py.md](./app/routes/homework.py.md)
- [app/routes/news.py.md](./app/routes/news.py.md)
- [app/routes/schedule.py.md](./app/routes/schedule.py.md)
- [app/routes/support.py.md](./app/routes/support.py.md)
- [app/routes/tests.py.md](./app/routes/tests.py.md)
- [app/routes/users.py.md](./app/routes/users.py.md)

### app/services/
- [app/services/__init__.py.md](./app/services/__init__.py.md)
- [app/services/auth_service.py.md](./app/services/auth_service.py.md)

### app/utils/
- [app/utils/__init__.py.md](./app/utils/__init__.py.md)
- [app/utils/reset_db.py.md](./app/utils/reset_db.py.md)
- [app/utils/seed_pcs_demo.py.md](./app/utils/seed_pcs_demo.py.md)
- [app/utils/student_identity.py.md](./app/utils/student_identity.py.md)
- [app/utils/validation.py.md](./app/utils/validation.py.md)

## Как читать
1. Начните с `config.py.md` и `run.py.md`.
2. Потом откройте `app/__init__.py.md` (как собирается система).
3. Далее `models/entities.py.md` (какие таблицы в БД).
4. После этого изучайте `routes/*.py.md` (какие есть API).
