"""Configuration loading and normalized route updates."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .google_routes import GoogleRoutesError, compute_route, load_api_key

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = PROJECT_ROOT / "config" / "routes.json"
CREDENTIAL_PATH = PROJECT_ROOT / "config" / "cred.json"


def load_route_config() -> dict[str, Any]:
    try:
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ValueError("config/routes.json was not found.") from error
    except json.JSONDecodeError as error:
        raise ValueError("config/routes.json is not valid JSON.") from error

    for field in ("origin", "destination", "routes"):
        if field not in config:
            raise ValueError(f"config/routes.json must include '{field}'.")
    if not isinstance(config["routes"], list):
        raise ValueError("config/routes.json 'routes' must be an array.")
    return config


def normalize_route(route_config: dict[str, Any], google_route: dict[str, Any]) -> dict[str, Any]:
    duration = google_route.get("duration", "0s")
    try:
        duration_seconds = int(str(duration).removesuffix("s").split(".")[0])
    except ValueError:
        duration_seconds = 0
    polyline = google_route.get("polyline", {}).get("encodedPolyline")
    return {
        "id": route_config["id"],
        "name": route_config["name"],
        "duration_seconds": duration_seconds,
        "distance_meters": google_route.get("distanceMeters", 0),
        "encoded_polyline": polyline,
        "error": None,
    }


def update_routes() -> dict[str, Any]:
    config = load_route_config()
    api_key = load_api_key(CREDENTIAL_PATH)
    definitions = [
        {
            "id": item.get("id", f"route-{index + 1}"),
            "name": item.get("name") or item.get("description") or f"Route {index + 1}",
            "waypoints": item.get("waypoints", []),
        }
        for index, item in enumerate(config["routes"])
    ]
    if config.get("google_route", False):
        definitions.append({"id": "google-recommended", "name": "Google recommended", "waypoints": [], "recommended": True})

    results = []
    for definition in definitions:
        try:
            result = compute_route(api_key, config["origin"], config["destination"], definition["waypoints"])
            normalized = normalize_route(definition, result)
            normalized["recommended"] = definition.get("recommended", False)
            results.append(normalized)
        except (GoogleRoutesError, TypeError, ValueError) as error:
            results.append({"id": definition["id"], "name": definition["name"], "duration_seconds": None,
                            "distance_meters": None, "encoded_polyline": None, "recommended": definition.get("recommended", False),
                            "error": str(error)})

    successful = [route for route in results if route["error"] is None]
    ordered = sorted(successful, key=lambda route: route["duration_seconds"])
    duration_counts = {
        duration: sum(route["duration_seconds"] == duration for route in successful)
        for duration in {route["duration_seconds"] for route in successful}
    }

    for route in successful:
        route["highlight"] = None
        if duration_counts[route["duration_seconds"]] > 1:
            route["highlight"] = "tied"

    if ordered and ordered[0]["highlight"] is None:
        ordered[0]["highlight"] = "fastest"
    if len(ordered) > 2 and ordered[1]["highlight"] is None:
        ordered[1]["highlight"] = "second-fastest"
    if len(ordered) > 1 and ordered[-1]["highlight"] is None:
        ordered[-1]["highlight"] = "slowest"
    if len(ordered) > 3 and ordered[-2]["highlight"] is None:
        ordered[-2]["highlight"] = "second-slowest"

    fastest_id = ordered[0]["id"] if ordered else None
    return {"routes": results, "fastest_route_id": fastest_id}
