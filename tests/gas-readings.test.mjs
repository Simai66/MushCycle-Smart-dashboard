import assert from "node:assert/strict";
import test from "node:test";
import { autoGasBaseline, gasStatus, relativeGasChange } from "../src/gasReadings.js";

test("learns gas baseline and classifies relative trend", () => {
  const readings = [1000, 1010, 1020, 1030, 1040, 1050, 1060, 1070, 1080, 1090]
    .map((mq2) => ({ mq2 }));

  const baseline = autoGasBaseline(readings, "mq2");
  assert.equal(baseline, 1020);
  assert.equal(relativeGasChange(1224, baseline), 20);
  assert.deepEqual(gasStatus(20), { label: "WATCH", tone: "watch" });
  assert.deepEqual(gasStatus(30), { label: "HIGH TREND", tone: "high" });
});

test("learns with five readings but waits when history is too short", () => {
  assert.equal(autoGasBaseline([1000, 1010, 1020, 1030, 1040].map((mq9) => ({ mq9 })), "mq9"), 1010);
  assert.equal(autoGasBaseline([1000, 1010, 1020, 1030].map((mq9) => ({ mq9 })), "mq9"), null);
});
