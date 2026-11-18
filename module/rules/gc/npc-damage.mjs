/**
 * Standard NPC and animal Damage saves (pp.331–332, 452).
 * Damage accumulates through the scene until a save fails; DC = 10 + half the accumulated damage.
 */
import { GC_DATA } from "../gc-tables.mjs";

const R = GC_DATA.core.npcDamageSave;
const whole = value => Number.isSafeInteger(value) && value >= 0;

export const emptyDamageTrack = () => ({
  accumulated: 0,
  failures: 0,
  ignored: 0,
  scene: null,
  state: "active",
  last: null
});

/** A new scene clears lingering damage and the failures Tough has absorbed. */
export function currentDamageTrack(track, scene) {
  const now = String(scene ?? "initial");
  if (!track || track.scene !== now)
    return {
      ...emptyDamageTrack(),
      scene: now,
      state: track?.state && track.state !== "active" ? track.state : "active"
    };
  return { ...emptyDamageTrack(), ...track };
}

/** p.452: vitality/wound changes move a standard NPC's Damage save by +1 per wound or per 2 vitality. */
export function damageSaveAdjustment({ wounds = 0, vitality = 0 } = {}) {
  return Math.trunc(wounds / R.woundsPerBonus) + Math.trunc(vitality / R.vitalityPerBonus);
}

export function damageSaveDC(accumulated) {
  if (!whole(accumulated)) throw new Error("Enter the damage as a whole number.");
  return R.baseDC + Math.floor(accumulated / 2);
}

/**
 * Resolve one injury.
 *  damage    – points suffered after DR and other reductions (1+)
 *  kind      – 'lethal', 'subdual' or 'stress'
 *  blast     – the damage has a blast increment: +1 failed save per full 10 points the save misses by
 *  criticalDice – action dice spent to activate a critical hit: that many automatic extra failures
 *  tough     – grades of the tough quality: failed saves ignored per scene
 */
export function resolveDamageSave(
  track,
  { damage, kind = "lethal", bonus, roll, blast = false, criticalDice = 0, tough = 0 }
) {
  if (!whole(damage) || damage < 1) throw new Error("A Damage save needs at least 1 point of damage.");
  if (!["lethal", "subdual", "stress"].includes(kind)) throw new Error("Choose lethal, subdual or stress damage.");
  if (!Number.isSafeInteger(bonus) || !Number.isSafeInteger(roll) || roll < 1 || roll > 20)
    throw new Error("Enter the Damage save bonus and a d20 roll.");
  if (!whole(criticalDice) || !whole(tough)) throw new Error("Enter whole numbers for critical dice and tough grades.");
  if (track.state !== "active")
    throw new Error("This NPC is already out of the fight. Reset its Damage save track first.");
  const accumulated = track.accumulated + damage,
    dc = damageSaveDC(accumulated),
    total = roll + bonus;
  const margin = dc - total,
    failed = total < dc;
  let failures = failed ? 1 : 0;
  if (failed && blast) failures += Math.floor(margin / R.blastStep);
  failures += criticalDice; // automatic, in addition to any the roll produced
  const toughLeft = Math.max(0, tough - track.ignored),
    ignored = Math.min(toughLeft, failures),
    effective = failures - ignored;
  const down = effective > 0;
  const state = !down ? "active" : kind === "lethal" ? "dead" : "unconscious";
  return {
    dc,
    total,
    roll,
    bonus,
    margin,
    failed,
    failures,
    ignored,
    effective,
    state,
    // Damage lingers until a save fails or the scene ends.
    track: {
      ...track,
      accumulated: failures > 0 ? 0 : accumulated,
      failures: track.failures + failures,
      ignored: track.ignored + ignored,
      state,
      last: { damage, kind, dc, total, failures, ignored }
    }
  };
}

/** Standard characters heal by reducing accumulated damage by the action die result (p.333). */
export function healDamageTrack(track, amount) {
  if (!whole(amount)) throw new Error("Enter the healing as a whole number.");
  return { ...track, accumulated: Math.max(0, track.accumulated - amount) };
}
