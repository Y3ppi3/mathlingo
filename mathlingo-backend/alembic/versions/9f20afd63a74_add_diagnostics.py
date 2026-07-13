"""add_diagnostics

Revision ID: 9f20afd63a74
Revises: 7237168df4ae
Create Date: 2026-07-13 20:44:45.782419

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f20afd63a74'
down_revision: Union[str, None] = '7237168df4ae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'diagnostics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('task_ids', sa.JSON(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by_admin_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id']),
        sa.ForeignKeyConstraint(['created_by_admin_id'], ['admins.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_diagnostics_id'), 'diagnostics', ['id'], unique=False)
    op.alter_column('diagnostics', 'is_active', server_default=None)


def downgrade() -> None:
    op.drop_index(op.f('ix_diagnostics_id'), table_name='diagnostics')
    op.drop_table('diagnostics')
