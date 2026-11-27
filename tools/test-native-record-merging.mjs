import test from "node:test";
import assert from "node:assert/strict";
import { ActorProgression } from "../module/documents/actor/progression.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { creationPolicyRecord, creationPolicyValid } from "../module/rules/creation-policy.mjs";
import { triggerClaimKey } from "../module/rules/triggered-attacks.mjs";
import { withAttackTriggerClaim } from "../module/services/triggered-attacks.mjs";
import { reviewTriggeredAttacks } from "../module/apps/final-attack.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

// Document updates merge object values; dotted -= keys delete only the named property.
const object = value => value && typeof value === "object" && !Array.isArray(value);
function merge(target, data) {
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("-=")) delete target[key.slice(2)];
    else if (object(value) && object(target[key])) merge(target[key], value);
    else target[key] = structuredClone(value);
  }
}
function update(target, patch) {
  for (const [path, value] of Object.entries(patch)) {
    const keys = path.split(".");
    let at = target;
    for (const key of keys.slice(0, -1)) at = at[key] ??= {};
    merge(at, { [keys.at(-1)]: value });
  }
}
const confirmed = { confirmed: true, note: "Native record semantics reviewed" };
function actor() {
  globalThis.CONFIG = { SPYCRAFT: cfg };
  globalThis.game = { user: { id: "gc", isGM: true }, settings: { get: () => ({}) }, messages: [] };
  const items = [
    {
      id: "test",
      name: "Test",
      type: "class",
      system: {
        identifier: "test",
        table: [],
        vitalityDie: 8,
        bonuses: [{ target: "featSlots.basicCombat", value: "1", level: 1 }]
      }
    }
  ];
  const system = {
    progression: [{ classId: "test", vitality: 8, skills: {} }],
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }]))
  };
  const C = ActorProgression(class {});
  return Object.assign(new C(), {
    type: "agent",
    uuid: "Actor.merge",
    isOwner: true,
    items,
    flags: { other: { keep: 1 } },
    system: computeAgent(system, items, cfg),
    async update(patch) {
      update(this, patch);
      if (this.responseLost) throw Error("response lost");
    }
  });
}

test("GC creation policy review removes old effects under native object merging and proves a committed lost response", async () => {
  const a = actor();
  await a.reviewCreationPolicy({ ...confirmed, qualityIds: ["small-screen", "big-budget"], role: "pc" });
  assert.equal(a.flags.spycraft2.creationPolicy.effects.creationPointBuy, 32);
  a.responseLost = true;
  const cleared = await a.reviewCreationPolicy({ ...confirmed, qualityIds: [], role: "pc" });
  assert.deepEqual(a.flags.spycraft2.creationPolicy.effects, {});
  assert.equal(creationPolicyValid(cleared), true);
  assert.equal(creationPolicyValid(a.flags.spycraft2.creationPolicy), true);
  assert.equal(a.flags.other.keep, 1);
});

test("Modular can switch between surrendering and buying without retaining a surrendered tree", async () => {
  const a = actor();
  a.flags.spycraft2 = { creationPolicy: creationPolicyRecord({ modularCreation: 1 }, confirmed) };
  await a.configureModularCreation({ ...confirmed, bought: 0, surrendered: { basicCombat: 1 } });
  a.responseLost = true;
  await a.configureModularCreation({ ...confirmed, bought: 1, surrendered: {} });
  assert.deepEqual(a.flags.spycraft2.modularTrade.surrendered, {});
  assert.equal(a.flags.spycraft2.modularTrade.bought, 1);
});

test("a GC advancement review replaces the previous review mode without stale ceilings or baselines", async () => {
  const a = actor();
  await a.reviewAdvancement({ ...confirmed, mode: "grant", ceiling: 5 });
  a.responseLost = true;
  await a.reviewAdvancement({ ...confirmed, mode: "history", baseline: 1 });
  assert.equal(a.flags.spycraft2.advancementReview.ceiling, undefined);
  await a.reviewAdvancement({ ...confirmed, mode: "grant", ceiling: 3 });
  assert.equal(a.flags.spycraft2.advancementReview.baseline, undefined);
});

test("an unused reviewed trigger can be reserved again without stale GC review data breaking its durable write proof", async () => {
  const a = actor(),
    source = "cleaveBasics",
    trigger = "ChatMessage.trigger",
    key = triggerClaimKey(source, trigger);
  a.flags.spycraft2 = {
    triggeredAttacks: { [key]: { version: 1, id: "old", source, triggerMessageUuid: trigger, state: "reserved" } }
  };
  await reviewTriggeredAttacks(a, { ...confirmed, key, resolution: "unused" });
  assert.ok(a.flags.spycraft2.triggeredAttacks[key].review);
  a.responseLost = true;
  const result = await withAttackTriggerClaim(
    a,
    { id: "new", source, triggerMessageUuid: trigger },
    async check => {
      await check();
      return { uuid: "ChatMessage.new" };
    },
    () => {}
  );
  assert.equal(result.uuid, "ChatMessage.new");
  assert.equal(a.flags.spycraft2.triggeredAttacks[key].review, undefined);
  assert.equal(a.flags.spycraft2.triggeredAttacks[key].state, "committed");
});
