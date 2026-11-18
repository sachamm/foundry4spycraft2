import test from "node:test";
import assert from "node:assert/strict";
import {
  UNARMED_TRICKS,
  unarmedTrickPlan,
  unarmedTrickNote,
  unarmedTrickDamageNote,
  halvesSneakDamage,
  inReadyStance
} from "../module/rules/unarmed-tricks.mjs";
import { unarmedTrickClash } from "../module/rules/boxing.mjs";
import { COMBAT_STANCES } from "../module/rules/combat-stance.mjs";
import { rollPipeline } from "../module/rules/roll-pipeline.mjs";

const fists = { proficiency: "unarmed", damage: "1d4", qualities: "" };
const owner = feats => ({ activeFeatNames: feats, conditionContext: {} });

test("each trick needs its feat, an unarmed attack and the right action", () => {
  const vp = owner(["Vital Points Moves"]);
  assert.deepEqual(
    [
      unarmedTrickPlan(vp, fists, { trick: "nerveJam" }).attackBonus,
      unarmedTrickPlan(vp, fists, { trick: "nerveJam" }).threatIncrease
    ],
    [-4, 1]
  );
  assert.equal(unarmedTrickPlan(vp, fists, { trick: "spike" }).threatIncrease, 1);
  assert.ok(unarmedTrickPlan(vp, fists, { trick: "oneFinger" }).blocked, "needs a flat-footed target");
  assert.equal(unarmedTrickPlan(vp, fists, { trick: "oneFinger", flatFootedTarget: true }).threatIncrease, 4);
  assert.ok(unarmedTrickPlan(owner([]), fists, { trick: "spike" }).blocked);
  assert.ok(unarmedTrickPlan(vp, { proficiency: "edged" }, { trick: "spike" }).blocked);
  assert.ok(
    unarmedTrickPlan(vp, fists, { trick: "spike", kick: true, attackAction: "other" }).blocked,
    "not on a Kick"
  );
  const rolling = owner(["Rolling Moves"]);
  assert.equal(unarmedTrickPlan(rolling, fists, { trick: "sway", kick: true, attackAction: "other" }).blocked, false);
  assert.equal(unarmedTrickPlan(rolling, fists, { trick: "circle" }).blocked, false);
  assert.equal(unarmedTrickPlan(owner(["Wrestling Moves"]), fists, { trick: "clothesline" }).qualities, "TKD");
});

test("notes state each effect; save tricks give the DC from the damage", () => {
  assert.match(
    unarmedTrickNote({ key: "rabbitPunch" }),
    /attack -4; threat range \+1; on a threat or critical hit the target is nauseated for 1 round \(p\.185\)/
  );
  assert.match(unarmedTrickNote({ key: "haymaker" }), /Fortitude save \(DC 10 \+ damage\) or is nauseated/);
  assert.match(unarmedTrickNote({ key: "leap" }), /passing freely/);
  assert.equal(
    unarmedTrickDamageNote("lowBlow", 6),
    "Low Blow: the target makes a Fortitude save, DC 16, or is sickened for 1d4 rounds (p.185)."
  );
  assert.match(unarmedTrickDamageNote("eyeGouge", 9), /Reflex save, DC 19, or is blinded/);
  assert.equal(unarmedTrickDamageNote("spike", 9), "");
  assert.equal(Object.keys(UNARMED_TRICKS).length, 11);
});

test("one unarmed trick per action, Ready Stance, and Dirty Fighting Basics halves sneak damage suffered", () => {
  assert.match(unarmedTrickClash({ unarmedTrick: "spike", doubleJab: true }), /Only one/);
  assert.equal(unarmedTrickClash({ unarmedTrick: "spike" }), "");
  assert.deepEqual(COMBAT_STANCES.ready, { name: "Ready Stance", feat: "Dirty Fighting Basics", page: 185 });
  assert.ok(
    inReadyStance({
      activeFeatNames: ["Dirty Fighting Basics"],
      combatStance: { version: 1, id: "r", key: "ready" },
      conditionContext: {}
    })
  );
  assert.ok(halvesSneakDamage(owner(["Dirty Fighting Basics"])));
  assert.equal(halvesSneakDamage(owner([])), false);
  assert.equal(halvesSneakDamage(null), false);
  const html = rollPipeline.dialog({
    dialog: "attack",
    actor: { system: owner(["Vital Points Moves", "Rolling Moves"]) },
    item: { system: fists },
    options: {}
  });
  assert.match(html, /name="unarmedTrick"/);
  assert.match(html, /Nerve Jam \(Vital Points Moves\)/);
  assert.doesNotMatch(html, /Eye Gouge/);
});
