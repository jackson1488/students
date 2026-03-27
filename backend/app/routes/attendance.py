"""
Модуль `app/routes/attendance.py`

Назначение:
- API посещаемости: отметка и просмотр истории посещений.

Ключевые константы и значения:
- `ALLOWED_ATTENDANCE_STATUSES`: используется как конфигурационный или справочный набор значений в этом модуле.

Маршруты HTTP (если это route-модуль):
- `POST /attendance` -> `create_attendance`
- `GET /attendance/<student_ref>` -> `get_attendance`

Функции модуля:
- `create_attendance`: Создает новую сущность или запись.
- `get_attendance`: Возвращает данные по запросу.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

from datetime import datetime

from flask import Blueprint, g, jsonify, request

from app.middleware.auth import roles_required, token_required
from app.models import Attendance, db
from app.utils.student_identity import resolve_student_user


attendance_bp = Blueprint("attendance", __name__)


ALLOWED_ATTENDANCE_STATUSES = {"present", "absent", "late"}


@attendance_bp.post("/attendance")
@roles_required("teacher", "admin")
def create_attendance():
    data = request.get_json(silent=True) or {}
    student_ref = data.get("student_id") or data.get("student_code") or data.get("student_login")
    status = str(data.get("status", "")).lower()
    date_value = data.get("date") or datetime.utcnow().date().isoformat()

    if not student_ref or not status:
        return jsonify({"error": "student_id and status are required"}), 400

    if status not in ALLOWED_ATTENDANCE_STATUSES:
        return jsonify({"error": "Invalid attendance status"}), 400

    student, resolve_error = resolve_student_user(student_ref)
    if resolve_error == "ambiguous":
        return jsonify({"error": "Student identifier is ambiguous. Use full login"}), 409
    if not student:
        return jsonify({"error": "Student not found"}), 404

    item = Attendance(
        student_id=student.id,
        teacher_id=g.current_user.id,
        date=str(date_value),
        status=status,
    )

    db.session.add(item)
    db.session.commit()

    return jsonify(item.to_dict()), 201


@attendance_bp.get("/attendance/<student_ref>")
@token_required
def get_attendance(student_ref: str):
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

    rows = Attendance.query.filter_by(student_id=student.id).order_by(Attendance.date.desc()).all()
    return jsonify([row.to_dict() for row in rows]), 200
