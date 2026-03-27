# Файл: `backend/app/routes/attendance.py`

## Что это
Маршруты посещаемости.

## Эндпоинты
- `POST /attendance` — отметить посещаемость.
- `GET /attendance/<student_ref>` — история посещаемости студента.

## Простыми словами
Преподаватель отправляет отметку (`present`, `absent`, `late`) по студенту и дате.

## Права
- Вносить: teacher/admin.
- Смотреть: admin/teacher/student.
- Студент может смотреть только свои записи.
