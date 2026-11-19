import test from "node:test";
import assert from "node:assert/strict";
import { tooltipText } from "../module/apps/ui-tooltips.mjs";

test("attack, ammunition and resource controls explain consequences without inventing bonuses", () => {
  assert.match(tooltipText({ name: "attackAction" }), /Standard Attack/);
  assert.match(tooltipText({ name: "aimed" }), /does not take the Aim action/);
  assert.match(tooltipText({ name: "system.shotsLoaded" }), /Attacks spend/);
  assert.match(tooltipText({ action: "itemDelete" }), /Remove this item/);
});
test("other fields use their context, input constraints and nearby guidance", () => {
  const text = tooltipText({ label: "Mission budget", tag: "INPUT", type: "number", min: "0", max: "20", step: "1" });
  assert.match(text, /Mission budget/);
  assert.match(text, /Minimum: 0/);
  assert.match(text, /Maximum: 20/);
  assert.match(text, /whole numbers/);
  assert.match(tooltipText({ name: "distanceFeet", hint: "Measured from the selected token." }), /Measured from/);
  assert.equal(tooltipText({ tag: "INPUT" }), "");
});
test("selection, disclosures and navigation describe the appropriate interaction", () => {
  assert.match(tooltipText({ label: "Target", tag: "SELECT" }), /Choose an option/);
  assert.match(tooltipText({ label: "Under cover", type: "checkbox" }), /Turn this on/);
  assert.match(tooltipText({ label: "Advanced options", tag: "SUMMARY" }), /Expand or collapse/);
  assert.match(tooltipText({ label: "Gear", action: "tab" }), /Gear section/);
  assert.match(tooltipText({ label: "Volume", tag: "INPUT", type: "range" }), /Adjust Volume/);
  assert.match(tooltipText({ label: "Portrait", tag: "INPUT", type: "file" }), /Choose a file/);
});
