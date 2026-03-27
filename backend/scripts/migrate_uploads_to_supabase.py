#!/usr/bin/env python3
"""
Миграция существующих локальных файлов backend/uploads/* в Supabase Storage
с обновлением ссылок в базе.

Перед запуском:
- backend/.env должен указывать Supabase Postgres (DATABASE_URL)
- STORAGE_BACKEND=supabase
- SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY заполнены
"""

import sys
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse

from werkzeug.datastructures import FileStorage

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app import create_app
from app.models import (
    Book,
    ChatMessage,
    GroupChatMessage,
    HomeworkSubmission,
    News,
    SupportMessage,
    User,
    db,
)
from app.services.storage_service import save_uploaded_file, storage_uses_supabase


def _is_remote_non_localhost(value: str):
    raw = str(value or "").strip()
    if not raw.startswith(("http://", "https://")):
        return False
    parsed = urlparse(raw)
    return parsed.hostname not in {"localhost", "127.0.0.1"}


def _uploads_root():
    from flask import current_app

    return Path(current_app.config["UPLOAD_FOLDER"]).resolve().parent


def _resolve_local_source(value: str):
    raw = str(value or "").strip()
    if not raw:
        return None, None

    if raw.startswith("/users/avatar/"):
        return _uploads_root() / "avatars" / Path(raw).name, "avatars"
    if raw.startswith("/chat/media/"):
        return _uploads_root() / "chat_media" / Path(raw).name, "chat_media"
    if raw.startswith("/support/media/"):
        return _uploads_root() / "support_media" / Path(raw).name, "support_media"
    if raw.startswith("/homework/media/"):
        return _uploads_root() / "homework_media" / Path(raw).name, "homework_media"
    if raw.startswith("/news/image/"):
        return _uploads_root() / "news" / Path(raw).name, "news"

    path = Path(raw)
    if path.is_absolute() and path.exists():
        try:
            rel = path.resolve().relative_to(_uploads_root())
            folder = rel.parts[0] if rel.parts else None
            return path.resolve(), folder
        except Exception:
            return path.resolve(), None

    return None, None


def _upload_local_file(local_path: Path, folder: str):
    if not local_path.exists() or not local_path.is_file():
        return None

    content = local_path.read_bytes()
    file_obj = FileStorage(
        stream=BytesIO(content),
        filename=local_path.name,
        content_type="application/octet-stream",
    )
    return save_uploaded_file(file_obj, folder=folder)


def _migrate_field(rows, field_name: str, default_folder=None):
    changed = 0
    skipped = 0

    for row in rows:
        current_value = str(getattr(row, field_name) or "").strip()
        if not current_value:
            skipped += 1
            continue

        if _is_remote_non_localhost(current_value):
            skipped += 1
            continue

        local_path, folder = _resolve_local_source(current_value)
        use_folder = folder or default_folder
        if not local_path or not use_folder:
            skipped += 1
            continue

        new_url = _upload_local_file(local_path, use_folder)
        if not new_url:
            skipped += 1
            continue

        setattr(row, field_name, new_url)
        changed += 1

    return changed, skipped


def main():
    app = create_app()
    with app.app_context():
        if not storage_uses_supabase():
            raise RuntimeError("STORAGE_BACKEND должен быть 'supabase' и Supabase env должен быть заполнен")

        total_changed = 0
        total_skipped = 0

        targets = [
            (User.query.all(), "avatar_url", "avatars"),
            (ChatMessage.query.all(), "attachment_url", "chat_media"),
            (GroupChatMessage.query.all(), "attachment_url", "chat_media"),
            (SupportMessage.query.all(), "attachment_url", "support_media"),
            (HomeworkSubmission.query.all(), "attachment_url", "homework_media"),
            (News.query.all(), "image_url", "news"),
            (Book.query.all(), "file_path", "books"),
            (Book.query.all(), "cover_url", "books"),
        ]

        for rows, field_name, folder in targets:
            changed, skipped = _migrate_field(rows, field_name, default_folder=folder)
            total_changed += changed
            total_skipped += skipped
            print(f"{field_name}: updated={changed}, skipped={skipped}")

        db.session.commit()
        print(f"done: updated={total_changed}, skipped={total_skipped}")


if __name__ == "__main__":
    main()
