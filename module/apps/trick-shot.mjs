/** The Trick Shot control on a hurled-weapon hit (see module/rules/trick-shot.mjs). */
import { trickShotEligible, trickShotNote } from "../rules/trick-shot.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

rollPipeline.register({
  id: "trickShotControl",
  kinds: ["attack"],
  order: 9767,
  chatControls({ message, check, actor }) {
    if (!actor?.isOwner || !trickShotEligible(actor.system, check)) return null;
    const weapon = check.weaponUuid ? fromUuidSync(check.weaponUuid) : null;
    if (!weapon) return null;
    const target = check.attackContext?.targetActorUuid ? fromUuidSync(check.attackContext.targetActorUuid) : null;
    return [
      {
        label: loc`Trick Shot: hold the target`,
        hint: loc`Trick Shot: hold the target instead of damaging them`,
        run: async () => {
          const rolled = await actor.rollDamage(weapon, { includeSneakAttack: false });
          if (!rolled) return rolled;
          const total = rolled.rolls?.[0]?.total ?? rolled.flags?.spycraft2?.effectiveTotal;
          await message.update({ "flags.spycraft2.trickShot": { damage: total, damageUuid: rolled.uuid ?? null } });
          return ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: foundry.utils.escapeHTML(trickShotNote(target?.name ?? loc`The target`, total))
          });
        }
      }
    ];
  }
});
