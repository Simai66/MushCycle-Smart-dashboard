const DEFAULT_TIMEOUT_MS = 8000;

function assertReading(item) {
  if (!item || typeof item !== "object") return false;
  return ["temperature", "humidity", "mq2", "mq9"].every((key) => Number.isFinite(Number(item[key])));
}

function normalizeReading(item) {
  const timestamp = item.timestamp || item.created_at || item.time || new Date().toISOString();
  const date = new Date(timestamp);
  return {
    timestamp: date.toISOString(),
    label: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    temperature: Number(item.temperature),
    humidity: Number(item.humidity),
    mq2: Number(item.mq2),
    mq9: Number(item.mq9),
  };
}

export async function fetchLiveReadings(range = "24H") {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("VITE_API_BASE_URL is not configured");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/api/v1/readings?range=${encodeURIComponent(range)}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Live API returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : payload.readings;
    if (!Array.isArray(rows)) {
      throw new Error("Live API payload must be an array or { readings: [] }");
    }

    const normalized = rows.filter(assertReading).map(normalizeReading);
    if (!normalized.length) {
      throw new Error("Live API returned no valid sensor readings");
    }

    return normalized;
  } finally {
    window.clearTimeout(timeout);
  }
}

export const LIVE_API_CONTRACT = {
  endpoint: "GET /api/v1/readings?range=24H",
  reading: {
    timestamp: "ISO-8601 string",
    temperature: "number (°C)",
    humidity: "number (%)",
    mq2: "number (ADC RAW)",
    mq9: "number (ADC RAW)",
  },
};
