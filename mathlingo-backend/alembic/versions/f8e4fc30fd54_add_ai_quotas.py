"""add_ai_quotas

Revision ID: f8e4fc30fd54
Revises: baa35fc3f805
Create Date: 2026-07-13 21:27:22.398267

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8e4fc30fd54'
down_revision: Union[str, None] = 'baa35fc3f805'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ai_quotas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('admin_id', sa.Integer(), nullable=False),
        sa.Column('period', sa.String(), nullable=False),
        sa.Column('monthly_limit', sa.Integer(), nullable=False),
        sa.Column('used', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['admin_id'], ['admins.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('admin_id', name='uq_ai_quotas_admin_id'),
    )
    op.create_index(op.f('ix_ai_quotas_id'), 'ai_quotas', ['id'], unique=False)
    op.alter_column('ai_quotas', 'used', server_default=None)


def downgrade() -> None:
    op.drop_index(op.f('ix_ai_quotas_id'), table_name='ai_quotas')
    op.drop_table('ai_quotas')
