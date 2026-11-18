import test from "node:test";
import assert from "node:assert/strict";
import { characterTargetPlan, validCharacterTarget } from "../module/rules/character-target.mjs";
import { cleaveCriticalPlan } from "../module/rules/cleave.mjs";
import {
  completeCharacterTarget,
  validateCharacterTarget,
  attackCharacterTargetChoices,
  characterTargetContent,
  knownCharacterTargetInput
} from "../module/apps/character-target.mjs";
import { weaponAttack, weaponDamage } from "../module/rules/gear.mjs";
import { criticalPlan } from "../module/rules/criticals.mjs";
import { standardAttackContextInput } from "../module/apps/standard-attack-context.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
import { limitedUseAbilities } from "../module/rules/limited-uses.mjs";
import { takeDartingFinalAttack } from "../module/apps/darting.mjs";
import { dartingDeclarationPlan } from "../module/rules/darting.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import "./fixtures/fatigue-actor.mjs"; // sets up the Foundry stand-ins this file relies on

const { SpycraftActor } = await import("../module/documents/actor.mjs");
const npc = (npcType = "standard") => ({ uuid: "Actor.target", type: "npc", npcType, createdTime: 100 }),
  context = () => characterTargetPlan(npc()),
  special = () => characterTargetPlan(npc("special"));
const system = () => ({
    activeFeatNames: ["Cleave Mastery", "Cleave Supremacy"],
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
    proficiencyTotals: Object.fromEntries(Object.keys(cfg.proficiencies).map(k => [k, { proficient: true }])),
    bab: 12,
    conditionContext: {},
    classLevels: {},
    classOptionSelections: [],
    unarmed: { die: 3, damageBonus: 2 },
    actionDice: { value: 0 },
    wounds: { value: 4 },
    resourceUses: {}
  }),
  weapon = proficiency => ({
    proficiency,
    sizeHands: "S/1h",
    damage: "1d6",
    errorThreat: "1/20",
    range: 30,
    fireModes: ["single"],
    fireMode: "single",
    recoil: 0
  });
const costOptions = {
  baseCost: 1,
  effect: "GC-confirmed critical effect",
  effectConfirmed: true,
  beforeDamage: true,
  available: 4
};
test("actual standard/special sheets govern classification; animals and unrecorded targets require explicit GC facts, and contradictory declarations cannot override a sheet", () => {
  assert.equal(context().standard, true);
  assert.equal(special().standard, false);
  assert.equal(characterTargetPlan({ uuid: "Actor.pc", type: "agent" }).standard, false);
  assert.throws(() => characterTargetPlan(npc("animal")), /classify/);
  for (const type of ["standard", "special"]) {
    assert.equal(characterTargetPlan(npc("animal"), { targetCharacterType: type }).standard, type === "standard");
    assert.equal(
      characterTargetPlan(null, { targetCharacterType: type, targetName: "Actual target" }).standard,
      type === "standard"
    );
  }
  for (const [target, type] of [
    [npc(), "special"],
    [npc("special"), "standard"],
    [{ uuid: "Actor.pc", type: "agent" }, "standard"]
  ])
    assert.throws(() => characterTargetPlan(target, { targetCharacterType: type }), /conflicts/);
  for (const input of [
    {},
    { targetCharacterType: "standard", targetName: "" },
    { targetCharacterType: true, targetName: "X" },
    { targetCharacterType: "standard", targetName: "X".repeat(201) }
  ])
    assert.throws(() => characterTargetPlan(null, input));
  assert.equal(validCharacterTarget(Object.fromEntries(Object.entries(context()).reverse())), true);
  assert.equal(validCharacterTarget({ ...context(), standard: false }), false);
});
test("Mastery increases threat only for melee/unarmed attacks against confirmed standard characters, preserving attack/damage/error totals for every proficiency", () => {
  for (const key of Object.keys(cfg.proficiencies))
    for (const target of [
      context(),
      special(),
      characterTargetPlan(null, { targetCharacterType: "standard", targetName: "Manual opponent" })
    ]) {
      const s = system(),
        w = weapon(key),
        a = weaponAttack(s, w, cfg, "agent", { characterTarget: target }),
        b = weaponAttack({ ...s, activeFeatNames: [] }, w, cfg),
        melee = ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(key);
      assert.equal(a.threat, b.threat - (melee && target.standard ? 1 : 0), key);
      assert.equal(a.total, b.total);
      assert.equal(a.error, b.error);
      assert.equal(weaponDamage(s, w).bonus, weaponDamage({ ...s, activeFeatNames: [] }, w).bonus);
    }
});
test("Mastery stacks once with Finesse and animal threat bonuses, preserves no-threat attacks and stops at natural one", () => {
  const s = system();
  s.activeFeatNames.push("Finesse Mastery", "Finesse Supremacy");
  s.classOptionSelections = [{ classId: "scout", name: "Game Hunter" }];
  const w = weapon("edged"),
    opts = { characterTarget: context(), targetAnimal: true };
  assert.equal(weaponAttack(s, w, cfg, "agent", opts).threat, 14);
  assert.equal(weaponAttack(s, { ...w, errorThreat: "1/—", threat: 0 }, cfg, "agent", opts).threat, 0);
  assert.equal(weaponAttack(s, { ...w, errorThreat: "1/2" }, cfg, "agent", opts).threat, 1);
  assert.throws(
    () => weaponAttack(s, w, cfg, "agent", { characterTarget: { ...context(), standard: false } }),
    /target/
  );
});
test("Supremacy critical discount is standard-melee only, stacks with other discounts to zero and cannot change errors or override a recorded special target", () => {
  for (const key of Object.keys(cfg.proficiencies))
    for (const target of [
      context(),
      special(),
      characterTargetPlan(null, { targetCharacterType: "object", targetName: "An actual door" })
    ]) {
      const check = {
          checkKind: "attack",
          weaponProficiency: key,
          threatConfirmed: true,
          attackContext: { characterTarget: target }
        },
        p = criticalPlan(system(), check, costOptions),
        melee = ["unarmed", "blunt", "exoticBlunt", "edged", "exoticEdged"].includes(key);
      assert.equal(p.cost, melee && target.standard ? 0 : 1, key);
      assert.equal(criticalPlan(system(), check, { ...costOptions, legacyStandardTargetConfirmed: true }).cost, p.cost);
    }
  const s = system();
  s.activeFeatNames.push("Finesse Supremacy", "Expert Disarm");
  const check = {
    checkKind: "attack",
    weaponProficiency: "edged",
    threatConfirmed: true,
    attackContext: { ranged: false, characterTarget: context(), disarm: { active: true } }
  };
  assert.equal(criticalPlan(s, check, { ...costOptions, baseCost: 3, available: 0 }).cost, 0);
  assert.equal(
    criticalPlan(
      s,
      { ...check, threatConfirmed: false, errorConfirmed: true },
      { ...costOptions, kind: "failure", samePayer: false, opponent: true, lineOfSight: true }
    ).cost,
    1
  );
  assert.equal(criticalPlan(s, { ...check, checkKind: "save" }, costOptions).blocked, true);
  assert.equal(
    cleaveCriticalPlan(s, { ...check, attackContext: { ranged: false, characterTarget: { standard: true } } }).blocked,
    true
  );
});
test("unrecorded legacy melee targets require the explicit original-target confirmation; known special targets and ranged attacks cannot claim it", () => {
  const check = { checkKind: "attack", weaponProficiency: "edged", threatConfirmed: true };
  assert.equal(criticalPlan(system(), check, costOptions).cost, 1);
  const p = criticalPlan(system(), check, { ...costOptions, legacyStandardTargetConfirmed: true, available: 0 });
  assert.equal(p.cost, 0);
  assert.equal(p.targetStandardDeclared, true);
  assert.equal(
    criticalPlan(
      system(),
      { ...check, weaponProficiency: "rifle" },
      { ...costOptions, legacyStandardTargetConfirmed: true }
    ).cost,
    1
  );
  assert.equal(
    criticalPlan(
      system(),
      { ...check, attackContext: { ranged: false, characterTarget: special() } },
      { ...costOptions, legacyStandardTargetConfirmed: true }
    ).cost,
    1
  );
  assert.equal(criticalPlan(system(), check, { ...costOptions, legacyStandardTargetConfirmed: "true" }).cost, 1);
});
let serial = 0,
  answer = null;
function reset() {
  serial = 0;
  answer = null;
  game.user = { id: "gc", isGM: true, targets: new Set() };
  game.actors = [];
  game.combats = [];
  game.messages = [];
  foundry.utils.escapeHTML = s => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  foundry.applications.api.DialogV2.input = async () => (typeof answer === "function" ? answer() : answer);
  globalThis.fromUuid = async id => game.actors.find(a => a.uuid === id) ?? null;
}
function target(type = "standard") {
  const t = {
    documentName: "Actor",
    uuid: "Actor.target",
    type: "npc",
    name: "Known target",
    system: { npcType: type },
    _stats: { createdTime: 100 },
    observed: true,
    isOwner: false,
    testUserPermission: (_u, level) => level === "OBSERVER" && t.observed
  };
  game.actors.push(t);
  return t;
}
function actor() {
  reset();
  const a = {
    uuid: "Actor.cleave",
    type: "agent",
    isOwner: true,
    flags: {},
    system: system(),
    items: [{ id: "blade", uuid: "Actor.cleave.Item.blade", name: "Blade", type: "weapon", system: weapon("edged") }],
    weaponContext: (_w, o) => o,
    getRollData: () => ({}),
    async update(patch) {
      for (const [path, value] of Object.entries(patch)) {
        const keys = path.split(".");
        let obj = this;
        for (const k of keys.slice(0, -1)) obj = obj[k] ??= {};
        const last = keys.at(-1);
        if (last.startsWith("-=")) delete obj[last.slice(2)];
        else obj[last] = structuredClone(value);
      }
      a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
      return a;
    }
  };
  a.items[0].system.equipped = true;
  a.items[0].system.carried = true;
  a.items[0].system.quantity = 1;
  a.items.get = id => a.items.find(i => i.id === id);
  a.weaponAttack = (w, o) => weaponAttack(a.system, w.system, cfg, "agent", o);
  a.rollCheck = async (_formula, data, options) => {
    await options.validateAttackContext?.();
    await options.validateFinalAttack?.();
    await a.hook?.();
    await options.validateAttackContext?.();
    await options.validateFinalAttack?.();
    const m = { id: "message" + ++serial, data, flags: { spycraft2: { actorUuid: a.uuid, ...options } } };
    game.messages.push(m);
    return m;
  };
  a.rollAttack = (w, o) => SpycraftActor.prototype.rollAttack.call(a, w, o);
  return a;
}
test("target choices require observable characters; unreadable targets can use explicit GC manual facts, and a chosen animal forwards the existing animal benefit", async () => {
  const a = actor(),
    t = target();
  game.user.isGM = false;
  assert.equal(attackCharacterTargetChoices().length, 1);
  const prepared = await completeCharacterTarget(a, a.items[0].system, { targetActorUuid: t.uuid }, { prompt: false });
  assert.equal(prepared.characterTarget.standard, true);
  t.observed = false;
  await assert.rejects(validateCharacterTarget(prepared.characterTarget), /observed/);
  assert.equal(attackCharacterTargetChoices().length, 0);
  const fallback = knownCharacterTargetInput(t.uuid, {}, "standard");
  assert.equal(fallback.targetActorUuid, "");
  assert.equal(
    (await completeCharacterTarget(a, a.items[0].system, fallback, { prompt: false })).characterTarget.standard,
    true
  );
  t.observed = true;
  t.system.npcType = "animal";
  const animal = await completeCharacterTarget(
    a,
    a.items[0].system,
    { targetActorUuid: t.uuid, targetCharacterType: "special" },
    { prompt: false }
  );
  assert.equal(animal.characterTarget.standard, false);
  assert.equal(animal.targetAnimal, true);
});
test("actual Actor attack records the target and exact increment, preserving validators and rejecting type, identity, permission, deletion and feat changes during RNG", async () => {
  const a = actor(),
    t = target();
  let validations = 0;
  const r = await a.rollAttack(a.items[0], {
    targetActorUuid: t.uuid,
    targetAnimal: false,
    validateAttackContext: () => validations++
  });
  assert.equal(r.flags.spycraft2.threat, 19);
  assert.equal(r.flags.spycraft2.attackContext.characterTarget.standard, true);
  assert.equal(r.flags.spycraft2.attackContext.cleaveThreatIncrease, 1);
  assert.equal(validations, 2);
  for (const change of [
    (a, t) => (t.system.npcType = "special"),
    (a, t) => t._stats.createdTime++,
    (a, t) => {
      game.user.isGM = false;
      t.observed = false;
    },
    () => game.actors.splice(0),
    a => (a.system.activeFeatNames = [])
  ]) {
    const a = actor(),
      t = target();
    a.hook = () => change(a, t);
    await assert.rejects(
      a.rollAttack(a.items[0], { targetActorUuid: t.uuid, targetAnimal: false }),
      /classification changed|observed|threat source/
    );
    assert.equal(game.messages.length, 0);
  }
});
test("manual declarations, cancellation and typed shared inputs reject guessed classifications before rolling; HTML target labels are escaped", async () => {
  const a = actor();
  assert.equal(await a.rollAttack(a.items[0], { targetAnimal: false }), null);
  assert.equal(game.messages.length, 0);
  const m = await a.rollAttack(a.items[0], {
    targetActorUuid: "",
    targetCharacterType: "special",
    targetName: "Actual unrecorded target",
    targetAnimal: false
  });
  assert.equal(m.flags.spycraft2.threat, 20);
  for (const p of [{ targetActorUuid: true }, { targetCharacterType: "other" }, { targetName: 0 }])
    assert.throws(() => standardAttackContextInput(p));
  const t = target();
  t.name = "<b>Target</b>";
  assert.match(characterTargetContent(a), /&lt;b>/);
  assert.doesNotMatch(characterTargetContent(a), /<b>Target/);
});
test("target facts and threat increment are frozen for outcome decisions, including a special target that grants no bonus", async () => {
  for (const type of ["standard", "special"]) {
    const a = actor(),
      t = target(type),
      m = await a.rollAttack(a.items[0], { targetActorUuid: t.uuid, targetAnimal: false }),
      check = m.flags.spycraft2,
      e = rollEvidence(check);
    check.attackContext.characterTarget.standard = !check.attackContext.characterTarget.standard;
    assert.equal(rollEvidenceMatches(e, check), false);
    check.attackContext.characterTarget.standard = type === "standard";
    check.attackContext.cleaveThreatIncrease++;
    assert.equal(rollEvidenceMatches(e, check), false);
  }
});
test("final-attack target dialog resolves before either counter is reserved; the real final pipeline receives the typed target without a second prompt", async () => {
  const a = actor(),
    t = target(),
    clock = { id: "combat", started: true, round: 2, turn: 0, combatantId: "own", ownTurnIndex: 0 };
  a.system.activeFeatNames.push("Darting Weapon");
  a.system.dartingStyle = {
    ...dartingDeclarationPlan(a.system, clock, { extraAttacks: 1, atStartOfInitiative: true, confirmed: true }),
    id: "grant"
  };
  a.system.dartingCombatContext = clock;
  a.system.resourceUses = { dartingFinalAttack: { epoch: "grant", used: 0 } };
  a.participatingCombat = { ...clock, turns: [{ id: "own", actor: a }] };
  Object.defineProperty(a, "usagePeriods", { get: () => ({ round: "combat:2", "darting declaration": "grant" }) });
  a.actionDiceFundingSystem = a.system;
  a.useLimitedAbility = SpycraftActor.prototype.useLimitedAbility;
  a.system.limitedUses = limitedUseAbilities(a.system, [], cfg);
  let prompts = 0;
  answer = () => {
    prompts++;
    assert.equal(a._finalAttackReservation, undefined);
    assert.equal(a.system.resourceUses.dartingFinalAttack.used, 0);
    assert.equal(a.system.resourceUses.finalAttackRound, undefined);
    return { targetActorUuid: t.uuid, targetCharacterType: "", targetName: "" };
  };
  const m = await takeDartingFinalAttack(a, { weaponId: "blade", confirmed: true });
  assert.equal(prompts, 1);
  assert.equal(m.flags.spycraft2.attackContext.cleaveThreatIncrease, 1);
  assert.equal(a.system.resourceUses.dartingFinalAttack.used, 1);
  assert.equal(a.system.resourceUses.finalAttackRound.used, 1);
});

test("fixed reaction target cannot be changed by the classification dialog, including animal classification and unreadable-source manual facts", async () => {
  const a = actor(),
    original = target("animal"),
    other = { ...target(), uuid: "Actor.other" };
  game.actors[1] = other;
  answer = () => ({ targetActorUuid: other.uuid, targetCharacterType: "standard", targetName: "Another target" });
  const prepared = await completeCharacterTarget(
    a,
    a.items[0].system,
    { targetActorUuid: original.uuid },
    { fixedTargetUuid: original.uuid }
  );
  assert.equal(prepared.characterTarget.actorUuid, original.uuid);
  assert.equal(prepared.characterTarget.npcType, "animal");
  assert.equal(prepared.characterTarget.standard, true);
  assert.equal(prepared.targetAnimal, true);
  answer = () => ({ targetActorUuid: other.uuid, targetCharacterType: "special", targetName: "Changed name" });
  const manual = await completeCharacterTarget(
    a,
    a.items[0].system,
    {},
    { fixedTargetUuid: "", fixedTargetName: "Original attacking opponent" }
  );
  assert.equal(manual.characterTarget.source, "gcManual");
  assert.equal(manual.characterTarget.name, "Original attacking opponent");
  assert.equal(manual.characterTarget.standard, false);
});

test("objects are valid non-character targets and cannot receive standard-character bonuses or a legacy override", async () => {
  const t = characterTargetPlan(null, { targetCharacterType: "object", targetName: "An actual door" });
  assert.equal(validCharacterTarget(t), true);
  assert.equal(t.standard, false);
  const s = system(),
    w = weapon("edged");
  assert.equal(weaponAttack(s, w, cfg, "agent", { characterTarget: t }).threat, 20);
  assert.equal(
    criticalPlan(
      s,
      { checkKind: "attack", weaponProficiency: "edged", threatConfirmed: true, attackContext: { characterTarget: t } },
      { ...costOptions, legacyStandardTargetConfirmed: true }
    ).cost,
    1
  );
  assert.equal(characterTargetPlan(npc("animal"), { targetCharacterType: "object" }).standard, false);
  assert.equal(validCharacterTarget(characterTargetPlan(npc(), { targetCharacterType: "object" })), true);
  const a = actor(),
    m = await a.rollAttack(a.items[0], {
      targetActorUuid: "",
      targetCharacterType: "object",
      targetName: "A door",
      targetAnimal: false
    });
  assert.equal(m.flags.spycraft2.threat, 20);
  assert.equal(m.flags.spycraft2.attackContext.characterTarget.characterType, "object");
});
