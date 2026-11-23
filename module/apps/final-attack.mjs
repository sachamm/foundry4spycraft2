import { standardAttackContextInput } from "./standard-attack-context.mjs";
import { loc } from "../i18n.mjs";
import { postedReceipt } from "../services/message-lookup.mjs";
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
        loc`This control resolves one final Standard Attack. Resolve combined class declarations through their normal controls and GC use-count review; other actions cannot be combined.`
      );
  return { ...standardAttackContextInput(input), attackAction: "standard", freeFinalAttack: true };
}
export const finalWeaponReady = w =>
  w?.type === "weapon" && w.system.equipped === true && w.system.carried !== false && !w.system.reserve;
/** Inside the caller’s reserved resource transaction. A committed chat result must not refund a use. */
export async function postFinalAttack(actor, weaponId, options, receipt, validate) {
  await validate();
  const posted = () => postedReceipt(actor, "finalAttack", receipt.id);
  try {
    const message = await actor.rollAttack(actor.items.get(weaponId), {
      ...options,
      finalAttack: receipt,
      validateFinalAttack: validate
    });
    if (!message) throw new Error(loc`The final attack was cancelled before posting.`);
    const recorded = posted();
    if (!message.uuid || !recorded || recorded.uuid !== message.uuid)
      throw new Error(loc`The final attack did not post an actual recorded result.`);
    return recorded;
  } catch (error) {
    const message = posted();
    if (message) return message;
    throw error;
  }
}

/**
 * The shared shape of a limited-use final attack: reserve one use of `key`, post the attack, and hand the use back
 * if anything the declaration rested on changed in between. Each ability supplies what is its own.
 *
 * @param {Actor} actor
 * @param {string} key                      The limited-use id, which is also its workflow name
 * @param {object} spec
 * @param {string} spec.weaponId
 * @param {object} spec.options             Attack options, as finalAttackOptions() returns them
 * @param {object} spec.receipt             Recorded on the attack card
 * @param {() => boolean} spec.changed      Whether the plan, weapon or trigger differs from what was declared
 * @param {string} spec.changedMessage      The refusal shown when it does, or when the reserved use moved
 * @param {() => void} [spec.check]         Runs first and throws its own refusal; an ability that must act on its
 *                                          own Initiative Count checks the count and ownership here. Abilities
 *                                          differ on this by rule, so there is no default.
 */
export function limitedFinalAttack(actor, key, { weaponId, options, receipt, changed, changedMessage, check }) {
  return actor.useLimitedAbility(
    key,
    async status => {
      const validate = () => {
        check?.();
        const different = changed(),
          counter = actor.system.resourceUses?.[key];
        // The use reserved for this attack must still be the one just taken: same period, one more than before.
        if (different || counter?.epoch !== status.epoch || counter.used !== status.used + 1)
          throw new Error(changedMessage);
      };
      return postFinalAttack(actor, weaponId, options, receipt, validate);
    },
    { workflow: key }
  );
}
