"""add_game_scenarios_and_checklist

Revision ID: e89701f24df9
Revises: f02ffb673b36
Create Date: 2026-07-13 22:07:39.733924

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e89701f24df9'
down_revision: Union[str, None] = 'f02ffb673b36'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'game_scenarios',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('template_key', sa.String(), nullable=False),
        sa.Column('config', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='draft'),
        sa.Column('level_range', sa.JSON(), nullable=True),
        sa.Column('availability_from', sa.DateTime(), nullable=True),
        sa.Column('availability_to', sa.DateTime(), nullable=True),
        sa.Column('created_by_admin_id', sa.Integer(), nullable=True),
        sa.Column('preview_passed_at', sa.DateTime(), nullable=True),
        sa.Column('published_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['created_by_admin_id'], ['admins.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_game_scenarios_id'), 'game_scenarios', ['id'], unique=False)
    op.alter_column('game_scenarios', 'status', server_default=None)

    op.create_table(
        'game_scenario_checklist',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('scenario_id', sa.Integer(), nullable=False),
        sa.Column('item_key', sa.String(), nullable=False),
        sa.Column('checked_by_admin_id', sa.Integer(), nullable=True),
        sa.Column('checked_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['scenario_id'], ['game_scenarios.id']),
        sa.ForeignKeyConstraint(['checked_by_admin_id'], ['admins.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('scenario_id', 'item_key', name='uq_game_scenario_checklist_scenario_item'),
    )
    op.create_index(op.f('ix_game_scenario_checklist_id'), 'game_scenario_checklist', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_game_scenario_checklist_id'), table_name='game_scenario_checklist')
    op.drop_table('game_scenario_checklist')
    op.drop_index(op.f('ix_game_scenarios_id'), table_name='game_scenarios')
    op.drop_table('game_scenarios')
