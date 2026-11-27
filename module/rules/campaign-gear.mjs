import { loc } from "../i18n.mjs";

/** Campaign changes apply to the allowance, preserving the actual equipment catalog Caliber. */
export function campaignPickCaliber(base, effects = {}) {
  const shift = effects.gearCaliberShift ?? 0;
  if (!Number.isSafeInteger(base) || base < 1 || base > 5 || !Number.isSafeInteger(shift))
    throw new Error(loc`Review the gear pick's base Caliber and campaign modifier.`);
  const adjusted = base + shift;
  if (!Number.isSafeInteger(adjusted)) throw new Error(loc`The campaign gear Caliber is outside the supported range.`);
  return { caliber: Math.max(0, Math.min(5, adjusted)), extraI: adjusted > 5 ? 1 : 0, lost: adjusted < 1 };
}
