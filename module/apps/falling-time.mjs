import { fallingTimeRecord, fallingTimeStatus, fallingRounds } from "../rules/falling-time.mjs";
import { queueResources } from "../services/transactions.mjs";
import { recordReplacementPatch } from "../rules/record-patch.mjs";
import { sameValues } from "../rules/equal.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { loc } from "../i18n.mjs";
import { esc } from "../html.mjs";

export const currentFall = actor => actor.flags?.spycraft2?.fallTimelines?.[actor.flags?.spycraft2?.activeFallId];
export function fallClock(record = null) {
  const combat = record?.combat ? game.combats?.get?.(record.combat.id) : game.combat;
  return {
    worldTime: game.time?.worldTime,
    combat: combat?.started
      ? {
          id: combat.id,
          round: combat.round,
          count: combat.combatant?.initiative
        }
      : null
  };
}
export function fallTimingView(actor) {
  const record = currentFall(actor);
  if (!record || ["landed", "caught"].includes(record.state)) return null;
  try {
    return { ...fallingTimeStatus(record, { actorUuid: actor.uuid, ...fallClock(record) }), feet: record.feet };
  } catch (error) {
    return { due: false, text: error.message, feet: record.feet };
  }
}
async function save(actor, record, active = false) {
  const patch = recordReplacementPatch(
    `flags.spycraft2.fallTimelines.${record.id}`,
    record,
    actor.flags?.spycraft2?.fallTimelines?.[record.id]
  );
  if (active) patch["flags.spycraft2.activeFallId"] = record.id;
  try {
    await actor.update(patch);
  } catch (error) {
    if (
      !sameValues(actor.flags?.spycraft2?.fallTimelines?.[record.id], record) ||
      (active && actor.flags?.spycraft2?.activeFallId !== record.id)
    )
      throw error;
  }
}
export async function trackFall(actor, input = {}) {
  if (!actor?.isOwner || !["agent", "npc"].includes(actor.type)) return null;
  const active = currentFall(actor);
  if (active && !["landed", "caught"].includes(active.state))
    throw Error(loc`Finish or review the existing fall before starting another.`);
  if (input.feet === undefined) {
    input = await systemDialog.input({
      window: { title: loc`Track a fall` },
      rejectClose: false,
      ok: { label: loc`Start fall` },
      content: `<div class="spycraft2-roll-options"><p>${loc`Record the fall when it begins. Its actual height sets the landing time; damage reductions do not shorten the descent. In combat the current Count is saved, including falls outside this character's own turn.`}</p><label>${loc`Actual fall height (feet)`} <input name="feet" type="number" min="0" step="any" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`The fall begins now, from this confirmed height`}</label></div>`
    });
    if (!input) return null;
    input.feet = String(input.feet ?? "").trim() ? Number(input.feet) : NaN;
  }
  if (input.confirmed !== true) throw Error(loc`Confirm the actual height and start of the fall.`);
  return queueResources([actor], async () => {
    if (!actor.isOwner) throw Error(loc`You must own the character.`);
    const previous = currentFall(actor);
    if (previous && !["landed", "caught"].includes(previous.state))
      throw Error(loc`Finish or review the existing fall before starting another.`);
    const record = fallingTimeRecord({
      id: foundry.utils.randomID(),
      actorUuid: actor.uuid,
      feet: input.feet,
      ...fallClock()
    });
    await save(actor, record, true);
    return record;
  });
}
export async function reviewFallTiming(actor, input = {}) {
  if (!actor?.isOwner || !game.user?.isGM) throw Error(loc`The owning GC reviews fall timing.`);
  const before = structuredClone(currentFall(actor));
  if (!before || ["landed", "caught"].includes(before.state)) throw Error(loc`There is no unfinished fall to review.`);
  if (!input.decision) {
    input = await systemDialog.input({
      window: { title: loc`Review fall timing` },
      rejectClose: false,
      ok: { label: loc`Record decision` },
      content: `<div class="spycraft2-roll-options"><p>${esc(fallTimingView(actor)?.text ?? "")}</p><label>${loc`Reviewed actual fall height (feet)`} <input name="feet" type="number" min="0" step="any" value="${esc(Number.isFinite(before.feet) ? before.feet : "")}" required /></label><label>${loc`Actual outcome`} <select name="decision"><option value="due">${loc`The landing time has arrived`}</option><option value="caught">${loc`Caught or arrested before impact`}</option></select></label><label>${loc`Source and timing reviewed`} <textarea name="note" required></textarea></label><label><input name="confirmed" type="checkbox" /> ${loc`Confirm the actual history; no damage or dice are reversed`}</label></div>`
    });
    if (!input) return null;
  }
  if (input.confirmed !== true || !["due", "caught"].includes(input.decision) || !input.note?.trim())
    throw Error(loc`Confirm the fall outcome and record the source reviewed.`);
  return queueResources([actor], async () => {
    if (!actor.isOwner || !game.user?.isGM || !sameValues(before, currentFall(actor)))
      throw Error(loc`The fall or your permission changed. Review its current history.`);
    if (before.state === "landing" && input.decision === "caught")
      throw Error(loc`Landing settlement has begun. Review its saved damage and Undo evidence first.`);
    const feet = input.feet === undefined ? before.feet : Number(input.feet);
    const rounds = fallingRounds(feet);
    if (before.state === "landing" && feet !== before.feet)
      throw Error(loc`Landing settlement has begun. Its saved physical height cannot change.`);
    const record = {
      ...before,
      version: 1,
      id: actor.flags.spycraft2.activeFallId,
      actorUuid: actor.uuid,
      feet,
      rounds,
      worldTime: Number.isFinite(before.worldTime) ? before.worldTime : game.time.worldTime,
      state: input.decision === "caught" ? "caught" : before.state === "landing" ? "landing" : "falling",
      review: {
        due: input.decision === "due",
        note: input.note.trim(),
        reviewedBy: game.user.id,
        at: Date.now(),
        before
      }
    };
    await save(actor, record);
    return record;
  });
}

/** Called under the landing workflow's actor lock, before any damage RNG. */
export async function claimFallLanding(actor, message, expected) {
  const id = message.flags?.spycraft2?.fallTimelineId ?? expected?.id;
  if (!id) {
    const active = currentFall(actor);
    if (active && !["landed", "caught"].includes(active.state))
      throw Error(loc`A tracked fall began while this landing was reviewed. Review the current fall.`);
    return null; // An explicitly recorded historical landing need not have a start timer.
  }
  const record = actor.flags?.spycraft2?.fallTimelines?.[id];
  if (!record || (expected && !sameValues(record, expected)))
    throw Error(loc`The tracked fall changed. Review its current landing record.`);
  if (record.resolutionKey && record.resolutionKey !== message.uuid)
    throw Error(loc`This fall already has a different landing result. Continue that saved result.`);
  const status = fallingTimeStatus(record, { actorUuid: actor.uuid, ...fallClock(record) });
  if (!status.due || record.state === "caught") throw Error(status.text);
  if (record.feet !== message.flags.spycraft2.fallDistance?.actualDistanceFeet)
    throw Error(loc`The recorded check's height does not match the tracked physical fall.`);
  const next = { ...record, state: "landing", resolutionKey: message.uuid };
  await save(actor, next);
  await message.update({ "flags.spycraft2.fallTimelineId": id });
  return id;
}
export async function finishFallLanding(actor, id, message) {
  if (!id) return;
  const record = actor.flags?.spycraft2?.fallTimelines?.[id];
  if (!record || record.resolutionKey !== message.uuid) throw Error(loc`Review this fall's saved landing identity.`);
  await save(actor, { ...record, state: "landed" });
}

export function installFallingTimeHooks() {
  const refresh = () => {
    for (const window of Object.values(ui.windows ?? {}))
      if (window.actor && currentFall(window.actor) && window.rendered) window.render(false);
  };
  Hooks.on("updateWorldTime", refresh);
  Hooks.on("updateCombat", refresh);
  Hooks.on("deleteCombat", refresh);
}
