// These fixtures supply required gear unless a case explicitly overrides gearStatus; absence/kit boundaries are tested in test-skill-gear.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { actionDieBoostPlan } from "../module/rules/action-dice.mjs";
const state = () => ({
  level: 13,
  classLevels: { schemer: 10, scientist: 3 },
  abilities: { str: { mod: 1 }, dex: { mod: 2 }, con: { mod: 0 }, int: { mod: 5 }, wis: { mod: -1 }, cha: { mod: 3 } },
  actionDice: { value: 3, max: 3 },
  resourceUses: {},
  skillFeatRules: [],
  skillTotals: {
    acrobatics: { name: "Acrobatics", ranks: 4, cap: 30, threat: 20, totals: [{ ability: "dex", total: 6 }] },
    analysis: {
      name: "Analysis",
      ranks: 4,
      cap: 30,
      threat: 20,
      totals: [
        { ability: "int", total: 9 },
        { ability: "wis", total: 3 }
      ]
    }
  }
});
test("All According to Plan replaces the ability modifier for every named skill/attribute without losing target penalties, synergy, cap or focus rules", () => {
  for (const [key, data] of Object.entries(cfg.skills))
    for (const check of data.checks)
      for (const ability of check.attributes) {
        const s = state();
        s.armor = { check: -2, visionCheck: -1 };
        s.skillTotals[key] = {
          name: data.name,
          ranks: 4,
          cap: 30,
          threat: 20,
          focus: data.focus,
          totals: data.abilities.map(a => ({ ability: a, total: 4 + s.abilities[a].mod }))
        };
        const ordinary = resolveSkillCheck(s, key, check, {
            gearStatus: "available",
            ability,
            synergySkill: "none",
            optionalRules: ["linguistics"],
            trackingSurface: "verySoft"
          }),
          plan = resolveSkillCheck(s, key, check, {
            gearStatus: "available",
            ability,
            synergySkill: "none",
            optionalRules: ["linguistics"],
            trackingSurface: "verySoft",
            allAccordingToPlan: true
          });
        assert.equal(plan.blocked, false, key + "/" + check.id);
        assert.equal(plan.ability, "int");
        assert.equal(plan.total, ordinary.total + s.abilities.int.mod - s.abilities[ability].mod);
        assert.equal(plan.cap, ordinary.cap);
        assert.equal(plan.error, ordinary.error);
        assert.equal(plan.attributeSubstitution.originalAbility, ability);
      }
});
test("native source milestone and starting-dice use limits are precise; invalid attribute data fails closed", () => {
  for (let n = 0; n <= 10; n++)
    for (let max = 0; max <= 6; max++) {
      const s = state();
      s.classLevels.schemer = n;
      s.actionDice.max = max;
      const spec = limitedUseAbilities(s, [], cfg).find(x => x.id === "allAccordingToPlan");
      assert.equal(spec?.limit ?? null, n >= 4 ? max : null);
      const r = resolveSkillCheck(s, "acrobatics", cfg.skills.acrobatics.checks[0], {
        gearStatus: "available",
        allAccordingToPlan: true
      });
      assert.equal(r.blocked, n < 4);
    }
  const s = state();
  delete s.abilities.dex;
  assert.equal(
    resolveSkillCheck(s, "acrobatics", cfg.skills.acrobatics.checks[0], {
      gearStatus: "available",
      allAccordingToPlan: true
    }).blocked,
    true
  );
});
test("Hyperconscious applies to the actual INT check at level ten, competes with other time reductions and does not change non-INT or take-20 checks", () => {
  const check = {
    id: "test",
    name: "Test",
    attributes: ["int", "wis"],
    error: 1,
    tags: "",
    mode: "Active",
    time: "1 Minute (Take 10/Take 20)"
  };
  for (let n = 0; n <= 10; n++)
    for (const ability of ["int", "wis"]) {
      const s = state();
      s.classLevels.schemer = n;
      const r = resolveSkillCheck(s, "analysis", check, {
        gearStatus: "available",
        ability,
        method: "take10",
        safeToTake: true
      });
      assert.equal(r.timeMultiplier, n === 10 && ability === "int" ? 1 : 2);
    }
  const s = state();
  s.skillFeatRules = [{ name: "Mark of a Professional", skill: "analysis" }];
  assert.equal(
    resolveSkillCheck(s, "analysis", check, {
      gearStatus: "available",
      ability: "int",
      method: "take10",
      safeToTake: true,
      unopposed: true
    }).timeMultiplier,
    1
  );
  assert.equal(
    resolveSkillCheck(s, "analysis", check, {
      gearStatus: "available",
      ability: "int",
      method: "take20",
      safeToTake: true
    }).timeMultiplier,
    20
  );
  const converted = resolveSkillCheck(s, "acrobatics", cfg.skills.acrobatics.checks[0], {
    gearStatus: "available",
    allAccordingToPlan: true,
    method: "take10",
    safeToTake: true
  });
  assert.equal(converted.timeMultiplier, 1);
});
let posts = [],
  failPost = false,
  rolls = 0,
  session = "s";
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.schemer";
    this.type = "agent";
    this.isOwner = true;
    this.system = state();
    this.items = [];
    this.system.limitedUses = limitedUseAbilities(this.system, [], cfg);
  }
  async update(patch) {
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.replace(/^system\./, "").split(".");
      let o = this.system;
      for (const k of keys.slice(0, -1)) o = o[k] ??= {};
      const k = keys.at(-1);
      if (k.startsWith("-=")) delete o[k.slice(2)];
      else o[k] = structuredClone(value);
    }
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { id: "gm", isGM: true },
  settings: { get: (_s, k) => (k === "linguistics" ? false : { session, scene: "scene" }) },
  i18n: { localize: s => s, format: s => s }
};
globalThis.foundry = {
  utils: { escapeHTML: s => String(s) },
  applications: { api: { DialogV2: { input: async () => ({ chosen: "1" }) } } }
};
globalThis.ui = { notifications: { warn: () => null } };
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  create: async data => {
    if (failPost) throw Error("post failed");
    posts.push(data);
    return data;
  }
};
globalThis.Roll = class {
  constructor(formula, data) {
    rolls++;
    const n = formula.startsWith("20") ? 20 : formula.startsWith("10") ? 10 : 7;
    this.total = n + data.total;
    this.dice = formula.startsWith("10") || formula.startsWith("20") ? [] : [{ total: n }];
  }
  async evaluate() {
    return this;
  }
  async toMessage(data, options = {}) {
    const prepared = { ...data, rolls: [this] };
    return options.create === false ? prepared : ChatMessage.create(prepared);
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
const input = { check: "balance", allAccordingToPlan: true };
function reset() {
  posts = [];
  failPost = false;
  rolls = 0;
  session = "s";
}
test("actual skill entry permits Bright Idea on a substituted INT check and commits both independent uses and Hail Mary payment once", async () => {
  reset();
  const a = new SpycraftActor(),
    m = await a.rollSkill("acrobatics", "dex", {
      gearStatus: "available",
      ...input,
      brightIdea: true,
      hailMaryUncap: true
    });
  assert.equal(m.flags.spycraft2.ability, "int");
  assert.equal(m.flags.spycraft2.rollData.total, 9);
  assert.equal(m.flags.spycraft2.attributeSubstitution.originalAbility, "dex");
  assert.equal(m.flags.spycraft2.alternatives.length, 2);
  assert.equal(a.system.resourceUses.allAccordingToPlan.used, 1);
  assert.equal(a.system.resourceUses.brightIdeaScientist.used, 1);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(rolls, 2);
  assert.equal(
    actionDieBoostPlan({ ...a.system, coreClassIds: ["snoop"], actionDice: { value: 1, die: 4 } }, m.flags.spycraft2)
      .rolls,
    2
  );
});
test("fixed checks use the substituted INT and Hyperconscious timing; session changes refresh its shared allowance", async () => {
  reset();
  const a = new SpycraftActor();
  const m = await a.rollSkill("acrobatics", "dex", {
    gearStatus: "available",
    ...input,
    method: "take10",
    safeToTake: true
  });
  assert.equal(m.flags.spycraft2.rawTotal, 19);
  assert.equal(m.flags.spycraft2.naturalDie, null);
  assert.equal(m.flags.spycraft2.actionDiceAllowed, false);
  assert.match(m.flavor, /Hyperconscious/);
  assert.equal(a.system.resourceUses.allAccordingToPlan.used, 1);
  for (let i = 0; i < 2; i++) await a.rollSkill("acrobatics", "dex", { gearStatus: "available", ...input });
  assert.equal(await a.rollSkill("acrobatics", "dex", { gearStatus: "available", ...input }), null);
  session = "next";
  assert.ok(await a.rollSkill("acrobatics", "dex", { gearStatus: "available", ...input }));
  assert.equal(a.system.resourceUses.allAccordingToPlan.used, 1);
});
test("post failures refund combined uses and payment; competing final substitutions execute once", async () => {
  reset();
  const a = new SpycraftActor();
  failPost = true;
  await assert.rejects(
    a.rollSkill("acrobatics", "dex", { gearStatus: "available", ...input, brightIdea: true, hailMaryUncap: true }),
    /post failed/
  );
  assert.equal(a.system.actionDice.value, 3);
  assert.equal(a.system.resourceUses.allAccordingToPlan, undefined);
  assert.equal(a.system.resourceUses.brightIdeaScientist, undefined);
  failPost = false;
  a.system.resourceUses.allAccordingToPlan = { epoch: "s", used: 2 };
  await Promise.all([
    a.rollSkill("acrobatics", "dex", { gearStatus: "available", ...input }),
    a.rollSkill("acrobatics", "dex", { gearStatus: "available", ...input })
  ]);
  assert.equal(posts.length, 1);
  assert.equal(a.system.resourceUses.allAccordingToPlan.used, 3);
});

test("the substituted INT check can use 10-Second Solution with both allowances in one transaction", async () => {
  reset();
  const a = new SpycraftActor();
  a.system.classLevels = { schemer: 4, scientist: 14 };
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  const m = await a.rollSkill("acrobatics", "dex", {
    gearStatus: "available",
    ...input,
    tenSecondSolution: true,
    standaloneCheckConfirmed: true
  });
  assert.equal(m.flags.spycraft2.naturalDie, 20);
  assert.equal(m.flags.spycraft2.rawTotal, 29);
  assert.equal(a.system.resourceUses.allAccordingToPlan.used, 1);
  assert.equal(a.system.resourceUses.tenSecondSolution.used, 1);
  assert.equal(a.system.actionDice.value, 3);
});

const { cunningPlanEffect, cunningPlanCheck } = await import("../module/rules/class-checks.mjs");
const { adjudicateCheck, checkCandidates, rollEvidence } = await import("../module/rules/outcomes.mjs");
const failedCheck = () => ({
  actorUuid: "Actor.schemer",
  formula: "1d20 + @total",
  rollData: { total: 2 },
  checkKind: "skill",
  skillKey: "analysis",
  ability: "int",
  checkMethod: "roll",
  naturalDie: 2,
  rawTotal: 4,
  effectiveTotal: 4,
  threat: 20,
  error: 3,
  successConfirmed: false,
  errorConfirmed: true,
  actionDiceAllowed: true
});
function message(check = failedCheck()) {
  return {
    uuid: "ChatMessage.cunning",
    flags: { spycraft2: check },
    async update(patch) {
      if (patch["flags.spycraft2"]) this.flags.spycraft2 = structuredClone(patch["flags.spycraft2"]);
      this.flavor = patch.flavor;
      return this;
    }
  };
}
test("Cunning Plan uses prose scene milestones, reduces by INT modifier to zero, and rejects unavailable or already finalized sources", () => {
  for (let n = 0; n <= 10; n++) {
    const s = state();
    s.classLevels.schemer = n;
    const spec = limitedUseAbilities(s, [], cfg).find(s => s.id === "cunningPlan");
    assert.equal(spec?.limit ?? 0, n >= 7 ? 2 : n >= 2 ? 1 : 0);
    if (spec) assert.equal(spec.period, "scene");
  }
  assert.equal(cunningPlanEffect(state(), 7).error, 2);
  assert.equal(cunningPlanEffect(state(), 3).error, 0);
  for (const mod of [-1, 0, NaN])
    assert.throws(() => cunningPlanEffect({ ...state(), abilities: { int: { mod } } }, 3));
  for (const patch of [
    { criticalFailure: true },
    { criticalSuccess: true },
    { resolved: true },
    { superseded: "x" },
    { cunningPlan: {} },
    { cannotError: true },
    { naturalDie: null },
    { checkMethod: "take10" },
    { error: 0 }
  ])
    assert.throws(() => cunningPlanCheck(state(), { ...failedCheck(), ...patch }));
});
test("predeclared Cunning Plan combines atomically with substitution, Bright Idea and payment, and can satisfy fixed-check error restrictions", async () => {
  reset();
  const a = new SpycraftActor();
  const m = await a.rollSkill("acrobatics", "dex", {
    gearStatus: "available",
    ...input,
    cunningPlan: true,
    brightIdea: true,
    hailMaryUncap: true
  });
  assert.equal(m.flags.spycraft2.error, 0);
  assert.equal(m.flags.spycraft2.cunningPlan.originalError, 1);
  for (const id of ["cunningPlan", "allAccordingToPlan", "brightIdeaScientist"])
    assert.equal(a.system.resourceUses[id].used, 1);
  assert.equal(a.system.actionDice.value, 0);
  const s = state(),
    check = {
      id: "fixed",
      name: "Fixed",
      attributes: ["int"],
      error: 3,
      tags: "",
      mode: "Active",
      time: "1 Minute (Take 10/Take 20)"
    };
  assert.equal(
    resolveSkillCheck(s, "analysis", check, { gearStatus: "available", method: "take10", safeToTake: true }).blocked,
    true
  );
  const fixed = resolveSkillCheck(s, "analysis", check, {
    gearStatus: "available",
    method: "take10",
    safeToTake: true,
    cunningPlan: true
  });
  assert.equal(fixed.blocked, false);
  assert.equal(fixed.error, 0);
});
test("Knowledge and direct attack declarations use the same Cunning Plan scene pool without an action-die charge", async () => {
  reset();
  const a = new SpycraftActor(),
    k = await a.rollKnowledge({ skill: "analysis", cunningPlan: true });
  assert.equal(k.flags.spycraft2.error, 0);
  assert.equal(k.flags.spycraft2.actionDiceAllowed, false);
  const attack = await a.rollCheck("1d20 + @total", { total: 2 }, { checkKind: "attack", error: 7, cunningPlan: true });
  assert.equal(attack.flags.spycraft2.error, 2);
  assert.equal(a.system.resourceUses.cunningPlan.used, 2);
  assert.equal(
    await a.rollCheck("1d20 + @total", { total: 2 }, { checkKind: "attack", error: 7, cunningPlan: true }),
    null
  );
  assert.equal(a.system.actionDice.value, 3);
});
test("a direct natural-20 declaration consumes its ability and Cunning Plan once without reducing its range twice", async () => {
  reset();
  const a = new SpycraftActor();
  a.system.classLevels = { schemer: 2, soldier: 14 };
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  const m = await a.rollCheck(
    "1d20 + @total",
    { total: 2 },
    { checkKind: "attack", error: 7, cunningPlan: true, oneInAMillion: true }
  );
  assert.equal(m.flags.spycraft2.error, 2);
  assert.equal(m.flags.spycraft2.naturalDie, 20);
  assert.equal(a.system.resourceUses.cunningPlan.used, 1);
  assert.equal(a.system.resourceUses.oneInAMillion.used, 1);
});
test("post-roll Cunning Plan removes a natural error while retaining failure and rolled evidence; negative results stay errors", async () => {
  reset();
  const a = new SpycraftActor(),
    m = message(),
    before = rollEvidence(m.flags.spycraft2);
  await a.useCunningPlan(m, { freeActionConfirmed: true });
  assert.equal(m.flags.spycraft2.error, 0);
  assert.equal(m.flags.spycraft2.errorConfirmed, false);
  assert.equal(m.flags.spycraft2.successConfirmed, false);
  assert.equal(m.flags.spycraft2.rawTotal, 4);
  assert.notEqual(rollEvidence(m.flags.spycraft2), before);
  assert.equal(await a.useCunningPlan(m, { freeActionConfirmed: true }), false);
  assert.equal(a.system.resourceUses.cunningPlan.used, 1);
  const negative = message({ ...failedCheck(), rawTotal: -1, effectiveTotal: -1 });
  await a.useCunningPlan(negative, { freeActionConfirmed: true });
  assert.equal(negative.flags.spycraft2.error, 0);
  assert.equal(negative.flags.spycraft2.errorConfirmed, true);
  assert.equal(checkCandidates(negative.flags.spycraft2).negative, true);
  assert.equal(a.system.resourceUses.cunningPlan.used, 2);
});
test("failed writes refund the scene use and restore only this check’s improvised-weapon destruction; competing final uses apply once", async () => {
  reset();
  const a = new SpycraftActor();
  let weapon = {
    uuid: "Item.weapon",
    system: { destroyed: true, destroyedByRoll: "ChatMessage.cunning" },
    async update(patch) {
      for (const [k, v] of Object.entries(patch)) this.system[k.slice(7)] = v;
    }
  };
  globalThis.fromUuidSync = () => weapon;
  const m = message({ ...failedCheck(), checkKind: "attack", improvised: true, weaponUuid: weapon.uuid }),
    update = m.update.bind(m);
  m.update = async () => {
    throw Error("write failed");
  };
  await assert.rejects(a.useCunningPlan(m, { freeActionConfirmed: true }), /write failed/);
  assert.equal(a.system.resourceUses.cunningPlan, undefined);
  assert.equal(weapon.system.destroyed, true);
  assert.equal(m.flags.spycraft2.error, 3);
  m.update = update;
  a.system.resourceUses.cunningPlan = { epoch: "scene", used: 1 };
  await Promise.all([
    a.useCunningPlan(m, { freeActionConfirmed: true }),
    a.useCunningPlan(m, { freeActionConfirmed: true })
  ]);
  assert.equal(m.flags.spycraft2.error, 0);
  assert.equal(a.system.resourceUses.cunningPlan.used, 2);
  assert.equal(weapon.system.destroyed, false);
  delete globalThis.fromUuidSync;
});
test("a reroll keeps the already reduced error range without charging or applying Cunning Plan again", async () => {
  reset();
  const a = new SpycraftActor(),
    record = cunningPlanEffect(a.system, 7);
  a.system.limitedUses.push({
    id: "perfect",
    name: "Perfect Skill Mastery",
    period: "session",
    limit: 3,
    cost: 0,
    workflow: "reroll",
    mastery: "Perfect Skill Mastery"
  });
  const m = message({ ...failedCheck(), error: record.error, cunningPlan: record });
  const next = await a.rerollCheck(m, { resource: "perfect", failed: true });
  assert.equal(next.flags.spycraft2.error, 2);
  assert.deepEqual(next.flags.spycraft2.cunningPlan, record);
  assert.equal(a.system.resourceUses.cunningPlan, undefined);
  assert.equal(a.system.resourceUses.perfect.used, 1);
});
