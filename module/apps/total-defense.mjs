import { expertiseCombatContext } from "./combat-expertise.mjs";
import { combatMovementRules } from "../rules/combat-movement.mjs";
import { totalDefensePlan, equilibriumTotalDefenseBonus } from "../rules/total-defense.mjs";
import { queueResources } from "../services/transactions.mjs";
import { loc } from "../i18n.mjs";
const same = (a, b) =>
  JSON.stringify(a, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x
  ) ===
  JSON.stringify(b, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x
  );
export async function takeTotalDefense(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  const expected = JSON.stringify(expertiseCombatContext(actor));
  let input = options;
  const equilibrium = equilibriumTotalDefenseBonus(actor.system);
  if (equilibrium.blockedReason) throw new Error(equilibrium.blockedReason);
  if (!Object.hasOwn(input, "actionConfirmed")) {
    const rules = combatMovementRules(actor.system);
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Take Total Defense` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Spend one full action during your Initiative Count to gain +${4 + equilibrium.bonus} dodge Defense${equilibrium.bonus ? loc` (Total Defense +4, Equilibrium Basics +${equilibrium.bonus})` : ""} until the start of your next Initiative Count. You may make one Standard Move, up to ${rules.totalDefenseMoveFeet ?? "unresolved"} counted ft. Resolve token movement at the table; this control applies the timed Defense benefit.`}</p><label>${loc`Included counted movement (ft.; zero if stationary)`} <input name="distanceFeet" type="number" min="0" value="0" step="any" /></label><label><input name="adjacentThreateningOpponent" type="checkbox" /> ${loc`Starting adjacent to a threatening opponent`}</label><label><input name="passesThreateningAdjacency" type="checkbox" /> ${loc`Movement continues after entering threatening adjacency`}</label><label><input name="routeConfirmed" type="checkbox" /> ${loc`The GC confirms the route, counted distance, terrain and threatening opponents`}</label><label><input name="actionConfirmed" type="checkbox" /> ${loc`I spend the available full action for Total Defense`}</label></div>`
    });
    if (!input) return null;
  }
  return queueResources([actor], async () => {
    if (!actor.isOwner) throw new Error(loc`You must own the character.`);
    const combat = expertiseCombatContext(actor);
    if (JSON.stringify(combat) !== expected)
      throw new Error(loc`The Initiative Count changed. Declare Total Defense again.`);
    if (!same(equilibriumTotalDefenseBonus(actor.system), equilibrium))
      throw new Error(loc`The Equilibrium Basics source or Covert count changed. Declare Total Defense again.`);
    const distanceFeet =
      typeof input.distanceFeet === "string" && input.distanceFeet.trim()
        ? Number(input.distanceFeet)
        : input.distanceFeet;
    const record = {
      ...totalDefensePlan(actor.system, combat, { ...input, distanceFeet }),
      id: foundry.utils.randomID()
    };
    const patch = {
      "system.totalDefense": record,
      ...(!record.equilibrium && actor.system.totalDefense?.equilibrium
        ? { "system.totalDefense.-=equilibrium": null }
        : {})
    };
    try {
      await actor.update(patch);
    } catch (error) {
      if (!same(actor.system.totalDefense, record)) throw error;
    }
    try {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: loc`Total Defense: +${4 + (record.equilibrium?.bonus ?? 0)} dodge Defense at declaration${record.equilibrium ? loc` (Total Defense +4, Equilibrium Basics +${record.equilibrium.bonus})` : ""} until the start of own Initiative Count in round ${record.dueRound}. Full action declared; included Standard Move ${record.movement.distanceFeet} / ${record.movement.maximumFeet} counted ft., movement resolved at the table. Dodge is lost when vulnerable.`,
        flags: {
          spycraft2: {
            actorUuid: actor.uuid,
            checkKind: "totalDefense",
            actionDiceAllowed: false,
            totalDefense: record
          }
        }
      });
    } catch (error) {
      ui.notifications.warn(
        loc`Total Defense is active, but its chat notice could not be confirmed. Review the character sheet before declaring another use.`
      );
    }
    return record;
  });
}
