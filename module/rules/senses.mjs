/** Ambient light, pp.350–351, Table 5.14. Blank means circumstances were not supplied. */
export const AMBIENT_LIGHT = {
  none: { label: "None (pitch black)", visual: null, skill: -8, defense: 8 },
  faint: { label: "Faint (moonlit night)", visual: -60, skill: -4, defense: 4 },
  dim: { label: "Dim (dawn/dusk)", visual: -30, skill: -2, defense: 2 },
  moderate: { label: "Moderate (day)", visual: 0, skill: 0, defense: 0 },
  bright: { label: "Bright (floodlights)", visual: 30, skill: 1, defense: -2 }
};
export function lowLightVisionSources(system) {
  const sources = (system.classOptionSelections ?? [])
    .filter(s => s.name === "Low-Light Vision" && ["scout", "sniper"].includes(s.classId))
    .map(s => (s.classId === "scout" ? "Scout Huntsman" : "Sniper Perfect Killer"));
  if ((system.originEffects ?? []).some(s => s.name?.toLowerCase() === "low-light vision"))
    sources.push("Test Subject low-light vision");
  return [...new Set(sources)];
}
export function ambientLightPlan(system, { ambientLight = "", visionCheck = false } = {}) {
  if (!ambientLight) return { specified: false, skillModifier: 0, targetDefenseBonus: 0, notes: [] };
  const row = Object.hasOwn(AMBIENT_LIGHT, ambientLight) ? AMBIENT_LIGHT[ambientLight] : null;
  if (!row) throw new Error("Choose a listed ambient-light condition.");
  const sources = lowLightVisionSources(system),
    ignored = sources.length > 0 && ["faint", "dim"].includes(ambientLight);
  const nightTraining =
    (system.activeFeatNames ?? []).includes("Night Training") && !ignored && ["faint", "dim"].includes(ambientLight);
  const visualDelta = ignored ? 0 : nightTraining ? -Math.floor(Math.abs(row.visual) / 2) : row.visual;
  const blinded = visualDelta === null;
  const skillModifier = visionCheck ? (ignored ? 0 : row.skill) : 0,
    targetDefenseBonus = ignored ? 0 : row.defense;
  return {
    specified: true,
    ambientLight,
    sources,
    ignored,
    skillModifier,
    targetDefenseBonus,
    visualDelta,
    blinded,
    nightTraining,
    notes: [
      `Ambient light: ${row.label}.${ignored ? ` ${sources.join(" / ")} ignores low ambient-light penalties.` : ""}${nightTraining ? " Night Training halves the visual-range penalty; tagged-skill and target Defense modifiers remain." : ""}${visionCheck ? ` Vision-tag check ${skillModifier >= 0 ? "+" : ""}${skillModifier}.` : ""}${blinded ? " No visual range: do not attempt a check requiring eyesight or eye-hand coordination without a specific exception. A Vision tag alone does not establish that eyesight is required." : ""} Target Defense ${targetDefenseBonus >= 0 ? "+" : ""}${targetDefenseBonus} from this illumination (pp.350–351); apply when resolving the target’s Defense. Other sensory conditions and equipment remain separate.`
    ]
  };
}

export function hasOriginSense(system, name) {
  return (system.originEffects ?? []).some(s => s.name?.trim().toLowerCase() === name.toLowerCase());
}
/** p.448: only the specific named skill uses receive these conditional quality bonuses. */
export function sensorySkillEffects(
  system,
  key,
  check,
  { surprise = false, deafened = false, scentUsable = false } = {}
) {
  deafened = deafened === true || system.conditionContext?.deafened === true;
  const hearing =
    hasOriginSense(system, "Improved hearing") &&
    deafened !== true &&
    surprise === true &&
    ((key === "notice" && check.id === "awareness") || (key === "search" && check.id === "perception"));
  const scent =
    hasOriginSense(system, "Improved scent") && scentUsable === true && key === "survival" && check.id === "tracking";
  return {
    hearing,
    scent,
    deafened: deafened === true,
    bonuses: hearing || scent ? [{ type: "unnamed", value: 6 }] : [],
    notes: hearing
      ? ["Improved hearing: +6 to this surprise Awareness/Perception check (p.448)."]
      : scent
        ? ["Improved scent: +6 to Tracking while relying on scent (p.448)."]
        : []
  };
}
/** Night Training p.207 removes blindness only when targeting a nearby character and hearing is available. */
export function sensoryTargetPlan(
  system,
  { blinded = false, deafened = false, targetCharacter = false, distanceFeet = null, ambientLight = "" } = {}
) {
  blinded = blinded === true || system.conditionContext?.blinded === true || system.conditionContext?.sleeping === true;
  deafened = deafened === true || system.conditionContext?.deafened === true;
  const distance = Number(distanceFeet),
    known =
      ["number", "string"].includes(typeof distanceFeet) &&
      distanceFeet !== "" &&
      Number.isFinite(distance) &&
      distance >= 0;
  const originallyBlinded = blinded === true || ambientLight === "none",
    nightTrainingException =
      originallyBlinded &&
      (system.activeFeatNames ?? []).includes("Night Training") &&
      deafened !== true &&
      targetCharacter === true &&
      known &&
      distance <= 10;
  return {
    originallyBlinded,
    deafened: deafened === true,
    nightTrainingException,
    blinded: originallyBlinded && !nightTrainingException
  };
}
export function improvedVisionRangePlan(system, penalty, options = {}) {
  const target = sensoryTargetPlan(system, options),
    applies = hasOriginSense(system, "Improved vision") && !target.blinded,
    reduction = applies ? Math.min(2, Math.max(0, -penalty)) : 0;
  return {
    rangePenalty: penalty + reduction,
    rangePenaltyBase: penalty,
    improvedVisionReduction: reduction,
    sensoryTarget: target
  };
}
/** Same-named non-legacy abilities do not stack across classes (p.29). */
export function keenSensesSources(system) {
  return [
    ...new Set(
      (system.classOptionSelections ?? [])
        .filter(s => ["scout", "sleuth"].includes(s.classId) && s.name === "Keen Senses")
        .map(s => s.classId)
    )
  ];
}
/** Fixed bases plus earned character range modifiers; environment and gear remain separate. */
export function baseSensoryRanges(system) {
  const wis = system.abilities?.wis?.value ?? 0,
    night = (system.activeFeatNames ?? []).includes("Night Training"),
    keenSources = keenSensesSources(system),
    keenSensesBonus = keenSources.length ? 20 : 0,
    baseVisualIncrement = wis * (hasOriginSense(system, "Improved vision") ? 20 : 10),
    baseHearingIncrement = wis * (hasOriginSense(system, "Improved hearing") ? 10 : 5),
    baseScentRange = wis * (hasOriginSense(system, "Improved scent") ? 10 : night ? 3 : 1);
  return {
    blinded: system.conditionContext?.blinded === true || system.conditionContext?.sleeping === true,
    deafened: system.conditionContext?.deafened === true,
    baseVisualIncrement,
    baseHearingIncrement,
    baseScentRange,
    visualIncrement: baseVisualIncrement + keenSensesBonus,
    hearingIncrement: baseHearingIncrement + keenSensesBonus,
    scentRange: baseScentRange + keenSensesBonus,
    keenSensesBonus,
    keenSources,
    lowLightSources: lowLightVisionSources(system),
    nightTraining: night
  };
}

/** Fog/smoke, Table 5.14 p.351; Firefighter Training p.206 changes only smoke visual range. */
export const FOG_SMOKE = {
  light: { label: "Light", visual: -10, skill: -1, defense: 1 },
  moderate: { label: "Moderate", visual: -20, skill: -2, defense: 2 },
  dense: { label: "Dense", visual: -40, skill: -4, defense: 4 }
};
export function fogSmokePlan(system, { obscurant = "", obscurantDensity = "", visionCheck = false } = {}) {
  if (!obscurant && !obscurantDensity)
    return { specified: false, skillModifier: 0, targetDefenseBonus: 0, visualDelta: 0, notes: [] };
  if (!["fog", "smoke"].includes(obscurant) || !Object.hasOwn(FOG_SMOKE, obscurantDensity))
    throw new Error("Choose fog or smoke and its listed density together.");
  const row = FOG_SMOKE[obscurantDensity],
    firefighter = obscurant === "smoke" && system.activeFeatNames?.includes("Firefighter Training") === true,
    visualDelta = firefighter ? -Math.floor(Math.abs(row.visual) / 2) : row.visual,
    skillModifier = visionCheck ? row.skill : 0;
  return {
    specified: true,
    obscurant,
    obscurantDensity,
    firefighter,
    visualDelta,
    skillModifier,
    targetDefenseBonus: row.defense,
    notes: [
      `${row.label} ${obscurant}: visual increment ${visualDelta} ft.${firefighter ? " (Firefighter Training halves the smoke range penalty)" : ""}${visionCheck ? `; Vision-tag skill ${skillModifier}` : ""}; target Defense +${row.defense}. Apply that Defense modifier when adjudicating the target, separately from the attack bonus. Firefighter Training does not reduce the tagged-skill or Defense modifiers (pp.206,351).`
    ]
  };
}

/** Blinded/deafened: p.340 caps and Table 5.14 p.351 tagged-check penalties. */
export function sensorySkillConditionPlan(system, check, options = {}) {
  const deafened = options.deafened === true || system.conditionContext?.deafened === true;
  const blinded =
    options.blinded === true || system.conditionContext?.blinded === true || system.conditionContext?.sleeping === true;
  const target = sensoryTargetPlan(system, { ...options, blinded, deafened, ambientLight: "" });
  const vision = check.tags?.includes("Vision"),
    hearing = check.tags?.includes("Hearing"),
    language = check.tags?.includes("Language");
  const visionAffected = target.blinded && vision,
    hearingAffected = deafened && hearing,
    languageAffected = options.targetDeafened === true && language;
  const capAdjustment = (visionAffected ? -20 : 0) + (hearingAffected ? -10 : 0) + (languageAffected ? -20 : 0),
    skillModifier = (visionAffected ? -8 : 0) + (hearingAffected ? -8 : 0);
  const blockedReasons = [];
  if (target.blinded && options.requiresEyesight === true)
    blockedReasons.push("Blinded: this check requires eyesight or eye-hand coordination (p.351).");
  if (deafened && options.requiresHearing === true)
    blockedReasons.push("Deafened: this check requires hearing (p.351).");
  return {
    blinded: target.blinded,
    deafened,
    targetDeafened: options.targetDeafened === true,
    nightTrainingException: target.nightTrainingException,
    capAdjustment,
    skillModifier,
    blockedReason: blockedReasons.join(" "),
    notes: [
      ...(visionAffected ? ["Blinded: Vision check −8; result cap −20 (pp.340,351)."] : []),
      ...(hearingAffected ? ["Deafened: Hearing check −8; result cap −10 (pp.340,351)."] : []),
      ...(languageAffected ? ["Deafened target: Language check result cap −20 (p.340)."] : []),
      ...(target.nightTrainingException
        ? ["Night Training: not blinded when targeting this character within 10 ft. while able to hear."]
        : [])
    ]
  };
}

/** Blinded character's targets gain +8 Defense, Table 5.14; separate from attack bonuses. */
export function sensoryAttackConditionPlan(system, options = {}) {
  const target = sensoryTargetPlan(system, { ...options, ambientLight: "" });
  return {
    ...target,
    targetDefenseBonus: target.blinded ? 8 : 0,
    notes: target.blinded
      ? ["Blinded: target Defense +8 (pp.340,351); resolve target Defense separately from this attack bonus."]
      : target.nightTrainingException
        ? ["Night Training: not blinded when targeting this character within 10 ft. while able to hear."]
        : []
  };
}
