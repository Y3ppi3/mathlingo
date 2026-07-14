"""task_fk_ondelete_cascade

Revision ID: d3ffe0419916
Revises: 9af2ea949ea8
Create Date: 2026-07-14 18:09:28.204596

R4: DELETE /admin/tasks/{id} падал 500 (FK violation) для любого задания,
прошедшего хотя бы один переход статуса или AI-генерацию/жалобу — три
таблицы ссылались на tasks.id без ON DELETE. content_status_history и
content_flags не имеют смысла без самого задания -> CASCADE.
ai_generation_items.task_id ценен сам по себе (история AI-пайплайна) ->
SET NULL (уже nullable).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3ffe0419916'
down_revision: Union[str, None] = '9af2ea949ea8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('content_status_history_task_id_fkey', 'content_status_history', type_='foreignkey')
    op.create_foreign_key(
        'content_status_history_task_id_fkey', 'content_status_history', 'tasks',
        ['task_id'], ['id'], ondelete='CASCADE',
    )

    op.drop_constraint('content_flags_task_id_fkey', 'content_flags', type_='foreignkey')
    op.create_foreign_key(
        'content_flags_task_id_fkey', 'content_flags', 'tasks',
        ['task_id'], ['id'], ondelete='CASCADE',
    )

    op.drop_constraint('ai_generation_items_task_id_fkey', 'ai_generation_items', type_='foreignkey')
    op.create_foreign_key(
        'ai_generation_items_task_id_fkey', 'ai_generation_items', 'tasks',
        ['task_id'], ['id'], ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('ai_generation_items_task_id_fkey', 'ai_generation_items', type_='foreignkey')
    op.create_foreign_key(
        'ai_generation_items_task_id_fkey', 'ai_generation_items', 'tasks',
        ['task_id'], ['id'],
    )

    op.drop_constraint('content_flags_task_id_fkey', 'content_flags', type_='foreignkey')
    op.create_foreign_key(
        'content_flags_task_id_fkey', 'content_flags', 'tasks',
        ['task_id'], ['id'],
    )

    op.drop_constraint('content_status_history_task_id_fkey', 'content_status_history', type_='foreignkey')
    op.create_foreign_key(
        'content_status_history_task_id_fkey', 'content_status_history', 'tasks',
        ['task_id'], ['id'],
    )
