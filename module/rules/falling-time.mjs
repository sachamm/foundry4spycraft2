import { loc } from "../i18n.mjs";

/** Physical descent, p.107; reductions to damage distance do not change duration. */
export function fallingRounds(feet) {
  if (!Number.isFinite(feet) || feet < 0 || feet > Number.MAX_SAFE_INTEGER)
    throw Error(loc`Enter the actual nonnegative fall height.`);
  return feet <= 150 ? 0 : 1 + Math.ceil(Math.max(0, feet - 600) / 400);
}

export function fallingTimeRecord({ id, actorUuid, feet, worldTime, combat = null }) {
  const rounds = fallingRounds(feet);
  if (typeof id !== "string" || !id || typeof actorUuid !== "string" || !actorUuid || !Number.isFinite(worldTime))
    throw Error(loc`Review the fall identity and game clock.`);
  if (
    combat &&
    (!combat.id || !Number.isSafeInteger(combat.round) || combat.round < 1 || !Number.isFinite(combat.count))
  )
    throw Error(loc`A combat fall needs its actual starting round and Initiative Count.`);
  return {
    version: 1,
    id,
    actorUuid,
    feet,
    rounds,
    worldTime,
    combat: combat ? { ...combat } : null,
    state: "falling"
  };
}

export function fallingTimeStatus(record, { actorUuid, worldTime, combat = null } = {}) {
  if (
    !record ||
    record.version !== 1 ||
    record.actorUuid !== actorUuid ||
    !record.id ||
    record.rounds !== fallingRounds(record.feet) ||
    !Number.isFinite(record.worldTime) ||
    !["falling", "landing", "landed", "caught"].includes(record.state)
  )
    throw Error(loc`The saved fall timing needs GC review.`);
  if (record.state === "caught") return { due: false, ended: true, text: loc`The fall ended before impact.` };
  if (record.state === "landed") return { due: true, ended: true, text: loc`The recorded landing is complete.` };
  if (record.review?.due === true && record.review.note?.trim() && record.review.reviewedBy)
    return { due: true, ended: false, text: loc`Landing time confirmed by the GC: ${record.review.note}` };
  let elapsed;
  if (record.combat) {
    const start = record.combat;
    if (
      !start.id ||
      !Number.isSafeInteger(start.round) ||
      start.round < 1 ||
      !Number.isFinite(start.count) ||
      !combat ||
      combat.id !== start.id ||
      !Number.isSafeInteger(combat.round) ||
      combat.round < start.round ||
      !Number.isFinite(combat.count)
    )
      throw Error(loc`The fall's original combat or clock changed. The GC must review the actual landing time.`);
    elapsed = combat.round - start.round - (combat.count > start.count ? 1 : 0);
  } else {
    if (!Number.isFinite(worldTime) || worldTime < record.worldTime)
      throw Error(loc`The game clock precedes this fall. The GC must review its actual timing.`);
    elapsed = Math.floor((worldTime - record.worldTime) / 6);
  }
  const remaining = Math.max(0, record.rounds - Math.max(0, elapsed));
  return {
    due: remaining === 0,
    ended: false,
    remaining,
    text:
      remaining === 0
        ? loc`Landing is due now.`
        : record.combat
          ? loc`Landing: round ${record.combat.round + record.rounds}, Count ${record.combat.count}; ${remaining} full round(s) remain.`
          : loc`Landing in ${Math.max(0, record.rounds * 6 - (worldTime - record.worldTime))} game seconds.`
  };
}
