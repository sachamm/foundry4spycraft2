import test from "node:test";
import assert from "node:assert/strict";
import { weaponAttack } from "../module/rules/gear.mjs";
import { validateSuperiorAccuracyWeaponProof as validate } from "../module/rules/superior-accuracy-weapon.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
const system = (trained = true) => ({
    size: "Medium",
    bab: 3,
    classLevels: {},
    conditionContext: {},
    abilities: { str: { value: 14, mod: 2 }, dex: { value: 14, mod: 2 } },
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
  weapon = (qualities = "SPA") => ({
    id: "gun",
    proficiency: "handgun",
    weaponCategory: "backupPistol",
    sizeHands: "D/1h",
    equipped: true,
    carried: true,
    quantity: 1,
    qualities,
    error: 1,
    threat: 20,
    damage: "1d6",
    range: 30,
    recoil: 0,
    fireModes: ["single"],
    fireMode: "single"
  }),
  attack = (s = system(), w = weapon(), opts = {}) =>
    weaponAttack(s, w, cfg, "agent", { attackAction: "standard", braced: true, stableSurface: true, ...opts });
test("live threat math uses SPA only with actual training and valid Aim, retains error/damage/range and adds an explicit note", () => {
  for (const trained of [false, true])
    for (const aimed of [false, true])
      for (const qualities of ["", "SPA"]) {
        const a = attack(system(trained), weapon(qualities), { aimed }),
          b = attack(system(trained), weapon(""), { aimed });
        assert.equal(a.threat, 20 - (trained && aimed && qualities === "SPA" ? 1 : 0));
        for (const k of ["total", "error", "range"]) assert.equal(a[k], b[k]);
        assert.equal(a.superiorAccuracy.weaponId, "gun");
        assert.equal(a.superiorAccuracy.operatingProficiency, "handgun");
        if (trained && aimed && qualities === "SPA") assert.match(a.notes, /Superior Accuracy/);
      }
  assert.equal(attack(system(), weapon("SPA, INA (-1)"), { aimed: true }).blocked, true);
});
test("SPA stacks once with the existing Sharpshooter threat benefit, respects the minimum and never invents a threat for no-threat weapons", () => {
  const s = system();
  s.activeFeatNames = ["Sharpshooter Supremacy"];
  assert.equal(attack(s, weapon(), { aimed: true }).threat, 17);
  assert.equal(attack(s, weapon(""), { aimed: true }).threat, 18);
  assert.equal(attack(s, { ...weapon(), threat: 1 }, { aimed: true }).threat, 1);
  assert.equal(attack(s, { ...weapon(), threat: 0 }, { aimed: true }).threat, 0);
});
function sourceActor(w = weapon(), s = system()) {
  const item = { id: w.id, name: "Actual weapon", type: "weapon", system: w },
    items = [item];
  items.get = id => items.find(i => i.id === id);
  return { type: "agent", system: s, items };
}
test("actual source validation binds the owned Item and derives launcher-mode proficiency rather than trusting a training flag", () => {
  const a = sourceActor(),
    p = attack(a.system, a.items[0].system, { aimed: true }).superiorAccuracy,
    c = { checkKind: "attack", weaponProficiency: "handgun", attackContext: { aimed: true, braced: true } };
  validate(a, p, c);
  assert.throws(() => validate(a, p, { ...c, weaponUuid: "Other.Item" }), /changed/);
  a.system.proficiencyTotals.handgun.proficient = false;
  assert.throws(() => validate(a, p, c), /changed/);
  a.system.proficiencyTotals.handgun.proficient = true;
  assert.throws(() => validate(a, p, { ...c, weaponProficiency: "rifle" }), /changed/);
  const gl = sourceActor({ ...weapon(), proficiency: "tactical", weaponCategory: "grenadeLauncher" }),
    r = attack(gl.system, gl.items[0].system, { aimed: true, indirectFire: true }),
    gc = {
      checkKind: "attack",
      weaponProficiency: "indirectFire",
      attackContext: { aimed: true, braced: true, launcherOperation: r.launcherOperation }
    };
  assert.equal(r.superiorAccuracy.sourceProficiency, "tactical");
  assert.equal(r.superiorAccuracy.operatingProficiency, "indirectFire");
  assert.equal(r.superiorAccuracy.trained, true);
  validate(gl, r.superiorAccuracy, gc);
  gl.system.proficiencyTotals.indirectFire.proficient = false;
  gl.system.proficiencyTotals.tactical.proficient = true;
  assert.throws(() => validate(gl, r.superiorAccuracy, gc), /changed/);
  validate(a, null, c);
});
test("optional attack evidence rejects late SPA additions/removals/changes and keeps old absent markers compatible", () => {
  const c = {
      checkKind: "attack",
      attackContext: { superiorAccuracy: attack(system(), weapon(), { aimed: true }).superiorAccuracy }
    },
    e = rollEvidence(c);
  assert.equal(rollEvidenceMatches(e, c), true);
  const old = { ...c, attackContext: {} };
  assert.equal(rollEvidenceMatches(rollEvidence(old), old), true);
  assert.equal(rollEvidenceMatches(rollEvidence(old), c), false);
  assert.equal(rollEvidenceMatches(e, old), false);
  for (const k of Object.keys(c.attackContext.superiorAccuracy)) {
    const n = structuredClone(c);
    n.attackContext.superiorAccuracy[k] = "changed";
    assert.equal(rollEvidenceMatches(e, n), false, k);
  }
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
function actor(trained = true, qualities = "SPA") {
  const a = makeFatigueActor();
  a.system = system(trained);
  a.flags = {};
  a.uuid = "Actor.superiorAccuracy";
  a.items = [
    {
      id: "gun",
      uuid: "Actor.superiorAccuracy.Item.gun",
      name: "Actual owned gun",
      type: "weapon",
      system: weapon(qualities)
    }
  ];
  a.items.get = id => a.items.find(i => i.id === id);
  a.getRollData = () => ({});
  Object.defineProperty(a, "participatingCombat", { value: null });
  return a;
}
test("actual Actor stores current weapon identity, training, Aim and the adjusted threat while ignoring fabricated source payloads", async () => {
  const a = actor();
  posts = [];
  hook = async () => {};
  const m = await a.rollAttack(a.items[0], {
    attackAction: "standard",
    braced: true,
    stableSurface: true,
    aimed: true,
    superiorAccuracy: { threatIncrease: 99 },
    trained: true
  });
  assert.equal(m.flags.spycraft2.threat, 19);
  assert.equal(m.flags.spycraft2.attackContext.superiorAccuracy.weaponId, "gun");
  assert.equal(m.flags.spycraft2.attackContext.superiorAccuracy.threatIncrease, 1);
  assert.equal(m.flags.spycraft2.attackContext.superiorAccuracy.trained, true);
  assert.equal(m.flags.spycraft2.attackContext.superiorAccuracy.aimed, true);
});
test("actual RNG quality/proficiency gains/losses, source proficiency/category and owned-weapon removal reject without posting", async () => {
  for (const change of [
    "qualityGain",
    "qualityLoss",
    "trainingGain",
    "trainingLoss",
    "proficiency",
    "category",
    "removed"
  ]) {
    const a = actor(change !== "trainingGain", change === "qualityGain" ? "" : "SPA");
    posts = [];
    hook = async () => {
      const w = a.items[0];
      if (change === "qualityGain") w.system.qualities = "SPA";
      if (change === "qualityLoss") w.system.qualities = "";
      if (change === "trainingGain") a.system.proficiencyTotals.handgun.proficient = true;
      if (change === "trainingLoss") a.system.proficiencyTotals.handgun.proficient = false;
      if (change === "proficiency") w.system.proficiency = "rifle";
      if (change === "category") w.system.weaponCategory = "assaultRifle";
      if (change === "removed") a.items.splice(0, 1);
    };
    await assert.rejects(
      a.rollAttack(a.items[0], { attackAction: "standard", braced: true, stableSurface: true, aimed: true }),
      /changed|no longer exists/
    );
    assert.equal(posts.length, 0, change);
  }
  hook = async () => {};
});
test("replacement and direct pre/post RNG source guards work without controller closures, including a changed Aim declaration", async () => {
  const a = actor(),
    proof = a.weaponAttack(a.items[0], {
      attackAction: "standard",
      braced: true,
      stableSurface: true,
      aimed: true
    }).superiorAccuracy,
    c = {
      checkKind: "attack",
      weaponProficiency: "handgun",
      attackContext: { aimed: true, braced: true, superiorAccuracy: proof }
    };
  a.system.proficiencyTotals.handgun.proficient = false;
  rolls = 0;
  await assert.rejects(a.rollCheck("1d20", {}, c), /changed/);
  assert.equal(rolls, 0);
  a.system.proficiencyTotals.handgun.proficient = true;
  const request = structuredClone(c);
  posts = [];
  hook = async () => (request.attackContext.aimed = false);
  await assert.rejects(a.rollCheck("1d20", {}, request), /changed/);
  assert.equal(posts.length, 0);
  hook = async () => {};
  const b = actor();
  b.items.splice(0, 1);
  await assert.rejects(b.rollCheck("1d20", {}, c), /owned.*changed/);
});

test("valid Brace is independent of valid Aim: all live combinations, incompatible surfaces and ACC stacking", () => {
  for (const trained of [false, true])
    for (const aimed of [false, true])
      for (const braced of [false, true]) {
        const a = attack(system(trained), weapon("SPA, ACC"), { aimed, braced });
        assert.equal(a.threat, 20 - (trained && aimed ? 1 : 0) - (trained && aimed && braced ? 1 : 0));
      }
  assert.equal(attack(system(), weapon(), { aimed: true, braced: true, stableSurface: false }).blocked, true);
  const s = system();
  s.activeFeatNames = ["Sharpshooter Mastery", "Sharpshooter Supremacy"];
  assert.equal(attack(s, weapon("SPA, ACC"), { aimed: true, braced: true }).threat, 15);
});
test("replacement requires recorded Brace even when the other qualifications remain valid", () => {
  const a = sourceActor(),
    p = attack(a.system, a.items[0].system, { aimed: true }).superiorAccuracy,
    c = { checkKind: "attack", weaponProficiency: "handgun", attackContext: { aimed: true, braced: true } };
  validate(a, p, c);
  assert.throws(() => validate(a, p, { ...c, attackContext: { aimed: true, braced: false } }), /changed/);
});
