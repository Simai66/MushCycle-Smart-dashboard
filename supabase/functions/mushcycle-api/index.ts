import { controlCsv, nextControl, RANGE_CONFIG, validateReading } from "./logic.js";

const DEVICE_ID = "MushCycle-ESP32";
const ALLOWED_ORIGIN = "https://mush-cycle-smart-dashboard.vercel.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function adminKey() {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) return JSON.parse(keys).default;
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "content-type,x-control-pin,x-device-key",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    Vary: "Origin",
  };
}

function json(origin: string | null, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function rest(path: string, options: RequestInit = {}) {
  const key = adminKey();
  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers });
  if (!response.ok) throw new Error(`Data API HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

async function authorized(name: string, candidate: string | null) {
  if (!candidate) return false;
  const rows = await rest(`api_secrets?name=eq.${encodeURIComponent(name)}&select=sha256&limit=1`);
  return Boolean(rows[0] && constantTimeEqual(await sha256(candidate), rows[0].sha256));
}

async function readings(request: Request, origin: string | null, method: string, url: URL) {
  if (method === "GET") {
    const config = RANGE_CONFIG[url.searchParams.get("range") || "24H"] || RANGE_CONFIG["24H"];
    const rows = await rest("rpc/get_sensor_readings", {
      method: "POST",
      body: JSON.stringify({
        p_device_id: DEVICE_ID,
        p_since: new Date(Date.now() - config.hours * 60 * 60 * 1000).toISOString(),
        p_bucket_seconds: config.bucketSeconds,
      }),
    });
    return json(origin, 200, { readings: rows.map(({ recorded_at, ...row }) => ({ timestamp: recorded_at, ...row })) });
  }

  if (method === "POST") {
    if (!await authorized("device", request.headers.get("x-device-key"))) return json(origin, 401, { error: "Invalid device key" });
    const body = await request.json();
    const error = validateReading(body, DEVICE_ID);
    if (error) return json(origin, 422, { error });
    await rest("sensor_readings", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        device_id: DEVICE_ID,
        temperature: Number(body.temperature),
        humidity: Number(body.humidity),
        mq2: Number(body.mq2),
        mq9: Number(body.mq9),
        mode: body.mode,
        pump: body.pump,
        relay4: body.relay4,
        version: String(body.version || "unknown").slice(0, 32),
      }),
    });
    return json(origin, 201, { ok: true });
  }
  return json(origin, 405, { error: "Method not allowed" });
}

async function currentControl() {
  const rows = await rest(`device_controls?device_id=eq.${encodeURIComponent(DEVICE_ID)}&select=device_id,mode,pump,relay4,revision,updated_at&limit=1`);
  return rows[0] || { device_id: DEVICE_ID, mode: "AUTO", pump: false, relay4: false, revision: 0 };
}

async function control(request: Request, origin: string | null, method: string, url: URL) {
  if (method === "GET") {
    if (!await authorized("device", request.headers.get("x-device-key"))) return json(origin, 401, { error: "Invalid device key" });
    const current = await currentControl();
    if (url.searchParams.get("format") === "csv") {
      return new Response(controlCsv(current), { status: 200, headers: { ...cors(origin), "Content-Type": "text/plain", "Cache-Control": "no-store" } });
    }
    return json(origin, 200, current);
  }

  if (method === "POST") {
    if (!await authorized("control", request.headers.get("x-control-pin"))) return json(origin, 401, { error: "Invalid control PIN" });
    const { target, value } = await request.json();
    const result = nextControl(await currentControl(), target, value);
    if (result.error) return json(origin, result.status, { error: result.error });
    const rows = await rest("device_controls?on_conflict=device_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(result.value),
    });
    return json(origin, 200, rows[0] || result.value);
  }
  return json(origin, 405, { error: "Method not allowed" });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (origin && origin !== ALLOWED_ORIGIN) return json(origin, 403, { error: "Origin not allowed" });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });

  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^.*\/mushcycle-api/, "");
    if (path === "/api/v1/readings") return await readings(request, origin, request.method, url);
    if (path === "/api/v1/control") return await control(request, origin, request.method, url);
    return json(origin, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    return json(origin, error instanceof SyntaxError ? 400 : 500, { error: "Request failed" });
  }
});
