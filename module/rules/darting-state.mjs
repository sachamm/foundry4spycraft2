import { ownCountDurationActive } from "./own-count-duration.mjs";
import { loc } from "../i18n.mjs";
const empty = () => ({ active: false, needsReview: false, penalty: 0, extraAttacks: 0 });
export function dartingStyleState(system) {
  const r = system.dartingStyle;
  if (!r) return empty();
  if (
    typeof r.id !== "string" ||
    !r.id ||
    typeof r.combatId !== "string" ||
    !r.combatId ||
    typeof r.combatantId !== "string" ||
    !r.combatantId ||
    !Number.isSafeInteger(r.startRound) ||
    r.startRound < 1 ||
    !Number.isSafeInteger(r.dueRound) ||
    r.dueRound !== r.startRound + 1 ||
    ![1, 2].includes(r.extraAttacks) ||
    r.penalty !== 2 * r.extraAttacks ||
    r.atStartOfInitiative !== true ||
    r.confirmed !== true
  )
    return { ...empty(), needsReview: true, reason: loc`The GC must review the saved Darting Weapon tradeoff.` };
  if (!ownCountDurationActive(r, system.dartingCombatContext)) return empty();
  return {
    active: true,
    needsReview: false,
    penalty: r.penalty,
    extraAttacks: r.extraAttacks,
    dueRound: r.dueRound,
    id: r.id
  };
}
