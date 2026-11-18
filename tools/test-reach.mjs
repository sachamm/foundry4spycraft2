import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reachIncreaseFeet as feet, reachAttackPlan as plan } from "../module/rules/reach.mjs";
test("all nine catalog Reach distances are feet and repeated identical quality does not stack", () => {
  const rows = JSON.parse(readFileSync(new URL("../src/data/equipment.json", import.meta.url))).weapons.filter(w =>
    /\bRCH\b/.test(w.qualities)
  );
  assert.equal(rows.length, 9);
  for (const w of rows) {
    const n = /\+10 ft/.test(w.qualities) ? 10 : 5;
    assert.equal(feet(w.qualities), n, w.name);
    assert.equal(plan(w, { trained: true }).evidence.extraReachFeet, n);
  }
  assert.equal(feet("RCH (+5 ft.), RCH (5 ft.)"), 5);
  for (const text of ["", "ARCH (+5 ft.)", "RCHER", "TRP (+2)"]) assert.equal(feet(text), 0);
});
test("trained adjacent attacks take exactly minus five unless actual polearm waiver applies; extra distance stays separate from base Reach", () => {
  for (const trained of [false, true])
    for (const adjacent of [false, true])
      for (const polearmBasics of [false, true]) {
        const p = plan(
          { qualities: "RCH (+10 ft.)", proficiency: "exoticEdged", meleeFamily: "polearm" },
          { trained, adjacent, polearmBasics, geometryConfirmed: true }
        );
        assert.equal(p.evidence.extraReachFeet, trained ? 10 : 0);
        assert.equal(p.evidence.attackPenalty, trained && adjacent && !polearmBasics ? -5 : 0);
        assert.equal(p.blocked, !trained && adjacent && !polearmBasics);
      }
  const p = plan(
    { qualities: "RCH (+5 ft.)", meleeFamily: "staff", proficiency: "exoticBlunt" },
    { trained: true, adjacent: true, polearmBasics: true, geometryConfirmed: true }
  );
  assert.equal(p.evidence.polearmWaiver, false);
  assert.equal(p.evidence.attackPenalty, -5);
  assert.equal(Object.hasOwn(p.evidence, "totalReach"), false);
});
test("untrained adjacent ambiguity is held without choosing either numerical answer; nonadjacent untrained attacks have no extra Reach", () => {
  const w = { qualities: "RCH (+5 ft.)" };
  assert.match(plan(w, { adjacent: true }).blockedReason, /pending/);
  assert.equal(plan(w, { adjacent: false, geometryConfirmed: true }).blocked, false);
  assert.equal(plan(w, { adjacent: false }).evidence.extraReachFeet, 0);
  assert.equal(plan(w, { trained: true }).evidence.adjacent, null);
});
test("malformed, conflicting or unitless Reach data and nonboolean declarations reject instead of inventing a distance", () => {
  for (const q of [
    "RCH",
    "RCH ()",
    "RCH (+2)",
    "RCH (+1 squares)",
    "RCH (0 ft.)",
    "RCH (-5 ft.)",
    "RCH (5.5 ft.)",
    "RCH (5 ft.), RCH (10 ft.)",
    "RCH (5 ft.), RCH",
    4,
    {}
  ])
    assert.throws(() => feet(q), /Review/);
  for (const o of [
    { trained: 1 },
    { ranged: "false" },
    { adjacent: "true" },
    { geometryConfirmed: 1 },
    { polearmBasics: "true" }
  ])
    assert.throws(() => plan({ qualities: "RCH (5 ft.)" }, o), /Review/);
});

test("a defensive opposed check does not attack a target or gain weapon Reach and receives no adjacent-target penalty", () => {
  for (const trained of [false, true]) {
    const p = plan({ qualities: "RCH (+5 ft.)" }, { trained, adjacent: true, defensive: true });
    assert.equal(p.blocked, false);
    assert.equal(p.evidence.attackPenalty, 0);
    assert.equal(p.evidence.extraReachFeet, 0);
    assert.equal(p.evidence.adjacent, null);
    assert.equal(p.evidence.geometryConfirmed, false);
  }
});
