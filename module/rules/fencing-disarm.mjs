import { readiedItemsForCheck } from "./readied-replacement.mjs";
import { readiedDisarmWeapons, readiedMeleeFeatSource, readiedMeleeWeapons } from "./readied-weapons.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
/** Fencing Basics p.178: current qualified feat plus a readied 1h FIN sword.
 * Shared ready-source proof for melee Disarm and Feint; stance/trick are separate.
 */
export function fencingDisarmPlan(system, { ranged = false } = {}) {
  if (typeof ranged !== "boolean") throw Error(loc`Review the actual melee/ranged Disarm check.`);
  if (ranged) return null;
  const weapons = system.readiedMeleeWeapons ?? [];
  if (!Array.isArray(weapons)) throw Error(loc`Review the current readied sword sources.`);
  const source = readiedMeleeFeatSource(
    { ...system, readiedMeleeWeapons: weapons.filter(w => w?.family !== "oneHandedSword" || w.finesse === true) },
    { name: "Fencing Basics", family: "oneHandedSword", bonus: 2 }
  );
  if (!source) return null;
  const ready = system.disarmWeapons;
  if (!ready || ready.blockedReason)
    throw Error(ready?.blockedReason || loc`Prepare the actual held weapons for Fencing Basics.`);
  if (source.weapons.some(w => !ready.weapons.some(r => r.id === w.id && r.hands === w.hands)))
    throw Error(loc`The Fencing Basics sword is not physically held with this grip.`);
  return { ...source, gearBonus: 2 };
}
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
export function validateFencingDisarmProof(actor, disarm, { checkKind, weaponProficiency, rerollOf } = {}) {
  if (!disarm || !Object.hasOwn(disarm, "fencingBasics")) return;
  const items = readiedItemsForCheck(actor, { rerollOf, disarm }),
    melee = ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(weaponProficiency),
    system = {
      ...actor.system,
      readiedMeleeWeapons: readiedMeleeWeapons(actor.system, items),
      disarmWeapons: readiedDisarmWeapons(actor.system, items)
    };
  if (
    checkKind !== "attack" ||
    disarm.active !== true ||
    stable(fencingDisarmPlan(system, { ranged: !melee })) !== stable(disarm.fencingBasics)
  )
    throw Error(
      loc`The qualified Fencing Basics, readied one-handed sword or effective FIN quality changed before posting.`
    );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "fencingDisarm",
  order: 1310,
  validate: ({ actor, options, checkKind }) =>
    validateFencingDisarmProof(actor, options.attackContext?.disarm, {
      checkKind,
      weaponProficiency: options.weaponProficiency,
      rerollOf: options.rerollOf
    })
});
