export const RANGE_CONFIG = {
  "1H": { hours: 1, bucketSeconds: 30 },
  "6H": { hours: 6, bucketSeconds: 180 },
  "24H": { hours: 24, bucketSeconds: 600 },
  "7D": { hours: 168, bucketSeconds: 3600 },
};

function validNumber(value, min, max) {
  return Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;
}

export function validateReading(body, deviceId = "MushCycle-ESP32") {
  if ((body.device || body.deviceId) !== deviceId) return "Unknown device";
  if (!validNumber(body.temperature, -40, 80)) return "Invalid temperature";
  if (!validNumber(body.humidity, 0, 100)) return "Invalid humidity";
  if (!validNumber(body.mq2, 0, 4095)) return "Invalid mq2";
  if (!validNumber(body.mq9, 0, 4095)) return "Invalid mq9";
  if (!["AUTO", "MANUAL"].includes(body.mode)) return "Invalid mode";
  if (typeof body.pump !== "boolean" || typeof body.relay4 !== "boolean") return "Invalid relay state";
  return null;
}

export function nextControl(current, target, value) {
  if (!["auto", "pump", "relay4"].includes(target) || typeof value !== "boolean") {
    return { error: "Invalid control command", status: 422 };
  }

  const next = {
    device_id: current.device_id || "MushCycle-ESP32",
    mode: current.mode || "AUTO",
    pump: Boolean(current.pump),
    relay4: Boolean(current.relay4),
    revision: Number(current.revision || 0) + 1,
    updated_at: new Date().toISOString(),
  };

  if (target === "auto") next.mode = value ? "AUTO" : "MANUAL";
  else {
    if (current.mode !== "MANUAL") return { error: "Switch AUTO off before manual control", status: 409 };
    next[target] = value;
  }
  return { value: next };
}

export function controlCsv(control) {
  return `${control.mode},${Number(control.pump)},${Number(control.relay4)},${control.revision}\n`;
}
