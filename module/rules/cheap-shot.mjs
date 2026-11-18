import { weaponUnavailable } from "./gear.mjs";
import { ownedWeaponTraining } from "./weapon-training.mjs";
import { readiedMeleeFeatSource, readiedMeleeWeapons } from "./readied-weapons.mjs";
import { readiedDisarmWeapons } from "./disarm-response.mjs";
import { readiedItemsForCheck } from "./readied-replacement.mjs";
import { cheapShotScene } from "./cheap-shot-effects.mjs";
import { validOwnCountClock } from "./own-count-duration.mjs";
export const CHEAP_SHOT_CHOICES = ["str", "dex", "con", "int", "wis", "cha", "speed"];
/** p.355 Standard Attack plus a free-action trick, not a separate attack action. */
export function cheapShotPlan(
  system,
  weapon,
  {
    action = "standard",
    ranged = false,
    context,
    combat = null,
    freeFinalAttack = false,
    disarm = false,
    fireMode = null
  } = {}
) {
  const empty = { active: false, attackBonus: 0, errorIncrease: 0, notes: [] };
  if (!context) return empty;
  const reject = reason => ({ ...empty, active: true, blocked: true, reason });
  if (
    weapon.equipped !== true ||
    weapon.carried === false ||
    weapon.reserve ||
    !Number.isSafeInteger(weapon.quantity ?? 1) ||
    (weapon.quantity ?? 1) < 1 ||
    weaponUnavailable(weapon)
  )
    return reject("Cheap Shot requires the actual available readied attack weapon.");
  if (fireMode !== null && fireMode !== "single") return reject("Cheap Shot uses a Single-Shot Standard Attack.");
  if (action !== "standard" || disarm)
    return reject(
      "Cheap Shot requires a Standard Attack with its trick; review combinations with other action workflows separately."
    );
  if (!validOwnCountClock(combat) || (!freeFinalAttack && combat.turn !== combat.ownTurnIndex))
    return reject("Take Cheap Shot during your Initiative Count in a started combat.");
  if (
    !CHEAP_SHOT_CHOICES.includes(context.choice) ||
    typeof context.targetUuid !== "string" ||
    !context.targetUuid.trim() ||
    context.targetUuid.length > 200 ||
    typeof context.targetName !== "string" ||
    !context.targetName.trim() ||
    context.targetName.length > 200 ||
    context.confirmed !== true ||
    context.eligibleConfirmed !== true
  )
    return reject(
      "Choose the actual opponent and one attribute or Speed before rolling; confirm a legal Standard Attack/free action and no previous successful Cheap Shot against this target this scene."
    );
  let flailBasics = null;
  try {
    if (!ranged) {
      flailBasics = readiedMeleeFeatSource(system, { name: "Flail Basics", family: "flail", bonus: 2 });
      if (flailBasics) {
        const ready = system.disarmWeapons;
        if (
          !ready ||
          ready.blockedReason ||
          flailBasics.weapons.some(w => !ready.weapons.some(r => r.id === w.id && r.hands === w.hands))
        )
          throw Error(ready?.blockedReason || "Review the actual held flail and grip.");
      }
    }
  } catch (e) {
    return reject(e.message);
  }
  return {
    version: 1,
    active: true,
    madeAt: system.worldTime ?? 0,
    scene: cheapShotScene(system),
    finalAttack: freeFinalAttack,
    weaponId: weapon.id ?? null,
    choice: context.choice,
    targetUuid: context.targetUuid.trim(),
    targetName: context.targetName.trim(),
    confirmed: true,
    eligibleConfirmed: true,
    combat: structuredClone(combat),
    ranged,
    flailBasics,
    gearBonus: flailBasics ? 2 : 0,
    attackBonus: -4 + (flailBasics ? 2 : 0),
    errorIncrease: 1,
    notes: [
      `Cheap Shot: Standard Attack plus one free action; attack −4, action error+1; chosen ${context.choice} against ${context.targetName} (p.355).`,
      ...(flailBasics
        ? ["Flail Basics: +2 gear with this melee Cheap Shot attack while holding a reviewed readied flail (p.178)."]
        : []),
      "On a miss, the attacker becomes flat-footed. On a hit, apply −2 to attack/skill checks keyed to the chosen attribute or −10 ft. Speed. The effect ends with the scene or a successful Fortitude save (DC20 −2 per minute since this attack; at most one attempt per minute). Only one successful Cheap Shot may affect a combatant per scene."
    ]
  };
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
export function validateCheapShotProof(
  actor,
  proof,
  { checkKind, weaponUuid, weaponProficiency, attackContext = {}, rerollOf, combat, finalAttack = false } = {}
) {
  if (!proof) return;
  const item = actor.items?.get?.(proof.weaponId) ?? actor.items?.find?.(i => i.id === proof.weaponId);
  if (checkKind !== "attack" || !item || item.type !== "weapon" || (weaponUuid && item.uuid !== weaponUuid))
    throw Error("The Cheap Shot attack weapon changed.");
  const trainedSource = ownedWeaponTraining(actor, proof, { checkKind, weaponUuid, weaponProficiency, attackContext });
  const items = readiedItemsForCheck(actor, { rerollOf, cheapShot: proof }),
    source = items.find(i => (i.id ?? i._id) === proof.weaponId) ?? item,
    system = {
      ...actor.system,
      worldTime: proof.madeAt,
      readiedMeleeWeapons: readiedMeleeWeapons(actor.system, items),
      disarmWeapons: readiedDisarmWeapons(actor.system, items)
    },
    ranged = !["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(weaponProficiency),
    p = cheapShotPlan(
      system,
      { ...source.system, id: item.id, proficiency: trainedSource.operatingProficiency },
      {
        context: proof,
        action: attackContext.attackAction,
        ranged,
        combat,
        freeFinalAttack: finalAttack,
        fireMode: attackContext.fireMode
      }
    );
  if (p.blocked || stable(p) !== stable(proof))
    throw Error("The Cheap Shot choice, actual held flail, qualified feat or Initiative Count changed before posting.");
}
