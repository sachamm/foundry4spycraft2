import { attributeDefensePlan } from "./attributes.mjs";
import { loc } from "../i18n.mjs";

/** Apply conditional Defense to already prepared base/armor totals; the owned values are never rewritten. */
export function npcDefensePlan(system) {
  const extras = system.defenseExtras ?? {},
    misc = extras.misc ?? 0,
    dodge = extras.dodge ?? 0;
  if (![misc, dodge].every(Number.isSafeInteger)) throw Error(loc`Review the NPC's actual extra Defense modifiers.`);
  const state = attributeDefensePlan(system, { dodgeEntries: [{ type: "dodge", value: dodge }] }),
    normalDexterity = system.abilities?.dex?.mod ?? 0,
    dexterityLost = normalDexterity - state.dexterity;
  return {
    ...state,
    normalDexterity,
    dexterityLost,
    misc,
    dodge,
    adjustment: misc + dodge - dexterityLost - state.dodgeLost
  };
}
