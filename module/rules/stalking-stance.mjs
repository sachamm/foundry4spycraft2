import { combatStanceState } from "./combat-stance.mjs";
import { validOwnCountClock } from "./own-count-duration.mjs";
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
/** The p.179 bonus applies to Sneak checks, not the underlying skill bonus. */
export function stalkingStancePlan(system, key, check, { combat = null } = {}) {
  const empty = { evidence: null, bonuses: [], notes: [] };
  if (key !== "sneak") return empty;
  const stance = combatStanceState(system),
    active = stance?.key === "stalking" && validOwnCountClock(combat),
    bonus = active ? 3 : 0;
  const evidence = {
    version: 1,
    skillKey: key,
    checkId: check?.id ?? "",
    bonus,
    stance: active ? stance : null,
    combat: active ? { id: combat.id, round: combat.round, combatantId: combat.combatantId } : null
  };
  return {
    evidence,
    bonuses: active ? [{ source: "Stalking Stance", type: "unnamed", value: 3 }] : [],
    notes: active ? [loc`Stalking Stance: +3 with this Sneak check made in combat (p.179).`] : []
  };
}
const stable = v =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map(k => [k, x[k]])
        )
      : x
  );
export function validateStalkingStanceProof(actor, proof, { checkKind, skillKey, checkId, rerollOf } = {}) {
  if (!proof) return;
  if (rerollOf) {
    const origin =
        globalThis.fromUuidSync?.(rerollOf) ??
        [...(globalThis.game?.messages ?? [])].find(m => m.uuid === rerollOf || m.id === rerollOf),
      c = origin?.flags?.spycraft2;
    if (
      checkKind !== "skill" ||
      skillKey !== "sneak" ||
      c?.actorUuid !== actor.uuid ||
      c.checkKind !== "skill" ||
      c.skillKey !== skillKey ||
      c.checkId !== checkId ||
      c.resolved ||
      c.superseded ||
      stable(c.stalkingStance) !== stable(proof) ||
      (proof.bonus === 3 && !actor.system.activeFeatNames?.includes("Garrote Basics"))
    )
      throw Error(
        loc`Use the original owned Sneak check and its qualified Stalking Stance source for this replacement.`
      );
    return;
  }
  const p = stalkingStancePlan(
    actor.system,
    skillKey,
    { id: checkId },
    { combat: actor.mentalLeapCombatContext?.() ?? null }
  );
  if (checkKind !== "skill" || !p.evidence || stable(p.evidence) !== stable(proof))
    throw Error(loc`The Stalking Stance, qualified source or actual combat participation changed before posting.`);
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "stalkingStance",
  order: 1390,
  record: ["stalkingStance"],
  validate: ({ actor, options, checkKind, checkId, skillKey }) =>
    validateStalkingStanceProof(actor, options.stalkingStance, {
      checkKind,
      skillKey,
      checkId,
      rerollOf: options.rerollOf
    })
});

// Stalking Stance's part of a skill check plan.
rollPipeline.register({
  id: "stalkingStanceSkillTerm",
  kinds: ["skill"],
  order: 9210,
  terms({ system, skillKey, check, method, input }) {
    const { stalkingCombat = null } = input;
    const plan = stalkingStancePlan(system, skillKey, check, { combat: stalkingCombat });
    return skillPlanTerm("stalkingStance", plan, { noteAt: 20, bonusAt: 130 });
  }
});
