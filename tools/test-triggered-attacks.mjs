import test from "node:test";
import assert from "node:assert/strict";
import { triggerClaimKey, triggerClaimUsed } from "../module/rules/triggered-attacks.mjs";
import { withAttackTriggerClaim } from "../module/services/triggered-attacks.mjs";
import { reviewTriggeredAttacks } from "../module/apps/final-attack.mjs";
import { finalAttackActor } from "./fixtures/final-attack-actor.mjs";
import { takeDropFollowUp } from "../module/apps/drop-follow-up.mjs";

const input = {
  targetName: "Another guard",
  targetCharacterType: "standard",
  messageId: "trigger",
  droppedConfirmed: true,
  immediateConfirmed: true,
  anotherOpponentConfirmed: true
};
function setup() {
  const fixture = finalAttackActor(["Cleave Basics", "Cleave Mastery"]);
  fixture.messages.push({
    id: "trigger",
    uuid: "ChatMessage.trigger",
    flags: {
      spycraft2: {
        actorUuid: fixture.a.uuid,
        weaponUuid: fixture.w.uuid,
        checkKind: "attack",
        resolved: true,
        successConfirmed: true,
        effectiveTotal: 22,
        rollCombat: { id: fixture.a.participatingCombat.id, round: 3, combatantId: "participant" },
        attackContext: { ranged: false, targetActorUuid: "Actor.dropped" }
      }
    }
  });
  return fixture;
}

test("Cleave Mastery cannot repeat a claimed drop after its extra-attack card is deleted or local counters are reset", async () => {
  const { a, messages } = setup();
  const result = await takeDropFollowUp(a, "cleaveBasics", input);
  const key = triggerClaimKey("cleaveBasics", "ChatMessage.trigger");
  assert.equal(a.flags.spycraft2.triggeredAttacks[key].state, "committed");
  messages.splice(messages.indexOf(result), 1);
  a.system.resourceUses = {};
  await assert.rejects(takeDropFollowUp(a, "cleaveBasics", input), /already earned/);
  assert.equal(messages.length, 1);
  assert.deepEqual(a.system.resourceUses, {});
  assert.equal(triggerClaimUsed(a.flags.spycraft2.triggeredAttacks, "snapShot", "ChatMessage.trigger"), false);
  assert.equal(
    triggerClaimUsed(a.flags.spycraft2.triggeredAttacks, "cleaveBasics", "ChatMessage.trigger", null, "Actor.copy"),
    false,
    "A copied actor does not inherit another character's spent triggers"
  );
});

test("concurrent uses of one drop post a single attack even with unlimited Cleave Mastery uses", async () => {
  const { a, messages } = setup();
  const results = await Promise.allSettled([
    takeDropFollowUp(a, "cleaveBasics", input),
    takeDropFollowUp(a, "cleaveBasics", input)
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(messages.filter(m => m.flags.spycraft2.finalAttack).length, 1);
  assert.equal(a.system.resourceUses.cleaveBasics.used, 1);
});

test("a failed unposted attack voids its claim and refunds its use, while a committed claim write with lost response is recognized", async () => {
  const { a } = setup();
  const roll = a.rollCheck;
  a.rollCheck = async () => {
    throw Error("RNG unavailable");
  };
  await assert.rejects(takeDropFollowUp(a, "cleaveBasics", input), /RNG unavailable/);
  const key = triggerClaimKey("cleaveBasics", "ChatMessage.trigger");
  assert.equal(a.flags.spycraft2.triggeredAttacks[key].state, "void");
  assert.equal(a.system.resourceUses.cleaveBasics, undefined);
  a.rollCheck = roll;
  const update = a.update.bind(a);
  a.update = async patch => {
    await update(patch);
    if (Object.keys(patch).some(k => k.startsWith("flags.spycraft2.triggeredAttacks."))) throw Error("response lost");
  };
  assert.ok(await takeDropFollowUp(a, "cleaveBasics", input));
  assert.equal(a.flags.spycraft2.triggeredAttacks[key].state, "committed");
});

test("failure to finalize a posted claim keeps it reserved and consumed; GC cannot void an actual posted result", async () => {
  const { a, messages } = setup();
  const update = a.update.bind(a);
  a.update = async patch => {
    if (
      Object.entries(patch).some(
        ([key, value]) => key.startsWith("flags.spycraft2.triggeredAttacks.") && value.state === "committed"
      )
    )
      throw Error("final write unavailable");
    return update(patch);
  };
  const result = await takeDropFollowUp(a, "cleaveBasics", input);
  const key = triggerClaimKey("cleaveBasics", "ChatMessage.trigger");
  assert.ok(result.uuid);
  assert.equal(a.flags.spycraft2.triggeredAttacks[key].state, "reserved");
  assert.equal(a.system.resourceUses.cleaveBasics.used, 1);
  a.update = update;
  await assert.rejects(
    reviewTriggeredAttacks(a, { key, resolution: "unused", confirmed: true, note: "Checked" }),
    /posted result/
  );
  assert.equal(
    (await reviewTriggeredAttacks(a, { key, resolution: "consumed", confirmed: true, note: "Actual attack retained" }))
      .state,
    "committed"
  );
  assert.equal(messages.filter(m => m.flags.spycraft2.finalAttack).length, 1);
});

test("GC review can release an unused interrupted claim without altering health or use counts, and players cannot review", async () => {
  const { a } = setup();
  const key = triggerClaimKey("cleaveBasics", "ChatMessage.trigger");
  a.flags.spycraft2 = {
    triggeredAttacks: {
      [key]: {
        version: 1,
        id: "old",
        source: "cleaveBasics",
        triggerMessageUuid: "ChatMessage.trigger",
        state: "reserved"
      }
    }
  };
  const before = structuredClone(a.system);
  game.user.isGM = false;
  await assert.rejects(
    reviewTriggeredAttacks(a, { key, resolution: "unused", confirmed: true, note: "Checked" }),
    /owning GC/
  );
  game.user.isGM = true;
  assert.equal(
    (await reviewTriggeredAttacks(a, { key, resolution: "unused", confirmed: true, note: "No attack was rolled" }))
      .state,
    "void"
  );
  assert.deepEqual(a.system, before);
  assert.ok(await takeDropFollowUp(a, "cleaveBasics", input));
});

test("malformed claims block reuse and a changed reservation rejects posting", async () => {
  const { a } = setup();
  const key = triggerClaimKey("test", "ChatMessage.trigger");
  assert.equal(triggerClaimUsed({ [key]: { state: "void" } }, "test", "ChatMessage.trigger"), true);
  const receipt = { id: "test", source: "test", triggerMessageUuid: "ChatMessage.trigger" };
  await assert.rejects(
    withAttackTriggerClaim(
      a,
      receipt,
      async check => {
        a.flags.spycraft2.triggeredAttacks[key].id = "changed";
        await check();
      },
      () => {}
    ),
    /needs GC review/
  );
  assert.equal(a.flags.spycraft2.triggeredAttacks[key].state, "reserved");
});
