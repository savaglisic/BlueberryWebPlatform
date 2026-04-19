"""backfill audit_log field_updated from plant_data for FruitFirm and lab data

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-19
"""
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None

FRUITFIRM_FIELDS = '["avg_firmness", "avg_diameter", "sd_firmness", "sd_diameter", "firm_category", "size_category"]'
LAB_FIELDS = '["ph", "mass", "brix", "tta"]'


def upgrade():
    # FruitFirm: one entry per barcode that has firmness data and no existing FruitFirm audit entry
    op.execute(f"""
        INSERT INTO audit_log (barcode, action, fields_changed, user_email, recorded_at)
        SELECT
            barcode,
            'field_updated',
            '{FRUITFIRM_FIELDS}',
            'FruitFirm',
            fruitfirm_timestamp
        FROM plant_data
        WHERE fruitfirm_timestamp IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM audit_log
              WHERE audit_log.barcode = plant_data.barcode
                AND audit_log.action = 'field_updated'
                AND audit_log.user_email = 'FruitFirm'
          )
    """)

    # Lab data: one entry per barcode that has any of ph/mass/brix/tta and no existing field_updated entry
    op.execute(f"""
        INSERT INTO audit_log (barcode, action, fields_changed, user_email, recorded_at)
        SELECT
            barcode,
            'field_updated',
            '{LAB_FIELDS}',
            'mesantana@ufl.edu',
            COALESCE(updated_at, timestamp, NOW())
        FROM plant_data
        WHERE (ph IS NOT NULL OR mass IS NOT NULL OR brix IS NOT NULL OR tta IS NOT NULL)
          AND NOT EXISTS (
              SELECT 1 FROM audit_log
              WHERE audit_log.barcode = plant_data.barcode
                AND audit_log.action = 'field_updated'
                AND audit_log.user_email != 'FruitFirm'
          )
    """)


def downgrade():
    op.execute("""
        DELETE FROM audit_log
        WHERE action = 'field_updated'
          AND user_email = 'FruitFirm'
          AND id NOT IN (
              SELECT id FROM audit_log
              WHERE action = 'field_updated'
                AND user_email = 'FruitFirm'
                AND recorded_at > (SELECT MAX(recorded_at) FROM audit_log WHERE user_email != 'FruitFirm' AND user_email != 'mesantana@ufl.edu')
          )
    """)
    op.execute("""
        DELETE FROM audit_log
        WHERE action = 'field_updated'
          AND user_email = 'mesantana@ufl.edu'
    """)
