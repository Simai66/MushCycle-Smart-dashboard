# MushCycle Smart Dashboard

React + Vite dashboard for the MushCycle Smart prototype.

## Live system

Data path:

```text
ESP32 -> Supabase Edge API -> Database -> Dashboard
Dashboard -> Supabase Edge API -> ESP32 polling -> Pump / Relay 4
```

Supabase project `MushCycle Smart` runs in Singapore. Schema lives at [`supabase/schema.sql`](supabase/schema.sql); API source lives at [`supabase/functions/mushcycle-api`](supabase/functions/mushcycle-api).

```env
VITE_API_BASE_URL=https://smzlporzdrhrlhwxopph.supabase.co/functions/v1/mushcycle-api
```

Edge API uses custom Device Key and Control PIN authentication. Database stores SHA-256 hashes only. Local plaintext values stay in Git-ignored files:

- `firmware/secrets.h` — Wi-Fi and Device Key
- `.local/mushcycle-control.txt` — Dashboard Control PIN

Set Wi-Fi values in `firmware/secrets.h`, then upload [`firmware/MushCycle_Smart_v2.5.0_Live.ino`](firmware/MushCycle_Smart_v2.5.0_Live.ino). Never commit `secrets.h`. Firmware validates HTTPS with GTS Root R1, posts telemetry every 10 seconds, and checks for commands every 2 seconds.

Dashboard reads:

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

ESP32 writes:

`POST /api/v1/readings` with header `X-Device-Key`.

Dashboard controls:

`POST /api/v1/control` with header `X-Control-Pin`. UI asks for this PIN on first control use and keeps it only for the browser tab session. Pump and Relay 4 commands require MANUAL mode; switch AUTO off first.

ESP32 reads:

`GET /api/v1/control?format=csv` with header `X-Device-Key`.

Production uses live mode. Add `?demo=1` to the dashboard URL when sample data is needed. Push to `main` to trigger linked Vercel deployment.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm test
```
