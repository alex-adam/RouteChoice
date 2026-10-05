# CommuteDashboard

Local Flask dashboard for comparing predefined, traffic-aware driving routes.

CommuteDashboard lets you define multiple commute routes between a start point and destination, then compare their current estimated travel times by car. Routes can be defined using GPS coordinates, with optional Google Routes API data for the route preferred by Google.

## Setup

### 1. Obtain a Google Routes API Key

A Google API key is required to request current route durations.

A key can be obtained through [Google Maps Platform](https://mapsplatform.google.com/lp/maps-apis/).

Google Routes API requests are only made when **Update Routes** is clicked.

Make sure the **Routes API** is enabled and billing is configured for the Google Cloud project associated with your API key.

### 2. Install Dependencies

1. Create and activate a Python virtual environment.

   ```bash
   python3 -m venv .env
   source .env/bin/activate
   ```

   If an existing `.env` virtual environment is already present you only need to activate it:

   ```bash
   source .env/bin/activate
   ```

2. Install the required dependencies:

   ```bash
   python -m pip install -r requirements.txt
   ```

### 3. Add Credentials

Add your Google Routes API key to:

```text
config/cred.json
```

The file can contain either the raw API key:

```text
your-api-key
```

or a JSON object:

```json
{
  "GOOGLE_MAPS_API_KEY": "your-api-key"
}
```

**Do not commit `config/cred.json` to the repository.**

### 4. Configure Your Routes

Edit:

```text
config/routes.json
```

This file defines your origin, destination, and the routes you want to compare.

All locations can be specified using GPS coordinates.

See [Adapting to Your Use Case](#adapting-to-your-use-case) for details.

### 5. Start the App

Start the Flask server:

```bash
python -m app.server
```

Then open:

http://127.0.0.1:5000

Your Google API key remains on the server and is not exposed to the browser.

## Adapting to Your Use Case

CommuteDashboard is designed around a set of predefined routes that you regularly want to compare, such as different routes for your daily commute.

Routes are configured in:

```text
config/routes.json
```

### Start Point and Destination

Define the starting point and destination using GPS coordinates.

```json
{
  "origin": "40.76809707593553, -73.98202256534707",
  "destination": "40.70484526765263, -74.01369650511622"
}
```

### Routes

Define the routes you want to compare.

Each route can contain its own name and a series of waypoints.

```json
{
  "name": "Route 1",
  "waypoints": [
    "40.76809707593553, -73.98202256534707",
    "40.70484526765263, -74.01369650511622"
  ]
}
```

You can define as many routes as needed.

### Waypoints

Waypoints determine the roads or areas a predefined route should pass through.

Add as many waypoints as necessary to describe your preferred route.

### Google Route

A route can optionally be marked as the route preferred by Google Navigation:

```json
  "google_route": true
```

When enabled, CommuteDashboard highlights this route in the dashboard, making it easy to compare your predefined routes against Google's recommended route.

## Security

The Google API key is stored locally in `config/cred.json` and is only used by the Flask server.

Never commit your API key or other credentials to Git.

The repository includes `config/cred.json` in `.gitignore` to prevent accidental commits.
