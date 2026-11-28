import { loc } from "../i18n.mjs";

const equipmentBenefits = new Set(["draw", "second", "gear", "useWeapon"]);

/** Animal Grapple exceptions apply even with higher Intelligence or an augmented weapon (p.445). */
export const animalGrappleBenefitAllowed = (system, benefit) =>
  system?.npcType !== "animal" || !equipmentBenefits.has(benefit);

export function validateAnimalGrapple(system, { benefits = [], weapon = null, heldOpponents = 0 } = {}) {
  if (system?.npcType !== "animal") return;
  if (weapon || heldOpponents > 0 || benefits.some(id => !animalGrappleBenefitAllowed(system, id)))
    throw Error(
      loc`Animals cannot use equipment, manipulate the opponent's gear or grapple a second opponent during a grapple (p.445).`
    );
}
