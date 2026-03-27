"""
Модуль `app/models/entities.py`

Назначение:
- Описание ORM-моделей (таблиц) и сериализации данных.

Классы и методы:
- `User`: модель/класс, инкапсулирующий связанную логику и данные.
  - `User.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `StudyGroup`: модель/класс, инкапсулирующий связанную логику и данные.
  - `StudyGroup.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `TeacherProfile`: модель/класс, инкапсулирующий связанную логику и данные.
  - `TeacherProfile.get_subjects`: Возвращает данные по запросу.
  - `TeacherProfile.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `StudentProfile`: модель/класс, инкапсулирующий связанную логику и данные.
  - `StudentProfile.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `TeacherGroupBinding`: модель/класс, инкапсулирующий связанную логику и данные.
  - `TeacherGroupBinding.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `Grade`: модель/класс, инкапсулирующий связанную логику и данные.
  - `Grade.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `Attendance`: модель/класс, инкапсулирующий связанную логику и данные.
  - `Attendance.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `Homework`: модель/класс, инкапсулирующий связанную логику и данные.
  - `Homework.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `HomeworkSubmission`: модель/класс, инкапсулирующий связанную логику и данные.
  - `HomeworkSubmission.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `ScheduleEntry`: модель/класс, инкапсулирующий связанную логику и данные.
  - `ScheduleEntry.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `ScheduleTeacherLink`: модель/класс, инкапсулирующий связанную логику и данные.
  - `ScheduleTeacherLink.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `Test`: модель/класс, инкапсулирующий связанную логику и данные.
  - `Test.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `TestQuestion`: модель/класс, инкапсулирующий связанную логику и данные.
  - `TestQuestion.get_options`: Возвращает данные по запросу.
  - `TestQuestion.get_correct_answers`: Возвращает данные по запросу.
  - `TestQuestion.to_public_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `TestActivation`: модель/класс, инкапсулирующий связанную логику и данные.
- `TestAttempt`: модель/класс, инкапсулирующий связанную логику и данные.
  - `TestAttempt.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `ModuleScore`: модель/класс, инкапсулирующий связанную логику и данные.
  - `ModuleScore.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `ModuleScoreEntry`: модель/класс, инкапсулирующий связанную логику и данные.
  - `ModuleScoreEntry.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `ChatMessage`: модель/класс, инкапсулирующий связанную логику и данные.
  - `ChatMessage.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `GroupChatMessage`: модель/класс, инкапсулирующий связанную логику и данные.
  - `GroupChatMessage.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `SupportMessage`: модель/класс, инкапсулирующий связанную логику и данные.
  - `SupportMessage.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `Book`: модель/класс, инкапсулирующий связанную логику и данные.
  - `Book.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `BookShelfItem`: модель/класс, инкапсулирующий связанную логику и данные.
  - `BookShelfItem.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `News`: модель/класс, инкапсулирующий связанную логику и данные.
  - `News.to_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

import json
from datetime import datetime

from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    login = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(32), nullable=False)
    group_id = db.Column(db.String(32), nullable=True)
    avatar_url = db.Column(db.String(500), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "login": self.login,
            "role": self.role,
            "group_id": self.group_id,
            "avatar_url": self.avatar_url,
        }


class StudyGroup(db.Model):
    __tablename__ = "study_groups"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True, nullable=False)
    admission_year = db.Column(db.Integer, nullable=False)
    specialty = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "admission_year": self.admission_year,
            "specialty": self.specialty,
            "created_at": self.created_at.isoformat(),
        }


class TeacherProfile(db.Model):
    __tablename__ = "teacher_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    last_name = db.Column(db.String(100), nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    middle_name = db.Column(db.String(100), nullable=True)
    subjects_json = db.Column(db.Text, nullable=False, default="[]")
    birth_date = db.Column(db.String(10), nullable=True)
    biography = db.Column(db.Text, nullable=True)

    def get_subjects(self):
        try:
            value = json.loads(self.subjects_json or "[]")
            if isinstance(value, list):
                return [str(item) for item in value if str(item).strip()]
        except (TypeError, json.JSONDecodeError):
            pass
        return []

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "last_name": self.last_name,
            "first_name": self.first_name,
            "middle_name": self.middle_name,
            "subjects": self.get_subjects(),
            "birth_date": self.birth_date,
            "biography": self.biography,
        }


class StudentProfile(db.Model):
    __tablename__ = "student_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    group_ref_id = db.Column(db.Integer, db.ForeignKey("study_groups.id"), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    middle_name = db.Column(db.String(100), nullable=True)
    birth_date = db.Column(db.String(10), nullable=True)
    biography = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "group_ref_id": self.group_ref_id,
            "last_name": self.last_name,
            "first_name": self.first_name,
            "middle_name": self.middle_name,
            "birth_date": self.birth_date,
            "biography": self.biography,
            "created_at": self.created_at.isoformat(),
        }


class TeacherGroupBinding(db.Model):
    __tablename__ = "teacher_group_bindings"
    __table_args__ = (
        db.UniqueConstraint("teacher_id", "group_id", "subject", name="uq_teacher_group_subject"),
    )

    id = db.Column(db.Integer, primary_key=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey("study_groups.id"), nullable=False)
    subject = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "teacher_id": self.teacher_id,
            "group_id": self.group_id,
            "subject": self.subject,
            "created_at": self.created_at.isoformat(),
        }


class Grade(db.Model):
    __tablename__ = "grades"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    subject = db.Column(db.String(100), nullable=False)
    value = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "teacher_id": self.teacher_id,
            "subject": self.subject,
            "value": self.value,
            "created_at": self.created_at.isoformat(),
        }


class Attendance(db.Model):
    __tablename__ = "attendance"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    date = db.Column(db.String(10), nullable=False)
    status = db.Column(db.String(20), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "teacher_id": self.teacher_id,
            "date": self.date,
            "status": self.status,
        }


class Homework(db.Model):
    __tablename__ = "homework"

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.String(32), nullable=False)
    target_student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    subject = db.Column(db.String(120), nullable=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    due_date = db.Column(db.String(10), nullable=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    archived_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "group_id": self.group_id,
            "target_student_id": self.target_student_id,
            "subject": self.subject or "General",
            "title": self.title,
            "description": self.description,
            "due_date": self.due_date,
            "teacher_id": self.teacher_id,
            "is_active": bool(self.is_active) if self.is_active is not None else True,
            "archived_at": self.archived_at.isoformat() if self.archived_at else None,
            "created_at": self.created_at.isoformat(),
        }


class HomeworkSubmission(db.Model):
    __tablename__ = "homework_submissions"
    __table_args__ = (
        db.UniqueConstraint("homework_id", "student_id", name="uq_homework_submission_student"),
    )

    id = db.Column(db.Integer, primary_key=True)
    homework_id = db.Column(db.Integer, db.ForeignKey("homework.id"), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    comment = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(32), nullable=False, default="submitted")
    review_comment = db.Column(db.Text, nullable=True)
    grade_value = db.Column(db.String(20), nullable=True)
    grade_id = db.Column(db.Integer, db.ForeignKey("grades.id"), nullable=True)
    attachment_url = db.Column(db.String(500), nullable=True)
    attachment_type = db.Column(db.String(50), nullable=True)
    attachment_name = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    archived_at = db.Column(db.DateTime, nullable=True)
    submitted_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    def to_dict(self):
        return {
            "id": self.id,
            "homework_id": self.homework_id,
            "student_id": self.student_id,
            "teacher_id": self.teacher_id,
            "comment": self.comment,
            "status": self.status,
            "review_comment": self.review_comment,
            "grade_value": self.grade_value,
            "grade_id": self.grade_id,
            "attachment_url": self.attachment_url,
            "attachment_type": self.attachment_type,
            "attachment_name": self.attachment_name,
            "is_active": bool(self.is_active) if self.is_active is not None else True,
            "archived_at": self.archived_at.isoformat() if self.archived_at else None,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ScheduleEntry(db.Model):
    __tablename__ = "schedule"

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.String(32), nullable=False)
    day_of_week = db.Column(db.String(20), nullable=False)
    start_time = db.Column(db.String(5), nullable=False)
    end_time = db.Column(db.String(5), nullable=False)
    subject = db.Column(db.String(120), nullable=False)
    room = db.Column(db.String(50), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "group_id": self.group_id,
            "day_of_week": self.day_of_week,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "subject": self.subject,
            "room": self.room,
        }


class ScheduleTeacherLink(db.Model):
    __tablename__ = "schedule_teacher_links"
    __table_args__ = (
        db.UniqueConstraint("schedule_entry_id", "teacher_id", name="uq_schedule_teacher_link"),
    )

    id = db.Column(db.Integer, primary_key=True)
    schedule_entry_id = db.Column(db.Integer, db.ForeignKey("schedule.id"), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "schedule_entry_id": self.schedule_entry_id,
            "teacher_id": self.teacher_id,
        }


class Test(db.Model):
    __tablename__ = "tests"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    subject = db.Column(db.String(120), nullable=True)
    module_no = db.Column(db.Integer, nullable=False, default=1)
    timer_minutes = db.Column(db.Integer, nullable=False)
    questions_to_use = db.Column(db.Integer, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    questions = db.relationship(
        "TestQuestion", backref="test", cascade="all, delete-orphan", lazy=True
    )

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "subject": self.subject,
            "module_no": self.module_no,
            "timer_minutes": self.timer_minutes,
            "questions_to_use": self.questions_to_use,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
            "questions_count": len(self.questions),
        }


class TestQuestion(db.Model):
    __tablename__ = "test_questions"

    id = db.Column(db.Integer, primary_key=True)
    test_id = db.Column(db.Integer, db.ForeignKey("tests.id"), nullable=False)
    text = db.Column(db.Text, nullable=False)
    options_json = db.Column(db.Text, nullable=False)
    correct_answer = db.Column(db.String(255), nullable=False)
    order_index = db.Column(db.Integer, nullable=False)

    def get_options(self):
        try:
            return json.loads(self.options_json)
        except (TypeError, json.JSONDecodeError):
            return []

    def get_correct_answers(self):
        raw = self.correct_answer
        if raw is None:
            return []

        # Backward compatible:
        # - old rows store plain string
        # - new rows store JSON array string
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
            if isinstance(parsed, str):
                return [parsed]
        except (TypeError, json.JSONDecodeError):
            pass

        return [str(raw)]

    def to_public_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            "options": self.get_options(),
            "order_index": self.order_index,
        }


class TestActivation(db.Model):
    __tablename__ = "test_activations"

    id = db.Column(db.Integer, primary_key=True)
    test_id = db.Column(db.Integer, db.ForeignKey("tests.id"), nullable=False)
    activated_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    active_for_all = db.Column(db.Boolean, nullable=False, default=False)
    target_student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    target_group_id = db.Column(db.String(32), nullable=True)
    available_from = db.Column(db.DateTime, nullable=True)
    available_until = db.Column(db.DateTime, nullable=True)
    activated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


class TestAttempt(db.Model):
    __tablename__ = "test_attempts"
    __table_args__ = (
        db.UniqueConstraint("test_id", "student_id", name="uq_test_student_attempt"),
    )

    id = db.Column(db.Integer, primary_key=True)
    test_id = db.Column(db.Integer, db.ForeignKey("tests.id"), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    activation_id = db.Column(db.Integer, db.ForeignKey("test_activations.id"), nullable=True)
    started_at = db.Column(db.DateTime, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=True)
    submitted_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    is_submitted = db.Column(db.Boolean, nullable=False, default=True)
    score = db.Column(db.Integer, nullable=False)
    total_questions = db.Column(db.Integer, nullable=False)
    question_ids_json = db.Column(db.Text, nullable=False, default="[]")
    answers_json = db.Column(db.Text, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "test_id": self.test_id,
            "student_id": self.student_id,
            "activation_id": self.activation_id,
            "started_at": self.started_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "submitted_at": self.submitted_at.isoformat(),
            "is_submitted": self.is_submitted,
            "score": self.score,
            "total_questions": self.total_questions,
        }


class ModuleScore(db.Model):
    __tablename__ = "module_scores"
    __table_args__ = (
        db.UniqueConstraint("student_id", name="uq_module_score_student"),
    )

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    module1_points = db.Column(db.Integer, nullable=True)
    module2_points = db.Column(db.Integer, nullable=True)
    bonus_points = db.Column(db.Integer, nullable=False, default=0)
    comment = db.Column(db.Text, nullable=True)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "teacher_id": self.teacher_id,
            "module1_points": self.module1_points,
            "module2_points": self.module2_points,
            "bonus_points": self.bonus_points,
            "comment": self.comment,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ModuleScoreEntry(db.Model):
    __tablename__ = "module_score_entries"
    __table_args__ = (
        db.UniqueConstraint("student_id", "teacher_id", "subject", name="uq_module_score_entry_student_teacher_subject"),
    )

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    subject = db.Column(db.String(120), nullable=False, default="General")
    module1_points = db.Column(db.Integer, nullable=True)
    module2_points = db.Column(db.Integer, nullable=True)
    exam_points = db.Column(db.Integer, nullable=False, default=0)
    bonus_points = db.Column(db.Integer, nullable=False, default=0)
    comment = db.Column(db.Text, nullable=True)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "teacher_id": self.teacher_id,
            "subject": self.subject,
            "module1_points": self.module1_points,
            "module2_points": self.module2_points,
            "exam_points": self.exam_points,
            "bonus_points": self.bonus_points,
            "comment": self.comment,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ChatMessage(db.Model):
    __tablename__ = "chat_messages"

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    message = db.Column(db.Text, nullable=False)
    attachment_url = db.Column(db.String(500), nullable=True)
    attachment_type = db.Column(db.String(50), nullable=True)
    reply_to_id = db.Column(db.Integer, nullable=True)
    deleted_for_sender = db.Column(db.Boolean, nullable=False, default=False)
    deleted_for_receiver = db.Column(db.Boolean, nullable=False, default=False)
    deleted_at_sender = db.Column(db.DateTime, nullable=True)
    deleted_at_receiver = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "sender_id": self.sender_id,
            "receiver_id": self.receiver_id,
            "message": self.message,
            "attachment_url": self.attachment_url,
            "attachment_type": self.attachment_type,
            "reply_to_id": self.reply_to_id,
            "deleted_for_sender": bool(self.deleted_for_sender),
            "deleted_for_receiver": bool(self.deleted_for_receiver),
            "deleted_at_sender": self.deleted_at_sender.isoformat() if self.deleted_at_sender else None,
            "deleted_at_receiver": self.deleted_at_receiver.isoformat() if self.deleted_at_receiver else None,
            "created_at": self.created_at.isoformat(),
        }


class GroupChatMessage(db.Model):
    __tablename__ = "group_chat_messages"

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.String(64), nullable=False)
    subject = db.Column(db.String(120), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    message = db.Column(db.Text, nullable=False)
    attachment_url = db.Column(db.String(500), nullable=True)
    attachment_type = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "group_id": self.group_id,
            "subject": self.subject,
            "sender_id": self.sender_id,
            "message": self.message,
            "attachment_url": self.attachment_url,
            "attachment_type": self.attachment_type,
            "created_at": self.created_at.isoformat(),
        }


class SupportMessage(db.Model):
    __tablename__ = "support_messages"

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    message = db.Column(db.Text, nullable=False)
    attachment_url = db.Column(db.String(500), nullable=True)
    attachment_type = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "sender_id": self.sender_id,
            "receiver_id": self.receiver_id,
            "message": self.message,
            "attachment_url": self.attachment_url,
            "attachment_type": self.attachment_type,
            "created_at": self.created_at.isoformat(),
        }


class Book(db.Model):
    __tablename__ = "books"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    author = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    cover_url = db.Column(db.String(500), nullable=True)
    file_path = db.Column(db.String(500), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "author": self.author,
            "description": self.description,
            "cover_url": self.cover_url,
            "file": self.file_path,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
        }


class BookShelfItem(db.Model):
    __tablename__ = "book_shelf_items"
    __table_args__ = (
        db.UniqueConstraint("user_id", "source", "book_key", name="uq_book_shelf_user_book"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    source = db.Column(db.String(32), nullable=False, default="openlibrary")
    book_key = db.Column(db.String(255), nullable=False)
    title = db.Column(db.String(255), nullable=False, default="")
    author = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)
    cover_url = db.Column(db.String(500), nullable=True)
    reader_url = db.Column(db.String(500), nullable=True)
    genre = db.Column(db.String(120), nullable=True)
    is_favorite = db.Column(db.Boolean, nullable=False, default=False)
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    bookmark_url = db.Column(db.String(500), nullable=True)
    bookmark_note = db.Column(db.String(255), nullable=True)
    progress_percent = db.Column(db.Integer, nullable=True)
    last_opened_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "source": self.source,
            "book_key": self.book_key,
            "title": self.title,
            "author": self.author,
            "description": self.description,
            "cover_url": self.cover_url,
            "reader_url": self.reader_url,
            "genre": self.genre,
            "is_favorite": bool(self.is_favorite),
            "is_read": bool(self.is_read),
            "bookmark_url": self.bookmark_url,
            "bookmark_note": self.bookmark_note,
            "progress_percent": self.progress_percent,
            "last_opened_at": self.last_opened_at.isoformat() if self.last_opened_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class News(db.Model):
    __tablename__ = "news"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    author_name = db.Column(db.String(255), nullable=True)
    image_url = db.Column(db.String(500), nullable=True)
    kind = db.Column(db.String(32), nullable=False, default="news")
    target_groups_json = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    archived_at = db.Column(db.DateTime, nullable=True)
    target_group = db.Column(db.String(64), nullable=True)
    target_day = db.Column(db.String(20), nullable=True)
    target_lesson = db.Column(db.String(20), nullable=True)
    target_start_time = db.Column(db.String(10), nullable=True)
    target_end_time = db.Column(db.String(10), nullable=True)
    replacement_date = db.Column(db.String(10), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "author_name": self.author_name,
            "image_url": self.image_url,
            "kind": self.kind,
            "target_groups_json": self.target_groups_json,
            "is_active": bool(self.is_active) if self.is_active is not None else True,
            "archived_at": self.archived_at.isoformat() if self.archived_at else None,
            "target_group": self.target_group,
            "target_day": self.target_day,
            "target_lesson": self.target_lesson,
            "target_start_time": self.target_start_time,
            "target_end_time": self.target_end_time,
            "replacement_date": self.replacement_date,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
        }


class AppSetting(db.Model):
    __tablename__ = "app_settings"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(120), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=True)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    def to_dict(self):
        return {
            "id": self.id,
            "key": self.key,
            "value": self.value,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
