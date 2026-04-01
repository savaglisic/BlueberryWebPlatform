from extensions import db


class HistoricalRank(db.Model):
    __tablename__ = "historical_ranks"

    id = db.Column(db.Integer, primary_key=True)
    genotype = db.Column(db.String(50), nullable=False)
    location = db.Column(db.String(80))
    season = db.Column(db.String(80))

    Flavor_Mean_plus = db.Column(db.Float)
    Selection_Index_2022 = db.Column(db.Float)
    Yield_Greens_plus = db.Column(db.Float)
    avg_firm_plus = db.Column(db.Float)
    brix_plus = db.Column(db.Float)
    ph_plus = db.Column(db.Float)
    weight_plus = db.Column(db.Float)

    ranking_SI22 = db.Column(db.Float)
    rkn_Flavor_Mean_plus = db.Column(db.Float)
    rkn_Yield_Greens_plus = db.Column(db.Float)
    rkn_avg_firm_plus = db.Column(db.Float)
    rkn_brix_plus = db.Column(db.Float)
    rkn_ph_plus = db.Column(db.Float)
    rkn_weight_plus = db.Column(db.Float)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class HistoricalYield(db.Model):
    __tablename__ = "historical_yield"

    id = db.Column(db.Integer, primary_key=True)
    genotype = db.Column(db.String(50), nullable=False)
    location = db.Column(db.String(80))
    season = db.Column(db.String(80))
    cumulative = db.Column(db.Float)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class HistoricalScore(db.Model):
    __tablename__ = "historical_scores"

    id = db.Column(db.Integer, primary_key=True)
    genotype = db.Column(db.String(50), nullable=False)
    location = db.Column(db.String(80))
    season = db.Column(db.String(80))
    flavor_mean = db.Column(db.Float)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class HistoricalFruitQuality(db.Model):
    __tablename__ = "historical_fruit_quality"

    id = db.Column(db.Integer, primary_key=True)
    genotype = db.Column(db.String(50), nullable=False)
    location = db.Column(db.String(80))
    season = db.Column(db.String(80))
    avg_firm = db.Column(db.Float)
    avg_size = db.Column(db.Float)
    brix = db.Column(db.Float)
    ph = db.Column(db.Float)
    tta = db.Column(db.Float)
    weight = db.Column(db.Float)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}
