import {
  abilityIncreaseLevels,
  allClassSkills,
  campaignActionDice,
  campaignCqbRange,
  campaignFeatTrades,
  campaignLevelRow,
  campaignStartingAttributeCap,
  campaignSubplotBonus,
  crossroadsAllowed,
  campaignPointBuy,
  campaignRules,
  campaignFeatTrees,
  campaignGearCaliber,
  campaignInterestBase,
  campaignWealthBonus,
  fragileVitality
} from "./campaign-rules.mjs";
import { periodMoney } from "./period-money.mjs";
import { reviewContactPeople } from "./contact-people.mjs";
import { originRuleName, ruleName } from "./rule-name.mjs";
import { powerStanceBonus } from "./power-stance.mjs";
import { sideStanceDefensePenalty } from "./side-stance.mjs";
import { cheapShotPenalty, cheapShotRecords, cheapShotSpeedPenalty } from "./cheap-shot-effects.mjs";
import { readiedDisarmWeapons } from "./disarm-response.mjs";
import { readiedGuardWeapons } from "./guard.mjs";
import { polearmDefensePlan } from "./polearm-defense.mjs";
import { knifeBasicsPlan } from "./knife-basics.mjs";
import { swordBasicsPlan } from "./sword-basics.mjs";
import { berserkerRageState } from "./berserker.mjs";
import { favoredGearState, featPossessionWarnings } from "./favored-gear.mjs";
import { duelingAllDodge } from "./dueling-basics.mjs";
import { fightDefensivelyState } from "./fight-defensively.mjs";
import { notTheFaceDR } from "./not-the-face.mjs";
import { underminedState } from "./taunt.mjs";
import { PERSONAL_LIEUTENANT, lieutenantReview } from "./companions.mjs";
import { activeIdentity, identityReview, professionFocusesWithIdentity } from "./flawless-identity.mjs";
import { intenseStanceState } from "./intense-stance.mjs";
import { attributeDamageState } from "./attribute-damage.mjs";
import { candidatePlan } from "./candidate.mjs";
import { toolShedKitState } from "./tool-shed.mjs";
import { CONTACT_FEATS, contactFeatGrants, networkingContactFeatGrants } from "./contact-feats.mjs";
import { bloodstainDefensePlan } from "./appearance.mjs";
import { dartingStyleState } from "./darting-state.mjs";
import { superiorCoverState } from "./superior-cover.mjs";
import { readiedRangedWeapons, readiedMeleeWeapons } from "./readied-weapons.mjs";
import { twoWeaponStyleState } from "./two-weapon-state.mjs";
import { totalDefenseState } from "./total-defense.mjs";
import { combatMovementRules } from "./combat-movement.mjs";
import { combatExpertiseState } from "./combat-expertise.mjs";
import { armorTrainingRules, armorTrainingDRForAttack } from "./armor-training.mjs";
import { shakenRules, shakenStateFromContext } from "./shaken.mjs";
import { skillBonusCondition, skillConditionCheckPenalty } from "./skill-conditions.mjs";
import { adrenalineSource } from "./adrenaline.mjs";
import { unrestrictedBonusPools } from "./bonus-pools.mjs";
import { drunkRepositionHistory } from "./condition-movement.mjs";
import { fatigueApplicationHistory, fatigueRestStatus } from "./fatigue.mjs";
import { uncannyDodgePlan, evasionPlan } from "./defense.mjs";
import { mentalLeapState } from "./mental-leap.mjs";
import {
  attributeCollapsePlan,
  attributeDefensePlan,
  conditionRollPenalties,
  conditionSkillPenalty,
  conditionAbilityPenalty
} from "./attributes.mjs";
import { assistantGroupStatus } from "./summoned-assistants.mjs";
import { fleetSpeedPlan, burrowCapabilities } from "./environment.mjs";
import { ammunitionConfiguration } from "./ammunition.mjs";
import { characterSurvivalStats } from "./terrain.mjs";
import { baseSensoryRanges } from "./senses.mjs";
import { extraGearCategory } from "./feats.mjs";
import { sneakAttackCapacity } from "./sneak-attack.mjs";
import { eagleEyeState, sniperMagicTouchBonus } from "./sniper.mjs";
import { markPrerequisiteBonus } from "./marks.mjs";
import { classGearWarnings } from "./class-gear.mjs";
import { missionCaliberOptions, missionCaliberMatches } from "./mission-gear.mjs";
import { isResourceLock } from "./resource-locks.mjs";
import { improvedFortuneBonus, actionDieAwardSummary } from "./action-dice.mjs";
import { currentReserves, reserveAllocations, managedAcquisition, hasProcure } from "./gear-acquisition.mjs";
import { deathThreshold, activeDefenseBoost, activeFortunesOfWar, recoveryRatePlan } from "./health.mjs";
import { weaponSpecialist } from "./weapon-specialist.mjs";
import {
  temporaryFeatActive,
  sameFeatSelection,
  distinctFeatChoice,
  selfGrantedTemporaryFeat
} from "./temporary-feats.mjs";
import { skillFeatRules, limitedUseAbilities } from "./limited-uses.mjs";
import { inheritedClassFeatures } from "./inherited-classes.mjs";
import { classFeatSources, featAcquisition, historicalFeatEligibility } from "./feat-acquisition.mjs";
/**
 * Spycraft 2.0 character engine: derives an agent's modifiers and final totals from its build choices.
 *
 * Pure functions: no Foundry globals, so the engine can be unit-tested in Node.
 * `computeAgent(system, items, cfg)` mutates `system` (an AgentData instance or plain object)
 * by adding derived values.
 */
import { resolveClassSkillSelections, orderedClassChoices } from "./class-skills.mjs";
import { agingEffects } from "./bio.mjs";
import { evaluate, stepLookup } from "./formula.mjs";
import { checkPrerequisites } from "./prerequisites.mjs";
import { resolveOriginChoices } from "./origins.mjs";
import { resolveFeatChoices } from "./feats.mjs";
import {
  armorTotals,
  loadTotals,
  equipmentCategory,
  possessionBudget,
  armorGrantStatus,
  bigStickStatus,
  bigStickMatches
} from "./gear.mjs";
import { proficiencyTotals, focusTotals } from "./training.mjs";
import { purchasedSkillRanks, availableSkillPoints } from "./checks.mjs";
import { loc } from "../i18n.mjs";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const GEAR = ["R", "T", "V", "S", "G", "W", "E"];
const mod = score => Math.floor((score - 10) / 2);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const miscActionDice = sys => sys.misc?.actionDice ?? 0;
const norm = s =>
  String(s ?? "")
    .trim()
    .toLowerCase();

function setPath(obj, path, value) {
  const keys = path.split(".");
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys.at(-1)] = value;
}

/** Accumulates bonus values by target. */
class Bonuses {
  constructor() {
    this.map = new Map();
    this.sources = new Map();
    this.entries = new Map();
  }
  add(target, value, source, type = "") {
    if (!target || !value) return;
    if (!this.entries.has(target)) this.entries.set(target, []);
    const entries = this.entries.get(target);
    entries.push({ source, value, type });
    const active = [],
      groups = new Map();
    for (const entry of entries) {
      if (!entry.type || entry.type === "unnamed" || entry.type === "dodge") active.push(entry);
      else {
        if (!groups.has(entry.type)) groups.set(entry.type, []);
        groups.get(entry.type).push(entry);
      }
    }
    for (const group of groups.values()) {
      const positive = group.filter(e => e.value > 0).sort((a, b) => b.value - a.value)[0];
      const negative = group.filter(e => e.value < 0).sort((a, b) => a.value - b.value)[0];
      if (positive) active.push(positive);
      if (negative) active.push(negative);
    }
    this.map.set(
      target,
      active.reduce((total, entry) => total + entry.value, 0)
    );
    this.sources.set(
      target,
      active.filter(e => e.source).map(({ source, value }) => ({ source, value }))
    );
  }
  get(target) {
    return this.map.get(target) ?? 0;
  }
  /** Sum of every target starting with prefix, keyed by remainder. */
  group(prefix) {
    const out = {};
    for (const [k, v] of this.map) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
    return out;
  }
}

const LEVEL_ZERO_VITALITY = 6;

/**
 * @param {object} sys     agent system data (mutated)
 * @param {object[]} givenItems { id, name, type, system } for every embedded item
 * @param {object} cfg     CONFIG.SPYCRAFT
 */
export function computeAgent(sys, givenItems, cfg, options = {}) {
  const state = { sys, givenItems, cfg, options };
  startPass(state);
  deriveCareerLevels(state);
  collectBonusSources(state);
  deriveAttributes(state);
  deriveSkillRanks(state);
  deriveFeatList(state);
  deriveOtherBonuses(state);
  deriveFinalTotals(state);
  deriveSkillTotals(state);
  deriveFeatSlots(state);
  deriveProficiencies(state);
  deriveWealthAndGear(state);
  deriveExperience(state);
  deriveCoreAbilities(state);
  return settlePrerequisites(state);
}

/** Step 1: drop expired items, read conditions and decide which feats may contribute this pass. */
function startPass(state) {
  const { sys, givenItems, cfg, options } = state;
  sys.cheapShotActive = cheapShotRecords(sys).filter(r => !r.recovered);
  sys.cheapShotSpeedPenalty = cheapShotSpeedPenalty(sys);
  const allItems = givenItems.filter(i => !isResourceLock(i));
  const items = allItems.filter(i => !toolShedKitState(sys, i).expired);
  if (sys.shakenState?.sourceKind !== "effects") sys.shakenState = shakenStateFromContext(sys.conditionContext);
  const shaken = shakenRules(sys);
  sys.shakenRules = shaken;
  const T = cfg.tables;
  const warnings = [...shaken.warnings];
  // Only granted or presently qualified feats may contribute effects.
  // Starting from grants prevents a feat from satisfying its own requirements.
  const legalFeatIds = new Set(),
    featCounts = new Map(),
    featSelectionCounts = new Map();
  for (const feat of items.filter(i => i.type === "feat")) {
    const temporary = feat.system.featKind === "temporary",
      selfTemporary = temporary && selfGrantedTemporaryFeat(sys, feat);
    if (!temporaryFeatActive(sys, feat)) {
      warnings.push(loc`${feat.name}: temporary feat expired; remove it or retain it as a record.`);
      continue;
    }
    if (
      temporary &&
      items.some(
        other =>
          other.type === "feat" &&
          other.id !== feat.id &&
          norm(ruleName(other)) === norm(ruleName(feat)) &&
          (!selfTemporary || sameFeatSelection(feat, other, cfg)) &&
          other.system.featKind !== "temporary"
      )
    )
      continue;
    const key = norm(ruleName(feat)),
      count = featCounts.get(key) ?? 0;
    const definition = cfg.tables.featRules?.[feat.name];
    const repeatable = feat.system.repeatable || definition?.repeatable;
    const maximum = repeatable ? feat.system.maxSelections || definition?.maxSelections || Infinity : 1;
    featCounts.set(key, count + 1);
    const selectionKey = feat.system.repeatable || definition?.repeatable ? `${key}:${norm(feat.system.choice)}` : key,
      selectionCount = featSelectionCounts.get(selectionKey) ?? 0;
    featSelectionCounts.set(selectionKey, selectionCount + 1);
    if ((feat.system.ranks ?? 1) !== 1)
      warnings.push(loc`${feat.name}: feats have no ranks; record each permitted selection separately.`);
    if (
      count >= maximum ||
      (temporary && (selfTemporary ? (!repeatable || distinctFeatChoice(feat)) && selectionCount > 0 : count > 0))
    ) {
      warnings.push(
        `${feat.name}: ${temporary && selectionCount > 0 ? loc`duplicate temporary selection` : loc`exceeds the maximum of ${maximum} selection(s)`}.`
      );
      continue;
    }
    if (
      (!feat.system.granted || feat.system.featKind === "temporary") &&
      (feat.system.acquiredAtLevel || 1) > (sys.progression?.length ?? 0)
    ) {
      warnings.push(loc`${feat.name}: has not been acquired at this career level.`);
      continue;
    }
    legalFeatIds.add(feat.id);
  }
  const activeFeatIds = new Set(
    [
      ...(options.activeFeatIds ??
        new Set(
          items.filter(i => i.type === "feat" && i.system.granted && i.system.featKind !== "temporary").map(i => i.id)
        ))
    ].filter(id => legalFeatIds.has(id))
  );
  /** Things still left to pick: { order, tab, text, always?, browse?, skillLevel? } */
  const todo = [];
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  // Table 1.3, with the growth season qualities applied (p.407).
  const levelRow = l => campaignLevelRow(T.levels[clamp(l, 0, 20)]);
  Object.assign(state, { allItems, items, shaken, T, warnings, legalFeatIds, activeFeatIds, todo, plural, levelRow });
}

/** Step 2: classes and career level. */
function deriveCareerLevels(state) {
  const { sys, cfg, items, warnings, activeFeatIds, todo } = state;
  const classItems = items.filter(i => i.type === "class");
  const classById = new Map(classItems.map(i => [i.system.identifier || i.name, i]));
  const progression = sys.progression ?? [];
  const level = progression.length;
  sys.level = level;
  sys.specialtyName = originRuleName(items.find(i => i.type === "origin" && i.system?.originType === "specialty"));
  sys.talentName = originRuleName(items.find(i => i.type === "origin" && i.system?.originType === "talent"));
  sys.activeFeatSelections = items
    .filter(i => i.type === "feat" && activeFeatIds.has(i.id))
    .map(i => ({ name: ruleName(i), choice: i.system.choice ?? "", tree: i.system.tree ?? "" }));
  sys.activeFeatNames = sys.activeFeatSelections.map(i => i.name);

  sys.details ??= {};
  sys.details.level = level;
  const classLevels = {};
  const classAtLevel = [];
  for (const entry of progression) {
    const ci = classById.get(entry.classId);
    classAtLevel.push(ci ?? null);
    if (!ci) {
      warnings.push(loc`Unknown class "${entry.classId}" in level progression.`);
      continue;
    }
    classLevels[entry.classId] = (classLevels[entry.classId] ?? 0) + 1;
  }
  sys.classLevels = classLevels;
  for (const ci of new Set(classAtLevel.filter(Boolean))) {
    const book = cfg.classFeatures?.[ci.system.identifier]?.classSkills;
    const own = ci.system.classSkills ?? [];
    if (!book) continue;
    const extra = own.filter(key => !book.includes(key)),
      missing = book.filter(key => !own.includes(key));
    if (extra.length || missing.length)
      warnings.push(
        loc`${ci.name}: its class skills differ from the book (${[...extra.map(k => `+${cfg.skills[k]?.name ?? k}`), ...missing.map(k => `−${cfg.skills[k]?.name ?? k}`)].join(", ")}). Use Review catalog updates on the Bio tab to restore them.`
      );
  }
  const coreItems = [
    classAtLevel.find(item => item && !item.system.expert),
    classAtLevel.find(item => item?.system.expert)
  ].filter(Boolean);
  sys.coreClassIds = [...new Set(coreItems.map(item => item.system.identifier || item.name))];
  const inherited = inheritedClassFeatures(items, progression, cfg);
  sys.inheritedClassChoices = inherited.entries;
  sys.inheritedFeatureGrants = inherited.grants;
  warnings.push(...inherited.warnings);
  for (const text of inherited.pending) todo.push({ order: 21, tab: "classes", text });
  sys.featAcquisitionSources = [...classFeatSources(items, progression), ...inherited.featSources];

  const base = { bab: 0, fort: 0, ref: 0, will: 0, defense: 0, initiative: 0, wealth: 0 };
  const gearBase = Object.fromEntries(GEAR.map(g => [g, 0]));
  const classesData = {};
  for (const [cid, lvl] of Object.entries(classLevels)) {
    const ci = classById.get(cid);
    const row = ci.system.table.find(r => r.level === lvl) ?? ci.system.table.at(-1) ?? {};
    for (const k of Object.keys(base)) base[k] += row[k] ?? 0;
    for (const g of GEAR) gearBase[g] += row[`gear${g}`] ?? 0;
    classesData[cid] = { levels: lvl, ...row };
    if (lvl > ci.system.table.length && ci.system.table.length)
      warnings.push(loc`${ci.name} has a maximum of ${ci.system.table.length} levels.`);
  }
  // Origin increases to base Defense also count for base-Defense prerequisites.
  for (const origin of items.filter(i => i.type === "origin")) {
    for (const bonus of origin.system.bonuses ?? []) {
      if (bonus.target === "baseDefense") base.defense += evaluate(bonus.value, { level });
    }
  }
  sys.base = base;
  for (const originType of ["talent", "specialty"]) {
    const count = items.filter(i => i.type === "origin" && i.system.originType === originType).length;
    if (count > 1) warnings.push(loc`Multiple ${originType}s attached (${count}); only one is permitted.`);
  }
  for (const originType of ["talent", "specialty"]) {
    if (!items.some(i => i.type === "origin" && i.system.originType === originType)) {
      todo.push({
        order: originType === "talent" ? 1 : 2,
        always: true,
        tab: "main",
        browse: { type: "origin", originType },
        text: loc`Choose a ${originType}.`
      });
    }
  }
  if (!level)
    todo.push({
      order: 3,
      always: true,
      tab: "classes",
      browse: { type: "class", originType: "" },
      text: loc`Take a first class level.`
    });
  Object.assign(state, {
    classItems,
    classById,
    progression,
    level,
    classLevels,
    classAtLevel,
    coreItems,
    inherited,
    base,
    gearBase,
    classesData
  });
}

/** Step 3: collect every bonus source. */
function collectBonusSources(state) {
  const {
    sys,
    cfg,
    items,
    shaken,
    T,
    warnings,
    activeFeatIds,
    todo,
    plural,
    levelRow,
    classById,
    level,
    classLevels,
    inherited
  } = state;
  sys.conditionalSkillBonuses = [];
  sys.classOptionSelections = [];
  const sources = [];
  sys.conditionPenalties = conditionRollPenalties(sys);
  if (shaken.initiativePenalty)
    sources.push({
      name: shaken.label,
      rank: 1,
      bonuses: [
        { target: "initiative", value: String(shaken.initiativePenalty) },
        ...(shaken.reflexWillPenalty
          ? ["saves.ref", "saves.will"].map(target => ({ target, value: String(shaken.reflexWillPenalty) }))
          : [])
      ]
    });
  if (sys.conditionContext?.drunk === true)
    sources.push({
      name: "Drunk",
      rank: 1,
      bonuses: ["saves.ref", "saves.will", "initiative"].map(target => ({ target, value: "-2" }))
    });
  if (sys.conditionPenalties.sickened)
    sources.push({
      name: "Sickened",
      rank: 1,
      bonuses: [
        ...Object.keys(cfg.skills).map(key => ({ target: `skills.${key}.misc`, value: "-2" })),
        ...["knowledge", "saves.fort", "saves.ref", "saves.will"].map(target => ({ target, value: "-2" }))
      ]
    });
  // Rooted Stance (Spirit Basics, p.187): +1 to all saves while in the stance.
  if (sys.combatStance?.key === "rooted" && sys.activeFeatNames?.includes("Spirit Basics"))
    sources.push({
      name: "Rooted Stance",
      rank: 1,
      bonuses: ["saves.fort", "saves.ref", "saves.will"].map(target => ({ target, value: "1" }))
    });
  // Dueling Basics, p.178: +1 dodge against all attacks for the declared round when no opponent was chosen.
  if (duelingAllDodge(sys))
    sources.push({ name: "Dueling Basics", rank: 1, bonuses: [{ target: "defense", value: "1", bonusType: "dodge" }] });
  // Dueling Supremacy, p.178: +2 dodge bonus to Defense.
  if (sys.activeFeatNames?.includes("Dueling Supremacy"))
    sources.push({
      name: "Dueling Supremacy",
      rank: 1,
      bonuses: [{ target: "defense", value: "2", bonusType: "dodge" }]
    });
  if ((classLevels.triggerman ?? 0) >= 8)
    sources.push({
      name: loc`Eye of the Storm (all attackers)`,
      rank: 1,
      bonuses: [{ target: "defense", value: "3", bonusType: "dodge" }]
    });
  // { name, bonuses, rank }
  sys.originEffects = [];
  const linkedSkillPairs = [];
  const featChoiceBonuses = new Map();
  for (const i of items) {
    if (i.type === "origin") {
      const selected = resolveOriginChoices(i, sys, items, cfg);
      warnings.push(...selected.warnings);
      sys.originEffects.push(...selected.notes);
      if (selected.pending.length)
        todo.push({ order: 4, always: true, tab: "main", text: `${i.name}: ${selected.pending.join("; ")}.` });
      sources.push({
        name: i.name,
        origin: true,
        bonuses: [...(i.system.bonuses ?? []), ...selected.bonuses],
        rank: 1,
        acquiredAtLevel: 1
      });
    } else if (i.type === "feat" && activeFeatIds.has(i.id)) {
      const selected = resolveFeatChoices(i, sys, items, cfg, activeFeatIds);
      warnings.push(...selected.warnings);
      if (selected.pending.length)
        todo.push({ order: 42, tab: "feats", text: `${i.name}: ${selected.pending.join("; ")}.` });
      featChoiceBonuses.set(i.id, selected.bonuses);
      linkedSkillPairs.push(...selected.linkedSkills.map(skills => ({ skills, level: i.system.acquiredAtLevel || 1 })));
      sources.push({
        name: i.name,
        bonuses: [
          ...(i.system.bonuses ?? []).filter(b => !Object.hasOwn(CONTACT_FEATS, i.name) || b.target !== "contacts"),
          ...(Object.hasOwn(CONTACT_FEATS, i.name) ? [{ target: "contacts", value: "2" }] : []),
          ...selected.bonuses,
          ...(["Gorgeous", "Simply Irresistible"].includes(i.name)
            ? [{ target: "abilities.cha", value: "1" }]
            : ruleName(i) === "The Look"
              ? [{ target: "appearance", value: "1" }]
              : [])
        ],
        rank: 1,
        acquiredAtLevel: i.system.acquiredAtLevel || 1,
        candidate: ruleName(i) === "Candidate",
        fieldOfExpertise: i.system.choice === "Field of Expertise"
      });
    } else if (i.type === "class") {
      const cid = i.system.identifier || i.name;
      const lvl = classLevels[cid] ?? 0;
      if (!lvl) continue;
      if (cid === "scientist")
        for (const [milestone, field] of [
          [2, "phdSkill"],
          [11, "phdSkill1"],
          [19, "phdSkill2"]
        ]) {
          if (lvl < milestone) continue;
          const key = i.system[field];
          if (i.system.classSkills?.includes(key))
            sources.push({
              name: `Scientist Ph.D. (${key})`,
              classId: cid,
              requiredClassLevel: milestone,
              rank: 1,
              bonuses: [{ target: `skills.${key}.maxRanks`, value: "5", level: milestone }]
            });
          else
            todo.push({
              order: 21,
              tab: "classes",
              text: loc`Scientist: choose the Ph.D. class skill earned at class level ${milestone}.`
            });
        }
      if (cid === "virtuoso") {
        const key = i.system.keySkill;
        if (cfg.skills[key]) {
          if (cfg.skills[key].focus && !i.system.keyFocus)
            todo.push({ order: 21, tab: "classes", text: loc`Virtuoso: choose the key skill's focus.` });
          if (!i.system.professionFocus)
            todo.push({ order: 21, tab: "classes", text: loc`Virtuoso: choose the related Profession focus.` });
          const bonuses = [
            { target: `skills.${key}.classSkill`, value: "1" },
            { target: `skills.${key}.misc`, value: "2", bonusType: "insight" },
            { target: `skills.${key}.baseThreat`, value: "19" },
            { target: "skills.profession.misc", value: "2", bonusType: "insight" },
            { target: "skills.profession.baseThreat", value: "19" }
          ];
          if (sys.coreClassIds.includes("virtuoso"))
            bonuses.push({
              target: `skills.${key}.errorReductionZero`,
              value: "2",
              restrictedFocus: cfg.skills[key].focus ? i.system.keyFocus || "__unselected__" : null
            });
          if (lvl >= 6 && i.system.classSkills?.includes(i.system.phdSkill))
            bonuses.push({ target: `skills.${i.system.phdSkill}.maxRanks`, value: "5", level: 6 });
          sources.push({
            name: "Field of Expertise",
            bonuses,
            rank: 1,
            classId: cid,
            requiredClassLevel: 1,
            fieldOfExpertise: true
          });
          if (lvl >= 6 && !i.system.classSkills?.includes(i.system.phdSkill))
            todo.push({ order: 21, tab: "classes", text: loc`Virtuoso: choose the Ph.D. skill.` });
        } else
          todo.push({
            order: 21,
            tab: "classes",
            text: loc`Virtuoso: choose the key skill, its focus if applicable, and the related Profession focus.`
          });
      }
      sources.push({
        name: i.name,
        bonuses: (i.system.bonuses ?? []).filter(b => (b.level ?? 0) <= lvl),
        rank: 1,
        classId: cid,
        requiredClassLevel: 1
      });
      const lists = Object.fromEntries((i.system.choiceLists ?? []).map(L => [L.key, L]));
      let unpicked = 0;
      const selectedOptions = new Map();
      orderedClassChoices(i).forEach(({ slot, index: idx }) => {
        if (slot.level > lvl) return;
        if (
          cid === "soldier" &&
          slot.list === "weaponSpecialist" &&
          slot.level > 6 &&
          i.system.weaponSpecialist?.[slot.level]?.mode === "proficiency"
        )
          return;
        const pick = i.system.choices?.[idx];
        const options = lists[slot.list]?.options ?? [];
        const opt =
          pick === null || pick === undefined || pick === "" ? null : options.find(o => o.index === Number(pick));
        if (opt) {
          const list = lists[slot.list];
          const key = `${slot.list}:${opt.abilityId ?? opt.index}`;
          const taken = selectedOptions.get(key) ?? 0;
          const maximum = list.kind === "option" ? 1 : list.kind === "crossClass" ? (opt.maxSelections ?? 1) : Infinity;
          selectedOptions.set(key, taken + 1);
          if (taken >= maximum) {
            warnings.push(loc`${i.name}: ${opt.name} may be selected only ${maximum} time(s).`);
            return;
          }
          if (list.kind === "crossClass" && (classLevels[opt.classId] ?? 0) >= opt.assumedClassLevel) {
            warnings.push(loc`${i.name}: replace ${opt.name}; actual class levels already grant it.`);
            return;
          }
          sys.classOptionSelections.push({ classId: cid, name: opt.name, level: slot.level });
          sources.push({
            name: `${i.name}: ${opt.name}`,
            legacyGroup: opt.abilityId === "Soldier:Armor use I" ? "armorUse" : null,
            bonuses: opt.bonuses ?? [],
            rank: 1,
            classId: cid,
            requiredClassLevel: slot.level
          });
        } else if (options.length) unpicked += 1;
      });
      if (unpicked)
        todo.push({
          order: 20,
          tab: "classes",
          text: loc`${i.name}: ${plural(unpicked, "class-ability choice")} to make.`
        });
    }
  }

  sys.actionDieDefense = activeDefenseBoost(sys);
  if (sys.actionDieDefense)
    sources.push({ name: loc`Action die Defense boost`, rank: 1, bonuses: [{ target: "defense", value: "2" }] });
  sources.push(...inherited.sources);
  const inheritedArmor = inherited.entries.filter(entry => entry.name === "Soldier: Armor use I").length;
  const inheritedWar = inherited.entries.filter(entry => entry.name === "Soldier: Fortunes of war I").length;
  const soldierLevel = classLevels.soldier ?? 0,
    counterLevel = classLevels.counterterrorist ?? 0;
  const armorGrade = Math.min(
    Math.floor(soldierLevel / 4) + Math.floor(counterLevel / 4) + inheritedArmor,
    Math.max(soldierLevel ? 5 : 0, counterLevel ? 2 : 0, inheritedArmor ? 1 : 0)
  );
  const warGrade = Math.min(
    (soldierLevel >= 2 ? 1 : 0) + (soldierLevel >= 11 ? 1 : 0) + (soldierLevel >= 19 ? 1 : 0) + inheritedWar,
    soldierLevel ? 3 : inheritedWar ? 1 : 0
  );
  sys.uncannyDodge = uncannyDodgePlan(sys);
  sys.evasion = evasionPlan(sys);
  sys.legacyAbilities = {
    evasion: sys.evasion,
    uncannyDodge: sys.uncannyDodge,
    armorUse: { grade: armorGrade, freeArmorCaliber: armorGrade },
    fortunesOfWar: { grade: warGrade }
  };
  for (const source of sources) {
    const native = source.name === classById.get(source.classId)?.name;
    source.bonuses = source.bonuses.filter(
      b =>
        !(
          (source.legacyGroup === "armorUse" || (native && ["soldier", "counterterrorist"].includes(source.classId))) &&
          ["defenseArmor", "armorCheck"].includes(b.target)
        ) &&
        !(
          b.target === "naturalDR" &&
          ((native && source.classId === "soldier") || source.name.endsWith(": Soldier: Fortunes of war I"))
        )
    );
  }
  sources.push({
    name: loc`Armor Use (combined legacy grades)`,
    rank: 1,
    bonuses: [
      { target: "defenseArmor", value: String(armorGrade) },
      { target: "armorCheck", value: String(armorGrade ? 1 : 0) }
    ]
  });
  sys.fortunesOfWarActive = activeFortunesOfWar(sys);
  if (sys.fortunesOfWarActive)
    sources.push({
      name: loc`Fortunes of War (one-full-round boost)`,
      rank: 1,
      bonuses: [{ target: "naturalDR", value: String(warGrade) }]
    });
  sources.push({
    name: loc`Fortunes of War (combined legacy grades)`,
    rank: 1,
    bonuses: [{ target: "naturalDR", value: String(warGrade) }]
  });

  const tb = {
    t1: stepLookup(T.talentBonus.t1, level),
    t2: stepLookup(T.talentBonus.t2, level),
    t3: stepLookup(T.talentBonus.t3, level),
    interestBase: campaignInterestBase(
      level,
      stepLookup(
        T.interests.map(r => [r[0], r[1]]),
        level
      )
    ),
    interestTalent: stepLookup(
      T.interests.map(r => [r[0], r[2]]),
      level
    ),
    interestSpec: stepLookup(
      T.interests.map(r => [r[0], r[3]]),
      level
    )
  };
  const lr = levelRow(level);
  Object.assign(state, { sources, linkedSkillPairs, tb, lr });
}

/** Step 4 (phase A): attributes, which later bonuses may depend on. */
function deriveAttributes(state) {
  const {
    sys,
    cfg,
    items,
    T,
    warnings,
    activeFeatIds,
    todo,
    plural,
    classItems,
    classById,
    progression,
    level,
    inherited,
    base,
    classesData,
    sources,
    tb
  } = state;
  const abilityBonus = new Bonuses(),
    nonCandidateBonus = new Bonuses(),
    originAbility = new Map();
  sys.unrestrictedBonusPools = unrestrictedBonusPools(sys);
  for (const pool of sys.unrestrictedBonusPools) if (pool.needsReview) warnings.push(pool.reason);
  sys.drunkRepositionState = drunkRepositionHistory(sys);
  warnings.push(...sys.drunkRepositionState.warnings);
  sys.drunkPendingRepositions = sys.drunkRepositionState.rows.filter(r => ["pending", "moving"].includes(r.state));
  sys.drunkSleepState = fatigueRestStatus({ ...sys, fatigueRest: sys.drunkSleep }, { restKind: "drunk" });
  if (sys.drunkSleepState?.needsReview) warnings.push(loc`Drunk sleep: ${sys.drunkSleepState.warning}`);
  sys.fatigueRestState = fatigueRestStatus(sys);
  if (sys.fatigueRestState?.needsReview) warnings.push(sys.fatigueRestState.warning);
  sys.fatigueApplicationHistory = fatigueApplicationHistory(sys);
  warnings.push(...sys.fatigueApplicationHistory.warnings);
  sys.superiorCoverState = superiorCoverState(sys);
  if (sys.superiorCoverState.needsReview) warnings.push(sys.superiorCoverState.reason);
  sys.dartingStyleState = dartingStyleState(sys);
  if (sys.dartingStyleState.needsReview) warnings.push(sys.dartingStyleState.reason);
  sys.twoWeaponStyleState = twoWeaponStyleState(sys);
  if (sys.twoWeaponStyleState.needsReview) warnings.push(sys.twoWeaponStyleState.reason);
  sys.attributeDamageState = attributeDamageState(sys);
  if (sys.attributeDamageState.needsReview) {
    warnings.push(sys.attributeDamageState.reason);
    todo.push({ order: 10, tab: "main", text: sys.attributeDamageState.reason });
  }
  sys.mentalLeapState = mentalLeapState(sys);
  warnings.push(...sys.mentalLeapState.warnings);
  sys.aging = agingEffects(sys.details?.age);
  if (sys.aging.warning) warnings.push(sys.aging.warning);
  for (const [key, value] of Object.entries(sys.aging.modifiers)) {
    abilityBonus.add(key, value, "Age");
    nonCandidateBonus.add(key, value, "Age");
  }
  const preData = { level, tb, classes: classesData, base, rank: 1 };
  for (const s of sources)
    for (const b of s.bonuses) {
      if (b.target?.startsWith("abilities.")) {
        const amount = evaluate(b.value, { ...preData, rank: s.rank }),
          key = b.target.slice(10);
        abilityBonus.add(key, amount, s.name, b.bonusType);
        if (!s.candidate) nonCandidateBonus.add(key, amount, s.name, b.bonusType);
        if (s.origin) originAbility.set(key, (originAbility.get(key) ?? 0) + (Number(amount) || 0));
      }
    }
  // Berserker rage, pp.183–184: Strength and Constitution rise while it runs.
  sys.berserkerRageState = berserkerRageState(sys.berserkerRage, sys.bonusPoolCombats?.[sys.berserkerRage?.combatId]);
  const rageBonus = sys.berserkerRageState.active ? sys.berserkerRage.bonus : 0;
  if (sys.berserkerRageState.record && !sys.berserkerRageState.active)
    warnings.push(loc`The berserker rage has run out: end it to apply what follows.`);
  const increases = sys.abilityIncreases ?? {};
  const increaseAt = l => increases[`l${l}`] || "";
  let pointCost = 0;
  for (const k of ABILITIES) {
    const a = sys.abilities[k];
    a.increase = abilityIncreaseLevels().filter(l => l <= level && increaseAt(l) === k).length;
    a.bonus = abilityBonus.get(k);
    // Where that bonus comes from, for the sheet's breakdown tooltip.
    a.bonusSources = abilityBonus.sources.get(k) ?? [];
    a.temporaryBonus = (sys.mentalLeapState.bonuses[k] ?? 0) + (["str", "con"].includes(k) ? rageBonus : 0);
    a.damage = sys.attributeDamageState.byAbility[k].total;
    a.undamagedValue = a.base + a.increase + (a.misc ?? 0) + a.bonus + a.temporaryBonus;
    a.value = a.undamagedValue - a.damage;
    a.mod = mod(a.value);
    a.cost = T.abilityScores.find(r => r.score === a.base)?.cost;
    if (a.base < 8 || a.base > 18 || typeof a.cost !== "number") {
      a.cost = 0;
      warnings.push(loc`${k.toUpperCase()} ${a.base} is outside the creation point-buy range (8–18).`);
    }
    pointCost += a.cost;
    // Small Screen (p.408): no starting attribute above 18, Origin benefits included.
    const startingCap = campaignStartingAttributeCap();
    if (startingCap && a.base + (originAbility.get(k) ?? 0) > startingCap)
      warnings.push(
        loc`Small Screen: starting ${k.toUpperCase()} ${a.base + (originAbility.get(k) ?? 0)} with its Origin is above ${startingCap}.`
      );
  }
  sys.candidateScores = Object.fromEntries(
    ABILITIES.map(k => [
      k,
      sys.abilities[k].base + sys.abilities[k].increase + (sys.abilities[k].misc ?? 0) + nonCandidateBonus.get(k)
    ])
  );
  const increasesDue = abilityIncreaseLevels().filter(l => l <= level);
  const increasesMissing = increasesDue.filter(l => !increaseAt(l)).length;
  if (increasesMissing)
    todo.push({ order: 11, tab: "main", text: loc`${plural(increasesMissing, "attribute increase")} to assign.` });
  // Small Screen (p.408) lowers the standard budget; a budget set to something else (a lieutenant's 32) stays.
  const budget =
    sys.pointBuyBudget === undefined || sys.pointBuyBudget === null || sys.pointBuyBudget === cfg.pointBuy
      ? campaignPointBuy(cfg.pointBuy)
      : sys.pointBuyBudget;
  // Modular (p.407): each feat bought costs 2 points, each feat given up adds 2.
  const featTrades = campaignFeatTrades(sys.featTrades);
  warnings.push(...featTrades.problems);
  sys.pointBuy = { budget: budget + featTrades.points, spent: pointCost };
  sys.pointBuy.remaining = sys.pointBuy.budget - pointCost;
  if (sys.pointBuy.remaining < 0) {
    warnings.push(loc`Attribute point-buy overspent by ${-sys.pointBuy.remaining}.`);
    // Keep the guidance on attributes until the spend is legal again.
    todo.push({
      order: 9,
      always: true,
      error: true,
      tab: "main",
      text: loc`Attribute points overspent by ${-sys.pointBuy.remaining}: lower an attribute.`
    });
  }
  if (sys.pointBuy.remaining > 0)
    todo.push({
      order: 10,
      always: true,
      tab: "main",
      text: loc`${plural(sys.pointBuy.remaining, "attribute point")} left to spend.`
    });
  const abil = Object.fromEntries(
    ABILITIES.map(k => [k, { value: sys.abilities[k].value, mod: sys.abilities[k].mod }])
  );
  /**
   * Reconstruct earned bonuses at each career level. Previously current-level
   * class/feat bonuses were applied to all earlier skill purchases.
   * Legacy feats with no acquisition level are assumed to date from level 1.
   */
  const stageCache = new Map();
  const stageAt = career => {
    if (stageCache.has(career)) return stageCache.get(career);
    const counts = {};
    for (const entry of progression.slice(0, career)) {
      if (classById.has(entry.classId)) counts[entry.classId] = (counts[entry.classId] ?? 0) + 1;
    }
    const historicalClasses = {};
    const historicalBase = Object.fromEntries(Object.keys(base).map(k => [k, 0]));
    for (const [cid, count] of Object.entries(counts)) {
      const ci = classById.get(cid);
      const row = ci.system.table.find(r => r.level === count) ?? ci.system.table.at(-1) ?? {};
      historicalClasses[cid] = { levels: count, ...row };
      for (const k of Object.keys(historicalBase)) historicalBase[k] += row[k] ?? 0;
    }
    const historicalTb = {
      t1: stepLookup(T.talentBonus.t1, career),
      t2: stepLookup(T.talentBonus.t2, career),
      t3: stepLookup(T.talentBonus.t3, career),
      interestBase: campaignInterestBase(
        career,
        stepLookup(
          T.interests.map(r => [r[0], r[1]]),
          career
        )
      ),
      interestTalent: stepLookup(
        T.interests.map(r => [r[0], r[2]]),
        career
      ),
      interestSpec: stepLookup(
        T.interests.map(r => [r[0], r[3]]),
        career
      )
    };
    const snapshot = { level: career, tb: historicalTb, classes: historicalClasses, base: historicalBase };
    const bonusAt = (target, extra = {}) => {
      let value = 0;
      for (const source of sources) {
        const taken = source.classId
          ? (counts[source.classId] ?? 0) >= source.requiredClassLevel
          : (source.acquiredAtLevel ?? 1) <= career;
        if (!taken) continue;
        for (const b of source.bonuses) {
          if (b.target !== target || (b.level ?? 0) > (source.classId ? (counts[source.classId] ?? 0) : career))
            continue;
          const amount = evaluate(b.value, { ...snapshot, ...extra, rank: source.rank });
          value = target.endsWith(".maxRanks") ? Math.max(value, amount) : value + amount;
        }
      }
      return value;
    };
    const abilities = Object.fromEntries(
      ABILITIES.map(k => {
        const a = sys.abilities[k];
        const inc = abilityIncreaseLevels().filter(x => x <= career && increaseAt(x) === k).length;
        const value = a.base + inc + (a.misc ?? 0) + (sys.aging.modifiers[k] ?? 0) + bonusAt(`abilities.${k}`);
        return [k, { value, mod: mod(value) }];
      })
    );
    const stage = { abilities, classLevels: counts, bonus: target => bonusAt(target, { abilities }) };
    stageCache.set(career, stage);
    return stage;
  };
  const targeted = resolveClassSkillSelections(items, progression, cfg, (key, career, item) => {
    const override = sys.skills?.[key];
    return (
      item.system.classSkills?.includes(key) ||
      allClassSkills() ||
      (item.system.identifier === "schemer" && (stageAt(career).classLevels.schemer ?? 0) >= 6) ||
      stageAt(career).bonus(`skills.${key}.classSkill`) > 0 ||
      (override?.classSkill && career >= (override.classSkillAt ?? 1))
    );
  });
  targeted.rules.push(...inherited.skillRules);
  sys.classSkillRules = targeted.rules;
  warnings.push(...targeted.warnings);
  for (const task of targeted.pendingTasks ?? targeted.pending.map(text => ({ text })))
    todo.push({ order: 21, tab: "classes", ...task });
  for (const rule of targeted.rules.filter(rule => rule.errorReduction))
    sources.push({
      name: rule.source,
      classId: rule.sourceClassId ?? rule.classId,
      requiredClassLevel: rule.sourceClassLevel ?? rule.classLevel,
      rank: 1,
      bonuses: [
        { target: `skills.${rule.skill}.errorReduction`, value: "2", bonusType: `class:${rule.name}` },
        { target: `skills.${rule.skill}.errorFloor`, value: "1" }
      ]
    });

  const unlocked = items
    .filter(item => item.type === "feat" && ruleName(item) === "Unlocked Potential" && activeFeatIds.has(item.id))
    .map(item => ({
      skill: cfg.skills[item.system.choice]
        ? item.system.choice
        : Object.values(cfg.skills).find(skill => norm(skill.name) === norm(item.system.choice))?.key,
      career: item.system.acquiredAtLevel || 1
    }))
    .filter(item => item.skill);
  const phdLocks = classItems
    .flatMap(item => {
      const key = item.system.identifier || item.name,
        fields =
          key === "scientist"
            ? [
                [2, "phdSkill"],
                [11, "phdSkill1"],
                [19, "phdSkill2"]
              ]
            : key === "virtuoso"
              ? [[6, "phdSkill"]]
              : [];
      return fields.flatMap(([milestone, field]) => {
        if (!item.system.classSkills?.includes(item.system[field])) return [];
        let count = 0;
        const index = progression.findIndex(entry => entry.classId === key && ++count === milestone);
        return index < 0 ? [] : [{ skill: item.system[field], career: index + 1 }];
      });
    })
    .concat(
      inherited.entries
        .filter(
          entry =>
            entry.name === "Scientist: Ph.D. (1 skill)" && cfg.classFeatures.scientist.classSkills.includes(entry.skill)
        )
        .map(entry => ({ skill: entry.skill, career: entry.career }))
    );
  const maximumRanksAt = (key, career) => {
    const locks = [
      ...unlocked.filter(lock => lock.skill === key && lock.career <= career).map(() => 3),
      ...phdLocks.filter(lock => lock.skill === key && lock.career <= career).map(() => 5)
    ];
    const bonus = locks.length ? Math.min(...locks) : stageAt(career).bonus(`skills.${key}.maxRanks`);
    return (T.levels[clamp(career, 0, 20)]?.maxRanks ?? 0) + bonus;
  };
  Object.assign(state, { preData, abil, stageAt, targeted, unlocked, maximumRanksAt });
}

/** Step 5: skill ranks. */
function deriveSkillRanks(state) {
  const {
    sys,
    cfg,
    items,
    warnings,
    activeFeatIds,
    todo,
    levelRow,
    progression,
    classAtLevel,
    sources,
    linkedSkillPairs,
    preData,
    stageAt,
    targeted,
    unlocked,
    maximumRanksAt
  } = state;
  const skillDefs = Object.values(cfg.skills);
  const talentClassSkill = new Set();
  for (const s of sources)
    for (const b of s.bonuses) {
      const m = b.target?.match(/^skills\.(\w+)\.classSkill$/);
      if (m && evaluate(b.value, preData)) talentClassSkill.add(m[1]);
    }
  sys.universalClassSkills = [...talentClassSkill];
  const entryClassId = idx => progression[idx]?.classId;
  const manualClassSkillAt = (key, idx) => {
    const override = sys.skills?.[key];
    return !!override?.classSkill && idx + 1 >= (override.classSkillAt ?? 1);
  };
  const isClassSkillAt = (key, idx) => manualClassSkillAt(key, idx) || ruleClassSkillAt(key, idx);
  const ruleClassSkillAt = (key, idx) => {
    if (allClassSkills() || stageAt(idx + 1).bonus(`skills.${key}.classSkill`)) return true;
    const ci = classAtLevel[idx];
    return (
      !!ci?.system.classSkills?.includes(key) ||
      (ci?.system.identifier === "schemer" && (stageAt(idx + 1).classLevels.schemer ?? 0) >= 6) ||
      targeted.rules.some(
        rule =>
          rule.grantsClassSkill && rule.skill === key && rule.classId === entryClassId(idx) && idx + 1 >= rule.career
      )
    );
  };
  const skillRanks = {},
    purchasedRanks = {};
  const skillPurchaseIssues = [];
  const purchaseIssue = (code, level, message, extra = {}) =>
    skillPurchaseIssues.push({ code, level, message, ...extra });
  const skillPoints = [];
  progression.forEach((entry, idx) => {
    let spent = 0;
    for (const [key, raw] of Object.entries(entry.skills ?? {})) {
      const points = Number(raw);
      if (!cfg.skills[key] || !Number.isSafeInteger(points) || points < 0) {
        const message = loc`Level ${idx + 1}: skill purchases require nonnegative whole points for an existing skill (${key}).`;
        warnings.push(message);
        purchaseIssue("allocation", idx + 1, message, { skill: key });
      }
    }
    for (const sd of skillDefs) {
      const pts = Number(entry.skills?.[sd.key] ?? 0) || 0;
      if (!Number.isSafeInteger(pts) || pts < 0 || !pts) continue;
      spent += pts;
      const classSkill = isClassSkillAt(sd.key, idx);
      if (classSkill && !ruleClassSkillAt(sd.key, idx)) {
        const message = loc`Level ${idx + 1}: ${sd.name} is bought as a class skill only because its manual class-skill box is ticked; no class, talent, specialty or feat makes it one. Untick it unless the GC allowed it.`;
        warnings.push(message);
        purchaseIssue("manual-class-skill", idx + 1, message, { skill: sd.key });
      }
      const discount = stageAt(idx + 1).bonus("discountedSkillRanks");
      const purchase = purchasedSkillRanks(pts, classSkill, {
        discountedRanks: Math.max(0, discount - (skillRanks[sd.key] ?? 0))
      });
      if (!purchase.valid) {
        const message = loc`Level ${idx + 1}: ${sd.name} cross-class ranks cost 2 skill points each; ${pts} is invalid.`;
        warnings.push(message);
        purchaseIssue("point-cost", idx + 1, message, { skill: sd.key });
      }
      // Spycraft 2.0 has no fractional skill ranks. Do not pool odd
      // cross-class purchases from separate level-up allocations.
      skillRanks[sd.key] = (skillRanks[sd.key] ?? 0) + purchase.ranks;
      purchasedRanks[sd.key] = (purchasedRanks[sd.key] ?? 0) + purchase.ranks;
      for (const pair of linkedSkillPairs.filter(pair => pair.level <= idx + 1 && pair.skills.includes(sd.key))) {
        const other = pair.skills.find(key => key !== sd.key);
        const maximum = maximumRanksAt(other, idx + 1);
        skillRanks[other] = Math.min(maximum, (skillRanks[other] ?? 0) + purchase.ranks);
      }
      const rankLimit = maximumRanksAt(sd.key, idx + 1);
      if (skillRanks[sd.key] > rankLimit) {
        const message = loc`Level ${idx + 1}: ${sd.name} has ${skillRanks[sd.key]} ranks, exceeding the purchase-time maximum of ${rankLimit}.`;
        warnings.push(message);
        purchaseIssue("rank-limit", idx + 1, message, { skill: sd.key });
      }
    }
    for (const feat of items.filter(
      i =>
        i.type === "feat" &&
        ruleName(i) === "Training" &&
        activeFeatIds.has(i.id) &&
        (i.system.acquiredAtLevel || 1) === idx + 1
    )) {
      let used = 0;
      for (const [key, raw] of Object.entries(feat.system.trainingSkills ?? {})) {
        const points = Number(raw);
        if (points === 0) continue;
        if (!cfg.skills[key] || !Number.isSafeInteger(points) || points < 0) {
          const message = loc`Training: each allocation must be a nonnegative whole number for an existing skill.`;
          warnings.push(message);
          purchaseIssue("training-allocation", idx + 1, message, { skill: key, sourceId: feat.id });
          continue;
        }
        used += points;
        skillRanks[key] = (skillRanks[key] ?? 0) + points;
        purchasedRanks[key] = (purchasedRanks[key] ?? 0) + points;
        const maximum = maximumRanksAt(key, idx + 1);
        if (skillRanks[key] > maximum) {
          const message = loc`Training: ${cfg.skills[key].name} exceeds its acquisition-level rank limit of ${maximum}.`;
          warnings.push(message);
          purchaseIssue("training-rank-limit", idx + 1, message, { skill: key, sourceId: feat.id });
        }
        for (const pair of linkedSkillPairs.filter(pair => pair.level <= idx + 1 && pair.skills.includes(key))) {
          const other = pair.skills.find(k => k !== key);
          if (other) skillRanks[other] = Math.min(maximumRanksAt(other, idx + 1), (skillRanks[other] ?? 0) + points);
        }
      }
      if (used > 5) {
        const message = loc`Training: ${used - 5} of its 5 skill points overspent.`;
        warnings.push(message);
        purchaseIssue("training-budget", idx + 1, message, { sourceId: feat.id });
      }
      if (used < 5)
        todo.push({
          order: 32,
          tab: "feats",
          text: loc`Training (${feat.id}): ${5 - used} skill point(s) to allocate on its item sheet.`
        });
    }
    for (const lock of unlocked.filter(lock => lock.career <= idx + 1))
      if ((skillRanks[lock.skill] ?? 0) < maximumRanksAt(lock.skill, idx + 1)) {
        const message = loc`Level ${idx + 1}: Unlocked Potential requires ${cfg.skills[lock.skill].name} at its maximum rank (${maximumRanksAt(lock.skill, idx + 1)}) before spending points elsewhere.`;
        warnings.push(message);
        purchaseIssue("unlocked-potential", idx + 1, message, { skill: lock.skill });
      }
    skillPoints.push({
      level: idx + 1,
      spent,
      available: 0,
      classId: entry.classId,
      maxRanks: levelRow(idx + 1)?.maxRanks ?? 0,
      skills: Object.fromEntries(
        skillDefs.map(sd => [
          sd.key,
          {
            ranks: skillRanks[sd.key] ?? 0,
            purchasedRanks: purchasedRanks[sd.key] ?? 0,
            maxRanks: maximumRanksAt(sd.key, idx + 1),
            classSkill: isClassSkillAt(sd.key, idx)
          }
        ])
      ),
      classSkills: skillDefs.filter(sd => isClassSkillAt(sd.key, idx)).map(sd => sd.key)
    });
  });
  for (const k of Object.keys(skillRanks)) skillRanks[k] = Math.floor(skillRanks[k]);
  Object.assign(state, {
    skillDefs,
    talentClassSkill,
    skillRanks,
    purchasedRanks,
    skillPurchaseIssues,
    purchaseIssue,
    skillPoints
  });
}

/** Step 6: the feat list. */
function deriveFeatList(state) {
  const { sys, cfg, items, activeFeatIds, classItems, classLevels } = state;
  const featItems = items.filter(i => i.type === "feat");
  const featNames = new Set(featItems.filter(i => activeFeatIds.has(i.id)).map(i => norm(ruleName(i))));
  const featTrees = {};
  const activeFeatTrees = {};
  sys.virtualFeats = [];
  const virtuoso = classItems.find(
    c => (c.system.identifier || c.name) === "virtuoso" && classLevels.virtuoso && cfg.skills[c.system.keySkill]
  );
  if (virtuoso) {
    featNames.add("field of expertise");
    featTrees.basicSkill = 1;
    activeFeatTrees.basicSkill = 1;
    sys.virtualFeats.push({
      name: "Field of Expertise",
      tree: "basicSkill",
      skills: [virtuoso.system.keySkill],
      restrictions: virtuoso.system.keyFocus
    });
  }
  for (const f of featItems) {
    featTrees[f.system.tree] = (featTrees[f.system.tree] ?? 0) + 1;
    if (activeFeatIds.has(f.id)) activeFeatTrees[f.system.tree] = (activeFeatTrees[f.system.tree] ?? 0) + 1;
  }
  Object.assign(state, { featItems, featNames, featTrees, activeFeatTrees });
}

/** Step 7 (phase B): every other bonus. */
function deriveOtherBonuses(state) {
  const {
    sys,
    cfg,
    items,
    T,
    warnings,
    activeFeatIds,
    classItems,
    classById,
    level,
    classLevels,
    classAtLevel,
    base,
    classesData,
    sources,
    tb,
    lr,
    abil,
    skillDefs,
    skillRanks,
    activeFeatTrees
  } = state;
  for (const source of sources)
    for (const bonus of source.bonuses) {
      const key = bonus.target?.match(/^baseSave\.(fort|ref|will)$/)?.[1];
      if (key) base[key] += evaluate(bonus.value, { level, tb, classes: classesData, base, abilities: abil, rank: 1 });
    }
  // Replace Pointman's self-only source rows with the combined, capped team benefit.
  for (const source of sources)
    if (source.classId === "pointman" && source.name === classById.get("pointman")?.name)
      source.bonuses = source.bonuses.filter(b => b.target !== "actionDice.count");
  sys.improvedFortune = improvedFortuneBonus(classLevels.pointman ?? 0, sys.fortuneTeammates ?? []);
  if (sys.improvedFortune.value)
    sources.push({
      name: loc`Improved Fortune (team; maximum +3)`,
      rank: 1,
      bonuses: [{ target: "actionDice.count", value: String(sys.improvedFortune.value) }]
    });
  const rd = {
    level,
    tb,
    classes: classesData,
    base,
    abilities: abil,
    featTrees: activeFeatTrees,
    saves: { fort: { base: base.fort }, ref: { base: base.ref }, will: { base: base.will } },
    skills: Object.fromEntries(skillDefs.map(s => [s.key, { ranks: skillRanks[s.key] ?? 0 }])),
    actionDice: { max: lr?.actionDice ?? 0 }
  };
  const fortuneBold = items.some(
    i => i.type === "feat" && ruleName(i) === "Fortune Favors the Bold" && activeFeatIds.has(i.id)
  );
  rd.actionDice.max +=
    miscActionDice(sys) +
    (crossroadsAllowed() && cfg.tables.crossroads?.[sys.crossroadsTitle]?.level <= level
      ? cfg.tables.crossroads[sys.crossroadsTitle].actionDice
      : 0);
  for (const source of sources)
    for (const b of source.bonuses)
      if (b.target === "actionDice.count") rd.actionDice.max += evaluate(b.value, { ...rd, rank: source.rank });
  if (fortuneBold && (lr?.actionDie ?? 4) === 12) rd.actionDice.max *= 2;
  sys.knowledgeSkillEffects = [];
  const B = new Bonuses(),
    fleetIndependentBonuses = new Bonuses();
  const focusVirtuoso = classItems.find(c => (c.system.identifier || c.name) === "virtuoso" && classLevels.virtuoso);
  const fieldRestrictions = {};
  if (focusVirtuoso) {
    const addFocus = (skill, focus) => {
      const values = fieldRestrictions[skill] ?? [];
      if (!values.includes(focus)) values.push(focus);
      fieldRestrictions[skill] = values;
    };
    if (cfg.skills[focusVirtuoso.system.keySkill]?.focus)
      addFocus(focusVirtuoso.system.keySkill, focusVirtuoso.system.keyFocus || "__unselected__");
    addFocus("profession", focusVirtuoso.system.professionFocus || "__unselected__");
  }
  for (const s of sources)
    for (const b of s.bonuses) {
      if (!b.target || b.target.startsWith("abilities.")) continue;
      let value = evaluate(b.value, { ...rd, rank: s.rank });
      if (b.target === "speed" && (!s.classId || value <= 0))
        fleetIndependentBonuses.add("speed", value, s.name, b.bonusType);
      const knowledgeTarget = b.target.match(/^skills\.(\w+)\.(misc|baseThreat)$/);
      if (
        b.bonusType === "insight" &&
        value > 0 &&
        (b.target === "knowledge" || /^skills\.\w+\.misc$/.test(b.target)) &&
        items.some(i => i.type === "feat" && ruleName(i) === "Unfair Advantage" && activeFeatIds.has(i.id))
      )
        value += 1;
      if (
        knowledgeTarget &&
        (cfg.tables.basicSkillFeats?.[s.name] ||
          ["Advanced Skill Mastery", "Grand Skill Mastery", "Perfect Skill Mastery"].includes(s.name) ||
          s.fieldOfExpertise)
      )
        for (const focus of s.fieldOfExpertise ? (fieldRestrictions[knowledgeTarget[1]] ?? [""]) : [""])
          sys.knowledgeSkillEffects.push({
            skill: knowledgeTarget[1],
            kind: knowledgeTarget[2],
            value,
            type: b.bonusType ?? "",
            focus
          });
      const restricted = b.target.match(
        /^skills\.(\w+)\.(misc|baseThreat|errorReduction|errorReductionZero|errorFloor|cap)$/
      );
      if (s.fieldOfExpertise && restricted && fieldRestrictions[restricted[1]])
        for (const focus of b.restrictedFocus ? [b.restrictedFocus] : fieldRestrictions[restricted[1]])
          sys.conditionalSkillBonuses.push({
            skill: restricted[1],
            focus,
            kind: restricted[2],
            value,
            type: b.bonusType ?? "",
            source: s.name
          });
      else
        B.add(
          s.origin && b.target === "naturalDR"
            ? "qualityNaturalDR"
            : s.origin && /^skills\.\w+\.cap$/.test(b.target)
              ? b.target.replace(/\.cap$/, ".originCap")
              : b.target,
          value,
          s.name,
          b.bonusType
        );
    }
  sys.bonusSources = Object.fromEntries(B.sources);
  const misc = sys.misc ?? {};

  const proficiency = proficiencyTotals(
    sys,
    cfg,
    target => B.get(target),
    (classAtLevel[0]?.system.proficiencies ?? 0) + (lr?.proficiencies ?? 0) + B.get("prof.generic")
  );
  sys.proficiencyTotals = proficiency.totals;
  sys.proficiencyPicks = proficiency.picks;
  warnings.push(...proficiency.warnings);
  sys.weaponSpecialist = weaponSpecialist(sys, items, cfg);

  const small = sys.aging.small;
  const large = !small && B.get("largeSize") > 0;
  // Table 4.3: each +10 Strength above 20–29 multiplies capacity by 4.
  const strength = Math.max(0, sys.abilities.str.value);
  const carrySteps = strength >= 30 ? Math.floor((strength - 20) / 10) : 0;
  const carryStrength = strength - carrySteps * 10;
  const carry = T.carry[Math.max(0, carryStrength - 1)];
  const carryScale = strength === 0 ? 0 : 4 ** carrySteps * (large ? 2 : small ? 0.5 : 1);
  sys.carry = Object.fromEntries(
    Object.entries(carry).map(([key, value]) => [
      key,
      key === "str" ? strength : key === "overload" ? carry.extreme * carryScale + 1 : value * carryScale
    ])
  );

  sys.armorTraining = armorTrainingRules(items, activeFeatIds);
  const equipped = armorTotals(items, {
    checkBonus: B.get("armorCheck"),
    partialDefenseBonus: B.get("defensePartialArmor"),
    armorDefenseBonus: B.get("defenseArmor"),
    armorTraining: sys.armorTraining
  });
  sys.armor = equipped.armor;
  sys.armorFeatRules = sys.armor?.training ?? {};
  warnings.push(...equipped.warnings);
  sys.encumbrance = loadTotals(items, sys.carry);
  const armorDef =
    Math.min(0, sys.armor?.defensePenalty ?? 0, sys.encumbrance.defense) + (sys.armor?.defenseBonus ?? 0);
  const armorCheck = Math.min(0, sys.armor?.check ?? 0, sys.encumbrance.check);
  const armorSpeed = sys.armor?.speed ?? 0;
  if (sys.encumbrance.condition) warnings.push(loc`${sys.encumbrance.load} load: ${sys.encumbrance.condition}.`);
  Object.assign(state, {
    rd,
    fortuneBold,
    B,
    fleetIndependentBonuses,
    misc,
    small,
    large,
    armorDef,
    armorCheck,
    armorSpeed
  });
}

/** Step 8: final totals. */
function deriveFinalTotals(state) {
  const {
    sys,
    cfg,
    items,
    T,
    warnings,
    activeFeatIds,
    todo,
    classItems,
    progression,
    level,
    classLevels,
    classAtLevel,
    inherited,
    base,
    lr,
    abil,
    featItems,
    fortuneBold,
    B,
    fleetIndependentBonuses,
    misc,
    small,
    large,
    armorDef,
    armorCheck,
    armorSpeed
  } = state;
  sys.size = large ? "Large (1×1)" : small ? "Small" : "Medium";
  sys.deathThreshold = deathThreshold(sys.size);
  sys.attributeCollapse = attributeCollapsePlan(sys);
  sys.sizeModifier = large ? -1 : small ? 1 : 0;
  // p.446: NPC-quality benefits cannot combine with identical gear/class benefits.
  sys.qualityNaturalDR = B.get("qualityNaturalDR");
  const classDR = B.get("naturalDR");
  sys.naturalDR = Math.max(classDR, sys.qualityNaturalDR);
  // Death Ride, p.192: DR equal to the Chase feats while driving a vehicle or riding a mount.
  sys.deathRideDR =
    sys.activeFeatNames.includes("Death Ride") && sys.operatingVehicle === true
      ? sys.activeFeatSelections.filter(f => f.tree === "chase").length
      : 0;
  const independentFeatDR =
    sys.superiorCoverState.dr + (sys.activeFeatNames.includes("Too Ugly to Die") ? 2 : 0) + sys.deathRideDR;
  sys.dr = {
    melee: Math.max(sys.qualityNaturalDR, (sys.armor?.dr ?? 0) + classDR) + independentFeatDR,
    other: Math.max(sys.qualityNaturalDR, (sys.armor?.drRanged ?? 0) + classDR) + independentFeatDR
  };
  sys.damageReductionComponents = {
    feat: independentFeatDR,
    natural: sys.qualityNaturalDR,
    class: classDR,
    armorMelee: sys.armor?.dr ?? 0,
    armorOther: sys.armor?.drRanged ?? 0
  };
  sys.armorDRByAttack = Object.fromEntries(
    ["unarmed", "meleeWeapon", "hurledWeapon", "rangedWeapon", "other"].map(kind => [
      kind,
      armorTrainingDRForAttack(sys, kind)
    ])
  );
  sys.sizeHideModifier = large ? -4 : small ? 4 : 0;
  sys.reach = large ? 2 : 1;
  sys.bab = base.bab + (misc.bab ?? 0);
  sys.saves = {
    fort: {
      base: base.fort,
      bonus: B.get("saves.fort"),
      total: base.fort + B.get("saves.fort") + abil.con.mod + (misc.fort ?? 0)
    },
    ref: {
      base: base.ref,
      bonus: B.get("saves.ref"),
      total: base.ref + B.get("saves.ref") + abil.dex.mod + armorCheck + (misc.ref ?? 0)
    },
    will: {
      base: base.will,
      bonus: B.get("saves.will"),
      total: base.will + B.get("saves.will") + abil.wis.mod + (misc.will ?? 0)
    }
  };
  for (const key of ["fort", "ref", "will"]) sys.saves[key].bonusEntries = B.entries.get(`saves.${key}`) ?? [];
  sys.lifestyleAppearance =
    (T.lifestyle[clamp(1 + B.get("lifestyle") + (sys.wealthAllocation?.lifestyle ?? 0), 1, 10) - 1]?.appearanceMod ??
      0) + B.get("appearance");
  sys.readiedMeleeWeapons = readiedMeleeWeapons(sys, items);
  sys.guardWeapons = readiedGuardWeapons(sys, items);
  // Whatever's Handy also helps Defense while an improvised weapon is in hand (module/rules/defense.mjs).
  sys.readiedImprovised = items.some(
    i =>
      i.type === "weapon" &&
      i.system.improvised === true &&
      i.system.equipped === true &&
      i.system.carried !== false &&
      i.system.destroyed !== true &&
      i.system.reserve !== true &&
      (i.system.quantity ?? 1) > 0
  );
  sys.disarmWeapons = readiedDisarmWeapons(sys, items);
  sys.knifeBasics = knifeBasicsPlan(sys, items);
  sys.swordBasics = swordBasicsPlan(sys, items);
  sys.favoredGear = favoredGearState(sys, items);
  warnings.push(...sys.favoredGear.warnings, ...featPossessionWarnings(sys, items));
  const heldReview = sys.guardWeapons.blockedReason || sys.disarmWeapons.blockedReason;
  if (heldReview) {
    warnings.push(heldReview);
    todo.push({ order: 10, tab: "gear", text: heldReview });
  }
  sys.polearmDefense = polearmDefensePlan(sys);
  if (sys.polearmDefense.gearBonus)
    B.add("defense", sys.polearmDefense.gearBonus, "Polearm Basics (readied polearm)", "gear");
  sys.bloodstainDefense = bloodstainDefensePlan(sys, {
    appearance: sys.lifestyleAppearance,
    wornArmor: sys.armor?.adjustments ?? []
  });
  if (sys.bloodstainDefense.bonus) B.add("defense", sys.bloodstainDefense.bonus, "Bloodstain Resistant");
  // Dueling Mastery, p.178: +1 to Defense while holding a readied melee weapon.
  if (
    sys.activeFeatNames.includes("Dueling Mastery") &&
    !sys.disarmWeapons.blockedReason &&
    sys.disarmWeapons.weapons.some(w => ["blunt", "exoticBlunt", "edged", "exoticEdged"].includes(w.proficiency))
  )
    B.add("defense", 1, "Dueling Mastery (readied melee weapon)");
  sys.totalDefenseState = totalDefenseState(sys);
  if (sys.totalDefenseState.needsReview) {
    warnings.push(sys.totalDefenseState.reason);
    todo.push({ order: 10, tab: "main", text: sys.totalDefenseState.reason });
  }
  if (sys.totalDefenseState.active) {
    B.add("defense", 4, "Total Defense", "dodge");
    if (sys.totalDefenseState.equilibrium)
      B.add("defense", sys.totalDefenseState.equilibrium.bonus, "Equilibrium Basics", "dodge");
  }
  sys.combatExpertiseState = combatExpertiseState(sys);
  if (sys.combatExpertiseState.active)
    B.add("defense", sys.combatExpertiseState.dodgeBonus, "Combat Expertise", "dodge");
  sys.fightDefensivelyState = fightDefensivelyState(sys);
  sys.intenseStanceState = intenseStanceState(sys);
  if (sys.fightDefensivelyState.active) {
    B.add("defense", sys.fightDefensivelyState.dodgeBonus, "Fight Defensively", "dodge");
    if (sys.fightDefensivelyState.equilibrium)
      B.add("defense", sys.fightDefensivelyState.equilibrium, "Equilibrium Supremacy", "dodge");
    if (sys.fightDefensivelyState.tribesman)
      B.add("defense", sys.fightDefensivelyState.tribesman, "Tribesman (Fight Defensively)");
  }
  // Not the Face: DR against melee and unarmed attacks while either defensive declaration lasts.
  sys.notTheFaceDR = notTheFaceDR(sys, abil.cha.mod);
  if (sys.notTheFaceDR) {
    sys.armorDRByAttack.unarmed += sys.notTheFaceDR;
    sys.armorDRByAttack.meleeWeapon += sys.notTheFaceDR;
  }
  const sideStanceDefense = sideStanceDefensePenalty(sys);
  if (sideStanceDefense) B.add("defense", sideStanceDefense, "Side Stance");
  sys.bonusSources.defense = B.sources.get("defense") ?? [];
  sys.defenseBonusEntries = (B.entries.get("defense") ?? []).map(e => ({ ...e }));
  const defenseState = attributeDefensePlan(sys, { dodgeEntries: B.entries.get("defense") ?? [] });
  sys.helpless = defenseState.helpless;
  sys.vulnerable = defenseState.vulnerable;
  const defenseBonus = B.get("defense") - defenseState.dodgeLost;
  sys.defense = {
    ...defenseState,
    base: base.defense,
    bonus: defenseBonus,
    armor: armorDef,
    total: 10 + base.defense + defenseBonus + defenseState.dexterity + armorDef + sys.sizeModifier + (misc.defense ?? 0)
  };
  sys.readiedRangedWeapons = readiedRangedWeapons(sys, items);
  sys.cqbReadiedRules = {
    initiativeBonus: sys.activeFeatNames.includes("CQB Supremacy") && sys.readiedRangedWeapons.length ? 5 : 0,
    weaponIds: sys.readiedRangedWeapons.map(w => w.id)
  };
  // Undermine (p.205): a morale penalty on Initiative while it lasts.
  sys.underminedState = underminedState(sys);
  if (sys.underminedState.penalty) B.add("initiative", -sys.underminedState.penalty, "Undermined", "morale");
  if (sys.cqbReadiedRules.initiativeBonus) {
    B.add("initiative", 5, "CQB Supremacy (readied ranged weapon)");
    sys.bonusSources.initiative = B.sources.get("initiative") ?? [];
  }
  const powerInitiative = powerStanceBonus(sys);
  if (powerInitiative) {
    B.add("initiative", powerInitiative, "Power Stance (Strength score)");
    sys.bonusSources.initiative = B.sources.get("initiative") ?? [];
  }
  sys.initiative = {
    base: base.initiative,
    bonus: B.get("initiative"),
    total: base.initiative + B.get("initiative") + abil.dex.mod + (misc.initiative ?? 0)
  };
  sys.conditionPenalties = conditionRollPenalties(sys);
  sys.attack = {
    unarmed:
      cheapShotPenalty(sys, "str") +
      sys.bab +
      abil.str.mod +
      sys.sizeModifier +
      B.get("unarmedAttack") +
      sys.conditionPenalties.attack +
      sys.conditionPenalties.meleeAttack,
    melee:
      cheapShotPenalty(sys, "str") +
      sys.bab +
      abil.str.mod +
      sys.sizeModifier +
      sys.conditionPenalties.attack +
      sys.conditionPenalties.meleeAttack,
    ranged:
      cheapShotPenalty(sys, "dex") +
      sys.bab +
      abil.dex.mod +
      sys.sizeModifier +
      sys.conditionPenalties.attack +
      conditionAbilityPenalty(sys, "dex")
  };
  const martialArtsFeat = featItems.find(feat => ruleName(feat) === "Martial Arts" && activeFeatIds.has(feat.id));
  const mastersArt = featItems.some(feat => ruleName(feat) === "Master's Art" && activeFeatIds.has(feat.id));
  sys.unarmed = {
    usesStrength: !martialArtsFeat || martialArtsFeat.system.choice === "str" || mastersArt,
    strengthComponent: !martialArtsFeat || martialArtsFeat.system.choice === "str" || mastersArt ? abil.str.mod : 0,
    die:
      Math.max(0, ...(B.entries.get("unarmedDie") ?? []).map(e => e.value)) ||
      (sys.proficiencyTotals?.unarmed?.proficient ? 4 : 3),
    extraDice: B.get("unarmedExtraDice"),
    damageBonus: abil.str.mod + B.get("unarmedDamage"),
    threat: Math.min(20, ...(B.entries.get("unarmedBaseThreat") ?? []).map(e => e.value))
  };
  sys.featBonuses = Object.fromEntries(B.map);
  if (small)
    warnings.push(
      loc`Child: Small size; two-handed weapons cannot be used and one-handed weapons require both hands (p.349).`
    );
  sys.knowledgeBonusEntries = B.entries.get("knowledge") ?? [];
  sys.knowledgePhdSkills = [
    ...new Set([
      ...classItems.flatMap(item => {
        const key = item.system.identifier || item.name,
          lvl = classLevels[key] ?? 0;
        const fields =
          key === "scientist"
            ? [
                [2, "phdSkill"],
                [11, "phdSkill1"],
                [19, "phdSkill2"]
              ]
            : key === "virtuoso"
              ? [[6, "phdSkill"]]
              : [];
        return fields
          .filter(([at, field]) => lvl >= at && item.system.classSkills?.includes(item.system[field]))
          .map(([, field]) => item.system[field]);
      }),
      ...inherited.entries
        .filter(
          entry =>
            entry.name === "Scientist: Ph.D. (1 skill)" && cfg.classFeatures.scientist.classSkills.includes(entry.skill)
        )
        .map(entry => entry.skill)
    ])
  ];
  sys.knowledgeStandardBonus =
    level + abil.int.mod + B.get("knowledge") + (misc.knowledge ?? 0) - sys.conditionPenalties.skill;
  sys.knowledgeSkillBonusCondition = skillBonusCondition(sys, sys.knowledgeStandardBonus);
  sys.knowledge = sys.knowledgeSkillBonusCondition.total + sys.conditionPenalties.skill;
  sys.requestCheck = level + abil.cha.mod + (misc.request ?? 0);
  sys.gearCheck = level + abil.wis.mod + (misc.gearCheck ?? 0);
  sys.fleetSpeed = fleetSpeedPlan(sys, {
    ordinarySpeedBonus: B.get("speed"),
    independentSpeedBonus: fleetIndependentBonuses.get("speed"),
    armorSpeed
  });
  if (sys.fleetSpeed.qualityIncrease)
    sys.bonusSources.speed = [
      ...(sys.bonusSources.speed ?? []),
      { source: loc`Fleet (net benefit replacing identical class/gear Speed)`, value: sys.fleetSpeed.qualityIncrease }
    ];
  for (const entry of sys.attributeCollapse.entries) warnings.push(`${entry.label} ${entry.score}: ${entry.text}`);
  sys.incapacitatedForMovement =
    sys.attributeCollapse.immobile ||
    sys.mentalLeapState.unconscious ||
    ["dead", "dazed", "stunned", "paralyzed", "bound", "sleeping", "held", "pinned"].some(
      key => sys.conditionContext?.[key] === true
    );
  const ordinarySpeed = Math.max(
    0,
    sys.fleetSpeed.baseSpeed +
      cheapShotSpeedPenalty(sys) +
      Math.min(0, armorSpeed) +
      sys.encumbrance.speed +
      (misc.speed ?? 0)
  );
  const speedHalves =
    Number(sys.mentalLeapState.exhausted) +
    Number(sys.conditionPenalties.entangled) +
    Number(sys.conditionContext?.blinded === true) +
    Number(sys.conditionContext?.crouched === true);
  sys.conditionSpeedReview = speedHalves > 1 && !sys.encumbrance.immobile && !sys.incapacitatedForMovement;
  sys.speed =
    sys.encumbrance.immobile || sys.incapacitatedForMovement
      ? 0
      : sys.conditionSpeedReview
        ? null
        : Math.floor(ordinarySpeed * (speedHalves ? 0.5 : 1));
  if (sys.conditionSpeedReview)
    warnings.push(loc`Multiple conditions halve Speed: the combined multiplier requires the pending GC ruling.`);
  sys.canRun =
    sys.mentalLeapState.canRun &&
    !sys.incapacitatedForMovement &&
    !sys.encumbrance.immobile &&
    !sys.conditionPenalties.entangled &&
    !sys.conditionPenalties.prone &&
    !sys.conditionPenalties.sprawled;

  sys.postureMovement = {
    prone: sys.conditionPenalties.prone,
    sprawled: sys.conditionPenalties.sprawled,
    standardMove:
      !sys.incapacitatedForMovement &&
      !sys.encumbrance.immobile &&
      !sys.conditionPenalties.prone &&
      !sys.conditionPenalties.sprawled,
    bullRush:
      !sys.incapacitatedForMovement &&
      !sys.encumbrance.immobile &&
      !sys.conditionPenalties.prone &&
      !sys.conditionPenalties.sprawled,
    withdraw:
      !sys.incapacitatedForMovement &&
      !sys.encumbrance.immobile &&
      !sys.conditionPenalties.prone &&
      !sys.conditionPenalties.sprawled,
    bonusStep: !sys.incapacitatedForMovement && !sys.encumbrance.immobile && !sys.conditionPenalties.sprawled
  };

  // Vitality: max die at level 1, then rolls; Con modifier every level.
  let vit = 0;
  const vitalityBreakdown = { dice: 0, constitution: 0, minimumAdjustment: 0 };
  const vitMissing = [];
  progression.forEach((entry, idx) => {
    const ci = classAtLevel[idx];
    const die = ci?.system.vitalityDie ?? 0;
    // Fragile (p.406): after Level 1 each level gives a fixed amount instead of a roll.
    const fixed = idx > 0 ? fragileVitality(die) : null;
    const roll = idx === 0 ? die : (fixed ?? (Number(entry.vitality) || 0));
    if (idx > 0 && fixed === null && !entry.vitality) vitMissing.push(idx + 1);
    vitalityBreakdown.dice += roll;
    vitalityBreakdown.constitution += abil.con.mod;
    vitalityBreakdown.minimumAdjustment += Math.max(0, 1 - roll - abil.con.mod);
    vit += Math.max(1, roll + abil.con.mod);
  });
  // A Career Level 0 character has a flat 6 vitality, which the first class level then replaces (p.27).
  if (!progression.length) vit = LEVEL_ZERO_VITALITY;
  if (vitMissing.length)
    todo.push({ order: 15, tab: "classes", text: loc`Vitality not rolled for level ${vitMissing.join(", ")}.` });
  sys.vitalityBreakdown = vitalityBreakdown;
  sys.vitality ??= { value: 0 };
  sys.vitality.max = Math.max(0, vit + B.get("vitality") + (misc.vitality ?? 0));
  sys.wounds ??= { value: 0 };
  sys.wounds.max =
    (small ? Math.ceil((sys.abilities.con.value * 2) / 3) : Math.floor(sys.abilities.con.value * (large ? 1.5 : 1))) +
    B.get("wounds") +
    (misc.wounds ?? 0);
  sys.stressThreshold = sys.abilities.wis.value + B.get("stressThreshold");
  sys.subdualThreshold = sys.abilities.con.value + B.get("subdualThreshold");

  sys.actionDice ??= { value: 0 };
  // Routine (p.408) rules out Crossroads Subplots, and so their Titles.
  const title = crossroadsAllowed() ? cfg.tables.crossroads?.[sys.crossroadsTitle] : null;
  if (sys.crossroadsTitle && !crossroadsAllowed())
    warnings.push(loc`Routine is in force: no Crossroads Subplots, so the Crossroads Title gives nothing.`);
  const earnedTitle = title && level >= title.level ? title : null;
  sys.crossroads = earnedTitle ?? { actionDice: 0, xpPercent: 0 };
  if (title && level < title.level) warnings.push(loc`${title.label}: the minimum Career Level is ${title.level}.`);
  sys.actionDice.max =
    (lr?.actionDice ?? 0) + B.get("actionDice.count") + (misc.actionDice ?? 0) + (earnedTitle?.actionDice ?? 0);
  sys.actionDice.die = lr?.actionDie ?? 4;
  if (fortuneBold) {
    if (sys.actionDice.die === 12) {
      sys.actionDice.die = 6;
      sys.actionDice.max *= 2;
      // Each die gained from now on arrives as two d6 (p.181), session adjustments included.
      sys.actionDice.gainMultiplier = 2;
    } else sys.actionDice.die += 2;
  }
  // Personal Lieutenant (p.204): always exactly 1 action die.
  if (sys.companionOf?.feat === PERSONAL_LIEUTENANT) {
    sys.actionDice.max = 1;
    if (sys.lieutenantOwner) warnings.push(...lieutenantReview(sys, sys.lieutenantOwner).warnings);
    else warnings.push(loc`Personal Lieutenant: the owner could not be found.`);
  }
  sys.adrenalineJunkieSource = adrenalineSource(sys);
  sys.actionDieAwardSummary = actionDieAwardSummary(sys);
  sys.combatMovement = combatMovementRules(sys);
  sys.senses = baseSensoryRanges(sys);
  // Gunmen widens CQB Range to 60 ft. and Gladiators narrows it to 20 ft. for everyone (p.407).
  sys.cqbRange = campaignCqbRange(sys.activeFeatNames.includes("Marksmanship Supremacy"));
  // Spirited raises player character action dice one type (d12 at most); Bleak stops them exploding and Spirited
  // makes them explode on a natural 1 as well (pp.406, 408).
  const campaignDice = campaignActionDice();
  if (campaignDice.step > 0) sys.actionDice.die = Math.min(12, sys.actionDice.die + 2 * campaignDice.step);
  sys.actionDice.explodes = !campaignDice.noExplode;
  sys.actionDice.explodeLow = campaignDice.explodeLow;
  sys.actionDice.explodeAt = sys.activeFeatNames.includes("Lady Luck's Smile")
    ? sys.actionDice.die - 1
    : sys.actionDice.die;
  sys.actionDice.bonus = B.get("actionDice.bonus");
}

/** Step 9: skill totals. */
function deriveSkillTotals(state) {
  const {
    sys,
    cfg,
    T,
    warnings,
    todo,
    plural,
    classItems,
    progression,
    level,
    classLevels,
    classAtLevel,
    lr,
    abil,
    stageAt,
    targeted,
    maximumRanksAt,
    skillDefs,
    talentClassSkill,
    skillRanks,
    purchasedRanks,
    skillPurchaseIssues,
    purchaseIssue,
    skillPoints,
    B
  } = state;
  const maxRanks = lr?.maxRanks ?? 0;
  sys.maxRanks = maxRanks;
  const anyClass = new Set(
    classItems.filter(c => classLevels[c.system.identifier || c.name]).flatMap(c => c.system.classSkills ?? [])
  );
  if ((classLevels.schemer ?? 0) >= 6 || allClassSkills()) for (const key of Object.keys(cfg.skills)) anyClass.add(key);
  const derivedSkills = {};
  for (const sd of skillDefs) {
    const stored = sys.skills?.[sd.key] ?? {};
    const ranks = skillRanks[sd.key] ?? 0;
    const bonus =
      B.get(`skills.${sd.key}.misc`) +
      (stored.misc ?? 0) +
      (["cultures", "impress", "networking", "profession"].includes(sd.key) ? sys.lifestyleAppearance : 0);
    const totals = sd.abilities.map(a => {
      const normalSkillBonus = ranks + bonus + abil[a].mod - sys.conditionPenalties.skill,
        condition = skillBonusCondition(sys, normalSkillBonus),
        checkPenalty = skillConditionCheckPenalty(sys, a);
      return {
        ability: a,
        normalSkillBonus,
        skillBonus: condition.total,
        conditionBonusAdjustment: condition.adjustment,
        checkPenalty,
        total: condition.total + checkPenalty
      };
    });
    const chosen =
      stored.ability && sd.abilities.includes(stored.ability)
        ? totals.find(t => t.ability === stored.ability)
        : totals.reduce((a, b) => (b.total > a.total ? b : a));
    const capRow = stepLookup(T.skillCap, ranks);
    const skillMaxRanks = maximumRanksAt(sd.key, level);
    derivedSkills[sd.key] = {
      ...stored,
      key: sd.key,
      name: sd.name,
      focus: sd.focus,
      abilities: sd.abilities,
      abilityPenalties: Object.fromEntries(sd.abilities.map(a => [a, conditionSkillPenalty(sys, a)])),
      bonusEntries: B.entries.get(`skills.${sd.key}.misc`) ?? [],
      threatAdjustment: B.get(`skills.${sd.key}.threat`),
      ranks,
      purchasedRanks: purchasedRanks[sd.key] ?? 0,
      bonus,
      totals,
      ability: chosen.ability,
      total: chosen.total,
      isClass:
        anyClass.has(sd.key) ||
        talentClassSkill.has(sd.key) ||
        !!stored.classSkill ||
        targeted.rules.some(rule => rule.grantsClassSkill && rule.skill === sd.key),
      classOverride: !!stored.classSkill,
      threat:
        Math.min(20, ...(B.entries.get(`skills.${sd.key}.baseThreat`) ?? []).map(e => e.value)) -
        B.get(`skills.${sd.key}.threat`),
      errorFloor: Math.max(0, ...(B.entries.get(`skills.${sd.key}.errorFloor`) ?? []).map(e => e.value)),
      take10TimeMultiplier: targeted.rules.some(rule => rule.skill === sd.key && rule.take10Normal) ? 1 : 2,
      errorReductionZero: B.get(`skills.${sd.key}.errorReductionZero`),
      errorReduction: B.get(`skills.${sd.key}.errorReduction`),
      cap:
        Math.min(60, capRow + B.get(`skills.${sd.key}.originCap`)) +
        B.get(`skills.${sd.key}.cap`) +
        (ranks === 0 ? B.get("untrainedSkillCap") : 0),
      maxRanks: skillMaxRanks,
      overMax: ranks > skillMaxRanks
    };
    if (ranks > skillMaxRanks) {
      warnings.push(loc`${sd.name}: ${ranks} ranks exceeds the maximum of ${skillMaxRanks}.`);
      todo.push({
        order: 29,
        always: true,
        error: true,
        tab: "skills",
        text: loc`${sd.name} is over its rank maximum (${ranks} / ${skillMaxRanks}): remove ${ranks - skillMaxRanks}.`
      });
    }
  }
  sys.skillTotals = derivedSkills;
  const overrides = skillDefs.filter(s => sys.skills?.[s.key]?.classSkill).length;
  sys.classSkillPicks = { available: B.get("classSkillPicks"), used: overrides };
  if (overrides > sys.classSkillPicks.available)
    warnings.push(loc`Extra class skills: ${overrides - sys.classSkillPicks.available} over the available choices.`);
  if (sys.classSkillPicks.available > overrides) {
    todo.push({
      order: 31,
      tab: "skills",
      text: loc`${plural(sys.classSkillPicks.available - overrides, "extra class skill")} to choose.`
    });
  }

  // Skill points per level.
  skillPoints.forEach((sp, idx) => {
    const ci = classAtLevel[idx];
    // Skill points are earned once. Later INT damage/temporary changes do not
    // rewrite them; legacy records reconstruct their permanent score at that level.
    const earnedInt = progression[idx].intelligenceModifier;
    const historicalInt = Number.isFinite(earnedInt)
      ? earnedInt
      : Math.floor((stageAt(idx + 1).abilities.int.value - (sys.abilities.int.misc ?? 0) - 10) / 2);
    sp.intelligenceModifier = historicalInt;
    const keySkillPoint =
      ci && (ci.system.identifier || ci.name) === "virtuoso" && cfg.skills[ci.system.keySkill] ? 1 : 0;
    const schemerLevel = ci?.system.identifier === "schemer" ? (stageAt(idx + 1).classLevels.schemer ?? 0) : 0;
    sp.classGrantPoints = schemerLevel === 6 ? 12 : schemerLevel === 10 ? 24 : 0;
    sp.classGrantName = schemerLevel === 6 ? "Evolved Mind" : schemerLevel === 10 ? "Hyperconscious" : "";
    sp.available =
      availableSkillPoints(ci?.system.skillPoints ?? 0, historicalInt, stageAt(idx + 1).bonus("skillPoints"), idx + 1) +
      keySkillPoint +
      sp.classGrantPoints;
    if (keySkillPoint && !(Number(progression[idx].skills?.[ci.system.keySkill]) >= 1))
      warnings.push(
        loc`Level ${idx + 1}: the Virtuoso bonus skill point must be spent on ${cfg.skills[ci.system.keySkill].name}.`
      );
    sp.remaining = sp.available - sp.spent;
    sp.className = ci?.name ?? "?";
    if (sp.remaining < 0) {
      const message = loc`Level ${idx + 1}: ${-sp.remaining} skill point(s) overspent.`;
      warnings.push(message);
      purchaseIssue("career-budget", idx + 1, message);
      todo.push({
        order: 29,
        always: true,
        error: true,
        tab: "skills",
        skillLevel: idx + 1,
        text: loc`Level ${idx + 1} skill points overspent by ${-sp.remaining}: lower a skill.`
      });
    }
    sp.issues = skillPurchaseIssues.filter(issue => issue.level === idx + 1);
  });
  sys.skillPoints = skillPoints;
  sys.skillPurchaseIssues = skillPurchaseIssues;
  const spLeft = skillPoints.filter(sp => sp.remaining > 0);
  if (spLeft.length) {
    todo.push({
      order: 30,
      tab: "skills",
      skillLevel: spLeft[0].level,
      text: loc`Skill points unspent: ${spLeft.map(sp => `level ${sp.level} (${sp.remaining})`).join(", ")}.`
    });
  }
}

/** Step 10: feat slots. */
function deriveFeatSlots(state) {
  const { sys, cfg, items, warnings, todo, plural, classItems, classLevels, inherited, lr, featItems, featTrees, B } =
    state;
  // Feat Purchase and Modular (pp.406–407) add or remove general feat choices.
  const slots = { any: (lr?.feats ?? 0) + B.get("featSlots.any") + campaignFeatTrades(sys.featTrades).feats };
  for (const t of Object.keys(cfg.featTrees)) slots[t] = B.get(`featSlots.${t}`);
  const classGrantCounts = new Map();
  const originGrantNames = new Set(
    items
      .filter(i => i.type === "origin")
      .flatMap(i => i.system.grants ?? [])
      .map(norm)
  );
  for (const cls of classItems)
    for (const grant of cls.system.featGrants ?? []) {
      if (grant.level <= (classLevels[cls.system.identifier || cls.name] ?? 0)) {
        const name = norm(grant.feat);
        classGrantCounts.set(name, (classGrantCounts.get(name) ?? 0) + 1);
      }
    }
  for (const grant of inherited.grants) {
    const name = norm(grant.name);
    classGrantCounts.set(name, (classGrantCounts.get(name) ?? 0) + 1);
  }
  const replacementGrants = [];
  for (const [name, count] of classGrantCounts) {
    const owned = featItems.find(f => norm(ruleName(f)) === name && f.system.featKind !== "temporary");
    if (!owned) continue;
    const replacements = !owned.system.granted ? count : Math.max(0, count + (originGrantNames.has(name) ? 1 : 0) - 1);
    if (replacements) {
      slots[owned.system.tree] = (slots[owned.system.tree] ?? 0) + replacements;
      replacementGrants.push({ name: owned.name, tree: owned.system.tree, count: replacements });
    }
  }
  const spent = {};
  for (const f of featItems)
    if (!f.system.granted && !["temporary", "virtual"].includes(f.system.featKind))
      spent[f.system.tree] = (spent[f.system.tree] ?? 0) + 1;
  let overflow = 0;
  const trees = {};
  for (const t of Object.keys(cfg.featTrees)) {
    const s = spent[t] ?? 0;
    trees[t] = { slots: slots[t], spent: s, owned: featTrees[t] ?? 0 };
    overflow += Math.max(0, s - slots[t]);
  }
  for (const [t, s] of Object.entries(spent)) if (!(t in cfg.featTrees)) overflow += s;
  // The tree season qualities (pp.405–408): a feat from that tree may fill a choice meant for another tree.
  const openTrees = campaignFeatTrees()
    .map(label => Object.keys(cfg.featTrees).find(key => cfg.featTrees[key] === label))
    .filter(Boolean);
  for (const open of openTrees) {
    let extra = Math.max(0, trees[open].spent - trees[open].slots);
    for (const [t, v] of Object.entries(trees)) {
      if (!extra || t === open) continue;
      const spare = Math.max(0, v.slots - v.spent - (v.lent ?? 0));
      const used = Math.min(spare, extra);
      if (!used) continue;
      v.lent = (v.lent ?? 0) + used;
      trees[open].borrowed = (trees[open].borrowed ?? 0) + used;
      extra -= used;
      overflow -= used;
    }
  }
  sys.feats = { any: { slots: slots.any, spent: overflow, remaining: slots.any - overflow }, trees, replacementGrants };
  if (overflow > slots.any) warnings.push(loc`${overflow - slots.any} more feat(s) taken than available.`);
  const unusedTree = Object.entries(trees)
    .filter(([, v]) => v.slots > v.spent + (v.lent ?? 0))
    .map(([t, v]) => `${v.slots - v.spent - (v.lent ?? 0)} ${cfg.featTrees[t]}`);
  sys.feats.unusedTreeSlots = unusedTree;
  if (sys.feats.any.remaining > 0)
    todo.push({
      order: 40,
      tab: "feats",
      weight: sys.feats.any.remaining,
      text: loc`${plural(sys.feats.any.remaining, "feat slot")} open (any tree).`
    });
  if (unusedTree.length)
    todo.push({
      order: 41,
      tab: "feats",
      weight: Object.values(trees).reduce((sum, v) => sum + Math.max(0, v.slots - v.spent), 0),
      text: loc`Bonus feat slots open: ${unusedTree.join(", ")}.`
    });
}

/** Step 11: proficiencies, focuses, interests and contacts. */
function deriveProficiencies(state) {
  const {
    sys,
    cfg,
    items,
    warnings,
    activeFeatIds,
    todo,
    plural,
    progression,
    level,
    classAtLevel,
    tb,
    lr,
    stageAt,
    purchasedRanks,
    B
  } = state;
  const firstClass = classAtLevel[0];
  const { available: profAvail, used: profUsed } = sys.proficiencyPicks;
  if (profUsed > profAvail)
    warnings.push(loc`${profUsed - profAvail} more weapon proficiencies/fortes than available.`);
  if (profUsed < profAvail)
    todo.push({
      order: 50,
      tab: "training",
      text: `${plural(profAvail - profUsed, loc`weapon proficiency/forte pick`)} left.`
    });
  const earnedInt = sys.startingIntelligenceModifier ?? progression[0]?.intelligenceModifier;
  const initialInt = Number.isFinite(earnedInt)
    ? earnedInt
    : Math.floor((stageAt(1).abilities.int.value - (sys.abilities.int.misc ?? 0) - 10) / 2);
  const focuses = focusTotals(sys, items, cfg, target => B.get(target), {
    level,
    startingIntelligence: initialInt,
    activeFeatIds
  });
  sys.focusTotals = focuses.totals;
  // Flawless Identity (p.209): the identity in use adds its Profession focus.
  sys.activeIdentityState = activeIdentity(sys);
  if (sys.activeIdentityState && sys.focusTotals?.profession)
    sys.focusTotals.profession = professionFocusesWithIdentity(sys, sys.focusTotals.profession);
  warnings.push(...identityReview(sys));
  sys.temporaryFocusGrants = focuses.temporaryGrants;
  sys.skillForteTotals = focuses.activeFortes;
  sys.forcedFocuses = Object.fromEntries(Object.entries(focuses.forced).map(([key, value]) => [key, [...value]]));
  sys.focusPicks = focuses.picks;
  warnings.push(...focuses.warnings);
  for (const entry of focuses.pending) {
    const pending = typeof entry === "string" ? { tab: "training", text: entry } : entry;
    todo.push({ order: 51, tab: pending.tab, text: pending.text });
  }
  const focusLeft = Object.entries(sys.focusPicks)
    .filter(([, value]) => value.remaining > 0)
    .map(([key, value]) => `${key} ${value.remaining}`);
  if (focusLeft.length)
    todo.push({ order: 51, tab: "training", text: loc`Focuses/fortes to choose: ${focusLeft.join(", ")}.` });

  const interestList = String(sys.interests ?? "")
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(Boolean);
  sys.interestPicks = {
    available: Math.max(0, tb.interestBase + B.get("interests") - (sys.relinquishedInterests ?? 0)),
    used: new Set(interestList.map(norm)).size
  };
  if (sys.interestPicks.used !== interestList.length) warnings.push(loc`Interests must be distinct.`);
  sys.interestPicks.remaining = sys.interestPicks.available - sys.interestPicks.used;
  if (sys.interestPicks.remaining > 0)
    todo.push({ order: 52, tab: "training", text: loc`${plural(sys.interestPicks.remaining, "interest")} to choose.` });

  if (sys.interestPicks.remaining < 0) warnings.push(loc`Interests: ${-sys.interestPicks.remaining} over the limit.`);
  sys.contactFeatBindings = items
    .filter(i => i.type === "feat" && activeFeatIds.has(i.id) && Object.hasOwn(CONTACT_FEATS, i.name))
    .map(i => ({
      id: i.id,
      name: i.name,
      primaryName: i.system.choice ?? "",
      theme: i.system.contactTheme ?? "",
      themeConfirmed: i.system.contactThemeConfirmed === true,
      mode: i.system.contactGrantMode ?? "associate",
      acquiredAtLevel: i.system.acquiredAtLevel ?? 0
    }));
  sys.contactFeatGrants = contactFeatGrants(sys);
  const pendingContactGrants = sys.contactFeatGrants.filter(g => !g.valid);
  for (const g of pendingContactGrants) todo.push({ order: 53, tab: "feats", text: g.name + ": " + g.reason });
  sys.networkingContactFeatGrants = networkingContactFeatGrants(sys);
  for (const g of sys.networkingContactFeatGrants.filter(g => !g.valid))
    warnings.push((g.name || loc`Networking contact`) + ": " + g.reason);
  const contactsAvail =
    (level > 0 ? 1 : 0) +
    B.get("contacts") -
    2 * sys.contactFeatBindings.length +
    sys.contactFeatGrants.reduce((n, g) => n + g.credit, 0) +
    sys.networkingContactFeatGrants.filter(g => g.valid).length +
    Math.floor((purchasedRanks.networking ?? 0) / 4);
  const contactsUsed = (sys.contacts ?? []).reduce((n, c) => n + (Number(c.rank) || 0), 0);
  sys.contactPicks = { available: contactsAvail, used: contactsUsed, remaining: contactsAvail - contactsUsed };
  if (contactsUsed > contactsAvail)
    warnings.push(loc`Contacts: ${contactsUsed - contactsAvail} choice(s) over the limit.`);
  // Consultants and specialists each contact knows (pp.458–459).
  for (const contact of sys.contacts ?? []) warnings.push(...reviewContactPeople(contact).problems);
  if (contactsUsed < contactsAvail)
    todo.push({
      order: 53,
      tab: "training",
      text: `${plural(contactsAvail - contactsUsed, "contact choice")} unused.`
    });

  const unfinishedSubplots = (sys.subplots ?? []).filter(row => !row.complete),
    minimumSubplots = sys.activeFeatNames.includes("Trouble Magnet") ? 1 : 0;
  // A row counts once it names or describes its Subplot (p.53); a blank row is not a Subplot yet.
  const subplotsInPlay = unfinishedSubplots.filter(
    row => String(row.name ?? "").trim() || String(row.notes ?? "").trim()
  ).length;
  sys.subplotPicks = {
    available: (lr?.subplots ?? 0) + B.get("subplots") + campaignSubplotBonus(),
    used: subplotsInPlay,
    minimum: minimumSubplots,
    inPlay: subplotsInPlay,
    needsSubplot: subplotsInPlay < minimumSubplots
  };
  if (sys.subplotPicks.needsSubplot) {
    warnings.push(loc`Trouble Magnet: at least one unfinished Subplot must be in play (p.191).`);
    todo.push({ order: 54, tab: "training", text: loc`Trouble Magnet: keep at least one unfinished Subplot in play.` });
  }
  if (sys.subplotPicks.used > sys.subplotPicks.available)
    warnings.push(
      loc`Subplots: ${sys.subplotPicks.used - sys.subplotPicks.available} unfinished Subplot(s) over the limit.`
    );
}

/** Step 12: wealth and mission gear. */
function deriveWealthAndGear(state) {
  const { sys, allItems, items, T, warnings, todo, plural, base, gearBase, abil, B, misc } = state;
  const wealthTotal =
    base.wealth + B.get("wealth") + Math.max(0, abil.cha.mod) + (misc.wealth ?? 0) + campaignWealthBonus();
  const alloc = sys.wealthAllocation ?? {};
  const allocated = (alloc.lifestyle ?? 0) + (alloc.possessions ?? 0) + (alloc.spendingCash ?? 0);
  const lifestyleRaw = 1 + B.get("lifestyle") + (alloc.lifestyle ?? 0);
  const possessionsRaw = 1 + B.get("possessions") + (alloc.possessions ?? 0);
  const cashRaw = 1 + B.get("spendingCash") + (alloc.spendingCash ?? 0);
  for (const [name, value] of Object.entries({
    Lifestyle: lifestyleRaw,
    Possessions: possessionsRaw,
    "Spending Cash": cashRaw
  }))
    if (value > 10) warnings.push(loc`${name}: maximum rank is 10.`);
  const lifestyle = clamp(lifestyleRaw, 1, 10),
    possessions = clamp(possessionsRaw, 1, 10),
    cash = clamp(cashRaw, 1, 10);
  const lsRow = T.lifestyle[clamp(lifestyle, 1, T.lifestyle.length) - 1];
  const posRow = T.possessions[clamp(possessions, 1, T.possessions.length) - 1];
  sys.wealth = {
    total: wealthTotal,
    allocated,
    remaining: wealthTotal - allocated,
    lifestyle: {
      rank: lifestyle,
      ...lsRow,
      appearanceMod: sys.lifestyleAppearance,
      appearanceFeatBonus: B.get("appearance")
    },
    possessions: { rank: possessions, picks: posRow?.picks },
    // Table 7.4 under the Historical quality (p.407).
    spendingCash: { rank: cash, amount: periodMoney(100 * cash * cash) }
  };
  sys.wealth.possessions.budget = possessionBudget(items, posRow?.picks, sys);
  warnings.push(...sys.wealth.possessions.budget.warnings);
  if (allocated > wealthTotal) warnings.push(loc`Wealth overspent by ${allocated - wealthTotal}.`);
  if (allocated < wealthTotal)
    todo.push({ order: 60, tab: "gear", text: loc`${plural(wealthTotal - allocated, "wealth point")} to allocate.` });

  const picks = {};
  for (const g of GEAR) picks[g] = { available: gearBase[g] + B.get(`gear.${g}`) + (misc[`gear${g}`] ?? 0), spent: 0 };
  picks.CHA = { available: Math.max(0, abil.cha.mod), spent: 0 };
  for (const i of items) {
    const p = i.system?.pick;
    if (p && picks[p] && i.type !== "class" && !managedAcquisition(sys, i)) picks[p].spent += i.system?.pickCount ?? 1;
  }
  const reservedAllocations = reserveAllocations(sys);
  for (const key of Object.keys(picks)) picks[key].spent += reservedAllocations[key] ?? 0;
  for (const [g, v] of Object.entries(picks)) {
    v.remaining = v.available - v.spent;
    if (v.remaining < 0) warnings.push(loc`Mission gear: ${-v.remaining} ${g} pick(s) over the limit.`);
  }
  sys.gearPicks = picks;
  sys.armorGrantStatus = armorGrantStatus(sys, items);
  warnings.push(...sys.armorGrantStatus.warnings);
  sys.bigStickStatus = bigStickStatus(sys, items);
  warnings.push(...sys.bigStickStatus.warnings);
  const missionExceptions = missionCaliberOptions(sys, items);
  sys.missionCaliberOptions = missionExceptions.options;
  warnings.push(...missionExceptions.warnings);
  warnings.push(...classGearWarnings(sys, allItems));
  const penalty = Math.max(0, -abil.cha.mod);
  const lost = sys.gearPickLosses ?? {};
  const lostTotal = GEAR.reduce((n, key) => n + (lost[key] ?? 0), 0);
  if (lostTotal !== penalty)
    warnings.push(loc`Charisma requires removing ${penalty} mission gear pick(s); currently ${lostTotal} assigned.`);
  for (const key of GEAR) {
    const value = lost[key] ?? 0;
    if (value > gearBase[key]) warnings.push(loc`Charisma pick loss: ${key} may only lose class-granted picks.`);
    picks[key].available = Math.max(0, picks[key].available - value);
    picks[key].remaining = picks[key].available - picks[key].spent;
    if (picks[key].remaining < 0) warnings.push(loc`After Charisma losses, ${key} gear picks are overspent.`);
  }
  sys.ammunitionConfigurations = {};
  for (const item of items.filter(i => i.type === "weapon")) {
    const configuration = ammunitionConfiguration(item.system);
    if (item.id) sys.ammunitionConfigurations[item.id] = configuration;
    if (configuration.applicable && (configuration.requiresChoice || configuration.needsReview))
      todo.push({ order: 43, always: true, tab: "gear", text: `${item.name}: ${configuration.reason}` });
  }
  sys.reserveCapacity = Math.max(0, abil.wis.mod) + (hasProcure(sys) && currentReserves(sys)?.procureAtIntel ? 2 : 0);
  const reserveEntries = items.filter(i => ["weapon", "armor", "gear"].includes(i.type) && i.system.reserve);
  const activeReserves = currentReserves(sys);
  for (const item of items.filter(i => i.system?.reserveAcquisition && !managedAcquisition(sys, i)))
    warnings.push(
      loc`${item.name}: its reserve-acquisition reference does not match a successful claimed transaction.`
    );
  sys.reserveUsed =
    reserveEntries.reduce((n, i) => n + (i.system.common ? (i.system.quantity ?? 1) : 1), 0) +
    (activeReserves ? activeReserves.common + Object.values(activeReserves.picks ?? {}).reduce((a, b) => a + b, 0) : 0);
  sys.activeMissionReserves = activeReserves;
  for (const item of items.filter(
    i =>
      i.system?.reserveAcquisition &&
      i.system.reserveAcquisition.epoch !== String(sys.usagePeriods?.mission ?? "initial")
  ))
    warnings.push(
      loc`${item.name}: acquired during an earlier mission; review its disposition before using it in this mission.`
    );
  if (sys.reserveUsed > sys.reserveCapacity)
    warnings.push(loc`Reserve picks/items: ${sys.reserveUsed} exceeds Wisdom's maximum ${sys.reserveCapacity}.`);
  const charismaCategories = sys.affiliationType === "freelance" ? ["E", "S", "V", "W"] : ["G", "T", "V", "R"];
  for (const item of items.filter(item => ["weapon", "armor", "gear"].includes(item.type) && item.system.pick)) {
    const category = equipmentCategory(item),
      pick = item.system.pick;
    if (
      activeReserves &&
      !managedAcquisition(sys, item) &&
      item.system.caliber > campaignGearCaliber(activeReserves.caliber).caliber
    ) {
      const exception =
        bigStickMatches(sys, item) &&
        sys.bigStickMissionPick.missionCaliber === activeReserves.caliber &&
        sys.bigStickStatus.active &&
        activeReserves.caliber < 5 &&
        sys.weaponSpecialist?.proficiencies?.includes(item.system.proficiency) &&
        item.type === "weapon" &&
        category === "W" &&
        (pick === "W" || (pick === "CHA" && sys.affiliationType === "freelance")) &&
        (item.system.pickCount ?? 1) === 1 &&
        !item.system.possessionSource &&
        !item.system.common &&
        !item.system.ammunitionOnly &&
        !item.system.reserve &&
        item.system.caliber <= activeReserves.caliber + 1;
      if (!exception && !missionCaliberMatches(sys, item))
        warnings.push(
          loc`${item.name}: Caliber exceeds this mission’s recorded allowance; select a valid Big Stick exception or review another source-specific grant.`
        );
    }

    if (
      (item.system.quantity ?? 1) >
      (item.system.bundleSize ?? 1) * (item.system.pickCount ?? 1) +
        (managedAcquisition(sys, item) ? (item.system.reserveAcquisition?.bonusQuantity ?? 0) : 0)
    )
      warnings.push(
        loc`${item.name}: quantity exceeds its paid mission-pick bundles; review pick count or a source-specific extra-quantity grant.`
      );
    if (item.system.ammunitionOnly || ["Standard arrow", "Explosive arrow"].includes(item.name))
      warnings.push(
        loc`${item.name}: ammunition stockpiles cost upgrades/Common Items and cannot be acquired with an ordinary mission weapon pick.`
      );
    if (!GEAR.includes(category))
      warnings.push(loc`${item.name}: choose a valid equipment category before using a mission gear pick.`);
    else if (pick === "CHA" && !charismaCategories.includes(category))
      warnings.push(
        loc`${item.name}: this category is not permitted for ${sys.affiliationType ?? "faction"} Charisma picks.`
      );
    else if (pick !== "CHA" && pick !== category)
      warnings.push(loc`${item.name}: a ${pick} pick cannot buy ${category} gear.`);
  }

  for (const item of items.filter(i => i.type === "gear" && i.system.kitGrade && i.system.kitNonPortable)) {
    if (!String(item.system.kitLocation ?? "").trim())
      todo.push({
        order: 61,
        always: true,
        tab: "gear",
        text: loc`${item.name}: choose this non-portable kit's fixed location before using it.`
      });
    if (item.system.carried)
      warnings.push(loc`${item.name}: non-portable kit cannot be carried; use it at its recorded location.`);
  }
  sys.commonItems = { count: sys.abilities.wis.value, perMission: Math.max(1, Math.ceil(sys.abilities.wis.value / 3)) };
}

/** Step 13: experience. */
function deriveExperience(state) {
  const { sys, T, warnings, level } = state;
  sys.xpNext = level < 20 ? (campaignLevelRow(T.levels[level + 1])?.xp ?? null) : null;
  // Career levels follow XP thresholds (Table 1.3, p.27). A first-level character may start below its threshold,
  // so only later levels are checked; this is a reminder, as the GC may grant levels directly.
  const xpForLevel = campaignLevelRow(T.levels[level])?.xp;
  if (level > 1 && Number.isFinite(xpForLevel) && (Number(sys.xp) || 0) < xpForLevel)
    warnings.push(loc`Career Level ${level} needs ${xpForLevel} XP; this character has ${Number(sys.xp) || 0}.`);

  sys.survivalStats = characterSurvivalStats(sys);
  sys.burrowCapabilities = burrowCapabilities(sys);
  sys.assistantGroupStatuses = (sys.assistantGroups ?? []).map(group => assistantGroupStatus(sys, group));
  sys.recoveryRates = level <= 20 ? recoveryRatePlan(sys) : null;
  if (level > 20) warnings.push(loc`Review Career Level: recovery rates require a RAW level of 20 or lower.`);
}

/** Step 14: core abilities. */
function deriveCoreAbilities(state) {
  const { sys, warnings, classAtLevel, coreItems } = state;
  const firstExpertIdx = classAtLevel.findIndex(c => c?.system.expert);
  sys.coreAbilities = coreItems.map(c => ({ className: c.name, ...c.system.coreAbility }));

  const eagle = eagleEyeState(sys);
  sys.eagleEyeActive = eagle.active ? eagle : null;
  if (eagle.review) warnings.push(loc`Review the saved Eagle Eye die result and range modifier.`);
}

/** Step 15: check prerequisites; run another pass if the set of qualifying feats changed, otherwise finish. */
function settlePrerequisites(state) {
  const {
    sys,
    cfg,
    options,
    allItems,
    items,
    warnings,
    legalFeatIds,
    activeFeatIds,
    todo,
    classById,
    progression,
    level,
    classLevels,
    skillRanks,
    featItems,
    featNames,
    activeFeatTrees,
    rd
  } = state;
  const ctx = prerequisiteContext(sys, featNames, activeFeatTrees, skillRanks);
  const permanentSystem = featItems.some(f => f.system.featKind === "temporary")
    ? computeAgent(
        Object.assign(sys.toObject?.() ?? structuredClone(sys), {
          usagePeriods: sys.usagePeriods,
          worldTime: sys.worldTime,
          mentalLeapCombats: sys.mentalLeapCombats,
          conditionContext: sys.conditionContext
        }),
        items.filter(item => item.type !== "feat" || item.system.featKind !== "temporary"),
        cfg
      )
    : sys;
  const permanentSkillRanks = Object.fromEntries(
    Object.entries(permanentSystem.skillTotals ?? {}).map(([key, skill]) => [key, skill.ranks])
  );
  sys.featStatus = {};
  for (const f of featItems) {
    const usable = featItems.filter(
      other =>
        activeFeatIds.has(other.id) && (f.system.featKind === "temporary" || other.system.featKind !== "temporary")
    );
    const names = new Set([
      ...usable.map(other => norm(ruleName(other))),
      ...sys.virtualFeats.map(other => norm(ruleName(other)))
    ]);
    const trees = {};
    for (const other of [...usable, ...sys.virtualFeats.map(other => ({ system: other }))])
      trees[other.system.tree] = (trees[other.system.tree] ?? 0) + 1;
    const acquisition = featAcquisition(f, sys.featAcquisitionSources, items),
      historical = historicalFeatEligibility(f.system),
      exempt = f.system.granted && f.system.featKind !== "temporary";
    const context = {
      ...prerequisiteContext(
        f.system.featKind === "temporary" ? sys : permanentSystem,
        names,
        trees,
        f.system.featKind === "temporary" ? skillRanks : permanentSkillRanks,
        { featTree: f.system.tree, featChoices: usable }
      ),
      prerequisiteLevel: acquisition.effectiveLevel,
      acquisitionLevel: f.system.acquiredAtLevel || 1,
      manualConfirmed: f.system.manualPrerequisitesConfirmed
    };
    let res = !legalFeatIds.has(f.id)
      ? { ok: false, unmet: ["Invalid or unavailable feat selection"] }
      : !exempt && !historical.ok
        ? { ok: false, unmet: [historical.reason] }
        : !acquisition.ok
          ? { ok: false, unmet: [acquisition.reason] }
          : exempt
            ? { ok: true, unmet: [] }
            : checkPrerequisites(f.system.prerequisites, context);
    if (res.ok && ruleName(f) === "Candidate")
      try {
        candidatePlan(sys, f);
      } catch (error) {
        res = { ok: false, unmet: [error.message] };
      }
    sys.featStatus[f.id] = res;
    if (!res.ok && !exempt) warnings.push(loc`${f.name}: prerequisites not met (${res.unmet.join("; ")}).`);
  }
  const classQualificationSystem = featItems.some(f => f.system.featKind === "virtual")
    ? computeAgent(
        Object.assign(sys.toObject?.() ?? structuredClone(sys), {
          usagePeriods: sys.usagePeriods,
          worldTime: sys.worldTime,
          mentalLeapCombats: sys.mentalLeapCombats,
          conditionContext: sys.conditionContext
        }),
        items.filter(item => item.type !== "feat" || !["temporary", "virtual"].includes(item.system.featKind)),
        cfg
      )
    : permanentSystem;
  const classQualificationRanks = Object.fromEntries(
    Object.entries(classQualificationSystem.skillTotals ?? {}).map(([key, skill]) => [key, skill.ranks])
  );
  // Expert classes: must qualify when first taken.
  for (const [cid, lvl] of Object.entries(classLevels)) {
    const ci = classById.get(cid);
    if (!ci?.system.expert || !ci.system.requirements) continue;
    const firstEntry = progression.find(e => e.classId === cid);
    // New characters retain the actual entry-time result. Existing imported
    // characters have no snapshot; their current status is only provisional.
    const permanent = featItems.filter(
      f => activeFeatIds.has(f.id) && !["temporary", "virtual"].includes(f.system.featKind)
    );
    const permanentTrees = {};
    for (const f of permanent) permanentTrees[f.system.tree] = (permanentTrees[f.system.tree] ?? 0) + 1;
    const classContext = prerequisiteContext(
      classQualificationSystem,
      new Set(permanent.map(f => norm(ruleName(f)))),
      permanentTrees,
      classQualificationRanks
    );
    const res = firstEntry?.expertEntry ?? checkPrerequisites(ci.system.requirements, classContext);
    if (!res.ok)
      warnings.push(
        loc`${ci.name}: expert class requirements not met at ${firstEntry?.expertEntry ? "entry" : loc`current level (entry unknown)`} (${res.unmet.join("; ")}).`
      );
  }

  // Re-evaluate to a fixed point, since enabling a qualified feat can unlock
  // other feats. Failed feats stay owned (and consume slots), but are inactive.
  const eligible = new Set(
    featItems
      .filter(
        f =>
          legalFeatIds.has(f.id) &&
          (ruleName(f) !== "Candidate" || sys.featStatus[f.id]?.ok) &&
          ((f.system.granted && f.system.featKind !== "temporary") || sys.featStatus[f.id]?.ok)
      )
      .map(f => f.id)
  );
  const stable = eligible.size === activeFeatIds.size && [...eligible].every(id => activeFeatIds.has(id));
  if (!stable && (options.pass ?? 0) < featItems.length + 2) {
    return computeAgent(sys, allItems, cfg, { activeFeatIds: eligible, pass: (options.pass ?? 0) + 1 });
  }
  if (!stable) warnings.push(loc`Feat prerequisites did not converge; verify cyclic dependencies.`);
  warnings.push(...sys.weaponSpecialist.warnings);
  for (const text of sys.weaponSpecialist.pending) todo.push({ order: 21, tab: "classes", text });
  sys.skillFeatRules = skillFeatRules(sys, items, cfg);
  sys.limitedUses = limitedUseAbilities(sys, items, cfg);
  sys.rollDataExtras = rd;
  sys.warnings = warnings;
  // Before the first class level only the opening steps are worth listing.
  sys.todo = (level ? todo : todo.filter(t => t.always)).sort((a, b) => a.order - b.order);
  return sys;
}

/** Values prerequisite checks need, built from derived data. */
export function prerequisiteContext(
  sys,
  featNames,
  featTrees,
  skillRanks,
  { featTree = "", featChoices = sys.activeFeatSelections ?? [] } = {}
) {
  const focusSel = sys.focusTotals ?? sys.focuses ?? {};
  const mark = markPrerequisiteBonus(n => featNames.has(norm(n)), featTree);
  return {
    level: sys.level,
    levelBonus: mark,
    sneakAttackDice: sneakAttackCapacity(sys, featNames),
    base: {
      bab: (sys.base?.bab ?? 0) + (featTree === "rangedCombat" ? sniperMagicTouchBonus(sys) : 0) + mark,
      defense: sys.base?.defense ?? 0
    },
    abilities: Object.fromEntries(ABILITIES.map(k => [k, sys.abilities[k].value])),
    skills: skillRanks,
    featTrees,
    hasFeat: n => featNames.has(norm(n)),
    hasFeatChoice: (name, choice) =>
      featNames.has(norm(name)) &&
      featChoices.some(
        f =>
          norm(ruleName(f)) === norm(name) &&
          (norm(name) === "extra gear"
            ? extraGearCategory(f.system?.choice ?? f.choice) !== null &&
              extraGearCategory(f.system?.choice ?? f.choice) === extraGearCategory(choice)
            : norm(f.system?.choice ?? f.choice) === norm(choice))
      ),
    proficient: k => !!(sys.proficiencyTotals ?? sys.proficiencies)?.[k]?.proficient,
    focus: (skill, group) => (focusSel[skill] ?? []).some(f => norm(f) === norm(group)),
    lifestyle: sys.wealth?.lifestyle?.rank ?? 1,
    keySkillRanks: Math.max(0, ...Object.values(skillRanks))
  };
}
