"""
Модуль `app/routes/homework.py`

Назначение:
- API домашних заданий: выдача, сдача, проверка, статусы и архивирование.

Ключевые константы и значения:
- `ALLOWED_ATTACHMENT_EXTENSIONS`: используется как конфигурационный или справочный набор значений в этом модуле.
- `ALLOWED_REVIEW_STATUSES`: используется как конфигурационный или справочный набор значений в этом модуле.

Маршруты HTTP (если это route-модуль):
- `GET /homework/media/<path:filename>` -> `get_homework_media`
- `GET /homework/targets` -> `get_homework_targets`
- `POST /homework` -> `create_homework`
- `GET /homework/<group_id>` -> `get_homework`
- `POST /homework/<int:homework_id>/submit` -> `submit_homework`
- `GET /homework/<int:homework_id>/submissions` -> `get_homework_submissions`
- `PATCH /homework/submissions/<int:submission_id>/review` -> `review_submission`
- `PATCH /homework/<int:homework_id>/status` -> `update_homework_status`
- `DELETE /homework/<int:homework_id>` -> `delete_homework`

Функции модуля:
- `_normalize_due_date`: Нормализует и приводит значения к безопасному формату.
- `_display_name`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_to_bool`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_teacher_scope`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_media_root`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_build_public_attachment_url`: Формирует служебную структуру данных/ответ.
- `_student_profile_name`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_save_submission_attachment`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_remove_local_attachment`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_submission_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_homework_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_can_teacher_manage_homework`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_collect_student_names`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `get_homework_media`: Возвращает данные по запросу.
- `get_homework_targets`: Возвращает данные по запросу.
- `create_homework`: Создает новую сущность или запись.
- `get_homework`: Возвращает данные по запросу.
- `submit_homework`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `get_homework_submissions`: Возвращает данные по запросу.
- `review_submission`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `update_homework_status`: Обновляет существующую сущность.
- `delete_homework`: Удаляет сущность или помечает ее удаленной.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

import os
from datetime import datetime

from flask import Blueprint, current_app, g, jsonify, redirect, request, send_from_directory
from sqlalchemy import or_
from werkzeug.utils import secure_filename

from app.middleware.auth import token_required
from app.models import (
    Grade,
    Homework,
    HomeworkSubmission,
    StudentProfile,
    StudyGroup,
    TeacherGroupBinding,
    User,
    db,
)
from app.services.storage_service import remove_uploaded_file, save_uploaded_file, supabase_public_object_url


homework_bp = Blueprint("homework", __name__)
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
    ".csv",
    ".zip",
    ".rar",
    ".7z",
}
ALLOWED_REVIEW_STATUSES = {
    "submitted",
    "reviewed",
    "completed",
    "rejected",
    "needs_fix",
    "deactivated",
    "archived",
}


def _normalize_due_date(value):
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        datetime.strptime(raw, "%Y-%m-%d")
    except ValueError:
        return None
    return raw


def _display_name(last_name, first_name, middle_name, fallback):
    value = " ".join([part for part in [last_name, first_name, middle_name] if part]).strip()
    return value or fallback


def _to_bool(value, default=None):
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    raw = str(value).strip().lower()
    if raw in {"1", "true", "yes", "y", "on"}:
        return True
    if raw in {"0", "false", "no", "n", "off"}:
        return False
    return default


def _teacher_scope(teacher_id: int):
    bindings = TeacherGroupBinding.query.filter_by(teacher_id=teacher_id).all()
    if not bindings:
        return {
            "subjects": [],
            "groups_by_subject": {},
            "subjects_by_group": {},
            "group_ids": [],
            "group_id_to_name": {},
        }

    group_ids = sorted({row.group_id for row in bindings})
    groups = StudyGroup.query.filter(StudyGroup.id.in_(group_ids)).all()
    group_id_to_name = {row.id: row.name for row in groups}

    groups_by_subject = {}
    subjects_by_group = {}
    subjects_set = set()
    valid_group_ids = set()

    for row in bindings:
        group_name = group_id_to_name.get(row.group_id)
        subject_name = str(row.subject or "").strip()
        if not group_name or not subject_name:
            continue

        valid_group_ids.add(row.group_id)
        subjects_set.add(subject_name)
        groups_by_subject.setdefault(subject_name, set()).add(group_name)
        subjects_by_group.setdefault(group_name, set()).add(subject_name)

    return {
        "subjects": sorted(subjects_set),
        "groups_by_subject": groups_by_subject,
        "subjects_by_group": subjects_by_group,
        "group_ids": sorted(valid_group_ids),
        "group_id_to_name": group_id_to_name,
    }


def _media_root():
    uploads_root = os.path.dirname(current_app.config["UPLOAD_FOLDER"])
    folder = os.path.join(uploads_root, "homework_media")
    os.makedirs(folder, exist_ok=True)
    return folder


def _build_public_attachment_url(value):
    raw = str(value or "").strip()
    if not raw:
        return None

    if raw.startswith(("http://", "https://")):
        return raw

    if raw.startswith(("homework/", "uploads/", "chat/", "support/", "users/")):
        return f"{request.host_url.rstrip('/')}/{raw.lstrip('/')}"

    if raw.startswith("/"):
        return f"{request.host_url.rstrip('/')}{raw}"

    return raw


def _student_profile_name(student: User):
    profile = StudentProfile.query.filter_by(user_id=student.id).first()
    if profile:
        return _display_name(profile.last_name, profile.first_name, profile.middle_name, student.login)
    return student.login


def _save_submission_attachment(upload_file, student: User):
    safe_source_name = secure_filename(upload_file.filename or "")
    ext = os.path.splitext(safe_source_name)[1].lower()
    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        return None, None, None, "Unsupported file type"

    raw_student_label = str(_student_profile_name(student) or "").strip().replace(" ", "_")
    cleaned_student_label = "".join([char for char in raw_student_label if char.isalnum() or char in {"_", "-"}])
    student_label = cleaned_student_label[:80] or f"student_{student.id}"
    try:
        attachment_url = save_uploaded_file(
            upload_file,
            folder="homework_media",
            local_route_prefix="/homework/media",
            filename_base=student_label,
        )
    except ValueError as exc:
        return None, None, None, str(exc)
    except RuntimeError as exc:
        return None, None, None, str(exc)

    mime = str(upload_file.mimetype or "").lower()
    attachment_type = "image" if mime.startswith("image/") else "file"
    human_name = f"{student_label}{ext}"
    return attachment_url, attachment_type, human_name, None


def _remove_local_attachment(value):
    remove_uploaded_file(value, local_folder="homework_media")


def _submission_payload(row: HomeworkSubmission):
    payload = row.to_dict()
    payload["attachment_url"] = _build_public_attachment_url(payload.get("attachment_url"))
    return payload


def _homework_payload(row: Homework):
    payload = row.to_dict()
    payload["is_archived"] = bool(payload.get("archived_at"))
    return payload


def _can_teacher_manage_homework(teacher_id: int, homework_row: Homework):
    return homework_row.teacher_id == teacher_id


def _collect_student_names(user_ids):
    if not user_ids:
        return {}
    users = User.query.filter(User.id.in_(user_ids), User.role == "student").all()
    users_map = {row.id: row for row in users}
    profiles = StudentProfile.query.filter(StudentProfile.user_id.in_(user_ids)).all()
    profiles_map = {row.user_id: row for row in profiles}

    result = {}
    for user_id in user_ids:
        user = users_map.get(user_id)
        if not user:
            continue
        profile = profiles_map.get(user_id)
        if profile:
            result[user_id] = _display_name(profile.last_name, profile.first_name, profile.middle_name, user.login)
        else:
            result[user_id] = user.login
    return result


@homework_bp.get("/homework/media/<path:filename>")
def get_homework_media(filename: str):
    local_path = os.path.join(_media_root(), filename)
    if os.path.exists(local_path):
        return send_from_directory(_media_root(), filename)

    remote_url = supabase_public_object_url("homework_media", filename)
    if remote_url:
        return redirect(remote_url, code=302)

    return jsonify({"error": "File not found"}), 404


@homework_bp.get("/homework/targets")
@token_required
def get_homework_targets():
    current_user = g.current_user
    if current_user.role != "teacher":
        return jsonify({"error": "Forbidden"}), 403

    scope = _teacher_scope(current_user.id)
    group_ids = scope["group_ids"]
    group_id_to_name = scope["group_id_to_name"]

    groups_payload = []
    for group_id in group_ids:
        group_name = group_id_to_name.get(group_id)
        if not group_name:
            continue
        groups_payload.append(
            {
                "id": group_id,
                "name": group_name,
                "subjects": sorted(scope["subjects_by_group"].get(group_name, set())),
            }
        )

    groups_payload.sort(key=lambda item: str(item["name"]).lower())

    students_payload = []
    if group_ids:
        profiles = StudentProfile.query.filter(StudentProfile.group_ref_id.in_(group_ids)).all()
        if profiles:
            user_ids = [row.user_id for row in profiles]
            users = User.query.filter(User.id.in_(user_ids), User.role == "student").all()
            users_map = {row.id: row for row in users}

            for profile in profiles:
                user = users_map.get(profile.user_id)
                if not user:
                    continue
                group_name = group_id_to_name.get(profile.group_ref_id) or user.group_id
                students_payload.append(
                    {
                        "id": user.id,
                        "group_id": group_name,
                        "login": user.login,
                        "name": _display_name(
                            profile.last_name,
                            profile.first_name,
                            profile.middle_name,
                            user.login,
                        ),
                    }
                )

            students_payload.sort(key=lambda item: (str(item["group_id"]).lower(), str(item["name"]).lower()))

    return jsonify(
        {
            "subjects": scope["subjects"],
            "groups": groups_payload,
            "students": students_payload,
        }
    ), 200


@homework_bp.post("/homework")
@token_required
def create_homework():
    current_user = g.current_user
    if current_user.role != "teacher":
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    subject = str(data.get("subject") or "").strip()
    title = str(data.get("title") or "").strip()
    description = str(data.get("description") or "").strip()
    target_mode = str(data.get("target_mode") or "group").strip().lower()
    group_id = str(data.get("group_id") or "").strip()
    student_id_raw = data.get("student_id")
    due_date_raw = str(data.get("due_date") or "").strip()
    due_date = _normalize_due_date(due_date_raw)

    if not subject or not title or not description:
        return jsonify({"error": "subject, title, description are required"}), 400
    if due_date_raw and not due_date:
        return jsonify({"error": "due_date must be YYYY-MM-DD"}), 400

    scope = _teacher_scope(current_user.id)
    if subject not in scope["subjects"]:
        return jsonify({"error": "Subject is not available for this teacher"}), 400

    groups_for_subject = sorted(scope["groups_by_subject"].get(subject, set()))
    if not groups_for_subject:
        return jsonify({"error": "No groups linked to this subject"}), 400

    targets = []
    if target_mode == "all_groups":
        targets = [{"group_id": group_name, "target_student_id": None} for group_name in groups_for_subject]
    elif target_mode == "group":
        if not group_id:
            return jsonify({"error": "group_id is required for group mode"}), 400
        if group_id not in groups_for_subject:
            return jsonify({"error": "Group is not available for this subject"}), 403
        targets = [{"group_id": group_id, "target_student_id": None}]
    elif target_mode == "student":
        try:
            student_id = int(student_id_raw)
        except (TypeError, ValueError):
            return jsonify({"error": "student_id must be integer for student mode"}), 400

        student = User.query.get(student_id)
        if not student or student.role != "student":
            return jsonify({"error": "Student not found"}), 404

        student_group = str(student.group_id or "").strip()
        if not student_group or student_group not in groups_for_subject:
            return jsonify({"error": "Student group is not available for this subject"}), 403

        targets = [{"group_id": student_group, "target_student_id": student.id}]
    else:
        return jsonify({"error": "target_mode must be one of: all_groups, group, student"}), 400

    created_rows = []
    for target in targets:
        row = Homework(
            group_id=target["group_id"],
            target_student_id=target["target_student_id"],
            subject=subject,
            title=title,
            description=description,
            due_date=due_date,
            teacher_id=current_user.id,
            is_active=True,
        )
        db.session.add(row)
        created_rows.append(row)

    db.session.commit()
    return jsonify({"count": len(created_rows), "items": [_homework_payload(row) for row in created_rows]}), 201


@homework_bp.get("/homework/<group_id>")
@token_required
def get_homework(group_id: str):
    current_user = g.current_user
    normalized_group = str(group_id or "").strip()

    if current_user.role not in {"admin", "teacher", "student"}:
        return jsonify({"error": "Forbidden"}), 403

    query = Homework.query.filter_by(group_id=normalized_group)

    if current_user.role == "student":
        if str(current_user.group_id or "").strip() != normalized_group:
            return jsonify({"error": "Forbidden"}), 403
        query = query.filter(
            or_(
                Homework.target_student_id.is_(None),
                Homework.target_student_id == current_user.id,
            )
        )
        query = query.filter(Homework.is_active.is_(True), Homework.archived_at.is_(None))

    if current_user.role == "teacher":
        scope = _teacher_scope(current_user.id)
        teacher_groups = set(scope["subjects_by_group"].keys())
        if normalized_group not in teacher_groups:
            return jsonify({"error": "Forbidden"}), 403
        query = query.filter(Homework.teacher_id == current_user.id)

    rows = query.order_by(Homework.created_at.desc()).all()
    items = [_homework_payload(row) for row in rows]
    homework_ids = [row.id for row in rows]

    if not homework_ids:
        return jsonify(items), 200

    if current_user.role == "student":
        submissions = HomeworkSubmission.query.filter(
            HomeworkSubmission.homework_id.in_(homework_ids),
            HomeworkSubmission.student_id == current_user.id,
        ).all()
        submission_map = {row.homework_id: _submission_payload(row) for row in submissions}
        filtered_items = []
        for item in items:
            submission = submission_map.get(item["id"])
            item["submission"] = submission
            status_value = str((submission or {}).get("status") or "").strip().lower()
            item["requires_resubmit"] = status_value in {"rejected", "needs_fix"}
            if status_value == "completed":
                continue
            filtered_items.append(item)
        return jsonify(filtered_items), 200

    submissions = HomeworkSubmission.query.filter(HomeworkSubmission.homework_id.in_(homework_ids)).all()
    counts_map = {}
    for submission in submissions:
        bucket = counts_map.setdefault(
            submission.homework_id,
            {"total": 0, "completed": 0, "submitted": 0},
        )
        bucket["total"] += 1
        if str(submission.status or "").strip().lower() == "completed":
            bucket["completed"] += 1
        else:
            bucket["submitted"] += 1

    for item in items:
        item["submissions_count"] = counts_map.get(item["id"], {"total": 0, "completed": 0, "submitted": 0})

    return jsonify(items), 200


@homework_bp.post("/homework/<int:homework_id>/submit")
@token_required
def submit_homework(homework_id: int):
    current_user = g.current_user
    if current_user.role != "student":
        return jsonify({"error": "Forbidden"}), 403

    homework_row = Homework.query.get(homework_id)
    if not homework_row:
        return jsonify({"error": "Homework not found"}), 404

    if str(homework_row.group_id or "").strip() != str(current_user.group_id or "").strip():
        return jsonify({"error": "Forbidden"}), 403

    if homework_row.target_student_id is not None and homework_row.target_student_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403

    if not homework_row.is_active or homework_row.archived_at is not None:
        return jsonify({"error": "Homework is not available"}), 400

    if request.content_type and request.content_type.startswith("multipart/form-data"):
        comment = str(request.form.get("comment") or "").strip()
        image_file = request.files.get("image")
        generic_file = request.files.get("file")
    else:
        data = request.get_json(silent=True) or {}
        comment = str(data.get("comment") or "").strip()
        image_file = None
        generic_file = None

    attachment_file = image_file if image_file and image_file.filename else generic_file
    if not comment and attachment_file is None:
        return jsonify({"error": "comment or file is required"}), 400

    row = HomeworkSubmission.query.filter_by(
        homework_id=homework_row.id,
        student_id=current_user.id,
    ).first()
    old_attachment_url = row.attachment_url if row else None

    if row is None:
        row = HomeworkSubmission(
            homework_id=homework_row.id,
            student_id=current_user.id,
            teacher_id=homework_row.teacher_id,
        )
        db.session.add(row)

    if attachment_file is not None and attachment_file.filename:
        if old_attachment_url:
            _remove_local_attachment(old_attachment_url)
        attachment_url, attachment_type, attachment_name, error_text = _save_submission_attachment(
            attachment_file,
            current_user,
        )
        if error_text:
            return jsonify({"error": error_text}), 400
        row.attachment_url = attachment_url
        row.attachment_type = attachment_type
        row.attachment_name = attachment_name
    elif row.id is None:
        row.attachment_url = None
        row.attachment_type = None
        row.attachment_name = None

    row.comment = comment or None
    row.status = "submitted"
    row.review_comment = None
    row.is_active = True
    row.archived_at = None
    row.reviewed_at = None
    row.teacher_id = homework_row.teacher_id
    row.submitted_at = datetime.utcnow()
    row.updated_at = datetime.utcnow()

    db.session.commit()
    payload = _submission_payload(row)
    payload["student_name"] = _student_profile_name(current_user)
    return jsonify(payload), 201


@homework_bp.get("/homework/<int:homework_id>/submissions")
@token_required
def get_homework_submissions(homework_id: int):
    current_user = g.current_user
    homework_row = Homework.query.get(homework_id)
    if not homework_row:
        return jsonify({"error": "Homework not found"}), 404

    if current_user.role == "teacher" and not _can_teacher_manage_homework(current_user.id, homework_row):
        return jsonify({"error": "Forbidden"}), 403
    if current_user.role == "student":
        if str(current_user.group_id or "").strip() != str(homework_row.group_id or "").strip():
            return jsonify({"error": "Forbidden"}), 403
        if homework_row.target_student_id is not None and current_user.id != homework_row.target_student_id:
            return jsonify({"error": "Forbidden"}), 403

    if current_user.role not in {"admin", "teacher", "student"}:
        return jsonify({"error": "Forbidden"}), 403

    query = HomeworkSubmission.query.filter_by(homework_id=homework_row.id)
    if current_user.role == "student":
        query = query.filter_by(student_id=current_user.id)

    rows = query.order_by(HomeworkSubmission.submitted_at.desc()).all()
    names_map = _collect_student_names([row.student_id for row in rows])
    payload = []
    for row in rows:
        item = _submission_payload(row)
        item["student_name"] = names_map.get(row.student_id, str(row.student_id))
        payload.append(item)
    return jsonify(payload), 200


@homework_bp.patch("/homework/submissions/<int:submission_id>/review")
@token_required
def review_submission(submission_id: int):
    current_user = g.current_user
    if current_user.role != "teacher":
        return jsonify({"error": "Forbidden"}), 403

    row = HomeworkSubmission.query.get(submission_id)
    if not row:
        return jsonify({"error": "Submission not found"}), 404

    homework_row = Homework.query.get(row.homework_id)
    if not homework_row:
        return jsonify({"error": "Homework not found"}), 404
    if not _can_teacher_manage_homework(current_user.id, homework_row):
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    status_value = str(data.get("status") or "").strip().lower()
    review_comment = str(data.get("review_comment") or "").strip()
    grade_value = str(data.get("grade_value") or "").strip()
    is_active = _to_bool(data.get("is_active"), None)
    archive_flag = _to_bool(data.get("archive"), None)

    if status_value:
        if status_value not in ALLOWED_REVIEW_STATUSES:
            return jsonify({"error": "Unsupported status"}), 400
        row.status = status_value

    if review_comment:
        row.review_comment = review_comment
    elif "review_comment" in data:
        row.review_comment = None

    if grade_value:
        if not grade_value.isdigit():
            return jsonify({"error": "grade_value must be integer from 1 to 5"}), 400
        grade_int = int(grade_value)
        if grade_int < 1 or grade_int > 5:
            return jsonify({"error": "grade_value must be integer from 1 to 5"}), 400
        grade_value = str(grade_int)

        if row.grade_id:
            grade = Grade.query.get(row.grade_id)
            if grade:
                grade.value = grade_value
                grade.subject = homework_row.subject or "General"
            else:
                grade = Grade(
                    student_id=row.student_id,
                    teacher_id=current_user.id,
                    subject=homework_row.subject or "General",
                    value=grade_value,
                )
                db.session.add(grade)
                db.session.flush()
                row.grade_id = grade.id
        else:
            grade = Grade(
                student_id=row.student_id,
                teacher_id=current_user.id,
                subject=homework_row.subject or "General",
                value=grade_value,
            )
            db.session.add(grade)
            db.session.flush()
            row.grade_id = grade.id

        row.grade_value = grade_value
        row.status = "completed"
        row.is_active = False
        row.archived_at = None
    elif "grade_value" in data:
        row.grade_value = None
        row.grade_id = None

    if status_value in {"needs_fix", "rejected"}:
        row.is_active = True
        row.archived_at = None

    if is_active is not None:
        row.is_active = is_active
        if not is_active:
            row.status = "deactivated"
        elif str(row.status or "").strip().lower() == "deactivated":
            row.status = "reviewed"

    if archive_flag is True:
        row.archived_at = datetime.utcnow()
        row.is_active = False
        row.status = "archived"
    elif archive_flag is False:
        row.archived_at = None

    row.reviewed_at = datetime.utcnow()
    row.teacher_id = current_user.id
    row.updated_at = datetime.utcnow()
    db.session.commit()

    payload = _submission_payload(row)
    payload["student_name"] = _collect_student_names([row.student_id]).get(row.student_id)
    return jsonify(payload), 200


@homework_bp.patch("/homework/<int:homework_id>/status")
@token_required
def update_homework_status(homework_id: int):
    current_user = g.current_user
    if current_user.role != "teacher":
        return jsonify({"error": "Forbidden"}), 403

    row = Homework.query.get(homework_id)
    if not row:
        return jsonify({"error": "Homework not found"}), 404
    if not _can_teacher_manage_homework(current_user.id, row):
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    is_active = _to_bool(data.get("is_active"), None)
    archive_flag = _to_bool(data.get("archive"), None)
    title = str(data.get("title") or "").strip()
    description = str(data.get("description") or "").strip()
    due_date_raw = str(data.get("due_date") or "").strip()
    due_date = _normalize_due_date(due_date_raw)

    if due_date_raw and not due_date:
        return jsonify({"error": "due_date must be YYYY-MM-DD"}), 400

    if is_active is not None:
        row.is_active = is_active
    if archive_flag is True:
        row.archived_at = datetime.utcnow()
        row.is_active = False
    elif archive_flag is False:
        row.archived_at = None

    if title:
        row.title = title
    if description:
        row.description = description
    if "due_date" in data:
        row.due_date = due_date

    db.session.commit()
    return jsonify(_homework_payload(row)), 200


@homework_bp.delete("/homework/<int:homework_id>")
@token_required
def delete_homework(homework_id: int):
    current_user = g.current_user
    if current_user.role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    row = Homework.query.get(homework_id)
    if not row:
        return jsonify({"error": "Homework not found"}), 404

    submissions = HomeworkSubmission.query.filter_by(homework_id=row.id).all()
    for submission in submissions:
        _remove_local_attachment(submission.attachment_url)
        db.session.delete(submission)

    db.session.delete(row)
    db.session.commit()
    return jsonify({"deleted": True, "id": homework_id}), 200
