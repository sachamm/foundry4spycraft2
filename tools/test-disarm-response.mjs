import test from "node:test";
import assert from "node:assert/strict";
import {
  readiedDisarmWeapons,
  disarmResponsePlan as plan,
  validateDisarmResponseProof as validate
} from "../module/rules/disarm-response.mjs";
import { weaponAttack } from "../module/rules/gear.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { readFileSync } from "node:fs";
export const state = () => ({
  size: "Medium",
  bab: 3,
  abilities: { str: { value: 14, mod: 2 }, dex: { value: 14, mod: 2 } },
  conditionContext: {},
  activeFeatNames: [],
  proficiencyTotals: { edged: { proficient: true }, blunt: { proficient: true }, handgun: { proficient: false } }
});
export const item = (id = "blade", patch = {}) => ({
  id,
  uuid: "Actor.fixture.Item." + id,
  name: id,
  type: "weapon",
  system: {
    proficiency: "edged",
    sizeHands: "T/1h",
    qualities: "SUR",
    equipped: true,
    carried: true,
    quantity: 1,
    error: 1,
    threat: 20,
    damage: "1d6",
    range: 0,
    untrainedPenalty: -4,
    ...patch
  }
});
export const context = (patch = {}) => ({
  role: "defender",
  targetWeaponId: "blade",
  opponentLabel: "Attacker / dagger",
  opponentWeaponSize: "Tiny",
  incomingRanged: false,
  incomingProficient: true,
  confirmed: true,
  rangeConfirmed: true,
  lineOfSightConfirmed: true,
  ...patch
});
export function prepared(items = [item()], s = state()) {
  return { ...s, disarmWeapons: readiedDisarmWeapons(s, items) };
}
const attack = (items = [item()], s = state(), patch = {}) =>
  weaponAttack(prepared(items, s), { ...items[0].system, id: items[0].id }, cfg, "agent", {
    attackAction: "standard",
    disarm: context(patch)
  });
test("SUR grants +3 only to the exact targeted readied weapon response, with no proficiency prerequisite or generic attack benefit", () => {
  for (const trained of [false, true])
    for (const qualities of ["", "SUR", "SUR, SUR", "SURPLUS"]) {
      const s = state();
      s.proficiencyTotals.edged.proficient = trained;
      const a = attack([item("blade", { qualities })], s);
      assert.equal(a.disarm.sureGripBonus, /\bSUR\b/.test(qualities) ? 3 : 0);
      assert.equal(a.disarm.trained, trained);
      const w = { ...item().system, id: "blade" },
        base = weaponAttack(prepared([item()], s), w, cfg, "agent", { attackAction: "standard" });
      assert.equal(base.disarm.active, false);
      assert.equal(a.total - base.total, /\bSUR\b/.test(qualities) ? 3 : 0);
    }
  const a = attack([item("blade", { qualities: "" }), item("other")]);
  assert.equal(a.disarm.sureGripBonus, 0);
  assert.equal(attack([item()], state(), { targetWeaponId: "other" }).blocked, true);
});
test("actual physical readiness, valid grips, quantity, availability and two-hand capacity guard the targeted weapon", () => {
  for (const patch of [
    { equipped: false },
    { carried: false },
    { reserve: true },
    { destroyed: true },
    { quantity: 0 },
    { quantity: 1.5 },
    { ammunitionOnly: true },
    { proficiency: "unarmed" },
    { sizeHands: "unknown" }
  ])
    assert.equal(attack([item("blade", patch)]).blocked, true, JSON.stringify(patch));
  assert.equal(attack([item(), item("other", { sizeHands: "M/2h" })]).blocked, true);
  const s = state();
  s.size = "Small";
  assert.equal(attack([item("blade", { sizeHands: "M/2h" })], s).blocked, true);
  assert.equal(attack([item()], s).disarm.twoHandBonus, 4);
  assert.equal(attack([item("blade", { useHands: 2 })]).disarm.twoHandBonus, 4);
});
test("incoming melee Size and both-hand modifiers remain independent; incoming ranged suppresses Size for either response weapon", () => {
  for (const own of ["T", "S", "M", "L"])
    for (const incomingRanged of [false, true]) {
      const a = attack([item("blade", { sizeHands: own + "/2h" })], state(), { incomingRanged });
      assert.equal(a.disarm.twoHandBonus, 4);
      assert.equal(a.disarm.sizeBonus, incomingRanged ? 0 : 4 * { T: 0, S: 1, M: 2, L: 3 }[own]);
      assert.equal(a.disarm.attackBonus, 7 + a.disarm.sizeBonus);
      assert.equal(a.disarm.shots, 0);
      assert.equal(a.disarm.loseFlatFooted, false);
      assert.equal(a.disarm.loseBonusDisarm, false);
    }
  assert.equal(
    attack([item()], state(), { opponentWeaponSize: "Unarmed", opponentCharacterSize: "Medium" }).disarm.sizeBonus,
    0
  );
  assert.equal(
    attack([item("blade", { sizeHands: "M/1h" })], state(), {
      opponentWeaponSize: "Unarmed",
      opponentCharacterSize: "Medium"
    }).disarm.sizeBonus,
    8
  );
  for (const patch of [
    { opponentWeaponSize: "Unarmed" },
    { opponentWeaponSize: "Unarmed", opponentCharacterSize: "Medium", incomingRanged: true },
    { opponentWeaponSize: "unknown" }
  ])
    assert.equal(attack([item()], state(), patch).blocked, true);
});
test("Expert Disarm is independent and Axe gear competes with SUR instead of adding", () => {
  const s = state();
  s.activeFeatNames = ["Expert Disarm", "Axe Basics"];
  s.readiedMeleeWeapons = [
    { id: "blade", uuid: null, name: "Axe", family: "axe", proficiency: "edged", hands: 1, requiredHands: 1 }
  ];
  let a = attack([item()], s);
  assert.equal(a.disarm.gearBonus, 3);
  assert.equal(a.disarm.expertBonus, 2);
  assert.equal(a.disarm.attackBonus, 5);
  a = attack([item("blade", { qualities: "" })], s);
  assert.equal(a.disarm.gearBonus, 1);
  assert.equal(a.disarm.attackBonus, 3);
});
test("strict incoming declarations block before modifiers, no voluntary attack cost is attached to the response", () => {
  for (const key of ["confirmed", "rangeConfirmed", "lineOfSightConfirmed"])
    for (const value of [false, "true", 1, null])
      assert.equal(attack([item()], state(), { [key]: value }).blocked, true);
  for (const patch of [{ opponentLabel: "" }, { opponentLabel: "x".repeat(161) }, { incomingRanged: "false" }])
    assert.equal(attack([item()], state(), patch).blocked, true);
  assert.equal(plan(state(), item().system, { context: { role: "attacker" } }).active, false);
  assert.match(attack().disarm.actionCost, /Opposed response/);
});
test("all catalog SUR weapons derive from actual quality data and retain source fields", () => {
  const rows = JSON.parse(readFileSync(new URL("../src/data/equipment.json", import.meta.url))).weapons.filter(w =>
    /\bSUR\b/.test(w.qualities)
  );
  assert.equal(rows.length, 5);
  for (const w of rows) {
    const before = structuredClone(w),
      i = item("blade", {
        ...w,
        proficiency: { Blunt: "blunt", Edged: "edged", "Exotic (Edged)": "exoticEdged" }[w.proficiency],
        sizeHands: w.sizeHands,
        equipped: true
      });
    const p = attack([i]);
    assert.equal(p.disarm.sureGripBonus, 3, w.name);
    assert.deepEqual(w, before);
  }
});
test("owned response proof detects target readiness, quality, proficiency, grip and capacity changes; native key order and old absent markers remain compatible", () => {
  const items = [item()],
    s = prepared(items),
    a = { type: "agent", system: s, items };
  items.get = id => items.find(i => i.id === id);
  const p = attack(items, s).disarm,
    c = {
      checkKind: "attack",
      weaponUuid: items[0].uuid,
      weaponProficiency: "edged",
      attackContext: { attackAction: "standard", hands: 1 }
    };
  validate(a, p, c);
  validate(a, Object.fromEntries(Object.entries(p).reverse()), c);
  for (const [key, value] of [
    ["qualities", ""],
    ["equipped", false],
    ["useHands", 2],
    ["sizeHands", "M/1h"]
  ]) {
    const old = items[0].system[key];
    items[0].system[key] = value;
    assert.throws(() => validate(a, p, c), /changed/);
    items[0].system[key] = old;
  }
  items.push(item("extra", { sizeHands: "M/2h" }));
  assert.throws(() => validate(a, p, c), /changed/);
  items.pop();
  s.proficiencyTotals.edged.proficient = false;
  assert.throws(() => validate(a, p, c), /changed/);
  validate(a, null, c);
});

test("the acting attacker’s Proficiency tag affects both checks independently of defender weapon training", () => {
  for (const incomingProficient of [false, true])
    for (const trained of [false, true]) {
      const s = state();
      s.proficiencyTotals.edged.proficient = trained;
      const a = attack([item()], s, { incomingProficient });
      assert.equal(a.error, 1 + (trained ? 0 : 2) + 2 + (incomingProficient ? 0 : 2));
      assert.equal(a.disarm.errorIncrease, 2 + (incomingProficient ? 0 : 2));
    }
  assert.equal(attack([item()], state(), { incomingProficient: "true" }).blocked, true);
});
