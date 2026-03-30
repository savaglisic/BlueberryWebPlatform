from extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    user_name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    user_group = db.Column(db.String(80), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "user_name": self.user_name,
            "email": self.email,
            "user_group": self.user_group,
        }


class EmailWhitelist(db.Model):
    __tablename__ = "email_whitelist"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)

    def to_dict(self):
        return {"id": self.id, "email": self.email}
