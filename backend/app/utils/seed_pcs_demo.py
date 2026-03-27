"""
Модуль `app/utils/seed_pcs_demo.py`

Назначение:
- Наполнение БД демонстрационными данными учебной группы и тестов.

Ключевые константы и значения:
- `GROUP_ADMISSION_YEAR`: используется как конфигурационный или справочный набор значений в этом модуле.
- `GROUP_NAME`: используется как конфигурационный или справочный набор значений в этом модуле.
- `GROUP_SPECIALTY`: используется как конфигурационный или справочный набор значений в этом модуле.
- `SCHEDULE_TEMPLATE`: используется как конфигурационный или справочный набор значений в этом модуле.
- `STUDENT_NAMES`: используется как конфигурационный или справочный набор значений в этом модуле.
- `SUBJECT_HINTS`: используется как конфигурационный или справочный набор значений в этом модуле.
- `TEACHER_SPECS`: используется как конфигурационный или справочный набор значений в этом модуле.

Функции модуля:
- `_normalize_group_prefix`: Нормализует и приводит значения к безопасному формату.
- `_generate_student_login`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_ensure_group`: Гарантирует наличие/корректность структуры или данных.
- `_ensure_teacher`: Гарантирует наличие/корректность структуры или данных.
- `_ensure_binding`: Гарантирует наличие/корректность структуры или данных.
- `_cleanup_bindings_for_group`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_ensure_students`: Гарантирует наличие/корректность структуры или данных.
- `_rebuild_schedule`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_build_test_questions`: Формирует служебную структуру данных/ответ.
- `_upsert_test`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_collect_group_student_credentials`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `main`: Точка входа сценария при запуске файла как скрипта.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

import json
import re
from datetime import UTC, datetime

from app import create_app
from app.models import (
    ScheduleEntry,
    ScheduleTeacherLink,
    StudentProfile,
    StudyGroup,
    TeacherGroupBinding,
    TeacherProfile,
    Test,
    TestActivation,
    TestQuestion,
    User,
    db,
)
from app.services.auth_service import hash_password


GROUP_NAME = "pcs-1-23"
GROUP_ADMISSION_YEAR = 2023
GROUP_SPECIALTY = "Программирование в компьютерных системах"

TEACHER_SPECS = [
    {
        "login": "ivanov.ai",
        "password": "teach1001",
        "last_name": "Иванов",
        "first_name": "Алексей",
        "middle_name": "Игоревич",
        "subject": "Математика",
    },
    {
        "login": "petrova.ev",
        "password": "teach1002",
        "last_name": "Петрова",
        "first_name": "Елена",
        "middle_name": "Викторовна",
        "subject": "Программирование",
    },
    {
        "login": "smirnov.dn",
        "password": "teach1003",
        "last_name": "Смирнов",
        "first_name": "Дмитрий",
        "middle_name": "Николаевич",
        "subject": "Базы данных",
    },
    {
        "login": "sadykova.as",
        "password": "teach1004",
        "last_name": "Садыкова",
        "first_name": "Айжан",
        "middle_name": "Сагынбековна",
        "subject": "Английский язык",
    },
    {
        "login": "akhmetov.tk",
        "password": "teach1005",
        "last_name": "Ахметов",
        "first_name": "Тимур",
        "middle_name": "Кайратович",
        "subject": "Сети и телекоммуникации",
    },
]

STUDENT_NAMES = [
    ("Кузнецов", "Илья", "Андреевич"),
    ("Соколова", "Мария", "Александровна"),
    ("Орлов", "Никита", "Павлович"),
    ("Ибраимов", "Бекзат", "Талантович"),
    ("Пак", "Диана", "Сергеевна"),
    ("Абдуллаев", "Темирлан", "Русланович"),
    ("Жумаева", "Алина", "Эрмековна"),
    ("Токтогулов", "Нурислам", "Бакытович"),
    ("Миронова", "Екатерина", "Игоревна"),
    ("Садыров", "Арсен", "Замирович"),
    ("Назарова", "Ангелина", "Олеговна"),
    ("Ким", "Роман", "Владимирович"),
    ("Серикова", "Айпери", "Нурбековна"),
    ("Осмонов", "Самат", "Эмилевич"),
    ("Байматова", "Элина", "Аскаровна"),
]

SCHEDULE_TEMPLATE = [
    {"day": "Monday", "start": "08:30", "end": "10:00", "subject": "Математика", "room": "А-101"},
    {"day": "Monday", "start": "10:10", "end": "11:40", "subject": "Программирование", "room": "Лаб-204"},
    {"day": "Tuesday", "start": "08:30", "end": "10:00", "subject": "Базы данных", "room": "Лаб-205"},
    {"day": "Tuesday", "start": "10:10", "end": "11:40", "subject": "Английский язык", "room": "Б-302"},
    {"day": "Wednesday", "start": "08:30", "end": "10:00", "subject": "Сети и телекоммуникации", "room": "Лаб-207"},
    {"day": "Wednesday", "start": "10:10", "end": "11:40", "subject": "Программирование", "room": "Лаб-204"},
    {"day": "Thursday", "start": "08:30", "end": "10:00", "subject": "Математика", "room": "А-101"},
    {"day": "Thursday", "start": "10:10", "end": "11:40", "subject": "Базы данных", "room": "Лаб-205"},
    {"day": "Friday", "start": "08:30", "end": "10:00", "subject": "Английский язык", "room": "Б-302"},
    {"day": "Friday", "start": "10:10", "end": "11:40", "subject": "Сети и телекоммуникации", "room": "Лаб-207"},
]

SUBJECT_HINTS = {
    "Математика": "алгебра",
    "Программирование": "код",
    "Базы данных": "SQL",
    "Английский язык": "grammar",
    "Сети и телекоммуникации": "network",
}


def _normalize_group_prefix(group_name: str) -> str:
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


def _generate_student_login(group_name: str):
    prefix = _normalize_group_prefix(group_name)
    pattern = re.compile(rf"^{re.escape(prefix)}-(\d{{4}})$", re.IGNORECASE)

    rows = User.query.filter(User.login.ilike(f"{prefix}-%")).all()
    max_suffix = 0

    for row in rows:
        value = str(row.login or "").strip().lower()
        match = pattern.match(value)
        if not match:
            continue
        suffix = int(match.group(1))
        if suffix > max_suffix:
            max_suffix = suffix

    next_suffix = max_suffix + 1
    while next_suffix <= 9999:
        code = f"{next_suffix:04d}"
        candidate = f"{prefix}-{code}"
        exists = User.query.filter(User.login.ilike(candidate)).first()
        if not exists:
            return candidate, code
        next_suffix += 1

    raise RuntimeError("Не удалось сгенерировать логин для студента")


def _ensure_group():
    group = StudyGroup.query.filter(StudyGroup.name.ilike(GROUP_NAME)).first()
    if not group:
        group = StudyGroup(
            name=GROUP_NAME,
            admission_year=GROUP_ADMISSION_YEAR,
            specialty=GROUP_SPECIALTY,
        )
        db.session.add(group)
        db.session.flush()
    else:
        group.admission_year = GROUP_ADMISSION_YEAR
        group.specialty = GROUP_SPECIALTY

    return group


def _ensure_teacher(spec):
    login = spec["login"].strip().lower()
    user = User.query.filter(User.login.ilike(login)).first()

    if not user:
        user = User(
            login=login,
            password_hash=hash_password(spec["password"]),
            role="teacher",
            group_id=None,
        )
        db.session.add(user)
        db.session.flush()
    else:
        user.role = "teacher"
        user.group_id = None
        user.password_hash = hash_password(spec["password"])

    profile = TeacherProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        profile = TeacherProfile(
            user_id=user.id,
            last_name=spec["last_name"],
            first_name=spec["first_name"],
            middle_name=spec["middle_name"],
            subjects_json=json.dumps([spec["subject"]], ensure_ascii=False),
        )
        db.session.add(profile)
    else:
        profile.last_name = spec["last_name"]
        profile.first_name = spec["first_name"]
        profile.middle_name = spec["middle_name"]
        profile.subjects_json = json.dumps([spec["subject"]], ensure_ascii=False)

    return user, profile


def _ensure_binding(teacher_id: int, group_id: int, subject: str):
    row = TeacherGroupBinding.query.filter_by(
        teacher_id=teacher_id,
        group_id=group_id,
        subject=subject,
    ).first()
    if row:
        return row

    row = TeacherGroupBinding(
        teacher_id=teacher_id,
        group_id=group_id,
        subject=subject,
    )
    db.session.add(row)
    return row


def _cleanup_bindings_for_group(group_id: int, allowed_teacher_ids, allowed_subjects):
    allowed_teacher_ids = set(allowed_teacher_ids)
    allowed_subjects = set(allowed_subjects)

    rows = TeacherGroupBinding.query.filter_by(group_id=group_id).all()
    for row in rows:
        if row.teacher_id not in allowed_teacher_ids or row.subject not in allowed_subjects:
            db.session.delete(row)


def _ensure_students(group):
    current_students = (
        User.query.filter_by(role="student", group_id=group.name)
        .order_by(User.login.asc())
        .all()
    )
    existing_ids = [row.id for row in current_students]
    profiles = (
        StudentProfile.query.filter(StudentProfile.user_id.in_(existing_ids)).all()
        if existing_ids
        else []
    )
    profile_by_user = {row.user_id: row for row in profiles}

    existing_name_set = {
        (
            (profile_by_user[row.id].last_name if row.id in profile_by_user else "").strip().lower(),
            (profile_by_user[row.id].first_name if row.id in profile_by_user else "").strip().lower(),
            (profile_by_user[row.id].middle_name if row.id in profile_by_user and profile_by_user[row.id].middle_name else "").strip().lower(),
        )
        for row in current_students
    }

    created_credentials = []
    for last_name, first_name, middle_name in STUDENT_NAMES:
        key = (last_name.strip().lower(), first_name.strip().lower(), middle_name.strip().lower())
        if key in existing_name_set:
            continue

        current_count = User.query.filter_by(role="student", group_id=group.name).count()
        if current_count >= 15:
            break

        login, suffix = _generate_student_login(group.name)
        user = User(
            login=login,
            password_hash=hash_password(suffix),
            role="student",
            group_id=group.name,
        )
        db.session.add(user)
        db.session.flush()

        profile = StudentProfile(
            user_id=user.id,
            group_ref_id=group.id,
            last_name=last_name,
            first_name=first_name,
            middle_name=middle_name,
        )
        db.session.add(profile)

        created_credentials.append((login, suffix, last_name, first_name))
        existing_name_set.add(key)

    # Safety fallback: if after fixed list still < 15, add generated placeholders.
    while User.query.filter_by(role="student", group_id=group.name).count() < 15:
        idx = User.query.filter_by(role="student", group_id=group.name).count() + 1
        last_name = f"Студент{idx}"
        first_name = "Тестовый"
        middle_name = "Демо"
        login, suffix = _generate_student_login(group.name)

        user = User(
            login=login,
            password_hash=hash_password(suffix),
            role="student",
            group_id=group.name,
        )
        db.session.add(user)
        db.session.flush()

        db.session.add(
            StudentProfile(
                user_id=user.id,
                group_ref_id=group.id,
                last_name=last_name,
                first_name=first_name,
                middle_name=middle_name,
            )
        )
        created_credentials.append((login, suffix, last_name, first_name))

    return created_credentials


def _rebuild_schedule(group, teachers_by_subject):
    old_rows = ScheduleEntry.query.filter_by(group_id=group.name).all()
    for row in old_rows:
        links = ScheduleTeacherLink.query.filter_by(schedule_entry_id=row.id).all()
        for link in links:
            db.session.delete(link)
        db.session.delete(row)
    db.session.flush()

    for item in SCHEDULE_TEMPLATE:
        subject = item["subject"]
        teacher = teachers_by_subject[subject]
        row = ScheduleEntry(
            group_id=group.name,
            day_of_week=item["day"],
            start_time=item["start"],
            end_time=item["end"],
            subject=subject,
            room=item["room"],
        )
        db.session.add(row)
        db.session.flush()
        db.session.add(
            ScheduleTeacherLink(schedule_entry_id=row.id, teacher_id=teacher.id)
        )


def _build_test_questions(subject: str, total: int = 30):
    questions = []
    hint = SUBJECT_HINTS.get(subject, "topic")
    for i in range(1, total + 1):
        options = [
            f"{hint.upper()}-A{i}",
            f"{hint.upper()}-B{i}",
            f"{hint.upper()}-C{i}",
            f"{hint.upper()}-D{i}",
        ]
        correct = options[(i - 1) % 4]
        questions.append(
            {
                "text": f"{subject}: учебный вопрос №{i}",
                "options": options,
                "correct_answer": correct,
            }
        )
    return questions


def _upsert_test(subject: str, teacher_id: int):
    title = f"{subject} — тест для {GROUP_NAME.upper()}"
    test = Test.query.filter_by(title=title, subject=subject).first()

    if not test:
        test = Test(
            title=title,
            subject=subject,
            timer_minutes=35,
            questions_to_use=20,
            created_by=teacher_id,
            created_at=datetime.now(UTC).replace(tzinfo=None),
        )
        db.session.add(test)
        db.session.flush()
    else:
        test.timer_minutes = 35
        test.questions_to_use = 20
        test.created_by = teacher_id
        old_questions = TestQuestion.query.filter_by(test_id=test.id).all()
        for row in old_questions:
            db.session.delete(row)
        db.session.flush()

    questions = _build_test_questions(subject, total=30)
    for index, row in enumerate(questions, start=1):
        db.session.add(
            TestQuestion(
                test_id=test.id,
                text=row["text"],
                options_json=json.dumps(row["options"], ensure_ascii=False),
                correct_answer=row["correct_answer"],
                order_index=index,
            )
        )

    activation = TestActivation.query.filter_by(
        test_id=test.id,
        active_for_all=True,
    ).first()
    if not activation:
        db.session.add(
            TestActivation(
                test_id=test.id,
                activated_by=1,  # admin
                active_for_all=True,
                target_student_id=None,
            )
        )


def _collect_group_student_credentials(group_name: str):
    pattern = re.compile(rf"^{re.escape(_normalize_group_prefix(group_name))}-(\d{{4}})$", re.IGNORECASE)
    rows = (
        User.query.filter_by(role="student", group_id=group_name)
        .order_by(User.login.asc())
        .all()
    )
    result = []
    for row in rows:
        password = "----"
        match = pattern.match(str(row.login or ""))
        if match:
            password = match.group(1)
        result.append((row.login, password))
    return result


def main():
    app = create_app()
    with app.app_context():
        group = _ensure_group()

        teachers_by_subject = {}
        teacher_users = []
        for spec in TEACHER_SPECS:
            user, _ = _ensure_teacher(spec)
            teacher_users.append(user)
            teachers_by_subject[spec["subject"]] = user

        db.session.flush()

        _cleanup_bindings_for_group(
            group.id,
            allowed_teacher_ids=[row.id for row in teacher_users],
            allowed_subjects=[row["subject"] for row in TEACHER_SPECS],
        )

        for spec in TEACHER_SPECS:
            _ensure_binding(teachers_by_subject[spec["subject"]].id, group.id, spec["subject"])

        created_students = _ensure_students(group)
        _rebuild_schedule(group, teachers_by_subject)

        for spec in TEACHER_SPECS:
            _upsert_test(spec["subject"], teachers_by_subject[spec["subject"]].id)

        db.session.commit()

        students_total = User.query.filter_by(role="student", group_id=group.name).count()
        teachers_total = len(teacher_users)
        bindings_total = TeacherGroupBinding.query.filter_by(group_id=group.id).count()
        schedule_total = ScheduleEntry.query.filter_by(group_id=group.name).count()
        tests_total = Test.query.filter(Test.subject.in_([row["subject"] for row in TEACHER_SPECS])).count()
        creds = _collect_group_student_credentials(group.name)

        print("SEED_DONE")
        print(f"group={group.name}")
        print(f"students_total={students_total}")
        print(f"teachers_total={teachers_total}")
        print(f"subjects_total={len(TEACHER_SPECS)}")
        print(f"bindings_total={bindings_total}")
        print(f"schedule_entries={schedule_total}")
        print(f"tests_total={tests_total}")
        print(f"new_students_created={len(created_students)}")
        print("student_credentials:")
        for login, password in creds:
            print(f"  {login} / {password}")


if __name__ == "__main__":
    main()
