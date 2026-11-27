/**
 * GC action dice spent straight from an NPC's roll card.
 *
 * NPCs have no action dice of their own; the GC spends from the session pool (pp.397–399, 452). On an NPC's open
 * attack, skill or save card the GC gets two buttons:
 *  - "GC boost (+1dN)" pays one die, rolls the NPC's die type and adds it to the card's total;
 *  - "GC: activate threat" pays for a confirmed threat and marks the card as a critical success, so the damage roll
 *    and its application carry the critical hit on.
 * Both go through spendGCDice, which checks the pool, the NPC's qualities and posts the spend to the GC.
 */
import { triumphAt } from "../../rules/check-candidates.mjs";
import { rollPipeline } from "../../rules/roll-pipeline.mjs";
import { gcDieType } from "../../rules/gc/gc-spend.mjs";
import { npcIsSpecial, spendProfile } from "./npc-play.mjs";
import { threatsAutoActivate } from "../../rules/campaign-rules.mjs";
import { spendGCDice } from "./spend.mjs";
import { resolveSkillResult } from "../../rules/checks.mjs";
import { loc } from "../../i18n.mjs";

/** NPC skill rolls are posted as plain checks that name the skill (module/apps/gc/npc-play.mjs). */
const npcCheckKind = check =>
  ["attack", "skill", "save", "ability", "knowledge"].includes(check.checkKind) || !!check.npcSkill;
/** An activated critical failure can no longer be boosted (the same rule as an agent's boost). */
export const gcBoostable = check =>
  Number.isFinite(check?.rawTotal) && !check.resolved && !check.superseded && !check.criticalFailure;
const npcOpen = ({ check, actor, user }) =>
  user?.isGM === true &&
  actor?.type === "npc" &&
  Number.isFinite(check.rawTotal) &&
  !check.resolved &&
  !check.superseded &&
  npcCheckKind(check);

/**
 * Add a GC boost to the card. The boost is kept in the card's flags, like an agent's boost, and the result is worked
 * out again through the cap, threat and Triumph rules. The card's content is left alone: a roll card shows its dice
 * breakdown only while its content is plain, so appending a line there would hide the dice.
 */
export async function gcBoostCard(message, actor) {
  if (!gcBoostable(message.flags?.spycraft2)) {
    ui.notifications.warn(loc`This card can no longer be boosted.`);
    return null;
  }
  const result = await spendGCDice({ id: "boostRoll", actor, onCard: true });
  if (!result?.die) return null;
  const check = message.flags.spycraft2,
    boostTotal = (check.boostTotal ?? 0) + result.die.total,
    resolved = resolveSkillResult(check.rawTotal, check.naturalDie, {
      cap: check.cap ?? null,
      threat: check.threat ?? 0,
      actionDieBonus: boostTotal,
      triumphAt: triumphAt(check),
      ceiling: check.resultCeiling ?? null
    });
  await message.update({
    "flags.spycraft2.effectiveTotal": resolved.total,
    "flags.spycraft2.boostTotal": boostTotal,
    "flags.spycraft2.capped": resolved.limited,
    "flags.spycraft2.potentialTriumph": ["skill", "knowledge", "attack"].includes(check.checkKind) && resolved.triumph,
    "flags.spycraft2.gcBoosts": [...(check.gcBoosts ?? []), result.die.total]
  });
  return resolved.total;
}

/** Pay for an NPC's confirmed threat from the GC pool and record the critical on its card. */
export async function gcActivateThreat(message, actor) {
  const check = message.flags.spycraft2;
  // Bloodbath (p.406): a special character's attack threat becomes a critical hit without paying a die.
  if (check.checkKind === "attack" && threatsAutoActivate() && actor && npcIsSpecial(actor)) {
    await message.update({
      "flags.spycraft2.criticalSuccess": true,
      "flags.spycraft2.criticalActivation": { cost: 0, payer: "gc", source: "Bloodbath" }
    });
    return true;
  }
  // Laser damage (p.338): a threat costs 1 action die less to activate, so an NPC's laser critical is free.
  if (check.checkKind === "attack" && check.attackContext?.laser === true) {
    await message.update({
      "flags.spycraft2.criticalSuccess": true,
      "flags.spycraft2.criticalActivation": { cost: 0, payer: "gc", source: loc`Laser damage –1` }
    });
    return true;
  }
  const result = await spendGCDice({
    id: "activateThreat",
    actor,
    onCard: true,
    dice: 1,
    checkKind: check.checkKind === "attack" ? "attack" : "skill"
  });
  if (!result?.plan) return null;
  await message.update({
    "flags.spycraft2.criticalSuccess": true,
    "flags.spycraft2.criticalActivation": { cost: result.plan.cost, payer: "gc" }
  });
  return true;
}

rollPipeline.register({
  id: "gcNpcDiceControl",
  order: 9136,
  chatControls(ctx) {
    if (!npcOpen(ctx)) return null;
    const { message, check, actor } = ctx;
    let die = 4;
    try {
      die = gcDieType(spendProfile(actor));
    } catch {
      /* an incomplete NPC profile rolls the basic die */
    }
    const controls = gcBoostable(check)
      ? [
          {
            label: loc`GC boost (+1d${die})`,
            key: "gcBoost",
            placement: "card",
            run: () => gcBoostCard(message, actor)
          }
        ]
      : [];
    if (check.threatConfirmed && !check.criticalSuccess && !check.criticalFailure)
      controls.unshift({
        label: loc`GC: activate threat`,
        placement: "card",
        run: () => gcActivateThreat(message, actor)
      });
    return controls.length ? controls : null;
  }
});
