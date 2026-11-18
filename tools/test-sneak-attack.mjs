import test from "node:test";
import assert from "node:assert/strict";
import { sneakAttackSources, hasSneakAttackSource, sneakAttackDamagePlan } from "../module/rules/sneak-attack.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { sniperWeapon } from "../module/rules/sniper.mjs";
const state = () => ({
  classLevels: { scout: 4 },
  activeFeatNames: [],
  abilities: { str: { mod: 2, value: 14 }, dex: { mod: 3, value: 16 } },
  actionDice: { value: 0 },
  cqbRange: 30,
  bab: 4,
  size: "Medium",
  proficiencyTotals: { rifle: { proficient: true }, edged: { proficient: true } }
});
const rifle = {
    proficiency: "rifle",
    weaponCategory: "assaultRifle",
    sizeHands: "S/2h",
    range: 100,
    damage: "1d8",
    errorThreat: "1/20",
    recoil: 1,
    fireMode: "single",
    fireModes: ["single"]
  },
  knife = { ...rifle, proficiency: "edged", weaponCategory: "", range: 0, sizeHands: "T/1h" };
const input = {
  includeSneakAttack: true,
  successfulStandardAttack: true,
  targetCharacter: true,
  targetVulnerable: true,
  targetVitalsConfirmed: true,
  distanceFeet: 30
};
const dice = (s, w, o) => sneakAttackSources(s, w, o).reduce((n, x) => n + x.dice, 0);
test("Scout and Sniper dice cover every native level, weapon proficiency, hand requirement and bracing state", () => {
  for (let n = 0; n <= 20; n++) assert.equal(dice({ ...state(), classLevels: { scout: n } }, knife), Math.floor(n / 4));
  for (let n = 0; n <= 10; n++)
    for (const proficiency of Object.keys(cfg.proficiencies))
      for (const hands of [1, 2])
        for (const braced of [false, true]) {
          const s = { ...state(), classLevels: { sniper: n } },
            w = { ...rifle, proficiency, sizeHands: "S/" + hands + "h" },
            expected = n >= 4 && braced && sniperWeapon(w) ? (n >= 8 ? 3 : 1) : 0;
          assert.equal(dice(s, w, { braced }), expected);
          assert.equal(hasSneakAttackSource(s, w), n >= 4 && sniperWeapon(w));
        }
});
test("independent Scout, Ambush, unarmed and flanking sources add only under their actual conditions", () => {
  const s = state();
  s.classLevels.sniper = 8;
  s.activeFeatNames = [
    "Ambush Basics",
    "Ambush Supremacy",
    "Dirty Fighting Supremacy",
    "Vital Points Supremacy",
    "Wolfpack Mastery",
    "Wolfpack Supremacy"
  ];
  assert.equal(dice(s, rifle, { braced: true, targetFlanked: true }), 8);
  assert.equal(dice(s, rifle), 3);
  assert.equal(dice(s, { ...knife, proficiency: "unarmed" }, { targetFlanked: true }), 7);
  assert.equal(dice(s, knife, { targetFlanked: true }), 5);
  assert.equal(
    dice({ ...state(), classLevels: {}, inheritedClassChoices: [{ name: "Scout: Sneak attack (1 die)" }] }, knife),
    1
  );
  assert.equal(dice({ ...state(), inheritedClassChoices: [{ name: "Scout: Sneak attack (1 die)" }] }, knife), 1);
});
test("every required target/action confirmation is enforced; invalid conversion never creates dice", () => {
  const s = state();
  assert.equal(sneakAttackDamagePlan(s, knife, {}).active, false);
  for (const key of ["successfulStandardAttack", "targetCharacter", "targetVulnerable", "targetVitalsConfirmed"])
    for (const value of [false, "true", 1])
      assert.throws(() => sneakAttackDamagePlan(s, knife, { ...input, [key]: value }));
  assert.equal(sneakAttackDamagePlan(s, knife, { ...input, targetVulnerable: false, targetFlanked: true }).dice, 1);
  assert.equal(sneakAttackDamagePlan(s, knife, { ...input, targetVulnerable: false, targetHelpless: true }).dice, 1);
  assert.throws(() => sneakAttackDamagePlan({ ...s, classLevels: {} }, knife, input), /earned/);
  for (const damageConversion of ["lethalToSubdual", "subdualToLethal", "invalid"])
    assert.throws(() => sneakAttackDamagePlan(s, knife, { ...input, damageConversion }));
});
test("ranged damage obeys CQB boundaries and Sniper extends every eligible sneak source even without its bracing dice", () => {
  const s = state();
  assert.equal(sneakAttackDamagePlan(s, rifle, input).rangeLimit, 30);
  assert.throws(() => sneakAttackDamagePlan(s, rifle, { ...input, distanceFeet: 30.01 }), /beyond/);
  s.cqbRange = 60;
  assert.equal(sneakAttackDamagePlan(s, rifle, { ...input, distanceFeet: 60 }).dice, 1);
  for (const distanceFeet of [null, "", -1, NaN, Infinity, "unknown", false, true, {}])
    assert.throws(() => sneakAttackDamagePlan(s, rifle, { ...input, distanceFeet }));
  s.classLevels.sniper = 4;
  const p = sneakAttackDamagePlan(s, rifle, { ...input, distanceFeet: 400 });
  assert.equal(p.dice, 1);
  assert.equal(p.rangeLimit, 400);
  assert.equal(p.extendedRange, true);
  assert.throws(() => sneakAttackDamagePlan(s, rifle, { ...input, distanceFeet: 401 }), /beyond/);
  assert.throws(
    () => sneakAttackDamagePlan(s, { ...rifle, sizeHands: "S/1h" }, { ...input, distanceFeet: 61 }),
    /beyond/
  );
  assert.equal(sneakAttackDamagePlan(s, knife, { ...input, distanceFeet: null }).dice, 1);
});
test("Deadly Precision and Whack add per die only to the correct damage type; Bludgeon permits only lethal-to-subdual conversion", () => {
  const s = state();
  s.classLevels.scout = 8;
  s.activeFeatNames = ["Deadly Precision", "Whack", "Bludgeon"];
  let p = sneakAttackDamagePlan(s, knife, input);
  assert.equal(p.formula, "2d6 + 2");
  assert.equal(p.stress, 1);
  p = sneakAttackDamagePlan(s, knife, { ...input, damageType: "subdual", damageConversion: "lethalToSubdual" });
  assert.equal(p.formula, "2d6 + 4");
  assert.equal(p.bonusPerDie, 2);
  assert.throws(() =>
    sneakAttackDamagePlan(s, knife, { ...input, damageType: "lethal", damageConversion: "subdualToLethal" })
  );
  assert.throws(() =>
    sneakAttackDamagePlan(s, knife, { ...input, damageType: "lethal", damageConversion: "lethalToSubdual" })
  );
  assert.match(p.notes, /never these sneak attack dice/);
});
globalThis.Actor = class {
  constructor() {
    this.system = state();
    this.items = [];
    this.type = "agent";
    this.uuid = "Actor.sneak";
  }
  getRollData() {
    return {};
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = {
  user: { id: "gm", isGM: true },
  i18n: { localize: s => s },
  settings: { get: () => ({ scene: "s", session: "s" }) }
};
globalThis.foundry = {
  utils: { escapeHTML: s => String(s) },
  applications: { api: { DialogV2: { input: async () => null } } }
};
globalThis.ui = { notifications: { warn: s => ({ warning: s }) } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
const item = { name: "Rifle", uuid: "Actor.sneak.Item.rifle", system: rifle };
test("actual damage entry makes one combined formula and receipt, preserves ordinary damage and spends no resources", async () => {
  const a = new SpycraftActor();
  let calls = 0;
  a.rollCheck = async (formula, data, options) => {
    calls++;
    return { formula, data, options };
  };
  const p = await a.rollDamage(item, input);
  assert.equal(p.formula, "max(1, 1d8 + (0)) + 1d6");
  assert.equal(p.options.sneakAttack.dice, 1);
  assert.equal(p.options.checkKind, "damage");
  assert.equal(p.options.threat, 0);
  assert.equal(p.options.error, 0);
  assert.equal(calls, 1);
  assert.equal(a.system.actionDice.value, 0);
  assert.match(p.options.flavor, /apply 1 stress/);
  const normal = await a.rollDamage(item, { includeSneakAttack: false });
  assert.equal(normal.formula, "max(1, 1d8 + (0))");
  assert.equal(normal.options.sneakAttack, null);
});
test("the damage dialog honors cancellation and complete declarations without rolling failed confirmations", async () => {
  const a = new SpycraftActor();
  let calls = 0;
  a.rollCheck = async (formula, data, options) => {
    calls++;
    return { formula, options };
  };
  const old = foundry.applications.api.DialogV2.input;
  try {
    assert.equal(await a.rollDamage(item), null);
    assert.equal(calls, 0);
    foundry.applications.api.DialogV2.input = async () => ({ ...input, braced: true });
    const r = await a.rollDamage(item);
    assert.equal(r.options.sneakAttack.dice, 1);
    foundry.applications.api.DialogV2.input = async () => ({ ...input, targetCharacter: false });
    await assert.rejects(a.rollDamage(item), /characters/);
    assert.equal(calls, 1);
  } finally {
    foundry.applications.api.DialogV2.input = old;
  }
});
test("damage uses the actual effective range increment and unbraced Sniper dice never appear just because the range is extended", async () => {
  const a = new SpycraftActor();
  a.system.classLevels = { scout: 4, sniper: 4 };
  a.rollCheck = async (formula, data, options) => ({ formula, options });
  const attack = a.weaponAttack.bind(a);
  a.weaponAttack = (i, o) => ({ ...attack(i, o), range: 150 });
  const p = await a.rollDamage(item, { ...input, distanceFeet: 600 });
  assert.equal(p.options.sneakAttack.rangeLimit, 600);
  assert.equal(p.options.sneakAttack.dice, 1);
  const braced = await a.rollDamage(item, { ...input, distanceFeet: 600, braced: true });
  assert.equal(braced.options.sneakAttack.dice, 2);
  await assert.rejects(a.rollDamage(item, { ...input, distanceFeet: 601 }), /beyond/);
});

test("Knuckles attacks count as unarmed for conditional sneak attack dice without changing their weapon proficiency", () => {
  const s = { ...state(), activeFeatNames: ["Dirty Fighting Supremacy", "Vital Points Supremacy"] },
    w = { ...knife, proficiency: "blunt", qualities: "NKL, SUR" };
  assert.equal(sneakAttackDamagePlan(s, w, { ...input, distanceFeet: null }).dice, 3);
  assert.equal(w.proficiency, "blunt");
  assert.equal(sneakAttackDamagePlan(s, { ...w, qualities: "SUR" }, input).dice, 1);
});

const { sneakAttackCapacity } = await import("../module/rules/sneak-attack.mjs"),
  { prerequisiteContext, computeAgent } = await import("../module/rules/engine.mjs"),
  { checkPrerequisites, describe } = await import("../module/rules/prerequisites.mjs"),
  { readFile } = await import("node:fs/promises"),
  { captureFeatAcquisition, featAcquisitionSignature } = await import("../module/rules/feat-acquisition.mjs");
const classDefs = JSON.parse(await readFile(new URL("../src/data/classes.json", import.meta.url), "utf8")),
  featDefs = JSON.parse(await readFile(new URL("../src/data/feats.json", import.meta.url), "utf8"));
const feat = (name, patch = {}) => ({
  id: name,
  name,
  type: "feat",
  system: { ...structuredClone(featDefs.find(f => f.name === name)), tree: "covert", acquiredAtLevel: 1, ...patch }
});
function agent(level, classId = "scout", feats = []) {
  const definition = classDefs.find(c => c.key === classId),
    items = [
      {
        id: classId,
        name: definition.name,
        type: "class",
        system: { ...definition, identifier: classId, vitalityDie: 10 }
      },
      ...feats
    ],
    system = {
      usagePeriods: { session: "s" },
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 16 }])),
      progression: Array.from({ length: level }, () => ({ classId, vitality: 5, skills: {} }))
    };
  return { system: computeAgent(system, items, cfg), items };
}
test("ability capacity chooses the best achievable weapon context instead of adding mutually exclusive Sniper and unarmed bonuses", () => {
  const s = {
    ...state(),
    classLevels: { scout: 4, sniper: 8 },
    activeFeatNames: [
      "Ambush Basics",
      "Ambush Supremacy",
      "Dirty Fighting Supremacy",
      "Vital Points Supremacy",
      "Wolfpack Mastery",
      "Wolfpack Supremacy"
    ]
  };
  assert.equal(sneakAttackCapacity(s), 8);
  assert.equal(sneakAttackCapacity({ ...s, activeFeatNames: [...s.activeFeatNames, "Snake Strike"] }), 9);
  assert.equal(sneakAttackCapacity(s, new Set(["snake strike"])), 5);
  assert.equal(sneakAttackCapacity({ ...state(), classLevels: {} }, new Set(["ambush basics"])), 1);
});
test("numeric sneak-ability prerequisites cover all Scout/Sniper milestones and cannot be waived by manual confirmation", () => {
  for (const classId of ["scout", "sniper"])
    for (let level = 0; level <= (classId === "scout" ? 20 : 10); level++) {
      const s = {
          abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 10 }])),
          classLevels: { [classId]: level }
        },
        ctx = prerequisiteContext(s, new Set(), {}, {}),
        expected = classId === "scout" ? Math.floor(level / 4) : level >= 8 ? 3 : level >= 4 ? 1 : 0;
      assert.equal(ctx.sneakAttackDice, expected);
      for (const min of [1, 2, 3])
        assert.equal(
          checkPrerequisites({ type: "sneakAttack", min }, { ...ctx, manualConfirmed: true }).ok,
          expected >= min
        );
    }
  assert.equal(describe({ type: "sneakAttack", min: 1 }), "Sneak attack damage of 1 die or more");
  assert.match(describe({ type: "sneakAttack", min: 3 }), /3 dice/);
});
test("all five catalog requirements use numeric dice while retaining their independent level and feat requirements", () => {
  const counts = { Bludgeon: 1, Whack: 3, "Deadly Precision": 2, "Crippling Strike": 3, Executioner: 1 };
  for (const [name, min] of Object.entries(counts)) {
    const d = featDefs.find(f => f.name === name),
      leaves = n => (n.of ? n.of.flatMap(leaves) : [n]),
      nodes = leaves(d.prerequisites);
    assert.equal(d.notChecked, false);
    assert.ok(nodes.some(n => n.type === "sneakAttack" && n.min === min));
    assert.equal(
      nodes.some(n => n.type === "manual"),
      false
    );
    const ctx = prerequisiteContext(
      {
        level: 20,
        abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 10 }]))
      },
      new Set(),
      {},
      {}
    );
    assert.equal(checkPrerequisites(d.prerequisites, { ...ctx, sneakAttackDice: min, hasFeat: () => true }).ok, true);
    assert.equal(
      checkPrerequisites(d.prerequisites, {
        ...ctx,
        sneakAttackDice: min - 1,
        hasFeat: () => true,
        manualConfirmed: true
      }).ok,
      false
    );
  }
});
test("actual feat eligibility accepts class-derived dice, rejects insufficient dice and keeps level/feat clauses", () => {
  const bludgeon = feat("Bludgeon"),
    deadly = feat("Deadly Precision"),
    cripple = feat("Crippling Strike"),
    whack = feat("Whack");
  assert.equal(agent(3, "scout", [bludgeon]).system.featStatus.Bludgeon.ok, false);
  assert.equal(agent(4, "scout", [bludgeon]).system.featStatus.Bludgeon.ok, true);
  assert.equal(agent(8, "scout", [deadly]).system.featStatus["Deadly Precision"].ok, false);
  assert.equal(agent(9, "scout", [deadly]).system.featStatus["Deadly Precision"].ok, true);
  assert.equal(agent(8, "sniper", [cripple]).system.featStatus["Crippling Strike"].ok, true);
  assert.equal(agent(12, "scout", [whack]).system.featStatus.Whack.ok, false);
  const both = agent(12, "scout", [whack, bludgeon]);
  assert.equal(both.system.featStatus.Whack.ok, true);
});
test("temporary sneak dice never qualify permanent feats, while active temporary feats may qualify another temporary grant", () => {
  const ambush = feat("Ambush Basics", {
      featKind: "temporary",
      granted: true,
      prerequisites: null,
      temporaryGrant: { period: "session", epoch: "s" }
    }),
    permanent = feat("Bludgeon"),
    temporary = feat("Bludgeon", { featKind: "temporary", temporaryGrant: { period: "session", epoch: "s" } });
  assert.equal(agent(3, "soldier", [ambush, permanent]).system.featStatus.Bludgeon.ok, false);
  assert.equal(agent(3, "soldier", [ambush, temporary]).system.featStatus.Bludgeon.ok, true);
});
test("actual acquisition snapshots check the derived ability and preserve a failed historical acquisition after later class levels", () => {
  const d = feat("Bludgeon", { manualPrerequisitesConfirmed: true }),
    a = new SpycraftActor(),
    initial = agent(3, "scout");
  a.system = initial.system;
  a.items = initial.items;
  const fail = captureFeatAcquisition(a, d.system);
  assert.equal(fail.ok, false);
  const later = feat("Bludgeon", {
    acquiredAtLevel: 3,
    acquisitionCheck: { ...fail, level: 3, signature: featAcquisitionSignature(d.system) }
  });
  assert.equal(agent(4, "scout", [later]).system.featStatus.Bludgeon.ok, false);
  const current = agent(4, "scout");
  a.system = current.system;
  a.items = current.items;
  assert.equal(captureFeatAcquisition(a, d.system).ok, true);
});

test("Sniper extended sneak range does not allow an attacker to flank from beyond CQB or claim Wolfpack dice at that distance", () => {
  const s = {
    ...state(),
    classLevels: { scout: 4, sniper: 8 },
    activeFeatNames: ["Wolfpack Mastery", "Wolfpack Supremacy"]
  };
  assert.equal(sneakAttackDamagePlan(s, rifle, { ...input, targetFlanked: true, distanceFeet: 30 }).dice, 3);
  assert.throws(() => sneakAttackDamagePlan(s, rifle, { ...input, targetFlanked: true, distanceFeet: 31 }), /flanking/);
  assert.equal(sneakAttackDamagePlan(s, rifle, { ...input, targetFlanked: false, distanceFeet: 800 }).dice, 1);
});

const { knownSneakAttackImmunity } = await import("../module/rules/sneak-attack.mjs");
const { damageTargetChoices, sneakAttackTargetSnapshot, validateSneakAttackTarget } =
  await import("../module/apps/damage-target.mjs");
test("known Armor Supremacy and enabled Construct protections prohibit sneak dice while leaving ordinary damage available", () => {
  for (const targetSystem of [
    { armorFeatRules: { sneakAttackImmune: true } },
    { npcProfile: { enabled: true, qualities: [{ id: "construct" }] } }
  ]) {
    assert.equal(knownSneakAttackImmunity(targetSystem).immune, true);
    assert.throws(() => sneakAttackDamagePlan(state(), knife, { ...input, targetSystem }), /immune/);
    assert.equal(sneakAttackDamagePlan(state(), knife, { includeSneakAttack: false, targetSystem }).active, false);
  }
  for (const targetSystem of [
    {},
    { armorFeatRules: { sneakAttackImmune: false } },
    { npcProfile: { enabled: false, qualities: [{ id: "construct" }] } }
  ])
    assert.equal(sneakAttackDamagePlan(state(), knife, { ...input, targetSystem }).dice, 1);
  for (const key of ["includeSneakAttack", "targetSneakAttackImmune"])
    assert.throws(() => sneakAttackDamagePlan(state(), knife, { ...input, [key]: "true" }));
});
test("damage resolves the actual selected target and cannot override known immunity with manual confirmation or supplied system data", async () => {
  const a = new SpycraftActor(),
    target = {
      uuid: "Actor.target",
      documentName: "Actor",
      type: "agent",
      name: "Target",
      visible: true,
      system: { armorFeatRules: { sneakAttackImmune: true }, armor: { items: ["vest"] } }
    };
  let calls = 0;
  const old = globalThis.fromUuid;
  globalThis.fromUuid = async uuid => (uuid === target.uuid ? target : null);
  a.rollCheck = async (formula, data, options) => {
    calls++;
    return { formula, options };
  };
  game.actors = [target];
  game.user.targets = new Set([{ actor: target }]);
  try {
    assert.equal(damageTargetChoices().selected, target.uuid);
    assert.equal(damageTargetChoices().actors.length, 1);
    await assert.rejects(a.rollDamage(item, { ...input, targetSystem: {}, targetActorUuid: target.uuid }), /immune/);
    assert.equal(calls, 0);
    assert.equal((await a.rollDamage(item, { includeSneakAttack: false })).options.sneakAttack, null);
    await assert.rejects(a.rollDamage(item, { ...input, targetActorUuid: "Actor.missing" }), /unavailable/);
    const manual = await a.rollDamage(item, { ...input, targetActorUuid: "" });
    assert.equal(manual.options.sneakAttackTarget, null);
    target.system.armorFeatRules.sneakAttackImmune = false;
    const r = await a.rollDamage(item, input);
    assert.equal(r.options.sneakAttackTarget.actorUuid, target.uuid);
    assert.equal(r.options.sneakAttack.dice, 1);
    await validateSneakAttackTarget(r.options.sneakAttackTarget);
    target.system.armor.items = [];
    await assert.rejects(validateSneakAttackTarget(r.options.sneakAttackTarget), /changed/);
    target.system.armor.items = ["vest"];
    target.system.armorFeatRules.sneakAttackImmune = true;
    await assert.rejects(validateSneakAttackTarget(r.options.sneakAttackTarget), /changed/);
    target.documentName = "Item";
    await assert.rejects(a.rollDamage(item, { ...input, targetActorUuid: target.uuid }), /unavailable/);
  } finally {
    globalThis.fromUuid = old;
    delete game.actors;
    delete game.user.targets;
  }
});
