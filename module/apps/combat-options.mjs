/**
 * Tools for the combat actions in module/rules/combat-options.mjs: recording an Anticipate result, a Stand Off,
 * settling Tire, the Coup de Grace survival save and cancelling a Ready action.
 */
import { esc } from "../html.mjs";
import { refuse } from "../error-notices.mjs";
import {
  READY_CANCEL_DC,
  STAND_OFF_COUNT,
  anticipateActive,
  anticipatePlan,
  coupDeGracePlan,
  opponentDC,
  standOffStress,
  tireOutcome
} from "../rules/combat-options.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { expertiseCombatContext } from "./combat-expertise.mjs";
import { hazardSaveResolvers, post, rollTotal, sufferStress } from "./hazards.mjs";
import { applyAccumulatedDamage } from "./damage-ledger.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { loc } from "../i18n.mjs";

const owned = actor => actor?.isOwner === true;

/** Characters a tool may name as the opponent: targeted tokens first, then every visible character. */
function opponents(actor) {
  const list = new Map();
  for (const token of game.user?.targets ?? [])
    if (token.actor && token.actor.uuid !== actor.uuid) list.set(token.actor.uuid, token.actor);
  for (const other of game.actors ?? [])
    if (other.uuid !== actor.uuid && ["agent", "npc"].includes(other.type) && (other.visible || game.user.isGM))
      list.set(other.uuid, other);
  return [...list.values()];
}
const opponentOptions = actor =>
  opponents(actor)
    .map(other => `<option value="${esc(other.uuid)}">${esc(other.name)} (BAB +${other.system?.bab ?? 0})</option>`)
    .join("");

async function flatFooted(actor) {
  try {
    await setConditionStatus(actor, "flat-footed", true, { label: loc`Flat-footed` });
    return loc`Flat-footed.`;
  } catch (error) {
    return loc`Flat-footed could not be applied (${esc(error.message)}); apply it by hand.`;
  }
}

async function subdual(actor, amount, source) {
  try {
    await applyAccumulatedDamage(actor, {
      source: `${source} [${foundry.utils.randomID(6)}]`,
      kind: "subdual",
      newDamage: amount,
      damageMode: "subdualBeforeDefenses",
      confirmed: true
    });
    return loc`${esc(actor.name)}: ${amount} subdual damage recorded.`;
  } catch (error) {
    return loc`${esc(actor.name)}: ${amount} subdual damage could not be recorded (${esc(error.message)}); record it by hand.`;
  }
}

/* -------------------------------------------- */
/*  Anticipate                                   */
/* -------------------------------------------- */

/** The Anticipate records that still hold for a character, by opponent. */
export function activeAnticipations(actor) {
  const combat = expertiseCombatContext(actor);
  return Object.values(actor.flags?.spycraft2?.anticipate ?? {}).filter(record => anticipateActive(record, combat));
}

/** Record the result of an Anticipate Action check (p.354). */
export async function recordAnticipate(actor, options = {}) {
  if (!owned(actor)) return null;
  let input = options;
  if (!input.outcome) {
    input = await systemDialog.input({
      window: { title: loc`Anticipate result` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Roll Sense Motive and choose Anticipate Action first. The DC is 10 + the opponent's base attack bonus.`}</p><label>${loc`Opponent`} <select name="opponentUuid">${opponentOptions(actor)}</select></label><label>${loc`Result`} <select name="outcome"><option value="success">${loc`Success`}</option><option value="critical">${loc`Critical success`}</option><option value="failure">${loc`Failure`}</option><option value="criticalFailure">${loc`Critical failure`}</option></select></label></div>`
    });
    if (!input) return null;
  }
  const opponent =
    opponents(actor).find(o => o.uuid === input.opponentUuid) ?? (await fromUuid(input.opponentUuid ?? ""));
  let plan;
  try {
    plan = anticipatePlan(actor.system, {
      outcome: input.outcome,
      opponentUuid: opponent?.uuid ?? "",
      opponentName: opponent?.name ?? "",
      combat: expertiseCombatContext(actor)
    });
  } catch (error) {
    return refuse(error.message);
  }
  const lines = [];
  if (plan.dodge) {
    // One Anticipate per opponent: a new one replaces the old, even when it is worse (p.354).
    const key = opponent.id ?? foundry.utils.randomID();
    await actor.update({ [`flags.spycraft2.anticipate.${key}`]: plan });
    lines.push(
      loc`Anticipates ${esc(plan.opponentName)}: +${plan.dodge} dodge to Defense against their attacks for a full round.`
    );
    if (plan.threatReduction)
      lines.push(
        loc`Critical success: their threat range against this character falls by ${plan.threatReduction} (never past 20).`
      );
  } else if (plan.flatFooted) lines.push(loc`Anticipate: critical failure.`, await flatFooted(actor));
  else lines.push(loc`Anticipate: no benefit.`);
  await post(actor, lines);
  return plan;
}

/* -------------------------------------------- */
/*  Stand Off                                    */
/* -------------------------------------------- */

/** Start a Stand Off, the stand-off round's stress, or a surrender (p.359). */
export async function standOff(actor, options = {}) {
  if (!owned(actor)) return null;
  let input = options;
  if (!input.step) {
    input = await systemDialog.input({
      window: { title: loc`Stand Off` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options">
        <label>${loc`Step`} <select name="step"><option value="enter">${loc`Enter: Reflex save against an attack about to be made`}</option><option value="lost">${loc`A round's Resolve check was lost: take the stress`}</option></select></label>
        <label>${loc`Attacker (for entering)`} <select name="opponentUuid">${opponentOptions(actor)}</select></label>
        <label>${loc`Winner's Wisdom modifier (for a lost round)`} <input type="number" name="winnerWis" step="1" value="0" /></label>
        <p class="hint">${loc`Entering costs 1 action die and 5 Initiative Count; record them as usual. While it lasts everyone in it is vulnerable and takes only free actions; any damage ends it.`}</p>
      </div>`
    });
    if (!input) return null;
  }
  if (input.step === "lost") {
    const roll = await rollTotal("1d6"),
      stress = standOffStress(roll.total, input.winnerWis);
    const line = await sufferStress(actor, stress, loc`Stand off`);
    return post(
      actor,
      [
        line,
        loc`If this crosses a stress threshold the character cracks: surrender, or take an automatic hit (a special character drops to –1 wounds; a standard one dies).`
      ],
      [roll.roll]
    );
  }
  const opponent = opponents(actor).find(o => o.uuid === input.opponentUuid);
  if (!opponent) return refuse(loc`Choose the attacker.`);
  return actor.rollSave("ref", {
    askContext: true,
    hazardSave: {
      kind: "standOff",
      label: loc`Stand Off`,
      dc: opponentDC(opponent.system?.bab ?? 0),
      opponentName: opponent.name
    }
  });
}

/* -------------------------------------------- */
/*  Tire                                         */
/* -------------------------------------------- */

/** Settle a Tire action after both Resolve (Con) checks are resolved (p.361). */
export async function tireResult(actor, options = {}) {
  if (!owned(actor)) return null;
  let input = options;
  if (!input.result) {
    input = await systemDialog.input({
      window: { title: loc`Tire result` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><label>${loc`Opponent`} <select name="opponentUuid">${opponentOptions(actor)}</select></label><label>${loc`Result for this character`} <select name="result"><option value="won">${loc`Won`}</option><option value="wonCritical">${loc`Won with a critical success, or the opponent's critical failure`}</option><option value="lost">${loc`Lost`}</option><option value="lostCritical">${loc`Lost to the opponent's critical success, or my critical failure`}</option></select></label></div>`
    });
    if (!input) return null;
  }
  let outcome;
  try {
    outcome = tireOutcome(input.result);
  } catch (error) {
    return refuse(error.message);
  }
  const opponent = opponents(actor).find(o => o.uuid === input.opponentUuid) ?? null,
    lines = [],
    rolls = [];
  if (outcome.flatFooted) lines.push(await flatFooted(actor));
  if (outcome.damage) {
    const damage = await rollTotal(outcome.damage),
      victim = outcome.target === "self" ? actor : opponent;
    rolls.push(damage.roll);
    lines.push(
      victim?.isOwner
        ? await subdual(victim, damage.total, loc`Tire`)
        : loc`${esc(victim?.name ?? loc`The opponent`)} takes ${damage.total} subdual damage; its owner records it.`
    );
  }
  return post(actor, [loc`Tire: ${esc(input.result)}.`, ...lines], rolls);
}

/* -------------------------------------------- */
/*  Coup de Grace and Ready                      */
/* -------------------------------------------- */

/** The Fortitude save after surviving a Coup de Grace (p.355). */
export async function coupDeGraceSave(actor, options = {}) {
  if (!owned(actor)) return null;
  let damage = options.damage;
  if (damage === undefined) {
    const input = await systemDialog.input({
      window: { title: loc`Survive a Coup de Grace` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><label>${loc`Damage the Coup de Grace dealt`} <input type="number" name="damage" min="0" step="1" required /></label></div>`
    });
    if (!input) return null;
    damage = input.damage;
  }
  let plan;
  try {
    plan = coupDeGracePlan(damage);
  } catch (error) {
    return refuse(error.message);
  }
  return actor.rollSave("fort", {
    askContext: true,
    hazardSave: { kind: "coupDeGrace", label: loc`Coup de Grace`, dc: plan.dc }
  });
}

/** Cancel a Ready action when its trigger comes: a Reflex save, DC 15 (p.358). */
export function cancelReady(actor) {
  if (!owned(actor)) return null;
  return actor.rollSave("ref", {
    askContext: true,
    hazardSave: { kind: "readyCancel", label: loc`Cancel a readied action`, dc: READY_CANCEL_DC }
  });
}

hazardSaveResolvers.set("standOff", async (actor, message, save, succeeded) =>
  post(actor, [
    succeeded
      ? loc`Stand Off: ${esc(save.opponentName)} must cancel the attack; a stand off begins. Initiative Count −${STAND_OFF_COUNT}.`
      : loc`Stand Off: the save fails and the attack goes ahead. Initiative Count −${STAND_OFF_COUNT}.`
  ])
);
hazardSaveResolvers.set("coupDeGrace", async (actor, message, save, succeeded) => {
  if (succeeded) return post(actor, [loc`Coup de Grace: the Fortitude save succeeds; the character lives.`]);
  if (Number.isFinite(actor.system.wounds?.max))
    await actor.update({ "system.wounds.value": coupDeGracePlan(0).woundsOnFailure });
  return post(actor, [loc`Coup de Grace: the Fortitude save fails; wounds drop to –10 and the character dies.`]);
});
hazardSaveResolvers.set("readyCancel", async (actor, message, save, succeeded) =>
  post(actor, [
    succeeded
      ? loc`The readied action is held back. The Ready ends and the Count still drops to the trigger's.`
      : loc`The readied action goes ahead as declared. The Ready ends and the Count drops to the trigger's.`
  ])
);
