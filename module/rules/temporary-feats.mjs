import { classFeatureLevels } from "./class-features.mjs";
import { ruleName } from "./rule-name.mjs";
import { armorTypeChoice } from "./armor-training.mjs";
import { loc } from "../i18n.mjs";
/** Session-scoped shared feats, pp.41–43,171. No virtual feat may be shared. */
export const SHARE_ABILITIES = {
  professor: { classId: "scientist", tree: "basicSkill", name: "Professor" },
  trailblazer: { classId: "scout", tree: "terrain", name: "Trailblazer" }
};
export function temporaryFeatActive(system, feat) {
  const grant = feat.system.temporaryGrant;
  return (
    feat.system.featKind !== "temporary" ||
    !grant?.period ||
    String(system.usagePeriods?.[grant.period] ?? "initial") === grant.epoch
  );
}
export function temporarySharePlan(
  system,
  items,
  ability,
  featIds,
  { epoch = "initial", atSessionStart = false, sourceActorUuid = "" } = {}
) {
  const definition = SHARE_ABILITIES[ability];
  if (!definition || !system.coreClassIds?.includes(definition.classId))
    throw new Error(loc`The source actor does not have this core ability.`);
  if (!atSessionStart) throw new Error(loc`Choose shared feats at the start of the session.`);
  if (system.temporaryShares?.[ability]?.epoch === epoch)
    throw new Error(loc`These feats have already been chosen for this session.`);
  if (new Set(featIds).size !== featIds.length || !featIds.length || featIds.length > (system.actionDice?.max ?? 0))
    throw new Error(loc`Choose distinct feats, up to starting action dice.`);
  const feats = featIds.map(id => items.find(item => item.id === id));
  const names = new Set();
  for (const feat of feats) {
    if (
      !feat ||
      feat.type !== "feat" ||
      feat.system.tree !== definition.tree ||
      ["virtual", "temporary"].includes(feat.system.featKind) ||
      !system.featStatus?.[feat.id]?.ok
    )
      throw new Error(loc`Share only possessed, usable permanent feats of the specified tree.`);
    if (names.has(feat.name)) throw new Error(loc`A shared feat cannot give duplicate benefits.`);
    names.add(feat.name);
  }
  return feats.map(feat => ({
    name: feat.name,
    type: "feat",
    system: {
      ...structuredClone(feat.system.toObject?.() ?? feat.system),
      featKind: "temporary",
      granted: true,
      grantSource: definition.name,
      acquiredAtLevel: 0,
      acquisitionSource: "",
      acquisitionCheck: null,
      historicalPrerequisitesConfirmed: false,
      manualPrerequisitesConfirmed: false,
      temporaryGrant: { period: "session", epoch, sourceActorUuid, ability }
    }
  }));
}

/** Schemer 3/7, p.79: one temporary Basic Skill feat per use, ending with the mission. */
export function renaissanceManPlan(system, items, feat, { epoch = "initial", sourceActorUuid = "" } = {}) {
  if ((classFeatureLevels(system)?.schemer ?? 0) < 3) throw new Error(loc`Renaissance Man requires Schemer 3.`);
  if (!feat || feat.type !== "feat" || feat.system.tree !== "basicSkill")
    throw new Error(loc`Choose a Basic Skill feat from the system compendium.`);
  const same = items.some(
    i =>
      i.type === "feat" &&
      i.name.trim().toLowerCase() === feat.name.trim().toLowerCase() &&
      temporaryFeatActive(system, i)
  );
  if (same) throw new Error(loc`This feat is already possessed or active. Choose another Basic Skill feat.`);
  return {
    name: feat.name,
    type: "feat",
    system: {
      ...structuredClone(feat.system.toObject?.() ?? feat.system),
      featKind: "temporary",
      granted: true,
      grantSource: "Renaissance Man",
      acquiredAtLevel: system.level ?? 1,
      acquisitionSource: "",
      acquisitionCheck: null,
      historicalPrerequisitesConfirmed: false,
      manualPrerequisitesConfirmed: false,
      temporaryGrant: {
        period: "mission",
        epoch,
        sourceActorUuid,
        selfGranted: true,
        ability: "renaissanceMan",
        sourceFeatUuid: feat.uuid ?? null
      }
    }
  };
}

/** Intel-phase mission grants, pp.35,48,70,78,81–82; temporary prerequisites p.171. */
export const INTEL_FEAT_ABILITIES = {
  smoothOperator: { classId: "faceman", minimum: 6, maximum: 20, tree: "style", name: "Smooth Operator" },
  blackHat: { classId: "snoop", minimum: 6, maximum: 20, tree: "tradecraft", name: "Black Hat" },
  swat: { classId: "counterterrorist", minimum: 5, maximum: 10, doubleAt: 9, tree: "covert", name: "SWAT" },
  outrider: { classId: "raptor", minimum: 7, maximum: 10, tree: "chase", name: "Outrider" },
  artOfWar: { classId: "tactician", minimum: 3, maximum: 10, doubleAt: 7, tree: "basicCombat", name: "Art of War" }
};
export function intelTemporaryFeatSource(system, ability) {
  const d = Object.hasOwn(INTEL_FEAT_ABILITIES, ability) ? INTEL_FEAT_ABILITIES[ability] : null,
    level = d ? (classFeatureLevels(system)?.[d.classId] ?? 0) : 0;
  return d && Number.isSafeInteger(level) && level >= d.minimum && level <= d.maximum
    ? { ...d, ability, count: d.doubleAt && level >= d.doubleAt ? 2 : 1, level }
    : null;
}
export function sameFeatSelection(a, b, cfg) {
  const normal = value =>
    String(value ?? "")
      .trim()
      .toLowerCase();
  if (a.type !== "feat" || b.type !== "feat" || normal(a.name) !== normal(b.name)) return false;
  const repeatable = a.system.repeatable || cfg.tables.featRules?.[a.name]?.repeatable;
  return !repeatable || (distinctFeatChoice(a) && normal(a.system.choice) === normal(b.system.choice));
}
export function intelTemporaryFeatPlan(
  system,
  items,
  ability,
  feats,
  { cfg, epoch = "initial", sourceActorUuid = "", intelPhaseConfirmed = false, featChoices = [] } = {}
) {
  const source = intelTemporaryFeatSource(system, ability);
  if (!source) throw new Error(loc`This Intel-phase temporary-feat ability is not currently earned.`);
  if (intelPhaseConfirmed !== true)
    throw new Error(loc`Choose these temporary feats during the current mission’s Intel Phase.`);
  if (!Array.isArray(feats) || feats.length !== source.count)
    throw new Error(loc`Choose exactly ${source.count} temporary feat(s) for ${source.name}, in acquisition order.`);
  if (!Array.isArray(featChoices)) throw new Error(loc`Review the chosen feat options.`);
  const planned = [];
  for (const [index, feat] of feats.entries()) {
    if (!feat || feat.type !== "feat" || feat.system.tree !== source.tree)
      throw new Error(loc`Choose only ${source.tree} feats from the system compendium.`);
    const armorChoice = ["Armor Basics", "Armor Mastery"].includes(feat.name),
      choice = armorChoice
        ? armorTypeChoice(featChoices[index])
        : ruleName(feat) === "Weapon Focus"
          ? (featChoices[index] ?? "")
          : "";
    if (armorChoice && !choice) throw new Error(loc`${feat.name}: choose partial, moderate or full armor.`);
    if (ruleName(feat) === "Weapon Focus" && (!Object.hasOwn(cfg.proficiencies, choice) || choice === "unarmed"))
      throw new Error(loc`Weapon Focus needs a possessed proficiency other than Unarmed.`);
    const data = {
      name: feat.name,
      type: "feat",
      system: {
        ...structuredClone(feat.system.toObject?.() ?? feat.system),
        choice,
        featKind: "temporary",
        granted: true,
        grantSource: source.name,
        acquiredAtLevel: system.level ?? 1,
        acquisitionSource: "",
        acquisitionCheck: null,
        historicalPrerequisitesConfirmed: false,
        manualPrerequisitesConfirmed: false,
        temporaryGrant: {
          period: "mission",
          epoch,
          sourceActorUuid,
          selfGranted: true,
          ability,
          sourceFeatUuid: feat.uuid ?? null,
          index,
          count: source.count
        }
      }
    };
    if ([...items.filter(i => temporaryFeatActive(system, i)), ...planned].some(i => sameFeatSelection(data, i, cfg)))
      throw new Error(
        loc`This feat selection is already possessed or chosen; repeatable feats require distinct choices.`
      );
    planned.push(data);
  }
  return planned;
}

/** Guide p.73: one free-action mission use earned at each of levels four and eight. */
export function anyTimeAnyPlaceSource(system) {
  const level = classFeatureLevels(system)?.guide ?? 0;
  return Number.isSafeInteger(level) && level >= 4 && level <= 10 ? { limit: level >= 8 ? 2 : 1 } : null;
}
export function anyTimeAnyPlacePlan(system, items, feat, { epoch = "initial", sourceActorUuid = "" } = {}) {
  if (!anyTimeAnyPlaceSource(system)) throw new Error(loc`Any Time, Any Place requires Guide level 4.`);
  if (!feat || feat.type !== "feat" || feat.system.tree !== "terrain")
    throw new Error(loc`Choose a Terrain feat from the system compendium.`);
  if (
    items.some(
      i =>
        i.type === "feat" &&
        i.name.trim().toLowerCase() === feat.name.trim().toLowerCase() &&
        temporaryFeatActive(system, i)
    )
  )
    throw new Error(loc`This Terrain feat is already possessed or active.`);
  return {
    name: feat.name,
    type: "feat",
    system: {
      ...structuredClone(feat.system.toObject?.() ?? feat.system),
      featKind: "temporary",
      granted: true,
      grantSource: "Any Time, Any Place",
      acquiredAtLevel: system.level ?? 1,
      acquisitionSource: "",
      acquisitionCheck: null,
      historicalPrerequisitesConfirmed: false,
      manualPrerequisitesConfirmed: false,
      temporaryGrant: {
        period: "mission",
        epoch,
        sourceActorUuid,
        selfGranted: true,
        ability: "anyTimeAnyPlace",
        sourceFeatUuid: feat.uuid ?? null
      }
    }
  };
}

/** p.171 restricts another character’s grants; self-granted repeatable benefits follow their own feat. */
export function distinctFeatChoice(feat) {
  return [
    "Advanced Skill Mastery",
    "Grand Skill Mastery",
    "Perfect Skill Mastery",
    "False Start",
    "Mark of a Professional",
    "Weapon Focus",
    "Extra Gear"
  ].includes(feat.name);
}
export function selfGrantedTemporaryFeat(system, feat) {
  const grant = feat.system.temporaryGrant;
  if (!grant) return false;
  const selfAbilities = [
    "renaissanceMan",
    "anyTimeAnyPlace",
    "knowItAll",
    "everydayGenius",
    ...Object.keys(INTEL_FEAT_ABILITIES)
  ];
  if (grant.selfGranted === true && selfAbilities.includes(grant.ability)) return true;
  if (system.actorUuid && grant.sourceActorUuid) return system.actorUuid === grant.sourceActorUuid;
  return selfAbilities.includes(grant.ability);
}

/** Scientist p.42: two Advanced Skill feats per free-action claim; another mission use at twenty. */
export function knowItAllSource(system) {
  const level = classFeatureLevels(system)?.scientist ?? 0;
  return Number.isSafeInteger(level) && level >= 10 && level <= 20 ? { limit: level === 20 ? 2 : 1, count: 2 } : null;
}
export function knowItAllChoiceOptions(system, feat, cfg) {
  if (
    [
      "Advanced Skill Mastery",
      "Grand Skill Mastery",
      "Perfect Skill Mastery",
      "False Start",
      "Mark of a Professional",
      "Practice Makes Perfect",
      "Talented"
    ].includes(feat.name)
  ) {
    const names = [
      ...Object.keys(cfg.tables.basicSkillFeats ?? {}),
      ...((system.virtualFeats ?? []).some(f => ruleName(f) === "Field of Expertise") ? ["Field of Expertise"] : [])
    ];
    return { kind: "basicSkill", options: Object.fromEntries(names.map(name => [name, name])) };
  }
  if (ruleName(feat) === "Unlocked Potential")
    return { kind: "skill", options: Object.fromEntries(Object.entries(cfg.skills).map(([key, s]) => [key, s.name])) };
  return { kind: ruleName(feat) === "Training" ? "training" : "none", options: {} };
}
export function knowItAllPlan(
  system,
  items,
  feats,
  { cfg, epoch = "initial", sourceActorUuid = "", featChoices = [], trainingSkills = [] } = {}
) {
  if (!knowItAllSource(system)) throw new Error(loc`Know It All requires Scientist level 10.`);
  if (!Array.isArray(feats) || feats.length !== 2)
    throw new Error(loc`Choose exactly two Advanced Skill feats in acquisition order.`);
  if (!Array.isArray(featChoices) || !Array.isArray(trainingSkills))
    throw new Error(loc`Review the Advanced Skill feat choices.`);
  const planned = [];
  for (const [index, feat] of feats.entries()) {
    if (!feat || feat.type !== "feat" || feat.system.tree !== "advancedSkill")
      throw new Error(loc`Choose Advanced Skill feats from the system compendium.`);
    const descriptor = knowItAllChoiceOptions(system, feat, cfg),
      choice = ["basicSkill", "skill"].includes(descriptor.kind) ? (featChoices[index] ?? "") : "",
      allocation = {};
    if (["basicSkill", "skill"].includes(descriptor.kind) && !Object.hasOwn(descriptor.options, choice))
      throw new Error(
        loc`${feat.name}: choose a valid ${descriptor.kind === "skill" ? "skill" : loc`Basic Skill feat`}.`
      );
    if (descriptor.kind === "training") {
      const input = trainingSkills[index] ?? {};
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw new Error(loc`Training needs five allocated rank points.`);
      let total = 0;
      for (const [key, points] of Object.entries(input)) {
        if (!Object.hasOwn(cfg.skills, key) || !Number.isSafeInteger(points) || points < 0)
          throw new Error(loc`Training allocations require nonnegative whole points for existing skills.`);
        if (points) {
          allocation[key] = points;
          total += points;
        }
      }
      const canDefer =
        system.activeFeatNames?.includes("I Can Swim") || planned.some(f => ruleName(f) === "I Can Swim");
      if (total > 5 || (total < 5 && !canDefer))
        throw new Error(loc`Allocate exactly five Training rank points, unless I Can Swim permits unspent points.`);
    }
    const data = {
      name: feat.name,
      type: "feat",
      system: {
        ...structuredClone(feat.system.toObject?.() ?? feat.system),
        choice,
        trainingSkills: allocation,
        featKind: "temporary",
        granted: true,
        grantSource: "Know It All",
        acquiredAtLevel: system.level ?? 1,
        acquisitionSource: "",
        acquisitionCheck: null,
        historicalPrerequisitesConfirmed: false,
        manualPrerequisitesConfirmed: false,
        temporaryGrant: {
          period: "mission",
          epoch,
          sourceActorUuid,
          selfGranted: true,
          ability: "knowItAll",
          sourceFeatUuid: feat.uuid ?? null,
          index,
          count: 2
        }
      }
    };
    if ([...items.filter(i => temporaryFeatActive(system, i)), ...planned].some(i => sameFeatSelection(data, i, cfg)))
      throw new Error(
        loc`This feat selection is already possessed or chosen; distinct-target feats require different choices.`
      );
    planned.push(data);
  }
  return planned;
}

/** Everyday Genius p.200: mission allowance, but each chosen feat lasts for the session. */
export function everydayGeniusSource(system) {
  const active = system.activeFeatSelections ?? [];
  if (!active.some(f => ruleName(f) === "Everyday Genius")) return null;
  const limit = active.filter(f => f.tree === "advancedSkill").length;
  return Number.isSafeInteger(limit) && limit > 0 ? { limit } : null;
}
export function everydayGeniusPlan(system, items, feat, { epoch = "initial", sourceActorUuid = "" } = {}) {
  if (!everydayGeniusSource(system)) throw new Error(loc`An eligible Everyday Genius feat is required.`);
  if (!feat || feat.type !== "feat" || feat.system.tree !== "basicSkill" || feat.system.featKind === "virtual")
    throw new Error(loc`Choose a non-virtual Basic Skill feat from the system compendium.`);
  if (
    items.some(
      i =>
        i.type === "feat" &&
        i.name.trim().toLowerCase() === feat.name.trim().toLowerCase() &&
        temporaryFeatActive(system, i)
    ) ||
    (system.virtualFeats ?? []).some(f => f.name.trim().toLowerCase() === feat.name.trim().toLowerCase())
  )
    throw new Error(loc`This Basic Skill feat is already possessed or active.`);
  return {
    name: feat.name,
    type: "feat",
    system: {
      ...structuredClone(feat.system.toObject?.() ?? feat.system),
      featKind: "temporary",
      granted: true,
      grantSource: "Everyday Genius",
      acquiredAtLevel: system.level ?? 1,
      acquisitionSource: "",
      acquisitionCheck: null,
      historicalPrerequisitesConfirmed: false,
      manualPrerequisitesConfirmed: false,
      temporaryGrant: {
        period: "session",
        epoch,
        sourceActorUuid,
        selfGranted: true,
        ability: "everydayGenius",
        sourceFeatUuid: feat.uuid ?? null
      }
    }
  };
}
