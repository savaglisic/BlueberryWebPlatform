"""add sensory_question_sets table and backfill demographic attribute from demographic_key

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0008'
down_revision: Union[str, None] = '0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sensory_question_sets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('questions_json', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    # Backfill attribute from demographic_key for existing demographic questions
    # so that results stored going forward use a consistent attribute label.
    op.execute(
        """
        UPDATE sensory_questions
        SET attribute = demographic_key
        WHERE question_type = 'demographic'
          AND (attribute IS NULL OR attribute = '')
          AND demographic_key IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_table('sensory_question_sets')
