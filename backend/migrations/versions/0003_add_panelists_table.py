"""add panelists table

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS panelists (
            id SERIAL PRIMARY KEY,
            panelist_id VARCHAR(50) NOT NULL,
            session_date DATE NOT NULL,
            demographics_complete BOOLEAN NOT NULL DEFAULT FALSE,
            started_at TIMESTAMP DEFAULT NOW(),
            CONSTRAINT uq_panelist_date UNIQUE (panelist_id, session_date)
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS panelists")
