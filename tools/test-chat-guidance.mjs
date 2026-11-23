import test from "node:test";
import assert from "node:assert/strict";
import { checkGuidance as guidance } from "../module/rolls/chat-guidance.mjs";
const checkGuidance = check => guidance({ checkKind: "skill", ...check });

test("guidance never converts a high die or a threat into a confirmed success", () => {
  for (const extra of [{}, { threatConfirmed: true }, { errorConfirmed: true }]) {
    const result = checkGuidance({ rawTotal: 30, checkKind: "attack", ...extra });
    assert.equal(result.title, "Pending");
    assert.match(result.note, /Defense/);
  }
});

test("recorded outcomes and replacement take precedence over pending instructions", () => {
  assert.equal(checkGuidance({ rawTotal: 4, successConfirmed: false }).title, "Failure");
  assert.equal(checkGuidance({ rawTotal: 18, successConfirmed: true }).title, "Success");
  assert.equal(checkGuidance({ rawTotal: 18, attackResolution: { hit: true } }).title, "Hit");
  assert.equal(checkGuidance({ rawTotal: 4, attackResolution: { hit: false } }).title, "Miss");
  assert.equal(checkGuidance({ rawTotal: 1, criticalFailure: true }).title, "Critical failure");
  assert.equal(checkGuidance({ rawTotal: 20, criticalSuccess: true }).title, "Critical success");
  assert.match(checkGuidance({ rawTotal: 18, resolved: true }).note, /follow-up/);
  assert.equal(checkGuidance({ rawTotal: 18, resolved: true }).title, "Finished");
  assert.match(checkGuidance({ rawTotal: 18, successConfirmed: true }).note, /remaining options/);
  assert.equal(checkGuidance({ rawTotal: 18, successConfirmed: true, superseded: true }).title, "Replaced result");
  assert.equal(checkGuidance({}), null);
  assert.equal(checkGuidance({ rawTotal: 9, checkKind: "initiative" }), null);
  assert.equal(checkGuidance({ rawTotal: 9, checkKind: "damage" }).title, "Damage rolled");
  assert.equal(checkGuidance({ rawTotal: 9, checkKind: "damage", resolved: true }).title, "Finished");
  assert.equal(checkGuidance({ rawTotal: 9, checkKind: "damage", damageApplied: [{}] }).title, "Damage applied");
});
