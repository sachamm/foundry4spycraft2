import {
  usesSceneDisposition,
  sceneDispositionState,
  sceneDispositionChange,
  endSceneDispositionSource
} from "../rules/scene-disposition.mjs";
import { queueResources } from "../services/transactions.mjs";
import { recordReplacementPatch } from "../rules/record-patch.mjs";
import { sameValues } from "../rules/equal.mjs";
import { withUndo } from "./undo.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { readSetting } from "../settings.mjs";
import { esc } from "../html.mjs";
import { loc } from "../i18n.mjs";

const context = actor => ({
  scene: String(readSetting("usagePeriods", {})?.scene ?? "initial"),
  worldTime: game.time?.worldTime ?? 0,
  record: actor.flags?.spycraft2?.sceneDisposition ?? null,
  eligible: usesSceneDisposition(actor.type, actor.system)
});
const candidates = () =>
  [...(game.actors?.contents ?? game.actors ?? [])].filter(a => ["agent", "npc"].includes(a.type));

/** GC records a successful disposition-changing source; the source's success is adjudicated separately. */
export async function manageSceneDisposition(actor, options = {}) {
  if (!game.user?.isGM || !actor?.isOwner || !usesSceneDisposition(actor.type, actor.system))
    throw Error(loc`The owning GC manages temporary PC and villain disposition effects.`);
  const start = context(actor),
    before = structuredClone(start.record),
    scene = start.scene,
    state = sceneDispositionState(start.record, start),
    id = foundry.utils.randomID();
  let input = options;
  if (input.confirmed !== true) {
    input = await systemDialog.input({
      window: { title: loc`${actor.name}: scene disposition effects` },
      position: { width: 620 },
      rejectClose: false,
      ok: { label: loc`Apply` },
      content: `<div class="spycraft2-roll-options"><p>${loc`Record each successful disposition-changing check, ability or rule once. Each source changes one degree, up to two either way. Opposite effects cancel by degrees. Only Intimacy and Fondness checks change; this does not control a PC or decide Loyalty or combat allegiance.`}</p><p>${loc`Effects end with this scene. Enter an earlier remaining duration when known, or end the source here when its rule ends it.`}</p>
      <label>${loc`Action`} <select name="action"><option value="record">${loc`Record a successful source`}</option><option value="end"${state.active.length ? "" : " disabled"}>${loc`End an active source early`}</option></select></label>
      <label data-when="action=record">${loc`Character gaining the check effects`} <select name="actingActorUuid">${candidates()
        .map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`)
        .join("")}</select></label>
      <label data-when="action=record">${loc`Direction`} <select name="direction"><option value="1">${loc`Positive: one degree`}</option><option value="-1">${loc`Negative: one degree`}</option></select></label>
      <label data-when="action=record">${loc`Source check, ability or rule`} <input name="source" type="text" /></label>
      <label data-when="action=record">${loc`Source occurrence (check link or unique use)`} <input name="sourceKey" type="text" /></label>
      <label data-when="action=record">${loc`Seconds remaining before the source ends (blank for scene end)`} <input name="durationSeconds" type="number" min="1" step="1" /></label>
      <label data-when="action=end">${loc`Active source to end`} <select name="endId"><option value="">${loc`Choose an active source`}</option>${state.active.map(row => `<option value="${esc(row.id)}">${esc(row.source)} · ${esc(candidates().find(a => a.uuid === row.actingActorUuid)?.name ?? row.actingActorUuid)} · ${row.applied >= 0 ? "+" : ""}${row.applied}${row.expiresAt === null ? "" : loc` · ${Math.max(0, row.expiresAt - start.worldTime)} seconds remaining`}</option>`).join("")}</select></label>
      <label><input type="checkbox" name="confirmed" /> ${loc`The GC confirms this source succeeded and its direction and duration apply, or confirms its early end`}</label></div>`
    });
  }
  if (!input) return null;
  return queueResources([actor], async () => {
    const current = context(actor);
    if (
      !game.user?.isGM ||
      !actor.isOwner ||
      !current.eligible ||
      current.scene !== scene ||
      !sameValues(current.record, before)
    )
      throw Error(loc`The scene, target role or disposition record changed. Reopen the review.`);
    let record;
    if (input.action === "end")
      record = endSceneDispositionSource(current.record, {
        id: input.endId,
        scene,
        worldTime: current.worldTime,
        confirmed: input.confirmed
      });
    else if (input.action === "record" || input.action === undefined) {
      if (!candidates().some(a => a.uuid === input.actingActorUuid))
        throw Error(loc`Choose an actual acting character for these disposition effects.`);
      record = sceneDispositionChange(current.record, {
        ...input,
        id,
        scene,
        worldTime: current.worldTime,
        reviewerId: game.user.id,
        direction: Number(input.direction),
        durationSeconds:
          input.durationSeconds === "" || input.durationSeconds == null ? null : Number(input.durationSeconds)
      });
    } else throw Error(loc`Choose whether to record or end a disposition source.`);
    const changed = record.entries.find(row => row.id === (input.action === "end" ? input.endId : id)),
      result = sceneDispositionState(record, { ...current, actingActorUuid: changed.actingActorUuid }),
      name = candidates().find(a => a.uuid === changed.actingActorUuid)?.name ?? changed.actingActorUuid;
    await withUndo(
      [actor],
      loc`${actor.name}: ${input.action === "end" ? loc`ended` : loc`recorded`} ${changed.source}; ${name} now has disposition degree ${result.degree}, check modifier ${result.modifier}, time ×${result.timeMultiplier}`,
      async () => {
        try {
          await actor.update(recordReplacementPatch("flags.spycraft2.sceneDisposition", record, before));
        } catch (error) {
          if (!sameValues(actor.flags?.spycraft2?.sceneDisposition, record)) throw error;
        }
      }
    );
    return record;
  });
}
