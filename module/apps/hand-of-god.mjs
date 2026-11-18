/** Hand of God (Spirit Supremacy, p.187): a missed attack on a character in Total Defense rebounds on the attacker. */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { handOfGodEligible } from "../rules/hand-of-god.mjs";
import { loc } from "../i18n.mjs";

rollPipeline.register({
  id: "handOfGodControl",
  kinds: ["attack"],
  order: 9768,
  chatControls({ message, check, actor, user }) {
    const target = check.attackContext?.targetActorUuid ? fromUuidSync(check.attackContext.targetActorUuid) : null;
    if (!target || !(user?.isGM || target.isOwner) || !handOfGodEligible(target.system, check)) return null;
    const weapon = check.weaponUuid ? fromUuidSync(check.weaponUuid) : null;
    if (!weapon) return null;
    return [
      {
        label: loc`Hand of God (${target.name}): ${actor.name} suffers their own damage`,
        run: () =>
          target.useLimitedAbility(
            "handOfGod",
            async () => {
              await message.update({ "flags.spycraft2.handOfGod": target.uuid });
              const rolled = await actor.rollDamage(weapon, { includeSneakAttack: false });
              await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: target }),
                content: foundry.utils.escapeHTML(
                  loc`Hand of God: ${actor.name} missed ${target.name} and suffers the attack’s damage instead (p.187).`
                )
              });
              return rolled;
            },
            { workflow: "handOfGod" }
          )
      }
    ];
  }
});
