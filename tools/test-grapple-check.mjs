import test from "node:test";
import assert from "node:assert/strict";
import "../module/rolls/index.mjs";
import { grappleSkillChecks, grappleCheckPlan, GRAPPLE_CHECK } from "../module/rules/grapple-check.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { conditionRollPenalties } from "../module/rules/attributes.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const state = (feats, extra = {}) => ({
  activeFeatNames: feats,
  classOptionSelections: [],
  skillTotals: Object.fromEntries(
    Object.values(cfg.skills).map(s => [
      s.key,
      { name: s.name, ranks: 5, cap: 50, threat: 20, totals: s.abilities.map(ability => ({ ability, total: 8 })) }
    ])
  ),
  ...extra
});
const roll = (system, input = {}) =>
  resolveSkillCheck(system, "athletics", GRAPPLE_CHECK, { synergySkill: "none", gearStatus: "available", ...input });

test("Grapple is a named Athletics check", () => {
  assert.ok(grappleSkillChecks("athletics", []).some(c => c.id === "grapple"));
  assert.deepEqual(grappleSkillChecks("notice", []), []);
});

test("Prone Stance +1, Horde Mastery +1 morale and Garrote Basics threat +2 apply to Grapple checks", () => {
  const plain = roll(state([]));
  const prone = roll(state(["Submission Basics"], { combatStance: { version: 1, id: "p", key: "prone" } }));
  assert.equal(prone.total, plain.total + 1);
  assert.equal(roll(state(["Horde Mastery"]), { grappleAdvantageConfirmed: true }).total, plain.total + 1);
  assert.equal(roll(state(["Horde Mastery"])).total, plain.total);
  const garrote = roll(state(["Garrote Basics"]), { grappleGarrote: true });
  assert.equal(garrote.threat, plain.threat - 2);
  assert.match(
    grappleCheckPlan(state(["Garrote Basics"]), "athletics", GRAPPLE_CHECK, { grappleGarrote: true }).notes[0],
    /mute/
  );
});

test("Prone Stance turns becoming sprawled into becoming prone", () => {
  const sys = {
    activeFeatNames: ["Submission Basics"],
    combatStance: { key: "prone" },
    conditionContext: { sprawled: true }
  };
  const c = conditionRollPenalties(sys);
  assert.deepEqual([c.sprawled, c.prone], [false, true]);
  const plain = conditionRollPenalties({ activeFeatNames: [], conditionContext: { sprawled: true } });
  assert.deepEqual([plain.sprawled, plain.prone], [true, false]);
});

test("Submission Basics doubles Cheap Shot penalties; Submission Supremacy allows a different one", async () => {
  const { cheapShotApplyPlan, cheapShotPenalty, cheapShotSpeedPenalty } =
    await import("../module/rules/cheap-shot-effects.mjs");
  const hit = (choice, extra = {}) => ({
    checkKind: "attack",
    resolved: true,
    successConfirmed: true,
    actorUuid: "Actor.a",
    attackContext: { cheapShot: { active: true, choice, scene: "s", madeAt: 10 } },
    ...extra
  });
  const base = { usagePeriods: { scene: "s" }, cheapShots: [] };
  const first = cheapShotApplyPlan(base, hit("dex"), {
    sourceMessage: "M1",
    now: 20,
    scene: "s",
    doubled: true
  }).record;
  const sys = { ...base, cheapShots: [first] };
  assert.equal(cheapShotPenalty(sys, "dex"), -4);
  assert.throws(
    () => cheapShotApplyPlan(sys, hit("str"), { sourceMessage: "M2", now: 20, scene: "s" }),
    /already suffered/
  );
  assert.throws(
    () => cheapShotApplyPlan(sys, hit("dex"), { sourceMessage: "M2", now: 20, scene: "s", supremacy: true }),
    /not already suffered/
  );
  const second = cheapShotApplyPlan(sys, hit("speed"), {
    sourceMessage: "M2",
    now: 20,
    scene: "s",
    supremacy: true
  }).record;
  const both = { ...base, cheapShots: [first, second] };
  assert.equal(second.repeat, true);
  assert.equal(cheapShotSpeedPenalty(both), -10);
  assert.equal(cheapShotPenalty(both, "dex"), -4);
});
