"""
Модуль `app/__init__.py`

Назначение:
- Сборка приложения Flask, подключение маршрутов, инициализация БД и миграционные дообновления.

Ключевые константы и значения:
- `_TEST_FINALIZER_LOCK`: используется как конфигурационный или справочный набор значений в этом модуле.
- `_TEST_FINALIZER_THREAD`: используется как конфигурационный или справочный набор значений в этом модуле.

Функции модуля:
- `register_blueprints`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `seed_default_admin`: Заполняет систему начальными данными.
- `normalize_legacy_roles`: Нормализует и приводит значения к безопасному формату.
- `ensure_schema_updates`: Гарантирует наличие/корректность структуры или данных.
- `configure_cors`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_test_finalizer_loop`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `ensure_background_workers`: Гарантирует наличие/корректность структуры или данных.
- `create_app`: Создает новую сущность или запись.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

import os
import threading
import time

from flask import Flask, jsonify
from sqlalchemy import text

from config import Config
from app.extensions import db
from app.models import User
from app.services.auth_service import hash_password, verify_password

_TEST_FINALIZER_THREAD = None
_TEST_FINALIZER_LOCK = threading.Lock()


def register_blueprints(app: Flask):
    from app.routes.academy import academy_bp
    from app.routes.attendance import attendance_bp
    from app.routes.auth import auth_bp
    from app.routes.books import books_bp
    from app.routes.chat import chat_bp
    from app.routes.exports import exports_bp
    from app.routes.grades import grades_bp
    from app.routes.homework import homework_bp
    from app.routes.news import news_bp
    from app.routes.schedule import schedule_bp
    from app.routes.support import support_bp
    from app.routes.tests import tests_bp
    from app.routes.users import users_bp

    blueprints = [
        auth_bp,
        academy_bp,
        users_bp,
        grades_bp,
        attendance_bp,
        homework_bp,
        schedule_bp,
        tests_bp,
        chat_bp,
        exports_bp,
        support_bp,
        books_bp,
        news_bp,
    ]

    for bp in blueprints:
        app.register_blueprint(bp)


def seed_default_admin():
    admin = User.query.filter_by(login="admin").first()
    default_password = "admin123"

    if admin:
        # Keep development environment predictable: ensure admin/admin123 always works.
        if not verify_password(default_password, admin.password_hash):
            admin.password_hash = hash_password(default_password)
            admin.role = "admin"
            db.session.commit()
        return

    admin_user = User(
        login="admin",
        password_hash=hash_password(default_password),
        role="admin",
        group_id=None,
    )
    db.session.add(admin_user)
    db.session.commit()


def normalize_legacy_roles():
    legacy_users = User.query.filter_by(role="content_manager").all()
    if not legacy_users:
        return

    for row in legacy_users:
        row.role = "scheduler"
    db.session.commit()


def ensure_schema_updates():
    # All migration SQL below is SQLite-specific legacy compatibility logic.
    # For PostgreSQL (Supabase), schema should be managed via explicit SQL migrations.
    if db.engine.dialect.name != "sqlite":
        return

    # Lightweight SQLite-safe migration for existing local database files.
    with db.engine.begin() as conn:
        info_rows = conn.execute(text("PRAGMA table_info(news)")).fetchall()
        news_columns = {row[1] for row in info_rows}

        if "image_url" not in news_columns:
            conn.execute(text("ALTER TABLE news ADD COLUMN image_url VARCHAR(500)"))
        if "kind" not in news_columns:
            conn.execute(text("ALTER TABLE news ADD COLUMN kind VARCHAR(32) DEFAULT 'news'"))
        if "target_group" not in news_columns:
            conn.execute(text("ALTER TABLE news ADD COLUMN target_group VARCHAR(64)"))
        if "target_day" not in news_columns:
            conn.execute(text("ALTER TABLE news ADD COLUMN target_day VARCHAR(20)"))
        if "target_lesson" not in news_columns:
            conn.execute(text("ALTER TABLE news ADD COLUMN target_lesson VARCHAR(20)"))
        if "target_start_time" not in news_columns:
            conn.execute(text("ALTER TABLE news ADD COLUMN target_start_time VARCHAR(10)"))
        if "target_end_time" not in news_columns:
            conn.execute(text("ALTER TABLE news ADD COLUMN target_end_time VARCHAR(10)"))
        if "replacement_date" not in news_columns:
            conn.execute(text("ALTER TABLE news ADD COLUMN replacement_date VARCHAR(10)"))
        if "author_name" not in news_columns:
            conn.execute(text("ALTER TABLE news ADD COLUMN author_name VARCHAR(255)"))
        if "target_groups_json" not in news_columns:
            conn.execute(text("ALTER TABLE news ADD COLUMN target_groups_json TEXT"))
        if "is_active" not in news_columns:
            conn.execute(text("ALTER TABLE news ADD COLUMN is_active BOOLEAN DEFAULT 1"))
        if "archived_at" not in news_columns:
            conn.execute(text("ALTER TABLE news ADD COLUMN archived_at DATETIME"))

        test_rows = conn.execute(text("PRAGMA table_info(tests)")).fetchall()
        test_columns = {row[1] for row in test_rows}

        if "subject" not in test_columns:
            conn.execute(text("ALTER TABLE tests ADD COLUMN subject VARCHAR(120)"))

        if "questions_to_use" not in test_columns:
            conn.execute(text("ALTER TABLE tests ADD COLUMN questions_to_use INTEGER"))
        if "module_no" not in test_columns:
            conn.execute(text("ALTER TABLE tests ADD COLUMN module_no INTEGER DEFAULT 1"))
        conn.execute(text("UPDATE tests SET module_no = 1 WHERE module_no IS NULL"))

        test_activation_rows = conn.execute(text("PRAGMA table_info(test_activations)")).fetchall()
        test_activation_columns = {row[1] for row in test_activation_rows}
        if "target_group_id" not in test_activation_columns:
            conn.execute(text("ALTER TABLE test_activations ADD COLUMN target_group_id VARCHAR(32)"))
        if "available_from" not in test_activation_columns:
            conn.execute(text("ALTER TABLE test_activations ADD COLUMN available_from DATETIME"))
        if "available_until" not in test_activation_columns:
            conn.execute(text("ALTER TABLE test_activations ADD COLUMN available_until DATETIME"))

        test_attempt_rows = conn.execute(text("PRAGMA table_info(test_attempts)")).fetchall()
        test_attempt_columns = {row[1] for row in test_attempt_rows}
        if "activation_id" not in test_attempt_columns:
            conn.execute(text("ALTER TABLE test_attempts ADD COLUMN activation_id INTEGER"))
        if "expires_at" not in test_attempt_columns:
            conn.execute(text("ALTER TABLE test_attempts ADD COLUMN expires_at DATETIME"))
        if "is_submitted" not in test_attempt_columns:
            conn.execute(text("ALTER TABLE test_attempts ADD COLUMN is_submitted BOOLEAN DEFAULT 1"))
        if "question_ids_json" not in test_attempt_columns:
            conn.execute(text("ALTER TABLE test_attempts ADD COLUMN question_ids_json TEXT DEFAULT '[]'"))
        conn.execute(text("UPDATE test_attempts SET is_submitted = 1 WHERE is_submitted IS NULL"))
        conn.execute(text("UPDATE test_attempts SET question_ids_json = '[]' WHERE question_ids_json IS NULL"))

        chat_rows = conn.execute(text("PRAGMA table_info(chat_messages)")).fetchall()
        chat_columns = {row[1] for row in chat_rows}
        if "attachment_url" not in chat_columns:
            conn.execute(text("ALTER TABLE chat_messages ADD COLUMN attachment_url VARCHAR(500)"))
        if "attachment_type" not in chat_columns:
            conn.execute(text("ALTER TABLE chat_messages ADD COLUMN attachment_type VARCHAR(50)"))
        if "reply_to_id" not in chat_columns:
            conn.execute(text("ALTER TABLE chat_messages ADD COLUMN reply_to_id INTEGER"))
        if "deleted_for_sender" not in chat_columns:
            conn.execute(text("ALTER TABLE chat_messages ADD COLUMN deleted_for_sender BOOLEAN DEFAULT 0"))
        if "deleted_for_receiver" not in chat_columns:
            conn.execute(text("ALTER TABLE chat_messages ADD COLUMN deleted_for_receiver BOOLEAN DEFAULT 0"))
        if "deleted_at_sender" not in chat_columns:
            conn.execute(text("ALTER TABLE chat_messages ADD COLUMN deleted_at_sender DATETIME"))
        if "deleted_at_receiver" not in chat_columns:
            conn.execute(text("ALTER TABLE chat_messages ADD COLUMN deleted_at_receiver DATETIME"))

        support_rows = conn.execute(text("PRAGMA table_info(support_messages)")).fetchall()
        support_columns = {row[1] for row in support_rows}
        if "attachment_url" not in support_columns:
            conn.execute(text("ALTER TABLE support_messages ADD COLUMN attachment_url VARCHAR(500)"))
        if "attachment_type" not in support_columns:
            conn.execute(text("ALTER TABLE support_messages ADD COLUMN attachment_type VARCHAR(50)"))

        user_rows = conn.execute(text("PRAGMA table_info(users)")).fetchall()
        user_columns = {row[1] for row in user_rows}
        if "avatar_url" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)"))

        book_rows = conn.execute(text("PRAGMA table_info(books)")).fetchall()
        book_columns = {row[1] for row in book_rows}
        if "description" not in book_columns:
            conn.execute(text("ALTER TABLE books ADD COLUMN description TEXT"))
        if "cover_url" not in book_columns:
            conn.execute(text("ALTER TABLE books ADD COLUMN cover_url VARCHAR(500)"))

        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS app_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key VARCHAR(120) NOT NULL UNIQUE,
                    value TEXT,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )

        homework_rows = conn.execute(text("PRAGMA table_info(homework)")).fetchall()
        homework_columns = {row[1] for row in homework_rows}
        if "subject" not in homework_columns:
            conn.execute(text("ALTER TABLE homework ADD COLUMN subject VARCHAR(120) DEFAULT 'General'"))
        if "target_student_id" not in homework_columns:
            conn.execute(text("ALTER TABLE homework ADD COLUMN target_student_id INTEGER"))
        if "is_active" not in homework_columns:
            conn.execute(text("ALTER TABLE homework ADD COLUMN is_active BOOLEAN DEFAULT 1"))
        if "archived_at" not in homework_columns:
            conn.execute(text("ALTER TABLE homework ADD COLUMN archived_at DATETIME"))
        conn.execute(text("UPDATE homework SET is_active = 1 WHERE is_active IS NULL"))

        homework_submission_rows = conn.execute(text("PRAGMA table_info(homework_submissions)")).fetchall()
        homework_submission_columns = {row[1] for row in homework_submission_rows}
        if homework_submission_rows:
            if "comment" not in homework_submission_columns:
                conn.execute(text("ALTER TABLE homework_submissions ADD COLUMN comment TEXT"))
            if "status" not in homework_submission_columns:
                conn.execute(
                    text("ALTER TABLE homework_submissions ADD COLUMN status VARCHAR(32) DEFAULT 'submitted'")
                )
            if "review_comment" not in homework_submission_columns:
                conn.execute(text("ALTER TABLE homework_submissions ADD COLUMN review_comment TEXT"))
            if "grade_value" not in homework_submission_columns:
                conn.execute(text("ALTER TABLE homework_submissions ADD COLUMN grade_value VARCHAR(20)"))
            if "grade_id" not in homework_submission_columns:
                conn.execute(text("ALTER TABLE homework_submissions ADD COLUMN grade_id INTEGER"))
            if "attachment_url" not in homework_submission_columns:
                conn.execute(text("ALTER TABLE homework_submissions ADD COLUMN attachment_url VARCHAR(500)"))
            if "attachment_type" not in homework_submission_columns:
                conn.execute(text("ALTER TABLE homework_submissions ADD COLUMN attachment_type VARCHAR(50)"))
            if "attachment_name" not in homework_submission_columns:
                conn.execute(text("ALTER TABLE homework_submissions ADD COLUMN attachment_name VARCHAR(255)"))
            if "is_active" not in homework_submission_columns:
                conn.execute(text("ALTER TABLE homework_submissions ADD COLUMN is_active BOOLEAN DEFAULT 1"))
            if "archived_at" not in homework_submission_columns:
                conn.execute(text("ALTER TABLE homework_submissions ADD COLUMN archived_at DATETIME"))
            if "submitted_at" not in homework_submission_columns:
                conn.execute(text("ALTER TABLE homework_submissions ADD COLUMN submitted_at DATETIME"))
            if "reviewed_at" not in homework_submission_columns:
                conn.execute(text("ALTER TABLE homework_submissions ADD COLUMN reviewed_at DATETIME"))
            if "updated_at" not in homework_submission_columns:
                conn.execute(text("ALTER TABLE homework_submissions ADD COLUMN updated_at DATETIME"))
            conn.execute(text("UPDATE homework_submissions SET status = 'submitted' WHERE status IS NULL"))
            conn.execute(text("UPDATE homework_submissions SET is_active = 1 WHERE is_active IS NULL"))
            conn.execute(
                text(
                    "UPDATE homework_submissions SET submitted_at = CURRENT_TIMESTAMP "
                    "WHERE submitted_at IS NULL"
                )
            )
            conn.execute(
                text(
                    "UPDATE homework_submissions SET updated_at = CURRENT_TIMESTAMP "
                    "WHERE updated_at IS NULL"
                )
            )

        teacher_profile_rows = conn.execute(text("PRAGMA table_info(teacher_profiles)")).fetchall()
        teacher_profile_columns = {row[1] for row in teacher_profile_rows}
        if "birth_date" not in teacher_profile_columns:
            conn.execute(text("ALTER TABLE teacher_profiles ADD COLUMN birth_date VARCHAR(10)"))
        if "biography" not in teacher_profile_columns:
            conn.execute(text("ALTER TABLE teacher_profiles ADD COLUMN biography TEXT"))

        student_profile_rows = conn.execute(text("PRAGMA table_info(student_profiles)")).fetchall()
        student_profile_columns = {row[1] for row in student_profile_rows}
        if "birth_date" not in student_profile_columns:
            conn.execute(text("ALTER TABLE student_profiles ADD COLUMN birth_date VARCHAR(10)"))
        if "biography" not in student_profile_columns:
            conn.execute(text("ALTER TABLE student_profiles ADD COLUMN biography TEXT"))

        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS module_score_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_id INTEGER NOT NULL,
                    teacher_id INTEGER NOT NULL,
                    subject VARCHAR(120) NOT NULL DEFAULT 'General',
                    module1_points INTEGER,
                    module2_points INTEGER,
                    exam_points INTEGER NOT NULL DEFAULT 0,
                    bonus_points INTEGER NOT NULL DEFAULT 0,
                    comment TEXT,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(student_id, teacher_id, subject)
                )
                """
            )
        )

        module_entry_rows = conn.execute(text("PRAGMA table_info(module_score_entries)")).fetchall()
        module_entry_columns = {row[1] for row in module_entry_rows}
        if "subject" not in module_entry_columns:
            conn.execute(text("ALTER TABLE module_score_entries ADD COLUMN subject VARCHAR(120)"))
            conn.execute(text("UPDATE module_score_entries SET subject = 'General' WHERE subject IS NULL OR TRIM(subject) = ''"))
        if "exam_points" not in module_entry_columns:
            conn.execute(text("ALTER TABLE module_score_entries ADD COLUMN exam_points INTEGER DEFAULT 0"))
            conn.execute(text("UPDATE module_score_entries SET exam_points = 0 WHERE exam_points IS NULL"))
        conn.execute(
            text("UPDATE module_score_entries SET subject = 'General' WHERE subject IS NULL OR TRIM(subject) = ''")
        )

        index_rows = conn.execute(text("PRAGMA index_list(module_score_entries)")).fetchall()
        unique_index_columns = set()
        for index_row in index_rows:
            index_name = index_row[1]
            is_unique = int(index_row[2] or 0) == 1
            if not is_unique or not index_name:
                continue

            safe_index_name = str(index_name).replace("'", "''")
            column_rows = conn.execute(text(f"PRAGMA index_info('{safe_index_name}')")).fetchall()
            columns = tuple(row[2] for row in column_rows if row[2])
            if columns:
                unique_index_columns.add(columns)

        if ("student_id", "teacher_id", "subject") not in unique_index_columns:
            conn.execute(
                text(
                    """
                    CREATE TABLE module_score_entries_v2 (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        student_id INTEGER NOT NULL,
                        teacher_id INTEGER NOT NULL,
                        subject VARCHAR(120) NOT NULL DEFAULT 'General',
                        module1_points INTEGER,
                        module2_points INTEGER,
                        exam_points INTEGER NOT NULL DEFAULT 0,
                        bonus_points INTEGER NOT NULL DEFAULT 0,
                        comment TEXT,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(student_id, teacher_id, subject)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    INSERT OR IGNORE INTO module_score_entries_v2
                    (id, student_id, teacher_id, subject, module1_points, module2_points, exam_points, bonus_points, comment, updated_at)
                    SELECT
                        id,
                        student_id,
                        teacher_id,
                        COALESCE(NULLIF(TRIM(subject), ''), 'General'),
                        module1_points,
                        module2_points,
                        COALESCE(exam_points, 0),
                        COALESCE(bonus_points, 0),
                        comment,
                        COALESCE(updated_at, CURRENT_TIMESTAMP)
                    FROM module_score_entries
                    """
                )
            )
            conn.execute(text("DROP TABLE module_score_entries"))
            conn.execute(text("ALTER TABLE module_score_entries_v2 RENAME TO module_score_entries"))

        has_legacy_module_scores = conn.execute(
            text(
                "SELECT name FROM sqlite_master "
                "WHERE type='table' AND name='module_scores'"
            )
        ).fetchone()
        module_entry_count = conn.execute(
            text("SELECT COUNT(*) FROM module_score_entries")
        ).scalar() or 0
        if has_legacy_module_scores and int(module_entry_count) == 0:
            conn.execute(
                text(
                    """
                    INSERT OR IGNORE INTO module_score_entries
                    (student_id, teacher_id, subject, module1_points, module2_points, exam_points, bonus_points, comment, updated_at)
                    SELECT
                        student_id,
                        teacher_id,
                        'General',
                        module1_points,
                        module2_points,
                        0,
                        COALESCE(bonus_points, 0),
                        comment,
                        COALESCE(updated_at, CURRENT_TIMESTAMP)
                    FROM module_scores
                    """
                )
            )


def configure_cors(app: Flask):
    @app.after_request
    def add_cors_headers(response):
        allow_origin = os.getenv("CORS_ALLOW_ORIGIN", "*")
        response.headers["Access-Control-Allow-Origin"] = allow_origin
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"

        if allow_origin != "*":
            existing_vary = response.headers.get("Vary")
            if existing_vary:
                if "Origin" not in existing_vary:
                    response.headers["Vary"] = f"{existing_vary}, Origin"
            else:
                response.headers["Vary"] = "Origin"

        return response


def _test_finalizer_loop(app: Flask):
    from app.routes.tests import auto_finalize_expired_attempts

    try:
        interval_seconds = max(
            3,
            int(os.getenv("TEST_AUTOFINALIZE_INTERVAL_SECONDS", "8")),
        )
    except (TypeError, ValueError):
        interval_seconds = 8

    with app.app_context():
        while True:
            try:
                finalized = auto_finalize_expired_attempts(limit=500)
                if finalized:
                    app.logger.info("Auto-submitted expired test attempts: %s", finalized)
            except Exception:
                db.session.rollback()
                app.logger.exception("Background expired-test finalizer failed")
            finally:
                db.session.remove()

            time.sleep(interval_seconds)


def ensure_background_workers(app: Flask):
    global _TEST_FINALIZER_THREAD

    with _TEST_FINALIZER_LOCK:
        if _TEST_FINALIZER_THREAD and _TEST_FINALIZER_THREAD.is_alive():
            return

        _TEST_FINALIZER_THREAD = threading.Thread(
            target=_test_finalizer_loop,
            args=(app,),
            daemon=True,
            name="edu-kernel-test-finalizer",
        )
        _TEST_FINALIZER_THREAD.start()


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    db.init_app(app)

    with app.app_context():
        db.create_all()
        ensure_schema_updates()
        seed_default_admin()
        normalize_legacy_roles()

    configure_cors(app)
    register_blueprints(app)

    @app.get("/health")
    def healthcheck():
        return jsonify({"status": "ok"}), 200

    @app.before_request
    def _boot_background_workers():
        ensure_background_workers(app)

    return app
