from flask import Blueprint, request, jsonify
from sqlalchemy import inspect
from extensions import db
from models import SensoryQuestion, SensorySetup, SensorySample, SensoryResult, DEMOGRAPHIC_QUESTIONS

sensory_bp = Blueprint("sensory", __name__)


def _ensure_sensory_tables():
    inspector = inspect(db.engine)
    existing_tables = set(inspector.get_table_names())
    required_models = [SensoryQuestion, SensorySetup, SensorySample, SensoryResult]
    missing_tables = [model.__table__ for model in required_models if model.__tablename__ not in existing_tables]
    if missing_tables:
        for table in missing_tables:
            table.create(db.engine, checkfirst=True)


def _get_or_create_setup():
    _ensure_sensory_tables()
    setup = SensorySetup.query.get(1)
    if not setup:
        setup = SensorySetup(id=1, samples_per_panelist=5)
        db.session.add(setup)
        db.session.commit()
    return setup


def _sync_demographic_questions():
    """Ensure the standard demographic questions exist and default to enabled."""
    _ensure_sensory_tables()
    existing_questions = SensoryQuestion.query.filter_by(question_type="demographic").all()
    existing_by_key = {q.demographic_key: q for q in existing_questions if q.demographic_key}
    next_index = (db.session.query(db.func.max(SensoryQuestion.order_index)).scalar() or -1) + 1
    changed = False

    for demographic in DEMOGRAPHIC_QUESTIONS:
        existing = existing_by_key.get(demographic["key"])
        if existing:
            if existing.wording != demographic["wording"]:
                existing.wording = demographic["wording"]
                changed = True
            if existing.options != demographic["options"]:
                existing.options = demographic["options"]
                changed = True
            if existing.enabled is None:
                existing.enabled = True
                changed = True
            continue

        question = SensoryQuestion(
            order_index=next_index,
            question_type="demographic",
            wording=demographic["wording"],
            demographic_key=demographic["key"],
            enabled=True,
            capture_video=False,
        )
        question.options = demographic["options"]
        db.session.add(question)
        next_index += 1
        changed = True

    if changed:
        db.session.commit()


@sensory_bp.route("/sensory_setup", methods=["GET"])
def get_setup():
    setup = _get_or_create_setup()
    return jsonify(setup.to_dict())


@sensory_bp.route("/sensory_setup", methods=["PUT"])
def update_setup():
    data = request.get_json()
    setup = _get_or_create_setup()

    if "samples_per_panelist" in data:
        setup.samples_per_panelist = max(1, int(data["samples_per_panelist"]))

    if "samples" in data:
        SensorySample.query.filter_by(setup_id=setup.id).delete()
        for index, sample in enumerate(data["samples"]):
            sample_number = str(sample.get("sample_number", "")).strip()
            if not sample_number:
                continue
            db.session.add(SensorySample(
                setup_id=setup.id,
                order_index=index,
                sample_number=sample_number,
                real_identifier=(sample.get("real_identifier") or "").strip() or None,
            ))

    db.session.commit()
    return jsonify(setup.to_dict())


# ── Questions ─────────────────────────────────────────────────────────────────

@sensory_bp.route("/sensory_questions", methods=["GET"])
def list_questions():
    _sync_demographic_questions()
    questions = SensoryQuestion.query.order_by(SensoryQuestion.order_index).all()
    return jsonify([q.to_dict() for q in questions])


@sensory_bp.route("/sensory_questions", methods=["POST"])
def add_question():
    data = request.get_json()
    if data["question_type"] == "demographic":
        return jsonify({"error": "Demographic questions are managed automatically"}), 400
    max_idx = db.session.query(db.func.max(SensoryQuestion.order_index)).scalar() or -1
    q = SensoryQuestion(
        order_index=max_idx + 1,
        question_type=data["question_type"],
        attribute=data.get("attribute"),
        wording=data.get("wording"),
        capture_video=data.get("capture_video", False),
        enabled=True,
    )
    q.options = data.get("options", [])
    db.session.add(q)
    db.session.commit()
    return jsonify(q.to_dict()), 201


@sensory_bp.route("/sensory_questions/<int:question_id>", methods=["PUT"])
def update_question(question_id):
    q = SensoryQuestion.query.get_or_404(question_id)
    data = request.get_json()
    if q.question_type == "demographic":
        for field in ("enabled", "order_index"):
            if field in data:
                setattr(q, field, data[field])
        db.session.commit()
        return jsonify(q.to_dict())

    for field in ("attribute", "wording", "capture_video", "enabled", "order_index", "question_type"):
        if field in data:
            setattr(q, field, data[field])
    if "options" in data:
        q.options = data["options"]
    db.session.commit()
    return jsonify(q.to_dict())


@sensory_bp.route("/sensory_questions/<int:question_id>", methods=["DELETE"])
def delete_question(question_id):
    q = SensoryQuestion.query.get_or_404(question_id)
    if q.question_type == "demographic":
        return jsonify({"error": "Demographic questions cannot be deleted, only disabled"}), 400
    db.session.delete(q)
    db.session.commit()
    return jsonify({"status": "ok"})


@sensory_bp.route("/sensory_questions/reorder", methods=["PUT"])
def reorder_questions():
    data = request.get_json()  # [{id, order_index}, ...]
    for item in data:
        q = SensoryQuestion.query.get(item["id"])
        if q:
            q.order_index = item["order_index"]
    db.session.commit()
    return jsonify({"status": "ok"})


# ── Results ───────────────────────────────────────────────────────────────────

@sensory_bp.route("/sensory_results", methods=["POST"])
def submit_results():
    """Submit a batch of responses. Snapshots question data for permanence."""
    from datetime import date as _date
    data = request.get_json()
    panelist_id = str(data["panelist_id"])
    sample_number = data.get("sample_number")
    session_label = data.get("session_label")
    session_date_raw = data.get("session_date")
    session_date = _date.fromisoformat(session_date_raw) if session_date_raw else None

    NUMERIC_QUESTION_TYPES = {"rating_9", "slider_100"}

    for r in data.get("responses", []):
        q = SensoryQuestion.query.get(r.get("question_id")) if r.get("question_id") else None
        q_type = q.question_type if q else r.get("question_type")
        raw_response = r.get("response")
        numeric_response = None
        if q_type in NUMERIC_QUESTION_TYPES and raw_response is not None:
            try:
                numeric_response = float(raw_response)
            except (TypeError, ValueError):
                pass
        db.session.add(SensoryResult(
            session_label=session_label,
            session_date=session_date,
            panelist_id=panelist_id,
            sample_number=sample_number,
            question_id=r.get("question_id"),
            question_type=q_type,
            attribute=q.attribute if q else r.get("attribute"),
            wording=q.wording if q else r.get("wording"),
            demographic_key=r.get("demographic_key") or (q.demographic_key if q else None),
            response=str(raw_response) if raw_response is not None else None,
            numeric_response=numeric_response,
        ))
    db.session.commit()
    return jsonify({"status": "ok"})


@sensory_bp.route("/sensory_results", methods=["GET"])
def get_results():
    results = SensoryResult.query.order_by(
        SensoryResult.session_date.desc(),
        SensoryResult.panelist_id,
        SensoryResult.sample_number,
    ).all()
    return jsonify([r.to_dict() for r in results])


@sensory_bp.route("/sensory_demographic_questions", methods=["GET"])
def demographic_questions():
    return jsonify(DEMOGRAPHIC_QUESTIONS)
