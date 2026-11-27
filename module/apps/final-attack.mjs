import { standardAttackContextInput } from "./standard-attack-context.mjs";
import { loc } from "../i18n.mjs";
import { postedReceipt } from "../services/message-lookup.mjs";
import { withAttackTriggerClaim } from "../services/triggered-attacks.mjs";
import { queueResources } from "../services/transactions.mjs";
import { sameValues as same } from "../rules/equal.mjs";
import { triggerClaimKey } from "../rules/triggered-attacks.mjs";
import { systemDialog } from "./dialog-theme.mjs";
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

export async function reviewTriggeredAttacks(actor, input = {}) {
  if (!actor?.isOwner || !game.user?.isGM) throw new Error(loc`The owning GC reviews extra-attack claims.`);
  const records = actor.flags?.spycraft2?.triggeredAttacks ?? {};
  if (!Object.keys(records).length) return null;
  if (!Object.hasOwn(input, "key")) {
    const esc = foundry.utils.escapeHTML;
    const sourceName = r =>
      r.name ||
      ({
        cleaveBasics: loc`Cleave`,
        snapShot: loc`Snap Shot`,
        combatInstincts: loc`Combat Instincts`,
        trip: loc`Trip`,
        missTrick: loc`Miss trick`
      }[r.source] ??
        loc`Extra attack`);
    const stateName = state =>
      ({ reserved: loc`Needs review`, committed: loc`Consumed`, void: loc`Unused` })[state] ?? loc`Needs review`;
    input = await systemDialog.input({
      window: { title: loc`Review extra-attack claims` },
      rejectClose: false,
      ok: { label: loc`Record review` },
      content: `<div class="spycraft2-roll-options"><p>${loc`A claim prevents the same event from granting another extra attack, even if a chat result was deleted. Keep it consumed if the attack rolled. Release it only after confirming no attack rolled. Saved round uses and other conditions have their own review controls.`}</p><label>${loc`Extra attack`} <select name="key">${Object.entries(
        records
      )
        .map(
          ([key, record]) =>
            `<option value="${esc(key)}">${esc(sourceName(record ?? {}))} — ${loc`round ${Number.isSafeInteger(record?.round) ? record.round : "?"}`} (${stateName(record?.state)})</option>`
        )
        .join(
          ""
        )}</select></label><label>${loc`Resolution`} <select name="resolution"><option value="consumed">${loc`Keep consumed: the attack rolled`}</option><option value="unused">${loc`Release unused: no attack rolled`}</option></select></label><label>${loc`Review note`} <input name="note" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC checked the actual results and confirms this resolution`}</label></div>`
    });
    if (!input) return null;
  }
  if (!Object.hasOwn(records, input.key)) throw new Error(loc`Choose an existing extra-attack claim.`);
  const expected = structuredClone(records[input.key]);
  return queueResources([actor], async () => {
    if (!actor.isOwner || !game.user?.isGM || !same(actor.flags?.spycraft2?.triggeredAttacks?.[input.key], expected))
      throw new Error(loc`The extra-attack claim or permissions changed. Review it again.`);
    if (
      input.confirmed !== true ||
      typeof input.note !== "string" ||
      !input.note.trim() ||
      !["consumed", "unused"].includes(input.resolution)
    )
      throw new Error(loc`Confirm the actual attack outcome and add a review note.`);
    if (
      !expected?.id ||
      !expected.source ||
      !expected.triggerMessageUuid ||
      input.key !== triggerClaimKey(expected.source, expected.triggerMessageUuid)
    )
      throw new Error(loc`The extra-attack claim is malformed. Repair its original source before reviewing it.`);
    const posted = postedReceipt(actor, "finalAttack", expected.id);
    if (input.resolution === "unused" && posted)
      throw new Error(loc`The extra attack has a posted result and cannot be released as unused.`);
    const record = {
      ...expected,
      version: 1,
      state: input.resolution === "unused" ? "void" : "committed",
      review: {
        note: input.note.trim(),
        confirmed: true,
        reviewedBy: game.user.id,
        at: Date.now(),
        previous: expected.state
      }
    };
    if (posted) record.messageUuid = posted.uuid;
    try {
      await actor.update({ [`flags.spycraft2.triggeredAttacks.${input.key}`]: record });
    } catch (error) {
      if (!same(actor.flags?.spycraft2?.triggeredAttacks?.[input.key], record)) throw error;
    }
    return record;
  });
}
/** Inside the caller’s reserved resource transaction. A committed chat result must not refund a use. */
export async function postFinalAttack(actor, weaponId, options, receipt, validate) {
  return withAttackTriggerClaim(
    actor,
    receipt,
    check => postClaimedFinalAttack(actor, weaponId, options, receipt, check),
    validate
  );
}

async function postClaimedFinalAttack(actor, weaponId, options, receipt, validate) {
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
