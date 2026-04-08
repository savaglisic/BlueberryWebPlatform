"""add firm_category and size_category to plant_data

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0007'
down_revision: Union[str, None] = '0006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('plant_data', sa.Column('firm_category', sa.Float(), nullable=True))
    op.add_column('plant_data', sa.Column('size_category', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('plant_data', 'size_category')
    op.drop_column('plant_data', 'firm_category')
