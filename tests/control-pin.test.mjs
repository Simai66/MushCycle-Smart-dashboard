import assert from "node:assert/strict";
import test from "node:test";
import { normalizeControlPin } from "../src/controlPin.js";

test("accepts raw PIN and extracts PIN from local instruction file", () => {
  assert.equal(normalizeControlPin("abc123"), "abc123");
  assert.equal(normalizeControlPin("Control PIN: abc123\n\nKeep private."), "abc123");
  assert.equal(normalizeControlPin("invalid value"), "");
});
