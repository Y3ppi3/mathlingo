"""add_content_flags

Revision ID: f02ffb673b36
Revises: f8e4fc30fd54
Create Date: 2026-07-13 21:46:15.561428

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f02ffb673b36'
down_revision: Union[str, None] = 'f8e4fc30fd54'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'content_flags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=False),
        sa.Column('flag_type', sa.String(), nullable=False),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='open'),
        sa.Column('created_by_admin_id', sa.Integer(), nullable=True),
        sa.Column('resolved_by_admin_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id']),
        sa.ForeignKeyConstraint(['created_by_admin_id'], ['admins.id']),
        sa.ForeignKeyConstraint(['resolved_by_admin_id'], ['admins.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_content_flags_id'), 'content_flags', ['id'], unique=False)
    op.alter_column('content_flags', 'status', server_default=None)


def downgrade() -> None:
    op.drop_index(op.f('ix_content_flags_id'), table_name='content_flags')
    op.drop_table('content_flags')
