"""add_level_overrides

Revision ID: e463e998f91d
Revises: 9f20afd63a74
Create Date: 2026-07-13 20:55:58.739816

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e463e998f91d'
down_revision: Union[str, None] = '9f20afd63a74'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'level_overrides',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('chosen_level', sa.String(), nullable=False),
        sa.Column('reason', sa.String(), nullable=False, server_default='manual'),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'skill_id', name='uq_level_overrides_user_id_skill_id'),
    )
    op.create_index(op.f('ix_level_overrides_id'), 'level_overrides', ['id'], unique=False)
    op.alter_column('level_overrides', 'reason', server_default=None)


def downgrade() -> None:
    op.drop_index(op.f('ix_level_overrides_id'), table_name='level_overrides')
    op.drop_table('level_overrides')
