/**
 * Dueling Mastery and Supremacy on attack cards (p.178).
 *
 * - Dueling Supremacy: each melee-weapon hit raises the attacker's Initiative Count by 1. The attacker's resolved hit
 *   offers the change once.
 * - Dueling Mastery: an adjacent opponent who misses the character loses 2 from their Initiative Count. The GC
 *   confirms adjacency by using the control on the opponent's resolved miss against that character, once.
 *
 * Their Defense bonuses are prepared with the character (module/rules/engine.mjs).
 */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import {
  recordCountShift,
  countContextFor,
  countClaims,
  undoCountShift,
  reviewCountShift,
  COUNT_FLAGS
} from "../documents/actor/count-shifts.mjs";
import { askGC, registerRelay } from "./gc-relay.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { esc } from "../html.mjs";

const MELEE = ["blunt", "exoticBlunt", "edged", "exoticEdged"];
const countStateLabel = state =>
  ({
    reserved: loc`delivery needs review`,
    recorded: loc`queued`,
    settled: loc`applied at round end`,
    undone: loc`withdrawn; trigger consumed`,
    reviewPending: loc`GC correction pending`,
    reviewed: loc`GC review complete`
  })[state] ?? loc`history needs review`;
const meleeWeaponHit = check =>
  check.checkKind === "attack" &&
  check.attackContext?.ranged === false &&
  check.attackContext?.disarm?.active !== true &&
  MELEE.includes(check.weaponProficiency) &&
  check.resolved === true &&
  !check.superseded;

export async function shiftCount(message, actor, amount, flag, label) {
  if (!game.user?.isGM)
    return askGC("recordCountShift", { messageId: message.id, actorUuid: actor.uuid, amount, flag, label });
  if (!message.flags?.spycraft2?.countContext?.triggerId) {
    const context = countContextFor(actor);
    if (
      !context ||
      !(await systemDialog.confirm({
        window: { title: loc`Review older Count trigger` },
        content: `<p>${loc`Verify that this trigger belongs to the current combat and round, and that its Count change has not already been applied or recorded.`}</p>`,
        yes: { label: loc`Record in this round` },
        no: { label: loc`Cancel` },
        rejectClose: false
      }))
    )
      return null;
    await message.update({ "flags.spycraft2.countContext": context });
  }
  const { row, key } = await recordCountShift(message, actor, amount, flag, label);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: foundry.utils.escapeHTML(
      loc`${label}: ${actor.name}’s Count modifier ${amount > 0 ? "+" : ""}${amount} is ${countStateLabel(row.state)}. Queued modifiers apply at the end of round ${row.round}, with the shared ±10 limit.`
    ),
    flags: { spycraft2: { countShiftReceipt: { actorUuid: actor.uuid, key, id: row.id } } }
  });
}

registerRelay("recordCountShift", {
  concerns: () => [
    loc`Verify the actual rule, trigger, amount and original combat round before recording this modifier.`
  ],
  async describe(data, user) {
    const message = game.messages.get(data.messageId),
      source = message?.flags?.spycraft2;
    const actor = source?.actorUuid ? await fromUuid(source.actorUuid) : null;
    if (
      !actor?.testUserPermission(user, "OWNER") ||
      !COUNT_FLAGS.includes(data.flag) ||
      data.flag === "duelingMastery" ||
      !Number.isSafeInteger(data.amount) ||
      !data.amount
    )
      throw Error(loc`Only the triggering character's player may request this reviewed Count modifier.`);
    return loc`${esc(user.name)} requests ${esc(data.label)}: Count ${Number(data.amount)}. Verify this trigger and record it for the end of its round?`;
  },
  async run(data) {
    const source = game.messages.get(data.messageId),
      actor = await fromUuid(data.actorUuid);
    if (!source || !actor) throw Error(loc`The original Count trigger or target is unavailable.`);
    await shiftCount(source, actor, data.amount, data.flag, data.label);
    return true;
  }
});

rollPipeline.register({
  id: "duelingControls",
  kinds: ["attack", "skill", "note"],
  order: 9760,
  chatControls({ message, check, actor, user }) {
    const controls = [];
    if (user?.isGM && countRowsFor(message).length)
      controls.push({ label: loc`GC: review Count modifier`, run: () => reviewCountDialog(message) });
    if (check.checkKind !== "attack" || check.resolved !== true || check.superseded)
      return controls.length ? controls : null;
    if (
      meleeWeaponHit(check) &&
      check.successConfirmed === true &&
      !check.duelingSupremacy &&
      actor?.system?.activeFeatNames?.includes("Dueling Supremacy")
    )
      controls.push({
        label: loc`Dueling Supremacy: Count +1`,
        hint: loc`Dueling Supremacy: Initiative Count +1`,
        run: () => shiftCount(message, actor, 1, "duelingSupremacy", "Dueling Supremacy")
      });
    // Forward Stance (Rolling Basics, p.187): each hit raises the attacker's Initiative Count by 1.
    if (
      check.successConfirmed === true &&
      !check.forwardStance &&
      actor?.system?.combatStance?.key === "forward" &&
      actor.system.activeFeatNames?.includes("Rolling Basics")
    )
      controls.push({
        label: loc`Forward Stance: Initiative Count +1`,
        run: () => shiftCount(message, actor, 1, "forwardStance", "Forward Stance")
      });
    const target = check.attackContext?.targetActorUuid ? fromUuidSync(check.attackContext.targetActorUuid) : null;
    if (
      user?.isGM &&
      check.successConfirmed === false &&
      check.attackContext?.disarm?.active !== true &&
      !check.duelingMastery &&
      target?.system?.activeFeatNames?.includes("Dueling Mastery")
    )
      controls.push({
        label: loc`Dueling Mastery: Count −2`,
        hint: loc`Dueling Mastery: adjacent attacker’s Initiative Count −2`,
        run: () => shiftCount(message, actor, -2, "duelingMastery", "Dueling Mastery")
      });
    return controls.length ? controls : null;
  }
});

const countRowsFor = message => {
  const actors = [
    ...(globalThis.game?.actors ?? []),
    ...[...(globalThis.canvas?.scene?.tokens ?? [])].map(t => t.actor)
  ].filter(Boolean);
  const unique = [...new Map(actors.map(actor => [actor.uuid, actor])).values()];
  return unique.flatMap(actor =>
    Object.entries(countClaims(actor))
      .filter(
        ([key, row]) =>
          row.actorUuid === actor.uuid &&
          (row.sourceUuid === message.uuid ||
            (typeof row.triggerId === "string" &&
              row.triggerId === message.flags?.spycraft2?.countContext?.triggerId) ||
            (message.flags?.spycraft2?.countShiftReceipt?.actorUuid === actor.uuid &&
              message.flags.spycraft2.countShiftReceipt.key === key))
      )
      .map(([key, row]) => ({ actor, key, row }))
  );
};

export async function reviewCountDialog(message) {
  if (!game.user?.isGM) throw Error(loc`The GC reviews Count history.`);
  const rows = countRowsFor(message);
  if (!rows.length) throw Error(loc`This source has no recorded Count modifier to review.`);
  const input = await systemDialog.input({
    window: { title: loc`Review Count modifier` },
    position: { width: 560 },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p>${loc`Review the original round, current Count and later actions. Withdrawing a pending modifier keeps its trigger consumed. A correction sets the reviewed current Count once; it never rerolls the trigger.`}</p><label>${loc`Recorded modifier`} <select name="event">${rows.map(({ actor, row }, i) => `<option value="${i}">${esc(actor.name)}: ${esc(row.label)} ${row.amount}, ${loc`round ${row.round}`}, ${esc(countStateLabel(row.state))}</option>`).join("")}</select></label><label>${loc`Decision`} <select name="decision"><option value="withdraw">${loc`Withdraw this pending modifier`}</option><option value="review">${loc`Review actual history and consume the trigger`}</option><option value="finish">${loc`Finish the already recorded GC correction`}</option></select></label><label><input type="checkbox" name="correct" /> ${loc`Set the GC-reviewed current Count`}</label><label>${loc`Reviewed current Count`} <input name="currentCount" type="number" step="1" /></label><label>${loc`Actual history and later actions`} <textarea name="note"></textarea></label>${rows
      .filter(({ row }) => row.state === "reviewPending" && row.reviewIntent)
      .map(
        ({ actor, row }) =>
          `<p>${loc`Saved correction for ${esc(actor.name)}: ${esc(row.reviewIntent.decision.note)}. Reviewed Count: ${row.reviewIntent.decision.currentCount ?? loc`unchanged`}.`}</p>`
      )
      .join("")}</div>`,
    ok: { label: loc`Record Count review` }
  });
  if (!input) return null;
  const selected = rows[Number(input.event)];
  if (!selected) throw Error(loc`Choose the original modifier and record its actual history.`);
  if (input.decision === "finish") {
    if (!selected.row.reviewIntent) throw Error(loc`This modifier has no recorded GC correction to finish.`);
    return reviewCountShift(selected.actor, selected.key, selected.row.reviewIntent.decision);
  }
  if (!input.note?.trim()) throw Error(loc`Choose the original modifier and record its actual history.`);
  if (input.decision === "withdraw") {
    if (input.correct) throw Error(loc`Choose history review when correcting the current Count.`);
    return undoCountShift(selected.actor, selected.key);
  }
  return reviewCountShift(selected.actor, selected.key, {
    note: input.note,
    correct: input.correct === true,
    currentCount: input.correct === true && input.currentCount !== "" ? Number(input.currentCount) : null
  });
}
