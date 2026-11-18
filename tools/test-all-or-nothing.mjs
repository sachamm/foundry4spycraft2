import test from "node:test";
import assert from "node:assert/strict";
import { actor, opts } from "./fixtures/side-stance.mjs";
import { prep } from "./fixtures/feint.mjs";
import {
  allOrNothingSpec,
  allOrNothingEligible,
  allOrNothingRanges,
  allOrNothingNote
} from "../module/rules/all-or-nothing.mjs";
import { adjudicateCheck, errorDecisionPending, checkCandidates } from "../module/rules/outcomes.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { rollPipeline } from "../module/rules/roll-pipeline.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const feat = { activeFeatNames: ["All or Nothing"] };

test("once per session, for rolled skill, Knowledge and attack checks", () => {
  assert.deepEqual(allOrNothingSpec(feat), {
    id: "allOrNothing",
    name: "All or Nothing",
    period: "session",
    limit: 1,
    workflow: "allOrNothing"
  });
  assert.equal(allOrNothingSpec({ activeFeatNames: [] }), null);
  assert.ok(limitedUseAbilities(feat, [], cfg).some(s => s.id === "allOrNothing"));
  for (const checkKind of ["skill", "knowledge", "attack"])
    assert.ok(allOrNothingEligible(feat, { checkKind, formula: "1d20 + 5" }), checkKind);
  assert.equal(allOrNothingEligible(feat, { checkKind: "save", formula: "1d20 + 5" }), false);
  assert.equal(allOrNothingEligible(feat, { checkKind: "damage", formula: "1d20" }), false);
  assert.equal(allOrNothingEligible(feat, { checkKind: "skill", checkMethod: "take10", formula: "10 + 5" }), false);
  assert.equal(allOrNothingEligible({ activeFeatNames: [] }, { checkKind: "skill", formula: "1d20" }), false);
});

test("both ranges widen by 5; a roll without a range keeps none", () => {
  assert.deepEqual(allOrNothingRanges({ threat: 20, error: 1 }), { threat: 15, error: 6 });
  assert.deepEqual(allOrNothingRanges({ threat: 18, error: 2 }), { threat: 13, error: 7 });
  assert.deepEqual(allOrNothingRanges({ threat: 0, error: 0 }), { threat: 0, error: 0 });
  assert.deepEqual(allOrNothingRanges({ threat: 5, error: 17 }), { threat: 2, error: 19 });
});

test("an error stays open to activation even when the check succeeds", () => {
  const roll = (allOrNothing, patch = {}) => ({
    checkKind: "skill",
    checkMethod: "roll",
    naturalDie: 4,
    error: 6,
    threat: 15,
    rawTotal: 25,
    effectiveTotal: 25,
    ...(allOrNothing ? { allOrNothing: true } : {}),
    ...patch
  });
  assert.ok(checkCandidates(roll(true)).naturalError);
  assert.equal(errorDecisionPending(roll(false, { successConfirmed: true })), false);
  assert.equal(errorDecisionPending(roll(true, { successConfirmed: true })), true);
  assert.equal(adjudicateCheck(roll(false), true).errorConfirmed, false);
  assert.equal(adjudicateCheck(roll(true), true).errorConfirmed, true);
  assert.equal(adjudicateCheck(roll(true), false).errorConfirmed, true);
  assert.equal(adjudicateCheck(roll(true, { naturalDie: 9 }), true).errorConfirmed, false, "outside the range");
  assert.match(allOrNothingNote({ allOrNothing: true }), /widened by 5.*\(p\.189\)/);
  assert.equal(allOrNothingNote({}), "");
});

test("a declared attack posts with widened ranges and spends the session use once", async () => {
  const a = actor();
  a.system.activeFeatNames.push("All or Nothing");
  a.system = prep(a.system, a.items);
  a.system.resourceUses = {};
  a.system.limitedUses = limitedUseAbilities(a.system, a.items, cfg);
  // This fixture's update stores "system.resourceUses.allOrNothing" under that flat key.
  const used = () => (a.system["resourceUses.allOrNothing"] ?? a.system.resourceUses.allOrNothing)?.used;
  const w = a.items[0],
    plain = await a.rollAttack(w, opts()),
    declared = await a.rollAttack(w, { ...opts(), allOrNothing: true }),
    c = declared.flags.spycraft2,
    p = plain.flags.spycraft2;
  assert.equal(c.allOrNothing, true);
  assert.equal(c.threat, Math.max(2, p.threat - 5));
  assert.equal(c.error, p.error + 5);
  assert.equal(p.allOrNothing, undefined);
  assert.equal(used(), 1);
  // Foundry would nest the update; the fixture does not, so put the saved counter where the next check reads it.
  a.system.resourceUses = { allOrNothing: a.system["resourceUses.allOrNothing"] };
  const warnings = [];
  ui.notifications.warn = m => warnings.push(m);
  const again = await a.rollAttack(w, { ...opts(), allOrNothing: true }).catch(e => (warnings.push(e.message), null));
  assert.ok(warnings.length || !again?.flags?.spycraft2?.allOrNothing, "a second use this session is refused");
  assert.equal(used(), 1);
});

test("the dialogs offer the declaration only to an owner of the feat", () => {
  const owner = { system: { activeFeatNames: ["All or Nothing"] } },
    other = { system: { activeFeatNames: [] } },
    html = (dialog, who) =>
      rollPipeline.dialog({
        dialog,
        actor: who,
        item: { system: { proficiency: "edged", damage: "1d6" } },
        options: {},
        preview: { range: 10 },
        esc: s => s
      });
  assert.match(html("attack", owner), /name="allOrNothing"/);
  assert.doesNotMatch(html("attack", other), /name="allOrNothing"/);
  assert.equal(
    rollPipeline.read(
      {
        dialog: "attack",
        actor: owner,
        item: { system: { proficiency: "edged", damage: "1d6" } },
        entered: { allOrNothing: true }
      },
      {}
    ).allOrNothing,
    true
  );
});
