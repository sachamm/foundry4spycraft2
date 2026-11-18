import test from "node:test";
import assert from "node:assert/strict";
import { systemErrorNotice, registerErrorNotices } from "../module/error-notices.mjs";

const fromSystem = message => {
  const error = new Error(message);
  error.stack = `Error: ${message}\n    at plan (http://localhost:30000/systems/spycraft2/module/rules/x.mjs:1:1)`;
  return error;
};

test("only this system's own errors are shown", () => {
  assert.equal(systemErrorNotice(fromSystem("Roll the save first.")), "Roll the save first.");
  const other = new Error("core");
  other.stack = "Error: core\n    at x (http://localhost:30000/scripts/foundry.mjs:1:1)";
  assert.equal(systemErrorNotice(other), null);
  assert.equal(systemErrorNotice("text"), null);
  assert.equal(systemErrorNotice(undefined), null);
});

test("an unhandled refusal becomes an on-screen error", () => {
  let listener;
  const shown = [];
  globalThis.ui = { notifications: { error: message => shown.push(message) } };
  const originalError = console.error;
  console.error = () => {};
  try {
    registerErrorNotices({ addEventListener: (type, fn) => type === "unhandledrejection" && (listener = fn) });
    let prevented = false;
    listener({ reason: fromSystem("The ledger changed."), preventDefault: () => (prevented = true) });
    assert.deepEqual(shown, ["The ledger changed."]);
    assert.equal(prevented, true);
  } finally {
    console.error = originalError;
    delete globalThis.ui;
  }
});
