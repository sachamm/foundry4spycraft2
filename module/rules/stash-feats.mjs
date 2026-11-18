/**
 * Feats on Sleight of Hand/Stash Item (concealing an item on a person, p.159).
 * - Steel Rain, p.182: +4 gear when the item is a hurled weapon without a blast increment (declared in the dialog).
 * - Concealed Carry, p.193: when someone frisks the character, each item stashed on them counts as 2 Size categories
 *   smaller. Item Size is not itemised by the dialog, so the card states it for the GC.
 */
import { rollPipeline, skillPlanTerm } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export function stashFeatPlan(system, key, check, input = {}) {
  const empty = { evidence: null, bonuses: [], blockedReason: "", notes: [] };
  if (key !== "sleightOfHand" || check?.id !== "stash-item") return empty;
  const feats = system?.activeFeatNames ?? [],
    rain = feats.includes("Steel Rain") && input.stashHurledWeapon === true,
    carry = feats.includes("Concealed Carry");
  return {
    evidence: rain ? { version: 1, source: "Steel Rain", stashHurledWeapon: true, bonus: 4 } : null,
    bonuses: rain ? [{ source: "Steel Rain (hurled weapon)", type: "gear", value: 4 }] : [],
    blockedReason: "",
    notes: [
      ...(rain ? [loc`Steel Rain: +4 gear to stash a hurled weapon (p.182).`] : []),
      ...(carry
        ? [
            loc`Concealed Carry: if you are frisked, each item stashed on you counts as 2 Size categories smaller (p.193).`
          ]
        : [])
    ]
  };
}

rollPipeline.register({
  id: "stashFeatsContent:skill",
  dialogs: ["skill"],
  dialog: ({ key, actor }) => [
    {
      at: 336,
      html:
        key === "sleightOfHand" && actor?.system?.activeFeatNames?.includes("Steel Rain")
          ? `<label><input name="stashHurledWeapon" type="checkbox" /> ${loc`Stash Item: the item is a hurled weapon without a blast increment (Steel Rain +4)`}</label>`
          : ""
    }
  ]
});

rollPipeline.register({
  id: "stashFeatsSkillTerm",
  kinds: ["skill"],
  order: 9232,
  terms({ system, skillKey, check, input }) {
    return skillPlanTerm("stashFeats", stashFeatPlan(system, skillKey, check, input ?? {}), {
      noteAt: 42,
      blockAt: 22,
      bonusAt: 122
    });
  }
});
