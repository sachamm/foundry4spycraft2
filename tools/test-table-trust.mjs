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

test("a stock Confirm button takes the dialog's title; a named button or a long title is left alone (B-040)", async () => {
  const { nameMainButton } = await import("../module/apps/dialog-theme.mjs");
  const dialog = (title, label) => {
    const span = { textContent: label };
    const button = { querySelector: () => span };
    return {
      span,
      querySelector: selector => (selector.includes("form-footer") ? button : { textContent: title })
    };
  };
  const stock = dialog("Bull Rush", " Confirm ");
  assert.equal(nameMainButton(stock), "Bull Rush");
  assert.equal(stock.span.textContent, "Bull Rush");
  assert.equal(nameMainButton(dialog("Bull Rush", "Roll the check")), "");
  assert.equal(nameMainButton(dialog("Which of these two characters is the target?", "Confirm")), "");
  assert.equal(nameMainButton(dialog("A title that runs on far too long to sit on a button", "Confirm")), "");
});

test("closing a system dialog hands the keyboard back to the control that opened it (B-248)", async () => {
  const { returnFocusToOpener } = await import("../module/apps/dialog-theme.mjs");
  let focused = 0;
  const system = { contains: name => name === "sc2-dialog" };
  const opener = { isConnected: true, focus: () => focused++ };
  globalThis.document = { activeElement: null, createElement: () => ({}) };
  assert.equal(returnFocusToOpener({ element: { classList: system }, _sc2Opener: opener }), true);
  assert.equal(focused, 1);
  // A control the redraw removed, or another module's dialog, is left alone.
  assert.equal(returnFocusToOpener({ element: { classList: system }, _sc2Opener: { isConnected: false } }), false);
  assert.equal(returnFocusToOpener({ element: { classList: { contains: () => false } }, _sc2Opener: opener }), false);
  assert.equal(focused, 1);
});

test("an option dialog that answers null when closed gets a Cancel button; one with its own buttons does not (B-248)", async () => {
  const { withCancel } = await import("../module/apps/dialog-theme.mjs");
  assert.deepEqual(
    withCancel({ rejectClose: false }).buttons.map(button => button.action),
    ["cancel"]
  );
  const own = { rejectClose: false, buttons: [{ action: "other" }] };
  assert.equal(withCancel(own), own);
  assert.equal(withCancel({}).buttons, undefined);
});
