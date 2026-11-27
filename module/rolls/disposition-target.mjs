/** The skill dialog's question about the targeted NPC's disposition (Table 7.14, p.458). */
import { esc } from "../html.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { DISPOSITIONS, dispositionToward } from "../rules/gc/disposition.mjs";
import { dispositionSkill } from "../rules/disposition-checks.mjs";
import { loc } from "../i18n.mjs";

const VILLAIN_ROLES = ["minion", "henchman", "mastermind"];

/** The first targeted NPC this client can read, with its disposition toward the rolling character. */
export function targetedNpc(actor, targets = globalThis.game?.user?.targets ?? []) {
  for (const token of targets) {
    const npc = token?.actor;
    if (npc?.type !== "npc") continue;
    const record = npc.system?.disposition;
    const qualities = (npc.system?.npcProfile?.qualities ?? []).map(quality => quality.id ?? quality);
    return {
      name: token.name ?? npc.name,
      grade: record ? dispositionToward(record, actor?.id) : "",
      villain: npc.system?.npcType === "villain" || qualities.some(id => VILLAIN_ROLES.includes(id))
    };
  }
  return null;
}

rollPipeline.register({
  id: "dispositionContent:skill",
  dialogs: ["skill"],
  order: 9744,
  dialog: ({ key, actor }) => {
    if (!dispositionSkill(key)) return [];
    const target = targetedNpc(actor);
    const options = DISPOSITIONS.map(
      grade =>
        `<option value="${esc(grade.id)}"${target?.grade === grade.id ? " selected" : ""}>${esc(grade.name)}</option>`
    ).join("");
    return [
      {
        at: 720,
        html: `<label>${loc`Targeted NPC's disposition toward you (Table 7.14)`} <select name="targetDisposition"><option value="">${loc`Not targeting an NPC`}</option>${options}</select></label>${
          target
            ? `<input type="hidden" name="targetName" value="${esc(target.name)}" /><input type="hidden" name="targetVillain" value="${target.villain ? "true" : ""}" />`
            : ""
        }`
      }
    ];
  },
  read: ({ entered }, input) => {
    const form = entered ?? input ?? {};
    if (!form.targetDisposition) return null;
    return {
      targetDisposition: String(form.targetDisposition),
      targetName: String(form.targetName ?? ""),
      targetVillain: form.targetVillain === true || form.targetVillain === "true"
    };
  }
});
