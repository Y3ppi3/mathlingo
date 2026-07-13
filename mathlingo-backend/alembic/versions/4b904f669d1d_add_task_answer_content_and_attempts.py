"""add_task_answer_content_and_attempts

Revision ID: 4b904f669d1d
Revises: f4b92d34ccd0
Create Date: 2026-07-13 20:08:43.354115

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4b904f669d1d'
down_revision: Union[str, None] = 'f4b92d34ccd0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tasks', sa.Column('content', sa.String(), nullable=True))
    op.add_column('tasks', sa.Column('answer_type', sa.String(), nullable=False, server_default='single_answer'))
    op.add_column('tasks', sa.Column('options', sa.JSON(), nullable=True))
    op.add_column('tasks', sa.Column('correct_answer', sa.String(), nullable=True))
    # Существующие задания не имеют ни текста вопроса, ни ответа — не
    # выдумываем их, оставляем NULL/дефолт до ручного заполнения автором.
    op.alter_column('tasks', 'answer_type', server_default=None)

    op.create_table(
        'attempts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('content_type', sa.String(), nullable=False),
        sa.Column('content_id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=True),
        sa.Column('is_correct', sa.Boolean(), nullable=False),
        sa.Column('time_spent_ms', sa.Integer(), nullable=True),
        sa.Column('hints_used', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('source', sa.String(), nullable=False, server_default='manual'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_attempts_id'), 'attempts', ['id'], unique=False)
    op.alter_column('attempts', 'hints_used', server_default=None)
    op.alter_column('attempts', 'source', server_default=None)


def downgrade() -> None:
    op.drop_index(op.f('ix_attempts_id'), table_name='attempts')
    op.drop_table('attempts')

    op.drop_column('tasks', 'correct_answer')
    op.drop_column('tasks', 'options')
    op.drop_column('tasks', 'answer_type')
    op.drop_column('tasks', 'content')
