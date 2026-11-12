/**
 * Spycraft 2.0 character engine: derives an agent's modifiers and final totals from its build choices.
 *
 * Pure functions: no Foundry globals, so the engine can be unit-tested in Node.
 * `computeAgent(system, items, cfg)` mutates `system` (an AgentData instance or plain object)
 * by adding derived values.
 */
import { evaluate, stepLookup } from "./formula.mjs";
import { checkPrerequisites } from "./prerequisites.mjs";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const GEAR = ["R", "T", "V", "S", "G", "W", "E"];
const mod = score => Math.floor((score - 10) / 2);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const norm = s => String(s ?? "").trim().toLowerCase();

function setPath(obj, path, value) {
  const keys = path.split(".");
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys.at(-1)] = value;
}

/** Accumulates bonus values by target. */
class Bonuses {
  constructor() { this.map = new Map(); this.sources = new Map(); }
  add(target, value, source) {
    if (!target || !value) return;
    this.map.set(target, (this.map.get(target) ?? 0) + value);
    if (source) {
      if (!this.sources.has(target)) this.sources.set(target, []);
      this.sources.get(target).push({ source, value });
    }
  }
  get(target) { return this.map.get(target) ?? 0; }
  /** Sum of every target starting with prefix, keyed by remainder. */
  group(prefix) {
    const out = {};
    for (const [k, v] of this.map) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
    return out;
  }
}

/**
 * @param {object} sys     agent system data (mutated)
 * @param {object[]} items { id, name, type, system } for every embedded item
 * @param {object} cfg     CONFIG.SPYCRAFT
 */
export function computeAgent(sys, items, cfg) {
  const T = cfg.tables;
  const warnings = [];
  /** Things still left to pick: { order, tab, text, always?, browse?, skillLevel? } */
  let todo = [];
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const levelRow = l => T.levels[clamp(l, 0, 20)];

  /* ---------------- Classes & career level ---------------- */
  const classItems = items.filter(i => i.type === "class");
  const classById = new Map(classItems.map(i => [i.system.identifier || i.name, i]));
  const progression = sys.progression ?? [];
  const level = progression.length;
  sys.level = level;
  sys.details ??= {};
  sys.details.level = level;
  const classLevels = {};
  const classAtLevel = [];
  for (const entry of progression) {
    const ci = classById.get(entry.classId);
    classAtLevel.push(ci ?? null);
    if (!ci) { warnings.push(`Unknown class "${entry.classId}" in level progression.`); continue; }
    classLevels[entry.classId] = (classLevels[entry.classId] ?? 0) + 1;
  }
  sys.classLevels = classLevels;

  const base = { bab: 0, fort: 0, ref: 0, will: 0, defense: 0, initiative: 0, wealth: 0 };
  const gearBase = Object.fromEntries(GEAR.map(g => [g, 0]));
  const classesData = {};
  for (const [cid, lvl] of Object.entries(classLevels)) {
    const ci = classById.get(cid);
    const row = ci.system.table.find(r => r.level === lvl) ?? ci.system.table.at(-1) ?? {};
    for (const k of Object.keys(base)) base[k] += row[k] ?? 0;
    for (const g of GEAR) gearBase[g] += row[`gear${g}`] ?? 0;
    classesData[cid] = { levels: lvl, ...row };
    if (lvl > ci.system.table.length && ci.system.table.length) warnings.push(`${ci.name} has a maximum of ${ci.system.table.length} levels.`);
  }
  sys.base = base;
  for (const originType of ["talent", "specialty"]) {
    if (!items.some(i => i.type === "origin" && i.system.originType === originType)) {
      todo.push({ order: originType === "talent" ? 1 : 2, always: true, tab: "main", browse: { type: "origin", originType }, text: `Choose a ${originType}.` });
    }
  }
  if (!level) todo.push({ order: 3, always: true, tab: "classes", browse: { type: "class", originType: "" }, text: "Take a first class level." });

  /* ---------------- Collect bonus sources ---------------- */
  const sources = [];   // { name, bonuses, rank }
  for (const i of items) {
    if (i.type === "origin") sources.push({ name: i.name, bonuses: i.system.bonuses ?? [], rank: 1 });
    else if (i.type === "feat") sources.push({ name: i.name, bonuses: i.system.bonuses ?? [], rank: i.system.ranks ?? 1 });
    else if (i.type === "class") {
      const lvl = classLevels[i.system.identifier || i.name] ?? 0;
      if (!lvl) continue;
      sources.push({ name: i.name, bonuses: (i.system.bonuses ?? []).filter(b => (b.level ?? 0) <= lvl), rank: 1 });
      const lists = Object.fromEntries((i.system.choiceLists ?? []).map(L => [L.key, L]));
      let unpicked = 0;
      (i.system.choiceSchedule ?? []).forEach((slot, idx) => {
        if (slot.level > lvl) return;
        const pick = i.system.choices?.[idx];
        const options = lists[slot.list]?.options ?? [];
        const opt = pick === null || pick === undefined || pick === "" ? null : options.find(o => o.index === Number(pick));
        if (opt) sources.push({ name: `${i.name}: ${opt.name}`, bonuses: opt.bonuses ?? [], rank: 1 });
        else if (options.length) unpicked += 1;
      });
      if (unpicked) todo.push({ order: 20, tab: "classes", text: `${i.name}: ${plural(unpicked, "class-ability choice")} to make.` });
    }
  }

  const tb = {
    t1: stepLookup(T.talentBonus.t1, level), t2: stepLookup(T.talentBonus.t2, level), t3: stepLookup(T.talentBonus.t3, level),
    interestBase: stepLookup(T.interests.map(r => [r[0], r[1]]), level),
    interestTalent: stepLookup(T.interests.map(r => [r[0], r[2]]), level),
    interestSpec: stepLookup(T.interests.map(r => [r[0], r[3]]), level)
  };
  const lr = levelRow(level);

  /* ---------------- Phase A: attributes ---------------- */
  const abilityBonus = new Bonuses();
  const preData = { level, tb, classes: classesData, base, rank: 1 };
  for (const s of sources) for (const b of s.bonuses) {
    if (b.target?.startsWith("abilities.")) abilityBonus.add(b.target.slice(10), evaluate(b.value, { ...preData, rank: s.rank }), s.name);
  }
  const increases = sys.abilityIncreases ?? {};
  const increaseAt = l => increases[`l${l}`] || "";
  let pointCost = 0;
  for (const k of ABILITIES) {
    const a = sys.abilities[k];
    a.increase = cfg.abilityIncreaseLevels.filter(l => l <= level && increaseAt(l) === k).length;
    a.bonus = abilityBonus.get(k);
    a.value = a.base + a.increase + (a.misc ?? 0) + a.bonus;
    a.mod = mod(a.value);
    a.cost = T.abilityScores.find(r => r.score === a.base)?.cost;
    if (typeof a.cost !== "number") { a.cost = 0; warnings.push(`${k.toUpperCase()} ${a.base} is outside the point-buy table.`); }
    pointCost += a.cost;
  }
  const increasesDue = cfg.abilityIncreaseLevels.filter(l => l <= level);
  const increasesMissing = increasesDue.filter(l => !increaseAt(l)).length;
  if (increasesMissing) todo.push({ order: 11, tab: "main", text: `${plural(increasesMissing, "attribute increase")} to assign.` });
  sys.pointBuy = { budget: sys.pointBuyBudget ?? cfg.pointBuy, spent: pointCost };
  sys.pointBuy.remaining = sys.pointBuy.budget - pointCost;
  if (sys.pointBuy.remaining < 0) warnings.push(`Attribute point-buy overspent by ${-sys.pointBuy.remaining}.`);
  if (sys.pointBuy.remaining > 0) todo.push({ order: 10, always: true, tab: "main", text: `${plural(sys.pointBuy.remaining, "attribute point")} left to spend.` });
  const abil = Object.fromEntries(ABILITIES.map(k => [k, { value: sys.abilities[k].value, mod: sys.abilities[k].mod }]));
  /** Attribute modifier as it stood at a given career level (only earlier increases). */
  const modAt = (k, l) => {
    const a = sys.abilities[k];
    const inc = cfg.abilityIncreaseLevels.filter(x => x <= l && increaseAt(x) === k).length;
    return mod(a.base + inc + (a.misc ?? 0) + a.bonus);
  };

  /* ---------------- Skills: ranks ---------------- */
  const skillDefs = Object.values(cfg.skills);
  const talentClassSkill = new Set();
  for (const s of sources) for (const b of s.bonuses) {
    const m = b.target?.match(/^skills\.(\w+)\.classSkill$/);
    if (m && evaluate(b.value, preData)) talentClassSkill.add(m[1]);
  }
  const isClassSkillAt = (key, idx) => {
    if (talentClassSkill.has(key) || sys.skills?.[key]?.classSkill) return true;
    const ci = classAtLevel[idx];
    return !!ci?.system.classSkills?.includes(key);
  };
  const skillRanks = {};
  const skillPoints = [];
  progression.forEach((entry, idx) => {
    let spent = 0;
    for (const sd of skillDefs) {
      const pts = Number(entry.skills?.[sd.key] ?? 0) || 0;
      if (!pts) continue;
      spent += pts;
      skillRanks[sd.key] = (skillRanks[sd.key] ?? 0) + (isClassSkillAt(sd.key, idx) ? pts : pts / 2);
    }
    skillPoints.push({ level: idx + 1, spent, available: 0, classId: entry.classId });
  });
  for (const k of Object.keys(skillRanks)) skillRanks[k] = Math.floor(skillRanks[k]);

  /* ---------------- Feats ---------------- */
  const featItems = items.filter(i => i.type === "feat");
  const featNames = new Set(featItems.map(i => norm(i.name)));
  const featTrees = {};
  for (const f of featItems) featTrees[f.system.tree] = (featTrees[f.system.tree] ?? 0) + (f.system.ranks ?? 1);

  /* ---------------- Phase B: all other bonuses ---------------- */
  const rd = {
    level, tb, classes: classesData, base, abilities: abil, featTrees,
    saves: { fort: { base: base.fort }, ref: { base: base.ref }, will: { base: base.will } },
    skills: Object.fromEntries(skillDefs.map(s => [s.key, { ranks: skillRanks[s.key] ?? 0 }])),
    actionDice: { max: (lr?.actionDice ?? 0) }
  };
  const B = new Bonuses();
  for (const s of sources) for (const b of s.bonuses) {
    if (!b.target || b.target.startsWith("abilities.")) continue;
    B.add(b.target, evaluate(b.value, { ...rd, rank: s.rank }), s.name);
  }
  sys.bonusSources = Object.fromEntries(B.sources);
  const misc = sys.misc ?? {};

  /* ---------------- Gear (armor) ---------------- */
  const armor = items.find(i => i.type === "armor" && i.system.equipped);
  const armorDef = armor ? armor.system.defensePenalty + B.get("defenseArmor") : 0;
  const armorCheck = armor ? armor.system.armorCheck + B.get("armorCheck") : 0;
  const armorSpeed = armor ? armor.system.speedPenalty : 0;
  sys.armor = armor ? { name: armor.name, dr: armor.system.damageReduction, drSubdual: armor.system.damageReductionSubdual,
    defense: armorDef, check: armorCheck, speed: armorSpeed, resistances: armor.system.resistances } : null;

  /* ---------------- Final totals ---------------- */
  sys.bab = base.bab + (misc.bab ?? 0);
  sys.saves = {
    fort: { base: base.fort, bonus: B.get("saves.fort"), total: base.fort + B.get("saves.fort") + abil.con.mod + (misc.fort ?? 0) },
    ref: { base: base.ref, bonus: B.get("saves.ref"), total: base.ref + B.get("saves.ref") + abil.dex.mod + armorCheck + (misc.ref ?? 0) },
    will: { base: base.will, bonus: B.get("saves.will"), total: base.will + B.get("saves.will") + abil.wis.mod + (misc.will ?? 0) }
  };
  sys.defense = { base: base.defense, bonus: B.get("defense"), armor: armorDef,
    total: 10 + base.defense + B.get("defense") + abil.dex.mod + armorDef + (misc.defense ?? 0) };
  sys.initiative = { base: base.initiative, bonus: B.get("initiative"),
    total: base.initiative + B.get("initiative") + abil.dex.mod + (misc.initiative ?? 0) };
  sys.attack = {
    unarmed: sys.bab + abil.str.mod,
    melee: sys.bab + abil.str.mod,
    ranged: sys.bab + abil.dex.mod
  };
  sys.knowledge = level + abil.int.mod + B.get("knowledge") + (misc.knowledge ?? 0);
  sys.requestCheck = level + abil.cha.mod + (misc.request ?? 0);
  sys.gearCheck = level + abil.wis.mod + (misc.gearCheck ?? 0);
  sys.speed = 30 + B.get("speed") + armorSpeed + (misc.speed ?? 0);

  // Vitality: max die at level 1, then rolls; Con modifier every level.
  let vit = 0;
  const vitMissing = [];
  progression.forEach((entry, idx) => {
    const ci = classAtLevel[idx];
    const die = ci?.system.vitalityDie ?? 0;
    const roll = idx === 0 ? die : Number(entry.vitality) || 0;
    if (idx > 0 && !entry.vitality) vitMissing.push(idx + 1);
    vit += roll + abil.con.mod;
  });
  if (vitMissing.length) todo.push({ order: 15, tab: "classes", text: `Vitality not rolled for level ${vitMissing.join(", ")}.` });
  sys.vitality ??= { value: 0 };
  sys.vitality.max = Math.max(0, vit + B.get("vitality") + (misc.vitality ?? 0));
  sys.wounds ??= { value: 0 };
  sys.wounds.max = sys.abilities.con.value + B.get("wounds") + (misc.wounds ?? 0);
  sys.stressThreshold = sys.abilities.wis.value + B.get("stressDamage");
  sys.subdualThreshold = sys.abilities.con.value;

  const carry = T.carry[clamp(sys.abilities.str.value, 1, T.carry.length) - 1];
  sys.carry = { ...carry };

  sys.actionDice ??= { value: 0 };
  sys.actionDice.max = (lr?.actionDice ?? 0) + B.get("actionDice.count") + (misc.actionDice ?? 0);
  sys.actionDice.die = lr?.actionDie ?? 4;
  sys.actionDice.bonus = B.get("actionDice.bonus");

  /* ---------------- Skills: totals ---------------- */
  const maxRanks = lr?.maxRanks ?? 0;
  sys.maxRanks = maxRanks;
  const anyClass = new Set(classItems.filter(c => classLevels[c.system.identifier || c.name]).flatMap(c => c.system.classSkills ?? []));
  const derivedSkills = {};
  for (const sd of skillDefs) {
    const stored = sys.skills?.[sd.key] ?? {};
    const ranks = skillRanks[sd.key] ?? 0;
    const bonus = B.get(`skills.${sd.key}.misc`) + (stored.misc ?? 0);
    const totals = sd.abilities.map(a => ({ ability: a, total: ranks + bonus + abil[a].mod }));
    const chosen = stored.ability && sd.abilities.includes(stored.ability)
      ? totals.find(t => t.ability === stored.ability)
      : totals.reduce((a, b) => (b.total > a.total ? b : a));
    const capRow = stepLookup(T.skillCap, ranks);
    derivedSkills[sd.key] = {
      ...stored, key: sd.key, name: sd.name, focus: sd.focus, abilities: sd.abilities,
      ranks, bonus, totals, ability: chosen.ability, total: chosen.total,
      isClass: anyClass.has(sd.key) || talentClassSkill.has(sd.key) || !!stored.classSkill,
      classOverride: !!stored.classSkill,
      threat: 20 - B.get(`skills.${sd.key}.threat`),
      cap: Math.min(60, capRow + B.get(`skills.${sd.key}.cap`)),
      overMax: ranks > maxRanks
    };
    if (ranks > maxRanks) warnings.push(`${sd.name}: ${ranks} ranks exceeds the maximum of ${maxRanks}.`);
  }
  sys.skillTotals = derivedSkills;
  const overrides = skillDefs.filter(s => sys.skills?.[s.key]?.classSkill).length;
  sys.classSkillPicks = { available: B.get("classSkillPicks"), used: overrides };
  if (sys.classSkillPicks.available > overrides) {
    todo.push({ order: 31, tab: "skills", text: `${plural(sys.classSkillPicks.available - overrides, "extra class skill")} to choose.` });
  }

  // Skill points per level.
  const spBonus = B.get("skillPoints") > 0 ? 1 : 0;
  skillPoints.forEach((sp, idx) => {
    const ci = classAtLevel[idx];
    const per = (ci?.system.skillPoints ?? 0) + modAt("int", idx + 1);
    sp.available = idx === 0 ? 4 * per + 4 * spBonus : per + spBonus;
    sp.remaining = sp.available - sp.spent;
    sp.className = ci?.name ?? "?";
    if (sp.remaining < 0) warnings.push(`Level ${idx + 1}: ${-sp.remaining} skill point(s) overspent.`);
  });
  sys.skillPoints = skillPoints;
  const spLeft = skillPoints.filter(sp => sp.remaining > 0);
  if (spLeft.length) {
    todo.push({ order: 30, tab: "skills", skillLevel: spLeft[0].level,
      text: `Skill points unspent: ${spLeft.map(sp => `level ${sp.level} (${sp.remaining})`).join(", ")}.` });
  }

  /* ---------------- Feat slots ---------------- */
  const slots = { any: (lr?.feats ?? 0) + B.get("featSlots.any") };
  for (const t of Object.keys(cfg.featTrees)) slots[t] = B.get(`featSlots.${t}`);
  const spent = {};
  for (const f of featItems) if (!f.system.granted) spent[f.system.tree] = (spent[f.system.tree] ?? 0) + (f.system.ranks ?? 1);
  let overflow = 0;
  const trees = {};
  for (const t of Object.keys(cfg.featTrees)) {
    const s = spent[t] ?? 0;
    trees[t] = { slots: slots[t], spent: s, owned: featTrees[t] ?? 0 };
    overflow += Math.max(0, s - slots[t]);
  }
  for (const [t, s] of Object.entries(spent)) if (!(t in cfg.featTrees)) overflow += s;
  sys.feats = { any: { slots: slots.any, spent: overflow, remaining: slots.any - overflow }, trees };
  if (overflow > slots.any) warnings.push(`${overflow - slots.any} more feat(s) taken than available.`);
  const unusedTree = Object.entries(trees).filter(([, v]) => v.slots > v.spent).map(([t, v]) => `${v.slots - v.spent} ${cfg.featTrees[t]}`);
  sys.feats.unusedTreeSlots = unusedTree;
  if (sys.feats.any.remaining > 0) todo.push({ order: 40, tab: "feats", text: `${plural(sys.feats.any.remaining, "feat slot")} open (any tree).` });
  if (unusedTree.length) todo.push({ order: 41, tab: "feats", text: `Bonus feat slots open: ${unusedTree.join(", ")}.` });

  /* ---------------- Proficiencies, focuses, interests, contacts ---------------- */
  const firstClass = classAtLevel[0];
  const profAvail = (firstClass?.system.proficiencies ?? 0) + (lr?.proficiencies ?? 0) + B.get("prof.generic");
  const profs = sys.proficiencies ?? {};
  let profUsed = 0;
  const profHints = {};
  for (const k of Object.keys(cfg.proficiencies)) {
    profUsed += (profs[k]?.proficient ? 1 : 0) + (profs[k]?.forte ? 1 : 0);
    profHints[k] = B.get(`prof.${k}`) > 0;
  }
  sys.proficiencyPicks = { available: profAvail, used: profUsed, remaining: profAvail - profUsed, hints: profHints };
  if (profUsed > profAvail) warnings.push(`${profUsed - profAvail} more weapon proficiencies/fortes than available.`);
  if (profUsed < profAvail) todo.push({ order: 50, tab: "training", text: `${plural(profAvail - profUsed, "weapon proficiency/forte pick")} left.` });

  const focusCount = (skill, target) => 1 + B.get(`focus.${target}`) + Math.floor((skillRanks[skill] ?? 0) / 4);
  const fx = sys.focuses ?? {};
  sys.focusPicks = {
    cultures: { available: focusCount("cultures", "cultures"), used: (fx.cultures ?? []).length },
    drive: { available: focusCount("drive", "drive"), used: (fx.drive ?? []).length },
    profession: { available: focusCount("profession", "profession"), used: (fx.profession ?? []).length },
    science: { available: focusCount("science", "science"), used: (fx.science ?? []).length },
    generic: { available: Math.max(0, abil.int.mod) + B.get("focus.generic"), used: (fx.fortes ?? []).length }
  };
  for (const [k, v] of Object.entries(sys.focusPicks)) {
    v.remaining = v.available - v.used;
    if (v.remaining < 0) warnings.push(`${k} focuses: ${-v.remaining} over the limit.`);
  }
  const focusLeft = Object.entries(sys.focusPicks).filter(([, v]) => v.remaining > 0)
    .map(([k, v]) => `${k === "generic" ? "extra" : (cfg.skills[k]?.name ?? k)} ${v.remaining}`);
  if (focusLeft.length) todo.push({ order: 51, tab: "training", text: `Focuses to choose: ${focusLeft.join(", ")}.` });

  const interestList = String(sys.interests ?? "").split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  sys.interestPicks = { available: tb.interestBase + B.get("interests"), used: interestList.length };
  sys.interestPicks.remaining = sys.interestPicks.available - sys.interestPicks.used;
  if (sys.interestPicks.remaining > 0) todo.push({ order: 52, tab: "training", text: `${plural(sys.interestPicks.remaining, "interest")} to choose.` });

  const contactsAvail = 1 + B.get("contacts") + Math.floor((skillRanks.networking ?? 0) / 4);
  const contactsUsed = (sys.contacts ?? []).reduce((n, c) => n + (Number(c.rank) || 0), 0);
  sys.contactPicks = { available: contactsAvail, used: contactsUsed, remaining: contactsAvail - contactsUsed };
  if (contactsUsed > contactsAvail) warnings.push(`Contacts: ${contactsUsed - contactsAvail} choice(s) over the limit.`);
  if (contactsUsed < contactsAvail) todo.push({ order: 53, tab: "training", text: `${plural(contactsAvail - contactsUsed, "contact choice")} unused.` });

  sys.subplotPicks = { available: (lr?.subplots ?? 0) + B.get("subplots"), used: (sys.subplots ?? []).length };

  /* ---------------- Wealth & mission gear ---------------- */
  const wealthTotal = base.wealth + B.get("wealth") + Math.max(0, abil.cha.mod) + (misc.wealth ?? 0);
  const alloc = sys.wealthAllocation ?? {};
  const allocated = (alloc.lifestyle ?? 0) + (alloc.possessions ?? 0) + (alloc.spendingCash ?? 0);
  const lifestyle = 1 + B.get("lifestyle") + (alloc.lifestyle ?? 0);
  const possessions = 1 + B.get("possessions") + (alloc.possessions ?? 0);
  const cash = 1 + B.get("spendingCash") + (alloc.spendingCash ?? 0);
  const lsRow = T.lifestyle[clamp(lifestyle, 1, T.lifestyle.length) - 1];
  const posRow = T.possessions[clamp(possessions, 1, T.possessions.length) - 1];
  sys.wealth = {
    total: wealthTotal, allocated, remaining: wealthTotal - allocated,
    lifestyle: { rank: lifestyle, ...lsRow }, possessions: { rank: possessions, picks: posRow?.picks },
    spendingCash: { rank: cash, amount: 100 * cash * cash }
  };
  if (allocated > wealthTotal) warnings.push(`Wealth overspent by ${allocated - wealthTotal}.`);
  if (allocated < wealthTotal) todo.push({ order: 60, tab: "gear", text: `${plural(wealthTotal - allocated, "wealth point")} to allocate.` });

  const picks = {};
  for (const g of GEAR) picks[g] = { available: gearBase[g] + (misc[`gear${g}`] ?? 0), spent: 0 };
  picks.CHA = { available: Math.max(0, abil.cha.mod), spent: 0 };
  for (const i of items) {
    const p = i.system?.pick;
    if (p && picks[p] && i.type !== "class") picks[p].spent += 1;
  }
  for (const [g, v] of Object.entries(picks)) {
    v.remaining = v.available - v.spent;
    if (v.remaining < 0) warnings.push(`Mission gear: ${-v.remaining} ${g} pick(s) over the limit.`);
  }
  sys.gearPicks = picks;
  sys.commonItems = { count: sys.abilities.wis.value, perMission: Math.round(sys.abilities.wis.value / 3) };

  /* ---------------- Experience ---------------- */
  sys.xpNext = level < 20 ? T.levels[level + 1]?.xp ?? null : null;

  /* ---------------- Core abilities ---------------- */
  const firstExpertIdx = classAtLevel.findIndex(c => c?.system.expert);
  sys.coreAbilities = [firstClass, firstExpertIdx >= 0 ? classAtLevel[firstExpertIdx] : null]
    .filter(Boolean).map(c => ({ className: c.name, ...c.system.coreAbility }));

  /* ---------------- Prerequisites ---------------- */
  const ctx = prerequisiteContext(sys, featNames, featTrees, skillRanks);
  sys.featStatus = {};
  for (const f of featItems) {
    const res = checkPrerequisites(f.system.prerequisites, ctx);
    sys.featStatus[f.id] = res;
    if (!res.ok && !f.system.granted) warnings.push(`${f.name}: prerequisites not met (${res.unmet.join("; ")}).`);
  }
  // Expert classes: must qualify when first taken.
  for (const [cid, lvl] of Object.entries(classLevels)) {
    const ci = classById.get(cid);
    if (!ci?.system.expert || !ci.system.requirements) continue;
    const res = checkPrerequisites(ci.system.requirements, ctx);
    if (!res.ok) warnings.push(`${ci.name}: expert class requirements not met (${res.unmet.join("; ")}).`);
  }

  sys.rollDataExtras = rd;
  sys.warnings = warnings;
  // Before the first class level only the opening steps are worth listing.
  if (!level) todo = todo.filter(t => t.always);
  sys.todo = todo.sort((a, b) => a.order - b.order);
  return sys;
}

/** Values prerequisite checks need, built from derived data. */
export function prerequisiteContext(sys, featNames, featTrees, skillRanks) {
  const focusSel = sys.focuses ?? {};
  return {
    level: sys.level,
    base: { bab: sys.base?.bab ?? 0, defense: sys.base?.defense ?? 0 },
    abilities: Object.fromEntries(ABILITIES.map(k => [k, sys.abilities[k].value])),
    skills: skillRanks,
    featTrees,
    hasFeat: n => featNames.has(norm(n)),
    proficient: k => !!sys.proficiencies?.[k]?.proficient,
    focus: (skill, group) => (focusSel[skill] ?? []).some(f => norm(f) === norm(group)),
    lifestyle: sys.wealth?.lifestyle?.rank ?? 1,
    keySkillRanks: Math.max(0, ...Object.values(skillRanks))
  };
}
