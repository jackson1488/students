"""
Модуль `app/routes/schedule.py`

Назначение:
- API расписания: CRUD пар и выдача расписания по группе.

Ключевые константы и значения:
- `DAY_ORDER`: используется как конфигурационный или справочный набор значений в этом модуле.

Маршруты HTTP (если это route-модуль):
- `POST /schedule` -> `create_schedule_entry`
- `PUT /schedule/<int:entry_id>` -> `update_schedule_entry`
- `DELETE /schedule/<int:entry_id>` -> `delete_schedule_entry`
- `GET /schedule/<group_id>` -> `get_schedule`

Функции модуля:
- `_teacher_display_name`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_build_schedule_payload`: Формирует служебную структуру данных/ответ.
- `_day_rank`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_parse_schedule_payload`: Разбирает и валидирует входные данные.
- `create_schedule_entry`: Создает новую сущность или запись.
- `update_schedule_entry`: Обновляет существующую сущность.
- `delete_schedule_entry`: Удаляет сущность или помечает ее удаленной.
- `get_schedule`: Возвращает данные по запросу.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

from flask import Blueprint, g, jsonify, request

from app.middleware.auth import roles_required, token_required
from app.models import (
    ScheduleEntry,
    ScheduleTeacherLink,
    StudyGroup,
    TeacherGroupBinding,
    TeacherProfile,
    User,
    db,
)


schedule_bp = Blueprint("schedule", __name__)
DAY_ORDER = {
    "monday": 1,
    "tuesday": 2,
    "wednesday": 3,
    "thursday": 4,
    "friday": 5,
    "saturday": 6,
    "понедельник": 1,
    "вторник": 2,
    "среда": 3,
    "четверг": 4,
    "пятница": 5,
    "суббота": 6,
}


def _teacher_display_name(teacher, profile):
    if profile:
        full_name = " ".join(
            [
                profile.last_name or "",
                profile.first_name or "",
                profile.middle_name or "",
            ]
        ).strip()
        if full_name:
            return full_name
    return teacher.login if teacher else None


def _build_schedule_payload(row, teacher, profile):
    payload = row.to_dict()
    payload["teacher_id"] = teacher.id if teacher else None
    payload["teacher_name"] = _teacher_display_name(teacher, profile)
    return payload


def _day_rank(day_of_week):
    value = str(day_of_week or "").strip().lower()
    return DAY_ORDER.get(value, 99)


def _parse_schedule_payload(data):
    required_fields = ["group_id", "teacher_id", "day_of_week", "start_time", "end_time", "subject"]
    missing = [field for field in required_fields if not data.get(field)]

    if missing:
        return None, jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    group_name = str(data["group_id"]).strip()
    day_of_week = str(data["day_of_week"]).strip()
    start_time = str(data["start_time"]).strip()
    end_time = str(data["end_time"]).strip()
    subject = str(data["subject"]).strip()
    room = str(data["room"]).strip() if data.get("room") else None

    group = StudyGroup.query.filter_by(name=group_name).first()
    if not group:
        return None, jsonify({"error": "Group not found"}), 404

    teacher = User.query.get(data["teacher_id"])
    if not teacher or teacher.role != "teacher":
        return None, jsonify({"error": "Teacher not found"}), 404

    binding = TeacherGroupBinding.query.filter_by(
        teacher_id=teacher.id, group_id=group.id, subject=subject
    ).first()
    if not binding:
        return None, jsonify({"error": "Teacher is not bound to this group/subject"}), 400

    return (
        {
            "group": group,
            "teacher": teacher,
            "day_of_week": day_of_week,
            "start_time": start_time,
            "end_time": end_time,
            "subject": subject,
            "room": room,
        },
        None,
        None,
    )


@schedule_bp.post("/schedule")
@roles_required("scheduler", "admin")
def create_schedule_entry():
    data = request.get_json(silent=True) or {}
    parsed, error_response, error_code = _parse_schedule_payload(data)
    if error_response:
        return error_response, error_code

    row = ScheduleEntry(
        group_id=parsed["group"].name,
        day_of_week=parsed["day_of_week"],
        start_time=parsed["start_time"],
        end_time=parsed["end_time"],
        subject=parsed["subject"],
        room=parsed["room"],
    )

    db.session.add(row)
    db.session.flush()

    teacher_link = ScheduleTeacherLink(schedule_entry_id=row.id, teacher_id=parsed["teacher"].id)
    db.session.add(teacher_link)
    db.session.commit()

    teacher_profile = TeacherProfile.query.filter_by(user_id=parsed["teacher"].id).first()
    return jsonify(_build_schedule_payload(row, parsed["teacher"], teacher_profile)), 201


@schedule_bp.put("/schedule/<int:entry_id>")
@roles_required("scheduler", "admin")
def update_schedule_entry(entry_id: int):
    row = ScheduleEntry.query.get(entry_id)
    if not row:
        return jsonify({"error": "Schedule entry not found"}), 404

    data = request.get_json(silent=True) or {}
    parsed, error_response, error_code = _parse_schedule_payload(data)
    if error_response:
        return error_response, error_code

    row.group_id = parsed["group"].name
    row.day_of_week = parsed["day_of_week"]
    row.start_time = parsed["start_time"]
    row.end_time = parsed["end_time"]
    row.subject = parsed["subject"]
    row.room = parsed["room"]

    teacher_link = ScheduleTeacherLink.query.filter_by(schedule_entry_id=row.id).first()
    if teacher_link:
        teacher_link.teacher_id = parsed["teacher"].id
    else:
        db.session.add(ScheduleTeacherLink(schedule_entry_id=row.id, teacher_id=parsed["teacher"].id))

    db.session.commit()

    teacher_profile = TeacherProfile.query.filter_by(user_id=parsed["teacher"].id).first()
    return jsonify(_build_schedule_payload(row, parsed["teacher"], teacher_profile)), 200


@schedule_bp.delete("/schedule/<int:entry_id>")
@roles_required("scheduler", "admin")
def delete_schedule_entry(entry_id: int):
    row = ScheduleEntry.query.get(entry_id)
    if not row:
        return jsonify({"error": "Schedule entry not found"}), 404

    links = ScheduleTeacherLink.query.filter_by(schedule_entry_id=row.id).all()
    for link in links:
        db.session.delete(link)
    db.session.delete(row)
    db.session.commit()
    return jsonify({"status": "deleted"}), 200


@schedule_bp.get("/schedule/<group_id>")
@token_required
def get_schedule(group_id: str):
    current_user = g.current_user

    if current_user.role == "student":
        if not current_user.group_id or str(current_user.group_id) != str(group_id):
            return jsonify({"error": "Forbidden"}), 403
    elif current_user.role not in {"teacher", "scheduler", "admin"}:
        return jsonify({"error": "Forbidden"}), 403

    rows = ScheduleEntry.query.filter_by(group_id=str(group_id)).all()
    if not rows:
        return jsonify([]), 200

    schedule_ids = [row.id for row in rows]
    links = ScheduleTeacherLink.query.filter(ScheduleTeacherLink.schedule_entry_id.in_(schedule_ids)).all()
    if not links:
        payload = []
        for row in rows:
            item = row.to_dict()
            item["teacher_id"] = None
            item["teacher_name"] = None
            payload.append(item)
        payload.sort(key=lambda item: (_day_rank(item.get("day_of_week")), str(item.get("start_time") or "")))
        return jsonify(payload), 200

    teacher_ids = list({row.teacher_id for row in links})
    teachers = User.query.filter(User.id.in_(teacher_ids)).all()
    profiles = TeacherProfile.query.filter(TeacherProfile.user_id.in_(teacher_ids)).all()

    teacher_map = {row.id: row for row in teachers}
    profile_map = {row.user_id: row for row in profiles}
    link_map = {row.schedule_entry_id: row for row in links}

    payload = []
    for row in rows:
        item = row.to_dict()
        link = link_map.get(row.id)
        if link:
            teacher = teacher_map.get(link.teacher_id)
            profile = profile_map.get(link.teacher_id)
            item["teacher_id"] = link.teacher_id
            item["teacher_name"] = _teacher_display_name(teacher, profile)
        else:
            item["teacher_id"] = None
            item["teacher_name"] = None

        payload.append(item)

    payload.sort(key=lambda item: (_day_rank(item.get("day_of_week")), str(item.get("start_time") or "")))
    return jsonify(payload), 200
