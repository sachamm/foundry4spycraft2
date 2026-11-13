#!/usr/bin/env node
/**
 * Engine regression test: builds sample agents from the compiled compendium packs and
 * compares derived values with the saved reference figures in tools/fixtures/*.json.
 *
 *   npm run build && npm test
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";
import { SKILLS, TABLES } from "../module/rules/tables.mjs";
import { computeAgent } from "../module/rules/engine.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Minimal CONFIG.SPYCRAFT without importing config.mjs's Foundry-free parts twice.
const cfg = {
  skills: Object.fromEntries(SKILLS.map(s => [s.key, s])),
  tables: TABLES,
  pointBuy: 36,
  abilityIncreaseLevels: [4, 8, 12, 16, 20],
  featTrees: Object.fromEntries(["basicCombat", "meleeCombat", "rangedCombat", "unarmedCombat", "chance", "chase", "covert", "gear",
    "basicSkill", "advancedSkill", "style", "terrain", "tradecraft"].map(k => [k, k])),
  proficiencies: Object.fromEntries(["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged", "explosives", "guided", "handgun", "hurled",
    "exoticHurled", "indirectFire", "rifle", "shotgun", "submachineGun", "tactical", "vehicleWeapon"].map(k => [k, { label: k }]))
};

async function loadPack(name) {
  const db = new ClassicLevel(join(ROOT, "packs", name), { valueEncoding: "json" });
  const docs = [];
  for await (const [k, v] of db.iterator()) if (k.startsWith("!items!")) docs.push(v);
  await db.close();
  return Object.fromEntries(docs.map(d => [d.name, d]));
}
const packs = {};
for (const p of ["classes", "origins", "feats", "weapons", "armor"]) packs[p] = await loadPack(p);
const clone = o => structuredClone(o);

function blankAgent() {
  const sys = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 8, misc: 0 }])),
    pointBuyBudget: 36, abilityIncreases: { l4: "", l8: "", l12: "", l16: "", l20: "" },
    progression: [], skills: Object.fromEntries(SKILLS.map(s => [s.key, { ability: "", misc: 0, classSkill: false }])),
    proficiencies: Object.fromEntries(Object.keys(cfg.proficiencies).map(k => [k, { proficient: false, forte: false }])),
    focuses: { cultures: [], drive: [], profession: [], science: [], fortes: [] }, interests: "", contacts: [], subplots: [],
    wealthAllocation: { lifestyle: 0, possessions: 0, spendingCash: 0 }, misc: {}, vitality: { value: 0 }, wounds: { value: 0 }, actionDice: { value: 0 }
  };
  return sys;
}

/** Build an agent from a fixture spec. */
function build(spec) {
  const sys = blankAgent();
  const items = [];
  let n = 0;
  const add = (doc, patch = {}) => { const d = clone(doc); Object.assign(d.system, patch); items.push({ id: `i${n++}`, name: d.name, type: d.type, system: d.system }); return d; };
  Object.entries(spec.abilities).forEach(([k, v]) => (sys.abilities[k].base = v));
  Object.assign(sys.abilityIncreases, spec.increases ?? {});
  if (spec.talent) add(packs.origins[spec.talent]);
  if (spec.specialty) add(packs.origins[spec.specialty]);
  const classDocs = {};
  for (const [i, cname] of spec.classes.entries()) {
    if (!classDocs[cname]) classDocs[cname] = add(packs.classes[cname]);
    sys.progression.push({ classId: classDocs[cname].system.identifier, vitality: spec.vitality?.[i] ?? 0, skills: spec.skillPoints?.[i] ?? {} });
  }
  for (const f of spec.feats ?? []) add(packs.feats[f]);
  // Mirror SpycraftActor#syncGrantedFeats: origins and class levels grant feats automatically.
  const granted = new Set(spec.grantedFeats ?? []);
  for (const i of items) if (i.type === "origin") (i.system.grants ?? []).forEach(g => granted.add(g));
  const lv = {};
  for (const c of spec.classes) lv[c] = (lv[c] ?? 0) + 1;
  for (const [c, l] of Object.entries(lv)) for (const g of packs.classes[c].system.featGrants) if (g.level <= l) granted.add(g.feat);
  for (const f of granted) if (packs.feats[f] && !(spec.feats ?? []).includes(f)) add(packs.feats[f], { granted: true });
  for (const [k, v] of Object.entries(spec.proficiencies ?? {})) sys.proficiencies[k].proficient = v;
  computeAgent(sys, items, cfg);
  return sys;
}

let failures = 0, checks = 0;
function expect(label, actual, expected) {
  checks++;
  if (actual !== expected) { failures++; console.log(`  ✗ ${label}: got ${actual}, expected ${expected}`); }
}

const FIX = join(ROOT, "tools", "fixtures");
const fixtures = existsSync(FIX) ? readdirSync(FIX).filter(f => f.endsWith(".json")) : [];
for (const file of fixtures) {
  const fx = JSON.parse(readFileSync(join(FIX, file), "utf8"));
  console.log(`• ${fx.name}`);
  const s = build(fx.spec);
  const e = fx.expected;
  for (const k of ["str", "dex", "con", "int", "wis", "cha"]) expect(`${k} score`, s.abilities[k].value, e.abilities[k]);
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
  sys.progression = [{ classId: brawler.system.identifier, vitality: 0, skills: {},
    expertEntry: {ok: true, unmet: []} }];
  computeAgent(sys, [{ id: "brawler", name: brawler.name, type: brawler.type, system: clone(brawler.system) }], cfg);
  expect("entry snapshot prevents retroactive expert warning",
    sys.warnings.some(w => w.includes("expert class requirements")), false);
}


console.log("• feat prerequisites suppress effects, including self-qualification");
{
  const soldier = packs.classes.Soldier;
  const sys = blankAgent();
  sys.abilities.dex.base = 10;
  sys.progression = [{ classId: soldier.system.identifier, vitality: 0, skills: {} }];
  const feat = { id: "invalid", name:"Self-boost", type:"feat", system: {
    tree:"basicCombat", ranks:1, granted:false, prerequisites: {type:"ability",key:"dex",min:20},
    bonuses:[{target:"abilities.dex",value:"10",level:0}]
  }};
  const items=[{id:"soldier",name:"Soldier",type:"class",system:clone(soldier.system)},feat];
  computeAgent(sys,items,cfg);
  expect("self-qualification is disallowed",sys.abilities.dex.value,10);
  expect("self-boost is unavailable",sys.featStatus.invalid.ok,false);
  sys.abilities.dex.base=20;
  computeAgent(sys,items,cfg);
  expect("eligible feat becomes active",sys.abilities.dex.value,30);
  expect("eligible feat satisfies prerequisites",sys.featStatus.invalid.ok,true);
}

console.log(`\n${checks - failures}/${checks} checks passed across ${fixtures.length} fixture(s).`);
process.exit(failures ? 1 : 0);
