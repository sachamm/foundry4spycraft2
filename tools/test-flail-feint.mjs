import test from "node:test";
import assert from "node:assert/strict";
import { feintCheckPlan as plan, validateFeintProof as validate } from "../module/rules/feint.mjs";
import { readiedMeleeWeapons } from "../module/rules/readied-weapons.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { clock, input, sword, prep, acting, defending } from "./fixtures/feint.mjs";
const flail = (patch = {}) => ({
    ...sword({ meleeFamily: "flail", proficiency: "exoticBlunt", qualities: "", ...patch }),
    id: "flail",
    uuid: "Actor.feint.Item.flail",
    name: "Renamed source"
  }),
  state = (names = ["Flail Basics"]) => ({
    activeFeatNames: names,
    size: "Medium",
    conditionContext: {},
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 12, mod: 1 }])),
    skillTotals: Object.fromEntries(
      Object.entries(cfg.skills).map(([key, s]) => [
        key,
        {
          name: s.name,
          ranks: 4,
          cap: 50,
          threat: 20,
          totals: s.abilities.map(ability => ({ ability, total: 10 })),
          bonusEntries: []
        }
      ])
    ),
    focusTotals: {}
  }),
  options = () => ({ ...input(), gearStatus: "available", synergySkill: "none" });
test("Flail Feint requires qualified feat and reviewed family, with no name inference or proficiency substitution", () => {
  for (const active of [false, true])
    for (const family of ["", "flail", "whip"])
      for (const proficiency of ["exoticBlunt", "blunt", "edged"]) {
        const s = prep(state(active ? ["Flail Basics"] : []), [flail({ meleeFamily: family, proficiency })]);
        for (const [key, c] of [
          ["sleightOfHand", acting],
          ["notice", defending]
        ])
          assert.equal(
            plan(s, key, c, input()).evidence.flailBasics?.bonus ?? 0,
            active && family === "flail" && proficiency === "exoticBlunt" ? 2 : 0
          );
      }
  for (const patch of [
    { equipped: false },
    { carried: false },
    { reserve: true },
    { quantity: 0 },
    { destroyed: true }
  ])
    assert.equal(plan(prep(state(), [flail(patch)]), "notice", defending, input()).evidence.flailBasics, null);
});
test("Fencing and Flail compete with each other and stronger gear; conditions reduce the combined skill bonus before hand penalties", () => {
  for (const [key, c] of [
    ["sleightOfHand", acting],
    ["notice", defending]
  ]) {
    const s = prep(state(["Flail Basics", "Fencing Basics"]), [flail(), sword()]);
    assert.equal(resolveSkillCheck(s, key, c, options()).total, 12);
    assert.equal(plan(s, key, c, input()).bonuses.length, 2);
    s.skillTotals[key].bonusEntries = [{ source: "Gear", type: "gear", value: 5 }];
    s.skillTotals[key].totals.forEach(r => (r.total = 15));
    assert.equal(resolveSkillCheck(s, key, c, options()).total, 15);
  }
  const s = prep(state(), [flail()]);
  s.conditionContext.baffled = true;
  assert.equal(resolveSkillCheck(s, "sleightOfHand", acting, { ...options(), oneHanded: true }).total, 2);
});
test("legal held capacity is mandatory; ordinary skills receive no Flail benefit", () => {
  const items = [flail({ useHands: 2 }), sword()];
  assert.match(plan(prep(state(), items), "notice", defending, input()).blockedReason, /two hands/);
  const s = prep(state(), [flail()]);
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const c of skill.checks) assert.equal(plan(s, key, c, input()).evidence, null);
  assert.equal(readiedMeleeWeapons(s, [flail({ sizeHands: "M/2h" })])[0].hands, 2);
});
test("live owned source validation binds null or explicit UUIDs, readiness, family, grip, feat gains and losses", () => {
  const items = [flail()],
    a = { system: prep(state(), items), items },
    proof = plan(a.system, "notice", defending, input()).evidence,
    scope = { checkKind: "skill", skillKey: "notice", checkId: "resist-feint", ability: "wis", combat: clock() };
  validate(a, proof, scope);
  const local = structuredClone(proof);
  local.flailBasics.weapons[0].uuid = null;
  validate(a, local, scope);
  for (const patch of [{ equipped: false }, { meleeFamily: "" }, { useHands: 2 }, { destroyed: true }]) {
    const original = structuredClone(items[0].system);
    Object.assign(items[0].system, patch);
    assert.throws(() => validate(a, proof, scope));
    items[0].system = original;
  }
  a.system.activeFeatNames = [];
  assert.throws(() => validate(a, proof, scope));
  const zero = plan(a.system, "notice", defending, input()).evidence;
  a.system.activeFeatNames = ["Flail Basics"];
  assert.throws(() => validate(a, zero, scope));
  const foreign = structuredClone(proof);
  foreign.flailBasics.weapons[0].uuid = "Actor.foreign.Item.flail";
  assert.throws(() => validate(a, foreign, scope));
});
test("version1 Feint receipts preserve historical source scope while version2 protects new Flail facts", () => {
  const a = { system: prep(state(), [flail()]), items: [flail()] },
    p = plan(a.system, "notice", defending, input()).evidence,
    scope = { checkKind: "skill", skillKey: "notice", checkId: "resist-feint", ability: "wis", combat: clock() };
  assert.equal(p.version, 2);
  const legacy = structuredClone(p);
  legacy.version = 1;
  delete legacy.flailBasics;
  validate(a, legacy, scope);
  const forged = structuredClone(p);
  delete forged.flailBasics;
  assert.throws(() => validate(a, forged, scope));
});
const { makeFatigueActor } = await import("./fixtures/fatigue-actor.mjs");
foundry.utils.escapeHTML = String;
globalThis.ChatMessage = { getSpeaker: () => ({}) };
let hook = async () => {},
  posts = [];
globalThis.Roll = class {
  constructor(_f, data) {
    this.total = 12 + (data.total ?? 0);
    this.dice = [{ total: 12 }];
  }
  async evaluate() {
    await hook();
    return this;
  }
  async toMessage(d) {
    posts.push(d);
    return d;
  }
};
function actor() {
  const a = makeFatigueActor();
  a.items = [flail()];
  a.items.get = id => a.items.find(i => i.id === id);
  a.system = prep(state(), a.items);
  a.mentalLeapCombatContext = clock;
  a.uuid = "Actor.feint";
  a.flags = {};
  return a;
}
test("actual Actor posts authoritative Flail proof for either role and rejects source changes during RNG", async () => {
  hook = async () => {};
  for (const [key, id] of [
    ["sleightOfHand", "feint"],
    ["notice", "resist-feint"]
  ]) {
    const a = actor(),
      m = await a.rollSkill(key, null, { check: id, ...options(), flailBasics: { bonus: 99 } });
    assert.equal(m.flags.spycraft2.rollData.total, 12);
    assert.equal(m.flags.spycraft2.feint.flailBasics.bonus, 2);
  }
  for (const kind of ["qualityFamily", "unready", "feat"]) {
    const a = actor();
    posts = [];
    hook = async () => {
      if (kind === "qualityFamily") a.items[0].system.meleeFamily = "whip";
      if (kind === "unready") a.items[0].system.equipped = false;
      if (kind === "feat") a.system.activeFeatNames = [];
      a.system = prep(a.system, a.items);
    };
    await assert.rejects(a.rollSkill("notice", null, { check: "resist-feint", ...options() }), /changed/);
    assert.equal(posts.length, 0);
  }
  hook = async () => {};
});
