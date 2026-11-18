/** The Opportunist control on the Main tab and the halved damage roll on its attack card. */
import { postFinalAttack, finalAttackOptions, finalWeaponReady } from "./final-attack.mjs";
import { opportunistPlan } from "../rules/opportunist.mjs";
import { expertiseCombatContext } from "./combat-expertise.mjs";
import { standardAttackContextContent } from "./standard-attack-context.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export async function takeOpportunist(actor, options = {}) {
  if (!["agent", "npc"].includes(actor.type) || !actor.isOwner) return null;
  const combat = expertiseCombatContext(actor),
    clock = JSON.stringify(combat);
  let input = options;
  if (!Object.hasOwn(input, "triggerConfirmed")) {
    const esc = foundry.utils.escapeHTML,
      weapons = actor.items
        .filter(finalWeaponReady)
        .map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`)
        .join("");
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Opportunist final attack` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Once per round, when another opponent becomes stunned or falls below 0 wound points while you and this opponent can both see them, make one free final attack against this opponent. A hit deals half damage, rounded up (p.175).`}</p><label>${loc`What happened`} <input name="triggerDescription" maxlength="300" /></label><label>${loc`Your readied weapon`} <select name="weaponId">${weapons}</select></label>${standardAttackContextContent(actor)}<label><input name="triggerConfirmed" type="checkbox" /> ${loc`The GC confirms another opponent just became stunned or fell below 0 wound points`}</label><label><input name="sightConfirmed" type="checkbox" /> ${loc`You and this opponent both have line of sight to them`}</label><label><input name="immediateConfirmed" type="checkbox" /> ${loc`This attack follows at once`}</label></div>`
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
  return actor.useLimitedAbility(
    "opportunist",
    async status => {
      const validate = () => {
        if (!actor.isOwner || JSON.stringify(expertiseCombatContext(actor)) !== clock)
          throw new Error(loc`The Initiative Count or ownership changed.`);
        const w = actor.items.get(item.id),
          counter = actor.system.resourceUses?.opportunist;
        if (
          JSON.stringify(plan()) !== JSON.stringify(original) ||
          !finalWeaponReady(w) ||
          JSON.stringify(actor.weaponAttack(w, opts)) !== signature ||
          counter?.epoch !== status.epoch ||
          counter.used !== status.used + 1
        )
          throw new Error(loc`The weapon, declaration or reserved use changed. Review it again.`);
      };
      return postFinalAttack(actor, item.id, opts, receipt, validate);
    },
    { workflow: "opportunist" }
  );
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
