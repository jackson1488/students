"""
Модуль `app/routes/users.py`

Назначение:
- API пользователей и личного профиля: CRUD, аватар, смена пароля.

Ключевые константы и значения:
- `ALLOWED_AVATAR_EXTENSIONS`: используется как конфигурационный или справочный набор значений в этом модуле.
- `VALID_ROLES`: используется как конфигурационный или справочный набор значений в этом модуле.

Маршруты HTTP (если это route-модуль):
- `GET /users/avatar/<path:filename>` -> `get_user_avatar`
- `POST /users` -> `create_user`
- `GET /users` -> `list_users`
- `DELETE /users/<int:user_id>` -> `delete_user`
- `GET /users/me` -> `get_me`
- `GET /users/me/details` -> `get_me_details`
- `PUT /users/me/details` -> `update_me_details`
- `POST /users/avatar` -> `update_avatar`
- `POST /users/change-password` -> `change_password`

Функции модуля:
- `_avatar_root`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_build_public_url`: Формирует служебную структуру данных/ответ.
- `_save_avatar_image`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_full_name`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_normalize_birth_date`: Нормализует и приводит значения к безопасному формату.
- `_profile_details_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_user_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `get_user_avatar`: Возвращает данные по запросу.
- `create_user`: Создает новую сущность или запись.
- `list_users`: Возвращает список элементов.
- `delete_user`: Удаляет сущность или помечает ее удаленной.
- `get_me`: Возвращает данные по запросу.
- `get_me_details`: Возвращает данные по запросу.
- `update_me_details`: Обновляет существующую сущность.
- `update_avatar`: Обновляет существующую сущность.
- `change_password`: Содержит бизнес-логику модуля и используется в общем потоке работы API.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

import os
from datetime import datetime

from flask import Blueprint, current_app, g, jsonify, redirect, request, send_from_directory
from werkzeug.utils import secure_filename

from app.middleware.auth import roles_required, token_required
from app.models import StudentProfile, StudyGroup, TeacherProfile, User, db
from app.services.auth_service import hash_password, verify_password
from app.services.storage_service import save_uploaded_file, supabase_public_object_url
from app.utils.student_identity import extract_student_code


users_bp = Blueprint("users", __name__)


VALID_ROLES = {"admin", "teacher", "student", "scheduler", "rector"}
ALLOWED_AVATAR_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def _avatar_root():
    uploads_root = os.path.dirname(current_app.config["UPLOAD_FOLDER"])
    folder = os.path.join(uploads_root, "avatars")
    os.makedirs(folder, exist_ok=True)
    return folder


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


def _save_avatar_image(image_file):
    file_name = secure_filename(image_file.filename or "")
    ext = os.path.splitext(file_name)[1].lower()
    if ext not in ALLOWED_AVATAR_EXTENSIONS:
        return None, "Only jpg, jpeg, png, webp are allowed"

    try:
        avatar_url = save_uploaded_file(
            image_file,
            folder="avatars",
            local_route_prefix="/users/avatar",
        )
    except ValueError as exc:
        return None, str(exc)
    except RuntimeError as exc:
        return None, str(exc)

    return avatar_url, None


def _full_name(user):
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


def _normalize_birth_date(value):
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        datetime.strptime(raw, "%Y-%m-%d")
    except ValueError:
        return None
    return raw


def _profile_details_payload(user):
    base = _user_payload(user)

    if user.role == "teacher":
        profile = TeacherProfile.query.filter_by(user_id=user.id).first()
        subjects = profile.get_subjects() if profile else []
        base["details"] = {
            "birth_date": profile.birth_date if profile else None,
            "biography": profile.biography if profile else None,
            "subjects": subjects,
        }
        return base

    if user.role == "student":
        profile = StudentProfile.query.filter_by(user_id=user.id).first()
        group = StudyGroup.query.get(profile.group_ref_id) if profile else None
        base["details"] = {
            "birth_date": profile.birth_date if profile else None,
            "biography": profile.biography if profile else None,
            "group_name": group.name if group else user.group_id,
            "admission_year": group.admission_year if group else None,
            "specialty": group.specialty if group else None,
        }
        return base

    base["details"] = {}
    return base


def _user_payload(user):
    payload = user.to_dict()
    if user.role == "student":
        payload["student_code"] = extract_student_code(user.login)
    payload["avatar_url"] = _build_public_url(payload.get("avatar_url"))
    payload["full_name"] = _full_name(user)
    return payload


@users_bp.get("/users/avatar/<path:filename>")
def get_user_avatar(filename: str):
    local_path = os.path.join(_avatar_root(), filename)
    if os.path.exists(local_path):
        return send_from_directory(_avatar_root(), filename)

    remote_url = supabase_public_object_url("avatars", filename)
    if remote_url:
        return redirect(remote_url, code=302)

    return jsonify({"error": "Avatar not found"}), 404


@users_bp.post("/users")
@roles_required("admin")
def create_user():
    data = request.get_json(silent=True) or {}
    login_value = data.get("login")
    password = data.get("password")
    role = data.get("role")
    group_id = data.get("group_id")

    if not login_value or not password or not role:
        return jsonify({"error": "login, password, role are required"}), 400

    if role not in VALID_ROLES:
        return jsonify({"error": "Invalid role"}), 400

    if User.query.filter_by(login=login_value).first():
        return jsonify({"error": "User with this login already exists"}), 409

    user = User(
        login=login_value,
        password_hash=hash_password(password),
        role=role,
        group_id=group_id,
    )
    db.session.add(user)
    db.session.commit()

    return jsonify(_user_payload(user)), 201


@users_bp.get("/users")
@roles_required("admin")
def list_users():
    users = User.query.order_by(User.id.asc()).all()
    return jsonify([_user_payload(user) for user in users]), 200


@users_bp.delete("/users/<int:user_id>")
@roles_required("admin")
def delete_user(user_id: int):
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    db.session.delete(user)
    db.session.commit()
    return jsonify({"status": "deleted"}), 200


@users_bp.get("/users/me")
@token_required
def get_me():
    return jsonify(_user_payload(g.current_user)), 200


@users_bp.get("/users/me/details")
@token_required
def get_me_details():
    return jsonify(_profile_details_payload(g.current_user)), 200


@users_bp.put("/users/me/details")
@token_required
def update_me_details():
    user = g.current_user
    data = request.get_json(silent=True) or {}

    if user.role == "teacher":
        profile = TeacherProfile.query.filter_by(user_id=user.id).first()
        if not profile:
            return jsonify({"error": "Teacher profile not found"}), 404

        if "birth_date" in data:
            raw_birth = str(data.get("birth_date") or "").strip()
            birth_date = _normalize_birth_date(raw_birth)
            if raw_birth and not birth_date:
                return jsonify({"error": "birth_date must be YYYY-MM-DD"}), 400
            profile.birth_date = birth_date

        if "biography" in data:
            profile.biography = str(data.get("biography") or "").strip() or None

        db.session.commit()
        return jsonify(_profile_details_payload(user)), 200

    if user.role == "student":
        profile = StudentProfile.query.filter_by(user_id=user.id).first()
        if not profile:
            return jsonify({"error": "Student profile not found"}), 404

        if "birth_date" in data:
            raw_birth = str(data.get("birth_date") or "").strip()
            birth_date = _normalize_birth_date(raw_birth)
            if raw_birth and not birth_date:
                return jsonify({"error": "birth_date must be YYYY-MM-DD"}), 400
            profile.birth_date = birth_date

        if "biography" in data:
            profile.biography = str(data.get("biography") or "").strip() or None

        db.session.commit()
        return jsonify(_profile_details_payload(user)), 200

    return jsonify({"error": "Only teacher and student profiles can be updated"}), 400


@users_bp.post("/users/avatar")
@token_required
def update_avatar():
    image_file = request.files.get("image")
    if image_file is None or not image_file.filename:
        return jsonify({"error": "image file is required"}), 400

    avatar_url, error_text = _save_avatar_image(image_file)
    if error_text:
        return jsonify({"error": error_text}), 400

    current_user = g.current_user
    current_user.avatar_url = avatar_url
    db.session.commit()

    return jsonify({"avatar_url": _build_public_url(current_user.avatar_url), "user": _user_payload(current_user)}), 200


@users_bp.post("/users/change-password")
@token_required
def change_password():
    data = request.get_json(silent=True) or {}
    old_password = str(data.get("old_password") or "").strip()
    new_password = str(data.get("new_password") or "").strip()

    if not old_password or not new_password:
        return jsonify({"error": "old_password and new_password are required"}), 400

    if len(new_password) < 6:
        return jsonify({"error": "new_password must be at least 6 characters"}), 400

    current_user = g.current_user

    if not verify_password(old_password, current_user.password_hash):
        return jsonify({"error": "Old password is incorrect"}), 401

    current_user.password_hash = hash_password(new_password)
    db.session.commit()

    return jsonify({"status": "password_changed"}), 200
