"""add updated_at to plant_data

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0006'
down_revision: Union[str, None] = '0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'plant_data',
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True)
    )

    # Trigger function: sets updated_at to now on any row update
    op.execute("""
        CREATE OR REPLACE FUNCTION set_plant_data_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER plant_data_set_updated_at
        BEFORE UPDATE ON plant_data
        FOR EACH ROW
        EXECUTE FUNCTION set_plant_data_updated_at();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS plant_data_set_updated_at ON plant_data")
    op.execute("DROP FUNCTION IF EXISTS set_plant_data_updated_at")
    op.drop_column('plant_data', 'updated_at')
