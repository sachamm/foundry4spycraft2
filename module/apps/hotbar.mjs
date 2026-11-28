/**
 * Weapons and skills dragged from a character sheet to the hotbar become macros that roll them.
 * A macro clicked with Shift held rolls the other way round from the player's usual choice (see
 * module/apps/remembered-choices.mjs), the same as on the sheet.
 */
import { refuse } from "../error-notices.mjs";
import { loc } from "../i18n.mjs";
import { quickAttackOptions, skipDialog } from "./remembered-choices.mjs";

const SKILL_DRAG = "spycraft2.skill";

/** Make weapon rows and skill names on a rendered sheet draggable to the hotbar. */
export function enableHotbarDrag(root, actor) {
  if (!root?.querySelectorAll || !actor) return;
  for (const row of root.querySelectorAll(".sc2-weapon[data-item-id]")) {
    if (row.dataset.sc2Drag) continue;
    row.dataset.sc2Drag = "1";
    row.draggable = true;
    row.addEventListener("dragstart", event => {
      const item = actor.items.get(row.dataset.itemId);
      if (!item) return;
      event.dataTransfer?.setData("text/plain", JSON.stringify(item.toDragData()));
    });
  }
  for (const link of root.querySelectorAll('[data-action="rollSkill"][data-skill]')) {
    if (link.dataset.sc2Drag) continue;
    link.dataset.sc2Drag = "1";
    link.draggable = true;
    link.addEventListener("dragstart", event => {
      event.dataTransfer?.setData(
        "text/plain",
        JSON.stringify({
          type: SKILL_DRAG,
          actorUuid: actor.uuid,
          skill: link.dataset.skill,
          name: link.textContent.trim()
        })
      );
    });
  }
}

/** What a macro calls: roll a weapon's attack or a skill, honouring Shift. */
export async function rollFromMacro({ itemUuid, actorUuid, skill } = {}, event = globalThis.event) {
  if (itemUuid) {
    const item = await fromUuid(itemUuid),
      actor = item?.parent;
    if (!actor?.isOwner) return refuse(loc`You do not own that character.`);
    if (item.type !== "weapon") return item.sheet?.render(true);
    return actor.rollAttack(item, skipDialog(event) ? quickAttackOptions(actor, item) : { askContext: true });
  }
  const actor = actorUuid ? await fromUuid(actorUuid) : null;
  if (!actor?.isOwner || !skill) return refuse(loc`You do not own that character.`);
  return actor.rollSkill(skill, null, skipDialog(event) ? { quick: true } : {});
}

async function makeMacro(name, img, args, slot) {
  const command = `game.spycraft2.rollFromMacro(${JSON.stringify(args)}, event);`;
  let macro = game.macros.find(entry => entry.command === command && entry.isOwner);
  macro ??= await Macro.create({ name, type: "script", img, command, flags: { spycraft2: { roll: args } } });
  return game.user.assignHotbarMacro(macro, slot);
}

/** The `hotbarDrop` hook: returns false when this system made the macro. */
export function onHotbarDrop(bar, data, slot) {
  if (data?.type === SKILL_DRAG) {
    makeMacro(
      data.name || data.skill,
      "icons/svg/d20-black.svg",
      { actorUuid: data.actorUuid, skill: data.skill },
      slot
    );
    return false;
  }
  // A GC Console tool: the macro presses that tool.
  if (data?.type === "spycraft2.gcTool" && typeof data.action === "string" && /^[A-Za-z]+$/.test(data.action)) {
    const command = `game.spycraft2.gc.run(${JSON.stringify(data.action)});`;
    (async () => {
      let macro = game.macros.find(entry => entry.command === command && entry.isOwner);
      macro ??= await Macro.create({
        name: data.name || data.action,
        type: "script",
        img: "icons/svg/item-bag.svg",
        command,
        flags: { spycraft2: { gcTool: data.action } }
      });
      return game.user.assignHotbarMacro(macro, slot);
    })();
    return false;
  }
  if (data?.type !== "Item" || !data.uuid) return true;
  const item = fromUuidSync(data.uuid);
  if (!item?.parent || item.parent.documentName !== "Actor" || item.type !== "weapon") return true;
  makeMacro(`${item.parent.name}: ${item.name}`, item.img, { itemUuid: item.uuid }, slot);
  return false;
}

export function installHotbar() {
  Hooks.on("hotbarDrop", onHotbarDrop);
}
