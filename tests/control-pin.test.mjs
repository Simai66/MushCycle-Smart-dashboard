import assert from "node:assert/strict";
import test from "node:test";
import { controlCommands, normalizeControlPin } from "../src/controlPin.js";

test("accepts raw PIN and extracts PIN from local instruction file", () => {
  assert.equal(normalizeControlPin("abc123"), "abc123");
  assert.equal(normalizeControlPin("Control PIN: abc123\n\nKeep private."), "abc123");
  assert.equal(normalizeControlPin("invalid value"), "");
});

test("switches AUTO off before sending manual pump command", () => {
  assert.deepEqual(controlCommands({ auto: true, pump: false }, "pump"), [
    { target: "auto", value: false },
    { target: "pump", value: true },
  ]);
  assert.deepEqual(controlCommands({ auto: false, pump: true }, "pump"), [
    { target: "pump", value: false },
  ]);
});
