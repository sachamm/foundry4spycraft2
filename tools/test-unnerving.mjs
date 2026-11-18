import test from "node:test";
import assert from "node:assert/strict";
import { unnervingGrade, unnervingEligible, unnervingPlan } from "../module/rules/unnerving.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const state = (n = 2) => ({
    originEffects: Array.from({ length: n }, () => ({ qualityKey: "unnerving" })),
    actionDice: { value: 0 }
  }),
  damage = {
    actorUuid: "Actor.unnerving",
    checkKind: "damage",
    weaponProficiency: "unarmed",
    unarmed: true,
    unnervingAvailableGrade: 2,
    rawTotal: 7
  },
  input = { target: "Actually damaged target", damageInflictedConfirmed: true };
test("Unnerving uses one d4 per selected grade up to three, and only unarmed or melee damage records qualify", () => {
  for (let n = 0; n <= 5; n++) {
    assert.equal(unnervingGrade(state(n)), Math.min(3, n));
    for (const proficiency of Object.keys(cfg.proficiencies)) {
      const check = {
        ...damage,
        unnervingAvailableGrade: Math.min(3, n),
        unarmed: false,
        weaponProficiency: proficiency
      };
      assert.equal(
        unnervingEligible(state(n), check),
        n > 0 && ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(proficiency)
      );
    }
    if (n)
      assert.equal(
        unnervingPlan(state(n), { ...damage, unnervingAvailableGrade: Math.min(3, n) }, input).formula,
        `${Math.min(3, n)}d4`
      );
  }
  for (const patch of [
    { unnervingAvailableGrade: undefined },
    { unnervingAvailableGrade: 1 },
    { rawTotal: NaN },
    { checkKind: "attack" },
    { checkKind: "skill" },
    { unnervingStress: {} },
    { unnerving: {} },
    { superseded: true },
    { unarmed: false, weaponProficiency: "handgun" }
  ])
    assert.equal(unnervingEligible(state(), { ...damage, ...patch }), false);
  assert.equal(unnervingEligible(state(), { ...damage, resolved: true }), true);
  assert.equal(unnervingEligible({ originEffects: [{ name: "Unnerving I" }] }, damage), false);
});
test("only confirmed actually inflicted damage triggers the additional stress, independently of the unadjusted rolled amount", () => {
  for (const patch of [
    { target: "" },
    { target: true },
    { damageInflictedConfirmed: false },
    { damageInflictedConfirmed: 1 }
  ])
    assert.throws(() => unnervingPlan(state(), damage, { ...input, ...patch }), /actually inflicted/);
  assert.throws(() => unnervingPlan(state(0), damage, input), /selected quality/);
  const p = unnervingPlan(state(), { ...damage, rawTotal: 0 }, input);
  assert.equal(p.damageType, "stress");
  assert.equal(p.target, input.target);
  assert.equal(p.formula, "2d4");
});
function apply(obj, data) {
  for (const [path, value] of Object.entries(data)) {
    const keys = path.split(".");
    let current = obj;
    for (const key of keys.slice(0, -1)) current = current[key] ??= {};
    const key = keys.at(-1);
    if (key.startsWith("-=")) delete current[key.slice(2)];
    else current[key] = value;
  }
}
let fail = false,
  posts = 0;
globalThis.Actor = class {
  constructor() {
    this.type = "agent";
    this.uuid = "Actor.unnerving";
    this.isOwner = true;
    this.items = [];
    this.system = state();
  }
  getRollData() {
    return {};
  }
  async update(data) {
    apply(this, data);
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, settings: { get: () => [] }, i18n: { localize: s => s } };
globalThis.ui = { notifications: { warn: () => null } };
globalThis.foundry = {
  utils: { escapeHTML: s => String(s) },
  applications: { api: { DialogV2: { input: async () => null } } }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
const message = () => ({
  uuid: "ChatMessage.damage",
  flags: { spycraft2: { ...damage } },
  async update(data) {
    apply(this, data);
  }
});
const actor = () => {
  const a = new SpycraftActor();
  a.rollCheck = async (formula, data, options) => {
    if (fail) throw Error("post failed");
    posts++;
    return { formula, data, options };
  };
  return a;
};
test("the actor records separate typed stress, links its parent, prevents recursion/repetition and keeps ordinary dice untouched", async () => {
  fail = false;
  const a = actor(),
    m = message(),
    r = await a.resolveUnnerving(m, input);
  assert.equal(r.formula, "2d4");
  assert.equal(r.options.unnervingStress.parentMessageUuid, m.uuid);
  assert.equal(r.options.unnervingStress.damageType, "stress");
  assert.equal(r.options.checkKind, "damage");
  assert.equal(r.options.unarmed, true);
  assert.equal(m.flags.spycraft2.unnerving.recorded, true);
  assert.equal(await a.resolveUnnerving(m, input), null);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(unnervingEligible(a.system, { ...damage, unnervingStress: r.options.unnervingStress }), false);
});
test("concurrent resolution records the added stress once; posting failure restores eligibility and cancellation spends nothing", async () => {
  fail = false;
  posts = 0;
  const a = actor(),
    m = message();
  assert.equal(await a.resolveUnnerving(m), null);
  assert.equal(m.flags.spycraft2.unnerving, undefined);
  fail = true;
  await assert.rejects(a.resolveUnnerving(m, input), /post failed/);
  assert.equal(m.flags.spycraft2.unnerving, undefined);
  fail = false;
  const results = await Promise.allSettled([a.resolveUnnerving(m, input), a.resolveUnnerving(m, input)]);
  assert.equal(results.filter(s => s.status === "fulfilled" && s.value).length, 1);
  assert.equal(posts, 1);
  assert.equal(a.system.actionDice.value, 0);
});
test("ownership, source loss during the queued operation, a different acting character and unconfirmed damage cannot grant stress", async () => {
  fail = false;
  const a = actor(),
    m = message();
  a.isOwner = false;
  await assert.rejects(a.resolveUnnerving(m, input), /owned visible/);
  a.isOwner = true;
  m.flags.spycraft2.actorUuid = "Other";
  await assert.rejects(a.resolveUnnerving(m, input), /owned visible/);
  m.flags.spycraft2.actorUuid = a.uuid;
  await assert.rejects(a.resolveUnnerving(m, { ...input, damageInflictedConfirmed: false }), /actually inflicted/);
  let resume;
  a._actionDieQueue = new Promise(resolve => (resume = resolve));
  const pending = a.resolveUnnerving(m, input);
  a.system.originEffects = [];
  resume();
  await assert.rejects(pending, /selected quality/);
  assert.equal(m.flags.spycraft2.unnerving, undefined);
});
test("the ordinary damage entry preserves the actual weapon identity and proficiency for the later Unnerving check", async () => {
  const a = actor();
  a.system = {
    ...a.system,
    abilities: { str: { mod: 1 }, dex: { mod: 0 } },
    unarmed: { die: 3, extraDice: 0, damageBonus: 1 },
    proficiencyTotals: { unarmed: { proficient: true } }
  };
  a.weaponAttack = () => ({ range: 0 });
  const weapon = {
    uuid: "Actor.unnerving.Item.fist",
    name: "Fist",
    system: { proficiency: "unarmed", damage: "1d3", qualities: "" }
  };
  const r = await a.rollDamage(weapon, { includeSneakAttack: false });
  assert.equal(r.options.weaponUuid, weapon.uuid);
  assert.equal(r.options.weaponProficiency, "unarmed");
  assert.equal(r.options.unarmed, true);
  assert.equal(r.options.unnervingAvailableGrade, 2);
});
