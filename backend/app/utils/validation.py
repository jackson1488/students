"""
Модуль `app/utils/validation.py`

Назначение:
- Базовые утилиты валидации входных данных.

Функции модуля:
- `require_fields`: Содержит бизнес-логику модуля и используется в общем потоке работы API.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

def require_fields(data: dict, fields: list[str]):
    missing = [field for field in fields if not data.get(field)]
    return missing
