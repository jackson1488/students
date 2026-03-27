"""
Модуль `app/models/__init__.py`

Назначение:
- Центральный экспорт ORM-моделей для удобного импорта.

Примечание:
- Комментарии в этом модуле ориентированы на чтение кода новичком: сначала цель, затем ключевые значения, потом функции.
"""

from app.extensions import db
from app.models.entities import (
    AppSetting,
    Attendance,
    Book,
    BookShelfItem,
    ChatMessage,
    GroupChatMessage,
    Grade,
    Homework,
    HomeworkSubmission,
    ModuleScore,
    ModuleScoreEntry,
    News,
    ScheduleTeacherLink,
    ScheduleEntry,
    StudentProfile,
    StudyGroup,
    SupportMessage,
    Test,
    TestActivation,
    TestAttempt,
    TestQuestion,
    TeacherGroupBinding,
    TeacherProfile,
    User,
)

__all__ = [
    "db",
    "AppSetting",
    "User",
    "StudyGroup",
    "TeacherProfile",
    "StudentProfile",
    "TeacherGroupBinding",
    "Grade",
    "Attendance",
    "Homework",
    "HomeworkSubmission",
    "ModuleScore",
    "ModuleScoreEntry",
    "ScheduleEntry",
    "ScheduleTeacherLink",
    "Test",
    "TestQuestion",
    "TestActivation",
    "TestAttempt",
    "ChatMessage",
    "GroupChatMessage",
    "SupportMessage",
    "Book",
    "BookShelfItem",
    "News",
]
