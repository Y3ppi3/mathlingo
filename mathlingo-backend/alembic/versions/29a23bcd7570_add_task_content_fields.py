"""add_task_content_fields

Revision ID: 29a23bcd7570
Revises: 085e47fdaffd
Create Date: 2026-07-13 18:12:34.254426

"""
from typing import Sequence, Union
from datetime import datetime

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '29a23bcd7570'
down_revision: Union[str, None] = '085e47fdaffd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tasks', sa.Column('skill_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_tasks_skill_id_skills', 'tasks', 'skills', ['skill_id'], ['id'])

    op.add_column('tasks', sa.Column('level', sa.String(), nullable=False, server_default='standard'))
    op.add_column('tasks', sa.Column('status', sa.String(), nullable=False, server_default='published'))
    op.add_column('tasks', sa.Column('version', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('tasks', sa.Column('source', sa.String(), nullable=False, server_default='manual'))
    op.add_column('tasks', sa.Column('created_by_admin_id', sa.Integer(), nullable=True))
    op.add_column('tasks', sa.Column('approved_by_admin_id', sa.Integer(), nullable=True))
    op.add_column('tasks', sa.Column('published_at', sa.DateTime(), nullable=True))
    op.add_column('tasks', sa.Column('archived_at', sa.DateTime(), nullable=True))

    op.create_foreign_key('fk_tasks_created_by_admin_id', 'tasks', 'admins', ['created_by_admin_id'], ['id'])
    op.create_foreign_key('fk_tasks_approved_by_admin_id', 'tasks', 'admins', ['approved_by_admin_id'], ['id'])

    # Существующие задания фактически уже "в проде" — считаем их published,
    # но честной даты публикации у нас нет (created_at на Task не было),
    # поэтому published_at = момент выполнения этой миграции, а не догадка.
    connection = op.get_bind()
    connection.execute(sa.text("UPDATE tasks SET published_at = :now WHERE status = 'published'"), {"now": datetime.utcnow()})

    # skill_id: подставляем тему "Общее" (создана миграцией add_skills_table)
    # того же раздела, если у задания вообще указан subject_id.
    connection.execute(sa.text("""
        UPDATE tasks
        SET skill_id = skills.id
        FROM skills
        WHERE skills.subject_id = tasks.subject_id
          AND skills.code = 'general'
          AND tasks.subject_id IS NOT NULL
    """))

    # server_default снимаем — дальше дефолты задаёт Python-модель (Task),
    # а не БД, см. app/models.py.
    op.alter_column('tasks', 'level', server_default=None)
    op.alter_column('tasks', 'status', server_default=None)
    op.alter_column('tasks', 'version', server_default=None)
    op.alter_column('tasks', 'source', server_default=None)

    op.create_table(
        'content_status_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=False),
        sa.Column('from_status', sa.String(), nullable=True),
        sa.Column('to_status', sa.String(), nullable=False),
        sa.Column('actor_admin_id', sa.Integer(), nullable=True),
        sa.Column('comment', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id']),
        sa.ForeignKeyConstraint(['actor_admin_id'], ['admins.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_content_status_history_id'), 'content_status_history', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_content_status_history_id'), table_name='content_status_history')
    op.drop_table('content_status_history')

    op.drop_constraint('fk_tasks_approved_by_admin_id', 'tasks', type_='foreignkey')
    op.drop_constraint('fk_tasks_created_by_admin_id', 'tasks', type_='foreignkey')
    op.drop_constraint('fk_tasks_skill_id_skills', 'tasks', type_='foreignkey')

    op.drop_column('tasks', 'archived_at')
    op.drop_column('tasks', 'published_at')
    op.drop_column('tasks', 'approved_by_admin_id')
    op.drop_column('tasks', 'created_by_admin_id')
    op.drop_column('tasks', 'source')
    op.drop_column('tasks', 'version')
    op.drop_column('tasks', 'status')
    op.drop_column('tasks', 'level')
    op.drop_column('tasks', 'skill_id')
