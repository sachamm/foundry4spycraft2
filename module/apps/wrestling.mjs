/** Wrestling Basics on attack cards: Brush damage and the Open Stance reaction (see module/rules/wrestling.mjs). */
import { shiftCount } from "./dueling.mjs";
import { inOpenStance } from "../rules/wrestling.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

rollPipeline.register({
  id: "wrestlingControls",
  kinds: ["attack"],
  order: 9762,
  chatControls({ message, check, actor, user }) {
    if (check.checkKind !== "attack" || check.superseded || check.resolved !== true) return null;
    const controls = [],
      target = check.attackContext?.targetActorUuid ? fromUuidSync(check.attackContext.targetActorUuid) : null;
    // Brush: roll its 1d6 subdual, then lower the target's Count by the damage.
    const weapon = check.weaponUuid ? fromUuidSync(check.weaponUuid) : null;
    if (check.attackContext?.brush && check.successConfirmed === true && weapon && !check.brushDamage)
      controls.push({
        label: loc`Roll Brush damage`,
        run: async () => {
          const rolled = await actor.rollDamage(weapon, { brush: true, includeSneakAttack: false });
          if (!rolled) return rolled;
          await message.update({ "flags.spycraft2.brushDamage": rolled.uuid ?? true });
          const total = rolled.rolls?.[0]?.total ?? rolled.flags?.spycraft2?.effectiveTotal;
          if (target && Number.isFinite(total) && total > 0)
            return shiftCount(message, target, -total, "brushCount", "Brush");
          return rolled;
        }
      });
    // Open Stance: once per round, the GC lets its owner answer a miss by an opponent within Reach.
    if (
      user?.isGM &&
      check.successConfirmed === false &&
      !check.openStance &&
      target &&
      inOpenStance(target.system) &&
      target.system.activeFeatNames?.includes("Wrestling Basics")
    )
      controls.push({
        label: loc`Open Stance: Grapple or Trip`,
        hint: loc`Open Stance: ${target.name} pulls the attacker in for a free Grapple or Trip`,
        run: () =>
          target.useLimitedAbility(
            "openStance",
            async () => {
              await message.update({ "flags.spycraft2.openStance": target.uuid });
              return ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: target }),
                content: foundry.utils.escapeHTML(
                  loc`Open Stance: ${target.name} pulls ${actor.name} into their square and may at once take a Grapple or Trip action against them as a free action (p.189).`
                )
              });
            },
            { workflow: "openStance" }
          )
      });
    return controls.length ? controls : null;
  }
});
