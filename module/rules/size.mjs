/**
 * The Size table (Table 5.13, p.349) as numbers: the Defense and attack modifier, the Stealth/Hide modifier, and the
 * wound multiplier with its rounding. Pure.
 */

/** [modifier, stealth/hide, wounds numerator, wounds denominator, rounding] for each Size, smallest first. */
const ROWS = {
  Nuisance: [16, 20, 1, 8, "up"],
  Fine: [8, 16, 1, 4, "up"],
  Diminutive: [4, 12, 1, 3, "up"],
  Tiny: [2, 8, 1, 2, "up"],
  Small: [1, 4, 2, 3, "up"],
  Medium: [0, 0, 1, 1, "up"],
  Large: [-1, -4, 3, 2, "down"],
  Huge: [-2, -8, 2, 1, "up"],
  Gargantuan: [-4, -12, 3, 1, "up"],
  Colossal: [-8, -16, 4, 1, "up"],
  Enormous: [-16, -20, 5, 1, "up"],
  Vast: [-32, -24, 6, 1, "up"]
};
export const SIZE_NAMES = Object.freeze(Object.keys(ROWS));

/** The Size a label names ("Large (1×1)" is Large); Medium for anything unknown. */
export function sizeName(size = "Medium") {
  const word = String(size ?? "")
    .trim()
    .split(/[\s(]/)[0];
  return SIZE_NAMES.find(name => name.toLowerCase() === word.toLowerCase()) ?? "Medium";
}

/** One Size's row: { size, modifier, hide, wounds: [numerator, denominator], rounding }. */
export function sizeRow(size) {
  const name = sizeName(size),
    [modifier, hide, numerator, denominator, rounding] = ROWS[name];
  return { size: name, modifier, hide, wounds: [numerator, denominator], rounding };
}

/** A special character's wounds scaled by Size (p.349): rounded up, except Large, which rounds down. */
export function sizeWounds(wounds, size) {
  const {
    wounds: [numerator, denominator],
    rounding
  } = sizeRow(size);
  if (!Number.isFinite(wounds) || numerator === denominator) return wounds;
  const scaled = (wounds * numerator) / denominator;
  return rounding === "down" ? Math.floor(scaled) : Math.ceil(scaled);
}

/**
 * The negative wounds at which a character dies (p.349). The table's note ties this to the wound multiplier for
 * Small and smaller only (the multiplier × 10, rounded up); every larger Size dies at −10.
 */
export function sizeDeathThreshold(size) {
  const {
    wounds: [numerator, denominator],
    modifier
  } = sizeRow(size);
  return modifier > 0 ? -Math.ceil((10 * numerator) / denominator) : -10;
}
