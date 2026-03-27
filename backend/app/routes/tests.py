"""
Модуль `app/routes/tests.py`

Назначение:
- API тестирования: создание, активация, прохождение, проверка и модульные баллы.

Маршруты HTTP (если это route-модуль):
- `POST /tests` -> `create_test`
- `GET /tests/<int:test_id>` -> `get_test_detail`
- `PUT /tests/<int:test_id>` -> `update_test`
- `POST /tests/activate` -> `activate_test`
- `POST /tests/deactivate` -> `deactivate_test`
- `POST /tests/retake` -> `allow_retake`
- `GET /tests` -> `list_tests`
- `POST /tests/start` -> `start_test`
- `POST /tests/progress` -> `sync_test_progress`
- `POST /tests/submit` -> `submit_test`
- `GET /tests/module-summary/<student_ref>` -> `get_module_summary`
- `POST /tests/module-summary` -> `upsert_module_summary`

Функции модуля:
- `_utcnow`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_to_utc_iso`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_parse_iso_datetime`: Разбирает и валидирует входные данные.
- `_is_activation_time_open`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_normalize_answer_values`: Нормализует и приводит значения к безопасному формату.
- `_parse_json_dict`: Разбирает и валидирует входные данные.
- `_parse_json_list`: Разбирает и валидирует входные данные.
- `_serialize_activation`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_is_student_attempt_submitted`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_effective_questions_to_use`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_build_seeded_question_set`: Формирует служебную структуру данных/ответ.
- `_public_questions_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_group_name_from_ref`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_student_activation_filter`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_latest_activation_for_student`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_ordered_attempt_questions`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_attempt_answers_dict`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_merge_answers`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_answered_count`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_attempt_deadline`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_calculate_attempt_score`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_finalize_attempt_record`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `auto_finalize_expired_attempts`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_student_attempt_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_teacher_subjects`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_teacher_group_names`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_teacher_can_access_student`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_resolve_activation_window`: Определяет/находит нужный объект по входным параметрам.
- `_validate_test_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_replace_test_questions`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `create_test`: Создает новую сущность или запись.
- `get_test_detail`: Возвращает данные по запросу.
- `update_test`: Обновляет существующую сущность.
- `activate_test`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `deactivate_test`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `allow_retake`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `list_tests`: Возвращает список элементов.
- `start_test`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `sync_test_progress`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `submit_test`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_rating_by_total`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_module_summary_payload`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `get_module_summary`: Возвращает данные по запросу.
- `upsert_module_summary`: Содержит бизнес-логику модуля и используется в общем потоке работы API.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

import json
import random
from datetime import datetime, timedelta, timezone

from flask import Blueprint, g, jsonify, request
from sqlalchemy import and_, func, or_

from app.middleware.auth import token_required
from app.models import (
    ModuleScoreEntry,
    StudyGroup,
    TeacherGroupBinding,
    TeacherProfile,
    Test,
    TestActivation,
    TestAttempt,
    TestQuestion,
    User,
    db,
)
from app.utils.student_identity import resolve_student_user


tests_bp = Blueprint("tests", __name__)


def _utcnow():
    return datetime.utcnow()


def _to_utc_iso(value: datetime | None):
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).isoformat()

    return value.astimezone(timezone.utc).isoformat()


def _parse_iso_datetime(raw_value):
    raw = str(raw_value or "").strip()
    if not raw:
        return None
    try:
        normalized = raw.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed
    except ValueError:
        return None


def _is_activation_time_open(row: TestActivation, now: datetime | None = None):
    current = now or _utcnow()
    if row.available_from and current < row.available_from:
        return False
    if row.available_until and current > row.available_until:
        return False
    return True


def _normalize_answer_values(value):
    if isinstance(value, list):
        cleaned = []
        for item in value:
            raw = str(item or "").strip()
            if raw and raw not in cleaned:
                cleaned.append(raw)
        return cleaned

    raw = str(value or "").strip()
    return [raw] if raw else []


def _parse_json_dict(raw, default=None):
    fallback = {} if default is None else default
    if not raw:
        return dict(fallback)
    try:
        value = json.loads(raw)
        if isinstance(value, dict):
            return value
    except (TypeError, json.JSONDecodeError):
        pass
    return dict(fallback)


def _parse_json_list(raw, default=None):
    fallback = [] if default is None else list(default)
    if not raw:
        return list(fallback)
    try:
        value = json.loads(raw)
        if isinstance(value, list):
            return value
    except (TypeError, json.JSONDecodeError):
        pass
    return list(fallback)


def _serialize_activation(row: TestActivation):
    scope = "all"
    if row.target_student_id:
        scope = "student"
    elif row.target_group_id:
        scope = "group"

    return {
        "id": row.id,
        "test_id": row.test_id,
        "scope": scope,
        "active_for_all": bool(row.active_for_all),
        "target_student_id": row.target_student_id,
        "target_group_id": row.target_group_id,
        "activated_by": row.activated_by,
        "activated_at": _to_utc_iso(row.activated_at),
        "available_from": _to_utc_iso(row.available_from),
        "available_until": _to_utc_iso(row.available_until),
        "is_open_now": _is_activation_time_open(row),
    }


def _is_student_attempt_submitted(attempt: TestAttempt | None):
    if not attempt:
        return False
    return bool(attempt.is_submitted)


def _effective_questions_to_use(test: Test, total_available: int) -> int:
    raw = test.questions_to_use if test.questions_to_use else total_available
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = total_available

    if value <= 0:
        value = total_available

    return min(total_available, value)


def _build_seeded_question_set(test: Test, student_id: int, activation_id: int):
    source_questions = sorted(test.questions, key=lambda item: item.order_index)
    if not source_questions:
        return []

    limit = _effective_questions_to_use(test, len(source_questions))
    seed = f"{test.id}:{student_id}:{activation_id}"
    rng = random.Random(seed)

    selected = (
        rng.sample(source_questions, limit)
        if limit < len(source_questions)
        else list(source_questions)
    )
    rng.shuffle(selected)

    result = []
    for index, question in enumerate(selected, start=1):
        options = [str(item) for item in question.get_options()]
        option_rng = random.Random(f"{seed}:{question.id}:options")
        option_rng.shuffle(options)

        result.append(
            {
                "id": question.id,
                "text": question.text,
                "options": options,
                "order_index": index,
                "correct_answers": [str(item) for item in question.get_correct_answers()],
            }
        )

    return result


def _public_questions_payload(question_rows):
    payload = []
    for row in question_rows:
        payload.append(
            {
                "id": row["id"],
                "text": row["text"],
                "options": row["options"],
                "order_index": row["order_index"],
            }
        )
    return payload


def _group_name_from_ref(group_ref):
    if group_ref is None:
        return None

    if isinstance(group_ref, int) or (isinstance(group_ref, str) and str(group_ref).isdigit()):
        group = StudyGroup.query.get(int(group_ref))
        return group.name if group else None

    group_name = str(group_ref).strip()
    if not group_name:
        return None

    group = StudyGroup.query.filter(func.lower(StudyGroup.name) == group_name.lower()).first()
    return group.name if group else None


def _student_activation_filter(student: User):
    clauses = [
        TestActivation.active_for_all.is_(True),
        TestActivation.target_student_id == student.id,
    ]

    if student.group_id:
        clauses.append(
            and_(
                TestActivation.target_group_id.isnot(None),
                func.lower(TestActivation.target_group_id) == str(student.group_id).lower(),
            )
        )

    return or_(*clauses)


def _latest_activation_for_student(test_id: int, student: User):
    candidates = (
        TestActivation.query.filter(
            and_(
                TestActivation.test_id == test_id,
                _student_activation_filter(student),
            )
        )
        .order_by(TestActivation.activated_at.desc())
        .all()
    )
    now = _utcnow()
    for row in candidates:
        if _is_activation_time_open(row, now):
            return row
    return None


def _ordered_attempt_questions(test: Test, student: User, attempt: TestAttempt):
    activation_seed = attempt.activation_id or 0
    seeded = _build_seeded_question_set(test, student.id, activation_seed)
    by_id = {int(row["id"]): row for row in seeded}

    order_ids = [
        int(item)
        for item in _parse_json_list(attempt.question_ids_json, [])
        if str(item).isdigit()
    ]

    if order_ids:
        ordered = [by_id[item] for item in order_ids if item in by_id]
    else:
        ordered = list(seeded)

    if not ordered and seeded:
        ordered = list(seeded)

    for index, row in enumerate(ordered, start=1):
        row["order_index"] = index

    return ordered


def _attempt_answers_dict(attempt: TestAttempt):
    raw = _parse_json_dict(attempt.answers_json, {})
    return {str(key): value for key, value in raw.items()}


def _merge_answers(base_answers: dict, incoming_answers: dict):
    merged = dict(base_answers)
    for key, value in incoming_answers.items():
        merged[str(key)] = value
    return merged


def _answered_count(question_rows, answer_lookup):
    count = 0
    for row in question_rows:
        value = answer_lookup.get(str(row["id"]))
        if _normalize_answer_values(value):
            count += 1
    return count


def _attempt_deadline(test: Test, attempt: TestAttempt):
    return attempt.expires_at or (attempt.started_at + timedelta(minutes=test.timer_minutes))


def _calculate_attempt_score(question_rows, answer_lookup):
    score = 0
    for question in question_rows:
        user_values = _normalize_answer_values(answer_lookup.get(str(question["id"])))
        correct_values = _normalize_answer_values(question.get("correct_answers"))

        if not user_values:
            continue

        if len(user_values) == len(correct_values) and set(user_values) == set(correct_values):
            score += 1

    return score


def _finalize_attempt_record(
    test: Test,
    student: User,
    attempt: TestAttempt,
    *,
    now: datetime | None = None,
    answers_override: dict | None = None,
):
    finished_at = now or _utcnow()
    expires_at = _attempt_deadline(test, attempt)
    merged_answers = _attempt_answers_dict(attempt)

    if isinstance(answers_override, dict):
        merged_answers = _merge_answers(merged_answers, answers_override)

    question_rows = _ordered_attempt_questions(test, student, attempt)
    total_questions = len(question_rows)
    score = _calculate_attempt_score(question_rows, merged_answers)

    attempt.answers_json = json.dumps(merged_answers, ensure_ascii=False)
    attempt.score = score
    attempt.total_questions = total_questions
    attempt.is_submitted = True
    attempt.expires_at = expires_at
    attempt.submitted_at = finished_at

    return {
        "status": "submitted",
        "test_id": test.id,
        "student_id": student.id,
        "score": score,
        "total_questions": total_questions,
        "submitted_at": _to_utc_iso(finished_at),
    }


def auto_finalize_expired_attempts(limit: int = 250):
    now = _utcnow()
    safe_limit = max(1, int(limit))
    active_attempts = (
        TestAttempt.query.filter_by(is_submitted=False)
        .order_by(TestAttempt.started_at.asc())
        .limit(safe_limit)
        .all()
    )

    if not active_attempts:
        return 0

    finalized_count = 0
    tests_cache = {}
    students_cache = {}

    for attempt in active_attempts:
        test = tests_cache.get(attempt.test_id)
        if test is None:
            test = Test.query.get(attempt.test_id)
            tests_cache[attempt.test_id] = test

        student = students_cache.get(attempt.student_id)
        if student is None:
            student = User.query.get(attempt.student_id)
            students_cache[attempt.student_id] = student

        if not test or not student:
            attempt.is_submitted = True
            attempt.submitted_at = now
            attempt.score = int(attempt.score or 0)
            attempt.total_questions = int(attempt.total_questions or 0)
            finalized_count += 1
            continue

        expires_at = _attempt_deadline(test, attempt)
        attempt.expires_at = expires_at
        if now < expires_at:
            continue

        _finalize_attempt_record(test, student, attempt, now=now)
        finalized_count += 1

    if finalized_count:
        db.session.commit()

    return finalized_count


def _student_attempt_payload(test: Test, student: User, attempt: TestAttempt, question_rows):
    now = _utcnow()
    answers = _attempt_answers_dict(attempt)
    total_questions = len(question_rows)
    answered_count = _answered_count(question_rows, answers)

    expires_at = _attempt_deadline(test, attempt)

    remaining_seconds = max(0, int((expires_at - now).total_seconds()))

    return {
        "attempt_id": attempt.id,
        "test_id": test.id,
        "subject": test.subject,
        "module_no": test.module_no,
        "timer_minutes": test.timer_minutes,
        "started_at": _to_utc_iso(attempt.started_at),
        "expires_at": _to_utc_iso(expires_at),
        "remaining_seconds": remaining_seconds,
        "is_submitted": bool(attempt.is_submitted),
        "answered_count": answered_count,
        "total_questions": total_questions,
        "answers": answers,
        "questions": _public_questions_payload(question_rows),
    }


def _teacher_subjects(teacher_id: int):
    profile = TeacherProfile.query.filter_by(user_id=teacher_id).first()
    if not profile:
        return []
    return [str(item) for item in profile.get_subjects() if str(item).strip()]


def _teacher_group_names(teacher_id: int):
    rows = TeacherGroupBinding.query.filter_by(teacher_id=teacher_id).all()
    if not rows:
        return set()

    group_ids = {row.group_id for row in rows if row.group_id}
    if not group_ids:
        return set()

    groups = StudyGroup.query.filter(StudyGroup.id.in_(list(group_ids))).all()
    return {
        str(row.name).strip().lower()
        for row in groups
        if row and str(row.name or "").strip()
    }


def _teacher_can_access_student(teacher_id: int, student: User):
    if not student or student.role != "student":
        return False

    student_group = str(student.group_id or "").strip().lower()
    if not student_group:
        return False

    return student_group in _teacher_group_names(teacher_id)


def _resolve_activation_window(data):
    now = _utcnow()
    start_at = _parse_iso_datetime(data.get("start_at")) or now
    until_raw = data.get("available_until") if "available_until" in data else data.get("end_at")
    available_until = _parse_iso_datetime(until_raw)

    if available_until is not None:
        if available_until <= start_at:
            return None, None, "available_until must be greater than start_at"
        return start_at, available_until, None

    duration_raw = (
        data.get("duration_value")
        if "duration_value" in data
        else data.get("duration")
    )
    duration_unit = str(data.get("duration_unit") or "hours").strip().lower()
    if duration_unit not in {"hours", "days"}:
        return None, None, "duration_unit must be 'hours' or 'days'"

    try:
        duration_value = int(duration_raw) if duration_raw is not None else 1
    except (TypeError, ValueError):
        return None, None, "duration_value must be integer"

    if duration_value <= 0:
        return None, None, "duration_value must be greater than 0"

    if duration_unit == "hours":
        if duration_value > 24 * 30:
            return None, None, "duration_value is too large"
        available_until = start_at + timedelta(hours=duration_value)
    else:
        if duration_value > 30:
            return None, None, "duration_value is too large"
        available_until = start_at + timedelta(days=duration_value)

    return start_at, available_until, None


def _validate_test_payload(data, teacher_id: int):
    payload = data if isinstance(data, dict) else {}
    subject = str(payload.get("subject") or "").strip()
    timer_minutes = payload.get("timer") or payload.get("timer_minutes") or 40
    module_no_raw = payload.get("module_no") if "module_no" in payload else payload.get("module")
    questions_to_use = (
        payload.get("questions_to_use")
        if "questions_to_use" in payload
        else payload.get("questions_limit")
    )
    questions = payload.get("questions") or []

    if not subject:
        return None, ("subject is required", 400)

    try:
        timer_minutes = int(timer_minutes)
    except (TypeError, ValueError):
        return None, ("timer must be integer", 400)

    if timer_minutes <= 0:
        return None, ("timer must be greater than 0", 400)

    try:
        module_no_value = int(module_no_raw) if module_no_raw is not None else 1
    except (TypeError, ValueError):
        return None, ("module_no must be integer", 400)

    if module_no_value not in {1, 2}:
        return None, ("module_no must be 1 or 2", 400)

    teacher_subjects = _teacher_subjects(teacher_id)
    if teacher_subjects and subject not in teacher_subjects:
        return None, ("subject must be one of teacher subjects", 400)

    if not isinstance(questions, list) or len(questions) < 30:
        return None, ("questions list must contain at least 30 questions", 400)

    if questions_to_use is not None and str(questions_to_use).strip() != "":
        try:
            questions_to_use_value = int(questions_to_use)
        except (TypeError, ValueError):
            return None, ("questions_to_use must be integer", 400)

        if questions_to_use_value not in {30, 40}:
            return None, ("questions_to_use must be 30 or 40", 400)
        if questions_to_use_value > len(questions):
            return None, ("questions_to_use cannot be greater than questions length", 400)
    else:
        questions_to_use_value = 30

    prepared_questions = []
    for index, item in enumerate(questions, start=1):
        if not isinstance(item, dict):
            return None, (f"Question #{index} has invalid format", 400)

        text = str(item.get("text") or "").strip()
        if not text:
            return None, (f"Question #{index} has empty text", 400)

        options_raw = item.get("options")
        if not isinstance(options_raw, list):
            return None, (f"Question #{index} options must be list", 400)

        options = [str(option or "").strip() for option in options_raw if str(option or "").strip()]
        if len(options) != 4:
            return None, (f"Question #{index} must contain exactly 4 answer options", 400)

        if len(set(options)) != len(options):
            return None, (f"Question #{index} options must be unique", 400)

        correct_answers = item.get("correct_answers")
        if correct_answers is None:
            correct_answers = item.get("correct_answer")

        normalized_correct = _normalize_answer_values(correct_answers)
        if not normalized_correct:
            return None, (f"Question #{index} must have at least one correct answer", 400)

        for value in normalized_correct:
            if value not in options:
                return None, (f"Question #{index} correct answer must be one of options", 400)

        prepared_questions.append(
            {
                "text": text,
                "options": options,
                "correct_answers": normalized_correct,
                "order_index": index,
            }
        )

    return (
        {
            "subject": subject,
            "timer_minutes": timer_minutes,
            "module_no": module_no_value,
            "questions_to_use": questions_to_use_value,
            "questions": prepared_questions,
        },
        None,
    )


def _replace_test_questions(test_id: int, prepared_questions):
    TestQuestion.query.filter_by(test_id=test_id).delete(synchronize_session=False)
    for item in prepared_questions:
        db.session.add(
            TestQuestion(
                test_id=test_id,
                text=item["text"],
                options_json=json.dumps(item["options"], ensure_ascii=False),
                correct_answer=json.dumps(item["correct_answers"], ensure_ascii=False),
                order_index=item["order_index"],
            )
        )


@tests_bp.post("/tests")
@token_required
def create_test():
    user = g.current_user
    if user.role != "teacher":
        return jsonify({"error": "Only teacher can create tests"}), 403

    data = request.get_json(silent=True) or {}
    validated, validation_error = _validate_test_payload(data, user.id)
    if validation_error:
        message, status = validation_error
        return jsonify({"error": message}), status

    generated_title = f"{validated['subject']} test {datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    test = Test(
        title=generated_title,
        subject=validated["subject"],
        module_no=validated["module_no"],
        timer_minutes=validated["timer_minutes"],
        questions_to_use=validated["questions_to_use"],
        created_by=user.id,
    )
    db.session.add(test)
    db.session.flush()
    _replace_test_questions(test.id, validated["questions"])

    db.session.commit()
    payload = test.to_dict()
    payload["title"] = None
    payload["created_by_role"] = user.role
    return jsonify(payload), 201


@tests_bp.get("/tests/<int:test_id>")
@token_required
def get_test_detail(test_id: int):
    user = g.current_user
    if user.role not in {"teacher", "admin"}:
        return jsonify({"error": "Forbidden"}), 403

    test = Test.query.get(test_id)
    if not test:
        return jsonify({"error": "Test not found"}), 404

    if user.role == "teacher" and test.created_by != user.id:
        return jsonify({"error": "Forbidden"}), 403

    question_rows = sorted(test.questions, key=lambda item: item.order_index)
    payload = test.to_dict()
    payload["title"] = None
    payload["questions"] = [
        {
            "id": row.id,
            "text": row.text,
            "options": row.get_options(),
            "correct_answers": row.get_correct_answers(),
            "order_index": row.order_index,
        }
        for row in question_rows
    ]
    return jsonify(payload), 200


@tests_bp.put("/tests/<int:test_id>")
@token_required
def update_test(test_id: int):
    user = g.current_user
    if user.role != "teacher":
        return jsonify({"error": "Only teacher can edit tests"}), 403

    test = Test.query.get(test_id)
    if not test:
        return jsonify({"error": "Test not found"}), 404

    if test.created_by != user.id:
        return jsonify({"error": "Forbidden"}), 403

    in_progress_attempt = TestAttempt.query.filter_by(test_id=test.id, is_submitted=False).first()
    if in_progress_attempt:
        return jsonify({"error": "Cannot edit test while students are passing it"}), 409

    data = request.get_json(silent=True) or {}
    validated, validation_error = _validate_test_payload(data, user.id)
    if validation_error:
        message, status = validation_error
        return jsonify({"error": message}), status

    test.subject = validated["subject"]
    test.module_no = validated["module_no"]
    test.timer_minutes = validated["timer_minutes"]
    test.questions_to_use = validated["questions_to_use"]
    test.title = f"{validated['subject']} test {datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

    _replace_test_questions(test.id, validated["questions"])

    db.session.commit()
    payload = test.to_dict()
    payload["title"] = None
    payload["created_by_role"] = user.role
    return jsonify(payload), 200


@tests_bp.post("/tests/activate")
@token_required
def activate_test():
    user = g.current_user
    if user.role != "admin":
        return jsonify({"error": "Only admin can activate tests"}), 403

    data = request.get_json(silent=True) or {}
    test_id = data.get("test_id")
    if not test_id:
        return jsonify({"error": "test_id is required"}), 400

    test = Test.query.get(test_id)
    if not test:
        return jsonify({"error": "Test not found"}), 404

    available_from, available_until, window_error = _resolve_activation_window(data)
    if window_error:
        return jsonify({"error": window_error}), 400

    for_all_flag = bool(data.get("for_all") if "for_all" in data else data.get("activate_for_all"))
    mode = str(data.get("mode") or "").strip().lower()

    created = []

    if for_all_flag or mode in {"all", "for_all"}:
        row = TestActivation(
            test_id=test.id,
            activated_by=user.id,
            active_for_all=True,
            target_student_id=None,
            target_group_id=None,
            available_from=available_from,
            available_until=available_until,
        )
        db.session.add(row)
        db.session.flush()
        created.append(row)
    else:
        student_ref = data.get("student_id") or data.get("student_code") or data.get("student_login")
        target_groups = data.get("target_groups")
        if target_groups is None:
            single_group = data.get("group_id") or data.get("group_name")
            target_groups = [single_group] if single_group else []

        if mode == "student" or (student_ref and not target_groups):
            if not str(student_ref or "").strip():
                return jsonify({"error": "student_id is required for student activation"}), 400
            student, resolve_error = resolve_student_user(student_ref)
            if resolve_error == "ambiguous":
                return jsonify({"error": "Student identifier is ambiguous. Use full login"}), 409
            if not student:
                return jsonify({"error": "Student not found"}), 404

            row = TestActivation(
                test_id=test.id,
                activated_by=user.id,
                active_for_all=False,
                target_student_id=student.id,
                target_group_id=None,
                available_from=available_from,
                available_until=available_until,
            )
            db.session.add(row)
            db.session.flush()
            created.append(row)
        else:
            if not isinstance(target_groups, list) or not target_groups:
                return jsonify({"error": "target_groups is required for group activation"}), 400

            group_names = []
            for group_ref in target_groups:
                group_name = _group_name_from_ref(group_ref)
                if not group_name:
                    return jsonify({"error": f"Group not found: {group_ref}"}), 404
                if group_name not in group_names:
                    group_names.append(group_name)
            group_names.sort(key=lambda item: str(item).lower())

            for group_name in group_names:
                row = TestActivation(
                    test_id=test.id,
                    activated_by=user.id,
                    active_for_all=False,
                    target_student_id=None,
                    target_group_id=group_name,
                    available_from=available_from,
                    available_until=available_until,
                )
                db.session.add(row)
                db.session.flush()
                created.append(row)

    db.session.commit()

    return (
        jsonify(
            {
                "status": "activated",
                "test_id": test.id,
                "activations": [_serialize_activation(row) for row in created],
            }
        ),
        200,
    )


@tests_bp.post("/tests/deactivate")
@token_required
def deactivate_test():
    user = g.current_user
    if user.role != "admin":
        return jsonify({"error": "Only admin can deactivate tests"}), 403

    data = request.get_json(silent=True) or {}
    test_id = data.get("test_id")
    if not test_id:
        return jsonify({"error": "test_id is required"}), 400

    test = Test.query.get(test_id)
    if not test:
        return jsonify({"error": "Test not found"}), 404

    auto_finalize_expired_attempts(limit=500)
    in_progress_attempt = TestAttempt.query.filter_by(test_id=test.id, is_submitted=False).first()
    if in_progress_attempt:
        return jsonify({"error": "Cannot deactivate test while students are passing it"}), 409

    now = _utcnow()
    rows = TestActivation.query.filter_by(test_id=test.id).all()
    affected = 0

    for row in rows:
        if _is_activation_time_open(row, now):
            row.available_until = now
            affected += 1

    if affected:
        db.session.commit()

    return (
        jsonify(
            {
                "status": "deactivated",
                "test_id": test.id,
                "deactivated_count": affected,
            }
        ),
        200,
    )


@tests_bp.post("/tests/retake")
@token_required
def allow_retake():
    user = g.current_user
    if user.role != "admin":
        return jsonify({"error": "Only admin can allow retake"}), 403

    data = request.get_json(silent=True) or {}
    test_id = data.get("test_id")
    if not test_id:
        return jsonify({"error": "test_id is required"}), 400

    test = Test.query.get(test_id)
    if not test:
        return jsonify({"error": "Test not found"}), 404

    student_ref = data.get("student_id") or data.get("student_login") or data.get("student_ref")
    if not str(student_ref or "").strip():
        return jsonify({"error": "student_id is required"}), 400

    student, resolve_error = resolve_student_user(student_ref)
    if resolve_error == "ambiguous":
        return jsonify({"error": "Student identifier is ambiguous. Use full login"}), 409
    if not student:
        return jsonify({"error": "Student not found"}), 404

    attempt = TestAttempt.query.filter_by(test_id=test.id, student_id=student.id).first()
    if not attempt:
        return jsonify({"error": "Attempt not found for this student"}), 404

    if not _is_student_attempt_submitted(attempt):
        return jsonify({"error": "Cannot allow retake while student is passing test"}), 409

    db.session.delete(attempt)
    db.session.commit()

    return (
        jsonify(
            {
                "status": "retake_allowed",
                "test_id": test.id,
                "student_id": student.id,
                "student_login": student.login,
            }
        ),
        200,
    )


@tests_bp.get("/tests")
@token_required
def list_tests():
    user = g.current_user

    if user.role not in {"admin", "teacher", "student"}:
        return jsonify({"error": "Forbidden"}), 403

    if user.role == "student":
        activations_all = (
            TestActivation.query.filter(_student_activation_filter(user))
            .order_by(TestActivation.activated_at.desc())
            .all()
        )
        now = _utcnow()
        activations = [row for row in activations_all if _is_activation_time_open(row, now)]

        latest_by_test = {}
        for activation in activations:
            if activation.test_id not in latest_by_test:
                latest_by_test[activation.test_id] = activation

        attempts = TestAttempt.query.filter_by(student_id=user.id).all()
        attempt_map = {row.test_id: row for row in attempts}
        selected_test_ids = set(latest_by_test.keys())
        for test_id, attempt in attempt_map.items():
            if attempt and not _is_student_attempt_submitted(attempt):
                selected_test_ids.add(test_id)

        test_ids = list(selected_test_ids)
        tests = Test.query.filter(Test.id.in_(test_ids)).all() if test_ids else []
        test_map = {row.id: row for row in tests}

        payload = []
        for test_id in selected_test_ids:
            test = test_map.get(test_id)
            if not test:
                continue

            activation = latest_by_test.get(test_id)
            attempt = attempt_map.get(test.id)
            in_progress = bool(attempt and not _is_student_attempt_submitted(attempt))
            attempted = bool(attempt and _is_student_attempt_submitted(attempt))

            # Student section should show only currently active/in-progress tests.
            # Completed attempts are hidden from the student test list.
            if attempted and not in_progress:
                continue

            questions_count = _effective_questions_to_use(test, len(test.questions))
            answered_count = 0
            remaining_seconds = None
            started_at = None
            expires_at = None

            if attempt and in_progress:
                question_rows = _ordered_attempt_questions(test, user, attempt)
                answers = _attempt_answers_dict(attempt)
                answered_count = _answered_count(question_rows, answers)
                expires_at_value = _attempt_deadline(test, attempt)
                attempt.expires_at = expires_at_value
                remaining_seconds = max(0, int((expires_at_value - now).total_seconds()))
                started_at = _to_utc_iso(attempt.started_at)
                expires_at = _to_utc_iso(expires_at_value)

            payload.append(
                {
                    "id": test.id,
                    "title": None,
                    "subject": test.subject,
                    "module_no": test.module_no,
                    "timer_minutes": test.timer_minutes,
                    "questions_count": questions_count,
                    "pool_questions_count": len(test.questions),
                    "questions_to_use": test.questions_to_use,
                    "activated_at": _to_utc_iso(activation.activated_at) if activation else _to_utc_iso(attempt.started_at if attempt else None),
                    "available_from": _to_utc_iso(activation.available_from) if activation else None,
                    "available_until": _to_utc_iso(activation.available_until) if activation else None,
                    "activation_scope": "all"
                    if activation and activation.active_for_all
                    else ("student" if activation and activation.target_student_id else ("group" if activation else "attempt")),
                    "activation_group": activation.target_group_id if activation else None,
                    "attempted": attempted,
                    "in_progress": in_progress,
                    "started_at": started_at,
                    "expires_at": expires_at,
                    "remaining_seconds": remaining_seconds,
                    "answered_count": answered_count,
                    "attempt": attempt.to_dict() if attempt and attempted else None,
                }
            )

        payload.sort(key=lambda item: item.get("activated_at") or "", reverse=True)
        return jsonify(payload), 200

    query = Test.query
    if user.role == "teacher":
        query = query.filter(Test.created_by == user.id)

    tests = query.order_by(Test.created_at.desc()).all()
    if not tests:
        return jsonify([]), 200

    test_ids = [row.id for row in tests]
    activations = (
        TestActivation.query.filter(TestActivation.test_id.in_(test_ids))
        .order_by(TestActivation.activated_at.desc())
        .all()
    )

    now = _utcnow()
    summary_by_test = {
        test_id: {
            "groups": set(),
            "student_targets": 0,
            "for_all": False,
            "latest": None,
            "open_groups": set(),
            "open_student_targets": 0,
            "open_for_all": False,
            "open_count": 0,
            "latest_open_until": None,
            "open_has_no_until": False,
        }
        for test_id in test_ids
    }
    for row in activations:
        summary = summary_by_test.get(row.test_id)
        if summary is None:
            continue

        if summary["latest"] is None:
            summary["latest"] = row.activated_at

        if row.active_for_all:
            summary["for_all"] = True
        if row.target_group_id:
            summary["groups"].add(row.target_group_id)
        if row.target_student_id:
            summary["student_targets"] += 1

        if _is_activation_time_open(row, now):
            summary["open_count"] += 1
            if row.active_for_all:
                summary["open_for_all"] = True
            if row.target_group_id:
                summary["open_groups"].add(row.target_group_id)
            if row.target_student_id:
                summary["open_student_targets"] += 1

            row_until = row.available_until
            if row_until is None:
                summary["open_has_no_until"] = True
                summary["latest_open_until"] = row_until
            elif not summary.get("open_has_no_until"):
                current_latest = summary.get("latest_open_until")
                if current_latest is None or row_until > current_latest:
                    summary["latest_open_until"] = row_until

    payload = []
    for row in tests:
        base = row.to_dict()
        base["title"] = None
        summary = summary_by_test.get(row.id) or {}
        base["activation"] = {
            "latest": _to_utc_iso(summary.get("latest")),
            "for_all": bool(summary.get("for_all")),
            "groups": sorted(list(summary.get("groups") or [])),
            "student_targets": int(summary.get("student_targets") or 0),
            "active_now": bool(summary.get("open_count")),
            "open_count": int(summary.get("open_count") or 0),
            "open_for_all": bool(summary.get("open_for_all")),
            "open_groups": sorted(list(summary.get("open_groups") or [])),
            "open_student_targets": int(summary.get("open_student_targets") or 0),
            "latest_open_until": _to_utc_iso(summary.get("latest_open_until")),
        }
        payload.append(base)

    return jsonify(payload), 200


@tests_bp.post("/tests/start")
@token_required
def start_test():
    user = g.current_user
    if user.role != "student":
        return jsonify({"error": "Only student can start test"}), 403

    data = request.get_json(silent=True) or {}
    test_id = data.get("test_id")
    if not test_id:
        return jsonify({"error": "test_id is required"}), 400

    test = Test.query.get(test_id)
    if not test:
        return jsonify({"error": "Test not found"}), 404

    existing_attempt = TestAttempt.query.filter_by(test_id=test.id, student_id=user.id).first()
    if existing_attempt and _is_student_attempt_submitted(existing_attempt):
        return jsonify({"error": "Attempt already exists. Retake is forbidden"}), 400

    if existing_attempt and not _is_student_attempt_submitted(existing_attempt):
        deadline = _attempt_deadline(test, existing_attempt)
        existing_attempt.expires_at = deadline
        if _utcnow() >= deadline:
            payload = _finalize_attempt_record(test, user, existing_attempt, now=_utcnow())
            db.session.commit()
            return jsonify(payload), 200

        question_rows = _ordered_attempt_questions(test, user, existing_attempt)
        if not question_rows:
            return jsonify({"error": "Test has no questions"}), 400

        payload = _student_attempt_payload(test, user, existing_attempt, question_rows)
        return jsonify(payload), 200

    activation = _latest_activation_for_student(test.id, user)
    if not activation:
        return jsonify({"error": "Test is not activated for this student"}), 403

    started_at = _utcnow()
    expires_at = started_at + timedelta(minutes=test.timer_minutes)
    question_rows = _build_seeded_question_set(test, user.id, activation.id)
    if not question_rows:
        return jsonify({"error": "Test has no questions"}), 400

    question_ids = [int(row["id"]) for row in question_rows]

    attempt = TestAttempt(
        test_id=test.id,
        student_id=user.id,
        activation_id=activation.id,
        started_at=started_at,
        expires_at=expires_at,
        submitted_at=started_at,
        is_submitted=False,
        score=0,
        total_questions=len(question_rows),
        question_ids_json=json.dumps(question_ids, ensure_ascii=False),
        answers_json=json.dumps({}, ensure_ascii=False),
    )

    db.session.add(attempt)
    db.session.commit()

    payload = _student_attempt_payload(test, user, attempt, question_rows)
    return jsonify(payload), 200


@tests_bp.post("/tests/progress")
@token_required
def sync_test_progress():
    user = g.current_user
    if user.role != "student":
        return jsonify({"error": "Only student can sync test progress"}), 403

    data = request.get_json(silent=True) or {}
    test_id = data.get("test_id")
    incoming_answers = data.get("answers")

    if not test_id or not isinstance(incoming_answers, dict):
        return jsonify({"error": "test_id and answers(dict) are required"}), 400

    test = Test.query.get(test_id)
    if not test:
        return jsonify({"error": "Test not found"}), 404

    attempt = TestAttempt.query.filter_by(test_id=test.id, student_id=user.id).first()
    if not attempt or _is_student_attempt_submitted(attempt):
        return jsonify({"error": "Active attempt not found"}), 404

    now = _utcnow()
    attempt.expires_at = _attempt_deadline(test, attempt)
    if now >= attempt.expires_at:
        payload = _finalize_attempt_record(test, user, attempt, now=now)
        db.session.commit()
        payload["status"] = "auto_submitted"
        payload["error"] = "Timer is expired"
        return jsonify(payload), 409

    stored = _attempt_answers_dict(attempt)
    merged = _merge_answers(stored, incoming_answers)

    attempt.answers_json = json.dumps(merged, ensure_ascii=False)
    db.session.commit()

    question_rows = _ordered_attempt_questions(test, user, attempt)
    total_questions = len(question_rows)
    answered_count = _answered_count(question_rows, merged)
    remaining_seconds = (
        max(0, int((attempt.expires_at - now).total_seconds())) if attempt.expires_at else 0
    )

    return jsonify(
        {
            "status": "saved",
            "test_id": test.id,
            "answered_count": answered_count,
            "total_questions": total_questions,
            "remaining_seconds": remaining_seconds,
            "expires_at": _to_utc_iso(attempt.expires_at),
        }
    ), 200


@tests_bp.post("/tests/submit")
@token_required
def submit_test():
    user = g.current_user
    if user.role != "student":
        return jsonify({"error": "Only student can submit tests"}), 403

    data = request.get_json(silent=True) or {}
    test_id = data.get("test_id")
    incoming_answers = data.get("answers")

    if not test_id:
        return jsonify({"error": "test_id is required"}), 400

    if incoming_answers is not None and not isinstance(incoming_answers, dict):
        return jsonify({"error": "answers must be dict"}), 400

    test = Test.query.get(test_id)
    if not test:
        return jsonify({"error": "Test not found"}), 404

    attempt = TestAttempt.query.filter_by(test_id=test.id, student_id=user.id).first()
    if not attempt:
        return jsonify({"error": "Attempt is not started"}), 400

    if _is_student_attempt_submitted(attempt):
        return (
            jsonify(
                {
                    "status": "submitted",
                    "test_id": test.id,
                    "student_id": user.id,
                    "score": attempt.score,
                    "total_questions": attempt.total_questions,
                    "submitted_at": _to_utc_iso(attempt.submitted_at),
                }
            ),
            200,
        )

    question_rows = _ordered_attempt_questions(test, user, attempt)
    total_questions = len(question_rows)
    if total_questions == 0:
        return jsonify({"error": "Test has no questions"}), 400

    stored_answers = _attempt_answers_dict(attempt)
    merged_answers = dict(stored_answers)
    if isinstance(incoming_answers, dict):
        merged_answers = _merge_answers(merged_answers, incoming_answers)

    now = _utcnow()
    expires_at = _attempt_deadline(test, attempt)
    attempt.expires_at = expires_at

    answered_count = _answered_count(question_rows, merged_answers)
    if now < expires_at and answered_count < total_questions:
        return (
            jsonify(
                {
                    "error": "Test can be finished only when all questions are answered or timer is expired",
                    "answered": answered_count,
                    "total": total_questions,
                    "expires_at": _to_utc_iso(expires_at),
                }
            ),
            400,
        )

    payload = _finalize_attempt_record(test, user, attempt, now=now, answers_override=merged_answers)

    db.session.commit()

    return jsonify(payload), 200


def _rating_by_total(total_points: int):
    score = int(total_points or 0)
    if score >= 80:
        return "excellent"
    if score >= 70:
        return "good"
    if score >= 60:
        return "satisfactory"
    return "unsatisfactory"


def _module_summary_payload(student: User):
    attempts = (
        TestAttempt.query.filter_by(student_id=student.id, is_submitted=True)
        .order_by(TestAttempt.submitted_at.desc())
        .all()
    )
    test_ids = [row.test_id for row in attempts]
    test_map = {}
    if test_ids:
        tests = Test.query.filter(Test.id.in_(test_ids)).all()
        test_map = {row.id: row for row in tests}

    subjects_map = {}

    def ensure_subject(name):
        key = str(name or "General").strip() or "General"
        if key not in subjects_map:
            subjects_map[key] = {
                "subject": key,
                "module1_test_raw": 0,
                "module2_test_raw": 0,
                "module1_teacher_sum": 0,
                "module2_teacher_sum": 0,
                "exam_sum": 0,
                "bonus_sum": 0,
                "last_submitted_at": None,
                "last_updated_at": None,
                "comment": None,
                "teacher_entries": [],
            }
        return subjects_map[key]

    student_group_name = str(student.group_id or "").strip()
    if student_group_name:
        group_row = StudyGroup.query.filter(
            func.lower(StudyGroup.name) == student_group_name.lower()
        ).first()
        if group_row:
            binding_rows = TeacherGroupBinding.query.filter_by(group_id=group_row.id).all()
            for binding in binding_rows:
                ensure_subject(binding.subject)

    for attempt in attempts:
        test = test_map.get(attempt.test_id)
        if not test:
            continue
        subject = str(test.subject or "General").strip() or "General"
        row = ensure_subject(subject)
        module_no = int(test.module_no or 1)
        if module_no == 1:
            row["module1_test_raw"] += int(attempt.score or 0)
        elif module_no == 2:
            row["module2_test_raw"] += int(attempt.score or 0)

        submitted_at = attempt.submitted_at
        if submitted_at and (
            row["last_submitted_at"] is None or submitted_at > row["last_submitted_at"]
        ):
            row["last_submitted_at"] = submitted_at

    teacher_rows = (
        ModuleScoreEntry.query.filter_by(student_id=student.id)
        .order_by(ModuleScoreEntry.updated_at.desc(), ModuleScoreEntry.id.desc())
        .all()
    )
    teacher_ids = {row.teacher_id for row in teacher_rows if row.teacher_id}
    teacher_map = {}
    if teacher_ids:
        teacher_users = User.query.filter(User.id.in_(list(teacher_ids))).all()
        teacher_map = {row.id: row for row in teacher_users}

    for row in teacher_rows:
        subject = str(row.subject or "General").strip() or "General"
        target = ensure_subject(subject)
        teacher_user = teacher_map.get(row.teacher_id)
        target["teacher_entries"].append(
            {
                "id": row.id,
                "teacher_id": row.teacher_id,
                "teacher_login": teacher_user.login if teacher_user else None,
                "subject": subject,
                "module1_points": row.module1_points,
                "module2_points": row.module2_points,
                "exam_points": int(row.exam_points or 0),
                "bonus_points": int(row.bonus_points or 0),
                "comment": row.comment,
                "updated_at": _to_utc_iso(row.updated_at),
            }
        )
        target["module1_teacher_sum"] += int(row.module1_points or 0)
        target["module2_teacher_sum"] += int(row.module2_points or 0)
        target["exam_sum"] += int(row.exam_points or 0)
        target["bonus_sum"] += int(row.bonus_points or 0)

        if row.updated_at and (
            target["last_updated_at"] is None or row.updated_at > target["last_updated_at"]
        ):
            target["last_updated_at"] = row.updated_at
            target["comment"] = row.comment

    subject_rows = []
    for subject_name, row in subjects_map.items():
        module1_test_score = min(30, int(row["module1_test_raw"] or 0))
        module2_test_score = min(30, int(row["module2_test_raw"] or 0))
        module1_teacher_points = min(10, max(0, int(row["module1_teacher_sum"] or 0)))
        module2_teacher_points = min(30, max(0, int(row["module2_teacher_sum"] or 0)))
        exam_points = min(20, max(0, int(row["exam_sum"] or 0)))
        bonus_points = min(10, max(0, int(row["bonus_sum"] or 0)))

        module1_total = module1_test_score + module1_teacher_points
        module2_total = module2_test_score + module2_teacher_points
        test_total = int(module1_test_score + module2_test_score)
        journal_total = int(module1_teacher_points + module2_teacher_points + exam_points + bonus_points)
        total_points_raw = int(module1_total + module2_total + exam_points + bonus_points)
        total_points = min(100, total_points_raw)

        last_dt = row["last_submitted_at"]
        if row["last_updated_at"] and (last_dt is None or row["last_updated_at"] > last_dt):
            last_dt = row["last_updated_at"]

        subject_rows.append(
            {
                "subject": subject_name,
                "module1": {
                    "test_points_raw": int(row["module1_test_raw"] or 0),
                    "test_points_capped": int(module1_test_score),
                    "teacher_points": int(module1_teacher_points),
                    "module_points": int(module1_total),
                    "max_test_points": 30,
                    "max_teacher_points": 10,
                },
                "module2": {
                    "test_points_raw": int(row["module2_test_raw"] or 0),
                    "test_points_capped": int(module2_test_score),
                    "teacher_points": int(module2_teacher_points),
                    "module_points": int(module2_total),
                    "max_test_points": 30,
                    "max_teacher_points": 30,
                },
                "exam": {
                    "points": int(exam_points),
                    "max_points": 20,
                },
                "bonus": {
                    "points": int(bonus_points),
                    "max_points": 10,
                },
                "test_total_points": int(test_total),
                "journal_total_points": int(journal_total),
                "total_points_raw": int(total_points_raw),
                "total_points": int(total_points),
                "rating": _rating_by_total(total_points),
                "last_date": _to_utc_iso(last_dt),
                "comment": row["comment"],
                "teacher_entries": row["teacher_entries"],
            }
        )

    subject_rows.sort(key=lambda item: str(item.get("subject") or "").lower())

    if subject_rows:
        aggregate_test_total = int(sum(int(item.get("test_total_points") or 0) for item in subject_rows))
        aggregate_journal_total = int(sum(int(item.get("journal_total_points") or 0) for item in subject_rows))
        aggregate_total = int(sum(int(item.get("total_points") or 0) for item in subject_rows))
    else:
        aggregate_test_total = 0
        aggregate_journal_total = 0
        aggregate_total = 0

    first_subject = subject_rows[0] if subject_rows else None
    return {
        "student_id": student.id,
        "module1": first_subject.get("module1") if first_subject else {
            "test_points_raw": 0,
            "test_points_capped": 0,
            "teacher_points": 0,
            "module_points": 0,
            "max_test_points": 30,
            "max_teacher_points": 10,
        },
        "module2": first_subject.get("module2") if first_subject else {
            "test_points_raw": 0,
            "test_points_capped": 0,
            "teacher_points": 0,
            "module_points": 0,
            "max_test_points": 30,
            "max_teacher_points": 30,
        },
        "exam": first_subject.get("exam") if first_subject else {"points": 0, "max_points": 20},
        "bonus": first_subject.get("bonus") if first_subject else {"points": 0, "max_points": 10},
        "test_total_points": aggregate_test_total,
        "journal_total_points": aggregate_journal_total,
        "total_points": aggregate_total,
        "rating": _rating_by_total(aggregate_total),
        "thresholds": {
            "satisfactory_from": 60,
            "good_from": 70,
            "excellent_from": 80,
        },
        "comment": first_subject.get("comment") if first_subject else None,
        "updated_at": first_subject.get("last_date") if first_subject else None,
        "teacher_entries": [
            item
            for subject_item in subject_rows
            for item in (subject_item.get("teacher_entries") or [])
        ],
        "selected_teacher_id": None,
        "subjects": subject_rows,
    }


@tests_bp.get("/tests/module-summary/<student_ref>")
@token_required
def get_module_summary(student_ref: str):
    user = g.current_user
    if user.role not in {"admin", "teacher", "student"}:
        return jsonify({"error": "Forbidden"}), 403

    preferred_group = user.group_id if user.role == "student" else None
    student, resolve_error = resolve_student_user(student_ref, preferred_group=preferred_group)
    if resolve_error == "ambiguous":
        return jsonify({"error": "Student identifier is ambiguous. Use full login"}), 409
    if not student or student.role != "student":
        return jsonify({"error": "Student not found"}), 404

    if user.role == "student" and user.id != student.id:
        return jsonify({"error": "Forbidden"}), 403
    if user.role == "teacher" and not _teacher_can_access_student(user.id, student):
        return jsonify({"error": "Forbidden"}), 403

    return jsonify(_module_summary_payload(student)), 200


@tests_bp.post("/tests/module-summary")
@token_required
def upsert_module_summary():
    user = g.current_user
    if user.role != "teacher":
        return jsonify({"error": "Only teacher can edit module scores"}), 403

    data = request.get_json(silent=True) or {}
    student_ref = data.get("student_id") or data.get("student_code") or data.get("student_login")
    if not str(student_ref or "").strip():
        return jsonify({"error": "student_id is required"}), 400

    student, resolve_error = resolve_student_user(student_ref)
    if resolve_error == "ambiguous":
        return jsonify({"error": "Student identifier is ambiguous. Use full login"}), 409
    if not student or student.role != "student":
        return jsonify({"error": "Student not found"}), 404
    if not _teacher_can_access_student(user.id, student):
        return jsonify({"error": "Forbidden"}), 403

    subject = str(data.get("subject") or "").strip()
    teacher_subjects = _teacher_subjects(user.id)
    if subject:
        if teacher_subjects and subject not in teacher_subjects:
            return jsonify({"error": "subject must be one of teacher subjects"}), 400
    else:
        if len(teacher_subjects) == 1:
            subject = teacher_subjects[0]
        else:
            fallback_row = (
                ModuleScoreEntry.query.filter_by(student_id=student.id, teacher_id=user.id)
                .order_by(ModuleScoreEntry.updated_at.desc(), ModuleScoreEntry.id.desc())
                .first()
            )
            subject = str((fallback_row.subject if fallback_row else "General") or "General").strip() or "General"

    def parse_optional_int(field_name: str, min_value: int, max_value: int):
        raw = data.get(field_name)
        if raw is None or str(raw).strip() == "":
            return None, None
        try:
            value = int(raw)
        except (TypeError, ValueError):
            return None, f"{field_name} must be integer"
        if value < min_value or value > max_value:
            return None, f"{field_name} must be between {min_value} and {max_value}"
        return value, None

    module1_points, module1_error = parse_optional_int("module1_points", 0, 10)
    if module1_error:
        return jsonify({"error": module1_error}), 400

    module2_points, module2_error = parse_optional_int("module2_points", 0, 30)
    if module2_error:
        return jsonify({"error": module2_error}), 400

    bonus_points, bonus_error = parse_optional_int("bonus_points", 0, 10)
    if bonus_error:
        return jsonify({"error": bonus_error}), 400

    exam_points, exam_error = parse_optional_int("exam_points", 0, 20)
    if exam_error:
        return jsonify({"error": exam_error}), 400

    row = ModuleScoreEntry.query.filter_by(student_id=student.id, teacher_id=user.id, subject=subject).first()
    if row is None:
        row = ModuleScoreEntry(
            student_id=student.id,
            teacher_id=user.id,
            subject=subject,
            exam_points=0,
            bonus_points=0,
        )
        db.session.add(row)

    row.subject = subject
    if "module1_points" in data:
        row.module1_points = module1_points
    if "module2_points" in data:
        row.module2_points = module2_points
    if "bonus_points" in data:
        row.bonus_points = int(bonus_points or 0)
    if "exam_points" in data:
        row.exam_points = int(exam_points or 0)
    if "comment" in data:
        row.comment = str(data.get("comment") or "").strip() or None

    row.teacher_id = user.id
    row.updated_at = _utcnow()
    db.session.commit()

    return jsonify(_module_summary_payload(student)), 200
