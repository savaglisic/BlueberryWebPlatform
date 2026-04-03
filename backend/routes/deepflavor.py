from flask import Blueprint, jsonify

deepflavor_bp = Blueprint("deepflavor", __name__)


@deepflavor_bp.route("/deepflavor")
def deepflavor():
    return jsonify({"message": "hello world"})
