import { loc } from "../i18n.mjs";
/** General underwater checks p.349; Aquatic quality p.446. */
export function hasAquaticQuality(system) {
  return (system.originEffects ?? []).some(effect => effect.qualityKey === "aquatic");
}
export function underwaterCheckPlan(
  system,
  { underwater = false, kind = "skill", skillKey = "", checkName = "", saveKey = "" } = {}
) {
  const declared = underwater === true,
    aquatic = hasAquaticQuality(system),
    athleticsRanks = system.skillTotals?.athletics?.ranks ?? 0;
  const swim = kind === "skill" && skillKey === "athletics" && /^Swim(?: Check)?$/i.test(checkName.trim());
  const eligible = ["skill", "knowledge"].includes(kind) || (kind === "save" && saveKey === "ref"),
    penalty = declared && eligible && !swim && !aquatic ? (athleticsRanks >= 5 ? -2 : -4) : 0;
  return {
    underwater: declared,
    aquatic,
    athleticsRanks,
    swimExempt: declared && swim,
    penalty,
    notes:
      declared && eligible
        ? [
            aquatic
              ? loc`Aquatic quality: immune to underwater check penalties (pp.349,446).`
              : swim
                ? loc`Athletics/Swim is exempt from the general underwater check penalty (p.349).`
                : loc`Underwater: ${penalty} check penalty with ${athleticsRanks} Athletics ranks (p.349).`
          ]
        : []
  };
}

/** Fleet p.447 competes with identical gear/class benefits p.446; independent bonuses retain their own scope. */
export function fleetSpeedPlan(system, { ordinarySpeedBonus = 0, independentSpeedBonus = 0, armorSpeed = 0 } = {}) {
  const grade = (system.originEffects ?? []).filter(effect => effect.qualityKey === "fleet").length;
  const normalSpeed = 30 + ordinarySpeedBonus + Math.max(0, armorSpeed),
    independentSpeed = 30 + independentSpeedBonus;
  const fleetSpeed = grade ? Math.max(independentSpeed, Math.min(60, independentSpeed + 10 * grade)) : null,
    baseSpeed = grade ? Math.max(normalSpeed, fleetSpeed) : normalSpeed;
  return {
    grade,
    normalSpeed,
    independentSpeed,
    fleetSpeed,
    baseSpeed,
    qualityIncrease: baseSpeed - normalSpeed,
    qualityLimit: 60
  };
}

/** Burrow p.446: the material statistic is for one-inch thickness, not total barrier thickness. */
export function burrowCapabilities(system) {
  if (!(system.originEffects ?? []).some(e => e.qualityKey === "burrow")) return null;
  const strength = system.abilities?.str?.value;
  if (!Number.isSafeInteger(strength) || strength < 0) return null;
  return {
    strength,
    maximumMaterialSave: Math.ceil(strength / 2),
    runAllowed: false,
    ordinaryFollowerFillThreshold: 6
  };
}
export function burrowMaterialPlan(system, { damageSaveBonus, action = "move", followerHasBurrow = false } = {}) {
  const capability = burrowCapabilities(system);
  if (!capability) throw new Error(loc`An active Burrow quality and valid Strength score are required.`);
  if (!Number.isSafeInteger(damageSaveBonus))
    throw new Error(loc`Enter the material’s whole Damage save bonus at one-inch thickness.`);
  if (!["move", "run"].includes(action)) throw new Error(loc`Choose movement or a Run action.`);
  if (typeof followerHasBurrow !== "boolean") throw new Error(loc`Declare whether the follower possesses Burrow.`);
  const materialAllowed = damageSaveBonus <= capability.maximumMaterialSave,
    allowed = materialAllowed && action !== "run",
    ordinaryFollowersBlocked = allowed && damageSaveBonus <= 6;
  return {
    ...capability,
    damageSaveBonus,
    action,
    materialAllowed,
    allowed,
    ordinaryFollowersBlocked,
    followerHasBurrow,
    selectedFollowerBlocked: ordinaryFollowersBlocked && !followerHasBurrow,
    reasons: [
      ...(!materialAllowed
        ? [
            loc`One-inch material save +${damageSaveBonus} exceeds the Strength limit of +${capability.maximumMaterialSave}.`
          ]
        : []),
      ...(action === "run" ? [loc`Run actions are forbidden while burrowing.`] : [])
    ],
    notes: allowed
      ? [
          ordinaryFollowersBlocked
            ? loc`Material fills in behind the burrower. Followers without Burrow cannot follow as it burrows.`
            : loc`This quality does not prohibit ordinary followers for this material; passage and movement conditions still apply.`,
          ...(followerHasBurrow
            ? [loc`A follower with Burrow must separately meet its own material and movement limits.`]
            : [])
        ]
      : []
  };
}
