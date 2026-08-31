# MushCycle Smart Dashboard

React + Vite dashboard for the MushCycle Smart prototype.

## Demo mode

The production prototype currently runs with demo data so it can be used for presentation without the physical ESP32 being online.

```env
VITE_USE_DEMO_DATA=true
VITE_API_BASE_URL=
```

The committed `.env.production` enables this mode.

## Live-data foundation

When the backend is ready, set:

```env
VITE_USE_DEMO_DATA=false
VITE_API_BASE_URL=https://your-api.example.com
```

A live-data adapter is prepared in `src/liveData.js`. The planned API contract is:

`GET /api/v1/readings?range=24H`

Accepted response:

```json
{
  "readings": [
    {
      "timestamp": "2026-08-31T13:00:00+07:00",
      "temperature": 28.6,
      "humidity": 67.4,
      "mq2": 1834,
      "mq9": 1267
    }
  ]
}
```

Required numeric fields are `temperature`, `humidity`, `mq2`, and `mq9`. `timestamp` should be ISO-8601. The adapter includes an 8-second timeout, HTTP error handling, payload validation, and value normalization.

The current UI still intentionally uses the existing demo data path while `VITE_USE_DEMO_DATA=true`. Before switching the production flag to false, connect `fetchLiveReadings()` from `src/liveData.js` to the dashboard state and verify the final backend endpoint/field names.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run test:sites
```
