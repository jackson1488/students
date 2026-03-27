"""
Модуль `app/utils/student_identity.py`

Назначение:
- Поиск/разрешение студента по различным идентификаторам (id, login, код).

Ключевые константы и значения:
- `_SUFFIX_RE`: используется как конфигурационный или справочный набор значений в этом модуле.

Функции модуля:
- `extract_student_code`: Содержит бизнес-логику модуля и используется в общем потоке работы API.
- `resolve_student_user`: Определяет/находит нужный объект по входным параметрам.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

import re

from sqlalchemy import func

from app.models import User


_SUFFIX_RE = re.compile(r"-(\d+)$")


def extract_student_code(login_value: str | None):
    raw = str(login_value or "").strip()
    if not raw:
        return None

    match = _SUFFIX_RE.search(raw)
    if not match:
        return None
    return match.group(1)


def resolve_student_user(identifier, preferred_group: str | None = None):
    raw = str(identifier or "").strip()
    if not raw:
        return None, "missing"

    by_login = User.query.filter(func.lower(User.login) == raw.lower()).first()
    if by_login and by_login.role == "student":
        return by_login, None

    # When explicit numeric user id is provided, prioritize exact id resolution.
    # This prevents accidental match by login suffix (e.g. ...-0017) and avoids
    # false "forbidden" for student's own profile requests.
    if raw.isdigit():
        by_id = User.query.get(int(raw))
        if by_id and by_id.role == "student":
            return by_id, None

    candidates = set()
    if raw.isdigit():
        candidates.add(raw)
        if len(raw) <= 4:
            candidates.add(raw.zfill(4))

    if "-" in raw:
        tail = raw.rsplit("-", 1)[-1]
        if tail.isdigit():
            candidates.add(tail)
            if len(tail) <= 4:
                candidates.add(tail.zfill(4))

    if candidates:
        rows = []
        for code in candidates:
            rows.extend(User.query.filter(User.role == "student", User.login.ilike(f"%-{code}")).all())

        unique = {row.id: row for row in rows}
        resolved_rows = list(unique.values())

        if preferred_group:
            target_group = str(preferred_group).strip().lower()
            resolved_rows = [
                row
                for row in resolved_rows
                if str(row.group_id or "").strip().lower() == target_group
            ]

        if len(resolved_rows) == 1:
            return resolved_rows[0], None
        if len(resolved_rows) > 1:
            return None, "ambiguous"

    return None, "not_found"
