import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { finalAttackActor } from "./fixtures/final-attack-actor.mjs";
import { clock } from "./fixtures/feint.mjs";
import {
  opportunistPlan,
  opportunistDamageSource,
  halvedFormula,
  opportunistNote
} from "../module/rules/opportunist.mjs";
import { takeOpportunist } from "../module/apps/opportunist.mjs";
import { FINAL_ATTACK_WORKFLOWS } from "../module/rules/final-round.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { rollPipeline } from "../module/rules/roll-pipeline.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const system = (feats = ["Opportunist"]) => ({ activeFeatNames: feats, conditionContext: {}, wounds: { value: 4 } });
const confirmed = { triggerConfirmed: true, sightConfirmed: true, immediateConfirmed: true };

test("the plan needs the earned feat, a started combat and the GC's three confirmations", () => {
  const p = opportunistPlan(system(), clock(), { ...confirmed, triggerDescription: "  Guard stunned by flashbang " });
  assert.equal(p.source, "opportunist");
  assert.equal(p.halfDamage, true);
  assert.equal(p.free, true);
  assert.equal(p.triggerDescription, "Guard stunned by flashbang");
  assert.throws(() => opportunistPlan(system([]), clock(), confirmed), /has not been earned/);
  assert.throws(() => opportunistPlan(system(), { ...clock(), started: false }, confirmed), /started combat/);
  for (const k of Object.keys(confirmed))
    assert.throws(() => opportunistPlan(system(), clock(), { ...confirmed, [k]: false }), /GC must confirm/);
  assert.throws(
    () => opportunistPlan(system(), clock(), { ...confirmed, triggerDescription: "x".repeat(301) }),
    /300 characters/
  );
  assert.throws(
    () => opportunistPlan({ ...system(), wounds: { value: -2 } }, clock(), confirmed),
    /cannot take the final attack/
  );
});

test("one use per round, counted with the other final attacks", () => {
  const s = limitedUseAbilities(system(), [], cfg).find(x => x.id === "opportunist");
  assert.equal(s.limit, 1);
  assert.equal(s.period, "round");
  assert.equal(s.workflow, "opportunist");
  assert.ok(FINAL_ATTACK_WORKFLOWS.has("opportunist"));
  assert.equal(
    limitedUseAbilities(system([]), [], cfg).some(x => x.id === "opportunist"),
    false
  );
});

test("half damage rounds up and only an own resolved Opportunist hit with this weapon qualifies, once", () => {
  assert.equal(halvedFormula("1d6 + 2"), "ceil((1d6 + 2) / 2)");
  const attack = (patch = {}, uuid = "ChatMessage.h") => ({
    uuid,
    flags: {
      spycraft2: {
        actorUuid: "Actor.a",
        checkKind: "attack",
        finalAttack: { source: "opportunist" },
        resolved: true,
        successConfirmed: true,
        weaponUuid: "Item.w",
        ...patch
      }
    }
  });
  const facts = { actorUuid: "Actor.a", weaponUuid: "Item.w" };
  assert.deepEqual(opportunistDamageSource(attack(), facts), {
    version: 1,
    attackUuid: "ChatMessage.h",
    halved: true
  });
  for (const patch of [
    { actorUuid: "Actor.b" },
    { successConfirmed: false },
    { resolved: false },
    { superseded: "ChatMessage.r" },
    { weaponUuid: "Item.other" },
    { finalAttack: { source: "combatInstincts" } },
    { checkKind: "damage" }
  ])
    assert.throws(() => opportunistDamageSource(attack(patch), facts), /Opportunist hit/, JSON.stringify(patch));
  const rolled = [
    { flags: { spycraft2: { checkKind: "damage", opportunistDamage: { attackUuid: "ChatMessage.h" } } } }
  ];
  assert.throws(() => opportunistDamageSource(attack(), { ...facts, messages: rolled }), /already has its damage/);
  assert.ok(opportunistDamageSource(attack(), { ...facts, messages: rolled, rerollOf: "ChatMessage.d" }));
  assert.match(opportunistNote({ source: "opportunist" }), /half damage, rounded up.*\(p\.175\)/);
  assert.equal(opportunistNote({ source: "snapShot" }), "");
});

test("the control posts one free final attack; its hit rolls halved damage once from the card", async () => {
  const { a, w, messages } = finalAttackActor(["Opportunist"]),
    input = { ...confirmed, weaponId: w.id, triggerDescription: "Guard dropped" };
  const posted = await takeOpportunist(a, input),
    c = posted.flags.spycraft2;
  assert.equal(c.finalAttack.source, "opportunist");
  assert.equal(c.finalAttack.halfDamage, true);
  assert.equal(c.weaponUuid, w.uuid);
  assert.equal(a.system.resourceUses.opportunist.used, 1);
  const warnings = [];
  ui.notifications.warn = m => warnings.push(m);
  await takeOpportunist(a, input).catch(e => warnings.push(e.message));
  assert.ok(warnings.length, "a second use this round is refused");
  assert.equal(messages.filter(m => m.flags.spycraft2.finalAttack?.source === "opportunist").length, 1);

  const controls = () =>
    rollPipeline.chatControls({ message: posted, check: c, actor: a, user: game.user, checkKind: "attack" }) ?? [];
  assert.equal(controls().length, 0, "no damage control before the hit is resolved");
  Object.assign(c, { resolved: true, successConfirmed: true });
  const control = controls().find(x => /Opportunist damage/.test(x.label));
  assert.ok(control);
  const plain = await a.rollDamage(w, { includeSneakAttack: false }),
    halved = await control.run();
  assert.equal(halved.flags.spycraft2.formula, halvedFormula(plain.flags.spycraft2.formula));
  assert.deepEqual(halved.flags.spycraft2.opportunistDamage, {
    version: 1,
    attackUuid: posted.uuid,
    halved: true
  });
  assert.equal(
    controls().some(x => /Opportunist damage/.test(x.label)),
    false,
    "rolled once"
  );
  await assert.rejects(
    a.rollDamage(w, { opportunistAttackUuid: posted.uuid, includeSneakAttack: false }),
    /already has/
  );
});

test("the Main tab offers the control", async () => {
  const html = await readFile(new URL("../templates/actor/agent-main.hbs", import.meta.url), "utf8");
  assert.match(html, /data-action="takeOpportunist"/);
  assert.match(html, /data-resource="opportunist"/);
});
