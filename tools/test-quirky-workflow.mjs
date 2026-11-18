import test from "node:test";
import assert from "node:assert/strict";
import { weaponAttack, weaponDamage } from "../module/rules/gear.mjs";
import { validateQuirkyWeaponProof as validate } from "../module/rules/quirky-weapon.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
const system = (trained = true) => ({
    size: "Medium",
    bab: 3,
    classLevels: {},
    conditionContext: {},
    abilities: { str: { value: 14, mod: 2 }, dex: { value: 14, mod: 2 }, int: { value: 12, mod: 1 } },
    proficiencyTotals: {
      handgun: { proficient: trained },
      rifle: { proficient: true },
      tactical: { proficient: false },
      indirectFire: { proficient: true }
    },
    activeFeatNames: [],
    actionDice: { value: 0 },
    vitality: { value: 4 },
    wounds: { value: 4 }
  }),
  weapon = (qualities = "QKY") => ({
    id: "gun",
    proficiency: "handgun",
    weaponCategory: "holdoutPistol",
    untrainedPenalty: -6,
    sizeHands: "F/1h",
    equipped: true,
    carried: true,
    quantity: 1,
    qualities,
    error: 2,
    threat: 19,
    damage: "3d4+1",
    range: 10,
    recoil: 0,
    fireModes: ["single"],
    fireMode: "single"
  }),
  attack = (s = system(), w = weapon(), opts = {}) =>
    weaponAttack(s, w, cfg, "agent", { attackAction: "standard", ...opts });
function sourceActor(w = weapon(), s = system()) {
  const item = { id: w.id, uuid: "Actor.quirky.Item.gun", type: "weapon", system: w },
    items = [item];
  items.get = id => items.find(i => i.id === id);
  return { type: "agent", system: s, items };
}
test("live attacks apply QKY once independently of INA/recoil, with no damage/error/threat/range/Initiative change", () => {
  for (const trained of [false, true]) {
    const s = system(trained),
      w = weapon("QKY, INA (−3), IMP"),
      a = attack(s, { ...w, recoil: 25 }),
      b = attack(s, { ...w, qualities: "INA (−3), IMP", recoil: 25 });
    assert.equal(a.total, b.total - (trained ? 0 : 4));
    assert.equal(a.total, trained ? 1 : -9);
    assert.equal(a.quirky.baseUntrainedPenalty, -6);
    assert.equal(a.quirky.attackPenalty, trained ? 0 : -10);
    for (const k of ["error", "threat", "range", "initiativeLoss"]) assert.equal(a[k], b[k]);
    for (const k of ["formula", "bonus", "min", "expression"])
      assert.equal(weaponDamage(s, w)[k], weaponDamage(s, { ...w, qualities: "INA (−3), IMP" })[k]);
    if (!trained) assert.match(a.notes, /Quirky.*base.*-6.*total -10/);
  }
  assert.equal(attack(system(false), weapon("TRO, QKY")).blocked, true);
  assert.equal(attack(system(), { ...weapon(), untrainedPenalty: "-6" }).blocked, true);
  const npc = weaponAttack(system(false), weapon(), cfg, "npc");
  assert.equal(npc.quirky.attackPenalty, 0);
});
test("launcher profiles replace stored base penalty before QKY and derive actual direct/indirect training", () => {
  for (const directTrained of [false, true])
    for (const indirectTrained of [false, true])
      for (const indirectFire of [false, true]) {
        const s = system();
        s.proficiencyTotals.tactical.proficient = directTrained;
        s.proficiencyTotals.indirectFire.proficient = indirectTrained;
        const w = { ...weapon(), proficiency: "tactical", weaponCategory: "grenadeLauncher", untrainedPenalty: -99 },
          a = attack(s, w, { indirectFire }),
          trained = indirectFire ? indirectTrained : directTrained;
        assert.equal(a.quirky.baseUntrainedPenalty, indirectFire ? -10 : -6);
        assert.equal(a.quirky.attackPenalty, trained ? 0 : indirectFire ? -14 : -10);
        const actor = sourceActor(w, s),
          c = {
            checkKind: "attack",
            weaponProficiency: a.proficiency,
            attackContext: { launcherOperation: a.launcherOperation }
          };
        validate(actor, a.quirky, c);
        s.proficiencyTotals[a.proficiency].proficient = !trained;
        assert.throws(() => validate(actor, a.quirky, c), /changed/);
      }
});
test("owned proofs reject changed quality, actual training, base penalty, source identity, mode and forged evidence", () => {
  const a = sourceActor(),
    p = attack(a.system, a.items[0].system).quirky,
    c = { checkKind: "attack", weaponProficiency: "handgun", weaponUuid: a.items[0].uuid, attackContext: {} };
  validate(a, p, c);
  validate(a, Object.fromEntries(Object.entries(p).reverse()), c);
  for (const [key, value] of [
    ["qualities", ""],
    ["untrainedPenalty", -4],
    ["proficiency", "rifle"],
    ["weaponCategory", "servicePistol"]
  ]) {
    const old = a.items[0].system[key];
    a.items[0].system[key] = value;
    assert.throws(() => validate(a, p, c), /changed/);
    a.items[0].system[key] = old;
  }
  assert.throws(() => validate(a, { ...p, attackPenalty: 99 }, c), /changed/);
  assert.throws(() => validate(a, p, { ...c, weaponUuid: "Other.Item" }), /changed/);
  assert.throws(() => validate(a, p, { ...c, checkKind: "damage" }), /changed/);
  a.items.splice(0, 1);
  assert.throws(() => validate(a, p, c), /owned.*changed/);
  validate(a, null, c);
});
test("proof captures zero-source cases and immutable evidence keeps legacy absent markers compatible", () => {
  const c = { checkKind: "attack", attackContext: { quirky: attack(system(false), weapon("")).quirky } },
    e = rollEvidence(c);
  assert.equal(rollEvidenceMatches(e, c), true);
  for (const k of Object.keys(c.attackContext.quirky)) {
    const n = structuredClone(c);
    n.attackContext.quirky[k] = "changed";
    assert.equal(rollEvidenceMatches(e, n), false, k);
  }
  const old = { ...c, attackContext: {} };
  assert.equal(rollEvidenceMatches(rollEvidence(old), old), true);
  assert.equal(rollEvidenceMatches(e, old), false);
  assert.equal(rollEvidenceMatches(rollEvidence(old), c), false);
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
function actor(trained = false, qualities = "QKY") {
  const a = makeFatigueActor();
  a.system = system(trained);
  a.flags = {};
  a.uuid = "Actor.quirky";
  a.items = [
    { id: "gun", uuid: "Actor.quirky.Item.gun", name: "Actual owned gun", type: "weapon", system: weapon(qualities) }
  ];
  a.items.get = id => a.items.find(i => i.id === id);
  a.getRollData = () => ({});
  Object.defineProperty(a, "participatingCombat", { value: null });
  return a;
}
test("actual Actor posts exact penalty evidence from its owned weapon despite fabricated inputs", async () => {
  const a = actor();
  posts = [];
  hook = async () => {};
  const m = await a.rollAttack(a.items[0], { attackAction: "standard", quirky: { attackPenalty: 99 }, trained: true });
  assert.equal(m.flags.spycraft2.attackContext.quirky.weaponId, "gun");
  assert.equal(m.flags.spycraft2.attackContext.quirky.attackPenalty, -10);
  assert.equal(m.flags.spycraft2.attackContext.trained, false);
  assert.equal(m.flags.spycraft2.rawTotal, 7);
});
test("actual RNG guards reject QKY/training gains and losses, base/profile/source changes without posting", async () => {
  for (const change of [
    "qualityGain",
    "qualityLoss",
    "trainingGain",
    "trainingLoss",
    "base",
    "proficiency",
    "category",
    "removed"
  ]) {
    const a = actor(change === "trainingLoss", change === "qualityGain" ? "" : "QKY");
    posts = [];
    hook = async () => {
      const w = a.items[0];
      if (change === "qualityGain") w.system.qualities = "QKY";
      if (change === "qualityLoss") w.system.qualities = "";
      if (change === "trainingGain") a.system.proficiencyTotals.handgun.proficient = true;
      if (change === "trainingLoss") a.system.proficiencyTotals.handgun.proficient = false;
      if (change === "base") w.system.untrainedPenalty = -4;
      if (change === "proficiency") w.system.proficiency = "rifle";
      if (change === "category") w.system.weaponCategory = "servicePistol";
      if (change === "removed") a.items.splice(0, 1);
    };
    await assert.rejects(a.rollAttack(a.items[0], { attackAction: "standard" }), /changed|no longer exists/);
    assert.equal(posts.length, 0, change);
  }
  hook = async () => {};
});
test("replacement validates before RNG and again before posting without original closures, while provisional destruction remains replaceable", async () => {
  const a = actor(),
    proof = a.weaponAttack(a.items[0]).quirky,
    c = { checkKind: "attack", weaponProficiency: "handgun", attackContext: { quirky: proof } };
  a.items[0].system.untrainedPenalty = -4;
  rolls = 0;
  await assert.rejects(a.rollCheck("1d20", {}, c), /changed/);
  assert.equal(rolls, 0);
  a.items[0].system.untrainedPenalty = -6;
  posts = [];
  hook = async () => (a.items[0].system.untrainedPenalty = -4);
  await assert.rejects(a.rollCheck("1d20", {}, c), /changed/);
  assert.equal(posts.length, 0);
  hook = async () => {};
  a.items[0].system.untrainedPenalty = -6;
  a.items[0].system.destroyed = true;
  validate(a, proof, c);
});
