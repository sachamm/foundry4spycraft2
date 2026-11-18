import test from "node:test";
import assert from "node:assert/strict";
import {
  startConflict,
  availableStrategies,
  chooseStrategy,
  strategyModifier,
  resolveCheck,
  advantageOptions,
  conflictRatings,
  photoFinish,
  useConflictFeat,
  CONFLICT_FEATS,
  guessStrategy,
  instinctPenalty,
  roomFeatFor,
  easedRoom
} from "../module/rules/gc/conflict.mjs";

const chase = (pFeats = [], qFeats = [], lead = 5, ratings = { Acceleration: 5, Turning: 5 }) =>
  startConflict("chase", {
    lead,
    predator: { name: "P", ratings, feats: pFeats },
    prey: { name: "Q", ratings, feats: qFeats }
  });
const strategies = (c, side) => Object.fromEntries(availableStrategies(c, side).map(s => [s.id, s]));

test("only the tracked chase feats are kept on a side", () => {
  assert.deepEqual(chase(["Daredevil", "Quick Draw"]).predator.feats, ["Daredevil"]);
  assert.equal(CONFLICT_FEATS.length, 14);
});

test("Jackrabbit Start and Relentless Pursuit move the starting Lead by 2, inside the track", () => {
  assert.equal(chase([], ["Jackrabbit Start"]).lead, 7);
  assert.equal(chase(["Relentless Pursuit"]).lead, 3);
  assert.equal(chase(["Relentless Pursuit"], ["Jackrabbit Start"]).lead, 5);
  assert.equal(chase([], ["Jackrabbit Start"], 8).lead, 9);
  assert.equal(chase(["Relentless Pursuit"], [], 2).lead, 1);
  assert.deepEqual(chase([], ["Jackrabbit Start"]).startingLeadFeats, { before: 5, shift: 2 });
  const manhunt = startConflict("manhunt", { lead: 5, prey: { feats: ["Jackrabbit Start"] } });
  assert.equal(manhunt.lead, 7);
  const seduction = startConflict("seduction", { lead: 5, prey: { feats: ["Jackrabbit Start"] } });
  assert.equal(seduction.lead, 5, "other Conflicts are unaffected");
});

test("with Jackrabbit Start or Relentless Pursuit, every won Strategy offers the Lead Advantage", () => {
  const play = (pFeats, qFeats, winner) => {
    let c = chase(pFeats, qFeats);
    c = chooseStrategy(c, "predator", "set-up");
    c = chooseStrategy(c, "prey", "set-up");
    return advantageOptions(
      resolveCheck(c, {
        predator: { result: winner === "predator" ? 20 : 10 },
        prey: { result: winner === "prey" ? 20 : 10 }
      })
    ).map(a => a.id);
  };
  assert.deepEqual(play([], [], "prey").sort(), ["stress", "twist"]);
  assert.ok(play([], ["Jackrabbit Start"], "prey").includes("lead"));
  assert.ok(play(["Relentless Pursuit"], [], "predator").includes("lead"));
  assert.ok(!play(["Relentless Pursuit"], [], "prey").includes("lead"), "only for the side with the feat");
});

test("Daredevil chooses Strategies as if Acceleration and Turning were 2 higher, and opens Stunt", () => {
  const low = { Acceleration: 4, Turning: 4 };
  assert.equal(strategies(chase([], [], 5, low), "predator")["stunt"].available, false);
  const dd = strategies(chase(["Daredevil"], [], 5, low), "predator");
  assert.equal(dd["stunt"].available, true);
  assert.equal(dd["stunt"].confirm, "");
  assert.equal(dd["redline"].available, true, "Acceleration 6+ met as 4 + 2");
  assert.equal(dd["cut-off"].available, false, "7+ still out of reach");
  assert.ok(strategies(chase(), "predator")["stunt"].confirm, "without the feat the GC must confirm it");
  assert.deepEqual(chase(["Daredevil"], [], 5, low).predator.ratings, low, "stored ratings are unchanged");
});

test("Defensive and Offensive Driving halve their side's Strategy penalties, rounded down", () => {
  const pick = (pFeats, qFeats, p, q) => {
    let c = chase(pFeats, qFeats, 5, { Acceleration: 9, Turning: 9 });
    c = chooseStrategy(c, "predator", p);
    return chooseStrategy(c, "prey", q);
  };
  const plain = pick([], [], "cut-off", "long-gone");
  assert.equal(strategyModifier(plain, "predator"), -12);
  assert.equal(strategyModifier(plain, "prey"), -12);
  const driven = pick(["Offensive Driving"], ["Defensive Driving"], "cut-off", "long-gone");
  assert.equal(strategyModifier(driven, "predator"), -6);
  assert.equal(strategyModifier(driven, "prey"), -6);
  const general = pick(["Offensive Driving"], ["Defensive Driving"], "set-up", "set-up");
  assert.equal(strategyModifier(general, "predator"), -4, "general Strategies are not Predator Strategies");
  const wrongSide = pick(["Defensive Driving"], [], "close-in", "set-up");
  assert.equal(strategyModifier(wrongSide, "predator"), -2, "Defensive Driving covers Prey Strategies only");
  const bonus = pick(["Offensive Driving"], [], "redline", "set-up");
  assert.equal(strategyModifier(bonus, "predator"), 2, "bonuses are unchanged");
  const odd = pick([], ["Defensive Driving"], "set-up", "chicken");
  assert.equal(strategyModifier(odd, "prey"), -2);
});

test("Defensive and Offensive Driving each have one use per chase", () => {
  const c = chase(["Offensive Driving"], ["Defensive Driving"]);
  const used = useConflictFeat(c, "prey", "Defensive Driving");
  assert.match(used.note, /Defensive Driving: forces 1 opponent/);
  assert.deepEqual(used.next.featUses, { prey: ["Defensive Driving"] });
  assert.throws(() => useConflictFeat(used.next, "prey", "Defensive Driving"), /already used/);
  assert.match(useConflictFeat(used.next, "predator", "Offensive Driving").note, /ignores 1 Crisis/);
  assert.throws(() => useConflictFeat(c, "predator", "Defensive Driving"), /no once-per-chase use/);
  assert.throws(() => useConflictFeat(c, "prey", "Daredevil"), /no once-per-chase use/);
});

test("Photo Finish lowers every participant's Acceleration and Turning by 2 and survives a ratings refresh", () => {
  const c = chase(["Photo Finish"], [], 5, { Acceleration: 7, Turning: 3 }),
    once = photoFinish(c, "predator");
  assert.deepEqual(conflictRatings(once, "predator"), { Acceleration: 5, Turning: 1 });
  assert.deepEqual(conflictRatings(once, "prey"), { Acceleration: 5, Turning: 1 });
  const twice = photoFinish(once, "predator");
  assert.deepEqual(conflictRatings(twice, "prey"), { Acceleration: 3, Turning: 0 });
  assert.equal(strategies(once, "predator")["cut-off"].available, false, "availability uses the lowered ratings");
  assert.deepEqual(once.predator.ratings, { Acceleration: 7, Turning: 3 }, "stored ratings stay as refreshed");
  assert.throws(() => photoFinish(c, "prey"), /Photo Finish needs/);
});

test("Breaking Points and Hold Out: interrogation or brainwashing Lead ±1 and any Strategy of their own list", async () => {
  const { declarePace } = await import("../module/rules/gc/conflict.mjs");
  const talk = (pFeats = [], qFeats = []) =>
    startConflict("interrogation", {
      lead: 5,
      predator: { ratings: { "Base Will Save": 0 }, feats: pFeats },
      prey: { ratings: { "Base Will Save": 0 }, feats: qFeats }
    });
  assert.equal(talk(["Breaking Points"]).lead, 4);
  assert.equal(talk([], ["Hold Out"]).lead, 6);
  assert.equal(startConflict("chase", { lead: 5, predator: { feats: ["Breaking Points"] } }).lead, 5, "not in a chase");
  const plain = strategies(talk(), "predator"),
    broken = strategies(talk(["Breaking Points"]), "predator");
  assert.equal(plain["worse-cop"].available, false);
  assert.equal(broken["worse-cop"].available, true);
  assert.equal(broken["worse-cop"].confirm, "", "the printed extra requirement is waived too");
  assert.equal(strategies(talk([], ["Hold Out"]), "prey")["the-5th"].available, true);
  assert.equal(strategies(talk(["Breaking Points"]), "prey")["the-5th"].available, false, "only the side's own list");

  const paced = declarePace(talk(["Breaking Points"], ["Hold Out"]), "predator");
  assert.match(paced.note, /half its usual time.*\+1 error range/);
  assert.deepEqual(paced.next.pace, { round: 1, sides: ["predator"] });
  assert.match(declarePace(paced.next, "prey").note, /twice its usual time/);
  assert.throws(() => declarePace(paced.next, "predator"), /Already declared/);
  assert.throws(() => declarePace(talk(), "predator"), /cannot change/);
});

test("Bail Out! opens Long Gone to the Prey whatever its ratings, with the crash to confirm", () => {
  assert.equal(strategies(chase(), "prey")["long-gone"].available, false);
  const open = strategies(chase([], ["Bail Out!"]), "prey")["long-gone"];
  assert.equal(open.available, true);
  assert.match(open.confirm, /crashes at the end of this Conflict round/);
  assert.throws(() => chooseStrategy(chase([], ["Bail Out!"]), "prey", "long-gone"), /must confirm/);
  assert.equal(
    chooseStrategy(chase([], ["Bail Out!"]), "prey", "long-gone", { confirmOther: true }).prey.strategy,
    "long-gone"
  );
});

test("Driving Instincts: a right guess costs the opponent the guesser's Chase feats on this check", () => {
  let c = chase(["Driving Instincts"]);
  const preyPick = Object.values(strategies(c, "prey")).find(s => s.available && !s.confirm).id;
  c = guessStrategy(c, "predator", preyPick, 3);
  assert.throws(() => guessStrategy(c, "predator", preyPick, 3), /Already/);
  assert.throws(() => guessStrategy(chase(), "predator", preyPick, 3), /needs a chase participant/);
  const before = strategyModifier(c, "prey");
  const predatorPick = Object.values(strategies(c, "predator")).find(s => s.available && !s.confirm).id;
  c = chooseStrategy(chooseStrategy(c, "prey", preyPick), "predator", predatorPick);
  assert.equal(instinctPenalty(c, "prey"), 3);
  assert.equal(instinctPenalty(c, "predator"), 0);
  assert.equal(strategyModifier(c, "prey"), strategyModifier({ ...c, instinct: null }, "prey") - 3);
  assert.ok(Number.isFinite(before));
  assert.throws(() => guessStrategy(c, "predator", preyPick, 3), /before the Strategies are revealed/);
});

test("Dash, Lane Dancer, Mount Up and Wind Rider ease the room for their own way of moving", () => {
  assert.equal(roomFeatFor(["Dash"], { kind: "foot" }), "Dash");
  assert.equal(roomFeatFor(["Dash"], { kind: "vehicle", vehicleClass: "SGV" }), "");
  assert.equal(roomFeatFor(["Lane Dancer"], { kind: "vehicle", vehicleClass: "SGV" }), "Lane Dancer");
  assert.equal(roomFeatFor(["Lane Dancer"], { kind: "vehicle", vehicleClass: "RWA" }), "");
  assert.equal(roomFeatFor(["Wind Rider"], { kind: "vehicle", vehicleClass: "RWA" }), "Wind Rider");
  assert.equal(roomFeatFor(["Mount Up"], { kind: "vehicle", vehicleClass: "M/AD" }), "Mount Up");
  assert.deepEqual(["tight", "close", "crowded", "open"].map(easedRoom), ["close", "open", "crowded", "open"]);
});

test("Dash: a Run covers Speed × 5", async () => {
  const { combatMovementRules } = await import("../module/rules/combat-movement.mjs");
  assert.equal(combatMovementRules({ speed: 30, activeFeatNames: ["Dash"] }).runFeet, 150);
  assert.equal(combatMovementRules({ speed: 30, activeFeatNames: [] }).runFeet, 120);
});
