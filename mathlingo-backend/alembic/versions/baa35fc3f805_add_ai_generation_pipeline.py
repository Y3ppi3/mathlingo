"""add_ai_generation_pipeline

Revision ID: baa35fc3f805
Revises: e463e998f91d
Create Date: 2026-07-13 21:12:08.575335

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'baa35fc3f805'
down_revision: Union[str, None] = 'e463e998f91d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'prompt_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('template_text', sa.String(), nullable=False),
        sa.Column('task_type', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_prompt_templates_id'), 'prompt_templates', ['id'], unique=False)
    op.alter_column('prompt_templates', 'version', server_default=None)

    op.create_table(
        'ai_generation_orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('subject_id', sa.Integer(), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('level', sa.String(), nullable=False, server_default='standard'),
        sa.Column('task_type', sa.String(), nullable=False),
        sa.Column('count', sa.Integer(), nullable=False),
        sa.Column('constraints', sa.JSON(), nullable=True),
        sa.Column('prompt_template_id', sa.Integer(), nullable=False),
        sa.Column('model_version', sa.String(), nullable=False, server_default='mock-v1'),
        sa.Column('requested_by_admin_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='queued'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id']),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id']),
        sa.ForeignKeyConstraint(['prompt_template_id'], ['prompt_templates.id']),
        sa.ForeignKeyConstraint(['requested_by_admin_id'], ['admins.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ai_generation_orders_id'), 'ai_generation_orders', ['id'], unique=False)
    op.alter_column('ai_generation_orders', 'level', server_default=None)
    op.alter_column('ai_generation_orders', 'model_version', server_default=None)
    op.alter_column('ai_generation_orders', 'status', server_default=None)

    op.create_table(
        'ai_generation_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('index_in_order', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('failure_reason', sa.String(), nullable=True),
        sa.Column('draft_json', sa.JSON(), nullable=True),
        sa.Column('validation_result', sa.JSON(), nullable=True),
        sa.Column('sanitization_result', sa.JSON(), nullable=True),
        sa.Column('deterministic_check_result', sa.JSON(), nullable=True),
        sa.Column('ai_critic_result', sa.JSON(), nullable=True),
        sa.Column('task_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], ['ai_generation_orders.id']),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ai_generation_items_id'), 'ai_generation_items', ['id'], unique=False)
    op.alter_column('ai_generation_items', 'status', server_default=None)


def downgrade() -> None:
    op.drop_index(op.f('ix_ai_generation_items_id'), table_name='ai_generation_items')
    op.drop_table('ai_generation_items')
    op.drop_index(op.f('ix_ai_generation_orders_id'), table_name='ai_generation_orders')
    op.drop_table('ai_generation_orders')
    op.drop_index(op.f('ix_prompt_templates_id'), table_name='prompt_templates')
    op.drop_table('prompt_templates')
