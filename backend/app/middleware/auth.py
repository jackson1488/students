"""
Модуль `app/middleware/auth.py`

Назначение:
- Проверка JWT токена и ролевого доступа к API.

Функции модуля:
- `token_required`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `roles_required`: Содержит бизнес-логику модуля и используется в общем потоке работы API.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

from functools import wraps

import jwt
from flask import g, jsonify, request

from app.models import User
from app.services.auth_service import decode_jwt


def token_required(handler):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization token is missing"}), 401

        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            return jsonify({"error": "Authorization token is missing"}), 401

        try:
            payload = decode_jwt(token)
            user_id = int(payload.get("sub"))
            user = User.query.get(user_id)
            if not user:
                return jsonify({"error": "User not found"}), 401
            g.current_user = user
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid token payload"}), 401

        return handler(*args, **kwargs)

    return wrapper


def roles_required(*allowed_roles):
    def decorator(handler):
        @wraps(handler)
        @token_required
        def wrapper(*args, **kwargs):
            user = g.current_user
            if user.role == "admin" or user.role in allowed_roles:
                return handler(*args, **kwargs)
            return jsonify({"error": "Forbidden"}), 403

        return wrapper

    return decorator
