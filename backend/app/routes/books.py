"""
Модуль `app/routes/books.py`

Назначение:
- API библиотеки: локальные книги, каталог Open Library и личная книжная полка.

Ключевые константы и значения:
- `ALLOWED_BOOK_EXTENSIONS`: используется как конфигурационный или справочный набор значений в этом модуле.
- `OPEN_LIBRARY_SEARCH_URL`: используется как конфигурационный или справочный набор значений в этом модуле.

Маршруты HTTP (если это route-модуль):
- `POST /books` -> `create_book`
- `GET /books` -> `list_books`
- `GET /books/<int:book_id>/file` -> `serve_uploaded_book`
- `GET /books/catalog` -> `list_books_catalog`
- `GET /books/shelf` -> `list_book_shelf`
- `PUT /books/shelf` -> `upsert_book_shelf_item`
- `DELETE /books/shelf` -> `delete_book_shelf_item`

Функции модуля:
- `_extract_extension`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_is_remote_url`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_book_format_by_extension`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_normalize_text`: Нормализует и приводит значения к безопасному формату.
- `_safe_bool`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_build_local_reader_url`: Формирует служебную структуру данных/ответ.
- `_book_to_catalog_item`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_extract_first_sentence`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_extract_first_from_list`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_normalize_work_key`: Нормализует и приводит значения к безопасному формату.
- `_normalize_openlibrary_item`: Нормализует и приводит значения к безопасному формату.
- `_fetch_openlibrary_catalog`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `_collect_top_genres`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `create_book`: Создает новую сущность или запись.
- `list_books`: Возвращает список элементов.
- `serve_uploaded_book`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `list_books_catalog`: Возвращает список элементов.
- `list_book_shelf`: Возвращает список элементов.
- `upsert_book_shelf_item`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `delete_book_shelf_item`: Удаляет сущность или помечает ее удаленной.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

import json
import os
from collections import Counter
from datetime import datetime
from io import BytesIO
from urllib.error import URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from flask import Blueprint, g, jsonify, redirect, request, send_file
from werkzeug.utils import secure_filename

from app.middleware.auth import roles_required, token_required
from app.models import AppSetting, Book, BookShelfItem, db
from app.services.storage_service import save_uploaded_file

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover - fallback when dependency is unavailable
    PdfReader = None


books_bp = Blueprint("books", __name__)

OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json"
ALLOWED_BOOK_EXTENSIONS = {
    ".pdf",
    ".epub",
    ".txt",
    ".html",
    ".htm",
    ".md",
    ".doc",
    ".docx",
    ".fb2",
    ".rtf",
}
ALLOWED_COVER_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".bmp",
    ".svg",
}
LIBRARY_MODE_SETTING_KEY = "library_mode"
LIBRARY_MODE_VALUES = {"catalog", "custom"}


def _extract_extension(path_or_url: str):
    raw = str(path_or_url or "").strip()
    if not raw:
        return ""

    parsed = urlparse(raw)
    target_path = parsed.path or raw
    _, ext = os.path.splitext(target_path)
    return str(ext or "").lower().strip()


def _is_remote_url(value: str):
    normalized = str(value or "").strip().lower()
    return normalized.startswith("http://") or normalized.startswith("https://")


def _book_format_by_extension(ext: str):
    mapping = {
        ".pdf": "pdf",
        ".epub": "epub",
        ".txt": "txt",
        ".html": "html",
        ".htm": "html",
        ".md": "md",
        ".doc": "doc",
        ".docx": "docx",
        ".fb2": "fb2",
        ".rtf": "rtf",
    }
    return mapping.get(ext, "file")


def _normalize_text(value):
    normalized = str(value or "").strip()
    return normalized if normalized else None


def _filename_to_title(path_or_url: str):
    raw = str(path_or_url or "").strip()
    if not raw:
        return None

    parsed = urlparse(raw)
    filename = os.path.basename(parsed.path or raw)
    name_without_ext, _ = os.path.splitext(filename)
    normalized = str(name_without_ext or "").replace("_", " ").replace("-", " ").strip()
    return normalized if normalized else None


def _clean_pdf_meta(value):
    if value is None:
        return None
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="ignore")
    normalized = str(value).replace("\x00", "").strip()
    return normalized if normalized else None


def _extract_pdf_metadata(file_path: str):
    if not file_path or not os.path.exists(file_path) or PdfReader is None:
        return {}

    try:
        reader = PdfReader(file_path)
        metadata = reader.metadata or {}
    except Exception:
        return {}

    def _meta_get(*keys):
        for key in keys:
            value = None
            if hasattr(metadata, "get"):
                value = metadata.get(key)
            if value is None and hasattr(metadata, key):
                value = getattr(metadata, key)
            cleaned = _clean_pdf_meta(value)
            if cleaned:
                return cleaned
        return None

    title = _meta_get("/Title", "Title", "title")
    author = _meta_get("/Author", "Author", "author")
    subject = _meta_get("/Subject", "Subject", "subject")
    keywords = _meta_get("/Keywords", "Keywords", "keywords")

    description = subject or keywords
    return {
        "title": title,
        "author": author,
        "description": description,
    }


def _extract_pdf_metadata_from_upload(upload_file):
    if PdfReader is None:
        return {}

    try:
        position = upload_file.stream.tell()
    except Exception:
        position = None

    try:
        payload = upload_file.read()
        if not payload:
            return {}
        reader = PdfReader(BytesIO(payload))
        metadata = reader.metadata or {}
    except Exception:
        metadata = {}
    finally:
        try:
            if position is not None:
                upload_file.stream.seek(position)
            else:
                upload_file.stream.seek(0)
        except Exception:
            pass

    def _meta_get(*keys):
        for key in keys:
            value = None
            if hasattr(metadata, "get"):
                value = metadata.get(key)
            if value is None and hasattr(metadata, key):
                value = getattr(metadata, key)
            cleaned = _clean_pdf_meta(value)
            if cleaned:
                return cleaned
        return None

    title = _meta_get("/Title", "Title", "title")
    author = _meta_get("/Author", "Author", "author")
    subject = _meta_get("/Subject", "Subject", "subject")
    keywords = _meta_get("/Keywords", "Keywords", "keywords")
    description = subject or keywords

    return {
        "title": title,
        "author": author,
        "description": description,
    }


def _safe_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "on", "да"}:
            return True
        if normalized in {"0", "false", "no", "off", "нет"}:
            return False
    return None


def _build_local_reader_url(book: Book):
    path_value = str(book.file_path or "").strip()
    if not path_value:
        return None

    if _is_remote_url(path_value):
        return path_value

    return f"{request.host_url.rstrip('/')}/books/{book.id}/file"


def _build_local_cover_url(book: Book):
    cover_value = str(book.cover_url or "").strip()
    if not cover_value:
        return None

    if _is_remote_url(cover_value):
        return cover_value

    return f"{request.host_url.rstrip('/')}/books/{book.id}/cover"


def _normalize_library_mode(value):
    normalized = str(value or "").strip().lower()
    return normalized if normalized in LIBRARY_MODE_VALUES else "custom"


def _get_library_mode():
    row = AppSetting.query.filter_by(key=LIBRARY_MODE_SETTING_KEY).first()
    if not row:
        return "custom"
    return _normalize_library_mode(row.value)


def _set_library_mode(mode: str):
    normalized_mode = _normalize_library_mode(mode)
    row = AppSetting.query.filter_by(key=LIBRARY_MODE_SETTING_KEY).first()
    if not row:
        row = AppSetting(key=LIBRARY_MODE_SETTING_KEY, value=normalized_mode)
        db.session.add(row)
    else:
        row.value = normalized_mode
    db.session.commit()
    return normalized_mode


def _book_to_catalog_item(book: Book):
    file_value = str(book.file_path or "").strip()
    ext = _extract_extension(file_value)
    return {
        "source": "local",
        "book_key": f"local-{book.id}",
        "title": str(book.title or "").strip(),
        "author": str(book.author or "").strip(),
        "description": str(book.description or "").strip(),
        "cover_url": _build_local_cover_url(book),
        "reader_url": _build_local_reader_url(book),
        "details_url": None,
        "genre": None,
        "subjects": [],
        "publish_year": None,
        "format": _book_format_by_extension(ext),
        "has_fulltext": True,
        "created_at": book.created_at.isoformat() if book.created_at else None,
        "local_book_id": book.id,
    }


@books_bp.get("/books/mode")
@token_required
def get_library_mode():
    mode = _get_library_mode()
    return jsonify(
        {
            "mode": mode,
            "default_mode": "custom",
            "available_modes": sorted(LIBRARY_MODE_VALUES),
        }
    ), 200


@books_bp.patch("/books/mode")
@roles_required("admin")
def update_library_mode():
    data = request.get_json(silent=True) or {}
    raw_mode = str(data.get("mode") or "").strip().lower()
    if raw_mode not in LIBRARY_MODE_VALUES:
        return jsonify({"error": "mode must be one of: catalog, custom"}), 400

    saved = _set_library_mode(raw_mode)
    return jsonify({"mode": saved}), 200


def _extract_first_sentence(raw_value):
    if isinstance(raw_value, list) and raw_value:
        raw_value = raw_value[0]

    if isinstance(raw_value, dict):
        raw_value = raw_value.get("value") or raw_value.get("text")

    if raw_value is None:
        return None

    text_value = str(raw_value).strip()
    return text_value if text_value else None


def _extract_first_from_list(raw_value):
    if isinstance(raw_value, list) and raw_value:
        return str(raw_value[0]).strip()
    if raw_value is None:
        return None
    value = str(raw_value).strip()
    return value if value else None


def _normalize_work_key(raw_key: str):
    value = str(raw_key or "").strip()
    if not value:
        return None
    if value.startswith("/"):
        return value
    return f"/{value}"


def _normalize_openlibrary_item(doc):
    if not isinstance(doc, dict):
        return None

    title = _normalize_text(doc.get("title"))
    if not title:
        return None

    work_key = _normalize_work_key(doc.get("key"))
    edition_key = _extract_first_from_list(doc.get("edition_key"))
    isbn_key = _extract_first_from_list(doc.get("isbn"))
    fallback_key = edition_key or isbn_key or title.lower().replace(" ", "-")
    book_key = str((work_key or fallback_key or "").lstrip("/")).strip()
    if not book_key:
        return None

    cover_id = doc.get("cover_i")
    cover_url = (
        f"https://covers.openlibrary.org/b/id/{int(cover_id)}-L.jpg"
        if isinstance(cover_id, (int, float))
        else None
    )

    subjects = doc.get("subject") if isinstance(doc.get("subject"), list) else []
    subjects = [str(item).strip() for item in subjects if str(item).strip()][:10]

    author_name = _extract_first_from_list(doc.get("author_name"))
    archive_id = _extract_first_from_list(doc.get("ia"))
    details_url = f"https://openlibrary.org{work_key}" if work_key else None
    reader_url = f"https://archive.org/details/{archive_id}/mode/2up" if archive_id else details_url

    first_publish_year = doc.get("first_publish_year")
    publish_year = int(first_publish_year) if isinstance(first_publish_year, (int, float)) else None

    return {
        "source": "openlibrary",
        "book_key": f"ol-{book_key}",
        "title": title,
        "author": author_name or "",
        "description": _extract_first_sentence(doc.get("first_sentence")) or "",
        "cover_url": cover_url,
        "reader_url": reader_url,
        "details_url": details_url,
        "genre": subjects[0] if subjects else None,
        "subjects": subjects,
        "publish_year": publish_year,
        "format": "web",
        "has_fulltext": bool(doc.get("has_fulltext") or doc.get("ebook_access") == "public"),
        "created_at": None,
        "local_book_id": None,
    }


def _fetch_openlibrary_catalog(query: str, lang: str, subject: str, page: int, limit: int):
    params = {
        "q": query or "программирование",
        "lang": lang or "rus",
        "page": max(1, page),
        "limit": max(1, min(limit, 30)),
    }
    if subject:
        params["subject"] = subject

    request_url = f"{OPEN_LIBRARY_SEARCH_URL}?{urlencode(params)}"
    req = Request(
        request_url,
        headers={
            "User-Agent": "EDU-Kernel/1.0",
            "Accept": "application/json",
        },
    )

    with urlopen(req, timeout=15) as response:
        body = response.read().decode("utf-8", errors="replace")
        return json.loads(body)


def _collect_top_genres(docs):
    counter = Counter()
    for doc in docs:
        if not isinstance(doc, dict):
            continue
        subjects = doc.get("subject")
        if not isinstance(subjects, list):
            continue
        for raw_subject in subjects[:5]:
            subject = str(raw_subject).strip()
            if subject:
                counter[subject] += 1
    return [name for name, _ in counter.most_common(20)]


@books_bp.post("/books")
@roles_required("scheduler", "admin")
def create_book():
    if request.content_type and request.content_type.startswith("multipart/form-data"):
        title = request.form.get("title")
        author = request.form.get("author")
        description = request.form.get("description")
        cover_url_value = request.form.get("cover_url")
        file = request.files.get("file")
        cover = request.files.get("cover")
        file_path_value = None
    else:
        data = request.get_json(silent=True) or {}
        title = data.get("title")
        author = data.get("author")
        description = data.get("description")
        cover_url_value = data.get("cover_url")
        file = None
        cover = None
        file_path_value = data.get("file") or data.get("file_path")

    if file is None and not file_path_value:
        return jsonify({"error": "Book file is required in 'file' field or as file url"}), 400

    if file is not None:
        filename = secure_filename(file.filename or "")
        ext = _extract_extension(filename)
        if ext not in ALLOWED_BOOK_EXTENSIONS:
            return jsonify({"error": "Unsupported file format"}), 400

        pdf_metadata = _extract_pdf_metadata_from_upload(file) if ext == ".pdf" else {}

        try:
            final_file_path = save_uploaded_file(
                file,
                folder="books",
                return_local_absolute=True,
            )
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        except RuntimeError as exc:
            return jsonify({"error": str(exc)}), 500
    else:
        pdf_metadata = {}
        final_file_path = str(file_path_value).strip()
        ext = _extract_extension(final_file_path)
        if ext not in ALLOWED_BOOK_EXTENSIONS:
            return jsonify({"error": "Unsupported file format"}), 400

    final_cover_value = None
    if cover is not None and str(cover.filename or "").strip():
        cover_name = secure_filename(cover.filename or "")
        cover_ext = _extract_extension(cover_name)
        if cover_ext not in ALLOWED_COVER_EXTENSIONS:
            return jsonify({"error": "Unsupported cover format"}), 400

        try:
            final_cover_value = save_uploaded_file(
                cover,
                folder="books",
                return_local_absolute=True,
                filename_base=f"cover_{os.path.splitext(cover_name)[0] or 'book'}",
            )
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        except RuntimeError as exc:
            return jsonify({"error": str(exc)}), 500
    else:
        normalized_cover_url = str(cover_url_value or "").strip()
        final_cover_value = normalized_cover_url or None

    normalized_title = _normalize_text(title)
    normalized_author = _normalize_text(author)
    normalized_description = _normalize_text(description)

    if file is not None and ext == ".pdf":
        if not pdf_metadata and not _is_remote_url(final_file_path):
            pdf_metadata = _extract_pdf_metadata(final_file_path)
        if not normalized_title:
            normalized_title = _normalize_text(pdf_metadata.get("title"))
        if not normalized_author:
            normalized_author = _normalize_text(pdf_metadata.get("author"))
        if not normalized_description:
            normalized_description = _normalize_text(pdf_metadata.get("description"))

    if not normalized_title:
        normalized_title = _filename_to_title(final_file_path) or "Untitled"
    if not normalized_author:
        normalized_author = "Unknown"

    row = Book(
        title=normalized_title,
        author=normalized_author,
        description=normalized_description,
        cover_url=final_cover_value,
        file_path=final_file_path,
        created_by=g.current_user.id,
    )

    db.session.add(row)
    db.session.commit()

    payload = row.to_dict()
    payload["source"] = "local"
    payload["book_key"] = f"local-{row.id}"
    payload["description"] = str(row.description or "").strip()
    payload["cover_url"] = _build_local_cover_url(row)
    payload["reader_url"] = _build_local_reader_url(row)
    payload["format"] = _book_format_by_extension(_extract_extension(final_file_path))

    return jsonify(payload), 201


@books_bp.get("/books")
@token_required
def list_books():
    rows = Book.query.order_by(Book.created_at.desc()).all()
    payload = []
    for row in rows:
        item = row.to_dict()
        item["source"] = "local"
        item["book_key"] = f"local-{row.id}"
        item["description"] = str(row.description or "").strip()
        item["cover_url"] = _build_local_cover_url(row)
        item["reader_url"] = _build_local_reader_url(row)
        item["format"] = _book_format_by_extension(_extract_extension(item.get("file")))
        payload.append(item)
    return jsonify(payload), 200


@books_bp.get("/books/<int:book_id>/file")
@token_required
def serve_uploaded_book(book_id: int):
    row = Book.query.get(book_id)
    if not row:
        return jsonify({"error": "Book not found"}), 404

    file_value = str(row.file_path or "").strip()
    if not file_value:
        return jsonify({"error": "Book file is missing"}), 404

    if _is_remote_url(file_value):
        return redirect(file_value, code=302)

    if not os.path.exists(file_value):
        return jsonify({"error": "Book file not found"}), 404

    return send_file(file_value, as_attachment=False, conditional=True)


@books_bp.get("/books/<int:book_id>/cover")
def serve_uploaded_cover(book_id: int):
    row = Book.query.get(book_id)
    if not row:
        return jsonify({"error": "Book not found"}), 404

    cover_value = str(row.cover_url or "").strip()
    if not cover_value:
        return jsonify({"error": "Cover file is missing"}), 404

    if _is_remote_url(cover_value):
        return redirect(cover_value, code=302)

    if not os.path.exists(cover_value):
        return jsonify({"error": "Cover file not found"}), 404

    return send_file(cover_value, as_attachment=False, conditional=True)


@books_bp.get("/books/catalog")
@token_required
def list_books_catalog():
    raw_q = request.args.get("q")
    raw_subject = request.args.get("subject")
    raw_lang = request.args.get("lang")

    query = str(raw_q or "").strip() or "программирование"
    subject = str(raw_subject or "").strip()
    lang = str(raw_lang or "").strip() or "rus"

    try:
        page = max(1, int(request.args.get("page", 1)))
    except (TypeError, ValueError):
        page = 1

    try:
        limit = max(1, min(30, int(request.args.get("limit", 15))))
    except (TypeError, ValueError):
        limit = 15

    try:
        payload = _fetch_openlibrary_catalog(query=query, lang=lang, subject=subject, page=page, limit=limit)
        docs = payload.get("docs") if isinstance(payload.get("docs"), list) else []
        num_found = int(payload.get("numFound") or 0)
        genres = _collect_top_genres(docs)
    except (URLError, TimeoutError, ValueError, TypeError):
        docs = []
        num_found = 0
        genres = []

    items = []
    seen = set()
    for raw in docs:
        normalized = _normalize_openlibrary_item(raw)
        if not normalized:
            continue
        unique_key = f"{normalized['source']}:{normalized['book_key']}"
        if unique_key in seen:
            continue
        seen.add(unique_key)
        items.append(normalized)

    has_more = (page * limit) < num_found if num_found > 0 else False

    return jsonify(
        {
            "query": query,
            "subject": subject or None,
            "lang": lang,
            "page": page,
            "limit": limit,
            "total": num_found,
            "has_more": has_more,
            "genres": genres,
            "items": items,
        }
    ), 200


@books_bp.get("/books/shelf")
@token_required
def list_book_shelf():
    rows = (
        BookShelfItem.query.filter_by(user_id=g.current_user.id)
        .order_by(BookShelfItem.updated_at.desc(), BookShelfItem.id.desc())
        .all()
    )
    return jsonify([row.to_dict() for row in rows]), 200


@books_bp.put("/books/shelf")
@token_required
def upsert_book_shelf_item():
    data = request.get_json(silent=True) or {}
    source = _normalize_text(data.get("source")) or "openlibrary"
    book_key = _normalize_text(data.get("book_key"))

    if not book_key:
        return jsonify({"error": "book_key is required"}), 400

    row = BookShelfItem.query.filter_by(
        user_id=g.current_user.id,
        source=source,
        book_key=book_key,
    ).first()

    if not row:
        row = BookShelfItem(
            user_id=g.current_user.id,
            source=source,
            book_key=book_key,
            title="",
        )
        db.session.add(row)

    text_fields = {
        "title": "title",
        "author": "author",
        "description": "description",
        "cover_url": "cover_url",
        "reader_url": "reader_url",
        "genre": "genre",
        "bookmark_url": "bookmark_url",
        "bookmark_note": "bookmark_note",
    }
    for input_key, model_key in text_fields.items():
        if input_key not in data:
            continue
        value = _normalize_text(data.get(input_key))
        setattr(row, model_key, value)

    if "is_favorite" in data:
        parsed = _safe_bool(data.get("is_favorite"))
        if parsed is not None:
            row.is_favorite = parsed

    if "is_read" in data:
        parsed = _safe_bool(data.get("is_read"))
        if parsed is not None:
            row.is_read = parsed

    if "progress_percent" in data:
        raw_progress = data.get("progress_percent")
        if raw_progress is None or str(raw_progress).strip() == "":
            row.progress_percent = None
        else:
            try:
                value = int(raw_progress)
            except (TypeError, ValueError):
                return jsonify({"error": "progress_percent must be integer from 0 to 100"}), 400
            if value < 0 or value > 100:
                return jsonify({"error": "progress_percent must be integer from 0 to 100"}), 400
            row.progress_percent = value

    if _safe_bool(data.get("opened")):
        row.last_opened_at = datetime.utcnow()

    if not row.title:
        row.title = _normalize_text(data.get("title")) or ""

    db.session.commit()
    return jsonify(row.to_dict()), 200


@books_bp.delete("/books/shelf")
@token_required
def delete_book_shelf_item():
    source = _normalize_text(request.args.get("source")) or "openlibrary"
    book_key = _normalize_text(request.args.get("book_key"))

    if not book_key:
        return jsonify({"error": "book_key is required"}), 400

    row = BookShelfItem.query.filter_by(
        user_id=g.current_user.id,
        source=source,
        book_key=book_key,
    ).first()
    if row:
        db.session.delete(row)
        db.session.commit()

    return jsonify({"status": "deleted"}), 200
