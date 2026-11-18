import { standardAttackContextInput } from "./standard-attack-context.mjs";
export function finalAttackOptions(input) {
  for (const key of [
    "disarm",
    "oneInAMillion",
    "millionDollarSkill",
    "cunningPlan",
    "tenSecondSolution",
    "brightIdea",
    "additionalUses",
    "additionalCost"
  ])
    if (input[key])
      throw new Error(
        "This control resolves one final Standard Attack. Resolve combined class declarations through their normal controls and GC use-count review; other actions cannot be combined."
      );
  return { ...standardAttackContextInput(input), attackAction: "standard", freeFinalAttack: true };
}
export const finalWeaponReady = w =>
  w?.type === "weapon" && w.system.equipped === true && w.system.carried !== false && !w.system.reserve;
/** Inside the caller’s reserved resource transaction. A committed chat result must not refund a use. */
export async function postFinalAttack(actor, weaponId, options, receipt, validate) {
  await validate();
  const posted = () =>
    [...(game.messages ?? [])].find(
      m => m.flags?.spycraft2?.actorUuid === actor.uuid && m.flags.spycraft2.finalAttack?.id === receipt.id
    );
  try {
    const message = await actor.rollAttack(actor.items.get(weaponId), {
      ...options,
      finalAttack: receipt,
      validateFinalAttack: validate
    });
    if (!message) throw new Error("The final attack was cancelled before posting.");
    const recorded = posted();
    if (!message.uuid || !recorded || recorded.uuid !== message.uuid)
      throw new Error("The final attack did not post an actual recorded result.");
    return recorded;
  } catch (error) {
    const message = posted();
    if (message) return message;
    throw error;
  }
}
