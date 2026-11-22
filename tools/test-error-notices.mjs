import test from "node:test";
import assert from "node:assert/strict";
import { systemErrorNotice, registerErrorNotices, isRefusal } from "../module/error-notices.mjs";

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

test("an unhandled refusal becomes an on-screen warning; a fault stays an error", () => {
  let listener;
  const warned = [],
    errors = [];
  globalThis.ui = { notifications: { warn: message => warned.push(message), error: message => errors.push(message) } };
  const originalError = console.error,
    originalDebug = console.debug;
  console.error = () => {};
  console.debug = () => {};
  try {
    registerErrorNotices({ addEventListener: (type, fn) => type === "unhandledrejection" && (listener = fn) });
    let prevented = false;
    listener({ reason: fromSystem("The ledger changed."), preventDefault: () => (prevented = true) });
    assert.deepEqual(warned, ["The ledger changed."]);
    assert.equal(prevented, true);
    const fault = new TypeError("x is undefined");
    fault.stack = `TypeError: x is undefined\n    at plan (http://localhost:30000/systems/spycraft2/module/rules/x.mjs:1:1)`;
    listener({ reason: fault, preventDefault() {} });
    assert.deepEqual(errors, ["x is undefined"]);
    assert.equal(isRefusal(new Error("no")), true);
    assert.equal(isRefusal(new RangeError("no")), false);
  } finally {
    console.error = originalError;
    console.debug = originalDebug;
    delete globalThis.ui;
  }
});
