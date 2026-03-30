"""
Run once to create all tables and seed default data.
Usage: flask --app app shell < init_db.py
   or: python init_db.py
"""
from app import create_app
from extensions import db
from models import EmailWhitelist, OptionConfig

DEFAULT_EMAIL = "savaglisic@ufl.edu"

DEFAULT_OPTIONS = [
    ("stage", "Green"),
    ("stage", "Turning"),
    ("stage", "Ripe"),
    ("site", "Citra"),
    ("site", "Balm"),
    ("block", "A"),
    ("block", "B"),
    ("project", "Blueberry"),
    ("post_harvest", "Yes"),
    ("post_harvest", "No"),
    ("ph_range", "3.0-4.0"),
    ("brix_range", "8-14"),
    ("tta_range", "0.5-1.5"),
]

app = create_app()

with app.app_context():
    db.create_all()
    print("Tables created.")

    if not EmailWhitelist.query.filter_by(email=DEFAULT_EMAIL).first():
        db.session.add(EmailWhitelist(email=DEFAULT_EMAIL))
        print(f"Whitelisted {DEFAULT_EMAIL}")

    for option_type, option_text in DEFAULT_OPTIONS:
        exists = OptionConfig.query.filter_by(
            option_type=option_type, option_text=option_text
        ).first()
        if not exists:
            db.session.add(OptionConfig(option_type=option_type, option_text=option_text))

    db.session.commit()
    print("Seed data inserted.")
