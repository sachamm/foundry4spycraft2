import { readiedMeleeWeapons } from "./readied-weapons.mjs";
const stable = v =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map(k => [k, x[k]])
        )
      : x
  );
/** A legal replacement can undo only destruction caused by its original error.
 * Normalize a local view for source checks; never repair inventory before settlement.
 */
export function readiedItemsForCheck(actor, { rerollOf, disarm, cheapShot } = {}) {
  let items = Array.from(actor.items ?? []);
  const lists = [disarm?.fencingBasics?.weapons, disarm?.axeBasics?.source?.weapons, cheapShot?.flailBasics?.weapons],
    sources = [disarm?.source, ...lists.flatMap(list => (Array.isArray(list) ? list : []))],
    nullUuids = new Set(sources.filter(w => w && typeof w.id === "string" && w.uuid === null).map(w => w.id));
  // computeAgent intentionally receives local Item identities without UUIDs.
  // Preserve that representation only for an original null marker. Non-null
  // UUIDs still compare exactly, and the owning actor scopes every local ID.
  const canonical = list =>
    list.map(item =>
      nullUuids.has(item.id ?? item._id)
        ? { id: item.id ?? item._id, uuid: null, name: item.name, type: item.type, system: item.system }
        : item
    );
  if (typeof rerollOf !== "string" || !rerollOf || typeof globalThis.fromUuidSync !== "function")
    return canonical(items);
  const message = fromUuidSync(rerollOf),
    c = message?.flags?.spycraft2;
  if (
    !message ||
    c?.actorUuid !== actor.uuid ||
    c.checkKind !== "attack" ||
    c.improvised !== true ||
    c.errorConfirmed !== true ||
    c.criticalFailure ||
    c.resolved ||
    c.superseded ||
    (cheapShot
      ? stable(c.attackContext?.cheapShot) !== stable(cheapShot)
      : stable(c.attackContext?.disarm) !== stable(disarm))
  )
    return canonical(items);
  items = items.map(item =>
    item.uuid === c.weaponUuid &&
    item.type === "weapon" &&
    item.system.improvised === true &&
    item.system.destroyed === true &&
    item.system.destroyedByRoll === (message.uuid ?? message.id)
      ? {
          id: item.id ?? item._id,
          uuid: item.uuid,
          name: item.name,
          type: item.type,
          system: { ...item.system, destroyed: false }
        }
      : item
  );
  return canonical(items);
}
export function disarmMeleeSystemForCheck(actor, options = {}) {
  return {
    ...actor.system,
    readiedMeleeWeapons: readiedMeleeWeapons(
      actor.system,
      readiedItemsForCheck(actor, { rerollOf: options.rerollOf, disarm: options.attackContext?.disarm })
    )
  };
}
