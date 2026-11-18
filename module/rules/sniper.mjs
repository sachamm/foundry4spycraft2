/** Sniper p.80: firearm and hurled categories are narrower than the shared heavy-weapon firing workflow. */
export function sniperWeapon(weapon) {
  return (
    /\/\s*2h\b/i.test(weapon.sizeHands ?? "") &&
    ["handgun", "rifle", "shotgun", "submachineGun", "hurled", "exoticHurled"].includes(weapon.proficiency)
  );
}
export function eagleEyeDiePlan(system) {
  if (!system.coreClassIds?.includes("sniper")) throw new Error("Eagle Eye requires the Sniper core ability.");
  const ad = system.actionDice ?? {},
    die = ad.die,
    explodeAt = ad.explodeAt ?? die,
    bonus = ad.bonus ?? 0;
  if (
    ![4, 6, 8, 10, 12].includes(die) ||
    !Number.isSafeInteger(explodeAt) ||
    explodeAt < 2 ||
    explodeAt > die ||
    !Number.isSafeInteger(bonus)
  )
    throw new Error("Review the default action die before using Eagle Eye.");
  return { die, explodeAt, bonus, formula: `1d${die}x>=${explodeAt} + ${bonus}` };
}
export function eagleEyeRecord(system, plan, roll, { scene = "initial" } = {}) {
  const result = roll.total,
    rolled = roll.dice?.[0]?.total,
    rangeIncrease = result * 10;
  if (
    !Number.isSafeInteger(result) ||
    !Number.isSafeInteger(rolled) ||
    rolled < 1 ||
    result !== rolled + plan.bonus ||
    !Number.isSafeInteger(rangeIncrease)
  )
    throw new Error("The Eagle Eye die result or range modifier is invalid.");
  return {
    source: "eagleEye",
    scene: String(scene),
    die: plan.die,
    explodeAt: plan.explodeAt,
    bonus: plan.bonus,
    rolled,
    result,
    rangeIncrease
  };
}
export function eagleEyeState(system) {
  const record = system.eagleEyeBoost,
    scene = String(system.usagePeriods?.scene ?? "initial");
  if (!record || record.scene !== scene || !system.coreClassIds?.includes("sniper"))
    return { active: false, review: false };
  const valid =
    record.source === "eagleEye" &&
    [4, 6, 8, 10, 12].includes(record.die) &&
    Number.isSafeInteger(record.explodeAt) &&
    record.explodeAt >= 2 &&
    record.explodeAt <= record.die &&
    Number.isSafeInteger(record.bonus) &&
    Number.isSafeInteger(record.rolled) &&
    record.rolled >= 1 &&
    Number.isSafeInteger(record.result) &&
    record.result === record.rolled + record.bonus &&
    Number.isSafeInteger(record.rangeIncrease) &&
    record.rangeIncrease === record.result * 10;
  return valid ? { ...record, active: true, review: false } : { active: false, review: true };
}

export function sniperMagicTouchBonus(system) {
  const level = system.classLevels?.sniper ?? 0;
  return level >= 9 ? 2 : level >= 5 ? 1 : 0;
}
/** Native attack effects, p.80. Target condition is declared for this particular attack. */
export function sniperAttackEffects(system, weapon, { targetFlatFooted = false } = {}) {
  const eligible = sniperWeapon(weapon),
    level = system.classLevels?.sniper ?? 0;
  const attackBonus = eligible ? sniperMagicTouchBonus(system) : 0;
  const threatIncrease = eligible && targetFlatFooted === true ? (level >= 7 ? 2 : level >= 2 ? 1 : 0) : 0;
  const errorReduction =
    eligible &&
    level >= 4 &&
    (system.classOptionSelections ?? []).some(s => s.classId === "sniper" && s.name === "One Shot")
      ? 2
      : 0;
  return {
    attackBonus,
    threatIncrease,
    errorReduction,
    notes: [
      ...(attackBonus ? [`Magic Touch: +${attackBonus} attack with this 2-handed firearm/hurled weapon.`] : []),
      ...(threatIncrease ? [`Surprise Shot: threat range +${threatIncrease} against this flat-footed target.`] : []),
      ...(errorReduction ? ["One Shot: error range –2, minimum 0."] : [])
    ]
  };
}

/** Sniper 10, p.80: choose either of two attack rolls against a vulnerable target, once/round. */
export function millionDollarSkillPlan(system, weapon, { targetVulnerable = false } = {}) {
  if ((system.classLevels?.sniper ?? 0) < 10)
    return { blocked: true, reason: "Million Dollar Skill requires Sniper 10." };
  if (!sniperWeapon(weapon))
    return { blocked: true, reason: "Million Dollar Skill requires a two-handed firearm or hurled weapon." };
  if (targetVulnerable !== true)
    return { blocked: true, reason: "Confirm this opponent is vulnerable against this attack." };
  return { blocked: false };
}
