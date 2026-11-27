import { classFeatureLevels } from "./class-features.mjs";
/**
 * Class abilities that change a number in a fight and need no choice from the player.
 * Pure rules: each function reads the character and returns the number.
 */

/** Gunplay (Triggerman 2nd, 7th): the Initiative Count gained for handgun hits. */
export function gunplayCountGain(system, weaponProficiency, hits = 0) {
  const level = classFeatureLevels(system)?.triggerman ?? 0;
  if (weaponProficiency !== "handgun" || !Number.isSafeInteger(hits) || hits <= 0) return 0;
  return (level >= 7 ? 2 : level >= 2 ? 1 : 0) * hits;
}

/** Stratagem (Tactician 2nd, 7th): the Initiative Count the tactician and visible teammates gain each round. */
export function stratagemCountGain(system) {
  const level = classFeatureLevels(system)?.tactician ?? 0;
  return level >= 7 ? 2 : level >= 2 ? 1 : 0;
}

/** Juggernaut (Brawler 10th): the most lethal damage of one hit that may be taken as subdual damage instead. */
export function juggernautConversion(system, lethal) {
  if ((classFeatureLevels(system)?.brawler ?? 0) < 10 || !Number.isFinite(lethal) || lethal <= 0) return 0;
  return Math.floor(lethal / 2);
}
