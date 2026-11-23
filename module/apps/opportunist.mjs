/** The Opportunist control on the Main tab and the halved damage roll on its attack card. */
import { limitedFinalAttack, finalAttackOptions, finalWeaponReady } from "./final-attack.mjs";
import { opportunistPlan } from "../rules/opportunist.mjs";
import { expertiseCombatContext } from "./combat-expertise.mjs";
import { standardAttackContextContent } from "./standard-attack-context.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { formDialog, raw, weaponField } from "./dialog-kit.mjs";
import { loc } from "../i18n.mjs";

export async function takeOpportunist(actor, options = {}) {
  if (!["agent", "npc"].includes(actor.type) || !actor.isOwner) return null;
  const combat = expertiseCombatContext(actor),
    clock = JSON.stringify(combat);
  let input = options;
  if (!Object.hasOwn(input, "triggerConfirmed")) {
    input = await formDialog({
      title: loc`Opportunist final attack`,
      intro: loc`Once per round, when another opponent becomes stunned or falls below 0 wound points while you and this opponent can both see them, make one free final attack against this opponent. A hit deals half damage, rounded up (p.175).`,
      fields: [
        { text: "triggerDescription", label: loc`What happened`, maxlength: 300 },
        weaponField(actor, loc`Your readied weapon`, { ready: finalWeaponReady }),
        raw(standardAttackContextContent(actor)),
        {
          check: "triggerConfirmed",
          label: loc`The GC confirms another opponent just became stunned or fell below 0 wound points`
        },
        { check: "sightConfirmed", label: loc`You and this opponent both have line of sight to them` },
        { check: "immediateConfirmed", label: loc`This attack follows at once` }
      ]
    });
    if (!input) return null;
  }
  const opts = finalAttackOptions(input),
    item = actor.items.get(input.weaponId);
  if (!finalWeaponReady(item)) throw new Error(loc`Choose an owned readied weapon for the final attack.`);
  const plan = () => opportunistPlan(actor.system, expertiseCombatContext(actor), input),
    original = plan(),
    preview = actor.weaponAttack(item, opts);
  if (preview.blocked || (preview.ranged && !Number.isFinite(opts.distanceFeet)))
    throw new Error(preview.reason || loc`Enter the measured distance for a ranged final attack.`);
  const signature = JSON.stringify(preview),
    receipt = { ...original, weaponId: item.id, weaponUuid: item.uuid, id: foundry.utils.randomID() };
  return limitedFinalAttack(actor, "opportunist", {
    weaponId: item.id,
    options: opts,
    receipt,
    check() {
      if (!actor.isOwner || JSON.stringify(expertiseCombatContext(actor)) !== clock)
        throw new Error(loc`The Initiative Count or ownership changed.`);
    },
    changed() {
      const w = actor.items.get(item.id);
      return (
        JSON.stringify(plan()) !== JSON.stringify(original) ||
        !finalWeaponReady(w) ||
        JSON.stringify(actor.weaponAttack(w, opts)) !== signature
      );
    },
    changedMessage: loc`The weapon, declaration or reserved use changed. Review it again.`
  });
}

// The halved damage roll, offered on a resolved Opportunist hit until it has been rolled.
rollPipeline.register({
  id: "opportunistDamageControl",
  kinds: ["attack"],
  order: 9751,
  chatControls({ message, check, actor }) {
    if (
      check.finalAttack?.source !== "opportunist" ||
      check.successConfirmed !== true ||
      check.superseded ||
      [...(game.messages ?? [])].some(m => m.flags?.spycraft2?.opportunistDamage?.attackUuid === message.uuid)
    )
      return null;
    const weapon = check.weaponUuid ? fromUuidSync(check.weaponUuid) : null;
    return weapon
      ? [
          {
            label: loc`Roll Opportunist damage (half)`,
            run: () => actor.rollDamage(weapon, { opportunistAttackUuid: message.uuid, includeSneakAttack: false })
          }
        ]
      : null;
  }
});
rollPipeline.register({ id: "opportunistRecord", order: 9752, record: ["opportunistDamage"] });
