"""
Модуль `app/services/auth_service.py`

Назначение:
- Сервис для хеширования паролей и работы с JWT.

Функции модуля:
- `hash_password`: Генерирует защищенное представление данных.
- `verify_password`: Проверяет корректность данных или условий доступа.
- `generate_jwt`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `decode_jwt`: Декодирует входное значение в рабочую структуру.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

from datetime import datetime, timezone

import bcrypt
import jwt
from flask import current_app


def hash_password(raw_password: str) -> str:
    return bcrypt.hashpw(raw_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(raw_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(raw_password.encode("utf-8"), hashed_password.encode("utf-8"))


def generate_jwt(user_id: int, role: str, login: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "login": login,
        "iat": now,
        "exp": now + current_app.config["JWT_EXPIRES_IN"],
    }
    return jwt.encode(
        payload,
        current_app.config["SECRET_KEY"],
        algorithm=current_app.config["JWT_ALGORITHM"],
    )


def decode_jwt(token: str) -> dict:
    return jwt.decode(
        token,
        current_app.config["SECRET_KEY"],
        algorithms=[current_app.config["JWT_ALGORITHM"]],
    )
