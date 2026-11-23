import { loc } from "../i18n.mjs";
import { same } from "./equal.mjs";
export const reserveValue = (actor, path) => path.split(".").reduce((o, key) => o?.[key], actor);
export function getReserveReview(actor) {
  const stored = actor.flags?.spycraft2?.reserveTransactionReview,
    local = globalThis.game?.spycraft2?.pendingReserveReviews?.[actor.uuid];
  return stored?.needsReview
    ? stored
    : stored?.id === local?.id && stored?.needsReview === false
      ? stored
      : (local ?? stored ?? {});
}
export function reserveTransaction(actor, plan, before, attempt, beforeUse) {
  const fields = [];
  for (const key of ["picks", "spent", "charismaPicks"])
    for (const category of Object.keys(plan.record[key] ?? {})) {
      const old = before[key]?.[category] ?? 0,
        value = plan.record[key][category];
      if (value !== old)
        fields.push({
          path: `system.missionReserves.${key}.${category}`,
          label: `${category} ${key === "picks" ? loc`Reserve remaining` : key === "spent" ? loc`Reserve spent` : loc`Charisma category remaining`}`,
          before: old,
          reserved: value
        });
    }
  for (const key of ["common", "spentCommon"])
    if (plan.record[key] !== before[key])
      fields.push({
        path: `system.missionReserves.${key}`,
        label: key === "common" ? loc`Common Items remaining` : loc`Common Items spent`,
        before: before[key] ?? 0,
        reserved: plan.record[key] ?? 0
      });
  if (
    fields.some(
      f => !Number.isSafeInteger(f.before) || f.before < 0 || !Number.isSafeInteger(f.reserved) || f.reserved < 0
    )
  )
    throw new Error(loc`Review the whole-number Reserve balances before reserving another acquisition.`);
  const abilityId = plan.abilityId ?? plan.requestAbility;
  return {
    id: attempt.id,
    epoch: attempt.epoch,
    attempt: structuredClone(attempt),
    fields,
    ...(plan.provisionalCreated ? { priorLedger: structuredClone(actor.system.missionReserves ?? null) } : {}),
    ability: abilityId
      ? {
          id: abilityId,
          before: { present: beforeUse !== undefined, value: beforeUse ?? null },
          reserved: structuredClone({ ...beforeUse, ...plan.abilityRecord })
        }
      : null
  };
}
export function reserveReservationMatches(actor, event) {
  return (
    actor.system.missionReserves?.epoch === event.epoch &&
    same(actor.system.missionReserves?.attempts?.[event.id], event.attempt) &&
    event.fields.every(f => reserveValue(actor, f.path) === f.reserved) &&
    (!event.ability || same(actor.system.resourceUses?.[event.ability.id], event.ability.reserved))
  );
}
export function reserveUntouched(actor, event) {
  const ledger = Object.hasOwn(event, "priorLedger")
    ? same(actor.system.missionReserves ?? null, event.priorLedger)
    : actor.system.missionReserves?.epoch === event.epoch &&
      !actor.system.missionReserves?.attempts?.[event.id] &&
      event.fields.every(f => reserveValue(actor, f.path) === f.before);
  return (
    ledger &&
    (!event.ability ||
      same(
        actor.system.resourceUses?.[event.ability.id],
        event.ability.before.present ? event.ability.before.value : undefined
      ))
  );
}
export function reserveRollbackPatch(actor, event) {
  if (
    actor.system.missionReserves?.epoch !== event.epoch ||
    !same(actor.system.missionReserves.attempts?.[event.id], event.attempt)
  )
    throw new Error(loc`The reserved acquisition changed. Review its sources before restoring it.`);
  const patch = {};
  for (const f of event.fields) {
    const current = reserveValue(actor, f.path),
      value = current + f.before - f.reserved;
    if (!Number.isSafeInteger(current) || !Number.isSafeInteger(value) || value < 0)
      throw new Error(loc`The Reserve balance needs GC review.`);
    patch[f.path] = value;
  }
  if (event.ability) {
    const a = event.ability;
    if (!same(actor.system.resourceUses?.[a.id], a.reserved))
      throw new Error(loc`The Request ability use changed. Preserve it for GC review.`);
    if (a.before.present) {
      patch[`system.resourceUses.${a.id}`] = a.before.value;
      if (a.before.value && typeof a.before.value === "object")
        for (const key of Object.keys(a.reserved))
          if (!Object.hasOwn(a.before.value, key)) patch[`system.resourceUses.${a.id}.-=${key}`] = null;
    } else patch[`system.resourceUses.-=${a.id}`] = null;
  }
  patch[`system.missionReserves.attempts.-=${event.id}`] = null;
  patch[`flags.spycraft2.reserveRollbacks.${event.id}`] = { id: event.id, epoch: event.epoch, restored: true };
  return patch;
}
