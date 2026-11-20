import test from "node:test";
import assert from "node:assert/strict";
import { checkGuidance as guidance } from "../module/rolls/chat-guidance.mjs";
const checkGuidance = check => guidance({ checkKind: "skill", ...check });

test("guidance never converts a high die or a threat into a confirmed success", () => {
  for (const extra of [{}, { threatConfirmed: true }, { errorConfirmed: true }]) {
    const result = checkGuidance({ rawTotal: 30, checkKind: "attack", ...extra });
    assert.equal(result.title, "Result pending");
    assert.match(result.note, /Defense/);
  }
});

test("recorded outcomes and replacement take precedence over pending instructions", () => {
  assert.equal(checkGuidance({ rawTotal: 4, successConfirmed: false }).title, "Failure confirmed");
  assert.equal(checkGuidance({ rawTotal: 18, successConfirmed: true }).title, "Success confirmed");
  assert.equal(checkGuidance({ rawTotal: 18, attackResolution: { hit: true } }).title, "Hit recorded");
  assert.equal(checkGuidance({ rawTotal: 4, attackResolution: { hit: false } }).title, "Miss recorded");
  assert.equal(checkGuidance({ rawTotal: 1, criticalFailure: true }).title, "Critical failure confirmed");
  assert.equal(checkGuidance({ rawTotal: 20, criticalSuccess: true }).title, "Critical success confirmed");
  assert.match(checkGuidance({ rawTotal: 18, resolved: true }).note, /follow-up/);
  assert.equal(checkGuidance({ rawTotal: 18, resolved: true }).title, "Outcome closed");
  assert.match(checkGuidance({ rawTotal: 18, successConfirmed: true }).note, /remaining options/);
  assert.equal(checkGuidance({ rawTotal: 18, successConfirmed: true, superseded: true }).title, "Replaced result");
  assert.equal(checkGuidance({}), null);
  assert.equal(checkGuidance({ rawTotal: 9, checkKind: "initiative" }), null);
  assert.equal(checkGuidance({ rawTotal: 9, checkKind: "damage" }).title, "Damage rolled");
  assert.equal(checkGuidance({ rawTotal: 9, checkKind: "damage", resolved: true }).title, "Damage finalized");
  assert.equal(checkGuidance({ rawTotal: 9, checkKind: "damage", damageApplied: [{}] }).title, "Damage applied");
});
