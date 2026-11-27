import test from "node:test";
import assert from "node:assert/strict";
import { cakewalkSelectionPlan, cakewalkSelectionState } from "../module/rules/cakewalk.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { selectCakewalkSkills } from "../module/apps/cakewalk.mjs";

const state = (modifier = 2) => ({
  campaignEffects: { cakewalkIntel: true },
  usagePeriods: { mission: "mission-a" },
  abilities: Object.fromEntries(
    ["str", "dex", "con", "int", "wis", "cha"].map(key => [
      key,
      { value: key === "int" ? 10 + 2 * modifier : 10, mod: key === "int" ? modifier : 0 }
    ])
  ),
  skillTotals: Object.fromEntries(
    Object.keys(cfg.skills).map(key => [
      key,
      {
        ranks: 5,
        cap: 50,
        error: 5,
        threat: 20,
        totals: cfg.skills[key].abilities.map(ability => ({ ability, total: 10 }))
      }
    ])
  ),
  focusTotals: {},
  conditionContext: {},
  activeFeatNames: []
});
const input = skills => ({ skills, intelPhaseConfirmed: true });

test("Cakewalk chooses distinct skills within the Intel Intelligence allowance, once per mission", () => {
  const s = state();
  s.cakewalkSkills = cakewalkSelectionPlan(s, input(["acrobatics", "athletics"]));
  assert.deepEqual(cakewalkSelectionState(s).selected, ["acrobatics", "athletics"]);
  for (const options of [input(["sneak"]), { ...input(["sneak"]), review: true, note: "corrected" }])
    assert.throws(() => cakewalkSelectionPlan(s, options));
  assert.deepEqual(
    cakewalkSelectionPlan(
      s,
      { ...input(["sneak"]), review: true, note: "Original Intel record corrected" },
      { isGM: true }
    ).skills,
    ["sneak"]
  );
  s.usagePeriods.mission = "mission-b";
  assert.deepEqual(cakewalkSelectionState(s).selected, []);
  assert.deepEqual(cakewalkSelectionPlan(s, input(["sneak"])).skills, ["sneak"]);
});

test("invalid selections, non-PCs, absent quality and unconfirmed Intel cannot grant benefits", () => {
  for (const skills of [["acrobatics", "athletics", "sneak"], ["sneak", "sneak"], ["unknown"], "sneak"])
    assert.throws(() => cakewalkSelectionPlan(state(), input(skills)));
  assert.throws(() => cakewalkSelectionPlan(state(), { skills: ["sneak"] }));
  assert.deepEqual(cakewalkSelectionPlan(state(-1), input([])).skills, []);
  assert.throws(() => cakewalkSelectionPlan(state(-1), input(["sneak"])));
  for (const patch of [{ companionOf: { ownerUuid: "Actor.owner" } }, { npcType: "special" }, { campaignEffects: {} }])
    assert.throws(() => cakewalkSelectionPlan({ ...state(), ...patch }, input(["sneak"])));
  const s = state();
  s.cakewalkSkills = { version: 1, epoch: "mission-a", intelligenceModifier: 2, skills: ["unknown"] };
  assert.equal(cakewalkSelectionState(s).needsReview, true);
  assert.deepEqual(cakewalkSelectionState(s).selected, []);
});

test("selected skills reduce actual errors and taking-10 time; other skills, missions and taking 20 are unchanged", () => {
  const s = state(),
    options = { gearStatus: "available", synergySkill: "none" };
  s.cakewalkSkills = cakewalkSelectionPlan(s, input(["acrobatics"]));
  for (const key of ["acrobatics", "athletics"])
    for (const check of cfg.skills[key].checks) {
      const baseline = resolveSkillCheck({ ...s, cakewalkSkills: null }, key, check, options);
      const result = resolveSkillCheck(s, key, check, options);
      assert.equal(
        result.error,
        key === "acrobatics" ? Math.max(Math.min(baseline.error, 1), baseline.error - 2) : baseline.error
      );
      for (const method of ["take10", "take20"]) {
        const r = resolveSkillCheck(s, key, check, { ...options, method });
        const b = resolveSkillCheck({ ...s, cakewalkSkills: null }, key, check, { ...options, method });
        assert.equal(r.total, b.total);
        assert.equal(
          r.timeMultiplier,
          key === "acrobatics" && method === "take10" ? b.timeMultiplier / 2 : b.timeMultiplier
        );
      }
    }
  s.abilities.int.mod = -2;
  assert.deepEqual(
    cakewalkSelectionState(s).selected,
    ["acrobatics"],
    "Intel allowance is historical during the mission"
  );
  s.usagePeriods.mission = "mission-b";
  assert.deepEqual(cakewalkSelectionState(s).selected, []);
});

test("workflow serializes choices, preserves a committed write after a lost response, and rejects a changed mission", async () => {
  globalThis.game = {
    user: { isGM: false },
    settings: { get: (_id, key) => (key === "campaign" ? { qualities: ["cakewalk"] } : { mission: "mission-a" }) }
  };
  const actor = {
    type: "agent",
    uuid: "Actor.cakewalk",
    isOwner: true,
    system: state(),
    async update(patch) {
      this.system.cakewalkSkills = patch["system.cakewalkSkills"];
      throw Error("response lost");
    }
  };
  const results = await Promise.allSettled([
    selectCakewalkSkills(actor, input(["acrobatics"])),
    selectCakewalkSkills(actor, input(["athletics"]))
  ]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.deepEqual(actor.system.cakewalkSkills.skills, ["acrobatics"]);
  actor.system.cakewalkSkills = null;
  let release;
  actor._actionDieQueue = new Promise(resolve => {
    release = resolve;
  });
  const pending = selectCakewalkSkills(actor, input(["athletics"]));
  game.settings.get = (_id, key) => (key === "campaign" ? { qualities: ["cakewalk"] } : { mission: "mission-b" });
  release();
  await assert.rejects(pending, /mission.*changed/);
});
