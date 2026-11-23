import test from "node:test";
import assert from "node:assert/strict";
import { finalAttackActor } from "./fixtures/final-attack-actor.mjs";
import {
  chanceFeatCount,
  fortunateSpec,
  fortunatePool,
  validFortunatePool,
  fortunateMatchNote
} from "../module/rules/fortunate.mjs";
import { unrestrictedBonusPoolStatus, UNRESTRICTED_POOL_SOURCES } from "../module/rules/bonus-pools.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { grantFortunate } from "../module/apps/fortunate.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { inlinedSource } from "./lib/hbs-harness.mjs";

const periods = { scene: "s1", session: "n1", mission: "m1" };
const system = (feats = ["Fortunate"], chance = ["Fortunate"]) => ({
  activeFeatNames: feats,
  activeFeatSelections: feats.map(name => ({ name, tree: chance.includes(name) ? "Chance" : "Basic Combat" })),
  usagePeriods: periods,
  worldTime: 100,
  bonusActionDice: {}
});

test("uses per session equal the Chance feats the character has", () => {
  assert.equal(chanceFeatCount(system()), 1);
  const three = system(
    ["Fortunate", "Lucky Break", "Black Cat", "Quick Draw"],
    ["Fortunate", "Lucky Break", "Black Cat"]
  );
  assert.equal(chanceFeatCount(three), 3);
  assert.deepEqual(fortunateSpec(three), {
    id: "fortunate",
    name: "Fortunate (one per Chance feat each session)",
    period: "session",
    limit: 3,
    workflow: "fortunate"
  });
  assert.equal(fortunateSpec(system([])), null);
  assert.equal(limitedUseAbilities(three, [], cfg).find(s => s.id === "fortunate").limit, 3);
});

test("the grant is one d4 for the scene, improved to d6 by Fortune Favors the Bold", () => {
  const pool = fortunatePool(system(), { id: "f1", periods });
  assert.deepEqual(
    { ...pool },
    {
      id: "f1",
      source: "fortunate",
      label: "Fortunate",
      unrestricted: true,
      baseDie: 4,
      baseCount: 1,
      bold: false,
      die: 4,
      granted: 1,
      remaining: 1,
      scene: "s1",
      session: "n1",
      mission: "m1",
      at: 100,
      needsReview: false
    }
  );
  const bold = fortunatePool(system(["Fortunate", "Fortune Favors the Bold"]), { id: "f2", periods });
  assert.equal(bold.die, 6);
  assert.equal(bold.granted, 1);
  assert.ok(validFortunatePool(pool));
  assert.ok(validFortunatePool(bold));
  assert.equal(validFortunatePool({ ...pool, die: 6 }), false);
  assert.equal(validFortunatePool({ ...pool, granted: 2 }), false);
  assert.throws(() => fortunatePool(system([]), { id: "f3", periods }), /not been earned/);
  assert.throws(
    () => fortunatePool({ ...system(), bonusActionDice: { f1: pool } }, { id: "f1", periods }),
    /identifier/
  );
});

test("the die spends like other unrestricted bonus dice and expires at scene end", () => {
  assert.ok(UNRESTRICTED_POOL_SOURCES.includes("fortunate"));
  const pool = fortunatePool(system(), { id: "f1", periods }),
    s = { ...system(), bonusActionDice: { f1: pool } };
  const live = unrestrictedBonusPoolStatus(s, "f1", { periods });
  assert.equal(live.available, 1);
  assert.equal(live.reason, "");
  assert.equal(live.expiryLabel, "scene end");
  assert.equal(unrestrictedBonusPoolStatus(s, "f1", { periods: { ...periods, scene: "s2" } }).available, 0);
  assert.equal(unrestrictedBonusPoolStatus(s, "f1", { periods: { ...periods, session: "n2" } }).available, 0);
  const spent = { ...s, bonusActionDice: { f1: { ...pool, remaining: 0 } } };
  assert.match(unrestrictedBonusPoolStatus(spent, "f1", { periods }).reason, /already spent/);
  const tampered = { ...s, bonusActionDice: { f1: { ...pool, die: 8 } } };
  assert.equal(unrestrictedBonusPoolStatus(tampered, "f1", { periods }).needsReview, true);
});

test("the matching die is noted for the GC or the chosen opponent", () => {
  assert.equal(fortunateMatchNote("gc"), "The GC gains 1 d4 action die.");
  assert.match(fortunateMatchNote("opponent", " Dr Vane "), /to Dr Vane\./);
  assert.match(fortunateMatchNote("opponent", ""), /an opponent of the GC’s choice/);
});

test("the GC grants the requested die once per use, and only the GC can", async () => {
  const { a, messages } = finalAttackActor(["Fortunate"]);
  a.system.activeFeatSelections = [{ name: "Fortunate", tree: "Chance" }];
  a.system.worldTime = 50;
  a.usagePeriods = { ...a.usagePeriods, session: "n1", mission: "m1" };
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  ChatMessage.create = async data => {
    const m = { id: "c" + messages.length, uuid: "ChatMessage.c" + messages.length, ...data };
    messages.push(m);
    return m;
  };
  const pool = await grantFortunate(a, { match: "opponent", opponentName: "Dr Vane" });
  assert.equal(pool.source, "fortunate");
  assert.deepEqual(a.system.bonusActionDice[pool.id], pool);
  assert.equal(a.system.resourceUses.fortunate.used, 1);
  const receipt = messages.find(m => m.flags?.spycraft2?.checkKind === "fortunate");
  assert.match(
    receipt.content,
    /gains 1 bonus d4 action die, lost if unused by the end of the scene\. The GC gives the matching d4 action die to Dr Vane\./
  );
  const warnings = [];
  ui.notifications.warn = m => warnings.push(m);
  await grantFortunate(a, { match: "opponent" }).catch(e => warnings.push(e.message));
  assert.ok(warnings.length, "a second use is refused with one Chance feat");
  assert.equal(Object.keys(a.system.bonusActionDice).length, 1);
  await assert.rejects(grantFortunate(a, { match: "nobody" }), /who gains the matching die/);
  game.user = { id: "player", isGM: false };
  await assert.rejects(grantFortunate(a, { match: "gc" }), /GC grants/);
});

test("the Main tab shows the uses and the GC's grant control", async () => {
  const html = inlinedSource("systems/spycraft2/templates/actor/agent-main.hbs");
  assert.match(html, /data-action="grantFortunate"/);
  assert.match(html, /gc-review\.hbs" resource="fortunate"/);
});
