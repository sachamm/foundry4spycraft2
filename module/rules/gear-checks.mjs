import { loc } from "../i18n.mjs";
/** Personal Stash, p.197: the character must be inside their home, rather than the wider Home Turf area. */
export function gearCheckPlan(system, { atHome = false } = {}) {
  const baseGearBonus = system.gearCheck ?? 0;
  if (!Number.isSafeInteger(baseGearBonus)) throw new Error(loc`Review the Gear check bonus.`);
  const personalStash = system.activeFeatNames?.includes("Personal Stash") === true,
    gearFeats = personalStash
      ? (system.activeFeatSelections ?? [])
          .filter(f => f.tree === "gear")
          .map(f => ({ name: f.name, choice: f.choice ?? "" }))
          .sort((a, b) => a.name.localeCompare(b.name) || a.choice.localeCompare(b.choice))
      : [];
  if (personalStash && !gearFeats.some(f => f.name === "Personal Stash"))
    throw new Error(loc`Review the active Gear feat selections for Personal Stash.`);
  const personalStashBonus = personalStash && atHome === true ? gearFeats.length : 0,
    bonus = baseGearBonus + personalStashBonus;
  if (!Number.isSafeInteger(bonus)) throw new Error(loc`Review the modified Gear check bonus.`);
  return { version: 1, atHome: atHome === true, personalStash, gearFeats, baseGearBonus, personalStashBonus, bonus };
}
