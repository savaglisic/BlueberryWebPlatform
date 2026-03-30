from datetime import datetime, timezone
from extensions import db


class PlantData(db.Model):
    __tablename__ = "plant_data"

    id = db.Column(db.Integer, primary_key=True)
    barcode = db.Column(db.String(100), unique=True, nullable=False)

    # Taxonomy
    genotype = db.Column(db.String(100))
    stage = db.Column(db.String(80))
    site = db.Column(db.String(80))
    block = db.Column(db.String(80))
    project = db.Column(db.String(80))
    post_harvest = db.Column(db.String(80))
    bush_plant_number = db.Column(db.String(80))

    # Yield
    mass = db.Column(db.Float)
    number_of_berries = db.Column(db.Integer)
    x_berry_mass = db.Column(db.Float)
    box = db.Column(db.Integer)

    # Quality
    ph = db.Column(db.Float)
    brix = db.Column(db.Float)
    juicemass = db.Column(db.Float)
    tta = db.Column(db.Float)
    mladded = db.Column(db.Float)

    # Firmness
    avg_firmness = db.Column(db.Float)
    avg_diameter = db.Column(db.Float)
    sd_firmness = db.Column(db.Float)
    sd_diameter = db.Column(db.Float)

    # Meta
    notes = db.Column(db.String(255))
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    fruitfirm_timestamp = db.Column(db.DateTime)
    week = db.Column(db.Integer, default=lambda: datetime.now(timezone.utc).isocalendar()[1])

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class Genotype(db.Model):
    __tablename__ = "genotypes"

    id = db.Column(db.Integer, primary_key=True)
    genotype = db.Column(db.String(255), unique=True, nullable=False)

    def to_dict(self):
        return {"id": self.id, "genotype": self.genotype}
