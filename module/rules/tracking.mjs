import { rollPipeline } from "./roll-pipeline.mjs";
/** Survival/Tracking p.167 Table 2.48; Tracking feats p.207; Trail Signs pp.44,47. */
export const TRACKING_SURFACES = {
  verySoft: { label: "Very soft (sand, mud, snow)", dc: 15, error: 0 },
  soft: { label: "Soft (loose dirt, wet grass, gravel)", dc: 20, error: 1 },
  firm: { label: "Firm (packed earth, woods, thick rugs)", dc: 30, error: 2 },
  hard: { label: "Hard (rock, concrete, tile)", dc: 40, error: 3 }
};
export function trackingSkillPlan(
  system,
  key,
  check,
  {
    trackingSurface = "",
    trackingAgeHours = 0,
    trackingWeatherHours = 0,
    trackingLargeGroup = false,
    trackingPace = "half",
    followingPhysicalTrail = false,
    surprise = false
  } = {}
) {
  const feats = new Set(system.activeFeatNames ?? []),
    basics = feats.has("Tracking Basics"),
    mastery = feats.has("Tracking Mastery"),
    insight = mastery && followingPhysicalTrail === true && surprise === true;
  const woodcraft = (system.classOptionSelections ?? []).some(s => s.classId === "scout" && s.name === "Woodcraft"),
    insightBonus = 5 + (feats.has("Unfair Advantage") ? 1 : 0) + (woodcraft ? 1 : 0);
  const bonuses = insight ? [{ type: "insight", value: insightBonus }] : [],
    notes = insight
      ? [
          `Tracking Mastery: +${insightBonus} insight to determine surprise while following this physical trail${woodcraft ? " (Woodcraft +1)" : ""}${feats.has("Unfair Advantage") ? " (Unfair Advantage +1)" : ""} (pp.44,201,207).`
        ]
      : [];
  if (key !== "survival" || check.id !== "tracking")
    return {
      applicable: false,
      errorIncrease: 0,
      take10Normal: false,
      take10Allowed: false,
      take20Allowed: false,
      take20IgnoresError: false,
      bonuses,
      notes,
      synergies: []
    };
  const trailSigns = (system.classOptionSelections ?? []).some(
    s => ["scout", "sleuth"].includes(s.classId) && s.name === "Trail Signs"
  );
  if (!["half", "full", "faster"].includes(trackingPace))
    throw new Error("Choose half Speed, full Speed or faster than full Speed while tracking.");
  const hours = (value, label) => {
    if (!["number", "string"].includes(typeof value) || !Number.isFinite(Number(value)) || Number(value) < 0)
      throw new Error(`Enter nonnegative ${label} hours.`);
    return Number(value);
  };
  const ageHours = hours(trackingAgeHours, "trail age"),
    weatherHours = hours(trackingWeatherHours, "rain/snow"),
    ageSteps = Math.min(3, Math.floor(ageHours / 24)),
    weatherSteps = Math.min(5, Math.floor(weatherHours)),
    largeGroup = trackingLargeGroup === true;
  const surface = Object.hasOwn(TRACKING_SURFACES, trackingSurface) ? TRACKING_SURFACES[trackingSurface] : null,
    speedIncrease = trackingPace === "faster" || (trackingPace === "full" && !trailSigns) ? 2 : 0;
  if (trackingSurface && !surface) throw new Error("Choose a listed Tracking surface.");
  const tableIncrease = Math.max(0, (surface?.error ?? 0) + ageSteps + weatherSteps - (largeGroup ? 1 : 0)),
    errorIncrease = tableIncrease + speedIncrease;
  if (surface)
    notes.push(
      `Tracking: ${surface.label}, base terrain DC ${surface.dc}; trail age DC +${5 * ageSteps}, rain/snow DC +${5 * weatherSteps}${largeGroup ? "; target group >3: DC –5 (minimum 15), error increase –1 (minimum +0)" : ""}. Apply the largest target’s size modifier (Table 5.13) and any opposed Falsify/Cover Up result when adjudicating the DC. Table error increase +${tableIncrease}; pace increase +${speedIncrease}. ${trackingPace === "half" ? "Follow at no more than half Speed." : trackingPace === "full" && trailSigns ? "Trail Signs removes the error penalty at up to full Speed." : "Faster tracking retains its +2 error increase."} Track once per mile outdoors or 300 ft. indoors/vessels; also check when the trail becomes harder (p.167).`
    );
  if (basics)
    notes.push(
      "Tracking Basics permits normal-time take 10 and adds Analysis as an eligible Tracking synergy. Success also reveals whether the trail-maker lost vitality/wounds and their conditions when the trail was made (p.207)."
    );
  if (mastery)
    notes.push(
      "Tracking Mastery permits take 20 even when the error range exceeds 1. Its complex Forensics challenge reduction executes when declaring or selecting the recorded Forensics task scope (p.207)."
    );
  return {
    applicable: true,
    surface: trackingSurface,
    blockedReason: surface ? "" : "Choose the Tracking surface to calculate its error range before rolling.",
    ageHours,
    weatherHours,
    ageSteps,
    weatherSteps,
    largeGroup,
    pace: trackingPace,
    trailSigns,
    errorIncrease,
    tableIncrease,
    speedIncrease,
    dcComponents: surface
      ? {
          terrain: surface.dc,
          age: 5 * ageSteps,
          weather: 5 * weatherSteps,
          group: largeGroup ? -5 : 0,
          groupMinimum: largeGroup ? 15 : null,
          sizeRequiresReview: true
        }
      : null,
    take10Normal: basics,
    take10Allowed: basics,
    take20Allowed: mastery,
    take20IgnoresError: mastery,
    bonuses,
    notes,
    synergies: basics ? [{ skill: "analysis", focusSkill: false, focus: "", condition: "" }] : []
  };
}

/** Freeze both the ordinary Tracking exceptions and the surprise benefit on other skill uses. */
export function trackingFeatEvidence(system, key, check, options = {}) {
  const plan = trackingSkillPlan(system, key, check, options),
    basics = system.activeFeatNames?.includes("Tracking Basics") === true,
    mastery = system.activeFeatNames?.includes("Tracking Mastery") === true;
  if (!((plan.applicable && (basics || mastery)) || plan.bonuses.length)) return null;
  const context = {
    method: options.method ?? "roll",
    trackingSurface: options.trackingSurface ?? "",
    trackingAgeHours: options.trackingAgeHours ?? 0,
    trackingWeatherHours: options.trackingWeatherHours ?? 0,
    trackingLargeGroup: options.trackingLargeGroup === true,
    trackingPace: options.trackingPace ?? "half",
    followingPhysicalTrail: options.followingPhysicalTrail === true,
    surprise: options.surprise === true
  };
  return {
    version: 1,
    skillKey: key,
    checkId: check.id,
    basics,
    mastery,
    analysisRanks: basics ? (system.skillTotals?.analysis?.ranks ?? 0) : null,
    context,
    plan
  };
}
export function validateTrackingFeatProof(system, proof, { checkKind, skillKey, checkId, checkMethod = "roll" } = {}) {
  if (!proof) return;
  const current = trackingFeatEvidence(system, skillKey, { id: checkId }, proof.context);
  if (
    checkKind !== "skill" ||
    proof.skillKey !== skillKey ||
    proof.checkId !== checkId ||
    proof.context?.method !== checkMethod ||
    !current ||
    JSON.stringify(current) !== JSON.stringify(proof)
  )
    throw new Error("The Tracking feat, trail/surprise context or supporting source changed before posting.");
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "trackingFeat",
  order: 1600,
  record: ["trackingFeat"],
  validate: ({ actor, options, checkKind, checkId, checkMethod, skillKey }) =>
    validateTrackingFeatProof(actor.system, options.trackingFeat, { checkKind, skillKey, checkId, checkMethod })
});
