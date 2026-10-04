"""Small client for the Google Maps Routes API."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import requests

COMPUTE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
FIELD_MASK = "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"


class GoogleRoutesError(Exception):
    """A route request that Google could not complete."""


def load_api_key(credential_path: Path) -> str:
    """Read a raw API key or a JSON credential object from the local config file."""
    content = credential_path.read_text(encoding="utf-8").strip()
    if not content:
        raise GoogleRoutesError("Google Maps API key is missing from config/cred.json.")

    if content.startswith("{"):
        try:
            credentials = json.loads(content)
        except json.JSONDecodeError as error:
            raise GoogleRoutesError("config/cred.json is not valid JSON.") from error
        key = credentials.get("GOOGLE_MAPS_API_KEY") or credentials.get("api_key")
    else:
        key = content

    if not isinstance(key, str) or not key.strip():
        raise GoogleRoutesError("config/cred.json does not contain a Google Maps API key.")
    return key.strip()


def location(address: str) -> dict[str, Any]:
    """Turn an address or 'latitude, longitude' pair into a Routes API location."""
    try:
        latitude, longitude = (float(part.strip()) for part in address.split(",", maxsplit=1))
    except (TypeError, ValueError):
        return {"address": address}
    return {"location": {"latLng": {"latitude": latitude, "longitude": longitude}}}


def compute_route(
    api_key: str, origin: str, destination: str, waypoints: list[str] | None = None
) -> dict[str, Any]:
    """Request one traffic-aware driving route and return the first result."""
    payload: dict[str, Any] = {
        "origin": location(origin),
        "destination": location(destination),
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
    }
    if waypoints:
        payload["intermediates"] = [location(waypoint) for waypoint in waypoints]

    try:
        response = requests.post(
            COMPUTE_ROUTES_URL,
            headers={"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": FIELD_MASK},
            json=payload,
            timeout=20,
        )
    except requests.RequestException as error:
        raise GoogleRoutesError(f"Could not reach Google Routes API: {error}") from error

    if not response.ok:
        try:
            detail = response.json().get("error", {}).get("message", response.text)
        except ValueError:
            detail = response.text
        raise GoogleRoutesError(f"Google Routes API returned {response.status_code}: {detail}")

    try:
        routes = response.json().get("routes", [])
    except ValueError as error:
        raise GoogleRoutesError("Google Routes API returned invalid JSON.") from error
    if not routes:
        raise GoogleRoutesError("Google Routes API returned no route.")
    return routes[0]
