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
import { rollPipeline } from "../../rules/roll-pipeline.mjs";
import { gcDieType } from "../../rules/gc/gc-spend.mjs";
import { spendProfile } from "./npc-play.mjs";
import { spendGCDice } from "./spend.mjs";
import { loc } from "../../i18n.mjs";

const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
const npcOpen = ({ check, actor, user }) =>
  user?.isGM === true &&
  actor?.type === "npc" &&
  Number.isFinite(check.rawTotal) &&
  !check.resolved &&
  !check.superseded &&
  ["attack", "skill", "save", "ability", "knowledge"].includes(check.checkKind);

/** Add a GC boost to the card: the new total, and a line under the result saying where it came from. */
export async function gcBoostCard(message, actor) {
  const result = await spendGCDice({ id: "boostRoll", actor });
  if (!result?.die) return null;
  const check = message.flags.spycraft2,
    before = Number.isFinite(check.effectiveTotal) ? check.effectiveTotal : check.rawTotal,
    total = before + result.die.total;
  await message.update({
    "flags.spycraft2.effectiveTotal": total,
    "flags.spycraft2.boostTotal": (check.boostTotal ?? 0) + result.die.total,
    "flags.spycraft2.gcBoosts": [...(check.gcBoosts ?? []), result.die.total],
    content: `${message.content ?? ""}<p class="spycraft2 sc2-gc-boost">${esc(loc`GC boost +${result.die.total}: total ${total}.`)}</p>`
  });
  return total;
}

/** Pay for an NPC's confirmed threat from the GC pool and record the critical on its card. */
export async function gcActivateThreat(message, actor) {
  const check = message.flags.spycraft2;
  const result = await spendGCDice({
    id: "activateThreat",
    actor,
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
    const controls = [{ label: loc`GC boost (+1d${die})`, placement: "card", run: () => gcBoostCard(message, actor) }];
    if (check.threatConfirmed && !check.criticalSuccess && !check.criticalFailure)
      controls.unshift({
        label: loc`GC: activate threat`,
        placement: "card",
        run: () => gcActivateThreat(message, actor)
      });
    return controls;
  }
});
