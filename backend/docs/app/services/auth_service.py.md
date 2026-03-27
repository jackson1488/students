# Файл: `backend/app/services/auth_service.py`

## Что это
Сервис для паролей и JWT.

## Простыми словами
Этот файл умеет:
- превращать пароль в защищенный хэш,
- проверять пароль,
- выдавать JWT,
- читать JWT.

## Основные функции
- `hash_password(raw_password)` — хэширует пароль через `bcrypt`.
- `verify_password(raw_password, hashed_password)` — сравнивает пароль и хэш.
- `generate_jwt(user_id, role, login)` — создает токен с `iat/exp`.
- `decode_jwt(token)` — проверяет подпись и возвращает payload.

## Где используется
Практически во всей авторизации (`/login`, middleware и т.д.).
