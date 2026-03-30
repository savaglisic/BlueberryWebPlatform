from extensions import db


class OptionConfig(db.Model):
    __tablename__ = "option_configs"

    id = db.Column(db.Integer, primary_key=True)
    option_type = db.Column(db.String(120), nullable=False)
    option_text = db.Column(db.String(120), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "option_type": self.option_type,
            "option_text": self.option_text,
        }


class APIKey(db.Model):
    __tablename__ = "api_keys"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(64), unique=True, nullable=False)
    description = db.Column(db.String(255))

    def to_dict(self):
        return {"id": self.id, "key": self.key, "description": self.description}
