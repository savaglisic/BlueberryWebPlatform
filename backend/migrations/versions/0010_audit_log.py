"""audit_log table

Revision ID: 0010
Revises: 0009
Create Date: 2026-04-19
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("barcode", sa.String(100), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("fields_changed", sa.Text(), nullable=True),
        sa.Column("user_email", sa.String(255), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_log_barcode", "audit_log", ["barcode"])


def downgrade():
    op.drop_index("ix_audit_log_barcode", table_name="audit_log")
    op.drop_table("audit_log")
