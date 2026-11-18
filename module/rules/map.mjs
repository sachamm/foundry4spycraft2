/**
 * Measuring from the map: distance, adjacency, flanking, cover and who stands where in a blast.
 *
 * Everything here works on plain boxes in feet, so it runs without a canvas. module/apps/map.mjs turns tokens
 * into boxes and feeds the results to the roll dialogs, where the player can still correct them.
 *
 *   box: { x, y, width, height, elevation }   — the space a token fills, top-left corner and size, in feet
 */

const centre = box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
const EPSILON = 1e-6;

/** The space a token fills, in feet, from its position in pixels and size in squares. */
export function tokenBox({ x, y, width = 1, height = 1, elevation = 0 }, { size, distance }) {
  if (!(size > 0) || !(distance > 0)) throw new Error("A grid needs a square size in pixels and in feet.");
  const feet = distance / size;
  return {
    x: x * feet,
    y: y * feet,
    width: width * distance,
    height: height * distance,
    elevation: Number(elevation) || 0
  };
}

/** The empty space between two boxes along each axis, in feet (0 when they touch or overlap). */
export function gapFeet(a, b) {
  const along = (start, length, otherStart, otherLength) =>
    Math.max(0, otherStart - (start + length), start - (otherStart + otherLength));
  return {
    x: along(a.x, a.width, b.x, b.width),
    y: along(a.y, a.height, b.y, b.height),
    z: Math.abs((a.elevation ?? 0) - (b.elevation ?? 0))
  };
}

/** Whether two characters are within reach of each other: no more than `reach` feet of empty space any way. */
export function withinReach(a, b, reach = 5) {
  const gap = gapFeet(a, b);
  // Touching squares have no gap; a reach of 5 ft. covers the next square over, 10 ft. the one beyond.
  return Math.max(gap.x, gap.y) <= reach - 5 + EPSILON && gap.z <= reach + EPSILON;
}

/** Adjacent: in a neighbouring square, at about the same height. */
export function adjacent(a, b) {
  return withinReach(a, b, 5);
}

/** Squares apart on each axis: 0 in the same column, row or level; 1 for the next one over; and so on. */
export function squareSteps(a, b, square = 5) {
  const gap = gapFeet(a, b);
  const overlaps = (start, length, otherStart, otherLength) =>
    start < otherStart + otherLength - EPSILON && otherStart < start + length - EPSILON;
  const steps = (empty, overlapping) => (overlapping ? 0 : Math.round(empty / square) + 1);
  return {
    x: steps(gap.x, overlaps(a.x, a.width, b.x, b.width)),
    y: steps(gap.y, overlaps(a.y, a.height, b.y, b.height)),
    z: Math.round(gap.z / square)
  };
}

/**
 * Distance between two characters in feet, counted in squares from one to the other.
 * `diagonal` says what a diagonal step costs:
 *   "equal" (default) — the same as a straight step
 *   "alternating"     — every second diagonal step costs two
 *   "exact"           — straight-line distance between centres, rounded to the nearest square
 * A difference in height counts as a third axis.
 */
export function distanceFeet(a, b, { square = 5, diagonal = "equal" } = {}) {
  if (diagonal === "exact") {
    const p = centre(a),
      q = centre(b),
      straight = Math.hypot(p.x - q.x, p.y - q.y, (a.elevation ?? 0) - (b.elevation ?? 0));
    return Math.round(straight / square) * square;
  }
  const steps = squareSteps(a, b, square),
    sorted = [steps.x, steps.y, steps.z].sort((m, n) => n - m);
  const count = diagonal === "alternating" ? sorted[0] + Math.floor(sorted[1] / 2) : sorted[0];
  return count * square;
}

/**
 * Whether an attacker and an ally flank a target: they are on opposite sides of it, in line (p.341).
 * The line between the two flankers' centres has to cross the target's space from one side to the opposite side,
 * or from one corner to the opposite corner.
 */
export function flanking(attacker, ally, target) {
  const p = centre(attacker),
    q = centre(ally);
  const left = target.x,
    right = target.x + target.width,
    top = target.y,
    bottom = target.y + target.height;
  // Both flankers have to be outside the target's space, on different sides.
  const sides = point => ({
    left: point.x < left - EPSILON,
    right: point.x > right + EPSILON,
    top: point.y < top - EPSILON,
    bottom: point.y > bottom + EPSILON
  });
  const a = sides(p),
    b = sides(q);
  const opposite = (a.left && b.right) || (a.right && b.left) || (a.top && b.bottom) || (a.bottom && b.top);
  if (!opposite) return false;
  // The line between them has to pass through the middle of the target, not merely clip it.
  const middle = centre(target),
    length = Math.hypot(q.x - p.x, q.y - p.y);
  if (length < EPSILON) return false;
  const offLine = Math.abs((q.x - p.x) * (p.y - middle.y) - (p.x - middle.x) * (q.y - p.y)) / length;
  return offLine <= Math.min(target.width, target.height) * 0.25 + EPSILON;
}

/** Cover grades of Table 5.10, by index: none, 1/4, 1/2, 3/4, total. */
export const COVER = [
  { id: "none", defense: 0, reflex: 0 },
  { id: "quarter", defense: 2, reflex: 1 },
  { id: "half", defense: 4, reflex: 2 },
  { id: "threeQuarters", defense: 6, reflex: 3 },
  { id: "total", defense: 8, reflex: 4 }
];

/** The cover grade when `blocked` of `lines` sight lines to a target are stopped: a quarter per line in four. */
export function coverGrade(blocked, lines = 4) {
  if (!(lines > 0)) return 0;
  const fraction = Math.max(0, Math.min(1, blocked / lines));
  return Math.round(fraction * 4);
}

/** The points on a target the sight lines are drawn to: its four corners, pulled in a little from the edges. */
export function coverPoints(target, inset = 0.5) {
  const x1 = target.x + inset,
    x2 = target.x + target.width - inset,
    y1 = target.y + inset,
    y2 = target.y + target.height - inset;
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x1, y: y2 },
    { x: x2, y: y2 }
  ];
}

/**
 * Which blast increment a character stands in: 0 for Ground Zero, 1 for the next ring, and so on.
 * With the usual one-square increment Ground Zero is the origin square; a larger increment widens every ring.
 */
export function blastRing(origin, target, incrementFeet = 5) {
  const step = Math.max(5, Number(incrementFeet) || 5),
    steps = squareSteps(origin, target),
    squares = Math.max(steps.x, steps.y, steps.z);
  return Math.floor((squares * 5) / step);
}

/**
 * Everyone a blast reaches, nearest first.
 * @param {object} origin    Ground Zero's box
 * @param {{id: string, name: string, box: object}[]} tokens
 * @param {number} damage    the damage at Ground Zero
 * @returns {{id: string, name: string, ring: number, damage: number}[]} only those who take 1 or more
 */
export function blastTargets(origin, tokens, damage, incrementFeet = 5) {
  const hit = [];
  for (const token of tokens) {
    const ring = blastRing(origin, token.box, incrementFeet);
    let value = Math.max(0, Math.trunc(Number(damage) || 0));
    for (let i = 0; i < ring; i++) value = Math.floor(value / 2);
    if (value >= 1) hit.push({ id: token.id, name: token.name, ring, damage: value });
  }
  return hit.sort((a, b) => a.ring - b.ring || a.name.localeCompare(b.name));
}
