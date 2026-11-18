import { validOwnCountClock } from "../rules/own-count-duration.mjs";
import { MISS_TRICKS, missTrickPlan } from "../rules/miss-tricks.mjs";
import { checkCandidates, rollEvidence } from "../rules/outcomes.mjs";
import { standardAttackContextContent } from "./standard-attack-context.mjs";
import {
  attackCharacterTargetChoices,
  completeCharacterTarget,
  knownCharacterTargetInput
} from "./character-target.mjs";
import { postFinalAttack, finalWeaponReady, finalAttackOptions } from "./final-attack.mjs";
import { loc } from "../i18n.mjs";
export async function takeMissTrick(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  if (!validOwnCountClock(actor.mentalLeapCombatContext()))
    throw Error(loc`Use an immediate miss trick in this character’s started combat.`);
  if (!actor.system.activeFeatNames?.some(n => ["Flail Basics", "Fencing Basics"].includes(n)))
    throw Error(loc`Neither Flail Basics nor Fencing Basics currently qualifies.`);
  finalAttackOptions(options);
  let input = options;
  if (!Object.hasOwn(input, "immediateConfirmed")) {
    const esc = foundry.utils.escapeHTML,
      clock = actor.mentalLeapCombatContext(),
      messages = [...game.messages].filter(
        m =>
          m.visible !== false &&
          m.isContentVisible !== false &&
          (!m.blind || game.user.isGM) &&
          m.flags?.spycraft2?.actorUuid === actor.uuid &&
          m.flags.spycraft2.checkKind === "attack" &&
          m.flags.spycraft2.resolved &&
          m.flags.spycraft2.successConfirmed === false &&
          !m.flags.spycraft2.superseded &&
          !checkCandidates(m.flags.spycraft2).error &&
          m.flags.spycraft2.rollCombat?.id === clock?.id &&
          m.flags.spycraft2.rollCombat?.round === clock?.round &&
          !m.flags.spycraft2.missTrickUse
      );
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Immediate miss trick: Double Twirl / Remiss` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`A resolved Standard Attack miss without an error permits one immediate final attack with the same actual weapon against the same opponent. This uses the shared final-attack allowance; it does not spend an action die.`}</p><label>${loc`Recorded miss`} <select name="messageId"><option value="">${loc`Choose actual miss`}</option>${messages.map(m => `<option value="${esc(m.id)}">${esc(m.flags.spycraft2.baseFlavor ?? m.id)}</option>`).join("")}</select></label><label>${loc`Trick`} <select name="trick">${Object.entries(
        MISS_TRICKS
      )
        .filter(([, v]) => actor.system.activeFeatNames?.includes(v.feat))
        .map(([key, v]) => `<option value="${key}">${v.name} (${v.feat})</option>`)
        .join(
          ""
        )}</select></label><label>${loc`Same actual opponent`} <select name="opponentUuid"><option value="">${loc`Choose opponent`}</option>${attackCharacterTargetChoices()
        .filter(a => a.uuid !== actor.uuid)
        .map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`)
        .join(
          ""
        )}</select></label>${standardAttackContextContent(actor, { includeCharacterTarget: false })}<label><input name="sameTargetConfirmed" type="checkbox" /> ${loc`The GC confirms this was the original opponent`}</label><label><input name="immediateConfirmed" type="checkbox" /> ${loc`This is the immediate reaction to that miss, with no intervening action`}</label><label><input name="attackLegalConfirmed" type="checkbox" /> ${loc`This same-weapon final Standard Attack is legal now, including Reach and line of sight`}</label><label><input name="legacySourceConfirmed" type="checkbox" /> ${loc`Older receipt only: the GC confirms this was a Standard Attack and the feat/exact readied weapon qualified at the original miss`}</label></div>`
    });
    if (!input) return null;
  }
  const message = game.messages.get(input.messageId),
    c = message?.flags?.spycraft2;
  if (
    !message ||
    message.visible === false ||
    message.isContentVisible === false ||
    (message.blind && !game.user.isGM) ||
    c?.actorUuid !== actor.uuid
  )
    throw Error(loc`Choose your visible actual attack receipt.`);
  const used = c.missTrickUse;
  if (used) {
    const posted = [...game.messages].find(
      m =>
        m.flags?.spycraft2?.actorUuid === actor.uuid &&
        m.flags.spycraft2.finalAttack?.id === used.id &&
        m.flags.spycraft2.finalAttack.triggerMessageUuid === message.uuid
    );
    if (posted) return posted;
    throw Error(loc`This miss trick is already reserved or needs GC review; do not roll it again.`);
  }
  const item = actor.items.find(i => i.type === "weapon" && i.uuid === c.weaponUuid);
  if (!finalWeaponReady(item)) throw Error(loc`The original attack weapon is no longer owned/readied.`);
  const target = attackCharacterTargetChoices().find(a => a.uuid === input.opponentUuid);
  if (!target || target.uuid === actor.uuid) throw Error(loc`Choose the actual observed opposing character.`);
  const event = () => {
    const current = actor.items.get(item.id);
    if (!finalWeaponReady(current)) throw Error(loc`The original weapon is no longer readied.`);
    return missTrickPlan(
      actor.system,
      actor.mentalLeapCombatContext(),
      message.flags.spycraft2,
      actor.weaponAttack(current, { attackAction: "standard" }).missTrickSources,
      input
    );
  };
  const plan = event(),
    evidence = rollEvidence(c),
    opts = await completeCharacterTarget(
      actor,
      item.system,
      {
        ...knownCharacterTargetInput(target.uuid, finalAttackOptions(input)),
        attackAction: "standard",
        freeFinalAttack: true
      },
      { fixedTargetUuid: target.uuid, fixedTargetName: target.name }
    );
  if (!opts) return null;
  const preview = actor.weaponAttack(item, opts);
  if (preview.blocked || preview.ranged || preview.firearm)
    throw Error(preview.reason || loc`This miss trick uses its actual melee weapon.`);
  const signature = JSON.stringify(preview),
    receipt = {
      ...plan,
      id: foundry.utils.randomID(),
      weaponUuid: item.uuid,
      triggerMessageUuid: message.uuid,
      triggerEvidence: evidence
    };
  return actor.useLimitedAbility(
    "missTrick",
    async status => {
      if (message.flags.spycraft2.missTrickUse) throw Error(loc`This miss has already supplied its final attack.`);
      const reservation = { id: receipt.id, state: "reserved", trick: input.trick };
      const validate = () => {
        if (
          !actor.isOwner ||
          !attackCharacterTargetChoices().some(a => a.uuid === receipt.opponentUuid) ||
          message.flags.spycraft2.missTrickUse?.id !== receipt.id ||
          JSON.stringify(event()) !== JSON.stringify(plan) ||
          rollEvidence(message.flags.spycraft2) !== evidence ||
          JSON.stringify(actor.weaponAttack(actor.items.get(item.id), opts)) !== signature ||
          actor.system.resourceUses?.missTrick?.epoch !== status.epoch ||
          actor.system.resourceUses.missTrick.used !== status.used + 1
        )
          throw Error(
            loc`The triggering miss, original weapon, opponent, immediate timing or reserved final attack changed.`
          );
      };
      try {
        await message.update({ "flags.spycraft2.missTrickUse": reservation });
        const result = await postFinalAttack(actor, item.id, opts, receipt, validate);
        try {
          await message.update({
            "flags.spycraft2.missTrickUse": {
              id: receipt.id,
              state: "posted",
              trick: input.trick,
              messageUuid: result.uuid
            }
          });
        } catch (error) {
          ui.notifications.warn(loc`Final attack posted; the original miss receipt needs review.`);
        }
        return result;
      } catch (error) {
        const posted = [...game.messages].find(m => m.flags?.spycraft2?.finalAttack?.id === receipt.id);
        if (posted) return posted;
        try {
          if (message.flags.spycraft2.missTrickUse?.id === receipt.id)
            await message.unsetFlag("spycraft2", "missTrickUse");
        } catch (cleanup) {
          throw new AggregateError([error, cleanup], loc`The unused miss-trick reservation needs GC review.`);
        }
        throw error;
      }
    },
    { workflow: "missTrick", messages: [message] }
  );
}
