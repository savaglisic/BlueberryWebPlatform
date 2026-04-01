import json
from extensions import db


class SensoryPanel(db.Model):
    __tablename__ = "sensory_panels"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    panel_date = db.Column(db.Date)
    samples_per_panelist = db.Column(db.Integer, nullable=False, default=5)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    samples = db.relationship("SensoryPanelSample", back_populates="panel", cascade="all, delete-orphan", order_by="SensoryPanelSample.sample_number")
    questions = db.relationship("SensoryPanelQuestion", back_populates="panel", cascade="all, delete-orphan", order_by="SensoryPanelQuestion.order_index")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "panel_date": self.panel_date.isoformat() if self.panel_date else None,
            "samples_per_panelist": self.samples_per_panelist,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "samples": [s.to_dict() for s in self.samples],
            "questions": [q.to_dict() for q in self.questions],
        }


class SensoryPanelSample(db.Model):
    __tablename__ = "sensory_panel_samples"

    id = db.Column(db.Integer, primary_key=True)
    panel_id = db.Column(db.Integer, db.ForeignKey("sensory_panels.id"), nullable=False)
    sample_number = db.Column(db.String(50), nullable=False)   # label shown to panelist
    true_identifier = db.Column(db.String(200))                # hidden genotype/barcode

    panel = db.relationship("SensoryPanel", back_populates="samples")

    def to_dict(self):
        return {
            "id": self.id,
            "panel_id": self.panel_id,
            "sample_number": self.sample_number,
            "true_identifier": self.true_identifier,
        }


# Question types
QUESTION_TYPES = (
    "rating_9",        # 1–9 hedonic scale
    "slider_100",      # 0–100 intensity slider
    "text",            # long-form open response
    "multiple_choice", # custom options
    "instruction",     # non-question panelist instruction
    "demographic",     # hardcoded demographic question (toggled on/off)
)

# Hardcoded demographic question definitions (never stored as free-form)
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


class SensoryPanelQuestion(db.Model):
    __tablename__ = "sensory_panel_questions"

    id = db.Column(db.Integer, primary_key=True)
    panel_id = db.Column(db.Integer, db.ForeignKey("sensory_panels.id"), nullable=False)
    order_index = db.Column(db.Integer, nullable=False, default=0)
    question_type = db.Column(db.String(30), nullable=False)  # one of QUESTION_TYPES
    attribute = db.Column(db.String(200))       # e.g. "Sweetness" (experimental questions)
    wording = db.Column(db.Text)                # full question text shown to panelist
    # JSON array of strings for multiple_choice options; null for other types
    options_json = db.Column(db.Text)
    capture_video = db.Column(db.Boolean, default=False, nullable=False)
    # For demographic questions: the key from DEMOGRAPHIC_QUESTIONS
    demographic_key = db.Column(db.String(50))
    enabled = db.Column(db.Boolean, default=True, nullable=False)

    panel = db.relationship("SensoryPanel", back_populates="questions")

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
            "panel_id": self.panel_id,
            "order_index": self.order_index,
            "question_type": self.question_type,
            "attribute": self.attribute,
            "wording": self.wording,
            "options": self.options,
            "capture_video": self.capture_video,
            "demographic_key": self.demographic_key,
            "enabled": self.enabled,
        }


class SensoryPanelResult(db.Model):
    __tablename__ = "sensory_panel_results"

    id = db.Column(db.Integer, primary_key=True)
    panel_id = db.Column(db.Integer, db.ForeignKey("sensory_panels.id"), nullable=False)
    panelist_id = db.Column(db.String(50), nullable=False)
    # null for demographic responses (not tied to a sample)
    sample_number = db.Column(db.String(50))
    # Nullable FK — question may be deleted later but result is preserved
    question_id = db.Column(db.Integer, db.ForeignKey("sensory_panel_questions.id"), nullable=True)
    # Redundant copies so results are self-describing even after question edits/deletion
    question_type = db.Column(db.String(30))
    attribute = db.Column(db.String(200))
    wording = db.Column(db.Text)
    demographic_key = db.Column(db.String(50))
    response = db.Column(db.Text)
    recorded_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "panel_id": self.panel_id,
            "panelist_id": self.panelist_id,
            "sample_number": self.sample_number,
            "question_id": self.question_id,
            "question_type": self.question_type,
            "attribute": self.attribute,
            "wording": self.wording,
            "demographic_key": self.demographic_key,
            "response": self.response,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
        }
