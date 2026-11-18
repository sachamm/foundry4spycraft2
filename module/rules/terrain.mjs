import { hasAquaticQuality } from "./environment.mjs";
import { activeNoFear } from "./health.mjs";
import { RESISTANCE_TYPES, qualityResistances } from "./resistances.mjs";
import { stackedBonuses } from "./knowledge.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
/** Terrain training, pp.206–207. Darkness is not a terrain type (p.206). */
/** Active-character daily fluids, p.349; Desert Training halves the requirement everywhere, p.206. */
export function dailyWaterRequirements(system, { temperatureF = null } = {}) {
  if (temperatureF !== null && (typeof temperatureF !== "number" || !Number.isFinite(temperatureF)))
    throw new Error(loc`Enter a finite Fahrenheit temperature.`);
  const desertTraining = system.activeFeatNames?.includes("Desert Training") === true,
    multiplier = desertTraining ? 0.5 : 1;
  return {
    normalQuarts: multiplier,
    hotQuarts: 2 * multiplier,
    heatThresholdF: 90,
    desertTraining,
    multiplier,
    currentQuarts: temperatureF === null ? null : (temperatureF > 90 ? 2 : 1) * multiplier
  };
}
export const HOME_TURF_SKILLS = ["investigation", "notice", "search", "sneak", "streetwise", "survival"];
export function homeTurfSkillPlan(system, key, { homeTurf = false } = {}) {
  const confirmed = homeTurf === true,
    eligible = confirmed && HOME_TURF_SKILLS.includes(key) && system.activeFeatNames?.includes("Home Turf") === true;
  return {
    confirmed,
    eligible,
    capIncrease: eligible ? 5 : 0,
    criticalSuccessDiscount: eligible ? 1 : 0,
    notes: eligible
      ? [
          loc`Home Turf: result cap +5; critical-success cost −1 (minimum 0). Confirmed within five urban blocks or one wilderness mile of home (p.207).`
        ]
      : []
  };
}
export const TERRAIN_TYPES = {
  aquatic: "Aquatic",
  arctic: "Arctic",
  desert: "Desert",
  plains: "Plains",
  forest: "Forest",
  jungle: "Jungle",
  mountain: "Mountain",
  swamp: "Swamp",
  urban: "Urban"
};
const TRAINING = {
  "Aquatic Training": ["aquatic"],
  "Arctic Training": ["arctic"],
  "Desert Training": ["desert", "plains"],
  "Forest Training": ["forest"],
  "Jungle Training": ["jungle"],
  "Mountain Training": ["mountain"],
  "Swamp Training": ["swamp"],
  "Urban Training": ["urban"]
};
export function terrainSkillPlan(
  system,
  key,
  check,
  {
    terrain = "",
    underwater = false,
    navigating = false,
    surprise = false,
    naturalSurface = false,
    installingTrap = false,
    hearingCheck = false,
    deafened = false,
    cityPopulation = 0,
    nightAmbush = false,
    homeTurf = false
  } = {}
) {
  if (terrain && !Object.hasOwn(TERRAIN_TYPES, terrain))
    throw new Error(loc`Choose a listed terrain; darkness is not a terrain type.`);
  if (
    !["number", "string"].includes(typeof cityPopulation) ||
    !Number.isSafeInteger(Number(cityPopulation)) ||
    Number(cityPopulation) < 0
  )
    throw new Error(loc`Enter a nonnegative whole city population, or zero outside a city.`);
  const population = Number(cityPopulation),
    feats = new Set(system.activeFeatNames ?? []),
    matched = Object.entries(TRAINING)
      .filter(
        ([name, types]) =>
          feats.has(name) && (types.includes(terrain) || (name === "Aquatic Training" && underwater === true))
      )
      .map(([name]) => name);
  const woodcraft = (system.classOptionSelections ?? []).some(s => s.classId === "scout" && s.name === "Woodcraft"),
    unfair = feats.has("Unfair Advantage"),
    insightValue = 2 + (woodcraft ? 1 : 0) + (unfair ? 1 : 0),
    insightApplies = key === "survival" || navigating === true || surprise === true;
  const bonuses = insightApplies ? matched.map(source => ({ type: "insight", value: insightValue, source })) : [],
    synergies = [],
    synergySources = [];
  const add = (source, skill) => {
    synergies.push({ skill, focusSkill: false, focus: "", condition: "" });
    synergySources.push({ source, skill });
  };
  // User ruling: the impossible p.206 "Acrobatics/Climb" refers to Balance for natural footing.
  if (feats.has("Arctic Training") && key === "acrobatics" && check.id === "balance" && naturalSurface === true)
    add("Arctic Training", "survival");
  if (feats.has("Mountain Training") && key === "athletics" && check.id === "climb" && naturalSurface === true)
    add("Mountain Training", "survival");
  if (
    feats.has("Forest Training") &&
    terrain === "forest" &&
    key === "security" &&
    check.id === "installation" &&
    installingTrap === true
  )
    add("Forest Training", "survival");
  if (feats.has("Jungle Training") && terrain && terrain !== "urban" && key === "sneak" && check.id === "hide")
    add("Jungle Training", "survival");
  if (
    feats.has("Swamp Training") &&
    key === "notice" &&
    check.tags.includes("Hearing") &&
    hearingCheck === true &&
    deafened !== true
  )
    add("Swamp Training", "survival");
  if (feats.has("Urban Training") && key === "survival" && check.id === "tracking" && population >= 10000)
    add("Urban Training", "streetwise");
  const ambushSources =
      key === "tactics" && check.id === "ambush"
        ? [...matched, ...(feats.has("Night Training") && nightAmbush === true ? ["Night Training"] : [])]
        : [],
    opponentSurprisePenalty = ambushSources.length ? -2 * ambushSources.length : 0;
  const home = homeTurfSkillPlan(system, key, { homeTurf });
  const notes = [...home.notes];
  if (bonuses.length)
    notes.push(
      loc`Terrain training: +${insightValue} insight (${matched.join(", ")})${woodcraft ? loc`; Woodcraft +1 included` : ""}${unfair ? loc`; Unfair Advantage +1 included` : ""}. Matching insight bonuses compete normally (pp.206–207).`
    );
  if (synergySources.length)
    notes.push(
      loc`Terrain feat synergy available: ${synergySources.map(s => s.source + " → " + s.skill).join("; ")}. Normal rank, mode and one-best-synergy rules apply.`
    );
  if (opponentSurprisePenalty)
    notes.push(
      loc`Ambush: opponents’ checks to determine surprise suffer ${opponentSurprisePenalty} (${ambushSources.join(", ")}). Apply this to the opposition when adjudicating the ambush, not to this preparation check.`
    );
  return {
    homeTurf: home.confirmed,
    homeTurfEligible: home.eligible,
    homeTurfCapIncrease: home.capIncrease,
    terrain,
    underwater: underwater === true,
    navigating: navigating === true,
    naturalSurface: naturalSurface === true,
    hearingCheck: hearingCheck === true,
    cityPopulation: population,
    nightAmbush: nightAmbush === true,
    matched,
    woodcraft,
    unfair,
    bonuses,
    synergies,
    synergySources,
    ambushSources,
    opponentSurprisePenalty,
    notes
  };
}

export const LOCAL_HERO_OPPOSITION_SKILLS = ["investigation", "notice", "sneak", "streetwise", "survival"];
export function terrainSkillChecks(system, key, checks) {
  if (key !== "networking" || !system.activeFeatNames?.includes("Local Hero")) return checks;
  return [
    ...checks,
    {
      id: "local-hero-opposition",
      name: "Local Hero Opposition Check",
      attributes: ["wis", "cha"],
      mode: "Active/Secret",
      tags: "",
      error: 1,
      time: loc`Opposed check; GC adjudicates timing`,
      page: 207,
      synergies: [],
      synergyText: "None."
    }
  ];
}
export function localHeroOppositionPlan(
  system,
  key,
  check,
  { homeTurf = false, opposingSkill = "", targetingYou = false, method = "roll" } = {}
) {
  if (key !== "networking" || check.id !== "local-hero-opposition")
    return { applicable: false, blockedReason: "", notes: [] };
  const reasons = [];
  if (!system.activeFeatNames?.includes("Local Hero")) reasons.push(loc`Local Hero must be currently available.`);
  if (homeTurf !== true)
    reasons.push(
      loc`Local Hero opposition requires being within your five-block urban or one-mile wilderness home turf.`
    );
  if (!LOCAL_HERO_OPPOSITION_SKILLS.includes(opposingSkill) || targetingYou !== true)
    reasons.push(
      loc`Confirm an Investigation, Notice, Sneak, Streetwise or Survival check targeting you. Search is not included.`
    );
  if (method !== "roll") reasons.push(loc`Opposed checks cannot take 10 or take 20 (p.91).`);
  return {
    applicable: true,
    opposingSkill,
    targetingYou: targetingYou === true,
    homeTurf: homeTurf === true,
    blockedReason: reasons.join(" "),
    notes: [
      loc`Local Hero: oppose the declared check targeting you using Networking. Use the GC-selected relevant key attribute; normal opposed-result and tie rules apply (pp.87,91,207).`
    ]
  };
}

/** Conditional resistance saves, pp.206–209; the save need not occur in swamp terrain. */
export function terrainSavePlan(
  system,
  key,
  { poison = false, disease = false, avoidCatchingFire = false, smokeInhalation = false } = {}
) {
  const feats = new Set(system.activeFeatNames ?? []),
    bonuses = [];
  if (disease === true && feats.has("Disease Basics")) bonuses.push({ source: "Disease Basics", type: "", value: 2 });
  if (poison === true && feats.has("Poison Basics")) bonuses.push({ source: "Poison Basics", type: "", value: 2 });
  if (poison === true && feats.has("Swamp Training"))
    bonuses.push({ source: "Swamp Training (poison)", type: "insight", value: 2 });
  if (
    feats.has("Firefighter Training") &&
    ((key === "ref" && avoidCatchingFire === true) || (key === "fort" && smokeInhalation === true))
  )
    bonuses.push({ source: "Firefighter Training", type: "insight", value: 4 });
  const existing = system.saves?.[key]?.bonusEntries ?? [],
    adjustment = stackedBonuses([...existing, ...bonuses]) - stackedBonuses(existing);
  return {
    ...(disease === true ? { disease: true } : {}),
    poison: poison === true,
    avoidCatchingFire: avoidCatchingFire === true,
    smokeInhalation: smokeInhalation === true,
    bonuses,
    adjustment,
    notes: bonuses.length
      ? [
          loc`${bonuses.some(b => b.type === "") ? loc`Conditional save bonuses` : loc`Conditional save insight`}: ${bonuses.map(b => b.source + " +" + b.value).join("; ")}; net adjustment ${adjustment} after typed stacking.`
        ]
      : []
  };
}

/** Persistent resistance and breath allowances, pp.193,206–207,333,349. */
export function characterSurvivalStats(system) {
  const feats = new Set(system.activeFeatNames ?? []),
    resistances = { ...(system.armor?.resistances ?? {}) },
    resistanceSources = [],
    quality = qualityResistances(system);
  const coolHeaded = (system.classLevels?.grunt ?? 0) >= 4 ? Math.max(0, system.abilities?.con?.mod ?? 0) : 0;
  if (coolHeaded)
    for (const key of ["stress", "subdual"]) {
      resistanceSources.push({ source: "Grunt Cool-Headed", key, value: coolHeaded });
      if (resistances[key] !== "all") resistances[key] = (resistances[key] ?? 0) + coolHeaded;
    }
  const noFear = activeNoFear(system);
  if (noFear) {
    resistanceSources.push({ source: "Stuntman No Fear II", key: "stress", value: noFear.resistance });
    if (resistances.stress !== "all") resistances.stress = (resistances.stress ?? 0) + noFear.resistance;
  }
  for (const [key, value] of Object.entries(quality)) {
    resistanceSources.push({ source: "Test Subject damage resistance", key, value });
    if (resistances[key] !== "all") resistances[key] = Math.max(resistances[key] ?? 0, value);
  }
  // The p.446 restriction names gear/class benefits; independent feat benefits remain additive.
  for (const [name, key, value] of [
    ["Arctic Training", "CD", 5],
    ["Desert Training", "HT", 5],
    ["Mountain Training", "FA", 5],
    ["Battle Hardened", "stress", 2],
    ["Vital Points Basics", "sneakAttack", 6]
  ])
    if (feats.has(name)) {
      resistanceSources.push({ source: name, key, value });
      if (resistances[key] !== "all") resistances[key] = (resistances[key] ?? 0) + value;
    }
  const chaseFeats = feats.has("Wave Runner")
      ? (system.activeFeatSelections ?? []).filter(f => f.tree === "chase").length
      : 0,
    constitution = system.abilities?.con?.value ?? 0,
    aquaticRounds = feats.has("Aquatic Training") ? (system.skillTotals?.athletics?.ranks ?? 0) : 0,
    breathRounds = 2 * (constitution + chaseFeats) + aquaticRounds;
  const overlandTerrainSpeeds = [];
  for (const [name, terrains] of Object.entries(TRAINING))
    if (feats.has(name) && !["Aquatic Training", "Urban Training"].includes(name))
      for (const terrain of terrains)
        overlandTerrainSpeeds.push({
          terrain,
          label: TERRAIN_TYPES[terrain],
          speed: system.encumbrance?.immobile ? 0 : (system.speed ?? 30) + 10
        });
  const labels = RESISTANCE_TYPES,
    resistanceRows = Object.entries(resistances)
      .filter(([, value]) => value === "all" || value > 0)
      .map(([key, value]) => ({ key, label: labels[key] ?? key, value }));
  const aquatic = hasAquaticQuality(system);
  return {
    dailyWater: dailyWaterRequirements(system),
    aquatic,
    canDrown: !aquatic,
    underwaterSpeed: aquatic ? (system.speed ?? 30) : null,
    noFear,
    overlandTerrainSpeeds,
    resistances,
    resistanceSources,
    resistanceRows,
    breathRounds,
    constitution,
    chaseFeats,
    aquaticRounds
  };
}

/** New conditional-save receipts retain their own source proof, including replacement rolls. */
export function validateTerrainSaveSource(system, source, { checkKind, checkId } = {}) {
  if (!source) return;
  if (
    source.version !== 1 ||
    checkKind !== "save" ||
    source.checkId !== checkId ||
    !source.plan?.bonuses?.length ||
    JSON.stringify(terrainSavePlan(system, checkId, source.plan)) !== JSON.stringify(source.plan)
  )
    throw new Error(loc`The conditional save feat or insight source changed before posting.`);
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "terrainSaveSource",
  order: 1700,
  record: ["terrainSaveSource"],
  validate: ({ actor, options, checkKind, checkId }) =>
    validateTerrainSaveSource(actor.system, options.terrainSaveSource, { checkKind, checkId })
});
rollPipeline.register({
  id: "terrainChecks",
  order: 5010,
  kinds: ["skill"],
  skillChecks: ({ actor, skillKey }, checks) => terrainSkillChecks(actor.system, skillKey, checks)
});
