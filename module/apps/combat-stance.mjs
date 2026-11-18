import {
  preparePowerStanceEntry,
  powerStanceExitPatch,
  reconcilePowerStanceInitiative,
  powerCountEntryNeedsConfirmation
} from "./power-stance.mjs";
import { settleStanceDamage, manageStanceDamage } from "./stance-damage.mjs";
import { stanceMovementSummary, stanceMovementSystem } from "./stance-movement.mjs";
import { stanceMovementReviewPlan } from "../rules/stance-movement.mjs";
import { queueRuleState } from "./rule-resource-scope.mjs";
import {
  COMBAT_STANCES,
  combatStanceState,
  combatStanceDeclaration,
  stanceForcedExit
} from "../rules/combat-stance.mjs";
import { queueResources } from "../rules/transactions.mjs";
import { loc } from "../i18n.mjs";
export function combatStanceContent(actor) {
  const esc = foundry.utils.escapeHTML,
    current = combatStanceState(actor.system),
    movement = stanceMovementSummary(actor);
  return `<div class="spycraft2-roll-options"><p>${loc`Current stance: ${esc(current?.name ?? loc`Normal`)}. Entering a stance costs one half action; returning to normal is free. Only one stance applies. Helpless, prone, sprawled or any non-melee attack immediately ends it (p.177).`}</p><label>${loc`Stance`} <select name="stance"><option value="normal">${loc`Normal stance`}</option>${Object.entries(
    COMBAT_STANCES
  )
    .filter(([, s]) => actor.system.activeFeatNames?.includes(s.feat))
    .map(([key, s]) => `<option value="${key}">${esc(s.name)}</option>`)
    .join(
      ""
    )}</select></label><p>${loc`Power Stance: Initiative Count increases by your current Strength score while active; at most 10 ft. movement during any round. Existing tracked Counts change only by the verified stance component. An uncertain Count requires GC review.`}</p><p>${loc`Driving Stance: each successful melee hit pushes its opponent 5 ft. away; an occupied or blocked destination causes 1d4 subdual instead. After a push you may move 5 ft. toward that opponent. Use Driving Stance outcome to record the reviewed route or damage.`}</p><p>${loc`Menacing Stance: each qualifying melee hit inflicts an additional 2 stress damage. Record its separate component through Stance damage; resolve the target’s stress defenses separately.`}</p><p>${loc`Punishing Stance: each melee attack inflicts an additional 2 subdual damage. After resolving a hit, use Punishing Stance damage to record its separate component.`}</p><p>${loc`Side Stance: Defense −1 and at most20 ft. movement per round. A successful Feint made while already in this stance grants one pending sneak die total. The next attack against an eligible Feinted opponent spends it even on a miss. Leaving discards an unused die. Use the recorded successful Standard Attack when rolling its sneak damage.`}</p><p>${loc`Striking Stance: once per round, an opponent entering an adjacent square may prompt one immediate melee final Standard Attack with any legal melee weapon. The shared final-attack allowance applies. At most5ft movement during any round; use Striking reaction after the GC confirms the actual entry (p.179).`}</p><p>${loc`Whirling Stance: characters with lower career levels cannot flank you. Equal or higher levels use ordinary flanking rules. It grants no unconditional Defense bonus and requires no held staff (p.179).`}</p><p>${loc`Gripping Stance: use a two-handed weapon in one hand, with −2 on attack checks when doing so (p.179). A non-melee attack immediately ends the stance and uses the normal grip restrictions.`}</p><p>${loc`Stalking Stance: +3 to Sneak checks made while participating in started combat; at most20 ft. movement per round (p.179).`}</p><p>${loc`Circling Stance: on a melee attack made with an empty square next to you, the target keeps only half its dodge bonus to Defense (rounded up); select this attacker in the target’s Incoming attack preview. Following the attack you automatically move into an unoccupied adjacent square of your choice; the GC confirms the square (p.179).`}</p><p>${loc`Furious Stance: at the end of each round in this stance, your Initiative Count rises by the number of melee attacks you made that round. The GC’s client counts your posted melee attacks when the round advances (p.177).`}</p><p>${loc`Unbeatable Stance: +1 morale bonus to attack checks against an opponent your melee weapons have already damaged this combat; tick it in the attack dialog for the GC to confirm. Lost while you wield a finesse weapon (p.180).`}</p><p>${loc`Shifting Stance: your unarmed attacks halve the target’s dodge bonus to Defense, rounded up (select this attacker in the target’s Incoming attack preview); on a threat or critical hit you may move to the far side of the opponent (p.186).`}</p><p>${loc`Closed Stance: you may end your movement in an opponent’s square; sharing it, you are adjacent, have DR 2/— against their attacks and +2 unarmed damage against them (ask on the damage roll), and they take no bonus 5-ft. steps (p.184).`}</p><p>${loc`Open Stance: once per round, when an opponent within your Reach misses you, you may pull them into your square and at once Grapple or Trip them as a free action (the GC offers it on the miss). No Run actions in this stance (p.189).`}</p><p>${loc`Ready Stance: when you hit a target with an unarmed attack, it suffers −2 to attack checks until the end of the round (p.185).`}</p><p>${loc`Forward Stance: each hit raises your Initiative Count by 1 (offered on the card); move only with Acrobatics/Jump checks or your bonus 5-ft. step (p.187).`}</p><p>${loc`Rooted Stance: +1 to all saves; you may not leave your square, even when forced to move (p.187).`}</p><p>${loc`Prone Stance: +1 to skill checks made in a Grapple, no attack penalty for being prone, sprawled effects make you prone instead, and becoming prone does not end the stance (p.188).`}</p>${actor.system.activeFeatNames?.includes("Great Sword Basics") && powerCountEntryNeedsConfirmation(actor) ? `<label><input type="checkbox" name="powerCountConfirmed" /> ${loc`For first Power Stance entry, the GC confirms the existing Count contains no Power Stance bonus`}</label>` : ""}${Object.values(COMBAT_STANCES).some(s => s.movementLimitFeet && actor.system.activeFeatNames?.includes(s.feat)) ? `<label>${loc`Total distance already moved this round (ft.; required for a stance with a movement cap)`} <input name="roundMovementFeet" type="number" min="${movement.feet}" step="any" value="${movement.feet}" /></label><label><input name="roundMovementConfirmed" type="checkbox" /> ${loc`The GC confirms this total includes all movement earlier in this round`}</label>` : ""}<label><input type="checkbox" name="halfActionConfirmed" /> ${loc`I spend one half action to enter this stance`}</label><label><input type="checkbox" name="legalConfirmed" /> ${loc`This stance action is legal now`}</label></div>`;
}
export async function declareCombatStance(actor, input = {}) {
  if (!actor.isOwner || actor.type !== "agent") throw Error(loc`Only an owner may change this agent’s stance.`);
  if (!Object.hasOwn(input, "stance")) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Combat stance` },
      rejectClose: false,
      content: combatStanceContent(actor)
    });
    if (!input) return null;
  }
  return queueResources([actor], async () => {
    const beforeCombat = actor.mentalLeapCombatContext(),
      beforePlan = combatStanceDeclaration(actor.system, input.stance, { ...input, combat: beforeCombat });
    if (COMBAT_STANCES[beforePlan?.key]?.movementLimitFeet) {
      const total =
        typeof input.roundMovementFeet === "string" && input.roundMovementFeet.trim()
          ? Number(input.roundMovementFeet)
          : input.roundMovementFeet;
      stanceMovementReviewPlan(stanceMovementSystem(actor), {
        combat: beforeCombat,
        totalFeet: total,
        confirmed: input.roundMovementConfirmed,
        enteringStance: beforePlan.key
      });
    }
    await preparePowerStanceEntry(actor, input);
    const result = await queueRuleState(actor, async () => {
      const combat = actor.mentalLeapCombatContext(),
        plan = combatStanceDeclaration(actor.system, input.stance, { ...input, combat }),
        record = plan ? { ...plan, id: foundry.utils.randomID(), enteredAt: game.time.worldTime } : null,
        updates = { ...powerStanceExitPatch(actor), "system.combatStance": record };
      if (COMBAT_STANCES[plan?.key]?.movementLimitFeet) {
        const total =
          typeof input.roundMovementFeet === "string" && input.roundMovementFeet.trim()
            ? Number(input.roundMovementFeet)
            : input.roundMovementFeet;
        updates["system.stanceRoundMovement"] = stanceMovementReviewPlan(stanceMovementSystem(actor), {
          combat,
          totalFeet: total,
          confirmed: input.roundMovementConfirmed,
          enteringStance: plan.key
        });
      }
      await actor.update(updates);
      return record;
    });
    await reconcilePowerStanceInitiative(actor);
    return result;
  });
}
/** Forced exits also run inside already-held attack/resource transactions. */
export async function endCombatStance(actor, expectedId) {
  if (!actor.isOwner || !expectedId || actor.system.combatStance?.id !== expectedId) return null;
  const result = await queueRuleState(actor, async () => {
    if (actor.system.combatStance?.id !== expectedId) return null;
    await actor.update({ ...powerStanceExitPatch(actor), "system.combatStance": null });
    return true;
  });
  if (result) await reconcilePowerStanceInitiative(actor);
  return result;
}
export function installCombatStanceHooks() {
  const check = doc => {
    const actor = doc?.documentName === "Actor" ? doc : doc?.parent;
    if (actor?.documentName !== "Actor" || !actor.isOwner || !actor.system.combatStance?.id) return;
    const record = actor.system.combatStance;
    if (stanceForcedExit(actor.system) || !combatStanceState(actor.system))
      return endCombatStance(actor, record.id).catch(error =>
        ui.notifications.error(loc`Combat stance exit needs review: ${error.message}`)
      );
  };
  for (const name of [
    "updateActor",
    "createActiveEffect",
    "updateActiveEffect",
    "deleteActiveEffect",
    "createItem",
    "updateItem",
    "deleteItem"
  ])
    Hooks.on(name, check);
}
export function settlePunishingDamage(actor, message, input = {}) {
  return settleStanceDamage(actor, message, input, { expectedKey: "punishing" });
}
export function managePunishingDamage(actor, input = {}) {
  return manageStanceDamage(actor, input, { expectedKey: "punishing" });
}
