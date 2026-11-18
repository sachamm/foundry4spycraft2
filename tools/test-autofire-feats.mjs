import test from "node:test";
import assert from "node:assert/strict";
import { fireActionPlan, burstHits, autofireHits, strafeHits } from "../module/rules/combat-actions.mjs";
import { roundActionSpecs } from "../module/rules/feat-free-actions.mjs";
import { autofireMasteryUsed } from "../module/apps/autofire.mjs";

const facts = (feats = [], fireMode = "single") => ({ firearm: true, fireMode, attackAction: "standard", feats });

test("Two-Shot Burst: Autofire Basics, Single-Shot or Burst mode, 2 shots, never a third hit", () => {
  const plan = fireActionPlan(facts(["Autofire Basics"]), { action: "twoShotBurst" });
  assert.deepEqual([plan.blocked, plan.shots, plan.error], [false, 2, 1]);
  assert.equal(fireActionPlan(facts(["Autofire Basics"], "burst"), { action: "twoShotBurst" }).blocked, false);
  assert.ok(fireActionPlan(facts(["Autofire Basics"], "auto"), { action: "twoShotBurst" }).blocked);
  assert.ok(fireActionPlan(facts([]), { action: "twoShotBurst" }).blocked);
  assert.ok(fireActionPlan(facts(["Autofire Basics"]), { action: "twoShotBurst", shotsRemaining: 1 }).blocked);
  assert.equal(burstHits(30, 15, 2), 2, "capped at two hits");
  assert.equal(burstHits(30, 15), 3);
  assert.equal(burstHits(16, 15, 2), 1);
});

test("Autofire Basics: Cover Fire as a half action once per round", () => {
  const spec = roundActionSpecs({ activeFeatNames: ["Autofire Basics"] }).find(s => s.id === "autofireBasics");
  assert.deepEqual([spec.limit, spec.period], [1, "round"]);
  assert.match(spec.name, /Cover Fire as a half action/);
});

test("Autofire Mastery: no extra error range for Burst or Two-Shot Burst; one teammate bonus per opponent per round", () => {
  assert.equal(fireActionPlan(facts([], "burst"), { action: "burst" }).error, 1);
  assert.equal(fireActionPlan(facts(["Autofire Mastery"], "burst"), { action: "burst" }).error, 0);
  assert.equal(fireActionPlan(facts(["Autofire Basics", "Autofire Mastery"]), { action: "twoShotBurst" }).error, 0);
  const posted = [
    {
      flags: {
        spycraft2: { actorUuid: "Actor.a", autofireMastery: { targetUuid: "Actor.t", combatId: "c", round: 2 } }
      }
    }
  ];
  assert.ok(autofireMasteryUsed(posted, "Actor.a", "Actor.t", { id: "c", round: 2 }));
  assert.equal(autofireMasteryUsed(posted, "Actor.a", "Actor.t", { id: "c", round: 3 }), false);
  assert.equal(autofireMasteryUsed(posted, "Actor.a", "Actor.u", { id: "c", round: 2 }), false);
});

test("Autofire Supremacy: an extra hit per 3 points over Defense, and +1 per strafed target", () => {
  assert.equal(autofireHits(27, 15, 10), 4, "standard: 1 + 12/4");
  assert.equal(autofireHits(27, 15, 10, { perPoints: 3 }), 5, "Supremacy: 1 + 12/3");
  assert.deepEqual(
    strafeHits(18, [15, 15, 15], { step: 1 }).map(r => r.hit),
    [true, true, true]
  );
  assert.deepEqual(
    strafeHits(18, [15, 15, 15]).map(r => r.hit),
    [true, false, false]
  );
});

test("Flamethrower Basics: half the shots, rounded up, and the shots left count double", () => {
  const flame = (feats, extra = {}) => ({ ...facts(feats, "auto"), flamethrower: true, ...extra });
  const plan = fireActionPlan(flame(["Flamethrower Basics"]), { action: "autofire", volleys: 3, shotsRemaining: 5 });
  assert.deepEqual([plan.blocked, plan.shots], [false, 5], "9 shots become 5; 5 left allow 3 volleys");
  assert.match(plan.notes.at(-1), /Flamethrower Basics/);
  assert.ok(fireActionPlan(flame([]), { action: "autofire", volleys: 3, shotsRemaining: 5 }).blocked);
  assert.equal(
    fireActionPlan(flame(["Flamethrower Basics"], { fireMode: "burst" }), { action: "burst", shotsRemaining: 2 }).shots,
    2
  );
  assert.equal(
    fireActionPlan({ ...facts(["Flamethrower Basics"], "burst") }, { action: "burst", shotsRemaining: 3 }).shots,
    3,
    "other firearms are unchanged"
  );
});

test("Steel Rain: hurled weapons without a blast increment take Burst, Cover Fire and Suppressive Fire", async () => {
  const { steelRainWeapon } = await import("../module/rules/combat-actions.mjs");
  const { fireActionContent } = await import("../module/apps/combat-actions.mjs");
  const rain = { activeFeatNames: ["Steel Rain"] };
  assert.ok(steelRainWeapon(rain, { proficiency: "hurled", qualities: "" }));
  assert.equal(steelRainWeapon(rain, { proficiency: "hurled", qualities: "BLS (10 ft.)" }), false);
  assert.equal(steelRainWeapon(rain, { proficiency: "edged" }), false);
  assert.equal(steelRainWeapon({ activeFeatNames: [] }, { proficiency: "hurled" }), false);
  const html = fireActionContent({ firearm: false }, { system: { proficiency: "hurled" } }, { system: rain });
  assert.match(html, /Steel Rain/);
  assert.match(html, /value="coverFire"/);
  assert.doesNotMatch(html, /value="autofire"/);
  assert.equal(fireActionContent({ firearm: false }, { system: { proficiency: "hurled" } }, { system: {} }), "");
  const plan = fireActionPlan(
    { firearm: true, fireMode: "burst", attackAction: "standard", feats: ["Steel Rain"] },
    { action: "burst", shotsRemaining: 3 }
  );
  assert.deepEqual([plan.blocked, plan.shots], [false, 3]);
});

test("Rock and Roll!: 2 shots a volley, up to half the shots left", () => {
  const rock = fireActionPlan(facts(["Rock and Roll"], "auto"), {
    action: "autofire",
    volleys: 12,
    shotsRemaining: 25
  });
  assert.deepEqual([rock.blocked, rock.shots], [false, 24]);
  assert.ok(
    fireActionPlan(facts(["Rock and Roll"], "auto"), { action: "autofire", volleys: 13, shotsRemaining: 25 }).blocked
  );
  assert.equal(
    fireActionPlan(facts(["Rock and Roll"], "auto"), { action: "autofire", volleys: 2, shotsRemaining: 4 }).blocked,
    false
  );
  assert.ok(
    fireActionPlan(facts([], "auto"), { action: "autofire", volleys: 12, shotsRemaining: 40 }).blocked,
    "10 at most"
  );
});

test("Called Shot: armor penalty, Sharpshooter Mastery reduction and its requirements", async () => {
  const { calledShotPlan } = await import("../module/rules/called-shot.mjs");
  const ranged = { calledShot: "moderate", calledShotHelmet: true, ranged: true, aimed: true };
  assert.equal(calledShotPlan({ activeFeatNames: [] }, ranged).attackPenalty, -7);
  assert.equal(calledShotPlan({ activeFeatNames: ["Sharpshooter Mastery"] }, ranged).attackPenalty, -4);
  assert.equal(
    calledShotPlan(
      { activeFeatNames: ["Sharpshooter Mastery"] },
      { ...ranged, calledShot: "partial", calledShotHelmet: false }
    ).attackPenalty,
    -0
  );
  assert.match(calledShotPlan({}, { ...ranged, aimed: false }).reason, /Aim/);
  assert.match(calledShotPlan({}, { calledShot: "full", ranged: false }).reason, /adjacent/);
  assert.match(calledShotPlan({}, { ...ranged, attackAction: "autofire" }).reason, /Standard Attack/);
  assert.equal(calledShotPlan({}, ranged).countCost, 5);
});

test("Revolver Basics: +4 Intimidate with one shot left, and a free full reload each round", async () => {
  const { revolverIntimidatePlan } = await import("../module/rules/revolver-intimidate.mjs");
  const owner = { activeFeatNames: ["Revolver Basics"] };
  assert.equal(revolverIntimidatePlan(owner, "intimidate", { revolverOneShot: true }).bonuses[0].value, 4);
  assert.deepEqual(revolverIntimidatePlan(owner, "intimidate", {}).bonuses, []);
  const spec = roundActionSpecs(owner).find(s => s.id === "revolverBasics");
  assert.deepEqual([spec.limit, spec.period], [1, "round"]);
});

test("Bounce: −2 and error +1 a surface, up to Dexterity; Grenade Basics and Flamethrower Basics", async () => {
  const { bouncePlan } = await import("../module/rules/bounce.mjs");
  const sys = feats => ({
    activeFeatNames: feats,
    abilities: { dex: { mod: 3 } },
    proficiencyTotals: { hurled: { proficient: true } }
  });
  const knife = { proficiency: "hurled", name: "Throwing knife" };
  assert.deepEqual(
    [bouncePlan(sys([]), knife, { bounceSurfaces: 2 }).attack, bouncePlan(sys([]), knife, { bounceSurfaces: 2 }).error],
    [-4, 2]
  );
  assert.ok(bouncePlan(sys([]), knife, { bounceSurfaces: 4 }).blocked);
  const grenade = { proficiency: "hurled", name: "Frag grenade" };
  assert.equal(bouncePlan(sys(["Grenade Basics"]), grenade, { bounceSurfaces: 2 }).attack, -2);
  const flame = { proficiency: "tactical", weaponCategory: "flamethrower", name: "Flamethrower" };
  assert.ok(bouncePlan(sys([]), flame, { bounceSurfaces: 1 }).blocked);
  assert.equal(bouncePlan(sys(["Flamethrower Basics"]), flame, { bounceSurfaces: 1 }).blocked, false);
});

test("Steel Rain: a carried hurled weapon counts as readied", async () => {
  const { readiedRangedWeapons } = await import("../module/rules/readied-weapons.mjs");
  const knife = {
    id: "k",
    type: "weapon",
    name: "Throwing knife",
    system: { proficiency: "hurled", equipped: false, carried: true, quantity: 1, range: 10, sizeHands: "T/1h" }
  };
  const sys = feats => ({ activeFeatNames: feats, abilities: { str: { mod: 0 } } });
  const ready = readiedRangedWeapons(sys(["Steel Rain"]), [knife]);
  const not = readiedRangedWeapons(sys([]), [knife]);
  assert.equal(ready.length, 1);
  assert.equal(not.length, 0);
});
