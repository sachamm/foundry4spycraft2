import { toolShedSource, toolShedPlan, toolShedKitState } from "../rules/tool-shed.mjs";
import { attributeActionBlock } from "../rules/attributes.mjs";
import { restraintActionBlock } from "../rules/restraints.mjs";
export async function useToolShed(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  const source = toolShedSource({ ...actor.system, usagePeriods: actor.usagePeriods });
  if (!source) throw new Error("An active Tool Shed selection is required.");
  const pack = game.packs.get("spycraft2.kits");
  if (!pack) throw new Error("The kit catalog is unavailable.");
  let input = options;
  if (!Object.keys(input).length) {
    const kits = (await pack.getDocuments()).filter(k => k.type === "gear" && k.system.kitGrade === 3),
      esc = foundry.utils.escapeHTML;
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "Tool Shed: find one Grade III kit" },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><label>Kit <select name="kitId">${kits.map(k => `<option value="${esc(k.id)}">${esc(k.name)}${k.system.kitNonPortable ? " (fixed location)" : ""}</option>`).join("")}</select></label><label>Home / fixed kit location <input name="home" maxlength="200" /></label><label><input name="atHome" type="checkbox" /> I am inside my home</label><label><input name="hourCompletedConfirmed" type="checkbox" /> I have completed the one-hour action to find this one kit</label><p>The kit is found at home and initially left there. It is lost at the end of this mission. No gear pick, Reserve or action die is spent.</p></div>`
    });
    if (!input) return null;
  }
  const id = foundry.utils.randomID(),
    kit = await pack.getDocument(input.kitId);
  toolShedPlan({ ...actor.system, usagePeriods: actor.usagePeriods }, kit, { ...input, id });
  return actor.useLimitedAbility(
    "toolShed",
    async () => {
      const state = () => ({ ...actor.system, usagePeriods: actor.usagePeriods }),
        guard = () => {
          const block =
            attributeActionBlock(actor.system, { kind: "gear", ability: "wis" }) || restraintActionBlock(actor.system);
          if (block) throw new Error(block);
          if (JSON.stringify(toolShedSource(state())) !== JSON.stringify(source))
            throw new Error("The Tool Shed source or mission changed before this grant completed.");
        };
      guard();
      const plan = toolShedPlan(state(), kit, { ...input, id, at: game.time?.worldTime ?? 0 }),
        esc = foundry.utils.escapeHTML;
      let item;
      try {
        [item] = await actor.createEmbeddedDocuments("Item", [plan.data]);
        if (!item) throw new Error("The kit was not created.");
        guard();
        await actor.update({ ["system.classGearGrants." + id]: { ...plan.record, itemId: item.id } });
        guard();
        if (!toolShedKitState(state(), item).valid) throw new Error("The introduced kit does not match its grant.");
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `Tool Shed: ${esc(item.name)} found at ${esc(plan.record.home)} after the declared one-hour action. Initially left at home; lost at mission end. No action die, Reserve or gear pick spent.`,
          flags: {
            spycraft2: {
              actorUuid: actor.uuid,
              toolShed: {
                id,
                itemUuid: item.uuid,
                epoch: source.epoch,
                home: plan.record.home,
                hourCompletedConfirmed: true
              }
            }
          }
        });
        return item;
      } catch (error) {
        // A persistence operation can commit before rejecting. Recover only this grant's stamped object.
        item ??= Array.from(actor.items.values()).find(
          i => i.system.classGearGrant?.id === id && i.system.classGearGrant?.source === "toolShed"
        );
        if (item) {
          try {
            await actor.deleteEmbeddedDocuments("Item", [item.id]);
          } catch {
            ui.notifications.warn(
              "The Tool Shed kit may still exist. Its use remains spent; review or remove the partial kit before correcting the saved use count."
            );
            return item;
          }
        }
        const saved = actor.system.classGearGrants?.[id];
        if (
          saved?.source === "toolShed" &&
          saved.epoch === plan.record.epoch &&
          saved.fingerprint === plan.record.fingerprint
        )
          await actor.update({ ["system.classGearGrants.-=" + id]: null });
        throw error;
      }
    },
    { workflow: "toolShedKit" }
  );
}
