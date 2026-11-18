/** Black Cat on the Main tab: the GC marks the opponents the character chose (see module/rules/black-cat.mjs). */
import { blackCatPlan, activeBlackCat } from "../rules/black-cat.mjs";
import { chanceFeatCount } from "../rules/fortunate.mjs";
import { attackCharacterTargetChoices } from "./character-target.mjs";
import { restraintActionBlock } from "../rules/restraints.mjs";
import { loc } from "../i18n.mjs";

export async function applyBlackCat(actor, options = {}) {
  if (!game.user?.isGM) throw new Error(loc`The GC applies Black Cat to the opponents the player chooses.`);
  const esc = foundry.utils.escapeHTML,
    choices = attackCharacterTargetChoices().filter(a => a.uuid !== actor.uuid);
  let input = options;
  if (!Object.hasOwn(input, "sightConfirmed")) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Black Cat` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Free action, once per scene: up to ${chanceFeatCount(actor.system)} opponents in line of sight (one per Chance feat). Their checks’ error ranges increase by 2 until the end of the scene. No character carries more than one Black Cat (p.189).`}</p>${choices
        .map(
          a =>
            `<label><input type="checkbox" name="target_${esc(a.uuid.replaceAll(".", "_"))}" /> ${esc(a.name)}${activeBlackCat(a.flags?.spycraft2?.blackCat, actor.usagePeriods) ? " " + loc`(already carries a Black Cat)` : ""}</label>`
        )
        .join(
          ""
        )}<label><input name="sightConfirmed" type="checkbox" /> ${loc`The GC confirms every chosen opponent is in line of sight`}</label></div>`
    });
    if (!input) return null;
    input = {
      ...input,
      targetUuids: choices.filter(a => input["target_" + a.uuid.replaceAll(".", "_")] === true).map(a => a.uuid)
    };
  }
  const blocked = restraintActionBlock(actor.system, { free: true });
  if (blocked) throw new Error(blocked);
  const resolve = () =>
    (input.targetUuids ?? []).map(uuid => {
      const target = choices.find(a => a.uuid === uuid);
      if (!target) throw new Error(loc`Choose opponents from this scene.`);
      return { uuid, name: target.name, mark: target.flags?.spycraft2?.blackCat, actor: target };
    });
  const plan = () =>
    blackCatPlan(actor.system, resolve(), {
      sourceUuid: actor.uuid,
      sourceName: actor.name,
      periods: actor.usagePeriods,
      sightConfirmed: input.sightConfirmed === true,
      at: game.time?.worldTime ?? 0
    });
  plan();
  return actor.useLimitedAbility(
    "blackCat",
    async () => {
      const marks = plan(),
        targets = resolve();
      for (const m of marks)
        await targets.find(t => t.uuid === m.uuid).actor.update({ "flags.spycraft2.blackCat": m.mark });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: esc(
          loc`Black Cat: ${marks.map(m => m.name).join(", ")} — error ranges +2 until the end of the scene.${marks[0].mark.toughLuck ? " " + loc`Tough Luck: each threat they score costs 1 more action die to activate.` : ""}`
        ),
        flags: { spycraft2: { actorUuid: actor.uuid, checkKind: "blackCat", targets: marks.map(m => m.uuid) } }
      });
      return marks;
    },
    { workflow: "blackCat" }
  );
}
