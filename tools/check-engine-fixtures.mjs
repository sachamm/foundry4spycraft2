#!/usr/bin/env node
/**
 * Engine regression check: builds sample agents from the compendium documents generated from src/data and
 * compares derived values with the saved reference figures in tools/fixtures/*.json.
 *
 *   npm test
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPacks } from "./lib/pack-docs.mjs";
import { SKILLS, TABLES } from "../module/rules/tables.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { computeAgent, prerequisiteContext } from "../module/rules/engine.mjs";
import { checkPrerequisites } from "../module/rules/prerequisites.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Minimal CONFIG.SPYCRAFT without importing config.mjs's Foundry-free parts twice.
const cfg = {
  skills: Object.fromEntries(SKILLS.map(s => [s.key, s])),
  tables: TABLES,
  pointBuy: 36,
  abilityIncreaseLevels: [4, 8, 12, 16, 20],
  featTrees: Object.fromEntries(
    [
      "basicCombat",
      "meleeCombat",
      "rangedCombat",
      "unarmedCombat",
      "chance",
      "chase",
      "covert",
      "gear",
      "basicSkill",
      "advancedSkill",
      "style",
      "terrain",
      "tradecraft"
    ].map(k => [k, k])
  ),
  proficiencies: Object.fromEntries(
    [
      "unarmed",
      "blunt",
      "exoticBlunt",
      "edged",
      "exoticEdged",
      "explosives",
      "guided",
      "handgun",
      "hurled",
      "exoticHurled",
      "indirectFire",
      "rifle",
      "shotgun",
      "submachineGun",
      "tactical",
      "vehicleWeapon"
    ].map(k => [k, { label: k }])
  )
};

// Documents come straight from src/data through the pack builder, so this runs without built packs.
const built = buildPacks().packs;
const packs = {};
for (const p of ["classes", "origins", "feats", "weapons", "armor"])
  packs[p] = Object.fromEntries(built[p].docs.map(d => [d.name, d]));
const clone = o => structuredClone(o);

function blankAgent() {
  const sys = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 8, misc: 0 }])),
    pointBuyBudget: 36,
    abilityIncreases: { l4: "", l8: "", l12: "", l16: "", l20: "" },
    progression: [],
    skills: Object.fromEntries(SKILLS.map(s => [s.key, { ability: "", misc: 0, classSkill: false }])),
    proficiencies: Object.fromEntries(
      Object.keys(cfg.proficiencies).map(k => [k, { proficient: false, forte: false }])
    ),
    focuses: { cultures: [], drive: [], profession: [], science: [], fortes: [] },
    interests: "",
    contacts: [],
    subplots: [],
    wealthAllocation: { lifestyle: 0, possessions: 0, spendingCash: 0 },
    misc: {},
    vitality: { value: 0 },
    wounds: { value: 0 },
    actionDice: { value: 0 }
  };
  return sys;
}

/** Build an agent from a fixture spec. */
function build(spec) {
  const sys = blankAgent();
  const items = [];
  let n = 0;
  const add = (doc, patch = {}) => {
    const d = clone(doc);
    Object.assign(d.system, patch);
    items.push({ id: `i${n++}`, name: d.name, type: d.type, system: d.system });
    return d;
  };
  Object.entries(spec.abilities).forEach(([k, v]) => (sys.abilities[k].base = v));
  Object.assign(sys.abilityIncreases, spec.increases ?? {});
  if (spec.talent) add(packs.origins[spec.talent]);
  if (spec.specialty) add(packs.origins[spec.specialty]);
  const classDocs = {};
  for (const [i, cname] of spec.classes.entries()) {
    if (!classDocs[cname]) classDocs[cname] = add(packs.classes[cname]);
    sys.progression.push({
      classId: classDocs[cname].system.identifier,
      vitality: spec.vitality?.[i] ?? 0,
      skills: spec.skillPoints?.[i] ?? {}
    });
  }
  for (const f of spec.feats ?? []) add(packs.feats[f]);
  // Mirror SpycraftActor#syncGrantedFeats: origins and class levels grant feats automatically.
  const granted = new Set(spec.grantedFeats ?? []);
  for (const i of items) if (i.type === "origin") (i.system.grants ?? []).forEach(g => granted.add(g));
  const lv = {};
  for (const c of spec.classes) lv[c] = (lv[c] ?? 0) + 1;
  for (const [c, l] of Object.entries(lv))
    for (const g of packs.classes[c].system.featGrants) if (g.level <= l) granted.add(g.feat);
  for (const f of granted)
    if (packs.feats[f] && !(spec.feats ?? []).includes(f)) add(packs.feats[f], { granted: true });
  for (const [k, v] of Object.entries(spec.proficiencies ?? {})) sys.proficiencies[k].proficient = v;
  computeAgent(sys, items, cfg);
  return sys;
}

let failures = 0,
  checks = 0;
function expect(label, actual, expected) {
  checks++;
  if (actual !== expected) {
    failures++;
    console.log(`  ✗ ${label}: got ${actual}, expected ${expected}`);
  }
}

const FIX = join(ROOT, "tools", "fixtures");
const fixtures = existsSync(FIX) ? readdirSync(FIX).filter(f => f.endsWith(".json")) : [];
for (const file of fixtures) {
  const fx = JSON.parse(readFileSync(join(FIX, file), "utf8"));
  console.log(`• ${fx.name}`);
  const s = build(fx.spec);
  const e = fx.expected;
  for (const k of ["str", "dex", "con", "int", "wis", "cha"])
    expect(`${k} score`, s.abilities[k].value, e.abilities[k]);
  expect("point-buy remaining", s.pointBuy.remaining, e.pointsRemaining);
  expect("career level", s.level, e.level);
  expect("BAB", s.bab, e.bab);
  expect("Fort", s.saves.fort.total, e.fort);
  expect("Ref", s.saves.ref.total, e.ref);
  expect("Will", s.saves.will.total, e.will);
  expect("Defense", s.defense.total, e.defense);
  expect("Initiative", s.initiative.total, e.init);
  expect("Wealth", s.wealth.total, e.wealth);
  for (const g of ["R", "T", "V", "S", "G", "W", "E"]) expect(`Gear ${g}`, s.gearPicks[g].available, e.gear[g]);
  expect("Vitality", s.vitality.max, e.vitality);
  expect("Wounds", s.wounds.max, e.wounds);
  expect("Speed", s.speed, e.speed);
  expect("Knowledge", s.knowledge, e.knowledge);
  expect("Action dice", s.actionDice.max, e.actionDice);
  expect("Action die", s.actionDice.die, e.actionDie);
  expect("Interests", s.interestPicks.available, e.interests);
  expect("Contacts", s.contactPicks.available, e.contacts);
  expect("Subplots", s.subplotPicks.available, e.subplots);
  expect("Max ranks", s.maxRanks, e.maxRanks);
  s.skillPoints.forEach((sp, i) => expect(`Skill points L${i + 1}`, sp.available, e.skillPoints[i]));
  expect("skill purchase issues", s.skillPurchaseIssues.length, 0);
  s.skillPoints.forEach((sp, i) => expect(`Unspent skill points L${i + 1}`, sp.remaining, 0));
  expect("reference skill history length", e.skillHistory.length, fx.spec.classes.length);
  for (const [i, expected] of e.skillHistory.entries()) {
    const stage = build({
      ...fx.spec,
      classes: fx.spec.classes.slice(0, i + 1),
      vitality: fx.spec.vitality?.slice(0, i + 1),
      skillPoints: fx.spec.skillPoints.slice(0, i + 1)
    });
    for (const skill of SKILLS)
      expect(
        `L${i + 1} ${skill.key} purchased ranks`,
        stage.skillTotals[skill.key].purchasedRanks,
        expected[skill.key] ?? 0
      );
    const next = packs.classes[fx.spec.classes[i + 1]];
    if (next?.system.expert && !fx.spec.classes.slice(0, i + 1).includes(next.name)) {
      const trees = stage.activeFeatSelections.reduce((out, feat) => {
        out[feat.tree] = (out[feat.tree] ?? 0) + 1;
        return out;
      }, {});
      const context = prerequisiteContext(
        stage,
        new Set(stage.activeFeatNames.map(name => name.toLowerCase())),
        trees,
        Object.fromEntries(SKILLS.map(skill => [skill.key, stage.skillTotals[skill.key].purchasedRanks]))
      );
      expect(`${next.name} prerequisites before entry`, checkPrerequisites(next.system.requirements, context).ok, true);
    }
  }
  for (const [k, v] of Object.entries(e.skills)) {
    expect(`${k} ranks`, s.skillTotals[k].ranks, v.ranks);
    expect(`${k} bonus`, s.skillTotals[k].bonus, v.bonus);
    expect(`${k} threat`, s.skillTotals[k].threat, v.threat);
    expect(`${k} cap`, s.skillTotals[k].cap, v.cap);
  }
  if (s.warnings.length) console.log(`  warnings: ${s.warnings.join(" | ")}`);
  if (process.env.SHOW_TODO) console.log(`  to do: ${s.todo.map(t => t.text).join(" | ")}`);
}

console.log("• historical progression: Scientist Int bonus arrives at class level 6");
{
  const sci = packs.classes.Scientist;
  const sys = blankAgent();
  sys.abilities.int.base = 13;
  sys.progression = Array.from({ length: 6 }, () => ({ classId: sci.system.identifier, vitality: 1, skills: {} }));
  computeAgent(sys, [{ id: "scientist", name: sci.name, type: sci.type, system: clone(sci.system) }], cfg);
  const basePoints = sci.system.skillPoints;
  expect("Scientist skill points at career level 1", sys.skillPoints[0].available, 4 * (basePoints + 1));
  expect("Scientist skill points at career level 5", sys.skillPoints[4].available, basePoints + 1);
  expect("Scientist skill points at career level 6", sys.skillPoints[5].available, basePoints + 2);
}
console.log("• historical expert-class eligibility snapshot");
{
  const brawler = packs.classes.Brawler;
  const sys = blankAgent();
  sys.progression = [
    { classId: brawler.system.identifier, vitality: 0, skills: {}, expertEntry: { ok: true, unmet: [] } }
  ];
  computeAgent(sys, [{ id: "brawler", name: brawler.name, type: brawler.type, system: clone(brawler.system) }], cfg);
  expect(
    "entry snapshot prevents retroactive expert warning",
    sys.warnings.some(w => w.includes("expert class requirements")),
    false
  );
}

console.log("• feat prerequisites suppress effects, including self-qualification");
{
  const soldier = packs.classes.Soldier;
  const sys = blankAgent();
  sys.abilities.dex.base = 10;
  sys.progression = [{ classId: soldier.system.identifier, vitality: 0, skills: {} }];
  const feat = {
    id: "invalid",
    name: "Self-boost",
    type: "feat",
    system: {
      tree: "basicCombat",
      ranks: 1,
      granted: false,
      prerequisites: { type: "ability", key: "dex", min: 20 },
      bonuses: [{ target: "abilities.dex", value: "10", level: 0 }]
    }
  };
  const items = [{ id: "soldier", name: "Soldier", type: "class", system: clone(soldier.system) }, feat];
  computeAgent(sys, items, cfg);
  expect("self-qualification is disallowed", sys.abilities.dex.value, 10);
  expect("self-boost is unavailable", sys.featStatus.invalid.ok, false);
  sys.abilities.dex.base = 20;
  computeAgent(sys, items, cfg);
  expect("eligible feat becomes active", sys.abilities.dex.value, 30);
  expect("eligible feat satisfies prerequisites", sys.featStatus.invalid.ok, true);
}

console.log("• legal and illegal purchase-time skill ranks");
{
  const soldier = packs.classes.Soldier;
  const ci = { id: "soldier", name: soldier.name, type: soldier.type, system: clone(soldier.system) };
  const legal = blankAgent();
  for (const [k, v] of Object.entries({ str: 14, dex: 14, con: 14, int: 13, wis: 12, cha: 10 }))
    legal.abilities[k].base = v;
  legal.progression = [{ classId: ci.system.identifier, vitality: 0, skills: { athletics: 4 } }];
  computeAgent(legal, [ci], cfg);
  expect("valid 36-point allocation", legal.pointBuy.remaining, 0);
  expect(
    "legal skill rank allocation has no rank warning",
    legal.warnings.some(w => w.includes("ranks")),
    false
  );

  const over = blankAgent();
  over.progression = Array.from({ length: 8 }, (_, i) => ({
    classId: ci.system.identifier,
    vitality: 1,
    skills: i === 0 ? { athletics: 6 } : {}
  }));
  computeAgent(over, [ci], cfg);
  expect(
    "a level above the character's XP is flagged",
    over.warnings.some(w => /Career Level 8 needs \d+ XP; this character has 0\./.test(w)),
    true
  );
  expect(
    "front-loaded ranks flagged even after the career cap increases",
    over.warnings.some(w => w.includes("purchase-time maximum")),
    true
  );

  // Overspending holds the guidance on its step instead of letting it move on.
  const spent = blankAgent();
  for (const [k, v] of Object.entries({ str: 18, dex: 18, con: 14, int: 13, wis: 12, cha: 10 }))
    spent.abilities[k].base = v;
  spent.progression = [
    {
      classId: ci.system.identifier,
      vitality: 0,
      skills: { athletics: 4, drive: 4, notice: 4, tactics: 4, survival: 4, intimidate: 4, resolve: 4 }
    }
  ];
  computeAgent(spent, [ci], cfg);
  const errorAt = tab => spent.todo.some(t => t.error && t.tab === tab);
  expect("attribute overspend is a reminder on attributes", errorAt("main") && spent.pointBuy.remaining < 0, true);
  expect("skill overspend is a reminder on skills", errorAt("skills") && spent.skillPoints[0].remaining < 0, true);
}

console.log("• result caps follow Table 2.4, untrained error range, vitality floor");
{
  const soldier = packs.classes.Soldier;
  const ci = { id: "soldier", name: soldier.name, type: soldier.type, system: clone(soldier.system) };
  // Class-skill points per level chosen so the running ranks hit each band edge of Table 2.4.
  const want = { 0: 15, 1: 20, 3: 20, 4: 30, 6: 30, 7: 40, 9: 40, 10: 50, 12: 50, 13: 60 };
  for (const [ranks, cap] of Object.entries(want)) {
    const sys = blankAgent();
    const n = Number(ranks);
    sys.progression = Array.from({ length: 10 }, (_, i) => ({
      classId: ci.system.identifier,
      vitality: 1,
      skills: i === 0 && n ? { athletics: Math.min(n, 4) } : i > 0 && n > 3 + i ? { athletics: 1 } : {}
    }));
    computeAgent(sys, [ci], cfg);
    expect(`fixture built ${ranks} Athletics ranks`, sys.skillTotals.athletics.ranks, n);
    expect(`${ranks} ranks -> result cap ${cap}`, sys.skillTotals.athletics.cap, cap);
    expect(
      `${ranks} ranks -> error range`,
      resolveSkillCheck(sys, "athletics", cfg.skills.athletics.checks[0], {
        gearStatus: "available",
        synergySkill: "none"
      }).error,
      cfg.skills.athletics.checks[0].error + (n ? 0 : 2)
    );
  }
  const frail = blankAgent();
  frail.abilities.con.base = 8; // -1 modifier; creation attributes have a minimum of 8
  frail.progression = [1, 1, 5, 0].map((v, i) => ({ classId: ci.system.identifier, vitality: i ? v : 0, skills: {} }));
  computeAgent(frail, [ci], cfg);
  // L1: 12-1 = 11; L2: roll 1-1 -> 1; L3: 5-1 = 4; L4 pending roll retains the minimum 1.
  expect("Con penalty never takes a level's vitality below 1", frail.vitality.max, 17);
}

console.log(`\n${checks - failures}/${checks} checks passed across ${fixtures.length} fixture(s).`);
process.exit(failures ? 1 : 0);
