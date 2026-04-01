import os
from flask import Flask
from config import config
from extensions import db, cors
from routes import auth_bp, whitelist_bp, plant_data_bp, genotypes_bp, analytics_bp, options_bp, sensory_bp


def create_app(env: str | None = None) -> Flask:
    app = Flask(__name__)

    env = env or os.environ.get("FLASK_ENV", "default")
    app.config.from_object(config[env])

    db.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    blueprints = [auth_bp, whitelist_bp, plant_data_bp, genotypes_bp, analytics_bp, options_bp, sensory_bp]
    for bp in blueprints:
        app.register_blueprint(bp, url_prefix="/api")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
