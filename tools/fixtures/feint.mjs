import { feintSkillChecks as checks } from "../../module/rules/feint.mjs";
import { readiedMeleeWeapons } from "../../module/rules/readied-weapons.mjs";
import { readiedDisarmWeapons } from "../../module/rules/disarm-response.mjs";
export const clock = () => ({
  id: "Combat.feint",
  combatantId: "participant",
  started: true,
  round: 3,
  turn: 0,
  ownTurnIndex: 0
});
export const input = (patch = {}) => ({
  feintOpponentName: "Opponent",
  feintAdjacent: true,
  feintTargetEligibleConfirmed: true,
  feintLegalConfirmed: true,
  feintCombat: clock(),
  ...patch
});
export const sword = (patch = {}) => ({
  id: "sword",
  uuid: "Actor.feint.Item.sword",
  name: "Reviewed sword",
  type: "weapon",
  system: {
    meleeFamily: "oneHandedSword",
    proficiency: "edged",
    sizeHands: "T/1h",
    qualities: "FIN",
    equipped: true,
    carried: true,
    quantity: 1,
    ...patch
  }
});
export function prep(s, items = []) {
  return { ...s, readiedMeleeWeapons: readiedMeleeWeapons(s, items), disarmWeapons: readiedDisarmWeapons(s, items) };
}
export const fencingSystem = () =>
  prep({ activeFeatNames: ["Fencing Basics"], size: "Medium", abilities: { str: { mod: 1 }, dex: { mod: 2 } } }, [
    sword()
  ]);
export const acting = checks("sleightOfHand")[0],
  defending = checks("notice")[0];
