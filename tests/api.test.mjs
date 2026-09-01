import assert from "node:assert/strict";
import test from "node:test";
import { controlCsv, nextControl, RANGE_CONFIG, validateReading } from "../supabase/functions/mushcycle-api/logic.js";

test("rejects invalid telemetry", () => {
  const error = validateReading({
    device: "MushCycle-ESP32", temperature: 28, humidity: 120, mq2: 1, mq9: 2,
    mode: "AUTO", pump: false, relay4: false,
  });
  assert.equal(error, "Invalid humidity");
});

test("accepts valid telemetry", () => {
  const error = validateReading({
    device: "MushCycle-ESP32", temperature: 28, humidity: 67, mq2: 1000, mq9: 900,
    mode: "AUTO", pump: false, relay4: false,
  });
  assert.equal(error, null);
});

test("limits seven-day response with hourly buckets", () => {
  assert.deepEqual(RANGE_CONFIG["7D"], { hours: 168, bucketSeconds: 3600 });
});

test("returns compact control response for ESP32", () => {
  assert.equal(controlCsv({ mode: "MANUAL", pump: true, relay4: false, revision: 7 }), "MANUAL,1,0,7\n");
});

test("blocks manual relay command while AUTO is enabled", () => {
  const result = nextControl({ mode: "AUTO", pump: false, relay4: false, revision: 2 }, "pump", true);
  assert.equal(result.status, 409);
});

test("increments revision for accepted manual command", () => {
  const result = nextControl({ mode: "MANUAL", pump: false, relay4: false, revision: 2 }, "pump", true);
  assert.equal(result.value.pump, true);
  assert.equal(result.value.revision, 3);
});
