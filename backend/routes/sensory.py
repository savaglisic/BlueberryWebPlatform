import json

from flask import Blueprint, request, jsonify
from sqlalchemy import inspect
from extensions import db
from models import SensoryQuestion, SensorySetup, SensorySample, SensoryResult, SensoryQuestionSet, DEMOGRAPHIC_QUESTIONS

sensory_bp = Blueprint("sensory", __name__)


def _ensure_sensory_tables():
    inspector = inspect(db.engine)
    existing_tables = set(inspector.get_table_names())
    required_models = [SensoryQuestion, SensorySetup, SensorySample, SensoryResult, SensoryQuestionSet]
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


def _seed_demographic_questions():
    """Seed the standard demographic questions on first use (runs only when there are none)."""
    next_index = (db.session.query(db.func.max(SensoryQuestion.order_index)).scalar() or -1) + 1
    for demographic in DEMOGRAPHIC_QUESTIONS:
        has_options = bool(demographic.get("options"))
        q = SensoryQuestion(
            order_index=next_index,
            question_type="multiple_choice" if has_options else "text",
            attribute=demographic["key"],
            wording=demographic["wording"],
            demographic_key=demographic["key"],
            enabled=True,
            capture_video=False,
        )
        q.options = demographic["options"]
        db.session.add(q)
        next_index += 1
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
    _ensure_sensory_tables()
    # Seed demographic defaults on first ever load (identified by demographic_key)
    if SensoryQuestion.query.filter(SensoryQuestion.demographic_key.isnot(None)).count() == 0:
        _seed_demographic_questions()
    questions = SensoryQuestion.query.order_by(SensoryQuestion.order_index).all()
    return jsonify([q.to_dict() for q in questions])


@sensory_bp.route("/sensory_questions", methods=["POST"])
def add_question():
    data = request.get_json()
    max_idx = db.session.query(db.func.max(SensoryQuestion.order_index)).scalar() or -1
    q = SensoryQuestion(
        order_index=max_idx + 1,
        question_type=data["question_type"],
        attribute=data.get("attribute"),
        wording=data.get("wording"),
        capture_video=data.get("capture_video", False),
        demographic_key=data.get("demographic_key"),
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
    for field in ("attribute", "wording", "capture_video", "enabled", "order_index", "question_type", "demographic_key"):
        if field in data:
            setattr(q, field, data[field])
    if "options" in data:
        q.options = data["options"]
    db.session.commit()
    return jsonify(q.to_dict())


@sensory_bp.route("/sensory_questions/<int:question_id>", methods=["DELETE"])
def delete_question(question_id):
    q = SensoryQuestion.query.get_or_404(question_id)
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


# ── Question Sets ──────────────────────────────────────────────────────────────

@sensory_bp.route("/sensory_question_sets", methods=["GET"])
def list_question_sets():
    _ensure_sensory_tables()
    sets = SensoryQuestionSet.query.order_by(SensoryQuestionSet.created_at.desc()).all()
    return jsonify([s.to_list_dict() for s in sets])


@sensory_bp.route("/sensory_question_sets", methods=["POST"])
def create_question_set():
    _ensure_sensory_tables()
    data = request.get_json()
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    questions = SensoryQuestion.query.order_by(SensoryQuestion.order_index).all()
    qs = SensoryQuestionSet(
        name=name,
        questions_json=json.dumps([q.to_dict() for q in questions]),
    )
    db.session.add(qs)
    db.session.commit()
    return jsonify(qs.to_list_dict()), 201


@sensory_bp.route("/sensory_question_sets/<int:set_id>", methods=["DELETE"])
def delete_question_set(set_id):
    qs = SensoryQuestionSet.query.get_or_404(set_id)
    db.session.delete(qs)
    db.session.commit()
    return jsonify({"status": "ok"})


@sensory_bp.route("/sensory_question_sets/<int:set_id>/load", methods=["POST"])
def load_question_set(set_id):
    """Replace all current questions with the saved snapshot."""
    qs = SensoryQuestionSet.query.get_or_404(set_id)
    SensoryQuestion.query.delete()
    for q_data in qs.questions:
        q = SensoryQuestion(
            order_index=q_data["order_index"],
            question_type=q_data["question_type"],
            attribute=q_data.get("attribute"),
            wording=q_data.get("wording"),
            capture_video=q_data.get("capture_video", False),
            demographic_key=q_data.get("demographic_key"),
            enabled=q_data.get("enabled", True),
        )
        q.options = q_data.get("options", [])
        db.session.add(q)
    db.session.commit()
    questions = SensoryQuestion.query.order_by(SensoryQuestion.order_index).all()
    return jsonify([q.to_dict() for q in questions])


# ── Results ───────────────────────────────────────────────────────────────────

@sensory_bp.route("/sensory_results", methods=["POST"])
def submit_results():
    """Submit a batch of responses. Snapshots question data for permanence."""
    from datetime import date as _date
    data = request.get_json()
    panelist_id = str(data["panelist_id"])
    sample_number = data.get("sample_number")
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
            session_date=session_date,
            panelist_id=panelist_id,
            sample_number=sample_number,
            question_id=r.get("question_id"),
            question_type=q_type,
            attribute=(q.attribute if q else None) or (q.demographic_key if q else None) or r.get("attribute") or r.get("demographic_key"),
            wording=q.wording if q else r.get("wording"),
            response=str(raw_response) if raw_response is not None else None,
            numeric_response=numeric_response,
        ))
    db.session.commit()
    return jsonify({"status": "ok"})


@sensory_bp.route("/sensory_results", methods=["GET"])
def get_results():
    from sqlalchemy import tuple_
    date_filter = request.args.get("date")
    page = max(1, int(request.args.get("page", 1)))
    per_page = min(10000, max(1, int(request.args.get("per_page", 50))))

    base = SensoryResult.query
    if date_filter:
        base = base.filter(SensoryResult.session_date == date_filter)

    # Paginate by (panelist_id, sample_number) pairs, newest submission first
    from sqlalchemy import func as _func
    pairs_q = (
        base.filter(SensoryResult.sample_number.isnot(None))
        .with_entities(
            SensoryResult.panelist_id,
            SensoryResult.sample_number,
            _func.max(SensoryResult.recorded_at).label("latest"),
        )
        .group_by(SensoryResult.panelist_id, SensoryResult.sample_number)
        .order_by(db.text("latest DESC"))
    )
    total_pairs = pairs_q.count()
    pairs = [(r.panelist_id, r.sample_number) for r in pairs_q.offset((page - 1) * per_page).limit(per_page).all()]

    if not pairs:
        return jsonify({"results": [], "total": total_pairs, "page": page, "per_page": per_page})

    panelist_ids = list({p for p, _ in pairs})
    experimental = (
        base.filter(tuple_(SensoryResult.panelist_id, SensoryResult.sample_number).in_(pairs))
        .order_by(SensoryResult.panelist_id, SensoryResult.sample_number)
        .all()
    )
    demographic = (
        base.filter(
            SensoryResult.sample_number.is_(None),
            SensoryResult.panelist_id.in_(panelist_ids),
        )
        .all()
    )
    results = experimental + demographic
    return jsonify({
        "results": [r.to_dict() for r in results],
        "total": total_pairs,
        "page": page,
        "per_page": per_page,
    })


@sensory_bp.route("/sensory_result_dates", methods=["GET"])
def get_result_dates():
    from sqlalchemy import distinct
    dates = (
        db.session.query(distinct(SensoryResult.session_date))
        .filter(SensoryResult.session_date.isnot(None))
        .order_by(SensoryResult.session_date.desc())
        .all()
    )
    return jsonify([row[0] for row in dates])


@sensory_bp.route("/sensory_results/berry", methods=["DELETE"])
def delete_berry_result():
    panelist_id = request.json.get("panelist_id")
    sample_number = request.json.get("sample_number")
    date = request.json.get("date")
    if not panelist_id or not sample_number or not date:
        return jsonify({"error": "panelist_id, sample_number, and date are required"}), 400
    SensoryResult.query.filter_by(
        panelist_id=panelist_id,
        sample_number=sample_number,
        session_date=date,
    ).delete()
    db.session.commit()
    return jsonify({"ok": True})


@sensory_bp.route("/sensory_results/demographics", methods=["DELETE"])
def delete_demo_result():
    panelist_id = request.json.get("panelist_id")
    date = request.json.get("date")
    if not panelist_id or not date:
        return jsonify({"error": "panelist_id and date are required"}), 400
    SensoryResult.query.filter_by(
        panelist_id=panelist_id,
        sample_number=None,
        session_date=date,
    ).delete()
    db.session.commit()
    return jsonify({"ok": True})


@sensory_bp.route("/sensory_demographic_questions", methods=["GET"])
def demographic_questions():
    return jsonify(DEMOGRAPHIC_QUESTIONS)
