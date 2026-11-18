import { terrainCoverPlan } from "./terrain-cover.mjs";
import { cqbRangedWeapon } from "./cqb.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
export const COVER_GRADES = ["None", "One-quarter (1/4)", "One-half (1/2)", "Three-quarters (3/4)", "Total"];
/** Counter-Terrorist p.69: second grade replaces the first; no weapon or range restriction. */
export function precisionTakedownGrade(system) {
  const level = system?.classLevels?.counterterrorist ?? 0;
  if (!Number.isSafeInteger(level) || level < 0 || level > 10)
    throw new Error(loc`Review the actual Counter-Terrorist class level before reducing cover.`);
  return level >= 7 ? 2 : level >= 2 ? 1 : 0;
}
/** Table 5.10 p.345. Inputs are the best personal/scenery grades, after other adjudicated grade adjustments. */
export function coverPlan({
  personalCover = 0,
  sceneryCover = 0,
  ranged = false,
  attackerSystem = null,
  attackerWeapon = null,
  precisionAttackerSystem = null,
  humanShieldDefense = 0,
  humanShieldConfirmed = false,
  distanceFeet,
  opponentConfirmed = false,
  defenderSystem = null,
  homeTurfCover = false,
  homeTurfCoverSource = "scenery",
  partialSubmersionCover = false,
  terrainCoverConfirmed = false
} = {}) {
  if (![personalCover, sceneryCover].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 4))
    throw new Error(loc`Choose a cover grade from none through total for each source.`);
  const terrainCover = terrainCoverPlan(defenderSystem ?? {}, {
    personalCover,
    sceneryCover,
    homeTurfCover,
    homeTurfCoverSource,
    partialSubmersionCover,
    terrainCoverConfirmed
  });
  if (terrainCover) {
    personalCover = terrainCover.personalCover;
    sceneryCover = terrainCover.sceneryCover;
  }
  if (typeof ranged !== "boolean" || typeof opponentConfirmed !== "boolean")
    throw new Error(loc`Declare ranged attack and opponent eligibility with their checkboxes.`);
  const baseGrade = Math.min(4, personalCover + sceneryCover),
    supremacy = attackerSystem?.activeFeatNames?.includes("CQB Supremacy") === true;
  let within = false;
  if (supremacy) {
    const range = attackerSystem.cqbRange ?? 30;
    if (
      !Number.isFinite(range) ||
      range < 0 ||
      typeof distanceFeet !== "number" ||
      !Number.isFinite(distanceFeet) ||
      distanceFeet < 0
    )
      throw new Error(loc`Confirm finite nonnegative target distance and current CQB Range for the selected attacker.`);
    if (!ranged || !attackerWeapon || !cqbRangedWeapon(attackerWeapon))
      throw new Error(loc`CQB Supremacy cover reduction requires the selected ranged weapon and a ranged attack.`);
    within = distanceFeet <= range;
  }
  const precisionGrade = precisionTakedownGrade(precisionAttackerSystem ?? attackerSystem),
    partial = baseGrade > 0 && baseGrade < 4,
    precisionReduction = opponentConfirmed && partial ? Math.min(baseGrade, precisionGrade) : 0;
  const supremacyReduction =
      supremacy && within && opponentConfirmed && partial ? Math.min(1, baseGrade - precisionReduction) : 0,
    sharpshooter = attackerSystem?.activeFeatNames?.includes("Sharpshooter Basics") === true;
  if (sharpshooter && (!ranged || !attackerWeapon || !cqbRangedWeapon(attackerWeapon)))
    throw Error(loc`Sharpshooter Basics cover reduction requires the selected ranged weapon and a ranged attack.`);
  const sharpshooterReduction =
      sharpshooter && opponentConfirmed && partial
        ? Math.min(1, baseGrade - precisionReduction - supremacyReduction)
        : 0,
    grade = baseGrade - precisionReduction - supremacyReduction - sharpshooterReduction;
  const listedDefenseBonus = 2 * grade,
    safeAttack = (precisionAttackerSystem ?? attackerSystem)?.classLevels?.counterterrorist >= 4;
  if (
    !Number.isSafeInteger(humanShieldDefense) ||
    humanShieldDefense < 0 ||
    humanShieldDefense > Math.min(listedDefenseBonus, 2 * personalCover) ||
    typeof humanShieldConfirmed !== "boolean"
  )
    throw new Error(
      loc`Review the remaining human-shield Defense component after grade reductions; it cannot exceed personal or total remaining cover Defense.`
    );
  if (humanShieldDefense > 0 && !humanShieldConfirmed)
    throw new Error(
      loc`The GC must confirm the actual remaining human-shield Defense component after grade reductions.`
    );
  const humanShieldEffective = safeAttack ? Math.floor(humanShieldDefense / 2) : humanShieldDefense,
    safeAttackReduction = humanShieldDefense - humanShieldEffective;
  return {
    ...(terrainCover ? { terrainCover } : {}),
    humanShieldDefense,
    humanShieldEffective,
    humanShieldConfirmed,
    safeAttack,
    safeAttackReduction,
    listedDefenseBonus,
    personalCover,
    sceneryCover,
    baseGrade,
    grade,
    label: COVER_GRADES[grade],
    defenseBonus: listedDefenseBonus - safeAttackReduction,
    reflexBonus: baseGrade,
    precisionGrade,
    precisionReduction,
    sharpshooter,
    sharpshooterReduction,
    supremacy,
    supremacyReduction,
    within,
    requiresPenetration: grade === 4,
    notes: [
      ...(terrainCover
        ? terrainCover.sources
            .filter(s => s.increase)
            .map(s => loc`${s.source}: +1quarter ${s.kind} cover before attacker reductions.`)
        : []),
      ...(safeAttackReduction
        ? [
            loc`Safe Attack: the GC-confirmed remaining human-shield Defense component +${humanShieldDefense} is halved, rounded down, to +${humanShieldEffective}. Other cover Defense remains unchanged.`
          ]
        : []),
      ...(precisionReduction
        ? [
            loc`Precision Takedown ${precisionGrade === 2 ? "II" : "I"}: opponent loses ${precisionReduction} cover grade${precisionReduction === 1 ? "" : "s"} against this attack.`
          ]
        : []),
      ...(sharpshooterReduction
        ? [loc`Sharpshooter Basics: opponent loses one quarter cover against this ranged attack (p.182).`]
        : []),
      ...(supremacyReduction
        ? [loc`CQB Supremacy: opponent within CQB Range loses one quarter cover against this ranged attack.`]
        : []),
      ...(grade === 4
        ? [loc`Total cover: the shot has to get through the cover first; Defense alone does not permit a direct hit.`]
        : []),
      ...(grade
        ? [
            loc`An attack that would hit without the cover Defense bonus hits the cover instead. The GC resolves cover Damage saves, penetration and which combined cover is hit.`
          ]
        : [])
    ]
  };
}

/** Cover grants Reflex only against an effect originating beyond it (p.345), never other saves. */
export function saveCoverPlan(
  key,
  { personalCover, sceneryCover, effectBeyondCover, ...terrainOptions } = {},
  system = null
) {
  if (
    key !== "ref" ||
    ([personalCover, sceneryCover, effectBeyondCover].every(v => v === undefined) &&
      !terrainOptions.homeTurfCover &&
      !terrainOptions.partialSubmersionCover)
  )
    return null;
  const parse = value => {
    if (value === undefined) return 0;
    if (typeof value === "string" && /^[0-4]$/.test(value)) return Number(value);
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 4) return value;
    throw new Error(loc`Choose a listed personal/scenery cover grade for this Reflex save.`);
  };
  if (effectBeyondCover !== undefined && typeof effectBeyondCover !== "boolean")
    throw new Error(loc`Confirm whether this effect originates beyond the cover.`);
  const cover = coverPlan({
      homeTurfCover: terrainOptions.homeTurfCover ?? false,
      homeTurfCoverSource: terrainOptions.homeTurfCoverSource ?? "scenery",
      partialSubmersionCover: terrainOptions.partialSubmersionCover ?? false,
      terrainCoverConfirmed: terrainOptions.terrainCoverConfirmed ?? false,
      defenderSystem: system,
      personalCover: parse(personalCover),
      sceneryCover: parse(sceneryCover)
    }),
    beyond = effectBeyondCover === true;
  return {
    version: 1,
    ...(cover.terrainCover ? { terrainCover: cover.terrainCover } : {}),
    personalCover: cover.personalCover,
    sceneryCover: cover.sceneryCover,
    grade: cover.baseGrade,
    effectBeyondCover: beyond,
    bonus: beyond ? cover.reflexBonus : 0
  };
}

/** A feat-improved Reflex receipt keeps the exact raw grades and current feat source on replacement rolls. */
export function validateCoverSaveSource(system, proof, { checkKind, checkId } = {}) {
  if (!proof?.terrainCover) return;
  const current = saveCoverPlan(
    "ref",
    { ...proof.terrainCover.context, effectBeyondCover: proof.effectBeyondCover },
    system
  );
  if (checkKind !== "save" || checkId !== "ref" || JSON.stringify(current) !== JSON.stringify(proof))
    throw new Error(loc`The terrain cover save source, grades or circumstances changed before posting.`);
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "coverSaveSource",
  order: 1690,
  record: ["coverSave"],
  validate: ({ actor, options, checkKind, checkId }) =>
    validateCoverSaveSource(actor.system, options.coverSave, { checkKind, checkId })
});

// Cover as part of a save plan.
rollPipeline.register({
  id: "coverSaveTerm",
  kinds: ["save"],
  order: 9490,
  terms({ system, saveKey, input }) {
    const plan = saveCoverPlan(saveKey, input, system);
    return {
      rowAt: 100,
      rows: [[loc`Cover`, plan?.bonus ?? 0]],
      flavorAt: 50,
      flavor: plan?.bonus ? loc` — Cover/Reflex +${plan.bonus}` : "",
      options: { coverSave: plan }
    };
  }
});
