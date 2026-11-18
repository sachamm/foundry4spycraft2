import test from "node:test";
import assert from "node:assert/strict";
import { sniperWeapon, eagleEyeDiePlan, eagleEyeRecord, eagleEyeState } from "../module/rules/sniper.mjs";
import { weaponRangeEffects } from "../module/rules/firearms.mjs";
import { weaponAttack } from "../module/rules/gear.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const state = () => ({
  coreClassIds: ["sniper"],
  classLevels: { sniper: 1 },
  size: "Medium",
  bab: 4,
  abilities: { str: { value: 14, mod: 2 }, dex: { value: 14, mod: 2 } },
  proficiencyTotals: { rifle: { proficient: true } },
  actionDice: { value: 1, max: 4, die: 8, explodeAt: 7, bonus: 2 },
  resourceUses: {},
  usagePeriods: { scene: "a" },
  activeFeatNames: []
});
const rifle = {
  name: "Rifle",
  proficiency: "rifle",
  sizeHands: "S/2h",
  weaponCategory: "assaultRifle",
  range: 100,
  recoil: 13,
  errorThreat: "1/20"
};
function gain(s = state()) {
  const plan = eagleEyeDiePlan(s);
  return eagleEyeRecord(s, plan, { total: 12, dice: [{ total: 10 }] }, { scene: "a" });
}
test("Eagle Eye requires the actual core and a valid default die; exploding die totals and insight bonuses are included once", () => {
  const s = state(),
    plan = eagleEyeDiePlan(s);
  assert.equal(plan.formula, "1d8x>=7 + 2");
  assert.equal(gain().rangeIncrease, 120);
  for (const die of [4, 6, 8, 10, 12])
    assert.equal(eagleEyeDiePlan({ ...s, actionDice: { die, explodeAt: die, bonus: 0 } }).die, die);
  assert.throws(() => eagleEyeDiePlan({ ...s, coreClassIds: [] }));
  for (const patch of [{ die: 20 }, { explodeAt: 1 }, { explodeAt: 9 }, { bonus: 0.5 }])
    assert.throws(() => eagleEyeDiePlan({ ...s, actionDice: { ...s.actionDice, ...patch } }));
  assert.throws(() => eagleEyeRecord(s, plan, { total: 20, dice: [{ total: 10 }] }));
  assert.throws(() => eagleEyeRecord(s, plan, { total: Infinity, dice: [{ total: 10 }] }));
  assert.equal(limitedUseAbilities(s, [], cfg).find(x => x.id === "eagleEye").cost, 1);
  assert.equal(
    limitedUseAbilities({ ...s, coreClassIds: [] }, [], cfg).some(x => x.id === "eagleEye"),
    false
  );
});
test("weapon scope checks every proficiency and hand requirement, excluding heavy weapons from the narrower firearm/hurled wording", () => {
  const allowed = ["handgun", "rifle", "shotgun", "submachineGun", "hurled", "exoticHurled"];
  for (const proficiency of Object.keys(cfg.proficiencies))
    for (const hands of [1, 2])
      assert.equal(
        sniperWeapon({ proficiency, sizeHands: "S/" + hands + "h" }),
        hands === 2 && allowed.includes(proficiency),
        proficiency + "/" + hands
      );
});
test("the scene-wide increment applies to every eligible weapon before feat multipliers and ordinary range penalties, then expires without changing inventory", () => {
  const s = state();
  s.eagleEyeBoost = gain();
  assert.equal(eagleEyeState(s).active, true);
  assert.equal(weaponRangeEffects(s, rifle, { firearm: true }).increment, 220);
  assert.equal(weaponRangeEffects(s, { ...rifle, range: 0 }, { firearm: true }).increment, 0);
  assert.equal(weaponRangeEffects(s, { ...rifle, sizeHands: "S/1h" }, { firearm: true }).increment, 100);
  assert.equal(weaponRangeEffects(s, { ...rifle, proficiency: "tactical" }, { firearm: true }).increment, 100);
  s.activeFeatNames = ["Marksmanship Supremacy"];
  assert.equal(weaponRangeEffects(s, rifle, { firearm: true }).increment, 440);
  const hurled = { proficiency: "hurled", sizeHands: "S/2h", range: 10 };
  assert.equal(weaponRangeEffects(s, hurled, { loadPenalty: -5 }).increment, 385);
  s.usagePeriods.scene = "b";
  assert.equal(eagleEyeState(s).active, false);
  assert.equal(weaponRangeEffects(s, rifle, { firearm: true }).increment, 200);
  assert.equal(rifle.range, 100);
  const active = state();
  active.eagleEyeBoost = gain();
  const attack = weaponAttack(active, rifle, cfg, "agent", { distanceFeet: 330 });
  assert.equal(attack.range, 220);
  assert.equal(attack.rangePenalty, -2);
  assert.match(attack.notes, /Eagle Eye/);
});
test("malformed current modifiers cannot become range bonuses; legitimate expiry and loss of the core remove the benefit", () => {
  const s = state();
  for (const patch of [
    { rangeIncrease: 999 },
    { result: 99 },
    { rolled: 0 },
    { bonus: NaN },
    { source: "other" },
    { die: 99 },
    { explodeAt: 1 }
  ]) {
    s.eagleEyeBoost = { ...gain(), ...patch };
    assert.equal(eagleEyeState(s).active, false);
    assert.equal(eagleEyeState(s).review, true);
    assert.equal(weaponRangeEffects(s, rifle, { firearm: true }).increment, 100);
  }
  s.eagleEyeBoost = gain();
  s.coreClassIds = [];
  assert.equal(eagleEyeState(s).active, false);
});
let round = "r1",
  attackNaturals = [],
  attackRolls = 0,
  chosen = "0",
  scene = "a",
  posts = [],
  failPost = false,
  failRestore = false,
  warnings = [];
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.sniper";
    this.type = "agent";
    this.isOwner = true;
    this.items = [];
    this.system = state();
    this.system.limitedUses = limitedUseAbilities(this.system, [], cfg);
  }
  async update(patch) {
    if (failRestore && Object.hasOwn(patch, "system.eagleEyeBoost") && patch["system.eagleEyeBoost"] === null)
      throw Error("restore failed");
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.split(".");
      let o = this;
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
  settings: { get: () => ({ scene, session: "s", round }) },
  i18n: { localize: s => s }
};
globalThis.foundry = {
  utils: { escapeHTML: s => String(s), deepClone: structuredClone },
  applications: { api: { DialogV2: { input: async () => ({ chosen }) } } }
};
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.ui = {
  notifications: {
    warn: s => {
      warnings.push(s);
      return null;
    }
  }
};
globalThis.Roll = class {
  constructor(formula, data = {}) {
    this.formula = formula;
    if (formula.startsWith("1d20")) {
      const n = attackNaturals.shift() ?? 7;
      attackRolls++;
      this.total = n + (data.total ?? 0);
      this.dice = [{ total: n }];
    } else {
      this.total = 12;
      this.dice = [{ total: 10 }];
    }
  }
  async evaluate() {
    return this;
  }
  async toMessage(data) {
    if (failPost) throw Error("post failed");
    posts.push(data);
    return data;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function reset() {
  round = "r1";
  attackNaturals = [];
  attackRolls = 0;
  chosen = "0";
  scene = "a";
  posts = [];
  failPost = false;
  failRestore = false;
  warnings = [];
}
test("the actual ability spends one ordinary die and one scene use, records its roll, and refreshes only with a new scene", async () => {
  reset();
  const a = new SpycraftActor(),
    r = await a.useEagleEye();
  assert.equal(r.rangeIncrease, 120);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.resourceUses.eagleEye.used, 1);
  assert.equal(posts[0].flags.spycraft2.checkKind, "eagleEye");
  assert.equal(await a.useEagleEye(), null);
  scene = "b";
  a.system.usagePeriods.scene = "b";
  a.system.actionDice.value = 1;
  assert.ok(await a.useEagleEye());
  assert.equal(a.system.eagleEyeBoost.scene, "b");
  assert.equal(a.system.resourceUses.eagleEye.used, 1);
});
test("failed posts restore the old modifier and refund both costs; competing final uses execute once", async () => {
  reset();
  const a = new SpycraftActor();
  failPost = true;
  await assert.rejects(a.useEagleEye(), /post failed/);
  assert.equal(a.system.eagleEyeBoost, null);
  assert.equal(a.system.actionDice.value, 1);
  assert.equal(a.system.resourceUses.eagleEye, undefined);
  failPost = false;
  await Promise.all([a.useEagleEye(), a.useEagleEye()]);
  assert.equal(posts.length, 1);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.resourceUses.eagleEye.used, 1);
});
test("a failed modifier restore retains the spent resources and warns for review rather than supplying a free range effect", async () => {
  reset();
  const a = new SpycraftActor();
  failPost = true;
  failRestore = true;
  await assert.rejects(a.useEagleEye(), /safely restored/);
  assert.equal(a.system.eagleEyeBoost.rangeIncrease, 120);
  assert.equal(a.system.actionDice.value, 0);
  assert.equal(a.system.resourceUses.eagleEye.used, 1);
  assert.match(warnings.at(-1), /remain spent/);
});

const { sniperAttackEffects, sniperMagicTouchBonus } = await import("../module/rules/sniper.mjs");
const { computeAgent, prerequisiteContext } = await import("../module/rules/engine.mjs");
const { checkPrerequisites } = await import("../module/rules/prerequisites.mjs");
const { captureFeatAcquisition, featAcquisitionSignature } = await import("../module/rules/feat-acquisition.mjs");
const { readFile } = await import("node:fs/promises");
const definitions = JSON.parse(await readFile(new URL("../src/data/classes.json", import.meta.url), "utf8"));
test("Surprise Shot, Magic Touch and earned One Shot cover every native level, proficiency and weapon-hand boundary", () => {
  for (let level = 0; level <= 10; level++)
    for (const proficiency of Object.keys(cfg.proficiencies))
      for (const hands of [1, 2])
        for (const flat of [false, true]) {
          const sys = {
              classLevels: { sniper: level },
              classOptionSelections: level >= 4 ? [{ classId: "sniper", name: "One Shot" }] : []
            },
            weapon = { proficiency, sizeHands: "S/" + hands + "h" },
            eligible = sniperWeapon(weapon),
            r = sniperAttackEffects(sys, weapon, { targetFlatFooted: flat });
          assert.equal(r.attackBonus, eligible ? (level >= 9 ? 2 : level >= 5 ? 1 : 0) : 0);
          assert.equal(r.threatIncrease, eligible && flat ? (level >= 7 ? 2 : level >= 2 ? 1 : 0) : 0);
          assert.equal(r.errorReduction, eligible && level >= 4 ? 2 : 0);
        }
  assert.equal(sniperAttackEffects({ classLevels: { sniper: 10 } }, rifle).errorReduction, 0);
  assert.equal(
    sniperAttackEffects({ classLevels: { sniper: 10 } }, rifle, { targetFlatFooted: "false" }).threatIncrease,
    0
  );
});
test("Sniper attack adjustments stack with independent stance/specialist effects while respecting zero threat/error floors", () => {
  const s = state();
  s.classLevels.sniper = 9;
  s.classOptionSelections = [{ classId: "sniper", name: "One Shot" }];
  s.activeFeatNames = ["Sharpshooter Mastery", "Sharpshooter Supremacy"];
  const r = weaponAttack(s, rifle, cfg, "agent", {
    targetFlatFooted: true,
    aimed: true,
    braced: true,
    stableSurface: true,
    attackAction: "standard"
  });
  assert.equal(r.total, 10);
  assert.equal(r.error, 0);
  assert.equal(r.threat, 15);
  assert.equal(weaponAttack(s, { ...rifle, errorThreat: "1/—" }, cfg, "agent", { targetFlatFooted: true }).threat, 0);
  assert.equal(s.bab, 4);
  assert.equal(weaponAttack(s, { ...rifle, sizeHands: "S/1h" }, cfg).total, 6);
});
function sourceClasses() {
  return ["soldier", "sniper"].map(key => ({
    id: key,
    name: key,
    type: "class",
    system: { ...definitions.find(c => c.key === key), identifier: key, vitalityDie: key === "soldier" ? 12 : 10 }
  }));
}
function native(level = 5, extra = []) {
  const system = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 15 }])),
    progression: [
      ...Array.from({ length: 3 }, () => ({ classId: "soldier", vitality: 6, skills: {} })),
      ...Array.from({ length: level }, () => ({ classId: "sniper", vitality: 5, skills: {} }))
    ],
    misc: {}
  };
  return computeAgent(system, [...sourceClasses(), ...extra], cfg);
}
test("Magic Touch raises BAB only for Ranged Combat prerequisites; it never changes Main/base BAB or class requirements", () => {
  for (let n = 0; n <= 10; n++) {
    const s = native(n),
      bonus = sniperMagicTouchBonus(s),
      plain = prerequisiteContext(s, new Set(), {}, {}),
      ranged = prerequisiteContext(s, new Set(), {}, {}, { featTree: "rangedCombat" }),
      other = prerequisiteContext(s, new Set(), {}, {}, { featTree: "basicCombat" });
    assert.equal(plain.base.bab, 3 + n);
    assert.equal(s.base.bab, 3 + n);
    assert.equal(s.bab, 3 + n);
    assert.equal(ranged.base.bab, 3 + n + bonus);
    assert.equal(other.base.bab, 3 + n);
    if (bonus) {
      const req = { type: "base", key: "bab", min: 3 + n + bonus };
      assert.equal(checkPrerequisites(req, ranged).ok, true);
      assert.equal(checkPrerequisites(req, plain).ok, false);
    }
  }
});
test("actual feat evaluation and acquisition snapshots receive the ranged-tree context without waiving failed historical checks or other trees", () => {
  const feat = {
      id: "ranged",
      name: "QA Ranged BAB prerequisite",
      type: "feat",
      system: { tree: "rangedCombat", acquiredAtLevel: 8, prerequisites: { type: "base", key: "bab", min: 9 } }
    },
    s = native(5, [feat]);
  assert.equal(s.featStatus.ranged.ok, true);
  const other = { ...feat, id: "other", system: { ...feat.system, tree: "basicCombat" } };
  assert.equal(native(5, [other]).featStatus.other.ok, false);
  const failed = {
    ...feat,
    system: {
      ...feat.system,
      acquisitionCheck: {
        ok: false,
        unmet: ["Not met at acquisition"],
        level: 8,
        signature: featAcquisitionSignature(feat.system)
      }
    }
  };
  assert.equal(native(5, [failed]).featStatus.ranged.ok, false);
  const a = new SpycraftActor();
  a.system = native(5);
  a.items = sourceClasses();
  assert.equal(a.checkPrerequisites(feat.system.prerequisites, { featTree: "rangedCombat" }).ok, true);
  assert.equal(
    a.checkPrerequisites(feat.system.prerequisites, { classEntry: true, featTree: "rangedCombat" }).ok,
    false
  );
  assert.equal(captureFeatAcquisition(a, feat.system).ok, true);
});
test("the actual attack entry freezes target and Sniper sources without changing stored weapon data", async () => {
  reset();
  const a = new SpycraftActor();
  a.system.classLevels.sniper = 7;
  a.system.classOptionSelections = [{ classId: "sniper", name: "One Shot" }];
  a.rollCheck = async (_f, data, options) => ({ data, options });
  const item = { name: "Sniper rifle", uuid: "Actor.sniper.Item.rifle", system: structuredClone(rifle) };
  const result = await a.rollRangedAttack(item, { distanceFeet: 100, targetFlatFooted: true });
  assert.equal(result.data.total, 7);
  assert.equal(result.options.threat, 18);
  assert.equal(result.options.error, 0);
  assert.equal(result.options.attackContext.targetFlatFooted, true);
  assert.equal(result.options.attackContext.sniper.attackBonus, 1);
  assert.equal(item.system.errorThreat, "1/20");
  assert.equal(item.system.range, 100);
});

const { millionDollarSkillPlan } = await import("../module/rules/sniper.mjs");
function dollarActor() {
  const a = new SpycraftActor();
  a.system.classLevels.sniper = 10;
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  const item = {
    id: "rifle",
    uuid: "Actor.sniper.Item.rifle",
    name: "Rifle",
    type: "weapon",
    system: structuredClone(rifle)
  };
  a.items = [item];
  a.items.get = id => a.items.find(i => i.id === id);
  return { a, item };
}
const dollarInput = { millionDollarSkill: true, targetVulnerable: true, distanceFeet: 100, attackAction: "standard" };
test("Million Dollar Skill requires native level ten, an eligible weapon and a declared vulnerable opponent across the entire scope matrix", () => {
  for (let level = 0; level <= 10; level++)
    for (const proficiency of Object.keys(cfg.proficiencies))
      for (const hands of [1, 2])
        for (const vulnerable of [false, true]) {
          const s = { classLevels: { sniper: level } },
            w = { proficiency, sizeHands: "S/" + hands + "h" },
            expected = level === 10 && sniperWeapon(w) && vulnerable;
          assert.equal(millionDollarSkillPlan(s, w, { targetVulnerable: vulnerable }).blocked, !expected);
          const spec = limitedUseAbilities(s, [], cfg).find(s => s.id === "millionDollarSkill");
          assert.equal(spec?.limit ?? 0, level === 10 ? 1 : 0);
          if (spec) assert.equal(spec.period, "round");
        }
  assert.equal(
    millionDollarSkillPlan({ classLevels: { sniper: 10 } }, rifle, { targetVulnerable: "false" }).blocked,
    true
  );
});
test("the attack chooser can keep the lower result, records its source/target and spends one round use with no ordinary die cost", async () => {
  reset();
  const { a, item } = dollarActor();
  attackNaturals = [2, 19];
  const m = await a.rollRangedAttack(item, dollarInput),
    c = m.flags.spycraft2;
  assert.equal(c.naturalDie, 2);
  assert.equal(c.chosenIndex, 0);
  assert.deepEqual(
    c.alternatives.map(r => r.naturalDie),
    [2, 19]
  );
  assert.equal(c.choiceSource, "Million Dollar Skill");
  assert.equal(c.choiceResourceId, "millionDollarSkill");
  assert.equal(c.attackContext.targetVulnerable, true);
  assert.equal(c.attackContext.millionDollarSkillDeclared, true);
  assert.equal(c.attackContext.targetFlatFooted, false);
  assert.equal(a.system.resourceUses.millionDollarSkill.used, 1);
  assert.equal(a.system.actionDice.value, 1);
  assert.equal(await a.rollRangedAttack(item, dollarInput), null);
  assert.equal(attackRolls, 2);
  round = "r2";
  assert.ok(await a.rollRangedAttack(item, dollarInput));
  assert.equal(a.system.resourceUses.millionDollarSkill.used, 1);
  assert.equal(attackRolls, 4);
});
test("invalid targets, weapons and competing declaration choices do not reserve a round use", async () => {
  reset();
  const { a, item } = dollarActor();
  for (const patch of [{ targetVulnerable: false }, { oneInAMillion: true }])
    assert.equal(await a.rollRangedAttack(item, { ...dollarInput, ...patch }), null);
  item.system.sizeHands = "S/1h";
  assert.equal(await a.rollRangedAttack(item, dollarInput), null);
  assert.equal(a.system.resourceUses.millionDollarSkill, undefined);
  assert.equal(posts.length, 0);
});
test("Cunning Plan can pay its separate scene use in the same attack transaction, and failed posts refund both allowances", async () => {
  reset();
  const { a, item } = dollarActor();
  a.system.classLevels.schemer = 2;
  a.system.abilities.int = { mod: 3 };
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  item.system.errorThreat = "1-7/20";
  failPost = true;
  await assert.rejects(a.rollRangedAttack(item, { ...dollarInput, cunningPlan: true }), /post failed/);
  assert.equal(a.system.resourceUses.millionDollarSkill, undefined);
  assert.equal(a.system.resourceUses.cunningPlan, undefined);
  assert.equal(a.system.actionDice.value, 1);
  failPost = false;
  const m = await a.rollRangedAttack(item, { ...dollarInput, cunningPlan: true });
  assert.equal(m.flags.spycraft2.error, 4);
  assert.equal(a.system.resourceUses.millionDollarSkill.used, 1);
  assert.equal(a.system.resourceUses.cunningPlan.used, 1);
  assert.equal(a.system.actionDice.value, 1);
});
test("fresh weapon checks reject a removed item after reservation; competing last round uses post only one pair of rolls", async () => {
  reset();
  const { a, item } = dollarActor(),
    update = a.update.bind(a);
  let removed = false;
  a.update = async patch => {
    await update(patch);
    if (!removed && patch["system.resourceUses.millionDollarSkill"]) {
      removed = true;
      a.items.splice(0);
    }
  };
  await assert.rejects(a.rollRangedAttack(item, dollarInput), /weapon was removed/);
  assert.equal(a.system.resourceUses.millionDollarSkill, undefined);
  assert.equal(posts.length, 0);
  a.update = update;
  a.items.push(item);
  await Promise.all([a.rollRangedAttack(item, dollarInput), a.rollRangedAttack(item, dollarInput)]);
  assert.equal(posts.length, 1);
  assert.equal(attackRolls, 2);
  assert.equal(a.system.resourceUses.millionDollarSkill.used, 1);
});

test("closing the attack chooser keeps its first roll and consumes the round use instead of permitting a free retry", async () => {
  reset();
  const { a, item } = dollarActor(),
    input = foundry.applications.api.DialogV2.input;
  foundry.applications.api.DialogV2.input = async () => null;
  try {
    attackNaturals = [3, 18];
    const m = await a.rollRangedAttack(item, dollarInput);
    assert.equal(m.flags.spycraft2.naturalDie, 3);
    assert.equal(m.flags.spycraft2.alternatives.length, 2);
    assert.equal(a.system.resourceUses.millionDollarSkill.used, 1);
    assert.equal(await a.rollRangedAttack(item, dollarInput), null);
  } finally {
    foundry.applications.api.DialogV2.input = input;
  }
});

test("attack lighting records the target Defense effect without silently changing the attacker’s bonus or removing unrelated penalties", async () => {
  reset();
  const a = new SpycraftActor();
  a.rollCheck = async (_f, data, options) => ({ data, options });
  const item = { name: "Rifle", uuid: "Actor.sniper.Item.rifle", system: structuredClone(rifle) },
    plain = a.weaponAttack(item),
    dim = await a.rollRangedAttack(item, { distanceFeet: 100, ambientLight: "dim" });
  assert.equal(dim.data.total, plain.total);
  assert.equal(dim.options.attackContext.ambientLight.targetDefenseBonus, 2);
  assert.match(dim.options.flavor, /Target Defense \+2/);
  a.system.classOptionSelections = [{ classId: "sniper", name: "Low-Light Vision" }];
  const improved = await a.rollRangedAttack(item, { distanceFeet: 100, ambientLight: "dim" });
  assert.equal(improved.options.attackContext.ambientLight.targetDefenseBonus, 0);
  const dark = await a.rollRangedAttack(item, { distanceFeet: 100, ambientLight: "none" });
  assert.equal(dark.options.attackContext.ambientLight.targetDefenseBonus, 8);
});

const { gameHunterAttack } = await import("../module/rules/class-checks.mjs");
test("Game Hunter affects every weapon proficiency against actual animal declarations, preserves no-threat weapons, and never changes attack totals", () => {
  for (const proficiency of Object.keys(cfg.proficiencies))
    for (const targetAnimal of [true, false, undefined, "true"])
      for (const errorThreat of ["1/20", "1/2", "1/—"]) {
        const s = state();
        s.classOptionSelections = [{ classId: "scout", name: "Game Hunter" }];
        const w = { ...rifle, proficiency, errorThreat },
          plain = weaponAttack(s, w, cfg),
          r = weaponAttack(s, w, cfg, "agent", { targetAnimal });
        assert.equal(
          r.threat,
          errorThreat === "1/—" ? 0 : targetAnimal === true ? Math.max(1, plain.threat - 3) : plain.threat
        );
        assert.equal(r.total, plain.total);
        assert.equal(r.error, plain.error);
      }
  assert.equal(
    gameHunterAttack({ classOptionSelections: [{ classId: "sniper", name: "Game Hunter" }] }, { targetAnimal: true })
      .threatIncrease,
    0
  );
});
test("Game Hunter is available only at earned Scout Huntsman levels, not from a future or duplicated selection", () => {
  const d = definitions.find(c => c.key === "scout"),
    slot = d.choiceSchedule.findIndex(s => s.level === 6 && s.list === "huntsman");
  for (let n = 0; n <= 20; n++) {
    const items = [{ id: "scout", type: "class", system: { ...d, identifier: "scout", choices: { [slot]: 2 } } }],
      system = {
        abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 14 }])),
        progression: Array.from({ length: n }, () => ({ classId: "scout", vitality: 4, skills: {} }))
      },
      s = computeAgent(system, items, cfg);
    assert.equal(gameHunterAttack(s, { targetAnimal: true }).threatIncrease, n >= 6 ? 3 : 0);
  }
});
test("Game Hunter stacks with independent Sniper threats and the real attack path freezes the target/source receipt", async () => {
  reset();
  const a = new SpycraftActor();
  a.system.classLevels.sniper = 7;
  a.system.classOptionSelections = [{ classId: "scout", name: "Game Hunter" }];
  a.rollCheck = async (_f, data, options) => ({ data, options });
  const item = { name: "Rifle", uuid: "Actor.sniper.Item.rifle", system: structuredClone(rifle) },
    r = await a.rollRangedAttack(item, { distanceFeet: 100, targetAnimal: true, targetFlatFooted: true });
  assert.equal(r.options.threat, 15);
  assert.equal(r.options.attackContext.targetAnimal, true);
  assert.equal(r.options.attackContext.gameHunter.threatIncrease, 3);
  assert.match(r.options.flavor, /Game Hunter/);
  const nonAnimal = await a.rollAttack(item, { targetAnimal: false });
  assert.equal(nonAnimal.options.threat, 20);
});
test("the quick melee attack prompts for Game Hunter before rolling and preserves cancellation", async () => {
  reset();
  const a = new SpycraftActor();
  a.system.classOptionSelections = [{ classId: "scout", name: "Game Hunter" }];
  a.rollCheck = async (_f, data, options) => ({ data, options });
  const item = {
      name: "Knife",
      uuid: "Actor.sniper.Item.knife",
      system: { ...rifle, proficiency: "edged", sizeHands: "T/1h", range: 0, weaponCategory: "" }
    },
    old = foundry.applications.api.DialogV2.input;
  try {
    foundry.applications.api.DialogV2.input = async () => ({ targetAnimal: true });
    assert.equal((await a.rollAttack(item)).options.threat, 17);
    foundry.applications.api.DialogV2.input = async () => null;
    assert.equal(await a.rollAttack(item), null);
  } finally {
    foundry.applications.api.DialogV2.input = old;
  }
});

const { flankingAttackEffects } = await import("../module/rules/class-checks.mjs");
test("flanking covers every proficiency with the distinct unarmed/melee +2 and ranged +1 bonuses, only on an explicit declaration", () => {
  for (const proficiency of Object.keys(cfg.proficiencies)) {
    const s = state(),
      w = { ...rifle, proficiency },
      close = ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(proficiency);
    for (const targetFlanked of [false, undefined, "true", true]) {
      const p = flankingAttackEffects(s, w, { targetFlanked }),
        expected = targetFlanked === true ? (close ? 2 : 1) : 0;
      assert.equal(p.attackBonus, expected);
      const baseline = weaponAttack(s, w, cfg),
        attack = weaponAttack(s, w, cfg, "agent", { targetFlanked });
      assert.equal(attack.total - baseline.total, expected);
    }
  }
  assert.equal(flankingAttackEffects(state(), { ...rifle, qualities: "NKL" }, { targetFlanked: true }).attackBonus, 2);
});
test("Wolfpack adds two to the appropriate base flanking bonus and one threat only for its own declared target, preserving no-threat weapons", () => {
  const s = { ...state(), activeFeatNames: ["Wolfpack Basics", "Wolfpack Supremacy"] };
  assert.equal(flankingAttackEffects(s, rifle, { targetFlanked: true }).attackBonus, 3);
  assert.equal(flankingAttackEffects(s, { ...rifle, proficiency: "edged" }, { targetFlanked: true }).attackBonus, 4);
  const yes = weaponAttack(s, rifle, cfg, "agent", { targetFlanked: true }),
    no = weaponAttack(s, rifle, cfg);
  assert.equal(yes.threat, 19);
  assert.equal(no.threat, 20);
  assert.equal(weaponAttack(s, { ...rifle, errorThreat: "1/—" }, cfg, "agent", { targetFlanked: true }).threat, 0);
  assert.equal(weaponAttack(s, { ...rifle, errorThreat: "1/1" }, cfg, "agent", { targetFlanked: true }).threat, 1);
});
test("measured ranged flanking is limited to current CQB even for weapons with longer reach; unmeasured geometry stays an explicit declaration", () => {
  const s = state();
  assert.equal(weaponAttack(s, rifle, cfg, "agent", { targetFlanked: true, distanceFeet: 30 }).blocked, false);
  const outside = weaponAttack(s, rifle, cfg, "agent", { targetFlanked: true, distanceFeet: 30.01 });
  assert.equal(outside.blocked, true);
  assert.match(outside.reason, /CQB/);
  s.cqbRange = 60;
  assert.equal(weaponAttack(s, rifle, cfg, "agent", { targetFlanked: true, distanceFeet: 60 }).blocked, false);
  const quick = weaponAttack(s, rifle, cfg, "agent", { targetFlanked: true });
  assert.equal(quick.blocked, false);
  assert.equal(quick.flanking.geometryConfirmed, true);
  assert.match(quick.notes, /opposite-side\/adjacency/);
});
test("flanking and Wolfpack combine with independent Sniper and Game Hunter effects in the actual attack context", async () => {
  reset();
  const a = new SpycraftActor();
  a.system.classLevels.sniper = 7;
  a.system.classOptionSelections = [{ classId: "scout", name: "Game Hunter" }];
  a.system.activeFeatNames = ["Wolfpack Basics", "Wolfpack Supremacy"];
  a.rollCheck = async (_f, data, options) => ({ data, options });
  const item = { name: "Rifle", uuid: "Actor.sniper.Item.rifle", system: structuredClone(rifle) },
    r = await a.rollRangedAttack(item, {
      targetAnimal: true,
      targetFlatFooted: true,
      targetFlanked: true,
      distanceFeet: 30
    });
  assert.equal(r.data.total, 10);
  assert.equal(r.options.threat, 14);
  assert.equal(r.options.attackContext.targetFlanked, true);
  assert.equal(r.options.attackContext.flanking.attackBonus, 3);
  assert.equal(a.system.actionDice.value, 1);
});
test("quick sheet-context attacks accept flanking without inventing Game Hunter and cancel before a roll", async () => {
  reset();
  const a = new SpycraftActor();
  a.system.coreClassIds = [];
  a.rollCheck = async (_f, data, options) => ({ data, options });
  const old = foundry.applications.api.DialogV2.input,
    item = {
      name: "Knife",
      system: { ...rifle, proficiency: "edged", range: 0, sizeHands: "T/1h", weaponCategory: "" }
    };
  try {
    foundry.applications.api.DialogV2.input = async () => ({ targetFlanked: true });
    const r = await a.rollAttack(item, { askContext: true });
    assert.equal(r.options.attackContext.flanking.attackBonus, 2);
    assert.equal(r.options.attackContext.gameHunter.threatIncrease, 0);
    foundry.applications.api.DialogV2.input = async () => null;
    assert.equal(await a.rollAttack(item, { askContext: true }), null);
  } finally {
    foundry.applications.api.DialogV2.input = old;
  }
});
