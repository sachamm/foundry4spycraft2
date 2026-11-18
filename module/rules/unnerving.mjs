import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
/** Unnerving, p.451. Additional stress requires damage actually inflicted by an unarmed/melee attack. */
export function unnervingGrade(system) {
  // An agent's origin or an NPC's quality, whichever gives more dice.
  return Math.min(
    3,
    Math.max(
      (system.originEffects ?? []).filter(effect => effect.qualityKey === "unnerving").length,
      system.qualityEffects?.unnervingDice ?? 0
    )
  );
}
export function unnervingEligible(system, check) {
  return (
    unnervingGrade(system) > 0 &&
    check?.unnervingAvailableGrade === unnervingGrade(system) &&
    Number.isFinite(check.rawTotal) &&
    check.checkKind === "damage" &&
    !check.unnervingStress &&
    !check.unnerving &&
    !check.superseded &&
    (check.unarmed === true ||
      ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(check.weaponProficiency))
  );
}
export function unnervingPlan(system, check, { target = "", damageInflictedConfirmed = false } = {}) {
  if (!unnervingEligible(system, check))
    throw new Error(loc`Unnerving requires an unspent unarmed/melee damage record and a currently selected quality.`);
  if (typeof target !== "string" || !target.trim() || damageInflictedConfirmed !== true)
    throw new Error(
      loc`Name the target and confirm this attack actually inflicted at least one point of damage after defenses.`
    );
  const grade = check.unnervingAvailableGrade;
  return { grade, formula: `${grade}d4`, damageType: "stress", target: target.trim(), damageInflictedConfirmed: true };
}

// Roll pipeline: a damaging attack's added stress may be recorded after its ordinary outcome is resolved.
rollPipeline.register({
  id: "unnervingControl",
  order: 9500,
  chatControls({ message, check, actor, user }) {
    if (!(message.isAuthor || user.isGM) || !unnervingEligible(actor.system, check)) return null;
    return [{ label: loc`Resolve Unnerving stress`, run: () => actor.resolveUnnerving(message) }];
  }
});

// Recorded on the posted check as the roll was given them.
rollPipeline.register({ id: "unnervingRecord", order: 9790, record: ["unnervingStress"] });
