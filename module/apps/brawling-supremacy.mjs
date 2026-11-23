/** Brawling Supremacy’s final attack, offered on the second unarmed hit on one opponent in a round. */
import { finalAttackOptions, limitedFinalAttack } from "./final-attack.mjs";
import { brawlingFinalEligible, brawlingFinalPlan } from "../rules/brawling-supremacy.mjs";
import { expertiseCombatContext } from "./combat-expertise.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

const posted = () => [...(game.messages ?? [])].map(m => m.flags?.spycraft2).filter(Boolean);

export async function takeBrawlingFinal(actor, check) {
  const item = check.weaponUuid ? fromUuidSync(check.weaponUuid) : null;
  if (!item || item.parent?.uuid !== actor.uuid)
    throw new Error(loc`The unarmed attack’s weapon is no longer available.`);
  const opts = finalAttackOptions({ targetActorUuid: check.attackContext.targetActorUuid }),
    plan = () => brawlingFinalPlan(actor.system, expertiseCombatContext(actor), check),
    original = plan(),
    receipt = { ...original, weaponId: item.id, weaponUuid: item.uuid, id: foundry.utils.randomID() };
  return limitedFinalAttack(actor, "brawlingSupremacy", {
    weaponId: item.id,
    options: { ...opts, targetActorUuid: original.targetUuid },
    receipt,
    changed: () =>
      JSON.stringify(plan()) !== JSON.stringify(original) || !brawlingFinalEligible(actor.system, check, posted()),
    changedMessage: loc`The round or the earlier hits changed. Review them again.`
  });
}

rollPipeline.register({
  id: "brawlingSupremacyControl",
  kinds: ["attack"],
  order: 9766,
  chatControls({ check, actor }) {
    if (!actor?.isOwner || !brawlingFinalEligible(actor.system, check, posted())) return null;
    const target = fromUuidSync(check.attackContext.targetActorUuid);
    return [
      {
        label: loc`Brawling Supremacy: attack`,
        hint: loc`Brawling Supremacy: final attack on ${target?.name ?? loc`this opponent`}`,
        run: () => takeBrawlingFinal(actor, check)
      }
    ];
  }
});
