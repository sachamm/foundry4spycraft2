/** The Cleave Basics and Snap Shot controls on the Main tab (see module/rules/drop-follow-up.mjs). */
import { finalAttackOptions, finalWeaponReady, limitedFinalAttack } from "./final-attack.mjs";
import { DROP_FOLLOW_UPS, dropTriggerEligible, dropFollowUpPlan, triggerUsed } from "../rules/drop-follow-up.mjs";
import { rollEvidence } from "../rules/outcomes.mjs";
import { expertiseCombatContext } from "./combat-expertise.mjs";
import { standardAttackContextContent } from "./standard-attack-context.mjs";
import { loc } from "../i18n.mjs";

const triggerChoices = (actor, combat, ranged) => {
  // The record of every posted card is needed only once a trigger qualifies, and then the same list serves them all.
  let records;
  return [...(game.messages ?? [])].filter(
    m =>
      m.visible !== false &&
      m.isContentVisible !== false &&
      (!m.blind || game.user.isGM) &&
      dropTriggerEligible(m.flags?.spycraft2, { actorUuid: actor.uuid, combat, ranged }) &&
      !triggerUsed(m.uuid, (records ??= posted()))
  );
};
const posted = () => [...(game.messages ?? [])].map(m => m.flags?.spycraft2).filter(Boolean);

export async function takeDropFollowUp(actor, key, options = {}) {
  const d = DROP_FOLLOW_UPS[key];
  if (!d || !["agent", "npc"].includes(actor.type) || !actor.isOwner) return null;
  const combat = expertiseCombatContext(actor),
    clock = JSON.stringify(combat);
  let input = options;
  if (!Object.hasOwn(input, "droppedConfirmed")) {
    const esc = foundry.utils.escapeHTML,
      choices = triggerChoices(actor, combat, d.ranged)
        .map(m => {
          const c = m.flags.spycraft2,
            weapon = actor.items.find(i => i.uuid === c.weaponUuid);
          return `<option value="${esc(m.id)}">${esc(weapon?.name ?? c.weaponUuid)}: ${c.effectiveTotal} (${esc(m.id)})</option>`;
        })
        .join("");
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`${d.name}: attack another opponent` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${
        d.ranged
          ? loc`Once per round, when one of your ranged attacks leaves an opponent unconscious or dead, make one more ranged attack with the same weapon against another opponent (p.182).`
          : actor.system.activeFeatNames?.includes("Cleave Mastery")
            ? loc`Each time one of your melee attacks leaves an opponent unconscious or dead, make one more melee attack with the same weapon against another opponent (Cleave Mastery, p.177).`
            : loc`Once per round, when one of your melee attacks leaves an opponent unconscious or dead, make one more melee attack with the same weapon against another opponent (p.177).`
      }${!d.ranged && actor.system.activeFeatNames?.includes("Cleave Supremacy") ? `</p><p>${loc`Cleave Supremacy: you may move 5 ft. before this attack, as long as your total movement this way stays within your Speed (p.177).`}` : ""}</p><label>${loc`Your hit that dropped the opponent`} <select name="messageId"><option value="">${loc`Choose the recorded hit`}</option>${choices}</select></label>${standardAttackContextContent(actor)}<label><input name="droppedConfirmed" type="checkbox" /> ${loc`The GC confirms that hit left its opponent unconscious or dead`}</label><label><input name="anotherOpponentConfirmed" type="checkbox" /> ${loc`This attack targets a different opponent`}</label><label><input name="immediateConfirmed" type="checkbox" /> ${loc`This attack follows that hit at once`}</label></div>`
    });
    if (!input) return null;
  }
  const opts = finalAttackOptions(input);
  const event = () => {
    const message = game.messages.get(input.messageId),
      now = expertiseCombatContext(actor);
    if (
      !message ||
      message.visible === false ||
      message.isContentVisible === false ||
      (message.blind && !game.user.isGM)
    )
      throw new Error(loc`Choose your visible recorded hit from this combat.`);
    const plan = dropFollowUpPlan(actor.system, now, message.flags?.spycraft2, {
      ...input,
      key,
      actorUuid: actor.uuid,
      targetUuid: opts.targetActorUuid ?? ""
    });
    if (triggerUsed(message.uuid, posted())) throw new Error(loc`That hit already earned its extra attack.`);
    return { message, plan };
  };
  if (JSON.stringify(expertiseCombatContext(actor)) !== clock)
    throw new Error(loc`The Initiative Count changed. Review the attack again.`);
  const original = event(),
    item = actor.items.find(i => i.uuid === original.plan.weaponUuid);
  if (!finalWeaponReady(item)) throw new Error(loc`${d.name} uses the same weapon, which must still be readied.`);
  const preview = actor.weaponAttack(item, opts);
  if (preview.blocked || preview.ranged !== d.ranged || (preview.ranged && !Number.isFinite(opts.distanceFeet)))
    throw new Error(preview.reason || loc`Enter the measured distance for the ranged attack.`);
  const evidence = rollEvidence(original.message.flags.spycraft2),
    signature = JSON.stringify(preview),
    receipt = {
      ...original.plan,
      weaponId: item.id,
      id: foundry.utils.randomID(),
      triggerMessageUuid: original.message.uuid ?? original.message.id,
      triggerEvidence: evidence
    };
  return limitedFinalAttack(actor, key, {
    weaponId: item.id,
    options: opts,
    receipt,
    check() {
      if (!actor.isOwner || JSON.stringify(expertiseCombatContext(actor)) !== clock)
        throw new Error(loc`The Initiative Count or ownership changed.`);
    },
    changed() {
      const fresh = event(),
        w = actor.items.get(item.id);
      return (
        JSON.stringify(fresh.plan) !== JSON.stringify(original.plan) ||
        rollEvidence(fresh.message.flags.spycraft2) !== evidence ||
        !finalWeaponReady(w) ||
        JSON.stringify(actor.weaponAttack(w, opts)) !== signature
      );
    },
    changedMessage: loc`The triggering hit, weapon or reserved use changed. Review it again.`
  });
}
