"""drop session_label from sensory_results

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0005'
down_revision: Union[str, None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('sensory_results', 'session_label')


def downgrade() -> None:
    op.add_column('sensory_results', sa.Column('session_label', sa.String(200), nullable=True))
