// These fixtures supply required gear unless a case explicitly overrides gearStatus; absence/kit boundaries are tested in test-skill-gear.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import {
  sensoryAttackConditionPlan,
  sensorySkillConditionPlan,
  sensorySkillEffects,
  baseSensoryRanges,
  ambientLightPlan,
  sensoryTargetPlan,
  improvedVisionRangePlan
} from "../module/rules/senses.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { weaponAttack } from "../module/rules/gear.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { readFile } from "node:fs/promises";
const qualities = ["Improved hearing", "Improved scent", "Improved vision"],
  state = () => ({
    level: 6,
    bab: 6,
    size: "Medium",
    activeFeatNames: [],
    classOptionSelections: [],
    originEffects: qualities.map(name => ({ source: "Test Subject", name })),
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { mod: 3, value: 16 }])),
    proficiencyTotals: { rifle: { proficient: true } },
    skillTotals: {
      notice: { name: "Notice", ranks: 3, cap: 20, threat: 20, totals: [{ ability: "wis", total: 6 }] },
      survival: { name: "Survival", ranks: 6, cap: 30, threat: 20, totals: [{ ability: "wis", total: 9 }] }
    },
    actionDice: { value: 0 }
  });
const rifle = {
  proficiency: "rifle",
  weaponCategory: "assaultRifle",
  sizeHands: "S/2h",
  range: 100,
  recoil: 1,
  errorThreat: "1/20",
  fireMode: "single",
  fireModes: ["single"]
};
test("every named skill option restricts hearing/scent bonuses to their actual use and declared circumstances", () => {
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const check of skill.checks)
      for (const deafened of [false, true]) {
        const s = state(),
          p = sensorySkillEffects(s, key, check, { surprise: true, scentUsable: true, deafened }),
          hearing =
            !deafened &&
            ((key === "notice" && check.id === "awareness") || (key === "search" && check.id === "perception")),
          scent = key === "survival" && check.id === "tracking";
        assert.equal(p.hearing, hearing, key + "/" + check.id);
        assert.equal(p.scent, scent, key + "/" + check.id);
        assert.equal(
          p.bonuses.reduce((n, b) => n + b.value, 0),
          hearing || scent ? 6 : 0
        );
      }
  const c = cfg.skills.notice.checks.find(c => c.id === "awareness");
  assert.equal(sensorySkillEffects(state(), "notice", c).hearing, false);
  assert.equal(sensorySkillEffects({ ...state(), originEffects: [] }, "notice", c, { surprise: true }).hearing, false);
});
test("conditional quality bonuses preserve actual check modifiers and independent class effects, without leaking into Knowledge", () => {
  const s = state();
  s.classLevels = { sleuth: 4 };
  s.classOptionSelections = [{ classId: "sleuth", name: "Alertness" }];
  s.armor = { visionCheck: -3 };
  const c = cfg.skills.notice.checks.find(c => c.id === "awareness"),
    base = resolveSkillCheck(s, "notice", c, { gearStatus: "available", synergySkill: "none" }),
    r = resolveSkillCheck(s, "notice", c, { gearStatus: "available", surprise: true, synergySkill: "none" });
  assert.equal(r.total, base.total + 10);
  const t = cfg.skills.survival.checks.find(c => c.id === "tracking");
  assert.equal(
    resolveSkillCheck(s, "survival", t, {
      gearStatus: "available",
      trackingSurface: "verySoft",
      scentUsable: true,
      synergySkill: "none"
    }).total,
    12
  );
  s.knowledge = 5;
  assert.equal(resolveKnowledgeCheck(s, { skill: "notice", surprise: true, scentUsable: true }).total, 5);
});
test("Improved Vision reduces each measured attack’s range penalty by two to minimum zero without extending maximum range", () => {
  for (let used = 1; used <= 10; used++) {
    const s = state(),
      r = weaponAttack(s, rifle, cfg, "agent", { distanceFeet: used * 100 });
    assert.equal(r.rangePenaltyBase, used > 1 ? -2 * (used - 1) : 0);
    assert.equal(r.rangePenalty, Math.min(0, -2 * (used - 1) + 2));
    assert.equal(r.range, 100);
    assert.equal(r.maximumRange, 1000);
    assert.equal(r.blocked, false);
  }
  assert.equal(weaponAttack(state(), rifle, cfg, "agent", { distanceFeet: 1001 }).blocked, true);
  assert.equal(weaponAttack(state(), rifle, cfg, "agent", { distanceFeet: 300, blinded: true }).rangePenalty, -4);
  assert.equal(
    weaponAttack(state(), rifle, cfg, "agent", { distanceFeet: 300, ambientLight: "none" }).rangePenalty,
    -4
  );
  assert.equal(
    weaponAttack({ ...state(), originEffects: [] }, rifle, cfg, "agent", { distanceFeet: 300 }).rangePenalty,
    -4
  );
});
test("Night Training halves only low-light visual-range penalties and retains total darkness, skill penalties and target Defense", () => {
  for (const ambientLight of ["__proto__", "constructor", "unknown"])
    assert.throws(() => ambientLightPlan(state(), { ambientLight }));
  const s = { ...state(), activeFeatNames: ["Night Training"] };
  for (const [ambientLight, delta, skill, defense] of [
    ["none", null, -8, 8],
    ["faint", -30, -4, 4],
    ["dim", -15, -2, 2],
    ["moderate", 0, 0, 0],
    ["bright", 30, 1, -2]
  ]) {
    const p = ambientLightPlan(s, { ambientLight, visionCheck: true });
    assert.equal(p.visualDelta, delta);
    assert.equal(p.skillModifier, skill);
    assert.equal(p.targetDefenseBonus, defense);
  }
  s.classOptionSelections = [{ classId: "scout", name: "Low-Light Vision" }];
  assert.equal(ambientLightPlan(s, { ambientLight: "dim", visionCheck: true }).visualDelta, 0);
});
test("Night Training’s hearing exception requires a character within ten feet, an actual blindness source and no deafness", () => {
  const s = { ...state(), activeFeatNames: ["Night Training"] };
  for (const distanceFeet of [0, 10, 10.01, null, "", NaN])
    for (const targetCharacter of [true, false])
      for (const deafened of [true, false]) {
        const p = sensoryTargetPlan(s, { blinded: true, targetCharacter, deafened, distanceFeet }),
          eligible =
            typeof distanceFeet === "number" &&
            Number.isFinite(distanceFeet) &&
            distanceFeet <= 10 &&
            targetCharacter &&
            !deafened;
        assert.equal(p.nightTrainingException, eligible);
        assert.equal(p.blinded, !eligible);
      }
  assert.equal(sensoryTargetPlan(state(), { blinded: true, targetCharacter: true, distanceFeet: 5 }).blinded, true);
  const p = improvedVisionRangePlan(s, -6, { ambientLight: "none", targetCharacter: true, distanceFeet: 5 });
  assert.equal(p.rangePenalty, -4);
  assert.equal(p.sensoryTarget.nightTrainingException, true);
  assert.equal(
    improvedVisionRangePlan(s, -6, { ambientLight: "none", targetCharacter: true, distanceFeet: 5, deafened: true })
      .rangePenalty,
    -6
  );
});
test("unmodified base ranges use the proper fixed bases rather than adding replacement multiples; Night Training scent yields to Improved Scent", () => {
  for (const wis of [0, 10, 16]) {
    const s = state();
    s.abilities.wis.value = wis;
    assert.deepEqual(
      [baseSensoryRanges(s).visualIncrement, baseSensoryRanges(s).hearingIncrement, baseSensoryRanges(s).scentRange],
      [20 * wis, 10 * wis, 10 * wis]
    );
    s.originEffects = [];
    assert.deepEqual(
      [baseSensoryRanges(s).visualIncrement, baseSensoryRanges(s).hearingIncrement, baseSensoryRanges(s).scentRange],
      [10 * wis, 5 * wis, wis]
    );
    s.activeFeatNames = ["Night Training"];
    assert.equal(baseSensoryRanges(s).scentRange, 3 * wis);
    s.originEffects = [{ name: "Improved scent" }];
    assert.equal(baseSensoryRanges(s).scentRange, 10 * wis);
  }
});
const origins = JSON.parse(await readFile(new URL("../src/data/origins.json", import.meta.url), "utf8")),
  classes = JSON.parse(await readFile(new URL("../src/data/classes.json", import.meta.url), "utf8")),
  feats = JSON.parse(await readFile(new URL("../src/data/feats.json", import.meta.url), "utf8"));
test("actual Test Subject selections and usable/expired Night Training drive derived Main ranges instead of arbitrary prose", () => {
  const scout = classes.find(c => c.key === "scout"),
    subject = origins.specialties.find(o => o.name === "Test Subject"),
    items = [
      { id: "scout", name: "Scout", type: "class", system: { ...scout, identifier: "scout", vitalityDie: 10 } },
      {
        id: "subject",
        name: "Test Subject",
        type: "origin",
        system: { ...subject, originChoices: { npcQuality0: "improvedHearing", npcQuality1: "improvedVision" } }
      },
      {
        id: "night",
        name: "Night Training",
        type: "feat",
        system: {
          ...feats.find(f => f.name === "Night Training"),
          tree: "terrain",
          acquiredAtLevel: 1,
          featKind: "temporary",
          temporaryGrant: { period: "session", epoch: "s" }
        }
      }
    ],
    source = {
      usagePeriods: { session: "s" },
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 16 }])),
      progression: [{ classId: "scout", vitality: 5, skills: { notice: 3 } }]
    },
    s = computeAgent(structuredClone(source), items, cfg);
  assert.equal(s.senses.visualIncrement, 320);
  assert.equal(s.senses.hearingIncrement, 160);
  assert.equal(s.senses.scentRange, 48);
  const expired = computeAgent({ ...structuredClone(source), usagePeriods: { session: "later" } }, items, cfg);
  assert.equal(expired.senses.scentRange, 16);
});
globalThis.Actor = class {
  constructor() {
    this.system = state();
    this.items = [];
    this.statuses = new Set();
    this.type = "agent";
    this.uuid = "Actor.senses";
    this.isOwner = true;
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, settings: { get: () => false }, i18n: { localize: s => s } };
globalThis.foundry = { utils: { escapeHTML: s => String(s) } };
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("actual skill entry rechecks recorded deafness and explicit circumstances, recording the applied quality with no resource cost", async () => {
  const a = new SpycraftActor();
  a.rollCheck = async (formula, data, options) => ({ data, options });
  const input = { check: "awareness", surprise: true, synergySkill: "none" },
    yes = await a.rollSkill("notice", "wis", { gearStatus: "available", ...input });
  assert.equal(yes.data.total, 12);
  assert.equal(yes.options.senses.hearing, true);
  a.statuses.add("deaf");
  assert.equal((await a.rollSkill("notice", "wis", { gearStatus: "available", ...input })).data.total, -2);
  a.statuses.clear();
  assert.equal(
    (await a.rollSkill("notice", "wis", { gearStatus: "available", ...input, deafened: true })).data.total,
    -2
  );
  assert.equal(a.system.actionDice.value, 0);
});
test("actual attack entry honors recorded blindness and freezes its range adjustment and nearby-character exception", async () => {
  const a = new SpycraftActor();
  a.rollCheck = async (formula, data, options) => ({ data, options });
  const item = { name: "Rifle", uuid: "Actor.senses.Item.rifle", system: structuredClone(rifle) },
    yes = await a.rollRangedAttack(item, { distanceFeet: 300 });
  assert.equal(yes.options.attackContext.improvedVisionReduction, 2);
  assert.equal(yes.options.attackContext.rangePenaltyBase, -4);
  a.statuses.add("blind");
  const no = await a.rollRangedAttack(item, { distanceFeet: 300 });
  assert.equal(no.options.attackContext.improvedVisionReduction, 0);
  a.system.activeFeatNames = ["Night Training"];
  const near = await a.rollRangedAttack(item, { distanceFeet: 10, targetCharacter: true });
  assert.equal(near.options.attackContext.sensoryTarget.nightTrainingException, true);
  assert.equal(near.options.attackContext.sensoryTarget.blinded, false);
});

const { keenSensesSources } = await import("../module/rules/senses.mjs");
test("Keen Senses applies once from either earned class, after replacement bases, and never stacks same-named non-legacy sources", () => {
  for (const sources of [[], ["scout"], ["sleuth"], ["scout", "sleuth"], ["soldier"]]) {
    const s = state();
    s.classOptionSelections = sources.map(classId => ({ classId, name: "Keen Senses" }));
    const p = baseSensoryRanges(s),
      bonus = sources.some(c => ["scout", "sleuth"].includes(c)) ? 20 : 0;
    assert.equal(p.visualIncrement, 320 + bonus);
    assert.equal(p.hearingIncrement, 160 + bonus);
    assert.equal(p.scentRange, 160 + bonus);
    assert.equal(p.keenSensesBonus, bonus);
    assert.equal(keenSensesSources(s).length, sources.filter(c => ["scout", "sleuth"].includes(c)).length);
    s.originEffects = [];
    s.activeFeatNames = ["Night Training"];
    assert.equal(baseSensoryRanges(s).scentRange, 48 + bonus);
  }
});
test("every Scout/Sleuth level uses the actual earned Keen Senses schedule and choice, with future choices excluded", () => {
  for (const classId of ["scout", "sleuth"]) {
    const d = classes.find(c => c.key === classId),
      menu = d.choiceLists.find(l => l.options.some(o => o.name === "Keen Senses")),
      option = menu.options.find(o => o.name === "Keen Senses"),
      index = d.choiceSchedule.findIndex(s => s.list === menu.key),
      at = d.choiceSchedule[index].level;
    assert.equal(at, classId === "scout" ? 6 : 5);
    for (let level = 0; level <= 20; level++) {
      const system = {
          abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 16 }])),
          progression: Array.from({ length: level }, () => ({ classId, vitality: 5, skills: {} }))
        },
        s = computeAgent(
          system,
          [
            {
              id: classId,
              name: d.name,
              type: "class",
              system: { ...d, identifier: classId, vitalityDie: 10, choices: { [index]: option.index } }
            }
          ],
          cfg
        );
      assert.equal(s.senses.keenSensesBonus, level >= at ? 20 : 0, classId + "/" + level);
      assert.equal(s.senses.visualIncrement, s.abilities.wis.value * 10 + (level >= at ? 20 : 0));
    }
  }
});
test("actual multiclass duplicate sources keep the one +20 bonus while preserving both earned choices for review", () => {
  const ids = ["scout", "sleuth"],
    items = ids.map(classId => {
      const d = classes.find(c => c.key === classId),
        menu = d.choiceLists.find(l => l.options.some(o => o.name === "Keen Senses")),
        option = menu.options.find(o => o.name === "Keen Senses"),
        index = d.choiceSchedule.findIndex(s => s.list === menu.key);
      return {
        id: classId,
        name: d.name,
        type: "class",
        system: { ...d, identifier: classId, vitalityDie: 10, choices: { [index]: option.index } }
      };
    }),
    system = {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 16 }])),
      progression: [
        ...Array.from({ length: 6 }, () => ({ classId: "scout", vitality: 5, skills: {} })),
        ...Array.from({ length: 5 }, () => ({ classId: "sleuth", vitality: 5, skills: {} }))
      ]
    },
    s = computeAgent(system, items, cfg);
  assert.deepEqual(s.senses.keenSources.sort(), ids.sort());
  assert.equal(s.senses.visualIncrement, 180);
  assert.equal(s.senses.hearingIncrement, 100);
  assert.equal(s.senses.scentRange, 36);
});

import { fogSmokePlan } from "../module/rules/senses.mjs";
test("all fog/smoke density rows match Table 5.14; Firefighter halves only smoke visual range and never the skill/Defense columns", () => {
  for (const [density, visual, skill, defense] of [
    ["light", -10, -1, 1],
    ["moderate", -20, -2, 2],
    ["dense", -40, -4, 4]
  ])
    for (const obscurant of ["fog", "smoke"])
      for (const firefighter of [false, true]) {
        const s = state();
        s.activeFeatNames = ["Night Training", ...(firefighter ? ["Firefighter Training"] : [])];
        s.classOptionSelections = [{ classId: "scout", name: "Low-Light Vision" }];
        const p = fogSmokePlan(s, { obscurant, obscurantDensity: density, visionCheck: true });
        assert.equal(p.visualDelta, obscurant === "smoke" && firefighter ? visual / 2 : visual);
        assert.equal(p.skillModifier, skill);
        assert.equal(p.targetDefenseBonus, defense);
        assert.equal(fogSmokePlan(s, { obscurant, obscurantDensity: density }).skillModifier, 0);
      }
  for (const input of [
    { obscurant: "smoke" },
    { obscurantDensity: "dense" },
    { obscurant: "rain", obscurantDensity: "dense" },
    { obscurant: "fog", obscurantDensity: "constructor" },
    { obscurant: "smoke", obscurantDensity: "__proto__" }
  ])
    assert.throws(() => fogSmokePlan(state(), input));
  assert.equal(fogSmokePlan(state()).specified, false);
});
test("fog/smoke skill modifiers affect every Vision-tag use exactly once, with no Hearing-only or Knowledge leakage", () => {
  const s = state();
  s.knowledge = 6;
  s.skillTotals = Object.fromEntries(
    Object.values(cfg.skills).map(skill => [
      skill.key,
      {
        name: skill.name,
        ranks: 10,
        cap: 50,
        threat: 20,
        totals: skill.abilities.map(ability => ({ ability, total: 13 }))
      }
    ])
  );
  s.activeFeatNames = ["Firefighter Training"];
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const check of skill.checks) {
      const base = resolveSkillCheck(s, key, check, {
          gearStatus: "available",
          synergySkill: "none",
          trackingSurface: "verySoft"
        }),
        smoke = resolveSkillCheck(s, key, check, {
          gearStatus: "available",
          synergySkill: "none",
          trackingSurface: "verySoft",
          obscurant: "smoke",
          obscurantDensity: "dense"
        });
      assert.equal(smoke.total - base.total, check.tags.includes("Vision") ? -4 : 0, key + "/" + check.id);
      assert.equal(smoke.cap, base.cap);
    }
  assert.equal(
    resolveKnowledgeCheck(s, { skill: "search", obscurant: "smoke", obscurantDensity: "dense" }).total,
    resolveKnowledgeCheck(s, { skill: "search" }).total
  );
});
test("weapon fog/smoke records target Defense separately without changing the attacker’s bonus or measured weapon range", () => {
  const s = state();
  s.activeFeatNames = ["Firefighter Training"];
  const base = weaponAttack(s, rifle, cfg, "agent", { distanceFeet: 300 }),
    smoke = weaponAttack(s, rifle, cfg, "agent", {
      distanceFeet: 300,
      obscurant: "smoke",
      obscurantDensity: "dense",
      ambientLight: "bright"
    });
  assert.equal(smoke.total, base.total);
  assert.equal(smoke.range, base.range);
  assert.equal(smoke.fogSmoke.visualDelta, -20);
  assert.equal(smoke.fogSmoke.targetDefenseBonus, 4);
  assert.equal(smoke.ambientLight.targetDefenseBonus, -2);
  assert.match(smoke.notes, /target Defense \+4/);
});
test("actual skill and attack entries freeze the selected fog/smoke and source-limited Firefighter adjustment", async () => {
  const a = new SpycraftActor();
  a.system.skillTotals.search = {
    name: "Search",
    ranks: 3,
    cap: 20,
    threat: 20,
    totals: [{ ability: "int", total: 6 }]
  };
  a.system.activeFeatNames = ["Firefighter Training"];
  a.rollCheck = async (formula, data, options) => ({ data, options });
  const skill = await a.rollSkill("search", "int", {
    gearStatus: "available",
    check: "perception",
    obscurant: "smoke",
    obscurantDensity: "moderate",
    synergySkill: "none"
  });
  assert.equal(skill.options.fogSmoke.visualDelta, -10);
  assert.equal(skill.options.fogSmoke.skillModifier, -2);
  const item = { name: "Rifle", uuid: "Actor.senses.Item.rifle", system: structuredClone(rifle) },
    attack = await a.rollRangedAttack(item, { distanceFeet: 100, obscurant: "fog", obscurantDensity: "moderate" });
  assert.equal(attack.options.attackContext.fogSmoke.visualDelta, -20);
  assert.equal(attack.options.attackContext.fogSmoke.firefighter, false);
  assert.equal(a.system.actionDice.value, 0);
});

test("every named skill option receives only its own blinded/deafened and target-Language penalties and cap reductions", () => {
  const s = state();
  s.knowledge = 6;
  s.skillTotals = Object.fromEntries(
    Object.values(cfg.skills).map(skill => [
      skill.key,
      {
        name: skill.name,
        ranks: 13,
        cap: 60,
        threat: 20,
        totals: skill.abilities.map(ability => ({ ability, total: 16 }))
      }
    ])
  );
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const check of skill.checks) {
      const opts = { gearStatus: "available", synergySkill: "none", trackingSurface: "verySoft" },
        base = resolveSkillCheck(s, key, check, opts);
      for (const [blinded, deafened, targetDeafened] of [
        [true, false, false],
        [false, true, false],
        [false, false, true],
        [true, true, true]
      ]) {
        const r = resolveSkillCheck({ ...s, conditionContext: { blinded, deafened } }, key, check, {
            ...opts,
            targetDeafened
          }),
          v = blinded && check.tags.includes("Vision"),
          h = deafened && check.tags.includes("Hearing"),
          l = targetDeafened && check.tags.includes("Language");
        assert.equal(r.total - base.total, (v ? -8 : 0) + (h ? -8 : 0), key + "/" + check.id);
        assert.equal(
          r.cap,
          Math.max(0, base.cap + (v ? -20 : 0) + (h ? -10 : 0) + (l ? -20 : 0)),
          key + "/" + check.id
        );
      }
    }
  assert.equal(
    resolveKnowledgeCheck({ ...s, conditionContext: { blinded: true, deafened: true } }, { skill: "notice" }).total,
    resolveKnowledgeCheck(s, { skill: "notice" }).total
  );
});
test("sensory cap reductions floor at zero and block below five without changing earned ranks or attributes", () => {
  const s = state(),
    check = { ...cfg.skills.notice.checks.find(c => c.id === "awareness"), tags: ["Vision", "Hearing", "Language"] };
  s.conditionContext = { blinded: true, deafened: true };
  const before = structuredClone(s),
    r = resolveSkillCheck(s, "notice", check, { gearStatus: "available", targetDeafened: true, synergySkill: "none" });
  assert.equal(r.cap, 0);
  assert.equal(r.total, -10);
  assert.equal(r.blocked, true);
  assert.match(r.blockedReason, /cap is below 5/);
  assert.deepEqual(s, before);
});
test("required eyesight/hearing is a separate explicit prohibition and a sensory tag alone does not invent it", () => {
  const check = { tags: [] },
    s = { conditionContext: { blinded: true, deafened: true } };
  assert.equal(sensorySkillConditionPlan(s, check).blockedReason, "");
  assert.match(sensorySkillConditionPlan(s, check, { requiresEyesight: true }).blockedReason, /eye-hand coordination/);
  assert.match(sensorySkillConditionPlan(s, check, { requiresHearing: true }).blockedReason, /requires hearing/);
  assert.equal(
    sensorySkillConditionPlan({}, check, { requiresEyesight: true, requiresHearing: true }).blockedReason,
    ""
  );
});
test("Night Training suppresses blindness for a nearby character only while hearing remains available; target deafness is independent", () => {
  const s = { ...state(), conditionContext: { blinded: true }, activeFeatNames: ["Night Training"] },
    check = { tags: ["Vision", "Language"] };
  for (const distanceFeet of [0, 10, 11, null]) {
    const p = sensorySkillConditionPlan(s, check, { targetCharacter: true, distanceFeet, targetDeafened: true }),
      near = distanceFeet !== null && distanceFeet <= 10;
    assert.equal(p.nightTrainingException, near);
    assert.equal(p.capAdjustment, near ? -20 : -40);
    assert.equal(p.skillModifier, near ? 0 : -8);
  }
  s.conditionContext.deafened = true;
  assert.equal(
    sensorySkillConditionPlan(s, check, { targetCharacter: true, distanceFeet: 5 }).nightTrainingException,
    false
  );
});
test("persistent deafness disables Improved hearing even for pure resolvers and cannot be undone by a false situational option", () => {
  const s = { ...state(), conditionContext: { deafened: true } },
    c = cfg.skills.notice.checks.find(c => c.id === "awareness");
  assert.equal(sensorySkillEffects(s, "notice", c, { surprise: true, deafened: false }).hearing, false);
  const r = resolveSkillCheck(s, "notice", c, {
    gearStatus: "available",
    synergySkill: "none",
    surprise: true,
    deafened: false
  });
  assert.equal(r.senses.hearing, false);
  assert.equal(r.sensoryConditions.deafened, true);
  assert.equal(r.cap, 10);
  assert.equal(r.total, -2);
});
test("actual skill entry freezes sensory penalties/caps and blocks a declared impossible hearing check before rolling", async () => {
  const a = new SpycraftActor();
  a.statuses.add("deaf");
  let rolls = 0;
  a.rollCheck = async (formula, data, options) => {
    rolls++;
    return { data, options };
  };
  const m = await a.rollSkill("notice", "wis", { gearStatus: "available", check: "awareness", synergySkill: "none" });
  assert.equal(m.data.total, -2);
  assert.equal(m.options.cap, 10);
  assert.equal(m.options.sensoryConditions.capAdjustment, -10);
  assert.equal(m.options.sensoryConditions.skillModifier, -8);
  assert.equal(
    await a.rollSkill("notice", "wis", { gearStatus: "available", check: "awareness", requiresHearing: true }),
    null
  );
  assert.equal(rolls, 1);
  assert.equal(a.system.actionDice.value, 0);
});

test("blind attacks record target Defense +8 for melee and measured/unmeasured ranged attacks without inventing an attack penalty; unavailable Improved vision still loses its range benefit", () => {
  const normal = state(),
    blind = { ...state(), conditionContext: { blinded: true } };
  for (const weapon of [rifle, { proficiency: "edged", sizeHands: "S/1h", errorThreat: "1/20", damage: "1d6" }])
    for (const options of [{}, { distanceFeet: 10 }, { distanceFeet: 300 }]) {
      const a = weaponAttack(normal, weapon, cfg, "agent", options),
        b = weaponAttack(blind, weapon, cfg, "agent", options);
      assert.equal(b.total, a.total - (a.improvedVisionReduction ?? 0));
      assert.equal(b.sensoryConditions.targetDefenseBonus, 8);
      assert.match(b.notes, /target Defense \+8/);
      assert.equal(b.blocked, a.blocked);
    }
  assert.equal(sensoryAttackConditionPlan(blind, { blinded: false }).targetDefenseBonus, 8);
  assert.equal(
    sensoryAttackConditionPlan(normal, { ambientLight: "none" }).targetDefenseBonus,
    0,
    "illumination already has its own table row; do not duplicate it as an explicit condition"
  );
});
test("persistent blindness/deafness governs range benefits and Night Training even for pure attack resolvers", () => {
  const s = { ...state(), activeFeatNames: ["Night Training"], conditionContext: { blinded: true } };
  assert.equal(baseSensoryRanges(s).blinded, true);
  assert.equal(baseSensoryRanges(s).deafened, false);
  assert.equal(weaponAttack(s, rifle, cfg, "agent", { distanceFeet: 300 }).improvedVisionReduction, 0);
  assert.equal(sensoryAttackConditionPlan(s, { targetCharacter: true, distanceFeet: 10 }).targetDefenseBonus, 0);
  s.conditionContext.deafened = true;
  assert.equal(baseSensoryRanges(s).deafened, true);
  assert.equal(
    sensoryAttackConditionPlan(s, { targetCharacter: true, distanceFeet: 10, deafened: false }).targetDefenseBonus,
    8
  );
});
test("actual unmeasured attack freezes the explicit blindness Defense modifier independently of ambient light and weapon range", async () => {
  const a = new SpycraftActor();
  a.statuses.add("blind");
  a.rollCheck = async (formula, data, options) => ({ data, options });
  const item = { name: "Rifle", uuid: "Item.sensoryRifle", system: structuredClone(rifle) },
    m = await a.rollAttack(item, {});
  assert.equal(m.options.attackContext.sensoryConditions.targetDefenseBonus, 8);
  assert.equal(m.options.attackContext.rangeKnown, false);
  assert.equal(a.system.actionDice.value, 0);
});
