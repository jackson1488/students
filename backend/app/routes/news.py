"""
Модуль `app/routes/news.py`

Назначение:
- API новостей и замен расписания с таргетингом по группам.

Ключевые константы и значения:
- `ALLOWED_IMAGE_EXTENSIONS`: используется как конфигурационный или справочный набор значений в этом модуле.
- `ALLOWED_NEWS_KINDS`: используется как конфигурационный или справочный набор значений в этом модуле.
- `DEFAULT_NEWS_IMAGE_URL`: используется как конфигурационный или справочный набор значений в этом модуле.
- `MANAGE_NEWS_ROLES`: используется как конфигурационный или справочный набор значений в этом модуле.

Маршруты HTTP (если это route-модуль):
- `GET /news/image/<path:filename>` -> `get_news_image`
- `POST /news` -> `create_news`
- `PUT /news/<int:news_id>` -> `update_news`
- `PATCH /news/<int:news_id>/status` -> `update_news_status`
- `GET /news` -> `list_news`

Функции модуля:
- `_uploads_root`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_news_image_dir`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_truthy`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_build_public_url`: Формирует служебную структуру данных/ответ.
- `_normalize_group`: Нормализует и приводит значения к безопасному формату.
- `_normalize_target_groups`: Нормализует и приводит значения к безопасному формату.
- `_serialize_target_groups`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_parse_target_groups`: Разбирает и валидирует входные данные.
- `_group_match`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_full_name`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_resolve_author_name`: Определяет/находит нужный объект по входным параметрам.
- `_news_image_url_or_default`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_news_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_extract_news_input`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_save_news_image`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_user_target_groups`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_is_targeted_for_user`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_prepare_news_values`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `get_news_image`: Возвращает данные по запросу.
- `create_news`: Создает новую сущность или запись.
- `update_news`: Обновляет существующую сущность.
- `update_news_status`: Обновляет существующую сущность.
- `list_news`: Возвращает список элементов.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

import json
import os
from datetime import datetime
from urllib.parse import urlparse, urlunparse

from flask import Blueprint, current_app, g, jsonify, redirect, request, send_from_directory
from werkzeug.utils import secure_filename

from app.middleware.auth import roles_required, token_required
from app.models import (
    News,
    StudentProfile,
    StudyGroup,
    TeacherGroupBinding,
    TeacherProfile,
    User,
    db,
)
from app.services.storage_service import save_uploaded_file, supabase_public_object_url


news_bp = Blueprint("news", __name__)
DEFAULT_NEWS_IMAGE_URL = "https://placehold.co/1200x675/f0f0f0/111111?text=EDU+Kernel"
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_NEWS_KINDS = {"news", "schedule_replacement"}
MANAGE_NEWS_ROLES = {"admin", "scheduler", "rector"}


def _uploads_root():
    base_upload_dir = current_app.config["UPLOAD_FOLDER"]
    return os.path.dirname(base_upload_dir)


def _news_image_dir():
    folder = os.path.join(_uploads_root(), "news")
    os.makedirs(folder, exist_ok=True)
    return folder


def _truthy(value):
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _build_public_url(value):
    raw = str(value or "").strip().replace("\\", "/")
    if not raw:
        return None

    if raw.startswith(("http://", "https://")):
        parsed = urlparse(raw)
        if parsed.hostname in {"localhost", "127.0.0.1"}:
            request_parsed = urlparse(request.host_url)
            remapped = parsed._replace(scheme=request_parsed.scheme, netloc=request_parsed.netloc)
            return urlunparse(remapped)
        return raw

    if raw.startswith("/"):
        return f"{request.host_url.rstrip('/')}{raw}"

    return f"{request.host_url.rstrip('/')}/{raw.lstrip('./')}"


def _normalize_group(group_name):
    return str(group_name or "").strip().lower()


def _normalize_target_groups(raw_value):
    if raw_value is None:
        return []

    values = raw_value
    if isinstance(raw_value, str):
        text = raw_value.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                values = parsed
            elif isinstance(parsed, str):
                values = [parsed]
            else:
                values = [text]
        except (TypeError, ValueError, json.JSONDecodeError):
            if "," in text:
                values = [item.strip() for item in text.split(",")]
            else:
                values = [text]

    if not isinstance(values, (list, tuple, set)):
        values = [values]

    normalized = []
    seen = set()
    for item in values:
        label = str(item or "").strip()
        if not label:
            continue
        key = _normalize_group(label)
        if not key or key in seen:
            continue
        seen.add(key)
        normalized.append(label)

    return normalized


def _serialize_target_groups(groups):
    clean = _normalize_target_groups(groups)
    if not clean:
        return None
    return json.dumps(clean, ensure_ascii=False)


def _parse_target_groups(raw_value):
    return _normalize_target_groups(raw_value)


def _group_match(left_value, right_value):
    left = _normalize_group(left_value)
    right = _normalize_group(right_value)
    if not left or not right:
        return False
    return left == right


def _full_name(user):
    if user is None:
        return None

    if user.role == "teacher":
        profile = TeacherProfile.query.filter_by(user_id=user.id).first()
        if profile:
            parts = [profile.last_name, profile.first_name, profile.middle_name]
            full = " ".join([part for part in parts if part]).strip()
            if full:
                return full

    if user.role == "student":
        profile = StudentProfile.query.filter_by(user_id=user.id).first()
        if profile:
            parts = [profile.last_name, profile.first_name, profile.middle_name]
            full = " ".join([part for part in parts if part]).strip()
            if full:
                return full

    return user.login


def _resolve_author_name(raw_value, fallback_user):
    manual = str(raw_value or "").strip()
    if manual:
        return manual
    return _full_name(fallback_user)


def _news_image_url_or_default(value):
    public_value = _build_public_url(value)
    if not public_value:
        return DEFAULT_NEWS_IMAGE_URL
    return public_value


def _news_payload(item):
    payload = item.to_dict()
    payload["image_url"] = _news_image_url_or_default(payload.get("image_url"))
    payload["kind"] = payload.get("kind") or "news"
    payload["is_active"] = bool(payload.get("is_active", True))
    payload["target_groups"] = _parse_target_groups(payload.get("target_groups_json"))

    author_name = str(payload.get("author_name") or "").strip()
    if not author_name:
        creator = User.query.get(item.created_by)
        author_name = _full_name(creator) or str(item.created_by)

    payload["author_name"] = author_name
    payload["created_by_name"] = author_name
    return payload


def _extract_news_input():
    is_form = bool(request.content_type and request.content_type.startswith("multipart/form-data"))
    if is_form:
        data = request.form
        target_groups = data.getlist("target_groups")
        if not target_groups:
            target_groups = data.get("target_groups_json") or data.get("target_groups")

        return {
            "title": data.get("title"),
            "content": data.get("content"),
            "author_name": data.get("author_name"),
            "kind": data.get("kind"),
            "target_group": data.get("target_group"),
            "target_groups": target_groups,
            "target_day": data.get("target_day"),
            "target_lesson": data.get("target_lesson"),
            "target_start_time": data.get("target_start_time"),
            "target_end_time": data.get("target_end_time"),
            "replacement_date": data.get("replacement_date"),
            "image_url": data.get("image_url") or data.get("image"),
            "has_image_url": "image_url" in data or "image" in data,
            "clear_image": _truthy(data.get("clear_image")),
            "image_file": request.files.get("image"),
            "has_target_groups": "target_groups" in data or "target_groups_json" in data,
        }

    data = request.get_json(silent=True) or {}
    return {
        "title": data.get("title"),
        "content": data.get("content"),
        "author_name": data.get("author_name"),
        "kind": data.get("kind"),
        "target_group": data.get("target_group"),
        "target_groups": data.get("target_groups", data.get("target_groups_json")),
        "target_day": data.get("target_day"),
        "target_lesson": data.get("target_lesson"),
        "target_start_time": data.get("target_start_time"),
        "target_end_time": data.get("target_end_time"),
        "replacement_date": data.get("replacement_date"),
        "image_url": data.get("image_url") or data.get("image"),
        "has_image_url": ("image_url" in data) or ("image" in data),
        "clear_image": _truthy(data.get("clear_image")),
        "image_file": None,
        "has_target_groups": ("target_groups" in data) or ("target_groups_json" in data),
    }


def _save_news_image(image_file):
    file_name = secure_filename(image_file.filename or "")
    ext = os.path.splitext(file_name)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return None, "Only jpg, jpeg, png, webp are allowed"

    try:
        image_url = save_uploaded_file(
            image_file,
            folder="news",
            local_route_prefix="/news/image",
        )
    except ValueError as exc:
        return None, str(exc)
    except RuntimeError as exc:
        return None, str(exc)

    return image_url, None


def _user_target_groups(current_user):
    groups = set()
    user_group = str(current_user.group_id or "").strip()
    if user_group:
        groups.add(_normalize_group(user_group))

    if current_user.role == "teacher":
        bindings = TeacherGroupBinding.query.filter_by(teacher_id=current_user.id).all()
        if bindings:
            group_ids = list({row.group_id for row in bindings})
            rows = StudyGroup.query.filter(StudyGroup.id.in_(group_ids)).all()
            for row in rows:
                groups.add(_normalize_group(row.name))

    return groups


def _is_targeted_for_user(news_row, user_groups):
    targets = _parse_target_groups(news_row.target_groups_json)
    if not targets:
        return True
    if not user_groups:
        return False
    normalized_targets = {_normalize_group(item) for item in targets if _normalize_group(item)}
    return bool(normalized_targets & user_groups)


def _prepare_news_values(input_data, fallback_row=None):
    if fallback_row is None:
        title = str(input_data.get("title") or "").strip()
        content = str(input_data.get("content") or "").strip()
    else:
        title = str(input_data.get("title") if input_data.get("title") is not None else fallback_row.title).strip()
        content = str(input_data.get("content") if input_data.get("content") is not None else fallback_row.content).strip()

    if not title or not content:
        return None, "title and content are required", 400

    raw_kind = input_data.get("kind") if fallback_row is None else (
        input_data.get("kind") if input_data.get("kind") is not None else fallback_row.kind
    )
    safe_kind = str(raw_kind or "news").strip().lower()
    if safe_kind not in ALLOWED_NEWS_KINDS:
        return None, "kind must be news or schedule_replacement", 400

    if fallback_row is None:
        target_group = str(input_data.get("target_group") or "").strip() or None
        target_day = str(input_data.get("target_day") or "").strip() or None
        target_lesson = str(input_data.get("target_lesson") or "").strip() or None
        target_start_time = str(input_data.get("target_start_time") or "").strip() or None
        target_end_time = str(input_data.get("target_end_time") or "").strip() or None
        replacement_date = str(input_data.get("replacement_date") or "").strip() or None
        target_groups = _normalize_target_groups(input_data.get("target_groups"))
    else:
        target_group = str(
            input_data.get("target_group") if input_data.get("target_group") is not None else fallback_row.target_group or ""
        ).strip() or None
        target_day = str(
            input_data.get("target_day") if input_data.get("target_day") is not None else fallback_row.target_day or ""
        ).strip() or None
        target_lesson = str(
            input_data.get("target_lesson") if input_data.get("target_lesson") is not None else fallback_row.target_lesson or ""
        ).strip() or None
        target_start_time = str(
            input_data.get("target_start_time")
            if input_data.get("target_start_time") is not None
            else fallback_row.target_start_time
            or ""
        ).strip() or None
        target_end_time = str(
            input_data.get("target_end_time")
            if input_data.get("target_end_time") is not None
            else fallback_row.target_end_time
            or ""
        ).strip() or None
        replacement_date = str(
            input_data.get("replacement_date")
            if input_data.get("replacement_date") is not None
            else fallback_row.replacement_date
            or ""
        ).strip() or None

        if input_data.get("has_target_groups"):
            target_groups = _normalize_target_groups(input_data.get("target_groups"))
        else:
            target_groups = _parse_target_groups(fallback_row.target_groups_json)

    if safe_kind == "schedule_replacement":
        if not target_group and target_groups:
            target_group = target_groups[0]
        if not target_group:
            return None, "target_group is required for schedule replacement", 400
        if not target_start_time and not target_lesson:
            return None, "target_start_time or target_lesson is required for schedule replacement", 400

    if target_group and _normalize_group(target_group) not in {_normalize_group(item) for item in target_groups}:
        target_groups.append(target_group)

    author_name = _resolve_author_name(
        input_data.get("author_name") if fallback_row is None else (
            input_data.get("author_name") if input_data.get("author_name") is not None else fallback_row.author_name
        ),
        g.current_user,
    )

    return (
        {
            "title": title,
            "content": content,
            "author_name": author_name,
            "kind": safe_kind,
            "target_group": target_group,
            "target_groups_json": _serialize_target_groups(target_groups),
            "target_day": target_day,
            "target_lesson": target_lesson,
            "target_start_time": target_start_time,
            "target_end_time": target_end_time,
            "replacement_date": replacement_date,
        },
        None,
        None,
    )


@news_bp.get("/news/image/<path:filename>")
def get_news_image(filename: str):
    local_path = os.path.join(_news_image_dir(), filename)
    if os.path.exists(local_path):
        return send_from_directory(_news_image_dir(), filename)

    remote_url = supabase_public_object_url("news", filename)
    if remote_url:
        return redirect(remote_url, code=302)

    return jsonify({"error": "Image not found"}), 404


@news_bp.post("/news")
@roles_required("scheduler", "rector")
def create_news():
    input_data = _extract_news_input()
    parsed, error_text, error_code = _prepare_news_values(input_data)
    if error_text:
        return jsonify({"error": error_text}), error_code

    image_url = None
    image_file = input_data.get("image_file")
    if image_file is not None and image_file.filename:
        image_url, error_text = _save_news_image(image_file)
        if error_text:
            return jsonify({"error": error_text}), 400
    else:
        manual_url = str(input_data.get("image_url") or "").strip()
        image_url = manual_url or None

    row = News(
        title=parsed["title"],
        content=parsed["content"],
        author_name=parsed["author_name"],
        image_url=image_url,
        kind=parsed["kind"],
        target_group=parsed["target_group"],
        target_groups_json=parsed["target_groups_json"],
        target_day=parsed["target_day"],
        target_lesson=parsed["target_lesson"],
        target_start_time=parsed["target_start_time"],
        target_end_time=parsed["target_end_time"],
        replacement_date=parsed["replacement_date"],
        is_active=True,
        archived_at=None,
        created_by=g.current_user.id,
    )
    db.session.add(row)
    db.session.commit()

    return jsonify(_news_payload(row)), 201


@news_bp.put("/news/<int:news_id>")
@roles_required("scheduler", "rector")
def update_news(news_id: int):
    row = News.query.get(news_id)
    if not row:
        return jsonify({"error": "News not found"}), 404

    input_data = _extract_news_input()
    parsed, error_text, error_code = _prepare_news_values(input_data, fallback_row=row)
    if error_text:
        return jsonify({"error": error_text}), error_code

    image_file = input_data.get("image_file")
    if image_file is not None and image_file.filename:
        image_url, error_text = _save_news_image(image_file)
        if error_text:
            return jsonify({"error": error_text}), 400
        row.image_url = image_url
    elif input_data.get("clear_image"):
        row.image_url = None
    elif input_data.get("has_image_url"):
        manual_url = str(input_data.get("image_url") or "").strip()
        row.image_url = manual_url or None

    row.title = parsed["title"]
    row.content = parsed["content"]
    row.author_name = parsed["author_name"]
    row.kind = parsed["kind"]
    row.target_group = parsed["target_group"]
    row.target_groups_json = parsed["target_groups_json"]
    row.target_day = parsed["target_day"]
    row.target_lesson = parsed["target_lesson"]
    row.target_start_time = parsed["target_start_time"]
    row.target_end_time = parsed["target_end_time"]
    row.replacement_date = parsed["replacement_date"]

    db.session.commit()
    return jsonify(_news_payload(row)), 200


@news_bp.patch("/news/<int:news_id>/status")
@roles_required("scheduler", "rector")
def update_news_status(news_id: int):
    row = News.query.get(news_id)
    if not row:
        return jsonify({"error": "News not found"}), 404

    data = request.get_json(silent=True) or {}
    if "is_active" in data:
        is_active = bool(data.get("is_active"))
    elif "active" in data:
        is_active = bool(data.get("active"))
    elif "is_archived" in data:
        is_active = not bool(data.get("is_archived"))
    elif "archived" in data:
        is_active = not bool(data.get("archived"))
    else:
        return jsonify({"error": "is_active is required"}), 400

    row.is_active = is_active
    row.archived_at = None if is_active else datetime.utcnow()
    db.session.commit()
    return jsonify(_news_payload(row)), 200


@news_bp.get("/news")
@token_required
def list_news():
    current_user = g.current_user
    include_inactive = _truthy(request.args.get("include_inactive"))
    can_manage = current_user.role in MANAGE_NEWS_ROLES

    rows = News.query.order_by(News.created_at.desc()).all()

    if not (can_manage and include_inactive):
        rows = [row for row in rows if row.is_active is None or bool(row.is_active)]

    if current_user.role in {"student", "teacher"}:
        user_groups = _user_target_groups(current_user)
        visible = []
        for row in rows:
            if current_user.role == "student" and row.kind == "schedule_replacement":
                if not _group_match(row.target_group, current_user.group_id):
                    continue
            if not _is_targeted_for_user(row, user_groups):
                continue
            visible.append(row)
        rows = visible

    return jsonify([_news_payload(row) for row in rows]), 200
