"""
Модуль `app/routes/grades.py`

Назначение:
- API оценок и журнального режима выставления оценок по датам.

Ключевые константы и значения:
- `DAY_TO_WEEKDAY`: используется как конфигурационный или справочный набор значений в этом модуле.

Маршруты HTTP (если это route-модуль):
- `POST /grades` -> `create_grade`
- `GET /grades/journal` -> `get_grade_journal`
- `POST /grades/journal` -> `create_grade_from_journal`
- `GET /grades/<student_ref>` -> `get_grades`

Функции модуля:
- `_resolve_group`: Определяет/находит нужный объект по входным параметрам.
- `_parse_iso_date`: Разбирает и валидирует входные данные.
- `_normalize_grade_value`: Нормализует и приводит значения к безопасному формату.
- `_weekday_from_schedule_label`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_schedule_subjects_for_group`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_filter_subjects_by_schedule`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_teacher_has_binding_for_subject`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_create_grade_row`: Создает новую сущность или запись.
- `create_grade`: Создает новую сущность или запись.
- `get_grade_journal`: Возвращает данные по запросу.
- `create_grade_from_journal`: Создает новую сущность или запись.
- `get_grades`: Возвращает данные по запросу.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

from datetime import date, datetime, timedelta

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

from app.middleware.auth import token_required
from app.models import Grade, ScheduleEntry, StudentProfile, StudyGroup, TeacherGroupBinding, User, db
from app.utils.student_identity import resolve_student_user


grades_bp = Blueprint("grades", __name__)

DAY_TO_WEEKDAY = {
    "monday": 0,
    "mon": 0,
    "tuesday": 1,
    "tue": 1,
    "tues": 1,
    "wednesday": 2,
    "wed": 2,
    "thursday": 3,
    "thu": 3,
    "thur": 3,
    "thurs": 3,
    "friday": 4,
    "fri": 4,
    "saturday": 5,
    "sat": 5,
    "понедельник": 0,
    "пн": 0,
    "вторник": 1,
    "вт": 1,
    "среда": 2,
    "ср": 2,
    "четверг": 3,
    "чт": 3,
    "пятница": 4,
    "пт": 4,
    "суббота": 5,
    "сб": 5,
    "дүйшөмбү": 0,
    "шейшемби": 1,
    "шаршемби": 2,
    "бейшемби": 3,
    "жума": 4,
    "ишемби": 5,
}


def _resolve_group(group_ref):
    if group_ref is None:
        return None

    raw = str(group_ref).strip()
    if not raw:
        return None

    if raw.isdigit():
        return StudyGroup.query.get(int(raw))

    return StudyGroup.query.filter(func.lower(StudyGroup.name) == raw.lower()).first()


def _parse_iso_date(raw_value):
    raw = str(raw_value or "").strip()
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        return None


def _normalize_grade_value(raw_value):
    raw = str(raw_value or "").strip().lower()
    if raw in {"1", "2", "3", "4", "5"}:
        return raw
    if raw in {"нб", "nb"}:
        return "НБ"
    return None


def _weekday_from_schedule_label(value):
    return DAY_TO_WEEKDAY.get(str(value or "").strip().lower())


def _schedule_subjects_for_group(group_name: str):
    rows = ScheduleEntry.query.filter_by(group_id=str(group_name)).all()
    return sorted({str(row.subject or "").strip() for row in rows if str(row.subject or "").strip()})


def _filter_subjects_by_schedule(subjects, group_name: str):
    normalized = [str(item or "").strip() for item in (subjects or []) if str(item or "").strip()]
    if not normalized:
        return []

    schedule_subjects = _schedule_subjects_for_group(group_name)
    if not schedule_subjects:
        return sorted(set(normalized))

    schedule_set = set(schedule_subjects)
    filtered = [item for item in normalized if item in schedule_set]
    return filtered or sorted(set(normalized))


def _teacher_has_binding_for_subject(teacher_id: int, student: User, subject: str):
    student_group = _resolve_group(student.group_id)
    if not student_group:
        return False

    return (
        TeacherGroupBinding.query.filter_by(
            teacher_id=teacher_id,
            group_id=student_group.id,
            subject=subject,
        ).first()
        is not None
    )


def _create_grade_row(student: User, teacher_id: int, subject: str, value: str, grade_date: date | None):
    if grade_date:
        created_at = datetime.combine(grade_date, datetime.min.time()).replace(hour=12, minute=0, second=0)
    else:
        created_at = datetime.utcnow()

    row = Grade(
        student_id=student.id,
        teacher_id=teacher_id,
        subject=subject,
        value=value,
        created_at=created_at,
    )
    db.session.add(row)
    db.session.commit()
    return row


@grades_bp.post("/grades")
@token_required
def create_grade():
    current_user = g.current_user
    if current_user.role != "teacher":
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    student_ref = data.get("student_id") or data.get("student_code") or data.get("student_login")
    subject = str(data.get("subject") or "").strip()
    value = _normalize_grade_value(data.get("value"))
    grade_date = _parse_iso_date(data.get("date"))

    if not student_ref or not subject or value is None:
        return jsonify({"error": "student_id, subject, value are required (value: 1-5 or НБ)"}), 400
    if "date" in data and grade_date is None:
        return jsonify({"error": "date must be YYYY-MM-DD"}), 400

    student, resolve_error = resolve_student_user(student_ref)
    if resolve_error == "ambiguous":
        return jsonify({"error": "Student identifier is ambiguous. Use full login"}), 409
    if not student or student.role != "student":
        return jsonify({"error": "Student not found"}), 404

    if not _teacher_has_binding_for_subject(current_user.id, student, subject):
        return jsonify({"error": "Forbidden"}), 403

    row = _create_grade_row(student, current_user.id, subject, value, grade_date)
    return jsonify(row.to_dict()), 201


@grades_bp.get("/grades/journal")
@token_required
def get_grade_journal():
    current_user = g.current_user
    if current_user.role not in {"teacher", "admin"}:
        return jsonify({"error": "Forbidden"}), 403

    group_ref = request.args.get("group_id") or request.args.get("group_name")
    subject_ref = str(request.args.get("subject") or "").strip()

    today = date.today()
    default_start = date(today.year, 2, 1)
    start_date = _parse_iso_date(request.args.get("start_date")) or default_start
    end_date = _parse_iso_date(request.args.get("end_date")) or today
    if start_date > end_date:
        return jsonify({"error": "start_date must be before end_date"}), 400

    if current_user.role == "teacher":
        teacher_bindings = (
            TeacherGroupBinding.query.filter_by(teacher_id=current_user.id)
            .order_by(TeacherGroupBinding.group_id.asc(), TeacherGroupBinding.subject.asc())
            .all()
        )
        if not teacher_bindings:
            return jsonify(
                {
                    "group_id": None,
                    "group_name": None,
                    "subject": None,
                    "groups": [],
                    "subjects": [],
                    "dates": [],
                    "students": [],
                }
            ), 200

        teacher_group_ids = sorted({row.group_id for row in teacher_bindings})
        group_rows = StudyGroup.query.filter(StudyGroup.id.in_(teacher_group_ids)).order_by(StudyGroup.name.asc()).all()
        group_map = {row.id: row for row in group_rows}
        available_groups = [{"id": row.id, "name": row.name} for row in group_rows]

        selected_group = _resolve_group(group_ref) if group_ref else group_map.get(teacher_group_ids[0])
        if not selected_group or selected_group.id not in teacher_group_ids:
            return jsonify({"error": "Forbidden"}), 403

        selected_bindings = [row for row in teacher_bindings if row.group_id == selected_group.id]
        available_subjects = sorted({str(row.subject).strip() for row in selected_bindings if str(row.subject).strip()})
        available_subjects = _filter_subjects_by_schedule(available_subjects, selected_group.name)
        selected_subject = subject_ref or (available_subjects[0] if available_subjects else "")
        if selected_subject and available_subjects and selected_subject not in available_subjects:
            return jsonify({"error": "Forbidden"}), 403
        teacher_filter_id = current_user.id
    else:
        group_rows = StudyGroup.query.order_by(StudyGroup.name.asc()).all()
        available_groups = [{"id": row.id, "name": row.name} for row in group_rows]
        if not available_groups:
            return jsonify(
                {
                    "group_id": None,
                    "group_name": None,
                    "subject": None,
                    "groups": [],
                    "subjects": [],
                    "dates": [],
                    "students": [],
                }
            ), 200

        selected_group = _resolve_group(group_ref) if group_ref else StudyGroup.query.get(available_groups[0]["id"])
        if not selected_group:
            return jsonify({"error": "Group not found"}), 404

        selected_bindings = (
            TeacherGroupBinding.query.filter_by(group_id=selected_group.id)
            .order_by(TeacherGroupBinding.subject.asc())
            .all()
        )
        available_subjects = sorted({str(row.subject).strip() for row in selected_bindings if str(row.subject).strip()})
        available_subjects = _filter_subjects_by_schedule(available_subjects, selected_group.name)
        selected_subject = subject_ref or (available_subjects[0] if available_subjects else "")
        teacher_filter_id = None

    students = (
        User.query.filter(
            User.role == "student",
            func.lower(User.group_id) == selected_group.name.lower(),
        )
        .order_by(User.id.asc())
        .all()
    )
    student_ids = [row.id for row in students]

    profiles = (
        StudentProfile.query.filter(StudentProfile.user_id.in_(student_ids)).all()
        if student_ids
        else []
    )
    profile_map = {row.user_id: row for row in profiles}

    schedule_rows = ScheduleEntry.query.filter_by(group_id=selected_group.name).all()
    if selected_subject:
        schedule_rows = [row for row in schedule_rows if str(row.subject or "").strip() == selected_subject]

    allowed_weekdays = set()
    for row in schedule_rows:
        weekday = _weekday_from_schedule_label(row.day_of_week)
        if weekday is not None:
            allowed_weekdays.add(weekday)

    if not allowed_weekdays:
        allowed_weekdays = {0, 1, 2, 3, 4, 5}

    journal_dates = []
    cursor = start_date
    while cursor <= end_date:
        if cursor.weekday() in allowed_weekdays:
            journal_dates.append(cursor.isoformat())
        cursor += timedelta(days=1)

    grade_by_cell = {}
    if student_ids and selected_subject:
        range_start = datetime.combine(start_date, datetime.min.time())
        range_end = datetime.combine(end_date + timedelta(days=1), datetime.min.time())

        grade_query = Grade.query.filter(
            Grade.student_id.in_(student_ids),
            Grade.subject == selected_subject,
            Grade.created_at >= range_start,
            Grade.created_at < range_end,
        )
        if teacher_filter_id:
            grade_query = grade_query.filter(Grade.teacher_id == teacher_filter_id)

        grade_rows = grade_query.order_by(Grade.created_at.desc(), Grade.id.desc()).all()
        for row in grade_rows:
            day_key = row.created_at.date().isoformat() if row.created_at else None
            if not day_key:
                continue
            cell_key = (row.student_id, day_key)
            if cell_key not in grade_by_cell:
                grade_by_cell[cell_key] = str(row.value or "")

    student_payload = []
    for student in students:
        profile = profile_map.get(student.id)
        full_name_parts = [
            profile.last_name if profile else "",
            profile.first_name if profile else "",
            profile.middle_name if profile else "",
        ]
        full_name = " ".join([part for part in full_name_parts if part]).strip() or student.login

        grades_map = {}
        for day_key in journal_dates:
            value = grade_by_cell.get((student.id, day_key))
            grades_map[day_key] = value or ""

        student_payload.append(
            {
                "student_id": student.id,
                "login": student.login,
                "full_name": full_name,
                "grades": grades_map,
            }
        )

    return jsonify(
        {
            "group_id": selected_group.id,
            "group_name": selected_group.name,
            "subject": selected_subject or None,
            "groups": available_groups,
            "subjects": available_subjects,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "dates": journal_dates,
            "students": student_payload,
        }
    ), 200


@grades_bp.post("/grades/journal")
@token_required
def create_grade_from_journal():
    current_user = g.current_user
    if current_user.role != "teacher":
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    student_ref = data.get("student_id") or data.get("student_code") or data.get("student_login")
    subject = str(data.get("subject") or "").strip()
    value = _normalize_grade_value(data.get("value"))
    grade_date = _parse_iso_date(data.get("date"))

    if not student_ref or not subject or value is None:
        return jsonify({"error": "student_id, subject, value are required (value: 1-5 or НБ)"}), 400
    if "date" in data and grade_date is None:
        return jsonify({"error": "date must be YYYY-MM-DD"}), 400

    student, resolve_error = resolve_student_user(student_ref)
    if resolve_error == "ambiguous":
        return jsonify({"error": "Student identifier is ambiguous. Use full login"}), 409
    if not student or student.role != "student":
        return jsonify({"error": "Student not found"}), 404

    if not _teacher_has_binding_for_subject(current_user.id, student, subject):
        return jsonify({"error": "Forbidden"}), 403

    row = _create_grade_row(student, current_user.id, subject, value, grade_date)
    return jsonify(row.to_dict()), 201


@grades_bp.get("/grades/<student_ref>")
@token_required
def get_grades(student_ref: str):
    current_user = g.current_user

    if current_user.role not in {"admin", "teacher", "student"}:
        return jsonify({"error": "Forbidden"}), 403

    preferred_group = current_user.group_id if current_user.role == "student" else None
    student, resolve_error = resolve_student_user(student_ref, preferred_group=preferred_group)
    if resolve_error == "ambiguous":
        return jsonify({"error": "Student identifier is ambiguous. Use full login"}), 409
    if not student:
        return jsonify({"error": "Student not found"}), 404

    if current_user.role == "student" and current_user.id != student.id:
        return jsonify({"error": "Forbidden"}), 403

    grades = Grade.query.filter_by(student_id=student.id).order_by(Grade.created_at.desc()).all()
    return jsonify([grade.to_dict() for grade in grades]), 200
