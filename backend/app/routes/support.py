"""
Модуль `app/routes/support.py`

Назначение:
- API поддержки: диалог пользователей с администратором, вложения.

Ключевые константы и значения:
- `ALLOWED_ATTACHMENT_EXTENSIONS`: используется как конфигурационный или справочный набор значений в этом модуле.

Маршруты HTTP (если это route-модуль):
- `GET /support/media/<path:filename>` -> `get_support_media`
- `POST /support/send` -> `send_support_message`
- `GET /support/contacts` -> `get_support_contacts`
- `GET /support/messages` -> `get_support_messages`

Функции модуля:
- `_full_name`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_collect_profiles`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_contact_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_find_admin_for_user`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_media_root`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_build_public_attachment_url`: Формирует служебную структуру данных/ответ.
- `_as_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_save_support_attachment`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `get_support_media`: Возвращает данные по запросу.
- `send_support_message`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `get_support_contacts`: Возвращает данные по запросу.
- `get_support_messages`: Возвращает данные по запросу.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

import os
from datetime import datetime

from flask import Blueprint, current_app, g, jsonify, redirect, request, send_from_directory
from sqlalchemy import or_
from werkzeug.utils import secure_filename

from app.middleware.auth import token_required
from app.models import StudentProfile, SupportMessage, TeacherProfile, User, db
from app.services.storage_service import save_uploaded_file, supabase_public_object_url


support_bp = Blueprint("support", __name__)
ALLOWED_ATTACHMENT_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".txt",
    ".zip",
    ".rar",
    ".7z",
    ".csv",
}


def _full_name(last_name, first_name, middle_name):
    return " ".join([part for part in [last_name, first_name, middle_name] if part]).strip()


def _collect_profiles(user_ids):
    if not user_ids:
        return {}, {}

    teacher_profiles = TeacherProfile.query.filter(TeacherProfile.user_id.in_(user_ids)).all()
    student_profiles = StudentProfile.query.filter(StudentProfile.user_id.in_(user_ids)).all()
    return (
        {row.user_id: row for row in teacher_profiles},
        {row.user_id: row for row in student_profiles},
    )


def _contact_payload(user, teacher_profiles, student_profiles):
    display_name = user.login

    if user.role == "teacher":
        profile = teacher_profiles.get(user.id)
        if profile:
            display_name = _full_name(profile.last_name, profile.first_name, profile.middle_name) or user.login
    elif user.role == "student":
        profile = student_profiles.get(user.id)
        if profile:
            display_name = _full_name(profile.last_name, profile.first_name, profile.middle_name) or user.login

    return {
        "id": user.id,
        "login": user.login,
        "role": user.role,
        "group_id": user.group_id,
        "name": display_name,
        "avatar_url": _build_public_attachment_url(user.avatar_url),
    }


def _find_admin_for_user(current_user: User):
    query = User.query.filter_by(role="admin")

    if current_user and current_user.role == "admin":
        return current_user

    return query.order_by(User.id.asc()).first()


def _media_root():
    uploads_root = os.path.dirname(current_app.config["UPLOAD_FOLDER"])
    folder = os.path.join(uploads_root, "support_media")
    os.makedirs(folder, exist_ok=True)
    return folder


def _build_public_attachment_url(value):
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


def _as_payload(row: SupportMessage):
    payload = row.to_dict()
    payload["attachment_url"] = _build_public_attachment_url(payload.get("attachment_url"))
    return payload


def _save_support_attachment(upload_file):
    file_name = secure_filename(upload_file.filename or "")
    ext = os.path.splitext(file_name)[1].lower()
    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        return None, None, "Unsupported file type"

    try:
        attachment_url = save_uploaded_file(
            upload_file,
            folder="support_media",
            local_route_prefix="/support/media",
        )
    except ValueError as exc:
        return None, None, str(exc)
    except RuntimeError as exc:
        return None, None, str(exc)

    mime = str(upload_file.mimetype or "").lower()
    attachment_type = "image" if mime.startswith("image/") else "file"
    return attachment_url, attachment_type, None


@support_bp.get("/support/media/<path:filename>")
def get_support_media(filename: str):
    local_path = os.path.join(_media_root(), filename)
    if os.path.exists(local_path):
        return send_from_directory(_media_root(), filename)

    remote_url = supabase_public_object_url("support_media", filename)
    if remote_url:
        return redirect(remote_url, code=302)

    return jsonify({"error": "File not found"}), 404


@support_bp.post("/support/send")
@token_required
def send_support_message():
    if request.content_type and request.content_type.startswith("multipart/form-data"):
        text = str(request.form.get("message") or "").strip()
        receiver_id = request.form.get("receiver_id")
        image_file = request.files.get("image")
        generic_file = request.files.get("file")
    else:
        data = request.get_json(silent=True) or {}
        text = str(data.get("message") or "").strip()
        receiver_id = data.get("receiver_id")
        image_file = None
        generic_file = None

    attachment_file = image_file if image_file and image_file.filename else generic_file
    sender = g.current_user
    if not text and attachment_file is None:
        return jsonify({"error": "message or file is required"}), 400

    if sender.role == "admin":
        if not receiver_id:
            return jsonify({"error": "receiver_id is required for admin"}), 400

        receiver = User.query.get(receiver_id)
        if not receiver:
            return jsonify({"error": "Receiver not found"}), 404
        if receiver.role == "admin":
            return jsonify({"error": "Support recipient must not be admin"}), 400
    else:
        if receiver_id:
            receiver = User.query.get(receiver_id)
            if not receiver:
                return jsonify({"error": "Receiver not found"}), 404
            if receiver.role != "admin":
                return jsonify({"error": "Support receiver must be admin"}), 403
        else:
            receiver = _find_admin_for_user(sender)
            if not receiver:
                return jsonify({"error": "Admin is not available"}), 404

    attachment_url = None
    attachment_type = None
    if attachment_file is not None and attachment_file.filename:
        attachment_url, attachment_type, error_text = _save_support_attachment(attachment_file)
        if error_text:
            return jsonify({"error": error_text}), 400

    row = SupportMessage(
        sender_id=sender.id,
        receiver_id=receiver.id,
        message=text,
        attachment_url=attachment_url,
        attachment_type=attachment_type,
    )
    db.session.add(row)
    db.session.commit()

    return jsonify(_as_payload(row)), 201


@support_bp.get("/support/contacts")
@token_required
def get_support_contacts():
    current_user = g.current_user

    if current_user.role == "admin":
        contacts = (
            User.query.filter(User.role != "admin")
            .order_by(User.role.asc(), User.login.asc())
            .all()
        )
    else:
        contacts = User.query.filter_by(role="admin").order_by(User.login.asc()).all()

    user_ids = [row.id for row in contacts]
    teacher_profiles, student_profiles = _collect_profiles(user_ids)
    payload = [_contact_payload(row, teacher_profiles, student_profiles) for row in contacts]
    payload.sort(key=lambda item: (item["role"], item["name"].lower()))
    return jsonify(payload), 200


@support_bp.get("/support/messages")
@token_required
def get_support_messages():
    current_user = g.current_user
    with_user_id = request.args.get("with_user_id", type=int)

    if current_user.role == "admin":
        if with_user_id:
            target = User.query.get(with_user_id)
            if not target:
                return jsonify({"error": "User not found"}), 404
            if target.role == "admin":
                return jsonify({"error": "Conversation target must not be admin"}), 400

            rows = (
                SupportMessage.query.filter(
                    or_(
                        (SupportMessage.sender_id == current_user.id)
                        & (SupportMessage.receiver_id == target.id),
                        (SupportMessage.sender_id == target.id)
                        & (SupportMessage.receiver_id == current_user.id),
                    )
                )
                .order_by(SupportMessage.created_at.asc())
                .all()
            )
        else:
            rows = (
                SupportMessage.query.filter(
                    or_(
                        SupportMessage.sender_id == current_user.id,
                        SupportMessage.receiver_id == current_user.id,
                    )
                )
                .order_by(SupportMessage.created_at.asc())
                .all()
            )
    else:
        admin = _find_admin_for_user(current_user)
        if not admin:
            return jsonify({"error": "Admin is not available"}), 404

        if with_user_id and with_user_id != admin.id:
            return jsonify({"error": "Forbidden"}), 403

        rows = (
            SupportMessage.query.filter(
                or_(
                    (SupportMessage.sender_id == current_user.id)
                    & (SupportMessage.receiver_id == admin.id),
                    (SupportMessage.sender_id == admin.id)
                    & (SupportMessage.receiver_id == current_user.id),
                )
            )
            .order_by(SupportMessage.created_at.asc())
            .all()
        )

    return jsonify([_as_payload(row) for row in rows]), 200
