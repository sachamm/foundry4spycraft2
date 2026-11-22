import test from "node:test";
import assert from "node:assert/strict";
import {
  quickRangedAimContent as content,
  quickRangedAimInput as input
} from "../module/apps/standard-attack-context.mjs";
test("quick ranged Aim/action controls preserve explicit choices, use one field each and default to a Standard Attack", () => {
  const plain = content(),
    selected = content({ attackAction: "standard", aimed: true });
  assert.equal((plain.match(/name="aimed"/g) ?? []).length, 1);
  assert.equal((plain.match(/name="attackAction"/g) ?? []).length, 1);
  assert.match(plain, /value="standard" selected/);
  assert.match(content({ attackAction: "other" }), /value="other" selected/);
  assert.match(selected, /value="standard" selected/);
  assert.match(selected, /name="aimed" type="checkbox" checked/);
  assert.match(selected, /already taken separately/);
  assert.match(content({ attackAction: "autofire" }), /value="autofire" selected/);
});
test("input accepts only actual checkbox/action declarations, ignores bonus payloads and preserves missing legacy fields", () => {
  assert.deepEqual(input({ aimed: true, attackAction: "standard", trained: true, accurized: { bonus: 99 } }), {
    aimed: true,
    attackAction: "standard"
  });
  assert.deepEqual(input({ targetAnimal: false }), {});
  assert.deepEqual(input({ aimed: false }), { aimed: false });
  for (const aimed of ["true", 1, null, {}, []]) assert.throws(() => input({ aimed }), /Aim/);
  for (const attackAction of ["unknown", "", null, 1, true]) assert.throws(() => input({ attackAction }), /action/);
});
const { makeFatigueActor } = await import("./fixtures/fatigue-actor.mjs");
foundry.utils.escapeHTML = String;
globalThis.ChatMessage = { getSpeaker: () => ({}) };
let reply = {},
  captured = "",
  posts = [];
foundry.applications.api.DialogV2.input = async o => {
  captured = o.content;
  return reply;
};
globalThis.Roll = class {
  constructor(_f, data) {
    this.total = 12 + (data.total ?? 0);
    this.dice = [{ total: 12 }];
  }
  async evaluate() {
    return this;
  }
  async toMessage(d) {
    posts.push(d);
    return d;
  }
};
function actor({ trained = true, melee = false, cqb = false } = {}) {
  const a = makeFatigueActor();
  a.system = {
    size: "Medium",
    bab: 3,
    abilities: { str: { value: 14, mod: 2 }, dex: { value: 14, mod: 2 } },
    conditionContext: {},
    classLevels: {},
    activeFeatNames: cqb ? ["CQB Basics"] : [],
    proficiencyTotals: { rifle: { proficient: trained }, edged: { proficient: true } },
    actionDice: { value: 0 },
    vitality: { value: 4 },
    wounds: { value: 4 }
  };
  a.flags = {};
  a.items = [
    {
      id: "weapon",
      uuid: "Actor.fatigue.Item.weapon",
      name: "Actual owned weapon",
      type: "weapon",
      system: {
        proficiency: melee ? "edged" : "rifle",
        weaponCategory: melee ? "other" : "boltActionRifle",
        qualities: melee ? "" : "ACC",
        equipped: true,
        carried: true,
        quantity: 1,
        sizeHands: melee ? "S/1h" : "S/2h",
        range: melee ? 0 : 100,
        recoil: 0,
        fireModes: ["single"],
        fireMode: "single",
        error: 1,
        threat: 20,
        damage: "1d6"
      }
    }
  ];
  a.items.get = id => a.items.find(i => i.id === id);
  a.getRollData = () => ({});
  Object.defineProperty(a, "participatingCombat", { value: null });
  return a;
}
test("actual quick controller applies selected valid Aim and Standard Attack to both ordinary Aim math and ACC threat, with current training authoritative", async () => {
  for (const [trained, aimed, threat, aimBonus] of [
    [true, true, 19, 1],
    [true, false, 20, 0],
    [false, true, 20, 1]
  ]) {
    const a = actor({ trained });
    reply = { aimed, attackAction: "standard", targetAnimal: false };
    posts = [];
    const m = await a.rollAttack(a.items[0], { askContext: true, trained: true });
    assert.equal(m.flags.spycraft2.threat, threat);
    assert.equal(m.flags.spycraft2.attackContext.aimBonus, aimBonus);
    assert.equal(m.flags.spycraft2.attackContext.accurized.trained, trained);
    assert.equal(m.flags.spycraft2.attackContext.attackAction, "standard");
    assert.equal((captured.match(/name="aimed"/g) ?? []).length, 1);
    if (!trained) assert.match(m.flags.spycraft2.baseFlavor, /Untrained Aim takes a full action/);
  }
});
test("missing legacy dialog fields retain already-declared Aim/action and malformed new input posts nothing", async () => {
  let a = actor();
  reply = { targetAnimal: false };
  const m = await a.rollAttack(a.items[0], { askContext: true, aimed: true, attackAction: "standard" });
  assert.equal(m.flags.spycraft2.threat, 19);
  assert.equal(m.flags.spycraft2.attackContext.aimBonus, 1);
  assert.match(captured, /name="aimed" type="checkbox" checked/);
  for (const patch of [
    { aimed: "true", attackAction: "standard" },
    { aimed: true, attackAction: "bad" }
  ]) {
    a = actor();
    reply = { targetAnimal: false, ...patch };
    posts = [];
    await assert.rejects(a.rollAttack(a.items[0], { askContext: true }), /Aim|action/);
    assert.equal(posts.length, 0);
  }
});
test("quick ranged controls coexist once with CQB distance/target declarations and still use current range math", async () => {
  const a = actor({ cqb: true });
  reply = { aimed: true, attackAction: "standard", distanceFeet: "20", targetAnimal: false };
  const m = await a.rollAttack(a.items[0], { askContext: true });
  assert.equal(m.flags.spycraft2.threat, 19);
  assert.equal(m.flags.spycraft2.attackContext.rangeKnown, true);
  assert.equal(m.flags.spycraft2.attackContext.distanceFeet, 20);
  for (const name of ["aimed", "attackAction", "distanceFeet"])
    assert.equal((captured.match(new RegExp('name="' + name + '"', "g")) ?? []).length, 1, name);
});
test("melee quick dialogs receive no ranged Aim controls or retained forged checkbox benefit; cancelling ranged setup spends and posts nothing", async () => {
  let a = actor({ melee: true });
  reply = { aimed: true, attackAction: "standard", targetAnimal: false };
  let m = await a.rollAttack(a.items[0], { askContext: true });
  assert.equal(captured.includes('name="aimed"'), false);
  assert.equal(captured.includes('name="attackAction"'), true);
  assert.equal(m.flags.spycraft2.attackContext.attackAction, "standard");
  assert.equal(m.flags.spycraft2.attackContext.aimed, false);
  a = actor();
  reply = null;
  posts = [];
  assert.equal(await a.rollAttack(a.items[0], { askContext: true }), null);
  assert.equal(posts.length, 0);
  assert.equal(a.system.actionDice.value, 0);
});
