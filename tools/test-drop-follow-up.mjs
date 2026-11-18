import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { clock } from "./fixtures/feint.mjs";
import {
  DROP_FOLLOW_UPS,
  dropTriggerEligible,
  dropFollowUpPlan,
  dropFollowUpNote
} from "../module/rules/drop-follow-up.mjs";
import { FINAL_ATTACK_WORKFLOWS } from "../module/rules/final-round.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const hit = (ranged = false, patch = {}, context = {}) => ({
  actorUuid: "Actor.a",
  checkKind: "attack",
  resolved: true,
  successConfirmed: true,
  weaponUuid: "Actor.a.Item.w",
  effectiveTotal: 22,
  rollCombat: { id: "Combat.feint", round: 3, combatantId: "participant" },
  attackContext: { ranged, targetActorUuid: "Actor.dropped", ...context },
  ...patch
});
const system = feats => ({ activeFeatNames: feats, conditionContext: {}, wounds: { value: 5 } });
const confirmed = {
  droppedConfirmed: true,
  immediateConfirmed: true,
  anotherOpponentConfirmed: true,
  actorUuid: "Actor.a"
};

test("Cleave answers a melee drop and Snap Shot a ranged one", () => {
  assert.deepEqual(
    { ...DROP_FOLLOW_UPS.cleaveBasics },
    { feat: "Cleave Basics", name: "Cleave", ranged: false, page: 177 }
  );
  assert.deepEqual({ ...DROP_FOLLOW_UPS.snapShot }, { feat: "Snap Shot", name: "Snap Shot", ranged: true, page: 182 });
  const combat = clock();
  assert.ok(dropTriggerEligible(hit(false), { actorUuid: "Actor.a", combat, ranged: false }));
  assert.ok(dropTriggerEligible(hit(true), { actorUuid: "Actor.a", combat, ranged: true }));
  assert.equal(dropTriggerEligible(hit(true), { actorUuid: "Actor.a", combat, ranged: false }), false);
});

test("only the character's own resolved hit from this round, without a Disarm, can trigger", () => {
  const ok = c => dropTriggerEligible(c, { actorUuid: "Actor.a", combat: clock(), ranged: false });
  assert.equal(ok(hit(false, { actorUuid: "Actor.b" })), false);
  assert.equal(ok(hit(false, { successConfirmed: false })), false);
  assert.equal(ok(hit(false, { resolved: false })), false);
  assert.equal(ok(hit(false, { superseded: "ChatMessage.x" })), false);
  assert.equal(ok(hit(false, { checkKind: "damage" })), false);
  assert.equal(ok(hit(false, { rollCombat: { id: "Combat.feint", round: 2 } })), false);
  assert.equal(ok(hit(false, { rollCombat: { id: "Combat.other", round: 3 } })), false);
  assert.equal(ok(hit(false, {}, { disarm: { active: true } })), false);
  assert.equal(ok(hit(false, { weaponUuid: "" })), false);
});

test("the plan needs the earned feat, the GC's confirmations and a different opponent", () => {
  const plan = (feats, check, extra = {}) =>
    dropFollowUpPlan(system(feats), clock(), check, { key: "cleaveBasics", ...confirmed, ...extra });
  const p = plan(["Cleave Basics"], hit(false), { targetUuid: "Actor.next" });
  assert.equal(p.source, "cleaveBasics");
  assert.equal(p.weaponUuid, "Actor.a.Item.w");
  assert.equal(p.droppedTargetUuid, "Actor.dropped");
  assert.equal(p.attackAction, "standard");
  assert.equal(p.free, true);
  assert.equal(p.round, 3);
  assert.throws(() => plan([], hit(false)), /has not been earned/);
  assert.throws(() => plan(["Cleave Basics"], hit(true)), /melee hit/);
  for (const k of ["droppedConfirmed", "immediateConfirmed", "anotherOpponentConfirmed"])
    assert.throws(() => plan(["Cleave Basics"], hit(false), { [k]: false }), /GC must confirm/);
  assert.throws(() => plan(["Cleave Basics"], hit(false), { targetUuid: "Actor.dropped" }), /different opponent/);
  assert.throws(
    () =>
      dropFollowUpPlan(system(["Cleave Basics"]), { ...clock(), started: false }, hit(false), {
        key: "cleaveBasics",
        ...confirmed
      }),
    /started combat/
  );
  assert.throws(
    () => dropFollowUpPlan(system(["Snap Shot"]), clock(), hit(true), { key: "other", ...confirmed }),
    /Choose Cleave or Snap Shot/
  );
  const snap = dropFollowUpPlan(system(["Snap Shot"]), clock(), hit(true), { key: "snapShot", ...confirmed });
  assert.equal(snap.name, "Snap Shot");
  assert.throws(
    () =>
      dropFollowUpPlan({ ...system(["Cleave Basics"]), wounds: { value: -1 } }, clock(), hit(false), {
        key: "cleaveBasics",
        ...confirmed
      }),
    /cannot take the attack/
  );
});

test("each feat gives one use per round and counts toward the shared final-attack allowance", () => {
  const specs = limitedUseAbilities(system(["Cleave Basics", "Snap Shot"]), [], cfg);
  for (const key of ["cleaveBasics", "snapShot"]) {
    const s = specs.find(x => x.id === key);
    assert.equal(s.limit, 1, key);
    assert.equal(s.period, "round", key);
    assert.equal(s.workflow, key, key);
    assert.equal(s.combatScoped, true, key);
    assert.equal(FINAL_ATTACK_WORKFLOWS.has(key), true, key);
  }
  assert.equal(
    limitedUseAbilities(system([]), [], cfg).some(s => ["cleaveBasics", "snapShot"].includes(s.id)),
    false
  );
});

test("the attack card names the extra attack, and the Main tab offers both controls", async () => {
  assert.match(dropFollowUpNote({ source: "cleaveBasics" }), /Cleave: an immediate extra attack .*\(p\.177\)/);
  assert.match(dropFollowUpNote({ source: "snapShot" }), /Snap Shot: .*\(p\.182\)/);
  assert.equal(dropFollowUpNote({ source: "combatInstincts" }), "");
  const html = await readFile(new URL("../templates/actor/agent-main.hbs", import.meta.url), "utf8");
  assert.match(html, /data-action="takeCleaveBasics"/);
  assert.match(html, /data-action="takeSnapShot"/);
  const sheet = await readFile(new URL("../module/sheets/actor-sheet.mjs", import.meta.url), "utf8");
  assert.match(sheet, /takeCleaveBasics\(\) \{\s*return takeDropFollowUp\(this\.actor, "cleaveBasics"\)/);
  assert.match(sheet, /takeSnapShot\(\) \{\s*return takeDropFollowUp\(this\.actor, "snapShot"\)/);
});

test("the Cleave control posts one extra attack with the same weapon and spends the round use once", async () => {
  await import("./fixtures/fatigue-actor.mjs");
  const { SpycraftActor } = await import("../module/documents/actor.mjs");
  const { weaponAttack } = await import("../module/rules/gear.mjs");
  const { sword, prep } = await import("./fixtures/feint.mjs");
  const { takeDropFollowUp } = await import("../module/apps/drop-follow-up.mjs");
  let seq = 0;
  foundry.utils.escapeHTML = String;
  foundry.utils.randomID = () => "drop" + ++seq;
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  game.user = { id: "gc", isGM: true };
  const messages = [];
  messages.get = id => messages.find(m => m.id === id);
  game.messages = messages;
  const w = sword({ qualities: "", damage: "1d6" }),
    a = {
      uuid: "Actor.feint",
      type: "agent",
      isOwner: true,
      flags: {},
      system: {
        size: "Medium",
        bab: 3,
        activeFeatNames: ["Cleave Basics"],
        classLevels: {},
        abilities: { str: { value: 14, mod: 2 }, dex: { value: 14, mod: 2 } },
        proficiencyTotals: { edged: { proficient: true } },
        conditionContext: {},
        wounds: { value: 4 },
        vitality: { value: 4 },
        actionDice: { value: 0 },
        resourceUses: {}
      },
      items: [w],
      usagePeriods: { round: "Combat.feint:3", combat: "Combat.feint", scene: "scene" },
      async update(patch) {
        for (const [path, value] of Object.entries(patch)) {
          const keys = path.split(".");
          let o = this;
          for (const key of keys.slice(0, -1)) o = o[key] ??= {};
          o[keys.at(-1)] = structuredClone(value);
        }
      }
    };
  a.items.get = id => a.items.find(i => i.id === id);
  a.participatingCombat = {
    id: clock().id,
    started: true,
    round: 3,
    turn: 0,
    turns: [{ id: clock().combatantId, actor: a }]
  };
  a.mentalLeapCombatContext = () => ({ ...clock() });
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  a.actionDiceFundingSystem = a.system;
  a.weaponAttack = (item, o = {}) =>
    weaponAttack(prep(a.system, a.items), { ...item.system, id: item.id }, cfg, "agent", o);
  a.useLimitedAbility = SpycraftActor.prototype.useLimitedAbility;
  a.rollAttack = (item, o) => SpycraftActor.prototype.rollAttack.call(a, item, o);
  a.rollCheck = async (formula, data, opts) => {
    await opts.validateFinalAttack?.();
    const m = {
      id: "posted" + ++seq,
      uuid: "ChatMessage.posted" + seq,
      flags: { spycraft2: { ...opts, actorUuid: a.uuid } }
    };
    messages.push(m);
    return m;
  };
  messages.push({
    id: "trigger",
    uuid: "ChatMessage.trigger",
    flags: { spycraft2: hit(false, { actorUuid: a.uuid, weaponUuid: w.uuid }) }
  });
  const input = {
    messageId: "trigger",
    droppedConfirmed: true,
    immediateConfirmed: true,
    anotherOpponentConfirmed: true
  };
  const posted = await takeDropFollowUp(a, "cleaveBasics", input),
    c = posted.flags.spycraft2;
  assert.equal(c.finalAttack.source, "cleaveBasics");
  assert.equal(c.finalAttack.weaponId, "sword");
  assert.equal(c.finalAttack.triggerMessageUuid, "ChatMessage.trigger");
  assert.equal(c.weaponUuid, w.uuid);
  assert.equal(a.system.resourceUses.cleaveBasics.used, 1);
  // A second use this round is refused (with a warning), so no second attack posts and the count stays at 1.
  const warnings = [];
  ui.notifications.warn = m => warnings.push(m);
  await takeDropFollowUp(a, "cleaveBasics", input).catch(e => warnings.push(e.message));
  assert.ok(warnings.length, "the second use is refused");
  assert.equal(a.system.resourceUses.cleaveBasics.used, 1);
  assert.equal(messages.filter(m => m.flags.spycraft2.finalAttack?.source === "cleaveBasics").length, 1);
  await assert.rejects(takeDropFollowUp(a, "snapShot", input), /Snap Shot has not been earned/);
});
