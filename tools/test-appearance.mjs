import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { armorTrainingDRForAttack } from "../module/rules/armor-training.mjs";
import { criticalPlan } from "../module/rules/criticals.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { appearanceCheckPlan, bloodstainDefensePlan } from "../module/rules/appearance.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
const defs = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url)));
const feat = (name, granted = true) => ({
  id: name,
  name,
  type: "feat",
  system: {
    ...structuredClone(defs.find(f => f.name === name)),
    tree: "style",
    granted,
    acquiredAtLevel: name === "Simply Irresistible" ? 6 : ["The Look", "Too Ugly to Die"].includes(name) ? 3 : 1
  }
});
function engine(
  names = [],
  {
    cha = 13,
    lifestyle = 0,
    granted = true,
    conditionContext = {},
    level = 3,
    extraItems = [],
    dressedForLifestyle = false
  } = {}
) {
  const sys = {
    abilities: Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: k === "cha" ? cha : 12, misc: 0 }])
    ),
    progression: Array.from({ length: level }, (_, i) => ({
      classId: "qa",
      vitality: i ? 3 : 6,
      skills: { impress: i ? 1 : 4 }
    })),
    skills: {},
    focuses: { cultures: ["Home"], profession: ["Trade"] },
    proficiencies: {},
    misc: {},
    wealthAllocation: { lifestyle, dressedForLifestyle },
    conditionContext
  };
  const cls = {
    id: "qa",
    type: "class",
    name: "QA",
    system: {
      identifier: "qa",
      vitalityDie: 6,
      skillPoints: 4,
      classSkills: ["impress"],
      table: Array.from({ length: level }, (_, i) => i + 1).map(level => ({
        level,
        bab: level,
        defense: level,
        fort: 1,
        ref: 1,
        will: 1,
        wealth: 5
      }))
    }
  };
  return computeAgent(sys, [cls, ...names.map(n => feat(n, granted)), ...extraItems], cfg);
}
const check = (s, key, id, extra = {}) =>
  resolveSkillCheck(
    s,
    key,
    cfg.skills[key].checks.find(c => c.id === id),
    { synergySkill: "none", gearStatus: "available", ...extra }
  );
test("Gorgeous increases Charisma once, The Look retains that increase and raises actual appearance at every lifestyle", () => {
  for (let lifestyle = 0; lifestyle <= 9; lifestyle++) {
    const base = engine([], { lifestyle }),
      g = engine(["Gorgeous"], { lifestyle }),
      l = engine(["Gorgeous", "The Look"], { lifestyle });
    assert.equal(g.abilities.cha.value, 14);
    assert.equal(l.abilities.cha.value, 14);
    assert.equal(g.wealth.lifestyle.appearanceMod, base.wealth.lifestyle.appearanceMod);
    assert.equal(l.wealth.lifestyle.appearanceMod, base.wealth.lifestyle.appearanceMod + 1);
    assert.equal(l.wealth.lifestyle.rank, base.wealth.lifestyle.rank);
    for (const key of ["cultures", "impress", "networking", "profession"])
      for (const row of l.skillTotals[key].totals) {
        const grow = g.skillTotals[key].totals.find(r => r.ability === row.ability);
        assert.equal(row.normalSkillBonus, grow.normalSkillBonus + 1);
      }
  }
});
test("actual feat acquisition cannot use its own Charisma increase to qualify, while the valid prerequisite chain earns both effects", () => {
  const bad = engine(["Gorgeous"], { cha: 12, granted: false });
  assert.equal(bad.featStatus.Gorgeous.ok, false);
  assert.equal(bad.abilities.cha.value, 12);
  const good = engine(["Gorgeous", "The Look"], { granted: false });
  assert.equal(good.featStatus.Gorgeous.ok, true);
  assert.equal(good.featStatus["The Look"].ok, true);
  assert.equal(good.abilities.cha.value, 14);
  assert.equal(good.wealth.lifestyle.appearanceFeatBonus, 1);
  const dupe = computeAgent(structuredClone(good), [feat("Gorgeous"), { ...feat("Gorgeous"), id: "duplicate" }], cfg);
  assert.equal(dupe.abilities.cha.bonus, 1);
});
test("every Impress/Networking named check gets only the upgraded synergy; all other checks have exact narrow penalties or appearance only", () => {
  for (const names of [[], ["Gorgeous"], ["Gorgeous", "The Look"]]) {
    const s = engine(names),
      look = names.includes("The Look"),
      earned = names.length > 0;
    for (const [key, skill] of Object.entries(cfg.skills))
      for (const c of skill.checks) {
        const p = appearanceCheckPlan(s, key, c),
          positive = ["impress", "networking"].includes(key),
          negative = (key === "blend" && c.id === "stealth") || (key === "falsify" && c.id === "disguise");
        assert.equal(
          p.bonuses.reduce((n, b) => n + b.value, 0),
          earned ? (positive ? (look ? 4 : 2) : negative ? (look ? -2 : -1) : 0) : 0,
          `${names} ${key}/${c.id}`
        );
        assert.equal(p.errorIncrease, look && negative ? 1 : 0);
        assert.equal(p.bonuses.length, earned && (positive || negative) ? 1 : 0);
      }
  }
});
test("synergy uses the largest positive and largest negative sources, and remains separate under Baffled/Incompetent", () => {
  for (const conditionContext of [{}, { baffled: true }, { incompetent: true }]) {
    const s = engine(["Gorgeous", "The Look"], { conditionContext }),
      raw = check(s, "impress", "influence");
    s.skillTotals.senseMotive.ranks = 25;
    const synergy = check(s, "impress", "influence", { synergySkill: "senseMotive" });
    assert.equal(synergy.total, raw.total + 1);
    assert.equal(raw.checkBonusEntries.filter(b => b.source === "The Look")[0].value, 4);
    const stealth = check(s, "blend", "stealth");
    assert.equal(stealth.total, stealth.skillBonus - 2);
  }
});
test("The Look error increase applies to trained and untrained penalized checks before ordinary reductions, never to unrelated checks", () => {
  const s = engine(["Gorgeous", "The Look"]);
  for (const [key, id] of [
    ["blend", "stealth"],
    ["falsify", "disguise"]
  ]) {
    const c = cfg.skills[key].checks.find(c => c.id === id);
    assert.equal(check(s, key, id).error, c.error + 3);
    s.skillTotals[key].ranks = 4;
    assert.equal(check(s, key, id).error, c.error + 1);
    s.skillTotals[key].errorReduction = 1;
    assert.equal(check(s, key, id).error, c.error);
  }
  assert.equal(appearanceCheckPlan(s, "falsify", { id: "forgery" }).errorIncrease, 0);
  assert.equal(appearanceCheckPlan(s, "blend", { id: "manhunt" }, { manhuntPrey: true }).errorIncrease, 1);
  assert.equal(appearanceCheckPlan(s, "blend", { id: "manhunt" }, { manhuntPrey: false }).errorIncrease, 0);
});
test("named skill synergies, penalties and appearance do not leak into associated Knowledge checks", () => {
  const g = engine(["Gorgeous"]),
    l = engine(["Gorgeous", "The Look"]);
  for (const key of Object.keys(cfg.skills)) {
    const a = resolveKnowledgeCheck(g, { skill: key, focus: "Home" }),
      b = resolveKnowledgeCheck(l, { skill: key, focus: "Home" });
    assert.equal(a.total, b.total, key);
    assert.equal(a.error, b.error, key);
  }
});
test("appearance modifier source, penalty scope and error increase are frozen with outcome evidence", () => {
  const s = engine(["Gorgeous", "The Look"]),
    c = { checkKind: "skill", appearanceModifiers: check(s, "blend", "stealth").appearanceModifiers },
    e = rollEvidence(c);
  assert.equal(rollEvidenceMatches(e, c), true);
  for (const key of ["source", "synergy", "errorIncrease", "manhuntPrey", "appearanceBonus"]) {
    const changed = structuredClone(c);
    changed.appearanceModifiers[key] = "changed";
    assert.equal(rollEvidenceMatches(e, changed), false, key);
  }
  assert.equal(rollEvidenceMatches(e, { checkKind: "skill" }), false);
});

test("Simply Irresistible earns its own Charisma increase only after qualifying, keeps The Look appearance and replaces skill modifiers", () => {
  const chain = ["Gorgeous", "The Look", "Simply Irresistible"],
    s = engine(chain, { level: 6, cha: 14, granted: false });
  assert.equal(s.featStatus["Simply Irresistible"].ok, true);
  assert.equal(s.abilities.cha.value, 16);
  assert.equal(s.wealth.lifestyle.appearanceFeatBonus, 1);
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const c of skill.checks) {
      const p = appearanceCheckPlan(s, key, c),
        positive = ["impress", "networking"].includes(key),
        negative = (key === "blend" && c.id === "stealth") || (key === "falsify" && c.id === "disguise");
      assert.equal(
        p.bonuses.reduce((n, b) => n + b.value, 0),
        positive ? 6 : negative ? -4 : 0
      );
      assert.equal(p.errorIncrease, negative ? 1 : 0);
      assert.equal(p.criticalFailureDiscount ?? 0, negative ? 1 : 0);
    }
  const bad = engine(chain, { level: 6, cha: 13, granted: false });
  assert.equal(bad.featStatus["Simply Irresistible"].ok, false);
  assert.equal(bad.abilities.cha.value, 14);
});
test("Simply Irresistible timing has the exact half-time minimum/rounding, method multipliers and single-source competition", () => {
  const s = engine(["Gorgeous", "The Look", "Simply Irresistible"], { level: 6 });
  s.activeFeatNames.push("Hard Core");
  for (const key of ["impress", "networking"])
    for (const c of cfg.skills[key].checks) {
      const p = resolveSkillCheck(s, key, c, { synergySkill: "none", gearStatus: "available" });
      assert.equal(p.timeReduction, "irresistible");
      assert.equal(p.timeMultiplier, 0.5);
      assert.equal(p.minimumTimeSeconds, 6);
      assert.equal(p.timeRounding, "down");
      assert.deepEqual(p.appearanceModifiers.timing, {
        source: "irresistible",
        multiplier: 0.5,
        minimumSeconds: 6,
        rounding: "down"
      });
    }
  const facts = {
    hardCore: true,
    hardCoreTarget: "QA officer",
    hardCoreNPCConfirmed: true,
    hardCoreDisposition: "aloof",
    influenceDuration: "quick"
  };
  assert.equal(check(s, "impress", "influence", facts).timeReduction, "hardCore");
  assert.equal(check(s, "impress", "influence", facts).hardCore.requiredSeconds, 6);
  const forced = check(s, "impress", "influence", { ...facts, timingReduction: "irresistible" });
  assert.equal(forced.hardCore.requiredSeconds, 30);
  assert.equal(forced.hardCore.applied, false);
  for (const method of ["take10", "take20"]) {
    const p = check(s, "impress", "influence", { method, safeToTake: true });
    assert.equal(p.timeMultiplier, method === "take10" ? 1 : 10);
    assert.equal(p.minimumTimeSeconds, 6);
  }
  assert.equal(check(s, "blend", "stealth").timeReduction, "none");
});
test("opponent error activation discounts only penalized skill scopes, honors the one-die floor and stacks cost adjustments", () => {
  const s = engine(["Gorgeous", "The Look", "Simply Irresistible"], { level: 6 }),
    opts = {
      kind: "failure",
      baseCost: 2,
      effect: "Applicable skill critical failure",
      effectConfirmed: true,
      opponent: true,
      lineOfSight: true,
      samePayer: false,
      available: 10
    };
  for (const [skillKey, checkId] of [
    ["blend", "stealth"],
    ["falsify", "disguise"]
  ]) {
    const c = { checkKind: "skill", skillKey, checkId, errorConfirmed: true };
    assert.equal(criticalPlan(s, c, opts).cost, 1);
    assert.equal(criticalPlan(s, c, { ...opts, baseCost: 1 }).cost, 1);
    assert.equal(criticalPlan(s, { ...c, criticalFailureCostIncrease: 1 }, opts).cost, 2);
    assert.equal(criticalPlan(s, { ...c, weaponQualities: "UNR" }, { ...opts, baseCost: 1 }).cost, 1);
    assert.equal(criticalPlan(s, { ...c, cleanAndPolished: true }, opts).cost, 2);
    assert.equal(criticalPlan(s, { ...c, errorConfirmed: false }, opts).blocked, true);
  }
  for (const c of [
    { checkKind: "skill", skillKey: "impress", checkId: "influence" },
    { checkKind: "skill", skillKey: "falsify", checkId: "forgery" },
    { checkKind: "knowledge", skillKey: "blend", checkId: "stealth" },
    { checkKind: "attack", skillKey: "blend", checkId: "stealth" }
  ])
    assert.equal(criticalPlan(s, { ...c, errorConfirmed: true }, opts).cost, 2);
  const prey = {
    checkKind: "skill",
    skillKey: "blend",
    checkId: "manhunt",
    errorConfirmed: true,
    appearanceModifiers: { manhuntPrey: true }
  };
  assert.equal(criticalPlan(s, prey, opts).cost, 1);
  assert.equal(criticalPlan(s, { ...prey, appearanceModifiers: null }, opts).cost, 2);
});
test("Simply Irresistible does not add another Appearance step or leak skill timing/penalties into Knowledge", () => {
  const look = engine(["Gorgeous", "The Look"], { level: 6, cha: 14 }),
    s = engine(["Gorgeous", "The Look", "Simply Irresistible"], { level: 6, cha: 14 });
  assert.equal(s.wealth.lifestyle.appearanceMod, look.wealth.lifestyle.appearanceMod);
  for (const key of Object.keys(cfg.skills)) {
    assert.equal(resolveKnowledgeCheck(s, { skill: key }).total, resolveKnowledgeCheck(look, { skill: key }).total);
    assert.equal(resolveKnowledgeCheck(s, { skill: key }).timeMultiplier, 1);
  }
  const p = check(s, "impress", "influence"),
    c = { checkKind: "skill", appearanceModifiers: p.appearanceModifiers },
    e = rollEvidence(c);
  c.appearanceModifiers.timing.multiplier = 0.25;
  assert.equal(rollEvidenceMatches(e, c), false);
});

test("Too Ugly to Die grants two independent DR in every attack category, including unarmored and quality-dominated cases", () => {
  const base = engine(),
    s = engine(["Too Ugly to Die"]);
  assert.equal(s.dr.melee, base.dr.melee + 2);
  assert.equal(s.dr.other, base.dr.other + 2);
  assert.equal(s.damageReductionComponents.feat, 2);
  for (const natural of [0, 20])
    for (const cover of [0, 3])
      for (const kind of ["unarmed", "meleeWeapon", "hurledWeapon", "rangedWeapon", "other"]) {
        const x = {
            damageReductionComponents: {
              ...base.damageReductionComponents,
              natural,
              armorMelee: 5,
              armorOther: 2,
              feat: cover
            },
            armorFeatRules: { meleeWeaponDR: 1, rangedWeaponDR: 2, meleeAttackDR: 1, rangedAttackDR: 1 }
          },
          y = { ...x, damageReductionComponents: { ...x.damageReductionComponents, feat: cover + 2 } };
        assert.equal(armorTrainingDRForAttack(y, kind), armorTrainingDRForAttack(x, kind) + 2);
      }
  for (const kind of ["unarmed", "meleeWeapon", "hurledWeapon", "rangedWeapon", "other"])
    assert.equal(s.armorDRByAttack[kind], base.armorDRByAttack[kind] + 2);
});
test("Too Ugly to Die penalizes every Blend/Networking check and stacks by synergy type with appearance bonuses and penalties", () => {
  for (const names of [[], ["Gorgeous"], ["Gorgeous", "The Look"], ["Gorgeous", "The Look", "Simply Irresistible"]]) {
    const base = engine(names, { level: 6 }),
      s = engine([...names, "Too Ugly to Die"], { level: 6 });
    for (const [key, skill] of Object.entries(cfg.skills))
      for (const c of skill.checks) {
        const normal = appearanceCheckPlan(base, key, c),
          p = appearanceCheckPlan(s, key, c),
          ugly = ["blend", "networking"].includes(key);
        assert.equal(
          p.bonuses.filter(b => b.source === "Too Ugly to Die").length,
          ugly ? 1 : 0,
          `${names} ${key}/${c.id}`
        );
        assert.equal(p.errorIncrease, normal.errorIncrease);
        const a = resolveSkillCheck(base, key, c, { synergySkill: "none", gearStatus: "available" }),
          b = resolveSkillCheck(s, key, c, { synergySkill: "none", gearStatus: "available" });
        if (!ugly) assert.equal(a.total, b.total);
        else if (key === "networking") assert.equal(b.total, a.total - 4);
        else assert.equal(b.total, b.skillBonus - 4);
      }
    for (const key of Object.keys(cfg.skills))
      assert.equal(resolveKnowledgeCheck(s, { skill: key }).total, resolveKnowledgeCheck(base, { skill: key }).total);
  }
});
test("Too Ugly to Die needs its level-three Hard Core prerequisite and cannot duplicate DR; losing the source changes frozen penalty evidence", () => {
  const good = engine(["Hard Core", "Too Ugly to Die"], { granted: false });
  assert.equal(good.featStatus["Too Ugly to Die"].ok, true);
  assert.equal(good.damageReductionComponents.feat, 2);
  const bad = engine(["Too Ugly to Die"], { granted: false });
  assert.equal(bad.featStatus["Too Ugly to Die"].ok, false);
  assert.equal(bad.damageReductionComponents.feat, 0);
  const duplicate = computeAgent(
    structuredClone(good),
    [feat("Too Ugly to Die"), { ...feat("Too Ugly to Die"), id: "duplicateUgly" }],
    cfg
  );
  assert.equal(duplicate.damageReductionComponents.feat, 2);
  const c = { checkKind: "skill", appearanceModifiers: check(good, "blend", "stealth").appearanceModifiers },
    e = rollEvidence(c);
  c.appearanceModifiers.uglyPenalty = 0;
  assert.equal(rollEvidenceMatches(e, c), false);
});

test("Bloodstain Resistant requires an earned feat, a strict clothing declaration and a positive effective Appearance at every Lifestyle rank", () => {
  for (let lifestyle = 0; lifestyle <= 9; lifestyle++)
    for (const look of [false, true]) {
      const names = look ? ["Gorgeous", "The Look"] : [],
        normal = engine(names, { lifestyle, dressedForLifestyle: true }),
        s = engine([...names, "Bloodstain Resistant"], { lifestyle, dressedForLifestyle: true });
      assert.equal(s.bloodstainDefense.bonus, Math.max(0, s.wealth.lifestyle.appearanceMod));
      assert.equal(s.defense.total - normal.defense.total, s.bloodstainDefense.bonus);
      assert.equal(s.wealth.lifestyle.rank, normal.wealth.lifestyle.rank);
    }
  const s = { activeFeatNames: ["Bloodstain Resistant"], wealthAllocation: { dressedForLifestyle: "true" } };
  assert.equal(bloodstainDefensePlan(s, { appearance: 4 }).bonus, 0);
  s.wealthAllocation.dressedForLifestyle = true;
  assert.equal(bloodstainDefensePlan(s, { appearance: NaN }).bonus, 0);
  s.activeFeatNames = [];
  assert.equal(bloodstainDefensePlan(s, { appearance: 4 }).bonus, 0);
});
test("only actually worn armor blocks the bonus; obvious and unknown Notice/Search DCs hold it without guessing", () => {
  const armor = (patch = {}) => ({
      id: "body",
      type: "armor",
      name: "QA armor",
      system: {
        armorType: "P",
        armorSlot: "body",
        equipped: true,
        carried: true,
        quantity: 1,
        notice: "Obvious",
        weight: 0,
        ...patch
      }
    }),
    options = { lifestyle: 8, dressedForLifestyle: true };
  for (const patch of [{}, { notice: " obvious " }, { notice: "OBVIOUS" }, { notice: "" }]) {
    const s = engine(["Bloodstain Resistant"], { ...options, extraItems: [armor(patch)] });
    assert.equal(s.bloodstainDefense.bonus, 0);
    assert.ok(s.bloodstainDefense.reason);
  }
  for (const patch of [
    { equipped: false },
    { carried: false },
    { reserve: true },
    { destroyed: true },
    { quantity: 0 },
    { notice: "20D" },
    { notice: "—" }
  ]) {
    const s = engine(["Bloodstain Resistant"], { ...options, extraItems: [armor(patch)] });
    assert.equal(s.bloodstainDefense.bonus, 3, JSON.stringify(patch));
  }
  const hidden = armor({ notice: "20D" }),
    helmet = armor({ armorSlot: "helmet" });
  helmet.id = "helmet";
  helmet.name = "QA helmet";
  assert.equal(
    engine(["Bloodstain Resistant"], { ...options, extraItems: [hidden, helmet] }).bloodstainDefense.bonus,
    0
  );
  const duplicate = armor();
  duplicate.id = "duplicate";
  assert.equal(
    engine(["Bloodstain Resistant"], { ...options, extraItems: [hidden, duplicate] }).bloodstainDefense.bonus,
    3
  );
});
test("Bloodstain Resistant is an ordinary Defense bonus, persists when dodge is lost, and requires its historical Impress ranks", () => {
  for (const conditionContext of [{ flatFooted: true }, { vulnerable: true }, { blinded: true }]) {
    const s = engine(["Bloodstain Resistant"], { lifestyle: 8, dressedForLifestyle: true, conditionContext }),
      base = engine([], { lifestyle: 8, dressedForLifestyle: true, conditionContext });
    assert.equal(s.defense.total - base.defense.total, 3);
    assert.ok(s.bonusSources.defense.some(e => e.source === "Bloodstain Resistant" && e.value === 3));
  }
  const s = engine(["Bloodstain Resistant"], { granted: false, lifestyle: 8, dressedForLifestyle: true });
  assert.equal(s.featStatus["Bloodstain Resistant"].ok, true);
  assert.equal(s.bloodstainDefense.bonus, 3);
});
