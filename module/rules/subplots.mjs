import { loc } from "../i18n.mjs";

/** Crossroads are selected forms of standard Subplots, not something inferred from their free-text titles. */
export function subplotPlan(system, titles = {}) {
  const rows = system.subplots ?? [],
    keys = Object.keys(titles),
    errors = [],
    active = [],
    chosen = new Set();
  const completedStandard = rows.filter(
    row =>
      row.complete === true &&
      row.kind === "standard" &&
      (String(row.name ?? "").trim() || String(row.notes ?? "").trim())
  ).length;
  const owned = keys.indexOf(system.crossroadsTitle);
  for (const [index, row] of rows.entries()) {
    if (row.complete === true || !(String(row.name ?? "").trim() || String(row.notes ?? "").trim())) continue;
    const kind = row.kind ?? "",
      title = Object.hasOwn(titles, kind) ? titles[kind] : null,
      name = String(row.name ?? "").trim() || loc`Subplot ${index + 1}`;
    let reason = "";
    if (kind && kind !== "standard" && !title) reason = loc`${name}: review the saved Subplot type.`;
    else if (system.campaignEffects?.forbidCrossroads === true) {
      if (title) reason = loc`${name}: Routine prevents undertaking a Crossroads Subplot (p.408).`;
      else if (!kind)
        reason = loc`${name}: the GC must classify this older active Subplot before it can be used under Routine.`;
    }
    if (!reason && title) {
      const target = keys.indexOf(kind);
      if (owned >= target) reason = loc`${name}: the ${title.label} Crossroads title is already held.`;
      else if (system.level < title.level)
        reason = loc`${name}: the ${title.label} Crossroads requires Career Level ${title.level}.`;
      else if (completedStandard < title.completed)
        reason = loc`${name}: the GC must confirm ${title.completed} completed standard Subplots before this Crossroads can begin.`;
      else if (owned < target - 1)
        reason = loc`${name}: earn every lower Crossroads title before attempting ${title.label}.`;
      else if (chosen.has(kind)) reason = loc`${name}: this Crossroads title already has an active attempt.`;
      chosen.add(kind);
    }
    if (reason) errors.push({ index, text: reason });
    else active.push(index);
  }
  return { completedStandard, active, errors };
}
