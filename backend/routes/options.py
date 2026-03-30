from flask import Blueprint, request, jsonify
from extensions import db
from models import OptionConfig

options_bp = Blueprint("options", __name__)


@options_bp.route("/option_config", methods=["GET"])
def get_options():
    return jsonify([o.to_dict() for o in OptionConfig.query.all()])


@options_bp.route("/option_config", methods=["POST"])
def add_option():
    data = request.get_json()
    option_type = data.get("option_type")
    option_text = data.get("option_text")
    if not option_type or not option_text:
        return jsonify({"error": "option_type and option_text required"}), 400
    option = OptionConfig(option_type=option_type, option_text=option_text)
    db.session.add(option)
    db.session.commit()
    return jsonify(option.to_dict()), 201


@options_bp.route("/option_config/<int:option_id>", methods=["PUT"])
def update_option(option_id):
    option = OptionConfig.query.get_or_404(option_id)
    option.option_text = request.get_json().get("option_text", option.option_text)
    db.session.commit()
    return jsonify(option.to_dict())


@options_bp.route("/option_config/<int:option_id>", methods=["DELETE"])
def delete_option(option_id):
    option = OptionConfig.query.get_or_404(option_id)
    db.session.delete(option)
    db.session.commit()
    return jsonify({"status": "ok"})
