"""
Модуль `app/routes/auth.py`

Назначение:
- API аутентификации: вход и impersonate (вход от имени пользователя).

Маршруты HTTP (если это route-модуль):
- `POST /login` -> `login`
- `POST /auth/impersonate` -> `impersonate`

Функции модуля:
- `_build_public_url`: Формирует служебную структуру данных/ответ.
- `_resolve_full_name`: Определяет/находит нужный объект по входным параметрам.
- `_build_auth_payload`: Формирует служебную структуру данных/ответ.
- `login`: Обрабатывает авторизацию пользователя.
- `impersonate`: Позволяет администратору войти от имени другого пользователя.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

from app.middleware.auth import token_required
from app.models import StudentProfile, TeacherProfile, User
from app.services.auth_service import generate_jwt, verify_password


auth_bp = Blueprint("auth", __name__)


def _build_public_url(value):
    raw = str(value or "").strip()
    if not raw:
        return None

    if raw.startswith(("http://", "https://")):
        return raw

    if raw.startswith(("users/", "chat/", "support/", "uploads/")):
        return f"{request.host_url.rstrip('/')}/{raw.lstrip('/')}"

    if raw.startswith("/"):
        return f"{request.host_url.rstrip('/')}{raw}"

    return raw


def _resolve_full_name(user: User):
    if user.role == "teacher":
        profile = TeacherProfile.query.filter_by(user_id=user.id).first()
        if profile:
            return " ".join(
                [part for part in [profile.last_name, profile.first_name, profile.middle_name] if part]
            ).strip() or None

    if user.role == "student":
        profile = StudentProfile.query.filter_by(user_id=user.id).first()
        if profile:
            return " ".join(
                [part for part in [profile.last_name, profile.first_name, profile.middle_name] if part]
            ).strip() or None

    return None


def _build_auth_payload(user: User):
    return {
        "token": generate_jwt(user.id, user.role, user.login),
        "role": user.role,
        "user_id": user.id,
        "login": user.login,
        "group_id": user.group_id,
        "full_name": _resolve_full_name(user),
        "avatar_url": _build_public_url(user.avatar_url),
    }


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    login_value = str(data.get("login") or "").strip()
    password = str(data.get("password") or "").strip()

    if not login_value or not password:
        return jsonify({"error": "login and password are required"}), 400

    user = User.query.filter(func.lower(User.login) == login_value.lower()).first()
    if not user or not verify_password(password, user.password_hash):
        return jsonify({"error": "Invalid credentials"}), 401

    return jsonify(_build_auth_payload(user)), 200


@auth_bp.post("/auth/impersonate")
@token_required
def impersonate():
    actor = g.current_user
    if actor.role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    target_user_id = data.get("user_id")

    try:
        target_user_id = int(target_user_id)
    except (TypeError, ValueError):
        return jsonify({"error": "user_id is required"}), 400

    target_user = User.query.get(target_user_id)
    if not target_user:
        return jsonify({"error": "User not found"}), 404

    if target_user.role == "admin":
        return jsonify({"error": "Cannot impersonate admin"}), 400

    payload = _build_auth_payload(target_user)
    payload["impersonated_by_admin"] = True
    payload["impersonator_login"] = actor.login
    payload["impersonator_user_id"] = actor.id
    return jsonify(payload), 200
