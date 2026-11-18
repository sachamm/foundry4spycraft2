import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { weaponAttack, weaponDamage } from "../module/rules/gear.mjs";
import { firearmDefaults } from "../module/rules/firearms.mjs";
import { validateTrainedOnlyWeaponProof as validate } from "../module/rules/trained-only-weapon.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
const system = (trained = true) => ({
    size: "Medium",
    bab: 3,
    classLevels: {},
    conditionContext: {},
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
    proficiencyTotals: {
      exoticBlunt: { proficient: trained },
      blunt: { proficient: true },
      tactical: { proficient: false },
      indirectFire: { proficient: true }
    },
    activeFeatNames: [],
    actionDice: { value: 0 },
    vitality: { value: 4 },
    wounds: { value: 4 }
  }),
  weapon = (qualities = "FIN, TRO") => ({
    id: "weapon",
    proficiency: "exoticBlunt",
    weaponCategory: "other",
    sizeHands: "D/1h",
    equipped: true,
    carried: true,
    quantity: 1,
    qualities,
    error: 1,
    threat: 20,
    damage: "1d6",
    range: 0,
    recoil: 0
  }),
  attack = (s = system(), w = weapon(), opts = {}) => weaponAttack(s, w, cfg, "agent", opts);
test("all ten actual catalog TRO weapons block untrained attacks and permit actual training using their proper source proficiency", () => {
  const rows = JSON.parse(readFileSync(new URL("../src/data/equipment.json", import.meta.url))).weapons.filter(w =>
      /\bTRO\b/.test(w.qualities)
    ),
    keys = {
      Edged: "edged",
      "Exotic (Blunt)": "exoticBlunt",
      "Exotic (Edged)": "exoticEdged",
      Handgun: "handgun",
      Shotgun: "shotgun",
      "Submachine gun": "submachineGun"
    };
  assert.equal(rows.length, 10);
  for (const row of rows) {
    const proficiency = keys[row.proficiency],
      w = {
        ...row,
        ...firearmDefaults(row.sourceTable, row.qualities),
        id: row.name,
        proficiency,
        equipped: true,
        carried: true,
        quantity: 1
      },
      s = system();
    s.proficiencyTotals = { [proficiency]: { proficient: false } };
    const no = attack(s, w);
    assert.equal(no.blocked, true, row.name);
    assert.match(no.reason, /Trained Only/);
    assert.equal(no.trainedOnly.sourceProficiency, proficiency);
    s.proficiencyTotals[proficiency].proficient = true;
    const yes = attack(s, w);
    assert.equal(yes.blocked, false, row.name);
    assert.equal(yes.trainedOnly.trained, true);
  }
});
test("ordinary untrained attacks retain their normal penalty and TRO does not independently block or modify damage calculations", () => {
  const s = system(false),
    plain = weapon("FIN"),
    tro = weapon();
  assert.equal(attack(s, plain).blocked, false);
  assert.equal(attack(s, tro).blocked, true);
  for (const key of ["formula", "bonus", "blocked", "blockedReason", "finesse", "conditionDamagePenalty", "grip"])
    assert.deepEqual(weaponDamage(s, tro)[key], weaponDamage(s, plain)[key], key);
  assert.equal(weaponDamage(s, tro).blocked, false);
  assert.equal(attack(system(), tro).total, attack(system(), plain).total);
});
function sourceActor(w = weapon(), s = system()) {
  const item = { id: w.id, name: "Actual weapon", type: "weapon", system: w },
    items = [item];
  items.get = id => items.find(i => i.id === id);
  return { type: "agent", system: s, items };
}
test("actual launcher-mode proficiency decides TRO permission, and owned-source validation never substitutes a different trained proficiency", () => {
  const a = sourceActor({ ...weapon("TRO"), proficiency: "tactical", weaponCategory: "grenadeLauncher", range: 50 }),
    direct = attack(a.system, a.items[0].system),
    indirect = attack(a.system, a.items[0].system, { indirectFire: true });
  assert.equal(direct.blocked, true);
  assert.equal(indirect.blocked, false);
  assert.equal(indirect.trainedOnly.sourceProficiency, "tactical");
  assert.equal(indirect.trainedOnly.operatingProficiency, "indirectFire");
  const c = {
    checkKind: "attack",
    weaponProficiency: "indirectFire",
    attackContext: { launcherOperation: indirect.launcherOperation }
  };
  validate(a, indirect.trainedOnly, c);
  a.system.proficiencyTotals.indirectFire.proficient = false;
  a.system.proficiencyTotals.tactical.proficient = true;
  assert.throws(() => validate(a, indirect.trainedOnly, c), /changed|no longer/);
  validate(a, null, c);
});
test("modern optional TRO evidence rejects additions/removals/changes without altering old absent-marker receipts", () => {
  const c = { checkKind: "attack", attackContext: { trainedOnly: attack().trainedOnly } },
    e = rollEvidence(c),
    old = { checkKind: "attack", attackContext: {} };
  assert.equal(rollEvidenceMatches(e, c), true);
  assert.equal(rollEvidenceMatches(rollEvidence(old), old), true);
  assert.equal(rollEvidenceMatches(e, old), false);
  assert.equal(rollEvidenceMatches(rollEvidence(old), c), false);
  for (const k of Object.keys(c.attackContext.trainedOnly)) {
    const n = structuredClone(c);
    n.attackContext.trainedOnly[k] = "changed";
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
function actor(trained = true, qualities = "FIN, TRO") {
  const a = makeFatigueActor();
  a.system = system(trained);
  a.flags = {};
  a.items = [
    {
      id: "weapon",
      uuid: "Actor.fatigue.Item.weapon",
      name: "Actual owned weapon",
      type: "weapon",
      system: weapon(qualities)
    }
  ];
  a.items.get = id => a.items.find(i => i.id === id);
  a.getRollData = () => ({});
  Object.defineProperty(a, "participatingCombat", { value: null });
  return a;
}
test("actual Actor blocks an untrained TRO attack before RNG or posting despite a forged training flag, then records the actual trained source", async () => {
  let a = actor(false);
  posts = [];
  rolls = 0;
  hook = async () => {};
  await a.rollAttack(a.items[0], { trained: true });
  assert.equal(rolls, 0);
  assert.equal(posts.length, 0);
  a = actor();
  const m = await a.rollAttack(a.items[0], { trained: false });
  assert.equal(m.flags.spycraft2.attackContext.trainedOnly.trained, true);
  assert.equal(m.flags.spycraft2.attackContext.trainedOnly.trainedOnly, true);
  assert.equal(m.flags.spycraft2.attackContext.trainedOnly.weaponId, "weapon");
  assert.match(m.flags.spycraft2.baseFlavor, /Trained Only/);
});
test("actual RNG TRO quality gain/loss, training gain/loss and owned-source proficiency/category/identity changes block stale posting", async () => {
  for (const change of ["troGain", "troLoss", "trainingGain", "trainingLoss", "proficiency", "category", "removed"]) {
    const a = actor(
      !["troGain", "trainingGain"].includes(change),
      ["troGain", "trainingGain"].includes(change) ? "FIN" : "FIN, TRO"
    );
    posts = [];
    hook = async () => {
      const w = a.items[0];
      if (change === "troGain") w.system.qualities = "FIN, TRO";
      if (change === "troLoss") w.system.qualities = "FIN";
      if (change === "trainingGain") a.system.proficiencyTotals.exoticBlunt.proficient = true;
      if (change === "trainingLoss") a.system.proficiencyTotals.exoticBlunt.proficient = false;
      if (change === "proficiency") w.system.proficiency = "blunt";
      if (change === "category") w.system.weaponCategory = "changed";
      if (change === "removed") a.items.splice(0, 1);
    };
    await assert.rejects(a.rollAttack(a.items[0]), /changed|no longer exists/);
    assert.equal(posts.length, 0, change);
  }
  hook = async () => {};
});
test("replacement pre/post guards independently enforce current TRO and operating training without a retained controller closure", async () => {
  const a = actor(),
    p = a.weaponAttack(a.items[0]).trainedOnly,
    c = {
      checkKind: "attack",
      weaponProficiency: "exoticBlunt",
      weaponUuid: a.items[0].uuid,
      attackContext: { trainedOnly: p }
    };
  a.system.proficiencyTotals.exoticBlunt.proficient = false;
  rolls = 0;
  await assert.rejects(a.rollCheck("1d20", {}, c), /changed|no longer/);
  assert.equal(rolls, 0);
  const b = actor(false, "FIN"),
    proof = b.weaponAttack(b.items[0]).trainedOnly,
    request = {
      checkKind: "attack",
      weaponProficiency: "exoticBlunt",
      weaponUuid: b.items[0].uuid,
      attackContext: { trainedOnly: proof }
    };
  posts = [];
  hook = async () => (b.items[0].system.qualities = "FIN, TRO");
  await assert.rejects(b.rollCheck("1d20", {}, request), /changed|no longer/);
  assert.equal(posts.length, 0);
  hook = async () => {};
});
