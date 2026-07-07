# AMG Dashboard Backend

Local Node/Express service that reads the JSON file Power Automate drops into your OneDrive-synced folder and serves it to the dashboard frontend.

```
SharePoint List -> Power Automate -> OneDrive JSON -> this backend (localhost:3001) -> dashboard
```

## Setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env and point SHAREPOINT_EXPORT_PATH to the synced file
npm start
```

Server listens on `http://localhost:3001`:

- `GET /api/dashboard` – KPI summary + latest 25 rows
- `GET /api/rows` – full normalized row list
- `GET /api/health` – status probe

The JSON file is re-read on every request, so Power Automate updates show up on the next dashboard poll.

## JSON shape

An array of SharePoint list items (also accepts `{ value: [...] }` or `{ data: [...] }`). Lookup columns like `Machine` may be `"213IM"` or `{ "Id": 4, "Value": "213IM" }` — both are normalized to the string.
