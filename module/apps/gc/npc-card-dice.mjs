/**
 * GC action dice spent straight from an NPC's roll card.
 *
 * NPCs have no action dice of their own; the GC spends from the session pool (pp.397–399, 452). On an NPC's open
 * attack, skill or save card the GC gets two buttons:
 *  - "GC boost (+1dN)" pays one die, rolls the NPC's die type and adds it to the card's total;
 *  - "Activate threat (GC dice)" pays for a confirmed threat and marks the card as a critical success, so the damage roll
 *    and its application carry the critical hit on.
 * Both go through spendGCDice, which checks the pool, the NPC's qualities and posts the spend to the GC.
 */
import { triumphAt } from "../../rules/check-candidates.mjs";
import { rollPipeline } from "../../rules/roll-pipeline.mjs";
import { gcDieType } from "../../rules/gc/gc-spend.mjs";
import { spendProfile } from "./npc-play.mjs";

import { spendGCDice } from "./spend.mjs";
import { postUndo } from "../undo.mjs";
import { resolveSkillResult } from "../../rules/checks.mjs";
import { loc } from "../../i18n.mjs";
import { criticalHitChoices } from "../../rules/critical-effects.mjs";
import { assertDamageNotStarted } from "../../documents/actor/damage-hits.mjs";
import { systemDialog } from "../dialog-theme.mjs";
import { esc } from "../../html.mjs";
import { npcDefenseDeliveryControls } from "./npc-defense.mjs";
import { npcHitDeliveryControls, validateNpcDefenseReroll } from "./post-hit-defense.mjs";
import { acquireDeclaredDC, validateDeclaredDC, declaredDCControls } from "./declared-skill-dc.mjs";
import { checkFlavor } from "../../rules/outcomes.mjs";

/** NPC skill rolls are posted as plain checks that name the skill (module/apps/gc/npc-play.mjs). */
const npcCheckKind = check =>
  ["attack", "skill", "save", "ability", "knowledge"].includes(check.checkKind) || !!check.npcSkill;
rollPipeline.register({ id: "npcDefenseDeliveryControl", order: 9998.5, chatControls: npcDefenseDeliveryControls });
rollPipeline.register({
  id: "npcPostHitDefenseDeliveryControl",
  order: 9998.6,
  chatControls: npcHitDeliveryControls,
  validate: validateNpcDefenseReroll,
  flags: ({ options }) => (options?.npcDefenseReroll ? { npcDefenseReroll: options.npcDefenseReroll } : {})
});
rollPipeline.register({
  id: "declaredSkillDC",
  order: 9998.7,
  kinds: ["skill", "knowledge", "gcDeclaredDC"],
  acquire: acquireDeclaredDC,
  validate: validateDeclaredDC,
  chatControls: declaredDCControls,
  flags: ({ options }) => (options.declaredSkillDC ? { declaredSkillDC: options.declaredSkillDC } : {})
});
/** An activated critical failure can no longer be boosted (the same rule as an agent's boost). */
export const gcBoostable = check =>
  Number.isFinite(check?.rawTotal) &&
  check.actionDiceAllowed !== false &&
  (check.checkMethod ?? "roll") === "roll" &&
  !check.resolved &&
  !check.superseded &&
  !check.criticalFailure &&
  !check.coverAwaiting &&
  !check.coverDamageFrozen &&
  !check.gcPostHitDefense &&
  !check.npcDefensePending;
const npcOpen = ({ check, actor, user }) =>
  user?.isGM === true &&
  actor?.type === "npc" &&
  Number.isFinite(check.rawTotal) &&
  !check.resolved &&
  !check.superseded &&
  !check.npcDefensePending &&
  npcCheckKind(check);

/**
 * Add a GC boost to the card. The boost is kept in the card's flags, like an agent's boost, and the result is worked
 * out again through the cap, threat and Triumph rules. The card's content is left alone: a roll card shows its dice
 * breakdown only while its content is plain, so appending a line there would hide the dice.
 */
export async function gcBoostCard(message, actor) {
  if (!gcBoostable(message.flags?.spycraft2)) {
    ui.notifications.warn(loc`This card can no longer be boosted.`);
    return null;
  }
  const result = await spendGCDice({ id: "boostRoll", actor, onCard: true });
  if (!result?.die) return null;
  const check = message.flags.spycraft2,
    before = {
      effectiveTotal: check.effectiveTotal,
      boostTotal: check.boostTotal ?? 0,
      capped: check.capped ?? false,
      potentialTriumph: check.potentialTriumph ?? false,
      gcBoosts: [...(check.gcBoosts ?? [])],
      flavor: message.flavor
    },
    boostTotal = (check.boostTotal ?? 0) + result.die.total,
    resolved = resolveSkillResult(check.rawTotal, check.naturalDie, {
      cap: check.cap ?? null,
      threat: check.threat ?? 0,
      actionDieBonus: boostTotal,
      triumphAt: triumphAt(check),
      ceiling: check.resultCeiling ?? null
    });
  await message.update({
    "flags.spycraft2.effectiveTotal": resolved.total,
    "flags.spycraft2.boostTotal": boostTotal,
    "flags.spycraft2.capped": resolved.limited,
    "flags.spycraft2.potentialTriumph": ["skill", "knowledge", "attack"].includes(check.checkKind) && resolved.triumph,
    "flags.spycraft2.gcBoosts": [...(check.gcBoosts ?? []), result.die.total],
    flavor: checkFlavor({
      ...check,
      effectiveTotal: resolved.total,
      boostTotal,
      capped: resolved.limited,
      gcBoosts: [...(check.gcBoosts ?? []), result.die.total]
    })
  });
  // The die goes back to the pool and the card to its earlier total, while the roll is still unsettled.
  try {
    await postUndo(loc`GC boost on ${actor.name}'s roll: +${result.die.total}`, [], {
      gcDice: result.plan?.cost ?? 1,
      cardBoost: {
        messageId: message.id,
        before,
        after: { boostTotal, count: before.gcBoosts.length + 1 }
      }
    });
  } catch (error) {
    console.warn("Field Agent's Handbook | No Undo note could be left for this boost.", error);
  }
  return resolved.total;
}

function criticalRefusal(check, actor) {
  let profile;
  try {
    profile = spendProfile(actor);
  } catch {
    return "";
  }
  if (profile.type === "special") return "";
  const attack = check.checkKind === "attack";
  if (attack ? profile.treacherous === true : profile.prodigy === true) return "";
  return attack
    ? loc`A standard NPC needs the treacherous quality for a critical hit (p.452)`
    : loc`A standard NPC needs the prodigy quality for a critical success (p.452)`;
}

/** Pay for an NPC's confirmed threat from the GC pool and record the critical on its card. */
export async function gcActivateThreat(message, actor, options = {}) {
  if (!game.user?.isGM || actor?.type !== "npc" || !actor.isOwner || message.flags?.spycraft2?.actorUuid !== actor.uuid)
    throw Error(loc`The GC activates the actual NPC's own confirmed threat.`);
  assertDamageNotStarted(actor, message, { allowCover: true });
  if (message.flags?.spycraft2?.npcDefensePending)
    throw Error(loc`Finish the NPC Defense decision before activating a critical hit.`);
  const check = message.flags.spycraft2;
  let input = options;
  if (!Object.keys(input).length) {
    const choices = criticalHitChoices(check);
    input = await systemDialog.input({
      window: { title: loc`Activate NPC critical result` },
      rejectClose: false,
      ok: { label: loc`Activate chosen effect` },
      content: `<div class="spycraft2-roll-options">${check.coverAwaiting?.basis.directHits === 0 ? `<p>${loc`Critical target: ${check.coverAwaiting.criticalName}. This critical does not transfer to the protected character.`}</p>` : ""}${choices.length ? `<label>${loc`GC-confirmed critical effect`} <select name="preset" required><option value="">${loc`Choose…`}</option>${choices.map(c => `<option value="${esc(c.id)}">${esc(c.label)} (${c.cost})</option>`).join("")}</select></label>` : `<label>${loc`GC-confirmed effect`} <textarea name="effect" required></textarea></label><label>${loc`Base cost in action dice`} <input name="baseCost" type="number" min="1" step="1" value="1" required /></label>`}<p class="hint">${loc`The GC's action dice pay the final cost after applicable discounts and target-role adjustments. An attack Triumph includes a one-die critical; activate it before rolling damage.`}</p></div>`
    });
    if (!input) return null;
  }
  return actor.activateCritical(message, {
    ...input,
    kind: "success",
    payerId: "gc",
    effectConfirmed: true,
    beforeDamage: true
  });
}

rollPipeline.register({
  id: "gcNpcDiceControl",
  order: 9136,
  chatControls(ctx) {
    if (!npcOpen(ctx)) return null;
    const { message, check, actor } = ctx;
    let die = 4;
    try {
      die = gcDieType(spendProfile(actor));
    } catch {
      /* an incomplete NPC profile rolls the basic die */
    }
    const controls = gcBoostable(check)
      ? [
          {
            label: loc`GC boost (+1d${die})`,
            key: "gcBoost",
            placement: "card",
            run: () => gcBoostCard(message, actor)
          }
        ]
      : [];
    if (check.threatConfirmed && !check.criticalSuccess && !check.criticalFailure)
      controls.unshift({
        label: loc`Activate threat (GC dice)`,
        placement: "card",
        disabled: criticalRefusal(check, actor),
        run: () => gcActivateThreat(message, actor)
      });
    return controls.length ? controls : null;
  }
});
