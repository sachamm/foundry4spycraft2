import { appearanceCheckPlan } from "./appearance.mjs";
import { cleaveCriticalPlan } from "./cleave.mjs";
import { finesseCriticalEligible } from "./finesse.mjs";
import { homeTurfSkillPlan } from "./terrain.mjs";
import { appliesToSkill } from "./limited-uses.mjs";
import { specialistApplies } from "./weapon-specialist.mjs";
/** Activation resources, pp.62,96–97,329–330. Effect and its table cost are adjudicated by the GC. */
export function criticalPlan(
  system,
  check,
  {
    kind = "success",
    baseCost = 1,
    effect = "",
    effectConfirmed = false,
    beforeDamage = false,
    opponent = false,
    lineOfSight = false,
    samePayer = true,
    available = 0,
    vehicleMountedConfirmed = false,
    legacyStandardTargetConfirmed = false
  } = {}
) {
  const reject = reason => ({ blocked: true, reason });
  if (!check || check.resolved || check.superseded || check.criticalSuccess || check.criticalFailure)
    return reject("This result has already been resolved, replaced or activated.");
  if (
    check.checkKind === "save" &&
    !(
      kind === "success" &&
      check.oneInAMillion === true &&
      check.checkId === "fort" &&
      check.naturalDie === 20 &&
      check.forcedThreat === true
    )
  )
    return reject(
      "Saving throws cannot cause threats, errors or critical results, except the explicit One in a Million Fortitude threat (pp.50,347)."
    );
  if (!["success", "failure"].includes(kind)) return reject("Choose a critical success or failure.");
  if (kind === "success" && !check.threatConfirmed) return reject("Confirm a successful threat before activating it.");
  if (kind === "failure" && !check.errorConfirmed) return reject("Confirm an error before activating it.");
  if (kind === "success" && !samePayer)
    return reject("A character must pay for their own critical success unless a specific rule allows otherwise.");
  if (kind === "failure" && (samePayer || !opponent || !lineOfSight))
    return reject("An opponent within line of sight must pay to activate this error (p.62).");
  if (kind === "failure" && check.boostSpent > 0)
    return reject("Error activation must be decided before the acting character boosts the result.");
  if (!Number.isSafeInteger(baseCost) || baseCost < 1 || (check.checkKind === "attack" && baseCost > 4))
    return reject("Choose the effect’s whole-number table cost (1–4 for attack results).");
  if (!effectConfirmed || !String(effect).trim())
    return reject(
      "Confirm the GC’s applicable critical effect and its base cost. No dice are spent when no critical effect is possible."
    );
  if (kind === "success" && check.checkKind === "attack" && !beforeDamage)
    return reject("A critical hit must be activated before damage is rolled (p.62).");
  const recordedMount = check.attackContext?.vehicleMounted,
    vehicleMountDeclared =
      kind === "success" &&
      check.checkKind === "attack" &&
      typeof recordedMount !== "boolean" &&
      vehicleMountedConfirmed === true;
  const vehicleMounted = typeof recordedMount === "boolean" ? recordedMount : vehicleMountDeclared;
  const sources = [];
  let targetStandardDeclared = false,
    adjustment = 0,
    minimum = kind === "success" ? 0 : 1;
  if (kind === "success" && check.checkKind === "skill") {
    if (homeTurfSkillPlan(system, check.skillKey, { homeTurf: check.terrain?.homeTurf }).eligible) {
      adjustment--;
      sources.push("Home Turf –1");
    }
    if (
      check.skillKey === "tactics" &&
      check.checkId === "ambush" &&
      system.activeFeatNames?.includes("Ambush Supremacy")
    ) {
      adjustment--;
      sources.push("Ambush Supremacy –1");
    }
    const choices = new Map();
    for (const rule of system.skillFeatRules ?? [])
      if (
        rule.name === "Grand Skill Mastery" &&
        String(rule.choice ?? "").trim() &&
        appliesToSkill(rule, check.skillKey, check.focus)
      )
        choices.set(String(rule.choice).trim().toLowerCase(), String(rule.choice));
    for (const choice of choices.values()) {
      adjustment--;
      sources.push(`Grand Skill Mastery (${choice}) –1`);
    }
  }
  if (kind === "success" && check.checkKind === "attack") {
    const cleave = cleaveCriticalPlan(system, check, { legacyStandardTargetConfirmed });
    if (cleave.blocked) return reject(cleave.reason);
    if (cleave.discount) {
      adjustment--;
      targetStandardDeclared = cleave.declared === true;
      sources.push("Cleave Supremacy (standard target) –1");
    }
    if (system.activeFeatNames?.includes("Finesse Supremacy") && finesseCriticalEligible(check)) {
      adjustment--;
      sources.push("Finesse Supremacy –1");
    }
    if (check.attackContext?.disarm?.active === true && system.activeFeatNames?.includes("Expert Disarm")) {
      adjustment--;
      sources.push("Expert Disarm –1");
    }
    if (
      vehicleMounted &&
      (system.classOptionSelections ?? []).some(e => e.classId === "wheelman" && e.name === "Most Lethal")
    ) {
      adjustment--;
      sources.push("Most Lethal (vehicle-mounted weapon) –1");
    }
    if (check.triumphed && check.successConfirmed === true && check.effectiveTotal >= 75) {
      adjustment--;
      sources.push("Attack Triumph: one-die critical hit included");
    }
    if (
      system.activeFeatNames?.includes("Sharpshooter Supremacy") &&
      (check.attackContext?.ranged ||
        [
          "hurled",
          "exoticHurled",
          "handgun",
          "rifle",
          "shotgun",
          "submachineGun",
          "tactical",
          "guided",
          "indirectFire"
        ].includes(check.weaponProficiency))
    ) {
      adjustment--;
      sources.push("Sharpshooter Supremacy –1");
    }
    if (specialistApplies(system, { proficiency: check.weaponProficiency }, "Most Deadly")) {
      adjustment--;
      sources.push("Most Deadly –1");
    }
    if ((system.classLevels?.grunt ?? 0) >= 8 && ["tactical", "indirectFire"].includes(check.weaponProficiency)) {
      adjustment--;
      sources.push("Overkill –1");
    }
  }
  if (kind === "failure") {
    if (check.cleanAndPolished) {
      adjustment++;
      sources.push("Clean and Polished +1");
    }
    const qualities = String(check.weaponQualities ?? ""),
      dependable = /\bDEP\b/.test(qualities),
      unreliable = /\bUNR\b/.test(qualities);
    if (dependable && !unreliable) {
      adjustment++;
      sources.push("Dependable +1");
    }
    if (unreliable && !dependable) {
      adjustment--;
      minimum = 0;
      sources.push("Unreliable –1 (minimum 0)");
    }

    const practice = Number(check.criticalFailureCostIncrease) || 0;
    if (practice > 0) {
      adjustment += practice;
      sources.push(`Practice Makes Perfect +${practice}`);
    }
    const appearance =
      check.checkKind === "skill"
        ? appearanceCheckPlan(
            system,
            check.skillKey,
            { id: check.checkId },
            { manhuntPrey: check.appearanceModifiers?.manhuntPrey === true }
          )
        : null;
    if (appearance?.criticalFailureDiscount) {
      adjustment--;
      minimum = Math.max(minimum, 1);
      sources.push("Simply Irresistible –1 (minimum1)");
    }
    if (
      system.coreClassIds?.includes("wheelman") &&
      (check.checkId === "maneuver" || (check.skillKey === "mechanics" && check.checkId === "repair"))
    ) {
      adjustment++;
      sources.push("Driven +1");
    }
  }
  const cost = Math.max(minimum, baseCost + adjustment);
  if (cost > available) return reject("Not enough action dice remain in the paying character’s pool.");
  return {
    blocked: false,
    cost,
    kind,
    baseCost,
    effect: String(effect).trim(),
    sources,
    vehicleMounted,
    vehicleMountDeclared,
    ...(targetStandardDeclared ? { targetStandardDeclared: true } : {})
  };
}
