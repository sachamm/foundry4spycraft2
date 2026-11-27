import { loc } from "../i18n.mjs";

export const fireSourceId = id =>
  typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id) && !["__proto__", "constructor", "prototype"].includes(id);
const whole = n => Number.isSafeInteger(n) && n >= 0;

export function readFireSource(hazards, id) {
  const row = fireSourceId(id) && Object.hasOwn(hazards?.fireSources ?? {}, id) ? hazards.fireSources[id] : null;
  if (
    !row ||
    !whole(row.suffered) ||
    typeof row.label !== "string" ||
    !row.label.trim() ||
    row.label.length > 100 ||
    typeof row.scarChecked !== "boolean"
  )
    throw Error(loc`Review this fire's name and cumulative damage before continuing.`);
  return row;
}

/** Track actual initial and later damage from one fire, independently of catching or extinguishing it (p.337). */
export function fireExposurePlan(hazards, { id, label, damage, at = null } = {}) {
  if (!fireSourceId(id) || typeof label !== "string" || !label.trim() || label.length > 100 || !whole(damage))
    throw Error(loc`Choose a named fire and whole damage before applying it.`);
  const old = Object.hasOwn(hazards?.fireSources ?? {}, id) ? readFireSource(hazards, id) : null;
  if (!old && !damage) return { hazards, source: null, scarSaveDue: false };
  const suffered = (old?.suffered ?? 0) + damage;
  if (!whole(suffered)) throw Error(loc`Review this fire's cumulative damage before continuing.`);
  const source = {
    ...old,
    label: old?.label ?? label.trim(),
    suffered,
    scarChecked: old?.scarChecked ?? false,
    needsReview: old?.needsReview ?? false,
    startedAt: old?.startedAt ?? at
  };
  return {
    hazards: { ...hazards, fireSources: { ...hazards?.fireSources, [id]: source } },
    source,
    scarSaveDue: suffered >= 25 && !source.scarChecked && !source.needsReview
  };
}

/** Preserve known legacy totals without guessing the initial damage omitted by older versions. */
export function legacyFireSourcePlan(hazards, id) {
  if (!hazards?.fire || hazards.fire.sourceId) return hazards;
  const plan = fireExposurePlan(hazards, {
    id,
    label: loc`Earlier fire`,
    damage: hazards.fire.suffered,
    at: hazards.fire.startedAt
  });
  // Even a zero known total must retain the unresolved historical baseline.
  const source = {
    ...(plan.source ?? {
      label: loc`Earlier fire`,
      suffered: 0,
      scarChecked: false,
      startedAt: hazards.fire.startedAt
    }),
    scarChecked: hazards.fire.scarChecked,
    needsReview: true
  };
  return {
    ...plan.hazards,
    fire: { ...hazards.fire, sourceId: id },
    fireSources: { ...plan.hazards.fireSources, [id]: source }
  };
}

export function reviewFireSourcePlan(hazards, id, { label, suffered, scarChecked, note, reviewer, at } = {}) {
  const old = readFireSource(hazards, id);
  if (
    typeof label !== "string" ||
    !label.trim() ||
    label.length > 100 ||
    !whole(suffered) ||
    typeof scarChecked !== "boolean" ||
    typeof note !== "string" ||
    !note.trim() ||
    note.length > 500 ||
    typeof reviewer !== "string" ||
    !reviewer ||
    !Number.isFinite(at)
  )
    throw Error(loc`Confirm the fire's actual total, scarring outcome and a brief GC review note.`);
  const source = {
    ...old,
    label: label.trim(),
    suffered,
    scarChecked,
    needsReview: false,
    review: { note: note.trim(), reviewer, at }
  };
  return {
    ...hazards,
    ...(hazards.fire?.sourceId === id ? { fire: { ...hazards.fire, suffered, scarChecked } } : {}),
    fireSources: { ...hazards.fireSources, [id]: source }
  };
}
