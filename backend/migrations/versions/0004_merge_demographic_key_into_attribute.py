"""merge demographic_key into attribute on sensory_results

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Copy demographic_key into attribute where attribute is currently null
    op.execute("""
        UPDATE sensory_results
        SET attribute = demographic_key
        WHERE demographic_key IS NOT NULL AND (attribute IS NULL OR attribute = '')
    """)
    op.drop_column('sensory_results', 'demographic_key')


def downgrade() -> None:
    op.add_column('sensory_results', sa.Column('demographic_key', sa.String(50), nullable=True))
