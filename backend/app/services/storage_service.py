"""
Модуль `app/services/storage_service.py`

Назначение:
- Единый слой хранения файлов для backend:
  - локальная файловая система (по умолчанию);
  - Supabase Storage (по env-конфигу).
"""

import json
import os
from datetime import datetime
from urllib.error import HTTPError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from flask import current_app
from werkzeug.utils import secure_filename


_BUCKET_READY_CACHE = {}


def _truthy(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _uploads_root():
    base_upload_dir = current_app.config["UPLOAD_FOLDER"]
    return os.path.dirname(base_upload_dir)


def _storage_backend():
    return str(current_app.config.get("STORAGE_BACKEND", "local") or "local").strip().lower()


def storage_uses_supabase():
    if _storage_backend() != "supabase":
        return False
    return bool(_supabase_url() and _supabase_service_key())


def _supabase_url():
    return str(current_app.config.get("SUPABASE_URL") or "").strip().rstrip("/")


def _supabase_service_key():
    return str(current_app.config.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()


def _supabase_bucket():
    return str(current_app.config.get("SUPABASE_STORAGE_BUCKET") or "edu-kernel").strip()


def _supabase_prefix():
    value = str(current_app.config.get("SUPABASE_STORAGE_PREFIX") or "uploads").strip().strip("/")
    return value


def _supabase_public_url(key: str):
    bucket = quote(_supabase_bucket(), safe="")
    safe_key = quote(str(key or "").strip().lstrip("/"), safe="/")
    return f"{_supabase_url()}/storage/v1/object/public/{bucket}/{safe_key}"


def _supabase_headers(content_type="application/json"):
    service_key = _supabase_service_key()
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _supabase_request(method: str, path: str, body=None, headers=None):
    if not _supabase_url() or not _supabase_service_key():
        raise RuntimeError("Supabase storage is not configured")

    request_headers = headers or _supabase_headers()
    url = f"{_supabase_url()}{path}"
    req = Request(url=url, data=body, headers=request_headers, method=method.upper())

    try:
        with urlopen(req, timeout=30) as response:
            raw = response.read()
            return response.status, raw
    except HTTPError as exc:
        raw = exc.read() if hasattr(exc, "read") else b""
        return exc.code, raw


def _ensure_supabase_bucket():
    bucket = _supabase_bucket()
    if not bucket:
        raise RuntimeError("SUPABASE_STORAGE_BUCKET is empty")

    cached = _BUCKET_READY_CACHE.get(bucket)
    if cached:
        return

    status, raw = _supabase_request(
        "GET",
        f"/storage/v1/bucket/{quote(bucket, safe='')}",
        headers=_supabase_headers(),
    )
    if status == 200:
        _BUCKET_READY_CACHE[bucket] = True
        return

    response_text = raw.decode("utf-8", errors="replace") if raw else ""
    bucket_missing = status == 404 or (
        status == 400 and ("Bucket not found" in response_text or '"statusCode":"404"' in response_text)
    )

    auto_create = _truthy(current_app.config.get("SUPABASE_STORAGE_AUTO_CREATE_BUCKET"), default=True)
    if bucket_missing and auto_create:
        payload = json.dumps(
            {
                "id": bucket,
                "name": bucket,
                "public": _truthy(current_app.config.get("SUPABASE_STORAGE_PUBLIC"), default=True),
            }
        ).encode("utf-8")
        create_status, create_raw = _supabase_request(
            "POST",
            "/storage/v1/bucket",
            body=payload,
            headers=_supabase_headers("application/json"),
        )
        if create_status in {200, 201, 409}:
            _BUCKET_READY_CACHE[bucket] = True
            return
        detail = create_raw.decode("utf-8", errors="replace")
        raise RuntimeError(f"Failed to create Supabase bucket '{bucket}': {detail}")

    raise RuntimeError(f"Supabase bucket '{bucket}' is not доступен (status={status})")


def _build_object_key(folder: str, filename: str):
    clean_folder = str(folder or "").strip().strip("/")
    if not clean_folder:
        raise ValueError("folder is required")

    clean_filename = str(filename or "").strip().strip("/")
    if not clean_filename:
        raise ValueError("filename is required")

    prefix = _supabase_prefix()
    parts = [part for part in [prefix, clean_folder, clean_filename] if part]
    return "/".join(parts)


def _upload_to_supabase(key: str, payload: bytes, content_type: str):
    _ensure_supabase_bucket()
    bucket = quote(_supabase_bucket(), safe="")
    safe_key = quote(str(key or "").strip().lstrip("/"), safe="/")
    status, raw = _supabase_request(
        "POST",
        f"/storage/v1/object/{bucket}/{safe_key}",
        body=payload,
        headers={
            **_supabase_headers(content_type),
            "x-upsert": "true",
        },
    )
    if status not in {200, 201}:
        detail = raw.decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase upload failed (status={status}): {detail}")


def _delete_from_supabase(key: str):
    if not key:
        return
    bucket = quote(_supabase_bucket(), safe="")
    safe_key = quote(str(key or "").strip().lstrip("/"), safe="/")
    status, _ = _supabase_request(
        "DELETE",
        f"/storage/v1/object/{bucket}/{safe_key}",
        headers=_supabase_headers(),
    )
    # 404 тоже считаем успешным удалением
    if status not in {200, 204, 404}:
        raise RuntimeError(f"Supabase delete failed (status={status})")


def _safe_filename(upload_file, filename_base=None):
    original_name = secure_filename(upload_file.filename or "")
    ext = os.path.splitext(original_name)[1].lower()
    if not ext:
        raise ValueError("File extension is required")

    if filename_base:
        base = secure_filename(str(filename_base or "").strip())
        if not base:
            base = "file"
        final_name = f"{int(datetime.utcnow().timestamp() * 1000)}_{base}{ext}"
    else:
        if not original_name:
            raise ValueError("File name is required")
        final_name = f"{int(datetime.utcnow().timestamp() * 1000)}_{original_name}"

    return final_name, ext


def save_uploaded_file(
    upload_file,
    folder: str,
    *,
    local_route_prefix=None,
    return_local_absolute=False,
    filename_base=None,
):
    if upload_file is None:
        raise ValueError("upload_file is required")

    final_name, _ = _safe_filename(upload_file, filename_base=filename_base)

    if storage_uses_supabase():
        payload = upload_file.read()
        if payload is None:
            payload = b""
        if isinstance(payload, str):
            payload = payload.encode("utf-8")

        content_type = str(upload_file.mimetype or "application/octet-stream").strip() or "application/octet-stream"
        object_key = _build_object_key(folder, final_name)
        _upload_to_supabase(object_key, payload, content_type)
        return _supabase_public_url(object_key)

    target_dir = os.path.join(_uploads_root(), str(folder).strip())
    os.makedirs(target_dir, exist_ok=True)
    path = os.path.join(target_dir, final_name)
    upload_file.save(path)

    if return_local_absolute:
        return path

    if local_route_prefix:
        return f"{str(local_route_prefix).rstrip('/')}/{final_name}"

    return f"/uploads/{str(folder).strip().strip('/')}/{final_name}"


def _extract_supabase_key(value: str):
    raw = str(value or "").strip()
    if not raw:
        return None

    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"}:
        return None

    supabase_origin = _supabase_url()
    if not supabase_origin:
        return None
    supabase_host = urlparse(supabase_origin).netloc
    if parsed.netloc != supabase_host:
        return None

    marker = f"/storage/v1/object/public/{_supabase_bucket()}/"
    if marker not in parsed.path:
        return None

    _, _, key = parsed.path.partition(marker)
    return key or None


def remove_uploaded_file(value: str, *, local_folder=None):
    raw = str(value or "").strip()
    if not raw:
        return

    if storage_uses_supabase():
        key = _extract_supabase_key(raw)
        if key:
            _delete_from_supabase(key)
            return

    if raw.startswith(("http://", "https://")):
        return

    if os.path.isabs(raw):
        path = raw
    else:
        filename = os.path.basename(raw)
        if not filename:
            return
        if local_folder:
            path = os.path.join(_uploads_root(), str(local_folder).strip(), filename)
        else:
            path = os.path.join(_uploads_root(), filename)

    if os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass


def supabase_public_object_url(folder: str, filename: str):
    if not storage_uses_supabase():
        return None
    key = _build_object_key(folder, filename)
    return _supabase_public_url(key)
