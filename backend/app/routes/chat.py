"""
Модуль `app/routes/chat.py`

Назначение:
- API чатов: личные сообщения, групповые комнаты, вложения и очистка диалогов.

Ключевые константы и значения:
- `ALLOWED_FILE_EXTENSIONS`: используется как конфигурационный или справочный набор значений в этом модуле.
- `ALLOWED_IMAGE_EXTENSIONS`: используется как конфигурационный или справочный набор значений в этом модуле.
- `GROUP_GENERAL_SUBJECT`: используется как конфигурационный или справочный набор значений в этом модуле.

Маршруты HTTP (если это route-модуль):
- `GET /chat/media/<path:filename>` -> `get_chat_media`
- `GET /chat/contacts` -> `get_chat_contacts`
- `GET /chat/group/rooms` -> `get_group_chat_rooms`
- `GET /chat/group/messages` -> `get_group_chat_messages`
- `POST /chat/group/send` -> `send_group_message`
- `POST /chat/send` -> `send_message`
- `GET /chat/messages` -> `get_messages`
- `DELETE /chat/messages/<int:message_id>` -> `delete_message_for_me`
- `POST /chat/messages/clear` -> `clear_chat_for_me`

Функции модуля:
- `_is_student_teacher_pair`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_full_name`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_media_root`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_build_public_attachment_url`: Формирует служебную структуру данных/ответ.
- `_as_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_as_group_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_extract_attachment_name`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_save_chat_attachment`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_find_group_by_name`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_is_general_subject`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_group_room_title`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_group_room_key`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_available_group_rooms_for_user`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_can_access_group_room`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_collect_profiles`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_contact_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_history_partner_ids`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_is_deleted_for_user`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_mark_deleted_for_user`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_is_chat_participant`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `get_chat_media`: Возвращает данные по запросу.
- `get_chat_contacts`: Возвращает данные по запросу.
- `get_group_chat_rooms`: Возвращает данные по запросу.
- `get_group_chat_messages`: Возвращает данные по запросу.
- `send_group_message`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `send_message`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `get_messages`: Возвращает данные по запросу.
- `delete_message_for_me`: Удаляет сущность или помечает ее удаленной.
- `clear_chat_for_me`: Содержит бизнес-логику модуля и используется в общем потоке работы API.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

import os
from datetime import datetime
from urllib.parse import unquote, urlparse

from flask import Blueprint, current_app, g, jsonify, redirect, request, send_from_directory
from sqlalchemy import func, or_
from werkzeug.utils import secure_filename

from app.middleware.auth import roles_required
from app.models import (
    ChatMessage,
    GroupChatMessage,
    StudentProfile,
    StudyGroup,
    TeacherGroupBinding,
    TeacherProfile,
    User,
    db,
)
from app.services.storage_service import save_uploaded_file, supabase_public_object_url


chat_bp = Blueprint("chat", __name__)
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_FILE_EXTENSIONS = {
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
    ".csv",
    ".json",
    ".md",
    ".zip",
    ".rar",
    ".7z",
}
GROUP_GENERAL_SUBJECT = "__general__"


def _is_student_teacher_pair(first_role: str, second_role: str) -> bool:
    return {first_role, second_role} == {"student", "teacher"}


def _full_name(last_name, first_name, middle_name):
    return " ".join([part for part in [last_name, first_name, middle_name] if part]).strip()


def _media_root():
    uploads_root = os.path.dirname(current_app.config["UPLOAD_FOLDER"])
    folder = os.path.join(uploads_root, "chat_media")
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


def _as_payload(row: ChatMessage):
    payload = row.to_dict()
    payload["attachment_url"] = _build_public_attachment_url(payload.get("attachment_url"))
    payload["attachment_name"] = _extract_attachment_name(payload.get("attachment_url"))
    payload["is_deleted_any"] = bool(payload.get("deleted_for_sender") or payload.get("deleted_for_receiver"))
    return payload


def _as_group_payload(row: GroupChatMessage, sender: User | None = None, teacher_profiles=None, student_profiles=None):
    payload = row.to_dict()
    payload["attachment_url"] = _build_public_attachment_url(payload.get("attachment_url"))
    payload["attachment_name"] = _extract_attachment_name(payload.get("attachment_url"))

    if sender is not None:
        payload["sender_login"] = sender.login
        payload["sender_avatar_url"] = _build_public_attachment_url(sender.avatar_url)
        payload["sender_name"] = _contact_payload(
            sender,
            teacher_profiles or {},
            student_profiles or {},
        ).get("name")
    else:
        payload["sender_login"] = None
        payload["sender_avatar_url"] = None
        payload["sender_name"] = None

    return payload


def _extract_attachment_name(value):
    raw = str(value or "").strip()
    if not raw:
        return None

    path = raw
    if raw.startswith(("http://", "https://")):
        parsed = urlparse(raw)
        path = parsed.path

    file_name = os.path.basename(path)
    if not file_name:
        return None

    readable = unquote(file_name)
    if "_" in readable:
        readable = readable.split("_", 1)[1]
    return readable


def _save_chat_attachment(upload_file):
    file_name = secure_filename(upload_file.filename or "")
    ext = os.path.splitext(file_name)[1].lower()
    if ext not in ALLOWED_FILE_EXTENSIONS:
        return None, None, "Unsupported file type"

    try:
        attachment_url = save_uploaded_file(
            upload_file,
            folder="chat_media",
            local_route_prefix="/chat/media",
        )
    except ValueError as exc:
        return None, None, str(exc)
    except RuntimeError as exc:
        return None, None, str(exc)

    attachment_type = "image" if ext in ALLOWED_IMAGE_EXTENSIONS else "file"
    return attachment_url, attachment_type, None


def _find_group_by_name(group_name):
    return StudyGroup.query.filter(func.lower(StudyGroup.name) == str(group_name).strip().lower()).first()


def _is_general_subject(subject):
    return str(subject or "").strip().lower() == GROUP_GENERAL_SUBJECT


def _group_room_title(subject):
    if _is_general_subject(subject):
        return "Group chat"
    return str(subject)


def _group_room_key(group_name, subject):
    return f"{group_name}::{subject}"


def _available_group_rooms_for_user(current_user):
    rooms = []

    if current_user.role == "student":
        if not current_user.group_id:
            return rooms
        group = _find_group_by_name(current_user.group_id)
        if not group:
            return rooms

        bindings = TeacherGroupBinding.query.filter_by(group_id=group.id).all()
        subjects = sorted({str(row.subject).strip() for row in bindings if str(row.subject).strip()})

        rooms.append({"group_id": group.name, "subject": GROUP_GENERAL_SUBJECT, "title": "Group chat"})
        for subject in subjects:
            rooms.append({"group_id": group.name, "subject": subject, "title": subject})

        return rooms

    if current_user.role == "teacher":
        bindings = TeacherGroupBinding.query.filter_by(teacher_id=current_user.id).all()
        if not bindings:
            return rooms

        group_ids = sorted({row.group_id for row in bindings})
        groups = StudyGroup.query.filter(StudyGroup.id.in_(group_ids)).all()
        group_map = {row.id: row for row in groups}

        seen = set()
        for row in bindings:
            group = group_map.get(row.group_id)
            if not group:
                continue

            general_key = _group_room_key(group.name, GROUP_GENERAL_SUBJECT)
            if general_key not in seen:
                rooms.append(
                    {
                        "group_id": group.name,
                        "subject": GROUP_GENERAL_SUBJECT,
                        "title": f"{group.name} • Group chat",
                    }
                )
                seen.add(general_key)

            subject = str(row.subject).strip()
            if not subject:
                continue
            key = _group_room_key(group.name, subject)
            if key in seen:
                continue

            rooms.append(
                {
                    "group_id": group.name,
                    "subject": subject,
                    "title": f"{group.name} • {subject}",
                }
            )
            seen.add(key)

        rooms.sort(key=lambda item: (str(item["group_id"]).lower(), str(item["subject"]).lower()))
        return rooms

    if current_user.role == "admin":
        bindings = TeacherGroupBinding.query.order_by(TeacherGroupBinding.group_id.asc()).all()
        if not bindings:
            return rooms

        group_ids = sorted({row.group_id for row in bindings})
        groups = StudyGroup.query.filter(StudyGroup.id.in_(group_ids)).all()
        group_map = {row.id: row for row in groups}

        seen = set()
        for row in bindings:
            group = group_map.get(row.group_id)
            if not group:
                continue

            general_key = _group_room_key(group.name, GROUP_GENERAL_SUBJECT)
            if general_key not in seen:
                rooms.append(
                    {
                        "group_id": group.name,
                        "subject": GROUP_GENERAL_SUBJECT,
                        "title": f"{group.name} • Group chat",
                    }
                )
                seen.add(general_key)

            subject = str(row.subject).strip()
            if not subject:
                continue

            key = _group_room_key(group.name, subject)
            if key in seen:
                continue
            rooms.append(
                {
                    "group_id": group.name,
                    "subject": subject,
                    "title": f"{group.name} • {subject}",
                }
            )
            seen.add(key)

        rooms.sort(key=lambda item: (str(item["group_id"]).lower(), str(item["subject"]).lower()))

    return rooms


def _can_access_group_room(current_user, group_name, subject):
    if not group_name or not subject:
        return False

    if current_user.role == "admin":
        return True

    group = _find_group_by_name(group_name)
    if not group:
        return False

    if current_user.role == "student":
        if str(current_user.group_id or "").strip().lower() != str(group.name).strip().lower():
            return False

        if _is_general_subject(subject):
            return True

        return (
            TeacherGroupBinding.query.filter_by(group_id=group.id, subject=str(subject).strip()).first() is not None
        )

    if current_user.role == "teacher":
        if _is_general_subject(subject):
            return TeacherGroupBinding.query.filter_by(group_id=group.id, teacher_id=current_user.id).first() is not None

        return (
            TeacherGroupBinding.query.filter_by(
                group_id=group.id,
                teacher_id=current_user.id,
                subject=str(subject).strip(),
            ).first()
            is not None
        )

    return False


def _collect_profiles(user_ids):
    if not user_ids:
        return {}, {}

    teacher_profiles = TeacherProfile.query.filter(TeacherProfile.user_id.in_(user_ids)).all()
    student_profiles = StudentProfile.query.filter(StudentProfile.user_id.in_(user_ids)).all()
    return (
        {row.user_id: row for row in teacher_profiles},
        {row.user_id: row for row in student_profiles},
    )


def _contact_payload(user, teacher_profiles, student_profiles, subjects_by_user=None):
    display_name = user.login
    subjects_by_user = subjects_by_user or {}

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
        "subjects": sorted({str(item).strip() for item in subjects_by_user.get(user.id, []) if str(item).strip()}),
    }


def _history_partner_ids(current_user_id):
    rows = (
        ChatMessage.query.filter(
            or_(
                ChatMessage.sender_id == current_user_id,
                ChatMessage.receiver_id == current_user_id,
            )
        )
        .order_by(ChatMessage.created_at.desc())
        .all()
    )

    partner_ids = set()
    for row in rows:
        partner_ids.add(row.receiver_id if row.sender_id == current_user_id else row.sender_id)
    return partner_ids


def _is_deleted_for_user(row: ChatMessage, user_id: int) -> bool:
    if int(row.sender_id) == int(user_id):
        return bool(row.deleted_for_sender)
    if int(row.receiver_id) == int(user_id):
        return bool(row.deleted_for_receiver)
    return False


def _mark_deleted_for_user(row: ChatMessage, user_id: int):
    now = datetime.utcnow()
    if int(row.sender_id) == int(user_id):
        row.deleted_for_sender = True
        row.deleted_at_sender = now
    elif int(row.receiver_id) == int(user_id):
        row.deleted_for_receiver = True
        row.deleted_at_receiver = now


def _is_chat_participant(row: ChatMessage, user_id: int) -> bool:
    return int(row.sender_id) == int(user_id) or int(row.receiver_id) == int(user_id)


@chat_bp.get("/chat/media/<path:filename>")
def get_chat_media(filename: str):
    local_path = os.path.join(_media_root(), filename)
    if os.path.exists(local_path):
        return send_from_directory(_media_root(), filename)

    remote_url = supabase_public_object_url("chat_media", filename)
    if remote_url:
        return redirect(remote_url, code=302)

    return jsonify({"error": "File not found"}), 404


@chat_bp.get("/chat/contacts")
@roles_required("student", "teacher", "admin")
def get_chat_contacts():
    current_user = g.current_user
    contacts = []
    subjects_by_user = {}

    if current_user.role == "student":
        teacher_ids = set()

        if current_user.group_id:
            group = StudyGroup.query.filter(
                func.lower(StudyGroup.name) == str(current_user.group_id).strip().lower()
            ).first()
            if group:
                bindings = TeacherGroupBinding.query.filter_by(group_id=group.id).all()
                for row in bindings:
                    teacher_ids.add(row.teacher_id)
                    subject_value = str(row.subject or "").strip()
                    if subject_value:
                        subjects_by_user.setdefault(row.teacher_id, set()).add(subject_value)

        if not teacher_ids:
            partners = _history_partner_ids(current_user.id)
            if partners:
                teacher_rows = User.query.filter(User.id.in_(partners), User.role == "teacher").all()
                teacher_ids = {row.id for row in teacher_rows}

        if teacher_ids:
            contacts = (
                User.query.filter(User.id.in_(teacher_ids), User.role == "teacher")
                .order_by(User.login.asc())
                .all()
            )

    elif current_user.role == "teacher":
        students = []
        group_names = []

        bindings = TeacherGroupBinding.query.filter_by(teacher_id=current_user.id).all()
        if bindings:
            group_ids = list({row.group_id for row in bindings})
            groups = StudyGroup.query.filter(StudyGroup.id.in_(group_ids)).all()
            group_names = [row.name for row in groups]

        if group_names:
            students = (
                User.query.filter(User.role == "student", User.group_id.in_(group_names))
                .order_by(User.login.asc())
                .all()
            )

        if not students:
            partners = _history_partner_ids(current_user.id)
            if partners:
                students = (
                    User.query.filter(User.id.in_(partners), User.role == "student")
                    .order_by(User.login.asc())
                    .all()
                )

        contacts = students

    elif current_user.role == "admin":
        contacts = (
            User.query.filter(User.role.in_(["teacher", "student"]))
            .order_by(User.role.asc(), User.login.asc())
            .all()
        )

    user_ids = [row.id for row in contacts]
    teacher_profiles, student_profiles = _collect_profiles(user_ids)

    for profile in teacher_profiles.values():
        fallback_subjects = profile.get_subjects()
        if fallback_subjects:
            subjects_by_user.setdefault(profile.user_id, set()).update(fallback_subjects)

    payload = [
        _contact_payload(
            row,
            teacher_profiles,
            student_profiles,
            subjects_by_user=subjects_by_user,
        )
        for row in contacts
    ]
    payload.sort(key=lambda item: (item["role"], item["name"].lower()))
    return jsonify(payload), 200


@chat_bp.get("/chat/group/rooms")
@roles_required("student", "teacher", "admin")
def get_group_chat_rooms():
    current_user = g.current_user
    rooms = _available_group_rooms_for_user(current_user)
    return jsonify(rooms), 200


@chat_bp.get("/chat/group/messages")
@roles_required("student", "teacher", "admin")
def get_group_chat_messages():
    current_user = g.current_user
    group_id = str(request.args.get("group_id") or "").strip()
    subject = str(request.args.get("subject") or "").strip()

    if not group_id or not subject:
        return jsonify({"error": "group_id and subject are required"}), 400

    if not _can_access_group_room(current_user, group_id, subject):
        return jsonify({"error": "Forbidden"}), 403

    rows = (
        GroupChatMessage.query.filter_by(group_id=group_id, subject=subject)
        .order_by(GroupChatMessage.created_at.asc())
        .all()
    )

    user_ids = list({row.sender_id for row in rows})
    users = User.query.filter(User.id.in_(user_ids)).all() if user_ids else []
    teacher_profiles, student_profiles = _collect_profiles(user_ids)
    user_map = {row.id: row for row in users}

    payload = []
    for row in rows:
        sender = user_map.get(row.sender_id)
        payload.append(_as_group_payload(row, sender, teacher_profiles, student_profiles))

    return jsonify(payload), 200


@chat_bp.post("/chat/group/send")
@roles_required("student", "teacher", "admin")
def send_group_message():
    if request.content_type and request.content_type.startswith("multipart/form-data"):
        group_id = request.form.get("group_id")
        subject = request.form.get("subject")
        text = request.form.get("message")
        image_file = request.files.get("image")
        common_file = request.files.get("file")
    else:
        data = request.get_json(silent=True) or {}
        group_id = data.get("group_id")
        subject = data.get("subject")
        text = data.get("message")
        image_file = None
        common_file = None

    group_id = str(group_id or "").strip()
    subject = str(subject or "").strip()
    clean_text = str(text or "").strip()
    attachment_file = image_file if image_file and image_file.filename else common_file

    if not group_id or not subject:
        return jsonify({"error": "group_id and subject are required"}), 400
    if not clean_text and attachment_file is None:
        return jsonify({"error": "message or attachment is required"}), 400

    sender = g.current_user
    if not _can_access_group_room(sender, group_id, subject):
        return jsonify({"error": "Forbidden"}), 403

    attachment_url = None
    attachment_type = None
    if attachment_file is not None and attachment_file.filename:
        attachment_url, attachment_type, error_text = _save_chat_attachment(attachment_file)
        if error_text:
            return jsonify({"error": error_text}), 400

    row = GroupChatMessage(
        group_id=group_id,
        subject=subject,
        sender_id=sender.id,
        message=clean_text,
        attachment_url=attachment_url,
        attachment_type=attachment_type,
    )
    db.session.add(row)
    db.session.commit()

    teacher_profiles, student_profiles = _collect_profiles([sender.id])
    return jsonify(_as_group_payload(row, sender, teacher_profiles, student_profiles)), 201


@chat_bp.post("/chat/send")
@roles_required("student", "teacher")
def send_message():
    if request.content_type and request.content_type.startswith("multipart/form-data"):
        receiver_id = request.form.get("receiver_id")
        text = request.form.get("message")
        image_file = request.files.get("image")
        common_file = request.files.get("file")
        reply_to_id = request.form.get("reply_to_id")
    else:
        data = request.get_json(silent=True) or {}
        receiver_id = data.get("receiver_id")
        text = data.get("message")
        image_file = None
        common_file = None
        reply_to_id = data.get("reply_to_id")

    clean_text = str(text or "").strip()
    attachment_file = image_file if image_file and image_file.filename else common_file
    if not receiver_id:
        return jsonify({"error": "receiver_id is required"}), 400
    if not clean_text and attachment_file is None:
        return jsonify({"error": "message or attachment is required"}), 400

    try:
        receiver_id = int(receiver_id)
    except (TypeError, ValueError):
        return jsonify({"error": "receiver_id must be integer"}), 400

    sender = g.current_user
    receiver = User.query.get(receiver_id)
    if not receiver:
        return jsonify({"error": "Receiver not found"}), 404

    if not _is_student_teacher_pair(sender.role, receiver.role):
        return jsonify({"error": "Only student <-> teacher chat is allowed"}), 403

    parsed_reply_to_id = None
    if reply_to_id is not None and str(reply_to_id).strip():
        try:
            parsed_reply_to_id = int(reply_to_id)
        except (TypeError, ValueError):
            return jsonify({"error": "reply_to_id must be integer"}), 400

        reply_row = ChatMessage.query.get(parsed_reply_to_id)
        if not reply_row:
            return jsonify({"error": "Reply message not found"}), 404

        pair_ids = {sender.id, receiver.id}
        reply_pair_ids = {reply_row.sender_id, reply_row.receiver_id}
        if pair_ids != reply_pair_ids:
            return jsonify({"error": "Reply message is outside of this conversation"}), 400

    attachment_url = None
    attachment_type = None
    if attachment_file is not None and attachment_file.filename:
        attachment_url, attachment_type, error_text = _save_chat_attachment(attachment_file)
        if error_text:
            return jsonify({"error": error_text}), 400

    row = ChatMessage(
        sender_id=sender.id,
        receiver_id=receiver.id,
        message=clean_text,
        attachment_url=attachment_url,
        attachment_type=attachment_type,
        reply_to_id=parsed_reply_to_id,
    )
    db.session.add(row)
    db.session.commit()

    return jsonify(_as_payload(row)), 201


@chat_bp.get("/chat/messages")
@roles_required("student", "teacher", "admin")
def get_messages():
    current_user = g.current_user
    with_user_id = request.args.get("with_user_id", type=int)

    if current_user.role == "admin":
        if with_user_id:
            target = User.query.get(with_user_id)
            if not target:
                return jsonify({"error": "User not found"}), 404
            if target.role not in {"student", "teacher"}:
                return jsonify({"error": "Chat target must be student or teacher"}), 400

            rows = (
                ChatMessage.query.filter(
                    or_(
                        ChatMessage.sender_id == target.id,
                        ChatMessage.receiver_id == target.id,
                    )
                )
                .order_by(ChatMessage.created_at.asc())
                .all()
            )
        else:
            rows = ChatMessage.query.order_by(ChatMessage.created_at.asc()).all()

        payload = []
        for row in rows:
            item = _as_payload(row)
            if item.get("is_deleted_any"):
                item["deleted_marker"] = "deleted_message"
            payload.append(item)
        return jsonify(payload), 200

    if with_user_id:
        target = User.query.get(with_user_id)
        if not target:
            return jsonify({"error": "User not found"}), 404

        if not _is_student_teacher_pair(current_user.role, target.role):
            return jsonify({"error": "Only student <-> teacher chat is allowed"}), 403

        rows = (
            ChatMessage.query.filter(
                or_(
                    (ChatMessage.sender_id == current_user.id)
                    & (ChatMessage.receiver_id == target.id),
                    (ChatMessage.sender_id == target.id)
                    & (ChatMessage.receiver_id == current_user.id),
                )
            )
            .order_by(ChatMessage.created_at.asc())
            .all()
        )
    else:
        rows = (
            ChatMessage.query.filter(
                or_(
                    ChatMessage.sender_id == current_user.id,
                    ChatMessage.receiver_id == current_user.id,
                )
            )
            .order_by(ChatMessage.created_at.asc())
            .all()
        )

    visible_rows = [row for row in rows if not _is_deleted_for_user(row, current_user.id)]
    return jsonify([_as_payload(row) for row in visible_rows]), 200


@chat_bp.delete("/chat/messages/<int:message_id>")
@roles_required("student", "teacher")
def delete_message_for_me(message_id: int):
    current_user = g.current_user
    if current_user.role == "admin":
        return jsonify({"error": "Forbidden"}), 403

    row = ChatMessage.query.get(message_id)
    if not row:
        return jsonify({"error": "Message not found"}), 404

    if not _is_chat_participant(row, current_user.id):
        return jsonify({"error": "Forbidden"}), 403

    _mark_deleted_for_user(row, current_user.id)
    db.session.commit()
    return jsonify({"status": "deleted_for_me"}), 200


@chat_bp.post("/chat/messages/clear")
@roles_required("student", "teacher")
def clear_chat_for_me():
    current_user = g.current_user
    if current_user.role == "admin":
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    with_user_id = data.get("with_user_id")

    try:
        with_user_id = int(with_user_id)
    except (TypeError, ValueError):
        return jsonify({"error": "with_user_id must be integer"}), 400

    target = User.query.get(with_user_id)
    if not target:
        return jsonify({"error": "User not found"}), 404

    if not _is_student_teacher_pair(current_user.role, target.role):
        return jsonify({"error": "Only student <-> teacher chat is allowed"}), 403

    rows = (
        ChatMessage.query.filter(
            or_(
                (ChatMessage.sender_id == current_user.id) & (ChatMessage.receiver_id == target.id),
                (ChatMessage.sender_id == target.id) & (ChatMessage.receiver_id == current_user.id),
            )
        )
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    for row in rows:
        _mark_deleted_for_user(row, current_user.id)

    db.session.commit()
    return jsonify({"status": "chat_cleared"}), 200
