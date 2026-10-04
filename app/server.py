"""Flask server for CommuteRoutes."""

from __future__ import annotations

from dotenv import load_dotenv
from flask import Flask, jsonify, send_from_directory

from .routes import update_routes


def create_app() -> Flask:
    load_dotenv()
    app = Flask(__name__, static_folder="../web", static_url_path="")

    @app.get("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")

    @app.post("/api/update")
    def update():
        try:
            return jsonify(update_routes())
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        except OSError as error:
            return jsonify({"error": f"Could not read configuration: {error}"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
