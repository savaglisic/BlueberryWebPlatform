"""backfill audit_log barcode_created from plant_data.timestamp

Revision ID: 0011
Revises: 0010
Create Date: 2026-04-19
"""
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        INSERT INTO audit_log (barcode, action, fields_changed, user_email, recorded_at)
        SELECT
            barcode,
            'barcode_created',
            NULL,
            'mesantana@ufl.edu',
            COALESCE(timestamp, NOW())
        FROM plant_data
        WHERE barcode IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM audit_log
              WHERE audit_log.barcode = plant_data.barcode
                AND audit_log.action = 'barcode_created'
          )
    """)


def downgrade():
    op.execute("""
        DELETE FROM audit_log
        WHERE action = 'barcode_created'
          AND user_email = 'mesantana@ufl.edu'
    """)
