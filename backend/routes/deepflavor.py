from datetime import date as _date

from flask import Blueprint, jsonify, request
from sqlalchemy import inspect

from extensions import db
from models import (
    Panelist,
    SensoryQuestion,
    SensoryResult,
    SensorySetup,
    SensorySample,
    DEMOGRAPHIC_QUESTIONS,
)

deepflavor_bp = Blueprint("deepflavor", __name__)


def _ensure_panelists_table():
    inspector = inspect(db.engine)
    if "panelists" not in set(inspector.get_table_names()):
        Panelist.__table__.create(db.engine, checkfirst=True)


def _get_or_create_panelist(panelist_id: str, session_date: _date) -> Panelist:
    _ensure_panelists_table()
    panelist = Panelist.query.filter_by(
        panelist_id=panelist_id, session_date=session_date
    ).first()
    if not panelist:
        panelist = Panelist(panelist_id=panelist_id, session_date=session_date)
        db.session.add(panelist)
        db.session.commit()
    return panelist


def _get_completed_samples(panelist_id: str, session_date: _date) -> list[str]:
    """Return the list of sample_numbers this panelist has already submitted responses for today."""
    rows = (
        SensoryResult.query
        .filter_by(panelist_id=panelist_id, session_date=session_date)
        .filter(SensoryResult.sample_number.isnot(None))
        .with_entities(SensoryResult.sample_number)
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


@deepflavor_bp.route("/deepflavor/session/start", methods=["POST"])
def session_start():
    """
    Initialize or resume a panelist session for today.
    Returns panel configuration, demographic questions, live questions,
    and which samples the panelist has already completed.
    """
    data = request.get_json()
    panelist_id = str(data.get("panelist_id", "")).strip()
    if not panelist_id:
        return jsonify({"error": "panelist_id is required"}), 400

    today = _date.today()
    panelist = _get_or_create_panelist(panelist_id, today)

    # Panel setup
    setup = SensorySetup.query.get(1)
    samples_per_panelist = setup.samples_per_panelist if setup else 5
    all_samples = [s.sample_number for s in (setup.samples if setup else [])]

    # Questions — return all enabled questions grouped by role
    all_questions = (
        SensoryQuestion.query
        .filter_by(enabled=True)
        .order_by(SensoryQuestion.order_index)
        .all()
    )

    demographic_questions = []
    for dq in DEMOGRAPHIC_QUESTIONS:
        # Find the corresponding SensoryQuestion row (may be enabled or disabled)
        row = next(
            (q for q in all_questions if q.question_type == "demographic" and q.demographic_key == dq["key"]),
            None,
        )
        if row:
            demographic_questions.append(row.to_dict())

    live_questions = [
        q.to_dict()
        for q in all_questions
        if q.question_type not in ("demographic",)
    ]

    completed_samples = _get_completed_samples(panelist_id, today)

    return jsonify({
        "panelist": panelist.to_dict(),
        "samples_per_panelist": samples_per_panelist,
        "all_samples": all_samples,
        "completed_samples": completed_samples,
        "demographic_questions": demographic_questions,
        "live_questions": live_questions,
    })


@deepflavor_bp.route("/deepflavor/demographics", methods=["POST"])
def submit_demographics():
    """Submit demographic responses and mark demographics as complete for this panelist today."""
    data = request.get_json()
    panelist_id = str(data.get("panelist_id", "")).strip()
    if not panelist_id:
        return jsonify({"error": "panelist_id is required"}), 400

    today = _date.today()
    panelist = _get_or_create_panelist(panelist_id, today)

    NUMERIC_TYPES = {"rating_9", "slider_100"}

    for r in data.get("responses", []):
        q_type = r.get("question_type")
        raw_response = r.get("response")
        numeric_response = None
        if q_type in NUMERIC_TYPES and raw_response is not None:
            try:
                numeric_response = float(raw_response)
            except (TypeError, ValueError):
                pass

        db.session.add(SensoryResult(
            session_date=today,
            panelist_id=panelist_id,
            sample_number=None,
            question_id=r.get("question_id"),
            question_type=q_type,
            attribute=r.get("attribute"),
            wording=r.get("wording"),
            demographic_key=r.get("demographic_key"),
            response=str(raw_response) if raw_response is not None else None,
            numeric_response=numeric_response,
        ))

    panelist.demographics_complete = True
    db.session.commit()
    return jsonify({"status": "ok"})


@deepflavor_bp.route("/deepflavor/sample_response", methods=["POST"])
def submit_sample_response():
    """Submit all responses for a single sample."""
    data = request.get_json()
    panelist_id = str(data.get("panelist_id", "")).strip()
    sample_number = str(data.get("sample_number", "")).strip()
    if not panelist_id or not sample_number:
        return jsonify({"error": "panelist_id and sample_number are required"}), 400

    today = _date.today()
    NUMERIC_TYPES = {"rating_9", "slider_100"}

    for r in data.get("responses", []):
        q_type = r.get("question_type")
        raw_response = r.get("response")
        numeric_response = None
        if q_type in NUMERIC_TYPES and raw_response is not None:
            try:
                numeric_response = float(raw_response)
            except (TypeError, ValueError):
                pass

        db.session.add(SensoryResult(
            session_date=today,
            panelist_id=panelist_id,
            sample_number=sample_number,
            question_id=r.get("question_id"),
            question_type=q_type,
            attribute=r.get("attribute"),
            wording=r.get("wording"),
            demographic_key=None,
            response=str(raw_response) if raw_response is not None else None,
            numeric_response=numeric_response,
        ))

    db.session.commit()
    return jsonify({"status": "ok"})
