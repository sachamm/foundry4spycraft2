import { stanceMovementState, stanceMovementReviewPlan } from "../rules/stance-movement.mjs";
import { queueRuleState } from "./rule-resource-scope.mjs";
export const stanceMovementSystem = actor => ({
  ...actor.system,
  worldTime: globalThis.game?.time?.worldTime ?? actor.system.worldTime ?? 0
});
const number = value => (typeof value === "string" && value.trim() ? Number(value) : value);
export function stanceMovementSummary(actor) {
  return stanceMovementState(stanceMovementSystem(actor), actor.mentalLeapCombatContext?.() ?? null);
}
export async function reviewStanceMovement(actor, input = {}) {
  if (actor.type !== "agent" || !actor.isOwner) throw Error("Only an owner may review this agent’s round movement.");
  if (!Object.hasOwn(input, "roundMovementFeet")) {
    const state = stanceMovementSummary(actor);
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "Record round movement" },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>Record the total distance this character has already moved in the current round, including earlier movement before entering a stance. Repeating the same total does not spend movement again. Returning to normal and re-entering a stance does not erase this total.</p><p>${state.cappedActive ? state.stanceName + ": " + state.limitFeet + " ft. maximum this round; " + state.remainingFeet + " ft. remains." : "No active stance movement cap. A capped stance cannot be entered after exceeding its round movement limit."}</p><label>Total distance already moved this round (ft.) <input name="roundMovementFeet" type="number" min="${state.feet}" step="any" value="${state.feet}" required /></label><label><input name="roundMovementConfirmed" type="checkbox" /> The GC confirms this total includes all completed movement this round</label><p>This records completed movement; check routes, move tokens and spend their actions at the table. A declared route check does not itself move the character or increase this total.</p></div>`
    });
    if (!input) return null;
  }
  return queueRuleState(actor, async () => {
    const record = stanceMovementReviewPlan(stanceMovementSystem(actor), {
      combat: actor.mentalLeapCombatContext?.() ?? null,
      totalFeet: number(input.roundMovementFeet),
      confirmed: input.roundMovementConfirmed,
      enteringSide: input.enteringSide === true
    });
    await actor.update({ "system.stanceRoundMovement": record });
    return record;
  });
}
