import json
from datetime import datetime, timezone
from extensions import db


class AuditLog(db.Model):
    __tablename__ = "audit_log"

    id = db.Column(db.Integer, primary_key=True)
    barcode = db.Column(db.String(100), nullable=False, index=True)
    action = db.Column(db.String(20), nullable=False)  # "barcode_created" or "field_updated"
    fields_changed = db.Column(db.Text)  # JSON array of field names
    user_email = db.Column(db.String(255))
    recorded_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def to_dict(self):
        return {
            "id": self.id,
            "barcode": self.barcode,
            "action": self.action,
            "fields_changed": json.loads(self.fields_changed) if self.fields_changed else [],
            "user_email": self.user_email,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
        }
