import json
from extensions import db

QUESTION_TYPES = (
    "rating_9",        # 1–9 hedonic scale
    "slider_100",      # 0–100 intensity slider
    "text",            # long-form open response
    "multiple_choice", # custom options
    "instruction",     # non-question panelist instruction
    "demographic",     # hardcoded demographic question
)

DEMOGRAPHIC_QUESTIONS = [
    {
        "key": "gender",
        "wording": "Please indicate your gender.",
        "type": "multiple_choice",
        "options": ["Male", "Female", "I prefer not to say"],
    },
    {
        "key": "age",
        "wording": "Please indicate your age.",
        "type": "text",
        "options": [],
    },
    {
        "key": "ethnicity",
        "wording": "What is your ethnic background?",
        "type": "multiple_choice",
        "options": ["Hispanic", "Non-Hispanic"],
    },
    {
        "key": "race",
        "wording": "Which of the following best describes you?",
        "type": "multiple_choice",
        "options": [
            "Asian/Pacific Islander",
            "Black or African American",
            "White or Caucasian",
            "Native American/Alaska Native/Aleutian",
            "Other",
        ],
    },
    {
        "key": "blueberry_frequency",
        "wording": "How often do you eat fresh blueberries?",
        "type": "multiple_choice",
        "options": [
            "Once a day",
            "2–3 times a week",
            "Once a week",
            "2–3 times a month",
            "Once per month",
            "Twice per year",
            "Once per year",
            "Never or almost never",
        ],
    },
]


class SensoryQuestion(db.Model):
    __tablename__ = "sensory_questions"

    id = db.Column(db.Integer, primary_key=True)
    order_index = db.Column(db.Integer, nullable=False, default=0)
    question_type = db.Column(db.String(30), nullable=False)
    attribute = db.Column(db.String(200))
    wording = db.Column(db.Text)
    options_json = db.Column(db.Text)
    capture_video = db.Column(db.Boolean, default=False, nullable=False)
    demographic_key = db.Column(db.String(50))
    enabled = db.Column(db.Boolean, default=True, nullable=False)

    @property
    def options(self):
        if self.options_json:
            try:
                return json.loads(self.options_json)
            except Exception:
                return []
        return []

    @options.setter
    def options(self, value):
        self.options_json = json.dumps(value) if value is not None else None

    def to_dict(self):
        return {
            "id": self.id,
            "order_index": self.order_index,
            "question_type": self.question_type,
            "attribute": self.attribute,
            "wording": self.wording,
            "options": self.options,
            "capture_video": self.capture_video,
            "demographic_key": self.demographic_key,
            "enabled": self.enabled,
        }


class SensorySetup(db.Model):
    __tablename__ = "sensory_setup"

    id = db.Column(db.Integer, primary_key=True, default=1)
    samples_per_panelist = db.Column(db.Integer, nullable=False, default=5)

    samples = db.relationship(
        "SensorySample",
        backref="setup",
        cascade="all, delete-orphan",
        order_by="SensorySample.order_index",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "samples_per_panelist": self.samples_per_panelist,
            "samples": [sample.to_dict() for sample in self.samples],
        }


class SensorySample(db.Model):
    __tablename__ = "sensory_samples"

    id = db.Column(db.Integer, primary_key=True)
    setup_id = db.Column(db.Integer, db.ForeignKey("sensory_setup.id"), nullable=False, default=1)
    order_index = db.Column(db.Integer, nullable=False, default=0)
    sample_number = db.Column(db.String(50), nullable=False)
    real_identifier = db.Column(db.String(200))

    def to_dict(self):
        return {
            "id": self.id,
            "order_index": self.order_index,
            "sample_number": self.sample_number,
            "real_identifier": self.real_identifier,
        }


class Panelist(db.Model):
    """Tracks a panelist's session for a given date. Panelist IDs repeat across days."""
    __tablename__ = "panelists"

    id = db.Column(db.Integer, primary_key=True)
    panelist_id = db.Column(db.String(50), nullable=False)
    session_date = db.Column(db.Date, nullable=False)
    demographics_complete = db.Column(db.Boolean, default=False, nullable=False)
    started_at = db.Column(db.DateTime, server_default=db.func.now())

    __table_args__ = (db.UniqueConstraint("panelist_id", "session_date", name="uq_panelist_date"),)

    def to_dict(self):
        return {
            "id": self.id,
            "panelist_id": self.panelist_id,
            "session_date": self.session_date.isoformat(),
            "demographics_complete": self.demographics_complete,
            "started_at": self.started_at.isoformat() if self.started_at else None,
        }


class SensoryResult(db.Model):
    __tablename__ = "sensory_results"

    id = db.Column(db.Integer, primary_key=True)
    # Session metadata — free-form, not a FK
    session_label = db.Column(db.String(200))   # e.g. "Spring 2026 Panel – Apr 1"
    session_date = db.Column(db.Date)
    panelist_id = db.Column(db.String(50), nullable=False)
    sample_number = db.Column(db.String(50))    # null for demographic responses
    # Redundant question snapshot so results survive question edits
    question_id = db.Column(db.Integer)         # soft reference only, no FK
    question_type = db.Column(db.String(30))
    attribute = db.Column(db.String(200))
    wording = db.Column(db.Text)
    demographic_key = db.Column(db.String(50))
    response = db.Column(db.Text)
    numeric_response = db.Column(db.Float)
    recorded_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "session_label": self.session_label,
            "session_date": self.session_date.isoformat() if self.session_date else None,
            "panelist_id": self.panelist_id,
            "sample_number": self.sample_number,
            "question_id": self.question_id,
            "question_type": self.question_type,
            "attribute": self.attribute,
            "wording": self.wording,
            "demographic_key": self.demographic_key,
            "response": self.response,
            "numeric_response": self.numeric_response,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
        }
