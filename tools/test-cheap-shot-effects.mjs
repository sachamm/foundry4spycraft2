import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  cheapShotApplyPlan as apply,
  cheapShotRecoveryPlan as recovery,
  cheapShotPenalty as penalty,
  cheapShotSpeedPenalty as speed,
  cheapShotRecords,
  validateCheapShotRecoveryProof as validate
} from "../module/rules/cheap-shot-effects.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { weaponAttack } from "../module/rules/gear.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const check = (choice = "dex") => ({
    actorUuid: "Actor.attacker",
    checkKind: "attack",
    resolved: true,
    successConfirmed: true,
    attackContext: { cheapShot: { active: true, choice, madeAt: 100, scene: "sceneA" } }
  }),
  system = (rows = []) => ({ usagePeriods: { scene: "sceneA" }, cheapShots: rows }),
  record = (choice = "dex") =>
    apply(system(), check(choice), { sourceMessage: "ChatMessage.hit", now: 120, scene: "sceneA" }).record;
test("only a successful resolved current-scene attack creates a record; same receipt is idempotent and recovery never restores eligibility", () => {
  const r = record();
  assert.equal(r.choice, "dex");
  assert.equal(
    apply(system([r]), check(), { sourceMessage: "ChatMessage.hit", now: 120, scene: "sceneA" }).existing,
    true
  );
  for (const recovered of [false, true])
    assert.throws(
      () =>
        apply(system([{ ...r, recovered }]), check(), {
          sourceMessage: "ChatMessage.other",
          now: 180,
          scene: "sceneA"
        }),
      /already suffered/
    );
  for (const c of [
    { ...check(), superseded: "x" },
    { ...check(), resolved: false },
    { ...check(), successConfirmed: false }
  ])
    assert.throws(() => apply(system(), c, { sourceMessage: "ChatMessage.hit", now: 120, scene: "sceneA" }));
  assert.throws(() => apply(system(), check(), { sourceMessage: "ChatMessage.hit", now: 120, scene: "sceneB" }));
});
test("attribute penalties affect only matching attack and skill checks, leaving scores/saves and conditioned bonuses unchanged; Speed remains independent", () => {
  for (const chosen of ["str", "dex", "con", "int", "wis", "cha", "speed"]) {
    const s = system([record(chosen)]);
    for (const ability of ["str", "dex", "con", "int", "wis", "cha"])
      assert.equal(penalty(s, ability), ability === chosen ? -2 : 0);
    assert.equal(speed(s), chosen === "speed" ? -10 : 0);
  }
  const s = {
    ...system([record()]),
    activeFeatNames: [],
    abilities: { dex: { mod: 2, value: 14 }, str: { mod: 1, value: 12 } },
    skillTotals: {
      sleightOfHand: {
        ranks: 4,
        cap: 50,
        threat: 20,
        totals: [{ ability: "dex", total: 10, normalSkillBonus: 10 }],
        bonusEntries: []
      }
    },
    conditionContext: { baffled: true },
    proficiencyTotals: { edged: { proficient: true } },
    bab: 3
  };
  const c = cfg.skills.sleightOfHand.checks[0],
    opts = { synergySkill: "none", gearStatus: "available" },
    p = resolveSkillCheck(s, "sleightOfHand", c, opts),
    base = resolveSkillCheck({ ...s, cheapShots: [] }, "sleightOfHand", c, opts);
  assert.equal(p.total, base.total - 2);
  assert.equal(p.skillBonusCondition.normal, base.skillBonusCondition.normal);
  const w = {
    proficiency: "edged",
    attackAbility: "dex",
    sizeHands: "T/1h",
    qualities: "",
    error: 1,
    threat: 20,
    range: 0
  };
  assert.equal(weaponAttack(s, w, cfg).total, weaponAttack({ ...s, cheapShots: [] }, w, cfg).total - 2);
  assert.deepEqual(s.abilities.dex, { mod: 2, value: 14 });
  const k = {
    ...s,
    cheapShots: [record("int")],
    knowledgeStandardBonus: 3,
    knowledge: 3,
    abilities: { ...s.abilities, int: { mod: 1, value: 12 } },
    conditionContext: {}
  };
  assert.equal(
    resolveKnowledgeCheck(k, { skill: "sleightOfHand" }).total,
    resolveKnowledgeCheck({ ...k, cheapShots: [] }, { skill: "sleightOfHand" }).total - 2
  );
});
test("scene expiry and recovery remove penalties but retain historical records; malformed or competing current records require review", () => {
  const r = record();
  assert.equal(penalty({ ...system([r]), usagePeriods: { scene: "sceneB" } }, "dex"), 0);
  assert.equal(penalty(system([{ ...r, recovered: true }]), "dex"), 0);
  assert.equal(cheapShotRecords({ ...system([r]), usagePeriods: { scene: "sceneB" } }).length, 0);
  for (const patch of [
    { madeAt: NaN },
    { choice: "defense" },
    { scene: "" },
    { lastSaveAt: 90 },
    { recovered: "true" }
  ])
    assert.throws(() => cheapShotRecords(system([{ ...r, ...patch }])));
  assert.throws(() => cheapShotRecords(system([r, { ...r, sourceMessage: "another" }])));
});
test("Fortitude recovery DC declines at full-minute boundaries, begins immediately and consumes one attempt per minute", () => {
  const r = record();
  for (const now of [99]) assert.throws(() => recovery(system([r]), { sourceMessage: r.sourceMessage, now }));
  for (const [now, dc] of [
    [100, 20],
    [159.9, 20],
    [160, 18],
    [219.9, 18],
    [220, 16],
    [700, 0],
    [760, -2]
  ])
    assert.equal(recovery(system([r]), { sourceMessage: r.sourceMessage, now }).dc, dc);
  const used = { ...r, lastSaveAt: 160, attemptId: "attempt", attemptResolved: true };
  assert.throws(() => recovery(system([used]), { sourceMessage: r.sourceMessage, now: 219.9 }));
  assert.equal(recovery(system([used]), { sourceMessage: r.sourceMessage, now: 220 }).dc, 16);
  assert.throws(
    () => recovery(system([{ ...used, attemptResolved: false }]), { sourceMessage: r.sourceMessage, now: 999 }),
    /previous/
  );
});
test("recovery proof binds Fortitude, current scene, attempt and exact DC, preventing forged replacement saves", () => {
  const r = record(),
    p = { ...recovery(system([r]), { sourceMessage: r.sourceMessage, now: 160 }), attemptId: "attempt" },
    a = { system: system([{ ...r, lastSaveAt: 160, attemptId: "attempt" }]), usagePeriods: { scene: "sceneA" } },
    c = { checkKind: "save", checkId: "fort" };
  validate(a, p, c);
  for (const patch of [{ dc: 0 }, { at: 220 }, { attemptId: "other" }, { scene: "sceneB" }, { madeAt: 0 }])
    assert.throws(() => validate(a, { ...p, ...patch }, c));
  assert.throws(() => validate(a, p, { checkKind: "save", checkId: "ref" }));
  assert.throws(() => validate(a, p, { ...c, checkMethod: "take10" }));
});
const { settleCheapShot, rollCheapShotRecovery, settleCheapShotRecovery } =
  await import("../module/apps/cheap-shot-effects.mjs");
globalThis.game = { user: { isGM: true }, time: { worldTime: 120 }, settings: { get: () => false } };
globalThis.foundry = { utils: { randomID: () => String(++sequence) } };
let sequence = 0;
function actor(uuid) {
  const a = {
    uuid,
    isOwner: true,
    type: "agent",
    usagePeriods: { scene: "sceneA" },
    system: system(),
    effects: [],
    statuses: new Set()
  };
  a.update = async patch => {
    if (patch["system.cheapShots"]) a.system.cheapShots = structuredClone(patch["system.cheapShots"]);
    return a;
  };
  return a;
}
function receipt(uuid, c) {
  const m = {
    uuid,
    flags: { spycraft2: structuredClone(c) },
    update: async patch => {
      for (const [key, value] of Object.entries(patch))
        m.flags.spycraft2[key.split(".").at(-1)] = structuredClone(value);
      return m;
    }
  };
  return m;
}
test("actual settlement serializes competing hits, persists idempotent application, and cannot change a previously recorded weakness", async () => {
  const source = actor("Actor.attacker"),
    target = actor("Actor.target");
  globalThis.fromUuid = async () => target;
  const c = {
      ...check(),
      attackContext: { cheapShot: { ...check().attackContext.cheapShot, targetUuid: target.uuid } }
    },
    m = receipt("ChatMessage.hit", c);
  await Promise.all([settleCheapShot(source, m), settleCheapShot(source, m)]);
  assert.equal(target.system.cheapShots.length, 1);
  assert.equal(m.flags.spycraft2.cheapShotSettlement.kind, "hit");
  const other = receipt("ChatMessage.other", c);
  await assert.rejects(settleCheapShot(source, other), /already suffered/);
  delete m.flags.spycraft2.cheapShotSettlement;
  m.flags.spycraft2.attackContext.cheapShot.choice = "str";
  await assert.rejects(settleCheapShot(source, m), /receipt changed/);
});
test("recovery attempts reserve before rolling, block concurrent use, and settle only the exact resolved save/DC", async () => {
  const a = actor("Actor.target");
  a.system.cheapShots = [record()];
  game.time.worldTime = 160;
  let rolls = 0;
  a.rollSave = async (key, opts) => {
    rolls++;
    assert.equal(key, "fort");
    opts.validateCheapShotRecovery();
    return receipt("ChatMessage.save", {
      actorUuid: a.uuid,
      checkKind: "save",
      checkId: "fort",
      resolved: true,
      successConfirmed: true,
      effectiveTotal: 18,
      cheapShotRecovery: opts.cheapShotRecovery
    });
  };
  const save = await rollCheapShotRecovery(a, "ChatMessage.hit");
  assert.equal(rolls, 1);
  await assert.rejects(rollCheapShotRecovery(a, "ChatMessage.hit"), /previous/);
  save.flags.spycraft2.cheapShotRecovery.dc = 1;
  await assert.rejects(settleCheapShotRecovery(a, save));
  save.flags.spycraft2.cheapShotRecovery.dc = 18;
  await settleCheapShotRecovery(a, save);
  assert.equal(a.system.cheapShots[0].recovered, true);
  assert.equal(cheapShotRecords(a.system).length, 1);
  await settleCheapShotRecovery(a, save);
  assert.equal(a.system.cheapShots.length, 1);
});
test("GC review closes an interrupted attempt without restoring its minute or rerolling an existing receipt", async () => {
  const { reviewCheapShotRecovery } = await import("../module/apps/cheap-shot-effects.mjs"),
    a = actor("Actor.target");
  a.system.cheapShots = [{ ...record(), lastSaveAt: 160, attemptId: "pending", attemptResolved: false }];
  game.time.worldTime = 160;
  game.messages = [];
  const reviewed = await reviewCheapShotRecovery(a, "ChatMessage.hit", { confirmed: true });
  assert.equal(reviewed.lastSaveAt, 160);
  assert.equal(a.system.cheapShots[0].attemptResolved, true);
  assert.throws(() => recovery(a.system, { sourceMessage: "ChatMessage.hit", now: 160 }));
  assert.equal(recovery(a.system, { sourceMessage: "ChatMessage.hit", now: 220 }).dc, 16);
  a.system.cheapShots[0].attemptResolved = false;
  game.messages = [
    receipt("ChatMessage.existing", {
      actorUuid: a.uuid,
      checkKind: "save",
      checkId: "fort",
      cheapShotRecovery: { attemptId: "pending", sourceMessage: "ChatMessage.hit" }
    })
  ];
  globalThis.ui = { notifications: { info: () => {} } };
  assert.equal(
    (await reviewCheapShotRecovery(a, "ChatMessage.hit", { confirmed: true })).existingMessage,
    "ChatMessage.existing"
  );
  assert.equal(a.system.cheapShots[0].attemptResolved, false);
});
test("real engine shows incoming Cheap Shot on summary attacks and Speed without altering attributes, saves, health or applying INT Knowledge twice", async () => {
  const { makeFatigueActor } = await import("./fixtures/fatigue-actor.mjs"),
    a = makeFatigueActor();
  a.raw.usagePeriods = { scene: "sceneA" };
  a.derive();
  const base = structuredClone(a.system),
    knowledge = resolveKnowledgeCheck(base, { skill: "athletics" }).total;
  for (const choice of ["str", "dex", "con", "int", "speed"]) {
    a.raw.cheapShots = [record(choice)];
    a.derive();
    assert.equal(a.system.attack.melee, base.attack.melee + (choice === "str" ? -2 : 0));
    assert.equal(a.system.attack.unarmed, base.attack.unarmed + (choice === "str" ? -2 : 0));
    assert.equal(a.system.attack.ranged, base.attack.ranged + (choice === "dex" ? -2 : 0));
    assert.equal(a.system.speed, Math.max(0, base.speed + (choice === "speed" ? -10 : 0)));
    assert.equal(a.system.saves.fort.total, base.saves.fort.total);
    assert.equal(
      resolveKnowledgeCheck(a.system, { skill: "athletics" }).total,
      knowledge + (choice === "int" ? -2 : 0)
    );
    for (const key of ["str", "dex", "con", "int", "wis", "cha"])
      assert.equal(a.system.abilities[key].value, base.abilities[key].value);
    assert.equal(a.system.vitality.value, base.vitality.value);
    assert.equal(a.system.wounds.value, base.wounds.value);
  }
});
