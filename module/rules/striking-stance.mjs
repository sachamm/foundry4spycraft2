import { combatStanceState } from "./combat-stance.mjs";
import { stanceMovementState } from "./stance-movement.mjs";
import { validOwnCountClock } from "./own-count-duration.mjs";
import { loc } from "../i18n.mjs";
export const stableStriking = v =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x
  );
export const strikingActorStats = s => ({
  bab: s.bab ?? null,
  sizeModifier: s.sizeModifier ?? null,
  abilities: Object.fromEntries(
    ["str", "dex"].map(k => [k, { value: s.abilities?.[k]?.value ?? null, mod: s.abilities?.[k]?.mod ?? null }])
  ),
  conditions: s.conditionContext ?? {},
  feats: s.activeFeatNames ?? [],
  classes: s.classLevels ?? {}
});
export function strikingTriggerPlan(
  system,
  combat,
  {
    activeCombatantId,
    entryConfirmed = false,
    alreadyInStanceConfirmed = false,
    immediateConfirmed = false,
    roundMovementConfirmed = false,
    attackLegalConfirmed = false,
    entryDescription = ""
  } = {}
) {
  const stance = combatStanceState(system);
  if (stance?.key !== "striking" || !Number.isFinite(system.combatStance?.enteredAt))
    throw Error(loc`Enter the earned Striking Stance before the opponent moves into adjacency.`);
  if (!validOwnCountClock(combat) || typeof activeCombatantId !== "string" || !activeCombatantId)
    throw Error(loc`Take the immediate Striking reaction in its actual started combat and active participant’s Count.`);
  if (
    [entryConfirmed, alreadyInStanceConfirmed, immediateConfirmed, roundMovementConfirmed, attackLegalConfirmed].some(
      v => v !== true
    ) ||
    typeof entryDescription !== "string" ||
    entryDescription.length > 300
  )
    throw Error(
      loc`The GC must confirm this actual opponent just entered adjacency while you were already in this stance, the immediate legal melee final attack and all completed round movement.`
    );
  const movement = stanceMovementState(system, combat);
  if (movement.feet > 5)
    throw Error(
      loc`Striking Stance permits no more than5ft movement during any round. Review all completed movement before reacting.`
    );
  return {
    version: 1,
    stance,
    stanceEnteredAt: system.combatStance.enteredAt,
    combat: structuredClone(combat),
    activeCombatantId,
    movementAtTrigger: { key: movement.key, feet: movement.feet },
    entryConfirmed: true,
    alreadyInStanceConfirmed: true,
    immediateConfirmed: true,
    roundMovementConfirmed: true,
    attackLegalConfirmed: true,
    entryDescription: entryDescription.trim()
  };
}
export function strikingTimingMatches(original, current) {
  return (
    validOwnCountClock(original) &&
    validOwnCountClock(current) &&
    original.id === current.id &&
    original.round === current.round &&
    original.combatantId === current.combatantId
  );
}
export function strikingTriggerFacts(p) {
  if (!p?.combat) return p;
  const { turn, ownTurnIndex, ...combat } = p.combat;
  return { ...p, combat };
}
