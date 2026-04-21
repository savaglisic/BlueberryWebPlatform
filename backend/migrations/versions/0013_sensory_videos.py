"""add sensory_videos table

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0013'
down_revision: Union[str, None] = '0012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sensory_videos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_date', sa.Date(), nullable=False),
        sa.Column('panelist_id', sa.String(50), nullable=False),
        sa.Column('sample_number', sa.String(50), nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=True),
        sa.Column('attribute', sa.String(200), nullable=True),
        sa.Column('object_name', sa.Text(), nullable=False),
        sa.Column('recorded_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('sensory_videos')
