/** GC controls on attack cards for Lucky Break, Peculiar Dodge, Misfortune and Fortune’s Fool. */
import {
  reactableHit,
  peculiarDodgeMisses,
  misfortuneEligible,
  fortunesFoolEligible
} from "../rules/chance-reactions.mjs";
import { adjustGCDice } from "../rules/gc-dice.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

const say = (actor, text) =>
  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: foundry.utils.escapeHTML(text) });

/** A hit turned into a miss, recorded on the attack card. */
const turnToMiss = (message, flag, value) =>
  message.update({ "flags.spycraft2.successConfirmed": false, [`flags.spycraft2.${flag}`]: value });

rollPipeline.register({
  id: "chanceReactionControls",
  kinds: ["attack"],
  order: 9764,
  chatControls({ message, check, actor, user }) {
    if (!user?.isGM) return null;
    const controls = [],
      target = check.attackContext?.targetActorUuid ? fromUuidSync(check.attackContext.targetActorUuid) : null,
      feats = target?.system?.activeFeatNames ?? [];
    if (reactableHit(check) && feats.includes("Lucky Break"))
      controls.push({
        label: loc`Lucky Break (${target.name}): the hit beat Defense by 1 or less — it misses`,
        run: () =>
          target.useLimitedAbility(
            "luckyBreak",
            async () => {
              await turnToMiss(message, "luckyBreak", target.uuid);
              return say(target, loc`Lucky Break: ${actor.name}’s attack on ${target.name} misses instead (p.190).`);
            },
            { workflow: "chanceReaction" }
          )
      });
    if (reactableHit(check) && feats.includes("Peculiar Dodge"))
      controls.push({
        label: loc`Peculiar Dodge (${target.name}): spend an action die, odd means a miss`,
        run: () =>
          target.useLimitedAbility(
            "peculiarDodge",
            () =>
              target.spendActionDiceBenefit(
                1,
                async () => {
                  const die = target.system.actionDice?.die ?? 4,
                    roll = await new Roll(`1d${die}`).evaluate(),
                    misses = peculiarDodgeMisses(roll.total);
                  if (misses) await turnToMiss(message, "peculiarDodge", { by: target.uuid, face: roll.total });
                  else await message.update({ "flags.spycraft2.peculiarDodge": { by: target.uuid, face: roll.total } });
                  return roll.toMessage({
                    speaker: ChatMessage.getSpeaker({ actor: target }),
                    flavor: foundry.utils.escapeHTML(
                      misses
                        ? loc`Peculiar Dodge: ${roll.total} is odd — the attack misses ${target.name} (p.190).`
                        : loc`Peculiar Dodge: ${roll.total} is even — the hit stands (p.190).`
                    )
                  });
                },
                { purpose: "Peculiar Dodge" }
              ),
            { workflow: "chanceReaction" }
          )
      });
    if (misfortuneEligible(check) && actor?.system?.activeFeatNames?.includes("Misfortune") && target)
      controls.push({
        label: loc`Misfortune: spend an action die so ${target.name} discards one`,
        run: () =>
          actor.useLimitedAbility(
            "misfortune",
            () =>
              actor.spendActionDiceBenefit(
                1,
                async () => {
                  await message.update({ "flags.spycraft2.misfortune": target.uuid });
                  if (target.type === "agent") {
                    const left = Math.max(0, (target.system.actionDice?.value ?? 0) - 1);
                    await target.update({ "system.actionDice.value": left });
                  } else await adjustGCDice(-1, loc`Misfortune: ${target.name} discards an action die`);
                  return say(
                    actor,
                    target.type === "agent"
                      ? loc`Misfortune: ${target.name} discards 1 action die (p.190).`
                      : loc`Misfortune: the GC discards 1 action die for ${target.name} (p.190).`
                  );
                },
                { purpose: "Misfortune" }
              ),
            { workflow: "chanceReaction" }
          )
      });
    if (fortunesFoolEligible(check) && actor?.system?.activeFeatNames?.includes("Fortune's Fool"))
      controls.push({
        label: loc`Fortune’s Fool: trade an action die with the opponent who activated this error`,
        run: async () => {
          const payer = check.criticalActivation.payerUuid;
          await message.update({ "flags.spycraft2.fortunesFool": payer });
          if (payer === "GC") await adjustGCDice(1, loc`Fortune’s Fool: traded die from ${actor.name}`);
          else {
            const opponent = fromUuidSync(payer);
            if (opponent)
              await opponent.update({ "system.actionDice.value": (opponent.system.actionDice?.value ?? 0) + 1 });
          }
          return say(
            actor,
            loc`Fortune’s Fool: ${actor.name} trades 1 action die for 1 the opponent spent; the opponent gets 1 die back and ${actor.name} keeps their count, now holding a die of the spent type (p.190).`
          );
        }
      });
    return controls.length ? controls : null;
  }
});
