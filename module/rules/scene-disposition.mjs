import { npcUsesSceneDisposition } from "./gc/disposition.mjs";
import { loc } from "../i18n.mjs";

/** PCs and villain roles use p.458 scene effects, never NPC attitude grades. */
export function usesSceneDisposition(type, system = {}) {
  return type === "agent" ? !system.companionOf?.ownerUuid : type === "npc" && npcUsesSceneDisposition(system);
}

function entriesOf(record) {
  if (record == null) return [];
  if (record.version !== 1 || !Array.isArray(record.entries))
    throw Error(loc`The GC must review the saved scene disposition effects.`);
  const ids = new Set();
  for (const row of record.entries) {
    if (
      !row ||
      typeof row.id !== "string" ||
      !row.id ||
      ids.has(row.id) ||
      typeof row.actingActorUuid !== "string" ||
      !row.actingActorUuid ||
      typeof row.scene !== "string" ||
      !row.scene ||
      typeof row.sourceKey !== "string" ||
      !row.sourceKey ||
      typeof row.source !== "string" ||
      !row.source.trim() ||
      ![-1, 1].includes(row.direction) ||
      ![-1, 0, 1].includes(row.applied) ||
      (row.applied !== 0 && row.applied !== row.direction) ||
      !Number.isFinite(row.createdAt) ||
      (row.expiresAt !== null && (!Number.isFinite(row.expiresAt) || row.expiresAt <= row.createdAt)) ||
      (row.ended !== undefined && typeof row.ended !== "boolean")
    )
      throw Error(loc`The GC must review the saved scene disposition source and expiry.`);
    ids.add(row.id);
  }
  return record.entries;
}

export function sceneDispositionState(record, { scene, worldTime, actingActorUuid } = {}) {
  if (typeof scene !== "string" || !scene || !Number.isFinite(worldTime))
    throw Error(loc`Review the current scene and game time before applying disposition effects.`);
  const active = entriesOf(record).filter(
    row =>
      row.scene === scene &&
      !row.ended &&
      row.createdAt <= worldTime &&
      (row.expiresAt === null || row.expiresAt > worldTime) &&
      (!actingActorUuid || row.actingActorUuid === actingActorUuid)
  );
  const degree = active.reduce((sum, row) => Math.max(-2, Math.min(2, sum + row.applied)), 0);
  return {
    degree,
    active: structuredClone(active),
    modifier: degree * 2,
    error: degree === -2 ? 1 : 0,
    threat: degree === 2 ? 1 : 0,
    timeMultiplier: { "-2": 4, "-1": 2, 0: 1, 1: 0.5, 2: 0.25 }[degree]
  };
}

/** One successfully applied source contributes one degree; repeated source IDs cannot replay it. */
export function sceneDispositionChange(record, input) {
  const { id, scene, worldTime, actingActorUuid, sourceKey, source, direction, confirmed, reviewerId } = input;
  const rows = entriesOf(record);
  if (
    confirmed !== true ||
    typeof id !== "string" ||
    !id ||
    rows.some(row => row.id === id) ||
    typeof actingActorUuid !== "string" ||
    !actingActorUuid ||
    typeof sourceKey !== "string" ||
    !sourceKey.trim() ||
    typeof source !== "string" ||
    !source.trim() ||
    ![-1, 1].includes(direction) ||
    typeof reviewerId !== "string" ||
    !reviewerId
  )
    throw Error(loc`Confirm the successful source, affected character, direction and GC reviewer.`);
  if (
    rows.some(
      row => row.scene === scene && row.sourceKey === sourceKey.trim() && row.actingActorUuid === actingActorUuid
    )
  )
    throw Error(loc`This disposition source is already recorded for that character in this scene.`);
  const state = sceneDispositionState(record, { scene, worldTime, actingActorUuid }),
    degree = Math.max(-2, Math.min(2, state.degree + direction)),
    duration = input.durationSeconds ?? null;
  if (duration !== null && (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(worldTime + duration)))
    throw Error(loc`Enter a positive source duration in seconds, or leave it until the scene ends.`);
  return {
    version: 1,
    entries: [
      ...structuredClone(rows),
      {
        id,
        scene,
        actingActorUuid,
        sourceKey: sourceKey.trim(),
        source: source.trim(),
        direction,
        applied: degree - state.degree,
        createdAt: worldTime,
        expiresAt: duration === null ? null : worldTime + duration,
        reviewerId
      }
    ]
  };
}

export function endSceneDispositionSource(record, { id, scene, worldTime, confirmed } = {}) {
  const state = sceneDispositionState(record, { scene, worldTime });
  if (confirmed !== true || !state.active.some(row => row.id === id))
    throw Error(loc`Confirm an active disposition source to end early.`);
  return {
    version: 1,
    entries: entriesOf(record).map(row => (row.id === id ? { ...row, ended: true } : structuredClone(row)))
  };
}
