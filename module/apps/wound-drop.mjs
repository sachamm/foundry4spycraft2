/** The confirm control for an attack that dropped its opponent to 0 wound points or below (see rules/wound-drop.mjs). */
import { woundDropEligible, woundDropRecord } from "../rules/wound-drop.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

rollPipeline.register({
  id: "woundDropControl",
  kinds: ["attack"],
  order: 9770,
  chatControls({ message, check, actor, user }) {
    if (!(actor?.isOwner || user?.isGM) || !woundDropEligible(actor.system, check)) return null;
    return [
      {
        label: loc`Opponent dropped to 0 wounds`,
        hint: loc`This hit dropped the opponent to 0 wounds or below`,
        run: async () => {
          const record = woundDropRecord(actor.system, check.rollCombat.id);
          await message.update({ "flags.spycraft2.woundDrop": true });
          await actor.update({ "system.woundDrops": record });
          const feats = actor.system.activeFeatNames ?? [],
            lines = [
              ...(feats.includes("Stone Cold")
                ? [loc`Stone Cold: +${Math.min(4, record.count)} on Intimidate checks until the combat ends.`]
                : []),
              ...(feats.includes("Glint of Madness")
                ? [loc`Glint of Madness: you may take a Threaten action at once as a free action.`]
                : [])
            ];
          return ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: lines.map(l => `<p>${foundry.utils.escapeHTML(l)}</p>`).join("")
          });
        }
      }
    ];
  }
});
