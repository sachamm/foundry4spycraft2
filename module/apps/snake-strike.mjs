/** Recording a Snake Strike from the Main tab (see module/rules/snake-strike.mjs). */
import { snakeStrikePlan } from "../rules/snake-strike.mjs";
import { attackCharacterTargetChoices } from "./character-target.mjs";
import { loc } from "../i18n.mjs";
import { formDialog, raw } from "./dialog-kit.mjs";

export async function declareSnakeStrike(actor, options = {}) {
  if (!actor.isOwner) return null;
  const esc = foundry.utils.escapeHTML,
    targets = attackCharacterTargetChoices().filter(a => a.uuid !== actor.uuid),
    weapons = actor.items.filter(i => i.type === "weapon");
  let input = options;
  if (!Object.hasOwn(input, "feintWonConfirmed")) {
    input = await formDialog({
      title: loc`Snake Strike`,
      intro: loc`Once per opponent per combat, as a free action: draw a weapon you have not used this combat and Feint. If the Feint succeeds, your next hit on that opponent with the drawn weapon this round adds 1 sneak attack die (p.183). Roll the Feint first, then record it here.`,
      fields: [
        {
          select: "targetUuid",
          label: loc`Opponent`,
          optionsHtml: raw(targets.map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`).join(""))
        },
        {
          select: "weaponId",
          label: loc`Weapon drawn`,
          optionsHtml: raw(weapons.map(w => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join(""))
        },
        { check: "feintWonConfirmed", label: loc`The GC confirms the Feint succeeded` }
      ]
    });
    if (!input) return null;
  }
  const combat = actor.participatingCombat,
    weapon = actor.items.get(input.weaponId),
    target = targets.find(a => a.uuid === input.targetUuid);
  if (!weapon || !target) throw new Error(loc`Choose the opponent and the weapon you draw.`);
  const record = {
    ...snakeStrikePlan(actor.system, combat ? { id: combat.id, started: combat.started, round: combat.round } : null, {
      targetUuid: target.uuid,
      weaponId: weapon.id,
      weaponUuid: weapon.uuid,
      feintWonConfirmed: input.feintWonConfirmed === true,
      posted: [...(game.messages ?? [])].map(m => m.flags?.spycraft2).filter(Boolean)
    }),
    id: foundry.utils.randomID()
  };
  await actor.update({ "system.snakeStrikes": [...(actor.system.snakeStrikes ?? []), record] });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: esc(
      loc`Snake Strike: ${actor.name} draws ${weapon.name} and out-feints ${target.name}; the next hit on ${target.name} with it this round adds 1 sneak attack die (p.183).`
    )
  });
}
