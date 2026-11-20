/**
 * Class abilities that change a number in a fight and need no choice from the player.
 * Pure rules: each function reads the character and returns the number.
 */

/** Gunplay (Triggerman 2nd, 7th): the Initiative Count gained for handgun hits. */
export function gunplayCountGain(system, weaponProficiency, hits = 0) {
  const level = system?.classLevels?.triggerman ?? 0;
  if (weaponProficiency !== "handgun" || !Number.isSafeInteger(hits) || hits <= 0) return 0;
  return (level >= 7 ? 2 : level >= 2 ? 1 : 0) * hits;
}

/** Stratagem (Tactician 2nd, 7th): the Initiative Count the tactician and visible teammates gain each round. */
export function stratagemCountGain(system) {
  const level = system?.classLevels?.tactician ?? 0;
  return level >= 7 ? 2 : level >= 2 ? 1 : 0;
}

/** Juggernaut (Brawler 10th): the most lethal damage of one hit that may be taken as subdual damage instead. */
export function juggernautConversion(system, lethal) {
  if ((system?.classLevels?.brawler ?? 0) < 10 || !Number.isFinite(lethal) || lethal <= 0) return 0;
  return Math.floor(lethal / 2);
}
