import test from "node:test";
import assert from "node:assert/strict";
import {
  COVER,
  adjacent,
  blastRing,
  blastTargets,
  coverGrade,
  coverPoints,
  distanceFeet,
  flanking,
  gapFeet,
  squareSteps,
  tokenBox,
  withinReach
} from "../module/rules/map.mjs";

const grid = { size: 100, distance: 5 };
/** A token by its square (column, row), one square wide unless said otherwise. */
const at = (column, row, { squares = 1, elevation = 0 } = {}) =>
  tokenBox({ x: column * 100, y: row * 100, width: squares, height: squares, elevation }, grid);

test("a token's space is measured in feet from its pixels and squares", () => {
  assert.deepEqual(at(2, 3), { x: 10, y: 15, width: 5, height: 5, elevation: 0 });
  assert.deepEqual(at(0, 0, { squares: 2, elevation: 10 }), { x: 0, y: 0, width: 10, height: 10, elevation: 10 });
  assert.throws(() => tokenBox({ x: 0, y: 0 }, { size: 0, distance: 5 }), /grid needs/);
});

test("gaps and steps count the squares between two tokens", () => {
  assert.deepEqual(gapFeet(at(0, 0), at(1, 0)), { x: 0, y: 0, z: 0 });
  assert.deepEqual(gapFeet(at(0, 0), at(3, 0)), { x: 10, y: 0, z: 0 });
  assert.deepEqual(squareSteps(at(0, 0), at(0, 0)), { x: 0, y: 0, z: 0 });
  assert.deepEqual(squareSteps(at(0, 0), at(1, 1)), { x: 1, y: 1, z: 0 });
  assert.deepEqual(squareSteps(at(0, 0), at(4, 2)), { x: 4, y: 2, z: 0 });
  // A large token is measured from its nearest edge.
  assert.deepEqual(squareSteps(at(0, 0, { squares: 2 }), at(3, 0)), { x: 2, y: 0, z: 0 });
});

test("distance is counted in squares, with the chosen cost for diagonals and height", () => {
  assert.equal(distanceFeet(at(0, 0), at(0, 0)), 0);
  assert.equal(distanceFeet(at(0, 0), at(1, 0)), 5);
  assert.equal(distanceFeet(at(0, 0), at(1, 1)), 5);
  assert.equal(distanceFeet(at(0, 0), at(6, 0)), 30);
  assert.equal(distanceFeet(at(0, 0), at(6, 4)), 30);
  assert.equal(distanceFeet(at(0, 0), at(6, 4), { diagonal: "alternating" }), 40);
  assert.equal(distanceFeet(at(0, 0), at(3, 4), { diagonal: "exact" }), 25);
  assert.equal(distanceFeet(at(0, 0), at(1, 0, { elevation: 30 })), 30);
  assert.equal(distanceFeet(at(0, 0, { squares: 2 }), at(4, 0)), 15);
});

test("adjacent means the next square over at about the same height; reach extends it", () => {
  assert.equal(adjacent(at(0, 0), at(1, 0)), true);
  assert.equal(adjacent(at(0, 0), at(1, 1)), true);
  assert.equal(adjacent(at(0, 0), at(2, 0)), false);
  assert.equal(adjacent(at(0, 0), at(1, 0, { elevation: 10 })), false);
  assert.equal(adjacent(at(0, 0, { squares: 2 }), at(2, 1)), true);
  assert.equal(withinReach(at(0, 0), at(2, 0), 10), true);
  assert.equal(withinReach(at(0, 0), at(3, 0), 10), false);
});

test("two opponents flank a target only from directly opposite sides or corners", () => {
  const target = at(5, 5);
  assert.equal(flanking(at(4, 5), at(6, 5), target), true, "left and right");
  assert.equal(flanking(at(5, 4), at(5, 6), target), true, "above and below");
  assert.equal(flanking(at(4, 4), at(6, 6), target), true, "opposite corners");
  assert.equal(flanking(at(4, 5), at(6, 6), target), false, "side and far corner");
  assert.equal(flanking(at(4, 5), at(5, 4), target), false, "neighbouring sides");
  assert.equal(flanking(at(4, 5), at(4, 5), target), false, "the same place");
  assert.equal(flanking(at(4, 5), at(3, 5), target), false, "both on one side");
  // At range the line still has to pass through the target.
  assert.equal(flanking(at(1, 5), at(9, 5), target), true);
  assert.equal(flanking(at(1, 5), at(9, 7), target), false);
  // A large target is flanked across its whole body.
  const big = at(5, 5, { squares: 2 });
  assert.equal(flanking(at(4, 5), at(7, 6), big), true);
  assert.equal(flanking(at(4, 5), at(7, 5), big), true, "across one of its rows");
  assert.equal(flanking(at(4, 5), at(7, 3), big), false, "the line misses its body");
});

test("cover is a quarter for each blocked sight line in four, with Table 5.10's bonuses", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4].map(blocked => COVER[coverGrade(blocked)].id),
    ["none", "quarter", "half", "threeQuarters", "total"]
  );
  assert.deepEqual(
    COVER.map(cover => [cover.defense, cover.reflex]),
    [
      [0, 0],
      [2, 1],
      [4, 2],
      [6, 3],
      [8, 4]
    ]
  );
  assert.equal(coverGrade(9, 4), 4);
  assert.equal(coverGrade(1, 0), 0);
  assert.deepEqual(coverPoints(at(0, 0)), [
    { x: 0.5, y: 0.5 },
    { x: 4.5, y: 0.5 },
    { x: 0.5, y: 4.5 },
    { x: 4.5, y: 4.5 }
  ]);
});

test("a blast halves with each ring out from Ground Zero and lists only those it still hurts", () => {
  const origin = at(5, 5);
  assert.equal(blastRing(origin, at(5, 5)), 0);
  assert.equal(blastRing(origin, at(6, 6)), 1);
  assert.equal(blastRing(origin, at(8, 5)), 3);
  // A 10-ft. increment covers two squares a ring.
  assert.equal(blastRing(origin, at(6, 5), 10), 0);
  assert.equal(blastRing(origin, at(7, 5), 10), 1);
  assert.equal(blastRing(origin, at(9, 5), 10), 2);
  const tokens = [
    { id: "far", name: "Far", box: at(10, 5) },
    { id: "near", name: "Near", box: at(6, 5) },
    { id: "zero", name: "Zero", box: at(5, 5) },
    { id: "mid", name: "Mid", box: at(7, 6) },
    { id: "up", name: "Up", box: at(5, 5, { elevation: 15 }) }
  ];
  assert.deepEqual(blastTargets(origin, tokens, 20), [
    { id: "zero", name: "Zero", ring: 0, damage: 20 },
    { id: "near", name: "Near", ring: 1, damage: 10 },
    { id: "mid", name: "Mid", ring: 2, damage: 5 },
    { id: "up", name: "Up", ring: 3, damage: 2 }
  ]);
  assert.deepEqual(blastTargets(origin, tokens, 0), []);
});

/* ---- on a scene ---- */

const token = (id, name, column, row, { disposition = 1, controlled = false, actorUuid = `Actor.${id}` } = {}) => ({
  id,
  name,
  controlled,
  document: { x: column * 100, y: row * 100, width: 1, height: 1, elevation: 0, disposition, hidden: false },
  actor: { uuid: actorUuid, statuses: new Set() }
});

test("an attack is measured from the character's token to the single targeted token", async () => {
  const hero = token("h", "Hero", 4, 5, { controlled: true }),
    ally = token("a", "Ally", 6, 5),
    bystander = token("b", "Bystander", 5, 4),
    guard = token("g", "Guard", 5, 5, { disposition: -1 }),
    far = token("f", "Sniper", 20, 5, { disposition: -1 });
  const walls = [];
  globalThis.CONST = { GRID_DIAGONALS: { EQUIDISTANT: 0, EXACT: 1, ALTERNATING_1: 4 } };
  globalThis.CONFIG = {
    Canvas: { polygonBackends: { sight: { testCollision: (a, b) => walls.some(blocks => blocks(a, b)) } } }
  };
  globalThis.canvas = {
    ready: true,
    scene: { grid: { distance: 5 } },
    grid: { size: 100, distance: 5, diagonals: 0 },
    tokens: { placeables: [hero, ally, bystander, guard, far] }
  };
  globalThis.game = { settings: { get: () => true }, user: { targets: new Set([guard]) } };
  const { measureAttack, measurementLine, applyMeasurement, mapAvailable } = await import("../module/apps/map.mjs");
  const actor = { system: { cqbRange: 30 }, getActiveTokens: () => [hero] };
  assert.equal(mapAvailable(), true);

  const melee = measureAttack(actor);
  assert.deepEqual(
    {
      d: melee.distanceFeet,
      adjacent: melee.adjacent,
      flanked: melee.flanked,
      flankers: melee.flankers,
      cover: melee.coverId
    },
    { d: 5, adjacent: true, flanked: true, flankers: ["Ally"], cover: "none" }
  );
  assert.equal(melee.targetActorUuid, "Actor.g");
  assert.match(measurementLine(melee), /5 ft\. to Guard; adjacent; flanking with Ally; no cover from walls/);

  // Two squares away with an ally opposite: a ranged attacker flanks, a melee one only within its Reach (p.341).
  const back = token("k", "Hero at range", 3, 5, { controlled: true });
  canvas.tokens.placeables.push(back);
  const ranged = { system: { cqbRange: 30 }, getActiveTokens: () => [back] };
  assert.equal(measureAttack(ranged).flanked, true);
  assert.equal(measureAttack(ranged, { melee: true }).flanked, false);
  assert.equal(measureAttack(ranged, { melee: true, reachFeet: 10 }).flanked, true);
  canvas.tokens.placeables.pop();

  // A far target: measured, not adjacent, nobody opposite.
  game.user.targets = new Set([far]);
  const shot = measureAttack(actor);
  assert.equal(shot.distanceFeet, 80);
  assert.equal(shot.adjacent, false);
  assert.equal(shot.flanked, false);
  // A wall across the lower half of the line of fire blocks two of the four sight lines.
  walls.push((a, b) => b.y > 550);
  assert.equal(measureAttack(actor).coverId, "half");
  walls.length = 0;

  // No target, two targets, or no token: nothing is measured.
  game.user.targets = new Set();
  assert.equal(measureAttack(actor), null);
  game.user.targets = new Set([guard, far]);
  assert.equal(measureAttack(actor), null);
  game.user.targets = new Set([guard]);
  assert.equal(measureAttack({ system: {}, getActiveTokens: () => [] }), null);
  // Turned off in the settings.
  game.settings.get = () => false;
  assert.equal(measureAttack(actor), null);
  game.settings.get = () => true;

  // Filling a dialog: empty fields take the measurement, filled ones are kept, missing ones are skipped.
  const fields = {
    distanceFeet: { value: "" },
    targetFlanked: { checked: false },
    targetActorUuid: { value: "", options: [{ value: "" }, { value: "Actor.g" }] }
  };
  const element = { querySelector: selector => fields[selector.match(/name="(\w+)"/)?.[1]] ?? null };
  assert.equal(applyMeasurement(element, melee), true);
  assert.equal(fields.distanceFeet.value, "5");
  assert.equal(fields.targetFlanked.checked, true);
  assert.equal(fields.targetActorUuid.value, "Actor.g");
  fields.distanceFeet.value = "40";
  applyMeasurement(element, shot);
  assert.equal(fields.distanceFeet.value, "40", "what the player typed stays");
  assert.equal(applyMeasurement(null, melee), false);
  assert.equal(applyMeasurement(element, null), false);
});

test("a blast has one ring for each halving that still does damage", async () => {
  const { blastRings } = await import("../module/rules/map.mjs");
  assert.equal(blastRings(0), 0);
  assert.equal(blastRings(1), 1);
  assert.equal(blastRings(8), 4);
  assert.equal(blastRings(20), 5);
});

test("characters between an attacker and a target stand in the line of fire", async () => {
  const { inLineOfFire, lineCrossesBox } = await import("../module/rules/map.mjs");
  const box = (x, y) => ({ x, y, width: 5, height: 5 });
  const attacker = box(0, 0),
    target = box(30, 0);
  const others = [
    { id: "mid", name: "Between", box: box(15, 0) },
    { id: "side", name: "Beside", box: box(15, 5) },
    { id: "far", name: "Beyond", box: box(40, 0) }
  ];
  assert.deepEqual(inLineOfFire(attacker, target, others), [{ id: "mid", name: "Between" }]);
  // A diagonal shot crosses the squares on the diagonal, not the ones it only touches at a corner.
  assert.deepEqual(
    inLineOfFire(box(0, 0), box(20, 20), [
      { id: "d", name: "Diagonal", box: box(10, 10) },
      { id: "c", name: "Corner", box: box(10, 0) }
    ]).map(row => row.id),
    ["d"]
  );
  assert.equal(lineCrossesBox({ x: 0, y: 5 }, { x: 30, y: 5 }, box(10, 5)), false, "along an edge");
  assert.equal(lineCrossesBox({ x: 0, y: 6 }, { x: 30, y: 6 }, box(10, 5)), true);
  assert.deepEqual(inLineOfFire(attacker, target, undefined), []);
});
