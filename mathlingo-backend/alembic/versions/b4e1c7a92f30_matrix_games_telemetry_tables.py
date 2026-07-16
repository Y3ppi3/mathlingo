"""matrix_games_telemetry_tables

Revision ID: b4e1c7a92f30
Revises: d3ffe0419916
Create Date: 2026-07-15 10:00:00.000000

Матричные мини-игры, Фаза 0. Создаёт таблицы гранулярной телеметрии и
межсессионного прогресса, которых нет в существующей схеме:
game_sessions -> game_events (воронка/отвал, Фаза 5), user_game_progress
(лучший результат по уровням межсессионно), assessment_results (pre/post
квизы, Фаза 6). Завершение игры продолжает писаться в attempts через
существующий submit-attempt — эти таблицы его дополняют, а не заменяют.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4e1c7a92f30'
down_revision: Union[str, None] = 'd3ffe0419916'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'game_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('game_id', sa.String(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_game_sessions_id', 'game_sessions', ['id'])
    op.create_index('ix_game_sessions_user_id', 'game_sessions', ['user_id'])
    op.create_index('ix_game_sessions_game_id', 'game_sessions', ['game_id'])

    op.create_table(
        'game_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=True),
        sa.Column('client_ts', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['game_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_game_events_id', 'game_events', ['id'])
    op.create_index('ix_game_events_session_id', 'game_events', ['session_id'])
    op.create_index('ix_game_events_event_type', 'game_events', ['event_type'])

    op.create_table(
        'user_game_progress',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('game_id', sa.String(), nullable=False),
        sa.Column('level_id', sa.String(), nullable=False),
        sa.Column('best_stars', sa.Integer(), nullable=False),
        sa.Column('best_metric', sa.Integer(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'game_id', 'level_id', name='uq_user_game_progress_user_game_level'),
    )
    op.create_index('ix_user_game_progress_id', 'user_game_progress', ['id'])
    op.create_index('ix_user_game_progress_user_id', 'user_game_progress', ['user_id'])

    op.create_table(
        'assessment_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('quiz_type', sa.String(), nullable=False),
        sa.Column('primary_game', sa.String(), nullable=True),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('answers', sa.JSON(), nullable=True),
        sa.Column('taken_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_assessment_results_id', 'assessment_results', ['id'])
    op.create_index('ix_assessment_results_user_id', 'assessment_results', ['user_id'])


def downgrade() -> None:
    op.drop_table('assessment_results')
    op.drop_table('user_game_progress')
    op.drop_table('game_events')
    op.drop_table('game_sessions')
