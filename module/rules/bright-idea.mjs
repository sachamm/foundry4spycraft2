const epoch = periods => String(periods?.session ?? "initial");
const safeKey = value => encodeURIComponent(value).replaceAll(".", "%2E");
/** p.29: same-named non-legacy abilities have separate source-class use pools. */
export function brightIdeaSources(system) {
  const out = [],
    add = (id, label, limit) =>
      out.push({ id, name: `Bright Idea (${label})`, limit, cost: 0, period: "session", workflow: "brightIdea" });
  const scientist = system.classLevels?.scientist ?? 0,
    analyst = system.classLevels?.fieldAnalyst ?? 0;
  if (scientist >= 3) add("brightIdeaScientist", "Scientist", 2 + 2 * Math.floor((Math.min(scientist, 20) - 3) / 4));
  if (analyst >= 4) add("brightIdeaFieldAnalyst", "Field Analyst", analyst >= 8 ? 4 : 2);
  if (scientist < 3) {
    const seen = new Set();
    for (const entry of system.inheritedClassChoices ?? [])
      if (entry.name === "Scientist: Bright idea (1/session)") {
        const owner = entry.ownerClass ?? entry.ownerId;
        if (!owner || seen.has(owner)) continue;
        seen.add(owner);
        add(
          `brightIdeaBorrowed_${safeKey(owner)}`,
          `borrowed by ${String(owner)
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/^./, c => c.toUpperCase())}`,
          1
        );
      }
  }
  return out;
}
const currentUsed = (record, session) => {
  if (record === undefined || record === null) return 0;
  if (typeof record !== "object" || Array.isArray(record) || typeof record.epoch !== "string" || !record.epoch)
    return null;
  return record.epoch === session ? (Number.isSafeInteger(record.used) && record.used >= 0 ? record.used : null) : 0;
};
export function brightIdeaPoolStatus(system, periods = system.usagePeriods) {
  const session = epoch(periods),
    uses = structuredClone(system.resourceUses ?? {}),
    old = uses.brightIdea;
  const legacyUsed = currentUsed(old, session),
    pending = old !== undefined && old !== null && (legacyUsed === null || (old.epoch === session && legacyUsed > 0));
  const sources = brightIdeaSources(system).map(spec => {
    const used = currentUsed(uses[spec.id], session);
    return { ...spec, used, remaining: used === null ? 0 : Math.max(0, spec.limit - used) };
  });
  const automatic =
    !!pending &&
    legacyUsed !== null &&
    sources.length === 1 &&
    sources[0].used !== null &&
    legacyUsed <= sources[0].remaining;
  if (automatic) {
    const source = sources[0];
    source.used += legacyUsed;
    source.remaining = Math.max(0, source.limit - source.used);
    uses[source.id] = { epoch: session, used: source.used };
  }
  return { session, sources, virtualUses: uses, pending, legacyUsed, automatic, needsReview: !!pending && !automatic };
}
export function brightIdeaMigrationPlan(system, periods, allocations, { at = 0, reviewedBy = "" } = {}) {
  const status = brightIdeaPoolStatus(system, periods);
  if (!status.pending) return null;
  if (status.legacyUsed === null)
    throw new Error("The old combined Bright Idea count is malformed; the GC must review its original history.");
  if (allocations === undefined) {
    if (!status.automatic)
      throw new Error(
        "Ask the GC to allocate the old combined Bright Idea uses to their source pools on Classes before using this ability."
      );
    allocations = { [status.sources[0].id]: status.legacyUsed };
  }
  const specs = brightIdeaSources(system),
    session = status.session,
    allowed = new Set(specs.map(s => s.id));
  if (
    !allocations ||
    typeof allocations !== "object" ||
    Array.isArray(allocations) ||
    Object.keys(allocations).some(id => !allowed.has(id))
  )
    throw new Error("Allocate only to currently available Bright Idea sources.");
  let total = 0;
  const updates = {},
    record = {};
  for (const spec of specs) {
    const count = allocations[spec.id] ?? 0,
      used = currentUsed(system.resourceUses?.[spec.id], session);
    if (!Number.isSafeInteger(count) || count < 0 || used === null || used + count > spec.limit)
      throw new Error("Allocate whole-number past uses within each source’s remaining allowance.");
    total += count;
    record[spec.id] = count;
    if (count) updates[`system.resourceUses.${spec.id}`] = { epoch: session, used: used + count };
  }
  if (total !== status.legacyUsed)
    throw new Error("Allocated past uses must equal the old combined Bright Idea count.");
  const before = system.resourceUses?.brightIdeaLegacyMigration?.history ?? [];
  updates["system.resourceUses.brightIdeaLegacyMigration"] = {
    history: [...before, { epoch: session, used: status.legacyUsed, allocations: record, at, reviewedBy }]
  };
  updates["system.resourceUses.-=brightIdea"] = null;
  return { updates, allocations: record, used: total, session };
}

/** Review the old malformed aggregate first; source allocation remains a separate required step. */
export function brightIdeaLegacyReviewSpec(system, periods = system.usagePeriods) {
  const status = brightIdeaPoolStatus(system, periods);
  return status.pending && status.legacyUsed === null
    ? {
        id: "brightIdea",
        name: "Legacy combined Bright Idea count (before source allocation)",
        period: "session",
        limit: status.sources.reduce((n, s) => n + s.limit, 0),
        cost: 0,
        workflow: "legacyBrightIdeaReview"
      }
    : null;
}
