/** Change one explicitly reviewed condition, preserving independent effect data and item-owned sources. */
export async function setConditionStatus(actor, id, active, { label = id, aliases = [], operationId = null } = {}) {
  if (
    typeof active !== "boolean" ||
    typeof id !== "string" ||
    !id ||
    !Array.isArray(aliases) ||
    aliases.some(a => typeof a !== "string" || !a)
  )
    throw new Error("Choose the condition state.");
  const ids = new Set([id, ...aliases]),
    hasStatus = effect => [...ids].some(key => effect.statuses?.has(key));
  const before = [...ids].some(key => actor.statuses?.has(key));
  if (before === active) return { active, changed: false };
  const own = [...(actor.effects ?? [])],
    applied = actor.appliedEffects ?? own.filter(e => e.active ?? (!e.disabled && !e.isSuppressed));
  if (!active && applied.some(e => hasStatus(e) && !own.includes(e)))
    throw new Error(
      label + " is still supplied by an item or another source. Review that source before clearing the condition."
    );
  if (active) {
    const status = globalThis.CONFIG?.statusEffects?.find(e => e.id === id);
    if (!status) throw new Error("This condition is not configured.");
    const operation = operationId ?? globalThis.foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2);
    try {
      const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [
        {
          name: globalThis.game?.i18n?.localize(status.name) ?? label,
          img: status.img,
          statuses: [id],
          flags: { spycraft2: { conditionOperation: operation } }
        }
      ]);
      if (!effect || !actor.statuses?.has(id)) throw new Error("The condition was not applied.");
      return { active: true, changed: true, effectId: effect.id };
    } catch (error) {
      const created = [...(actor.effects ?? [])]
        .filter(e => e.flags?.spycraft2?.conditionOperation === operation)
        .map(e => e.id);
      if (created.length)
        try {
          await actor.deleteEmbeddedDocuments("ActiveEffect", created);
        } catch (rollback) {
          throw new AggregateError(
            [error, rollback],
            "Condition creation could not be rolled back; review its current status before retrying."
          );
        }
      throw error;
    }
  }
  const matching = own.filter(e => (e.active ?? (!e.disabled && !e.isSuppressed)) && hasStatus(e));
  if (!matching.length)
    throw new Error(label + " has no directly editable status source. Review its originating effect.");
  const updates = [],
    removed = [];
  for (const effect of matching) {
    const data = effect.toObject(),
      statuses = [...effect.statuses].filter(s => !ids.has(s));
    if (!statuses.length && !(effect.changes ?? data.changes ?? []).length) removed.push(data);
    else updates.push({ effect, before: [...effect.statuses], after: statuses });
  }
  const deleted = [];
  try {
    if (updates.length)
      await actor.updateEmbeddedDocuments(
        "ActiveEffect",
        updates.map(row => ({ _id: row.effect.id, statuses: row.after }))
      );
    for (const data of removed) {
      await actor.deleteEmbeddedDocuments("ActiveEffect", [data._id]);
      deleted.push(data);
    }
    if ([...ids].some(key => actor.statuses?.has(key)))
      throw new Error(label + " remains supplied by another active source. Review that source.");
    return { active: false, changed: true };
  } catch (error) {
    const failures = [];
    // Restore just statuses, preserving independent attribute/metadata edits made meanwhile.
    for (const row of updates) {
      const current = actor.effects.get?.(row.effect.id) ?? [...actor.effects].find(e => e.id === row.effect.id);
      if (current) {
        const now = [...current.statuses];
        if (JSON.stringify(now) === JSON.stringify(row.after))
          try {
            await actor.updateEmbeddedDocuments("ActiveEffect", [{ _id: current.id, statuses: row.before }]);
          } catch (e) {
            failures.push(e);
          }
        else if (JSON.stringify(now) !== JSON.stringify(row.before))
          failures.push(new Error("The condition source changed again; preserve it for review."));
      }
    }
    // Also reconcile a deletion which committed before its caller reported failure.
    for (const data of removed)
      if (![...actor.effects].some(e => e.id === data._id) && !deleted.some(e => e._id === data._id))
        deleted.push(data);
    if (deleted.length)
      try {
        await actor.createEmbeddedDocuments("ActiveEffect", deleted, { keepId: true });
      } catch (e) {
        failures.push(e);
      }
    if (failures.length)
      throw new AggregateError(
        [error, ...failures],
        "Condition removal could not be fully restored; review its sources before retrying."
      );
    throw error;
  }
}
