/**
 * The dice term for one action die (p.61): it explodes on its explode threshold. Under Bleak a player character's
 * action dice never explode; under Spirited they also explode on a natural 1 (pp.406, 408). Both flags are set on
 * `system.actionDice` by the engine.
 */
export function actionDieTerm(die, explodeAt = die, actionDice = {}) {
  if (actionDice?.explodes === false) return `1d${die}`;
  return `1d${die}x>=${explodeAt ?? die}${actionDice?.explodeLow === true ? "x=1" : ""}`;
}
