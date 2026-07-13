"""add_mastery_state

Revision ID: 7237168df4ae
Revises: 4b904f669d1d
Create Date: 2026-07-13 20:32:15.541731

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7237168df4ae'
down_revision: Union[str, None] = '4b904f669d1d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'mastery_state',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('level', sa.String(), nullable=False),
        sa.Column('confidence', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sample_size', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('factors', sa.JSON(), nullable=True),
        sa.Column('window_from', sa.DateTime(), nullable=True),
        sa.Column('window_to', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'skill_id', name='uq_mastery_state_user_id_skill_id'),
    )
    op.create_index(op.f('ix_mastery_state_id'), 'mastery_state', ['id'], unique=False)
    op.alter_column('mastery_state', 'confidence', server_default=None)
    op.alter_column('mastery_state', 'sample_size', server_default=None)


def downgrade() -> None:
    op.drop_index(op.f('ix_mastery_state_id'), table_name='mastery_state')
    op.drop_table('mastery_state')
