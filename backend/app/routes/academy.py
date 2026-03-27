"""
Модуль `app/routes/academy.py`

Назначение:
- API управления учебной структурой: группы, преподаватели, студенты и привязки.

Маршруты HTTP (если это route-модуль):
- `POST /groups` -> `create_group`
- `PUT /groups/<int:group_id>` -> `update_group`
- `GET /groups` -> `list_groups`
- `POST /teachers` -> `create_teacher`
- `GET /teachers` -> `list_teachers`
- `GET /teachers/<int:teacher_id>` -> `get_teacher`
- `PUT /teachers/<int:teacher_id>` -> `update_teacher`
- `POST /students` -> `create_student`
- `GET /students` -> `list_students`
- `GET /students/<int:student_id>` -> `get_student`
- `PUT /students/<int:student_id>` -> `update_student`
- `POST /bindings` -> `create_binding`
- `GET /bindings` -> `list_bindings`

Функции модуля:
- `_build_public_url`: Формирует служебную структуру данных/ответ.
- `_get_group_by_ref`: Возвращает данные по запросу.
- `_normalize_login`: Нормализует и приводит значения к безопасному формату.
- `_normalize_birth_date`: Нормализует и приводит значения к безопасному формату.
- `_normalize_biography`: Нормализует и приводит значения к безопасному формату.
- `_normalize_group_prefix`: Нормализует и приводит значения к безопасному формату.
- `_generate_student_login`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_subject_list_from_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_teacher_name`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_teacher_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_student_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `create_group`: Создает новую сущность или запись.
- `_course_to_admission_year`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `update_group`: Обновляет существующую сущность.
- `list_groups`: Возвращает список элементов.
- `create_teacher`: Создает новую сущность или запись.
- `list_teachers`: Возвращает список элементов.
- `get_teacher`: Возвращает данные по запросу.
- `update_teacher`: Обновляет существующую сущность.
- `create_student`: Создает новую сущность или запись.
- `list_students`: Возвращает список элементов.
- `get_student`: Возвращает данные по запросу.
- `update_student`: Обновляет существующую сущность.
- `_binding_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `create_binding`: Создает новую сущность или запись.
- `list_bindings`: Возвращает список элементов.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

import json
import re
from datetime import datetime

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

from app.middleware.auth import roles_required, token_required
from app.models import (
    StudentProfile,
    StudyGroup,
    TeacherGroupBinding,
    TeacherProfile,
    User,
    db,
)
from app.services.auth_service import hash_password
from app.utils.student_identity import extract_student_code


academy_bp = Blueprint("academy", __name__)


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


def _get_group_by_ref(group_ref):
    if group_ref is None:
        return None

    if isinstance(group_ref, int) or (isinstance(group_ref, str) and group_ref.isdigit()):
        return StudyGroup.query.get(int(group_ref))

    group_name = str(group_ref).strip()
    if not group_name:
        return None
    return StudyGroup.query.filter(func.lower(StudyGroup.name) == group_name.lower()).first()


def _normalize_login(login_value):
    return str(login_value or "").strip().lower()


def _normalize_birth_date(value):
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        datetime.strptime(raw, "%Y-%m-%d")
    except ValueError:
        return None
    return raw


def _normalize_biography(value):
    raw = str(value or "").strip()
    return raw or None


def _normalize_group_prefix(group_name):
    raw = str(group_name or "").strip().lower()
    cleaned = []
    prev_dash = False

    for ch in raw:
        if ch.isalnum():
            cleaned.append(ch)
            prev_dash = False
        elif ch in {"-", "_"}:
            cleaned.append(ch)
            prev_dash = False
        elif ch in {" ", "/", "\\"}:
            if not prev_dash:
                cleaned.append("-")
                prev_dash = True

    prefix = "".join(cleaned).strip("-_")
    return prefix or "group"


def _generate_student_login(group_name):
    prefix = _normalize_group_prefix(group_name)
    pattern = re.compile(rf"^{re.escape(prefix)}-(\d{{4}})$", re.IGNORECASE)

    rows = User.query.filter(func.lower(User.login).like(f"{prefix}-%")).all()
    max_suffix = 0

    for row in rows:
        login_value = str(row.login or "").strip().lower()
        match = pattern.match(login_value)
        if not match:
            continue

        suffix_value = int(match.group(1))
        if suffix_value > max_suffix:
            max_suffix = suffix_value

    next_suffix = max_suffix + 1
    while next_suffix <= 9999:
        code = f"{next_suffix:04d}"
        candidate = f"{prefix}-{code}"
        exists = User.query.filter(func.lower(User.login) == candidate.lower()).first()
        if not exists:
            return candidate, code
        next_suffix += 1

    raise RuntimeError("Unable to generate unique student login")


def _subject_list_from_payload(subjects):
    if not isinstance(subjects, list):
        return []
    return [str(item).strip() for item in subjects if str(item).strip()]


def _teacher_name(profile, fallback_login):
    if not profile:
        return fallback_login
    parts = [profile.last_name, profile.first_name, profile.middle_name]
    return " ".join([part for part in parts if part]).strip() or fallback_login


def _teacher_payload(user, profile):
    full_name = " ".join(
        [part for part in [profile.last_name if profile else "", profile.first_name if profile else "", profile.middle_name if profile else ""] if part]
    ).strip() if profile else ""
    return {
        "id": user.id,
        "login": user.login,
        "avatar_url": _build_public_url(user.avatar_url),
        "last_name": profile.last_name if profile else "",
        "first_name": profile.first_name if profile else "",
        "middle_name": profile.middle_name if profile else "",
        "subjects": profile.get_subjects() if profile else [],
        "birth_date": profile.birth_date if profile else None,
        "biography": profile.biography if profile else None,
        "full_name": full_name or user.login,
    }


def _student_payload(user, profile=None, group=None):
    full_name = " ".join(
        [part for part in [profile.last_name if profile else "", profile.first_name if profile else "", profile.middle_name if profile else ""] if part]
    ).strip() if profile else ""
    return {
        "id": user.id,
        "login": user.login,
        "student_code": extract_student_code(user.login),
        "avatar_url": _build_public_url(user.avatar_url),
        "group_id": user.group_id,
        "group_ref_id": profile.group_ref_id if profile else None,
        "group_name": group.name if group else user.group_id,
        "group_admission_year": group.admission_year if group else None,
        "group_specialty": group.specialty if group else None,
        "last_name": profile.last_name if profile else "",
        "first_name": profile.first_name if profile else "",
        "middle_name": profile.middle_name if profile else "",
        "birth_date": profile.birth_date if profile else None,
        "biography": profile.biography if profile else None,
        "full_name": full_name or user.login,
    }


@academy_bp.post("/groups")
@roles_required("admin")
def create_group():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or data.get("group_name") or "").strip()
    specialty = str(data.get("specialty") or "").strip()
    admission_year = data.get("admission_year")

    if not name or not specialty or admission_year is None:
        return jsonify({"error": "name, admission_year, specialty are required"}), 400

    try:
        admission_year = int(admission_year)
    except (TypeError, ValueError):
        return jsonify({"error": "admission_year must be integer"}), 400

    if StudyGroup.query.filter(func.lower(StudyGroup.name) == name.lower()).first():
        return jsonify({"error": "Group already exists"}), 409

    row = StudyGroup(name=name, admission_year=admission_year, specialty=specialty)
    db.session.add(row)
    db.session.commit()
    return jsonify(row.to_dict()), 201


def _course_to_admission_year(course_value):
    try:
        course_num = int(course_value)
    except (TypeError, ValueError):
        return None

    if course_num < 1 or course_num > 6:
        return None

    now = datetime.utcnow()
    if now.month >= 9:
        return now.year - course_num + 1
    return now.year - course_num


@academy_bp.put("/groups/<int:group_id>")
@roles_required("admin")
def update_group(group_id: int):
    row = StudyGroup.query.get(group_id)
    if not row:
        return jsonify({"error": "Group not found"}), 404

    data = request.get_json(silent=True) or {}

    next_name = str(data.get("name") if "name" in data else row.name).strip()
    next_specialty = str(data.get("specialty") if "specialty" in data else row.specialty).strip()
    next_admission_year = row.admission_year

    if "course" in data:
        computed = _course_to_admission_year(data.get("course"))
        if computed is None:
            return jsonify({"error": "course must be integer from 1 to 6"}), 400
        next_admission_year = computed
    elif "admission_year" in data:
        try:
            next_admission_year = int(data.get("admission_year"))
        except (TypeError, ValueError):
            return jsonify({"error": "admission_year must be integer"}), 400

    if not next_name or not next_specialty:
        return jsonify({"error": "name and specialty are required"}), 400

    exists = StudyGroup.query.filter(func.lower(StudyGroup.name) == next_name.lower(), StudyGroup.id != row.id).first()
    if exists:
        return jsonify({"error": "Group already exists"}), 409

    previous_group_name = row.name
    row.name = next_name
    row.specialty = next_specialty
    row.admission_year = next_admission_year

    if previous_group_name.lower() != next_name.lower():
        students = User.query.filter(User.role == "student", func.lower(User.group_id) == previous_group_name.lower()).all()
        for student in students:
            student.group_id = next_name

    db.session.commit()
    return jsonify(row.to_dict()), 200


@academy_bp.get("/groups")
@token_required
def list_groups():
    if g.current_user.role not in {"admin", "scheduler", "teacher"}:
        return jsonify({"error": "Forbidden"}), 403

    rows = StudyGroup.query.order_by(StudyGroup.name.asc()).all()
    return jsonify([row.to_dict() for row in rows]), 200


@academy_bp.post("/teachers")
@roles_required("admin")
def create_teacher():
    data = request.get_json(silent=True) or {}
    last_name = str(data.get("last_name") or "").strip()
    first_name = str(data.get("first_name") or "").strip()
    middle_name = str(data.get("middle_name") or "").strip() or None
    biography = _normalize_biography(data.get("biography"))
    raw_birth_date = str(data.get("birth_date") or "").strip()
    birth_date = _normalize_birth_date(raw_birth_date)
    login = _normalize_login(data.get("login"))
    password = str(data.get("password") or "").strip()
    subjects = _subject_list_from_payload(data.get("subjects"))
    avatar_url = str(data.get("avatar_url") or "").strip() or None

    if not last_name or not first_name or not login or not password:
        return jsonify({"error": "last_name, first_name, login, password are required"}), 400

    if " " in login:
        return jsonify({"error": "login must not contain spaces"}), 400

    if len(password) < 4:
        return jsonify({"error": "password must be at least 4 characters"}), 400

    if len(subjects) < 1:
        return jsonify({"error": "At least one subject is required"}), 400
    if raw_birth_date and not birth_date:
        return jsonify({"error": "birth_date must be YYYY-MM-DD"}), 400

    existing = User.query.filter(func.lower(User.login) == login.lower()).first()
    if existing:
        return jsonify({"error": "Login already exists"}), 409

    user = User(
        login=login,
        password_hash=hash_password(password),
        role="teacher",
        group_id=None,
        avatar_url=avatar_url,
    )
    db.session.add(user)
    db.session.flush()

    profile = TeacherProfile(
        user_id=user.id,
        last_name=last_name,
        first_name=first_name,
        middle_name=middle_name,
        subjects_json=json.dumps(subjects, ensure_ascii=False),
        birth_date=birth_date,
        biography=biography,
    )
    db.session.add(profile)
    db.session.commit()

    payload = _teacher_payload(user, profile)
    payload["role"] = user.role
    return jsonify(payload), 201


@academy_bp.get("/teachers")
@roles_required("admin")
def list_teachers():
    teachers = User.query.filter_by(role="teacher").order_by(User.id.asc()).all()
    profiles = TeacherProfile.query.filter(TeacherProfile.user_id.in_([t.id for t in teachers])).all() if teachers else []
    profile_map = {row.user_id: row for row in profiles}

    payload = []
    for teacher in teachers:
        profile = profile_map.get(teacher.id)
        payload.append(_teacher_payload(teacher, profile))

    return jsonify(payload), 200


@academy_bp.get("/teachers/<int:teacher_id>")
@roles_required("admin")
def get_teacher(teacher_id: int):
    teacher = User.query.get(teacher_id)
    if not teacher or teacher.role != "teacher":
        return jsonify({"error": "Teacher not found"}), 404

    profile = TeacherProfile.query.filter_by(user_id=teacher.id).first()
    return jsonify(_teacher_payload(teacher, profile)), 200


@academy_bp.put("/teachers/<int:teacher_id>")
@roles_required("admin")
def update_teacher(teacher_id: int):
    user = User.query.get(teacher_id)
    if not user or user.role != "teacher":
        return jsonify({"error": "Teacher not found"}), 404

    profile = TeacherProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return jsonify({"error": "Teacher profile not found"}), 404

    data = request.get_json(silent=True) or {}

    last_name = str(data.get("last_name") or profile.last_name or "").strip()
    first_name = str(data.get("first_name") or profile.first_name or "").strip()
    middle_name = str(data.get("middle_name") or "").strip() or None
    biography = _normalize_biography(data.get("biography") if "biography" in data else profile.biography)
    raw_birth_date = str(data.get("birth_date") if "birth_date" in data else (profile.birth_date or "")).strip()
    birth_date = _normalize_birth_date(raw_birth_date)
    login = _normalize_login(data.get("login") if "login" in data else user.login)
    password = str(data.get("password") or "").strip()
    avatar_url = str(data.get("avatar_url") if "avatar_url" in data else (user.avatar_url or "")).strip() or None
    subjects = (
        _subject_list_from_payload(data.get("subjects"))
        if "subjects" in data
        else profile.get_subjects()
    )

    if not last_name or not first_name or not login:
        return jsonify({"error": "last_name, first_name and login are required"}), 400

    if " " in login:
        return jsonify({"error": "login must not contain spaces"}), 400

    if len(subjects) < 1:
        return jsonify({"error": "At least one subject is required"}), 400
    if raw_birth_date and not birth_date:
        return jsonify({"error": "birth_date must be YYYY-MM-DD"}), 400

    exists = User.query.filter(func.lower(User.login) == login.lower(), User.id != user.id).first()
    if exists:
        return jsonify({"error": "Login already exists"}), 409

    user.login = login
    user.avatar_url = avatar_url
    if password:
        if len(password) < 4:
            return jsonify({"error": "password must be at least 4 characters"}), 400
        user.password_hash = hash_password(password)

    profile.last_name = last_name
    profile.first_name = first_name
    profile.middle_name = middle_name
    profile.biography = biography
    profile.birth_date = birth_date
    profile.subjects_json = json.dumps(subjects, ensure_ascii=False)

    db.session.commit()
    return jsonify(_teacher_payload(user, profile)), 200


@academy_bp.post("/students")
@roles_required("admin")
def create_student():
    data = request.get_json(silent=True) or {}
    last_name = str(data.get("last_name") or "").strip()
    first_name = str(data.get("first_name") or "").strip()
    middle_name = str(data.get("middle_name") or "").strip() or None
    biography = _normalize_biography(data.get("biography"))
    raw_birth_date = str(data.get("birth_date") or "").strip()
    birth_date = _normalize_birth_date(raw_birth_date)
    avatar_url = str(data.get("avatar_url") or "").strip() or None
    group = _get_group_by_ref(data.get("group_id") or data.get("group_name"))

    if not last_name or not first_name:
        return jsonify({"error": "last_name and first_name are required"}), 400

    if not group:
        return jsonify({"error": "Group not found"}), 404
    if raw_birth_date and not birth_date:
        return jsonify({"error": "birth_date must be YYYY-MM-DD"}), 400

    login, login_suffix = _generate_student_login(group.name)
    generated_password = login_suffix

    user = User(
        login=login,
        password_hash=hash_password(generated_password),
        role="student",
        group_id=group.name,
        avatar_url=avatar_url,
    )
    db.session.add(user)
    db.session.flush()

    profile = StudentProfile(
        user_id=user.id,
        group_ref_id=group.id,
        last_name=last_name,
        first_name=first_name,
        middle_name=middle_name,
        birth_date=birth_date,
        biography=biography,
    )
    db.session.add(profile)
    db.session.commit()

    payload = _student_payload(user, profile, group)
    payload["role"] = user.role
    payload["initial_password"] = generated_password
    return jsonify(payload), 201


@academy_bp.get("/students")
@roles_required("admin")
def list_students():
    students = User.query.filter_by(role="student").order_by(User.id.asc()).all()
    profiles = StudentProfile.query.filter(StudentProfile.user_id.in_([s.id for s in students])).all() if students else []
    groups = StudyGroup.query.filter(StudyGroup.id.in_([row.group_ref_id for row in profiles])).all() if profiles else []
    profile_map = {row.user_id: row for row in profiles}
    group_map = {row.id: row for row in groups}

    payload = []
    for student in students:
        profile = profile_map.get(student.id)
        group = group_map.get(profile.group_ref_id) if profile else None
        payload.append(_student_payload(student, profile, group))

    return jsonify(payload), 200


@academy_bp.get("/students/<int:student_id>")
@roles_required("admin")
def get_student(student_id: int):
    user = User.query.get(student_id)
    if not user or user.role != "student":
        return jsonify({"error": "Student not found"}), 404

    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return jsonify({"error": "Student profile not found"}), 404

    group = StudyGroup.query.get(profile.group_ref_id)
    return jsonify(_student_payload(user, profile, group)), 200


@academy_bp.put("/students/<int:student_id>")
@roles_required("admin")
def update_student(student_id: int):
    user = User.query.get(student_id)
    if not user or user.role != "student":
        return jsonify({"error": "Student not found"}), 404

    profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        return jsonify({"error": "Student profile not found"}), 404

    data = request.get_json(silent=True) or {}

    last_name = str(data.get("last_name") or profile.last_name or "").strip()
    first_name = str(data.get("first_name") or profile.first_name or "").strip()
    middle_name = str(data.get("middle_name") or "").strip() or None
    biography = _normalize_biography(data.get("biography") if "biography" in data else profile.biography)
    raw_birth_date = str(data.get("birth_date") if "birth_date" in data else (profile.birth_date or "")).strip()
    birth_date = _normalize_birth_date(raw_birth_date)
    login = _normalize_login(data.get("login") if "login" in data else user.login)
    password = str(data.get("password") or "").strip()
    avatar_url = str(data.get("avatar_url") if "avatar_url" in data else (user.avatar_url or "")).strip() or None
    group = _get_group_by_ref(data.get("group_id") or data.get("group_name")) if (
        "group_id" in data or "group_name" in data
    ) else StudyGroup.query.get(profile.group_ref_id)

    if not last_name or not first_name or not login:
        return jsonify({"error": "last_name, first_name and login are required"}), 400

    if not group:
        return jsonify({"error": "Group not found"}), 404

    if " " in login:
        return jsonify({"error": "login must not contain spaces"}), 400
    if raw_birth_date and not birth_date:
        return jsonify({"error": "birth_date must be YYYY-MM-DD"}), 400

    exists = User.query.filter(func.lower(User.login) == login.lower(), User.id != user.id).first()
    if exists:
        return jsonify({"error": "Login already exists"}), 409

    user.login = login
    user.group_id = group.name
    user.avatar_url = avatar_url
    if password:
        if len(password) < 4:
            return jsonify({"error": "password must be at least 4 characters"}), 400
        user.password_hash = hash_password(password)

    profile.last_name = last_name
    profile.first_name = first_name
    profile.middle_name = middle_name
    profile.biography = biography
    profile.birth_date = birth_date
    profile.group_ref_id = group.id

    db.session.commit()
    return jsonify(_student_payload(user, profile, group)), 200


def _binding_payload(binding, teacher=None, group=None, profile=None):
    teacher_obj = teacher or User.query.get(binding.teacher_id)
    group_obj = group or StudyGroup.query.get(binding.group_id)
    profile_obj = profile or TeacherProfile.query.filter_by(user_id=binding.teacher_id).first()

    return {
        "id": binding.id,
        "teacher_id": binding.teacher_id,
        "teacher_login": teacher_obj.login if teacher_obj else None,
        "teacher_name": _teacher_name(profile_obj, teacher_obj.login if teacher_obj else ""),
        "group_id": binding.group_id,
        "group_name": group_obj.name if group_obj else None,
        "subject": binding.subject,
        "created_at": binding.created_at.isoformat(),
    }


@academy_bp.post("/bindings")
@roles_required("admin")
def create_binding():
    data = request.get_json(silent=True) or {}
    teacher_id = data.get("teacher_id")
    subject = str(data.get("subject") or "").strip()
    group = _get_group_by_ref(data.get("group_id") or data.get("group_name"))

    if not teacher_id or not subject:
        return jsonify({"error": "teacher_id and subject are required"}), 400

    teacher = User.query.get(teacher_id)
    if not teacher or teacher.role != "teacher":
        return jsonify({"error": "Teacher not found"}), 404

    if not group:
        return jsonify({"error": "Group not found"}), 404

    profile = TeacherProfile.query.filter_by(user_id=teacher.id).first()
    if not profile:
        return jsonify({"error": "Teacher profile not found"}), 404

    available_subjects = profile.get_subjects()
    if subject not in available_subjects:
        return jsonify({"error": "Subject is not in teacher subject list"}), 400

    exists = TeacherGroupBinding.query.filter_by(
        teacher_id=teacher.id, group_id=group.id, subject=subject
    ).first()
    if exists:
        return jsonify({"error": "Binding already exists"}), 409

    row = TeacherGroupBinding(teacher_id=teacher.id, group_id=group.id, subject=subject)
    db.session.add(row)
    db.session.commit()

    return jsonify(_binding_payload(row, teacher=teacher, group=group, profile=profile)), 201


@academy_bp.get("/bindings")
@token_required
def list_bindings():
    if g.current_user.role not in {"admin", "scheduler", "teacher"}:
        return jsonify({"error": "Forbidden"}), 403

    teacher_id = request.args.get("teacher_id", type=int)
    group_ref = request.args.get("group_id")
    group = _get_group_by_ref(group_ref) if group_ref else None

    query = TeacherGroupBinding.query
    if teacher_id:
        query = query.filter_by(teacher_id=teacher_id)
    if group:
        query = query.filter_by(group_id=group.id)

    rows = query.order_by(TeacherGroupBinding.created_at.desc()).all()
    if not rows:
        return jsonify([]), 200

    teacher_ids = list({row.teacher_id for row in rows})
    group_ids = list({row.group_id for row in rows})

    teachers = User.query.filter(User.id.in_(teacher_ids)).all()
    groups = StudyGroup.query.filter(StudyGroup.id.in_(group_ids)).all()
    profiles = TeacherProfile.query.filter(TeacherProfile.user_id.in_(teacher_ids)).all()

    teacher_map = {row.id: row for row in teachers}
    group_map = {row.id: row for row in groups}
    profile_map = {row.user_id: row for row in profiles}

    payload = []
    for row in rows:
        payload.append(
            _binding_payload(
                row,
                teacher=teacher_map.get(row.teacher_id),
                group=group_map.get(row.group_id),
                profile=profile_map.get(row.teacher_id),
            )
        )

    return jsonify(payload), 200
