"""add_admin_roles

Revision ID: 0156864a59b5
Revises: 6240db818db1
Create Date: 2026-07-13 17:26:41.502120

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0156864a59b5'
down_revision: Union[str, None] = '6240db818db1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default бэкфиллит существующих админов значением 'superadmin' —
    # безопасный дефолт (понизить роль вручную проще, чем обнаружить, что
    # кто-то остался без прав). Дефолт снимается сразу после бэкфилла, чтобы
    # новые админы создавались только с явно указанной ролью в коде.
    op.add_column(
        'admins',
        sa.Column('role', sa.String(), nullable=False, server_default='superadmin'),
    )
    op.alter_column('admins', 'role', server_default=None)


def downgrade() -> None:
    op.drop_column('admins', 'role')
