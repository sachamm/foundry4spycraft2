import test from "node:test";
import assert from "node:assert/strict";
import {
  COVER_FIRE,
  FIRE_ACTIONS,
  GRAPPLE_BENEFITS,
  autofireHits,
  blastDamage,
  blastIncrementFeet,
  blastProfile,
  burstHits,
  coverFireDC,
  coverFireOutcome,
  fireActionLimit,
  fireActionPlan,
  grappleAllowed,
  grappleBenefitText,
  grappleOutcome,
  grappleSizeBonus,
  grapplerLimit,
  pummelPlan,
  sizeDifference,
  strafeHits
} from "../module/rules/combat-actions.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { weaponAttack } from "../module/rules/gear.mjs";
import { coverFireTargetLabel, fireActionInput } from "../module/apps/combat-actions.mjs";

const auto = { firearm: true, fireMode: "auto", attackAction: "autofire", recoilPenalty: -3 };
const burstMode = { firearm: true, fireMode: "burst", attackAction: "standard", recoilPenalty: -2 };

test("no declared fire action plans nothing", () => {
  assert.equal(fireActionPlan(auto, {}), null);
  assert.equal(fireActionPlan(auto, { action: "" }), null);
});

test("a Burst is a 3-shot trick on a Standard Attack in Burst mode, error +1", () => {
  const plan = fireActionPlan(burstMode, { action: "burst", shotsRemaining: 12 });
  assert.equal(plan.blocked, false);
  assert.equal(plan.shots, 3);
  assert.equal(plan.error, 1);
  assert.equal(plan.attack, 0);
  assert.equal(fireActionPlan(burstMode, { action: "burst" }).blocked, false, "shots left may be unstated");
  assert.match(fireActionPlan(auto, { action: "burst" }).reason, /Burst mode/);
  assert.match(fireActionPlan({ ...burstMode, attackAction: "other" }, { action: "burst" }).reason, /Standard Attack/);
  assert.match(fireActionPlan(burstMode, { action: "burst", shotsRemaining: 2 }).reason, /3 shots/);
  assert.match(fireActionPlan({ firearm: false }, { action: "burst" }).reason, /firearm/);
  assert.match(fireActionPlan(burstMode, { action: "volley" }).reason, /listed fire action/);
});

test("Burst hits: one, two at Defense +5, three at Defense +10", () => {
  assert.equal(burstHits(14, 15), 0);
  assert.equal(burstHits(15, 15), 1);
  assert.equal(burstHits(19, 15), 1);
  assert.equal(burstHits(20, 15), 2);
  assert.equal(burstHits(24, 15), 2);
  assert.equal(burstHits(25, 15), 3);
  assert.equal(burstHits(40, 15), 3);
});

test("Autofire: up to a third of the shots left in volleys, 10 at most, -1 a volley and error +2", () => {
  assert.equal(fireActionLimit("autofire", 5), 0);
  assert.equal(fireActionLimit("autofire", 6), 2);
  assert.equal(fireActionLimit("autofire", 20), 6);
  assert.equal(fireActionLimit("autofire", 100), 10);
  const plan = fireActionPlan(auto, { action: "autofire", volleys: 4, shotsRemaining: 30 });
  assert.deepEqual(
    { blocked: plan.blocked, attack: plan.attack, error: plan.error, shots: plan.shots, volleys: plan.volleys },
    { blocked: false, attack: -4, error: 2, shots: 12, volleys: 4 }
  );
  assert.match(fireActionPlan(auto, { action: "autofire", volleys: 4, shotsRemaining: 9 }).reason, /1 to 3 volleys/);
  assert.match(fireActionPlan(auto, { action: "autofire", volleys: 1, shotsRemaining: 5 }).reason, /6 or more shots/);
  assert.match(fireActionPlan(auto, { action: "autofire", volleys: 1 }).reason, /shots left/);
  assert.match(fireActionPlan(burstMode, { action: "autofire", volleys: 1, shotsRemaining: 30 }).reason, /Full Auto/);
  assert.match(fireActionPlan(auto, { action: "autofire", volleys: 0, shotsRemaining: 30 }).reason, /1 to 10 volleys/);
});

test("Autofire hits: one, plus one per 4 over Defense, never more than the volleys fired", () => {
  assert.equal(autofireHits(14, 15, 5), 0);
  assert.equal(autofireHits(15, 15, 5), 1);
  assert.equal(autofireHits(18, 15, 5), 1);
  assert.equal(autofireHits(19, 15, 5), 2);
  assert.equal(autofireHits(27, 15, 5), 4);
  assert.equal(autofireHits(60, 15, 5), 5);
  assert.equal(autofireHits(60, 15, 1), 1);
  assert.equal(autofireHits(60, 15, 0), 0);
});

test("Strafe: squares from the shots left, recoil counted twice, error +2, Defense rising along the chain", () => {
  assert.equal(fireActionLimit("strafe", 8), 0);
  assert.equal(fireActionLimit("strafe", 9), 3);
  const plan = fireActionPlan({ ...auto, attackAction: "other" }, { action: "strafe", squares: 3, shotsRemaining: 30 });
  assert.equal(plan.blocked, false);
  assert.equal(plan.extraRecoil, -3);
  assert.match(plan.notes[0], /recoil penalty doubled \(-6 in all\)/);
  assert.equal(plan.error, 2);
  assert.equal(plan.shots, 9);
  assert.match(fireActionPlan(auto, { action: "strafe", squares: 4, shotsRemaining: 9 }).reason, /1 to 3 squares/);
  assert.deepEqual(strafeHits(20, [14, 16, 13, 12]), [
    { index: 0, defense: 14, raised: 16, hit: true },
    { index: 1, defense: 16, raised: 20, hit: true },
    { index: 2, defense: 13, raised: 19, hit: true },
    { index: 3, defense: 12, raised: 20, hit: true }
  ]);
  assert.deepEqual(
    strafeHits(18, [14, 16, 13]).map(r => r.hit),
    [true, false, false]
  );
});

test("a final attack from Suppressive Fire is one shot at -4", () => {
  const plan = fireActionPlan(
    { firearm: true, fireMode: "single", attackAction: "other" },
    { action: "suppressiveFinal" }
  );
  assert.equal(plan.attack, -4);
  assert.equal(plan.shots, 1);
  assert.equal(FIRE_ACTIONS.suppressiveFinal.attack, -4);
});

test("Cover Fire: Will DC 10 + ranged attack bonus; -4 on a failure, a final attack when failed by 5", () => {
  assert.equal(coverFireDC(7), 17);
  assert.equal(coverFireDC(-1), 9);
  assert.deepEqual(coverFireOutcome(17, 17), { failed: false, penalty: 0, finalAttack: false });
  assert.deepEqual(coverFireOutcome(17, 16), { failed: true, penalty: COVER_FIRE.penalty, finalAttack: false });
  assert.deepEqual(coverFireOutcome(17, 12), { failed: true, penalty: -4, finalAttack: true });
  assert.equal(COVER_FIRE.shots, 5);
});

test("blast damage halves, rounded down, with each increment until it drops below 1", () => {
  assert.equal(blastDamage(20, 0), 20);
  assert.equal(blastDamage(20, 1), 10);
  assert.equal(blastDamage(21, 2), 5);
  assert.equal(blastDamage(20, 5), 0);
  assert.deepEqual(blastProfile(20, 5), [
    { increment: 0, fromFeet: 0, toFeet: 5, damage: 20 },
    { increment: 1, fromFeet: 5, toFeet: 10, damage: 10 },
    { increment: 2, fromFeet: 10, toFeet: 15, damage: 5 },
    { increment: 3, fromFeet: 15, toFeet: 20, damage: 2 },
    { increment: 4, fromFeet: 20, toFeet: 25, damage: 1 }
  ]);
  assert.deepEqual(blastProfile(0), []);
  assert.equal(blastProfile(12, 25)[1].fromFeet, 25);
  assert.equal(blastIncrementFeet("BLS (25 ft.)"), 25);
  assert.equal(blastIncrementFeet("AP (4), BLS (10 ft.), TKD"), 10);
  assert.equal(blastIncrementFeet("BLS (1,000 ft.)"), 1000);
  assert.equal(blastIncrementFeet("FIN"), 5);
});

test("grapple: the bigger character gets +4 per Size step; a target more than one Size bigger cannot be grappled", () => {
  assert.equal(sizeDifference("Large", "Medium"), 1);
  assert.equal(sizeDifference("Small", "Large"), -2);
  assert.equal(sizeDifference("Odd", "Medium"), 0);
  assert.equal(grappleSizeBonus(2), 8);
  assert.equal(grappleSizeBonus(-1), 0);
  assert.equal(grappleAllowed(0), true);
  assert.equal(grappleAllowed(-1), true);
  assert.equal(grappleAllowed(-2), false);
  assert.equal(grapplerLimit(-1), 2);
  assert.equal(grapplerLimit(0), 4);
  assert.equal(grapplerLimit(1), 8);
  assert.equal(grapplerLimit(2), 0);
});

test("the opening grapple check holds, or pushes the attacker back flat-footed or sprawled", () => {
  const open = extra => grappleOutcome({ opening: true, total: 20, opponentTotal: 15, ...extra });
  assert.deepEqual({ winner: open().winner, benefits: open().benefits }, { winner: "actor", benefits: 0 });
  assert.equal(open({ critical: true }).benefits, 1);
  assert.equal(open({ opponentCriticalFailure: true }).benefits, 1);
  const lost = grappleOutcome({ opening: true, total: 12, opponentTotal: 15 });
  assert.equal(lost.winner, "opponent");
  assert.match(lost.effects[0], /flat-footed/);
  assert.match(
    grappleOutcome({ opening: true, total: 12, opponentTotal: 15, opponentCritical: true }).effects[0],
    /sprawled/
  );
  // A critical failure loses whatever the totals.
  assert.match(open({ criticalFailure: true }).effects[0], /sprawled/);
  assert.equal(grappleOutcome({ opening: true, total: 15, opponentTotal: 15 }).winner, "tie");
  assert.throws(() => grappleOutcome({ total: 15 }), /Both Athletics results/);
});

test("later grapple checks earn one benefit, two on a decisive win; every benefit has a name and summary", () => {
  assert.equal(grappleOutcome({ total: 20, opponentTotal: 15 }).benefits, 1);
  assert.equal(grappleOutcome({ total: 20, opponentTotal: 15, critical: true }).benefits, 2);
  const lost = grappleOutcome({ total: 10, opponentTotal: 15, criticalFailure: true });
  assert.equal(lost.winner, "opponent");
  assert.equal(lost.benefits, 2);
  assert.equal(GRAPPLE_BENEFITS.length, 13);
  for (const benefit of GRAPPLE_BENEFITS) {
    const [name, summary] = grappleBenefitText(benefit.id);
    assert.ok(name && summary, benefit.id);
    assert.ok(summary.length < 110, `${benefit.id}: a short summary`);
  }
});

test("Pummel is an unarmed Standard Attack; the knockout save rises by Strength, at least 1", () => {
  assert.equal(pummelPlan({ unarmed: true, attackAction: "standard" }, {}), null);
  assert.equal(
    pummelPlan({ unarmed: true, attackAction: "standard" }, { pummel: true, strengthMod: 3 }).saveIncrease,
    3
  );
  assert.equal(
    pummelPlan({ unarmed: true, attackAction: "standard" }, { pummel: true, strengthMod: -1 }).saveIncrease,
    1
  );
  assert.match(pummelPlan({ unarmed: false, attackAction: "standard" }, { pummel: true }).reason, /unarmed attack/);
  assert.match(pummelPlan({ unarmed: true, attackAction: "other" }, { pummel: true }).reason, /Standard Attack/);
});

/* ---- as part of an attack ---- */

const system = () => ({
  activeFeatNames: [],
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
  bab: 5,
  classLevels: {},
  conditionContext: {},
  proficiencies: Object.fromEntries(Object.keys(cfg.proficiencies).map(k => [k, { proficient: true, forte: false }])),
  unarmed: { threat: 20 }
});
const smg = {
  proficiency: "smg",
  range: 30,
  ammo: "30M3",
  weaponCategory: "submachineGun",
  fireModes: ["single", "burst", "auto"],
  fireMode: "auto",
  sizeHands: "S/2h",
  recoil: 18,
  qualities: "",
  damage: "1d10",
  error: 1,
  threat: 20,
  errorThreat: "1/20",
  quantity: 1,
  carried: true,
  equipped: true
};

test("an attack with Autofire declared takes its volley penalty and error; undeclared attacks are unchanged", () => {
  const plain = weaponAttack(system(), { ...smg }, cfg, "agent", { attackAction: "autofire", fireMode: "auto" });
  assert.equal(plain.blocked, false, plain.reason);
  assert.equal(plain.fireAction, null);
  const fired = weaponAttack(system(), { ...smg }, cfg, "agent", {
    attackAction: "autofire",
    fireMode: "auto",
    fireAction: "autofire",
    fireVolleys: 3,
    shotsRemaining: 30
  });
  assert.equal(fired.blocked, false, fired.reason);
  assert.equal(fired.total, plain.total - 3);
  assert.equal(fired.error, plain.error + 2);
  assert.equal(fired.fireAction.shots, 9);
  assert.match(fired.notes, /Autofire: 3 volley/);
  assert.ok(fired.modifiers.some(row => row.label === "Fire action" && row.value === -3));
});

test("a Strafe doubles the recoil penalty and a bad declaration blocks the attack with its reason", () => {
  const base = { attackAction: "other", fireMode: "auto" };
  const plain = weaponAttack(system(), { ...smg }, cfg, "agent", base);
  assert.ok(plain.recoilPenalty < 0, "this weapon kicks at Strength 14");
  const strafe = weaponAttack(system(), { ...smg }, cfg, "agent", {
    ...base,
    fireAction: "strafe",
    fireSquares: 2,
    shotsRemaining: 30
  });
  assert.equal(strafe.total, plain.total + plain.recoilPenalty);
  const refused = weaponAttack(system(), { ...smg }, cfg, "agent", {
    ...base,
    fireAction: "strafe",
    fireSquares: 5,
    shotsRemaining: 9
  });
  assert.equal(refused.blocked, true);
  assert.match(refused.reason, /1 to 3 squares/);
  const wrongMode = weaponAttack(system(), { ...smg }, cfg, "agent", {
    attackAction: "standard",
    fireMode: "auto",
    fireAction: "burst"
  });
  assert.match(wrongMode.reason, /Burst mode/);
});

test("Pummel joins an unarmed Standard Attack and is refused with a weapon", () => {
  const fist = {
    proficiency: "unarmed",
    damage: "1d3",
    qualities: "",
    error: 1,
    threat: 20,
    errorThreat: "1/20",
    sizeHands: "",
    quantity: 1
  };
  const pummel = weaponAttack(system(), fist, cfg, "agent", { attackAction: "standard", pummel: true });
  assert.equal(pummel.blocked, false, pummel.reason);
  assert.equal(pummel.pummel.saveIncrease, 2);
  assert.match(pummel.notes, /Pummel: a full action/);
  const armed = weaponAttack(system(), { ...smg }, cfg, "agent", {
    attackAction: "standard",
    fireMode: "single",
    pummel: true
  });
  assert.match(armed.reason, /unarmed attack/);
});

test("a fire action sets the fire mode it needs", () => {
  assert.equal(fireActionInput({ fireAction: "burst", fireMode: "single" }).fireMode, "burst");
  assert.equal(fireActionInput({ fireAction: "autofire", fireMode: "single" }).fireMode, "auto");
  assert.equal(fireActionInput({ fireAction: "strafe", fireMode: "burst" }).fireMode, "auto");
  assert.equal(Object.hasOwn(fireActionInput({ fireAction: "coverFire", fireMode: "single" }), "fireMode"), false);
  assert.equal(fireActionInput({ fireAction: "" }), null);
});

test("Cover Fire marks an unlinked token apart from its sheet", () => {
  assert.equal(coverFireTargetLabel({ name: "Guard", isToken: false }), "Guard");
  assert.equal(
    coverFireTargetLabel({ name: "Guard", isToken: true, token: { parent: { name: "Docks" } } }),
    "Guard (token on Docks)"
  );
  assert.equal(coverFireTargetLabel({ name: "Guard", isToken: true }), "Guard (token)");
});

test("the quick attack dialog reads an optional distance for a ranged weapon", async () => {
  const { rollPipeline } = await import("../module/rolls/index.mjs");
  const actor = { system: { conditionContext: {}, classLevels: {} }, items: [] };
  const read = entered =>
    rollPipeline.read({ dialog: "attack", actor, item: { system: { range: 30 } }, needsCQB: false, entered }, {});
  assert.equal(read({ distanceFeet: 80 }).distanceFeet, 80);
  assert.equal(read({ distanceFeet: "45" }).distanceFeet, 45);
  assert.equal(Object.hasOwn(read({ distanceFeet: "" }), "distanceFeet"), false, "empty stays a quick roll");
  assert.equal(Object.hasOwn(read({ distanceFeet: null }), "distanceFeet"), false);
  assert.throws(() => read({ distanceFeet: -5 }), /nonnegative/);
  const melee = rollPipeline.read(
    { dialog: "attack", actor, item: { system: { range: 0 } }, needsCQB: false, entered: { distanceFeet: 10 } },
    {}
  );
  assert.equal(Object.hasOwn(melee, "distanceFeet"), false, "a melee weapon has no range modifier");
});

test("the ordinary attack dialog offers a firearm's fire actions and reads them (B-028)", async () => {
  const { rollPipeline } = await import("../module/rules/roll-pipeline.mjs");
  globalThis.foundry ??= { utils: { escapeHTML: String } };
  globalThis.game ??= { user: { targets: new Set() }, actors: [], scenes: [], canvas: null };
  const item = { name: "Carbine", system: { ammo: "30 box" } };
  const actor = { system: { activeFeatNames: [] }, weaponAttack: () => ({ firearm: true, modes: ["single", "auto"] }) };
  const piece = rollPipeline.dialog({ dialog: "attack", actor, item, options: {} });
  assert.match(piece, /name="fireAction"/);
  assert.match(piece, /value="autofire"/);
  assert.doesNotMatch(piece, /value="burst"/);
  const melee = rollPipeline.dialog({
    dialog: "attack",
    actor: { ...actor, weaponAttack: () => ({}) },
    item,
    options: {}
  });
  assert.doesNotMatch(melee, /name="fireAction"/);
  const read = rollPipeline.read(
    { dialog: "attack", actor, item, entered: { fireAction: "autofire", fireCount: "2", situationalModifier: "0" } },
    {}
  );
  assert.equal(read.fireAction, "autofire");
  assert.equal(read.fireVolleys, 2);
  assert.equal(read.attackAction, "autofire");
});
