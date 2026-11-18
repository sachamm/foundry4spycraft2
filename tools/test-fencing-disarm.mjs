import test from "node:test";
import assert from "node:assert/strict";
import { readiedMeleeWeapons } from "../module/rules/readied-weapons.mjs";
import { readiedDisarmWeapons } from "../module/rules/disarm-response.mjs";
import { fencingDisarmPlan as plan, validateFencingDisarmProof as validate } from "../module/rules/fencing-disarm.mjs";
import { weaponAttack } from "../module/rules/gear.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
const sword = (id = "blade", patch = {}) => ({
    id,
    uuid: "Actor.fencing.Item." + id,
    name: "Reviewed sword",
    type: "weapon",
    system: {
      meleeFamily: "oneHandedSword",
      proficiency: "edged",
      sizeHands: "T/1h",
      qualities: "FIN",
      equipped: true,
      carried: true,
      quantity: 1,
      error: 1,
      threat: 20,
      damage: "1d6",
      range: 0,
      ...patch
    }
  }),
  state = (names = ["Fencing Basics"]) => ({
    size: "Medium",
    bab: 3,
    classLevels: {},
    abilities: { str: { value: 14, mod: 2 }, dex: { value: 14, mod: 2 } },
    activeFeatNames: names,
    proficiencyTotals: { edged: { proficient: true } },
    conditionContext: {},
    actionDice: { value: 0 },
    vitality: { value: 4 },
    wounds: { value: 4 }
  }),
  prep = (s, items) => ({
    ...s,
    readiedMeleeWeapons: readiedMeleeWeapons(s, items),
    disarmWeapons: readiedDisarmWeapons(s, items)
  }),
  attackContext = {
    confirmed: true,
    lineOfSightConfirmed: true,
    rangeConfirmed: true,
    opponentArmedConfirmed: true,
    opponentWeaponSize: "Tiny",
    opponentLabel: "Opponent"
  };
const attack = (s, items, role = "attacker") =>
  weaponAttack(prep(s, items), { ...items[0].system, id: items[0].id }, cfg, "agent", {
    attackAction: "standard",
    disarm:
      role === "attacker"
        ? attackContext
        : {
            ...attackContext,
            role: "defender",
            targetWeaponId: items[0].id,
            incomingRanged: false,
            incomingProficient: true
          }
  });
test("Fencing requires current qualification, actual one-handed sword classification and effective FIN, never an editable name", () => {
  for (const active of [false, true])
    for (const family of ["", "axe", "oneHandedSword"])
      for (const qualities of ["", "FIN"]) {
        const s = state(active ? ["Fencing Basics"] : []),
          items = [sword("blade", { meleeFamily: family, qualities })];
        assert.equal(
          plan(prep(s, items))?.gearBonus ?? 0,
          active && family === "oneHandedSword" && qualities === "FIN" ? 2 : 0
        );
      }
  for (const patch of [
    { sizeHands: "M/2h" },
    { proficiency: "hurled" },
    { equipped: false },
    { destroyed: true },
    { carried: false },
    { reserve: true },
    { quantity: 0 }
  ])
    assert.equal(plan(prep(state(), [sword("blade", patch)])), null);
  assert.equal(plan(prep(state(), [sword("blade", { useHands: 2 })])).gearBonus, 2);
  assert.equal(plan(prep({ ...state(), size: "Small" }, [sword()])).gearBonus, 2);
});
test("actual Finesse Basics optional FIN grant qualifies only while the grant source and weapon choice remain active", () => {
  for (const hasBasics of [false, true])
    for (const grantFinesse of [false, true]) {
      const s = state(["Fencing Basics", ...(hasBasics ? ["Finesse Basics"] : [])]),
        items = [sword("blade", { qualities: "", grantFinesse })];
      assert.equal(plan(prep(s, items))?.gearBonus ?? 0, hasBasics && grantFinesse ? 2 : 0);
    }
});
test("both opposed melee Disarm roles gain +2 once; SUR3 and Axe1 compete, while ranged/ordinary attacks get no Fencing benefit", () => {
  const s = state(["Fencing Basics", "Axe Basics"]),
    items = [sword(), { ...sword("axe", { meleeFamily: "axe", qualities: "" }), name: "Actual axe" }];
  for (const role of ["attacker", "defender"]) {
    let a = attack(s, items, role);
    assert.equal(a.disarm.fencingBasics.gearBonus, 2);
    assert.equal(a.disarm.attackBonus, 2);
    a = attack(s, [sword("blade", { qualities: "FIN, SUR" }), items[1]], role);
    assert.equal(a.disarm.attackBonus, role === "defender" ? 3 : 2);
  }
  const i = [sword(), sword("second")];
  assert.equal(plan(prep(state(), i)).gearBonus, 2);
  assert.equal(plan(prep(state(), i)).weapons.length, 2);
  assert.equal(plan(prep(state(), i), { ranged: true }), null);
  assert.equal(weaponAttack(prep(s, items), items[0].system, cfg).disarm.active, false);
  assert.throws(() => plan(prep(state(), [sword(), sword("other", { useHands: 2 })])), /two hands/);
});
test("owned validation catches source loss/gain, family, intrinsic/optional FIN and grip changes, including zero-source proofs", () => {
  const items = [sword()],
    a = { type: "agent", items, system: state() },
    c = { checkKind: "attack", weaponProficiency: "edged" };
  items.get = id => items.find(w => w.id === id);
  const proof = attack(a.system, items).disarm;
  validate(a, proof, c);
  for (const [key, value] of [
    ["qualities", ""],
    ["meleeFamily", "axe"],
    ["useHands", 2],
    ["equipped", false]
  ]) {
    const old = items[0].system[key];
    items[0].system[key] = value;
    assert.throws(() => validate(a, proof, c), /changed/);
    items[0].system[key] = old;
  }
  a.system.activeFeatNames = [];
  assert.throws(() => validate(a, proof, c), /changed/);
  const zero = attack(a.system, items).disarm;
  a.system.activeFeatNames = ["Fencing Basics"];
  assert.throws(() => validate(a, zero, c), /changed/);
  validate(a, { active: true }, c);
});
const { makeFatigueActor } = await import("./fixtures/fatigue-actor.mjs");
foundry.utils.escapeHTML = String;
globalThis.ChatMessage = { getSpeaker: () => ({}) };
let hook = async () => {},
  posts = [],
  rolls = 0;
globalThis.Roll = class {
  constructor(_f, data) {
    this.total = 12 + (data.total ?? 0);
    this.dice = [{ total: 12 }];
  }
  async evaluate() {
    rolls++;
    await hook();
    return this;
  }
  async toMessage(d) {
    posts.push(d);
    return d;
  }
};
function actor(names = ["Fencing Basics"]) {
  const a = makeFatigueActor();
  a.items = [sword()];
  a.items.get = id => a.items.find(w => w.id === id);
  a.system = prep(state(names), a.items);
  a.flags = {};
  a.uuid = "Actor.fencing";
  a.getRollData = () => ({});
  Object.defineProperty(a, "participatingCombat", { value: null });
  return a;
}
test("actual Actor posts the Fencing source in immutable Disarm evidence and ignores fabricated bonus payloads", async () => {
  const a = actor();
  hook = async () => {};
  const m = await a.rollAttack(a.items[0], {
    attackAction: "standard",
    disarm: { ...attackContext, fencingBasics: { gearBonus: 99 } }
  });
  assert.equal(m.flags.spycraft2.attackContext.disarm.fencingBasics.gearBonus, 2);
  assert.equal(m.flags.spycraft2.rollData.total, 7);
  const e = rollEvidence(m.flags.spycraft2),
    copy = structuredClone(m.flags.spycraft2);
  copy.attackContext.disarm.fencingBasics.gearBonus = 99;
  assert.equal(rollEvidenceMatches(e, copy), false);
});
test("actual RNG source/quality/family/grip changes post nothing and direct replacements validate before RNG", async () => {
  for (const change of ["feat", "quality", "family", "grip"]) {
    const a = actor();
    posts = [];
    hook = async () => {
      if (change === "feat") a.system.activeFeatNames = [];
      if (change === "quality") a.items[0].system.qualities = "";
      if (change === "family") a.items[0].system.meleeFamily = "axe";
      if (change === "grip") a.items[0].system.useHands = 2;
    };
    await assert.rejects(a.rollAttack(a.items[0], { attackAction: "standard", disarm: attackContext }), /changed/);
    assert.equal(posts.length, 0, change);
  }
  hook = async () => {};
  const a = actor(),
    proof = attack(a.system, a.items).disarm;
  a.items[0].system.qualities = "";
  rolls = 0;
  await assert.rejects(
    a.rollCheck("1d20", {}, { checkKind: "attack", weaponProficiency: "edged", attackContext: { disarm: proof } }),
    /changed/
  );
  assert.equal(rolls, 0);
});

test("Fencing remains available for an authentic provisional improvised replacement without restoring inventory first", async () => {
  const previous = globalThis.fromUuidSync;
  try {
    const a = actor(),
      w = a.items[0];
    w.system.improvised = true;
    a.system = prep(a.system, a.items);
    const disarm = attack(a.system, a.items).disarm,
      original = {
        uuid: "ChatMessage.fencingError",
        flags: {
          spycraft2: {
            actorUuid: a.uuid,
            weaponUuid: w.uuid,
            checkKind: "attack",
            improvised: true,
            errorConfirmed: true,
            attackContext: { disarm }
          }
        }
      };
    globalThis.fromUuidSync = id => (id === original.uuid ? original : null);
    w.system.destroyed = true;
    w.system.destroyedByRoll = original.uuid;
    a.system = prep(a.system, a.items);
    hook = async () => {};
    posts = [];
    await a.rollCheck(
      "1d20",
      {},
      {
        checkKind: "attack",
        weaponProficiency: "edged",
        weaponUuid: w.uuid,
        rerollOf: original.uuid,
        attackContext: { disarm, hands: 1, attackAction: "standard" }
      }
    );
    assert.equal(posts.length, 1);
    assert.equal(w.system.destroyed, true);
    original.flags.spycraft2.actorUuid = "Actor.foreign";
    await assert.rejects(
      a.rollCheck(
        "1d20",
        {},
        {
          checkKind: "attack",
          weaponProficiency: "edged",
          weaponUuid: w.uuid,
          rerollOf: original.uuid,
          attackContext: { disarm, hands: 1, attackAction: "standard" }
        }
      ),
      /changed/
    );
  } finally {
    globalThis.fromUuidSync = previous;
  }
});
test("Fencing native local-ID evidence remains valid against live Items, with no relaxation for a forged explicit UUID", async () => {
  const a = actor();
  a.system.readiedMeleeWeapons.forEach(w => (w.uuid = null));
  a.system.disarmWeapons.weapons.forEach(w => (w.uuid = null));
  hook = async () => {};
  const m = await a.rollAttack(a.items[0], { attackAction: "standard", disarm: attackContext });
  assert.equal(m.flags.spycraft2.attackContext.disarm.fencingBasics.weapons[0].uuid, null);
  const proof = structuredClone(m.flags.spycraft2.attackContext.disarm);
  proof.fencingBasics.weapons[0].uuid = "Actor.foreign.Item.blade";
  assert.throws(() => validate(a, proof, { checkKind: "attack", weaponProficiency: "edged" }), /changed/);
});
