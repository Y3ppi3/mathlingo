"""add_skills_table

Revision ID: 085e47fdaffd
Revises: 0156864a59b5
Create Date: 2026-07-13 17:56:12.083516

"""
from typing import Sequence, Union
from datetime import datetime

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '085e47fdaffd'
down_revision: Union[str, None] = '0156864a59b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'skills',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('subject_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('subject_id', 'code', name='uq_skills_subject_id_code'),
    )
    op.create_index(op.f('ix_skills_id'), 'skills', ['id'], unique=False)

    # Бэкфилл: по одной теме "Общее" на каждый существующий раздел, чтобы
    # темы сразу можно было привязывать к контенту и ни один Subject не
    # остался без тем. Через sa.table/sa.column (не ORM-модели), как
    # рекомендует Alembic для data-миграций — не зависит от будущих правок
    # app/models.py.
    subjects = sa.table('subjects', sa.column('id', sa.Integer))
    skills = sa.table(
        'skills',
        sa.column('subject_id', sa.Integer),
        sa.column('name', sa.String),
        sa.column('code', sa.String),
        sa.column('order', sa.Integer),
        sa.column('is_active', sa.Boolean),
        sa.column('created_at', sa.DateTime),
    )

    connection = op.get_bind()
    subject_ids = [row[0] for row in connection.execute(sa.select(subjects.c.id))]
    if subject_ids:
        now = datetime.utcnow()
        connection.execute(
            skills.insert(),
            [
                {
                    'subject_id': subject_id,
                    'name': 'Общее',
                    'code': 'general',
                    'order': 0,
                    'is_active': True,
                    'created_at': now,
                }
                for subject_id in subject_ids
            ],
        )


def downgrade() -> None:
    op.drop_index(op.f('ix_skills_id'), table_name='skills')
    op.drop_table('skills')
