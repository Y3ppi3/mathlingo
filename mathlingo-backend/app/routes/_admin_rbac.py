# app/routes/_admin_rbac.py
"""
Общие RBAC-зависимости для admin_*.py — вынесены сюда при разбиении
admin.py (R4), чтобы не дублировать require_role(...) между файлами
одного домена. Не роутер, только зависимости.
"""
from app.auth import require_role

# Создание/редактирование/публикация/архивация контента — superadmin и
# content_manager. Approve/request-changes — намеренно НЕ content_manager
# (four-eyes: автор черновика не проверяет сам себя), см.
# docs/roadmap/product-technical-plan.md (R1, §5).
CAN_MANAGE_CONTENT = require_role("superadmin", "content_manager")
CAN_REVIEW_CONTENT = require_role("superadmin", "teacher")
# Аналитика качества и жалобы (R2 task 7) — читают и жалуются все три
# роли: teacher видит агрегаты по AI-заданию и жалуется, content_manager/
# superadmin разбирают жалобы и решают судьбу задания.
CAN_VIEW_QUALITY = require_role("superadmin", "content_manager", "teacher")
