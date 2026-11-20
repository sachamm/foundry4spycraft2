import test from "node:test";
import assert from "node:assert/strict";

globalThis.Event = class {
  constructor(type) {
    this.type = type;
  }
};
const box = (name, checked = false, disabled = false) => ({
  name,
  checked,
  disabled,
  classList: { add() {} },
  dispatched: 0,
  dispatchEvent() {
    this.dispatched++;
  }
});
const { trustConfirmations } = await import("../module/apps/dialog-theme.mjs");

test("trusting the table ticks each open GC confirmation and says how many", () => {
  const boxes = [box("feintContextConfirmed"), box("effectConfirmed", true), box("lockedConfirmed", false, true)];
  const notes = [];
  globalThis.document = { createElement: () => ({}) };
  const element = {
    querySelectorAll: selector => (selector.includes('$="Confirmed"') ? boxes : []),
    querySelector: () => ({ prepend: note => notes.push(note) })
  };
  assert.equal(trustConfirmations(element), 1);
  assert.deepEqual(
    boxes.map(b => b.checked),
    [true, true, false]
  );
  assert.equal(boxes[0].dispatched, 1);
  assert.match(notes[0].textContent, /1 confirmation\(s\) ticked/);
});
