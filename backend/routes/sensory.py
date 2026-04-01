from flask import Blueprint, request, jsonify
from extensions import db
from models import (
    SensoryPanel, SensoryPanelSample, SensoryPanelQuestion,
    SensoryPanelResult, DEMOGRAPHIC_QUESTIONS,
)

sensory_bp = Blueprint("sensory", __name__)


# ── Panel CRUD ────────────────────────────────────────────────────────────────

@sensory_bp.route("/sensory_panels", methods=["GET"])
def list_panels():
    panels = SensoryPanel.query.order_by(SensoryPanel.created_at.desc()).all()
    return jsonify([{
        "id": p.id,
        "name": p.name,
        "panel_date": p.panel_date.isoformat() if p.panel_date else None,
        "samples_per_panelist": p.samples_per_panelist,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    } for p in panels])


@sensory_bp.route("/sensory_panels", methods=["POST"])
def create_panel():
    from datetime import date as _date
    data = request.get_json()
    pd_raw = data.get("panel_date")
    panel = SensoryPanel(
        name=data["name"],
        panel_date=_date.fromisoformat(pd_raw) if pd_raw else None,
        samples_per_panelist=data.get("samples_per_panelist", 5),
    )
    db.session.add(panel)
    db.session.flush()  # get panel.id

    # Seed demographic questions (all disabled by default)
    for i, dq in enumerate(DEMOGRAPHIC_QUESTIONS):
        q = SensoryPanelQuestion(
            panel_id=panel.id,
            order_index=i,
            question_type="demographic",
            wording=dq["wording"],
            demographic_key=dq["key"],
            enabled=False,
            capture_video=False,
        )
        q.options = dq["options"]
        db.session.add(q)

    db.session.commit()
    return jsonify(panel.to_dict()), 201


@sensory_bp.route("/sensory_panels/<int:panel_id>", methods=["GET"])
def get_panel(panel_id):
    panel = SensoryPanel.query.get_or_404(panel_id)
    return jsonify(panel.to_dict())


@sensory_bp.route("/sensory_panels/<int:panel_id>", methods=["PUT"])
def update_panel(panel_id):
    from datetime import date as _date
    panel = SensoryPanel.query.get_or_404(panel_id)
    data = request.get_json()
    if "name" in data:
        panel.name = data["name"]
    if "samples_per_panelist" in data:
        panel.samples_per_panelist = data["samples_per_panelist"]
    if "panel_date" in data:
        panel.panel_date = _date.fromisoformat(data["panel_date"]) if data["panel_date"] else None
    db.session.commit()
    return jsonify(panel.to_dict())


@sensory_bp.route("/sensory_panels/<int:panel_id>", methods=["DELETE"])
def delete_panel(panel_id):
    panel = SensoryPanel.query.get_or_404(panel_id)
    db.session.delete(panel)
    db.session.commit()
    return jsonify({"status": "ok"})


# ── Samples ───────────────────────────────────────────────────────────────────

@sensory_bp.route("/sensory_panels/<int:panel_id>/samples", methods=["PUT"])
def replace_samples(panel_id):
    """Replace all samples for a panel in one shot."""
    panel = SensoryPanel.query.get_or_404(panel_id)
    data = request.get_json()  # list of {sample_number, true_identifier}

    SensoryPanelSample.query.filter_by(panel_id=panel_id).delete()
    for s in data:
        db.session.add(SensoryPanelSample(
            panel_id=panel.id,
            sample_number=str(s["sample_number"]),
            true_identifier=s.get("true_identifier") or None,
        ))
    db.session.commit()
    return jsonify([s.to_dict() for s in panel.samples])


# ── Questions ─────────────────────────────────────────────────────────────────

@sensory_bp.route("/sensory_panels/<int:panel_id>/questions", methods=["POST"])
def add_question(panel_id):
    SensoryPanel.query.get_or_404(panel_id)
    data = request.get_json()

    # Place after last non-demographic question
    existing = SensoryPanelQuestion.query.filter_by(panel_id=panel_id).all()
    max_idx = max((q.order_index for q in existing), default=-1)

    q = SensoryPanelQuestion(
        panel_id=panel_id,
        order_index=max_idx + 1,
        question_type=data["question_type"],
        attribute=data.get("attribute"),
        wording=data.get("wording"),
        capture_video=data.get("capture_video", False),
        demographic_key=None,
        enabled=True,
    )
    q.options = data.get("options", [])
    db.session.add(q)
    db.session.commit()
    return jsonify(q.to_dict()), 201


@sensory_bp.route("/sensory_panels/questions/<int:question_id>", methods=["PUT"])
def update_question(question_id):
    q = SensoryPanelQuestion.query.get_or_404(question_id)
    data = request.get_json()
    for field in ("attribute", "wording", "capture_video", "enabled", "order_index", "question_type"):
        if field in data:
            setattr(q, field, data[field])
    if "options" in data:
        q.options = data["options"]
    db.session.commit()
    return jsonify(q.to_dict())


@sensory_bp.route("/sensory_panels/questions/<int:question_id>", methods=["DELETE"])
def delete_question(question_id):
    q = SensoryPanelQuestion.query.get_or_404(question_id)
    if q.question_type == "demographic":
        return jsonify({"error": "Demographic questions cannot be deleted, only disabled"}), 400
    db.session.delete(q)
    db.session.commit()
    return jsonify({"status": "ok"})


@sensory_bp.route("/sensory_panels/<int:panel_id>/questions/reorder", methods=["PUT"])
def reorder_questions(panel_id):
    """Accepts [{id, order_index}, ...] and applies the new order."""
    SensoryPanel.query.get_or_404(panel_id)
    data = request.get_json()
    for item in data:
        q = SensoryPanelQuestion.query.get(item["id"])
        if q and q.panel_id == panel_id:
            q.order_index = item["order_index"]
    db.session.commit()
    return jsonify({"status": "ok"})


# ── Results ───────────────────────────────────────────────────────────────────

@sensory_bp.route("/sensory_panels/<int:panel_id>/results", methods=["POST"])
def submit_results(panel_id):
    """Submit a batch of responses from one panelist for one sample."""
    SensoryPanel.query.get_or_404(panel_id)
    data = request.get_json()  # {panelist_id, sample_number (optional), responses: [{question_id, response, demographic_key}]}

    panelist_id = str(data["panelist_id"])
    sample_number = data.get("sample_number")

    for r in data.get("responses", []):
        q = SensoryPanelQuestion.query.get(r["question_id"])
        db.session.add(SensoryPanelResult(
            panel_id=panel_id,
            panelist_id=panelist_id,
            sample_number=sample_number,
            question_id=r["question_id"],
            question_type=q.question_type if q else None,
            attribute=q.attribute if q else r.get("attribute"),
            wording=q.wording if q else r.get("wording"),
            demographic_key=r.get("demographic_key") or (q.demographic_key if q else None),
            response=str(r["response"]) if r.get("response") is not None else None,
        ))
    db.session.commit()
    return jsonify({"status": "ok"})


@sensory_bp.route("/sensory_panels/<int:panel_id>/results", methods=["GET"])
def get_results(panel_id):
    SensoryPanel.query.get_or_404(panel_id)
    results = SensoryPanelResult.query.filter_by(panel_id=panel_id).order_by(
        SensoryPanelResult.panelist_id, SensoryPanelResult.sample_number
    ).all()
    return jsonify([r.to_dict() for r in results])


# ── Demographic question catalogue ────────────────────────────────────────────

@sensory_bp.route("/sensory_demographic_questions", methods=["GET"])
def demographic_questions():
    return jsonify(DEMOGRAPHIC_QUESTIONS)
