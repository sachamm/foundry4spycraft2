import test from "node:test";
import assert from "node:assert/strict";
import { checkCandidates, adjudicateCheck, checkFlavor } from "../module/rules/outcomes.mjs";
import { actionDieBoostPlan, actionDieBoostResult } from "../module/rules/action-dice.mjs";
const check = {
  checkKind: "skill",
  checkMethod: "roll",
  rawTotal: 35,
  effectiveTotal: 35,
  naturalDie: 1,
  error: 1,
  threat: 20,
  cap: 40,
  boostTotal: 0,
  boostSpent: 0
};
test("RAW pp.96–97,330: natural 1 is only a potential error until failure is confirmed", () => {
  assert.equal(checkCandidates(check).error, true);
  assert.equal(adjudicateCheck(check, true).errorConfirmed, false);
  assert.equal(adjudicateCheck(check, false).errorConfirmed, true);
  assert.match(checkFlavor({ ...check, baseFlavor: "Test" }), /Error, if it fails/);
  assert.equal(
    actionDieBoostPlan({ actionDice: { value: 1, die: 4 } }, { ...check, successConfirmed: true }).blocked,
    false
  );
});
test("RAW p.97: negative skill, Knowledge and attack results operate like errors even outside the natural error range or on fixed checks", () => {
  for (const checkKind of ["skill", "knowledge", "attack"])
    for (const checkMethod of ["roll", "take10"]) {
      const negative = {
        ...check,
        checkKind,
        checkMethod,
        naturalDie: checkMethod === "roll" ? 8 : null,
        error: 0,
        rawTotal: -2,
        effectiveTotal: -2
      };
      assert.equal(checkCandidates(negative).error, true);
      assert.equal(adjudicateCheck(negative, false).errorConfirmed, true);
    }
  assert.equal(
    checkCandidates({ ...check, checkKind: "save", naturalDie: 8, rawTotal: -2, effectiveTotal: -2 }).error,
    false
  );
});
test("failed high rolls are neither threats nor Triumphs, and do not retain those cap exceptions", () => {
  const threat = { ...check, naturalDie: 20, rawTotal: 55, effectiveTotal: 55, cap: 40 };
  assert.equal(adjudicateCheck(threat, true).threatConfirmed, true);
  assert.equal(adjudicateCheck(threat, true).effectiveTotal, 55);
  const failed = adjudicateCheck(threat, false);
  assert.equal(failed.threatConfirmed, false);
  assert.equal(failed.effectiveTotal, 40);
  const triumph = { ...check, naturalDie: 17, rawTotal: 80, effectiveTotal: 80, cap: 60 };
  assert.equal(adjudicateCheck(triumph, true).triumphed, true);
  assert.equal(adjudicateCheck(triumph, false).triumphed, false);
  assert.equal(adjudicateCheck(triumph, false).effectiveTotal, 60);
  assert.equal(checkCandidates({ ...check, checkKind: "save", naturalDie: 1 }).error, false);
  assert.equal(checkCandidates({ ...check, checkKind: "save", naturalDie: 20 }).threat, false);
});
test("negative-result error activation has priority before the first boost, while later boosts do not reopen that decision", () => {
  const sys = { actionDice: { value: 3, die: 4 }, activeFeatNames: [] },
    negative = { ...check, naturalDie: 8, effectiveTotal: -1, rawTotal: -1, error: 0 };
  assert.equal(actionDieBoostPlan(sys, negative).blocked, true);
  assert.equal(actionDieBoostPlan(sys, negative, { errorDeclined: true }).blocked, false);
  assert.equal(actionDieBoostPlan(sys, { ...negative, boostSpent: 1 }).blocked, false);
  const high = { ...check, rawTotal: 74, effectiveTotal: 60, cap: 60, naturalDie: 17 };
  const boost = actionDieBoostResult(high, actionDieBoostPlan(sys, high), [19]);
  assert.equal(boost.potentialTriumph, true);
  assert.equal(boost.triumphed, false);
});
test("flavor replacement retains Practice Makes Perfect and both Bright Idea alternatives", () => {
  const text = checkFlavor({
    ...check,
    naturalDie: 3,
    minimumAdjustment: 7,
    alternatives: [
      { total: 10, naturalDie: 19 },
      { total: 28, naturalDie: 3 }
    ],
    chosenIndex: 1,
    boostTotal: 4,
    effectiveTotal: 39
  });
  assert.match(text, /Practice Makes Perfect/);
  assert.match(text, /alternatives 10 \(natural 19\) \/ 28 \(natural 3\)/);
  assert.match(text, /action dice \+4/);
});
globalThis.Actor = class {
  constructor() {
    this.uuid = "Actor.test";
    this.isOwner = true;
    this.type = "agent";
    this.system = { actionDice: { value: 3, die: 4 }, activeFeatNames: [] };
  }
  async update(data) {
    if (data["system.actionDice.value"] !== undefined) this.system.actionDice.value = data["system.actionDice.value"];
  }
};
globalThis.game = { user: { isGM: true } };
globalThis.ui = { notifications: { warn: () => null } };
globalThis.foundry = { utils: { escapeHTML: s => s } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
const weapon = {
  system: { destroyed: false, destroyedByRoll: "" },
  async update(data) {
    for (const [key, value] of Object.entries(data)) this.system[key.slice(7)] = value;
  }
};
globalThis.fromUuidSync = () => weapon;
let rollTotal = 3;
globalThis.Roll = class {
  constructor() {
    this.total = rollTotal;
    this.dice = [{ total: rollTotal }];
  }
  async evaluate() {
    return this;
  }
  async toMessage() {
    return {};
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function message(patch = {}) {
  return {
    uuid: "ChatMessage.test",
    flags: {
      spycraft2: {
        ...check,
        actorUuid: "Actor.test",
        checkKind: "attack",
        improvised: true,
        weaponUuid: "Actor.test.Item.weapon",
        ...patch
      }
    },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        if (key === "flags.spycraft2") this.flags.spycraft2 = value;
        else if (key.startsWith("flags.spycraft2.")) this.flags.spycraft2[key.slice(16)] = value;
        else this[key] = value;
      }
    }
  };
}
test("confirming a hit never destroys an improvised weapon; a confirmed failed error does, and a corrected result restores only linked destruction", async () => {
  const actor = new SpycraftActor(),
    msg = message();
  weapon.system = { destroyed: false, destroyedByRoll: "" };
  await actor.confirmCheckOutcome(msg, { succeeded: true });
  assert.equal(weapon.system.destroyed, false);
  await actor.confirmCheckOutcome(msg, { succeeded: false });
  assert.equal(weapon.system.destroyed, true);
  assert.equal(weapon.system.destroyedByRoll, msg.uuid);
  await actor.confirmCheckOutcome(msg, { succeeded: true });
  assert.equal(weapon.system.destroyed, false);
  weapon.system = { destroyed: true, destroyedByRoll: "Other damage" };
  await actor.confirmCheckOutcome(msg, { succeeded: true });
  assert.equal(weapon.system.destroyed, true);
});
test("failed outcome updates undo weapon effects, and secret adjudication is restricted to the GC", async () => {
  const actor = new SpycraftActor(),
    msg = message();
  weapon.system = { destroyed: false, destroyedByRoll: "" };
  msg.update = async () => {
    throw Error("update rejected");
  };
  await assert.rejects(actor.confirmCheckOutcome(msg, { succeeded: false }), /update rejected/);
  assert.equal(weapon.system.destroyed, false);
  game.user.isGM = false;
  const secret = message();
  secret.blind = true;
  assert.equal(await actor.confirmCheckOutcome(secret, { succeeded: false }), false);
  assert.equal(weapon.system.destroyed, false);
  game.user.isGM = true;
});
test("boosting reopens outcome adjudication and reverses only the prior roll’s provisional error effect", async () => {
  const actor = new SpycraftActor(),
    msg = message();
  weapon.system = { destroyed: false, destroyedByRoll: "" };
  await actor.confirmCheckOutcome(msg, { succeeded: false });
  rollTotal = 3;
  await actor.boostCheck(msg, { count: 1, errorDeclined: true });
  assert.equal(weapon.system.destroyed, false);
  assert.equal(msg.flags.spycraft2.successConfirmed, null);
  assert.equal(msg.flags.spycraft2.errorConfirmed, false);
  assert.equal(actor.system.actionDice.value, 2);
});

test("recorded rolls preserve a passive check’s boost prohibition, including when the GC resolves its secret result", async () => {
  const actor = new SpycraftActor();
  let recorded;
  const original = Roll.prototype.toMessage;
  Roll.prototype.toMessage = async function (data) {
    recorded = data;
    return data;
  };
  try {
    await actor.rollCheck(
      "1d20 + @total",
      { total: 0 },
      { checkKind: "skill", actionDiceAllowed: false, rollMode: "blindroll" }
    );
    assert.equal(recorded.flags.spycraft2.actionDiceAllowed, false);
    assert.equal(actionDieBoostPlan(actor.system, recorded.flags.spycraft2).blocked, true);
    await actor.rollCheck(
      "1d20 + @total",
      { total: 0 },
      { checkKind: "skill", actionDiceAllowed: true, rollMode: "blindroll" }
    );
    assert.equal(recorded.flags.spycraft2.actionDiceAllowed, true);
  } finally {
    Roll.prototype.toMessage = original;
  }
});

test("RAW pp.330–331: attack results of 75+ are Triumphs and include a critical hit even outside the natural threat range", () => {
  const attack = { ...check, checkKind: "attack", cap: null, rawTotal: 75, effectiveTotal: 75, naturalDie: 8 };
  assert.equal(checkCandidates(attack).triumph, true);
  const result = adjudicateCheck(attack, true);
  assert.equal(result.triumphed, true);
  assert.equal(result.threatConfirmed, true);
  assert.throws(() => adjudicateCheck(attack, false), /Triumph is a critical hit/);
  assert.equal(checkCandidates({ ...attack, effectiveTotal: 74 }).triumph, false);
  assert.equal(checkCandidates({ ...attack, checkKind: "save" }).triumph, false);
  assert.equal(checkCandidates({ ...attack, checkKind: "damage" }).triumph, false);
  const text = checkFlavor({ ...attack, ...result });
  assert.match(text, /one-action-die critical hit/);
  assert.match(text, /Morale/);
  const boosted = { ...attack, rawTotal: 74, effectiveTotal: 74 };
  const plan = actionDieBoostPlan({ actionDice: { value: 1, die: 4 } }, boosted);
  assert.equal(actionDieBoostResult(boosted, plan, [1]).potentialTriumph, true);
});

test("outcome confirmation aborts when another client changed the roll after the dialog decision", async () => {
  const actor = new SpycraftActor(),
    msg = message({ improvised: false });
  game.spycraft2 = {
    resourceLocks: {
      run: async (_actors, work) => {
        msg.flags.spycraft2.effectiveTotal++;
        return work();
      }
    }
  };
  try {
    const result = await actor.confirmCheckOutcome(msg, { succeeded: true });
    assert.equal(result, null);
    assert.notEqual(msg.flags.spycraft2.successConfirmed, true);
  } finally {
    delete game.spycraft2;
  }
});

test("sneak damage evidence freezes its target protection and dice plan instead of accepting older incomplete receipts", async () => {
  const { rollEvidence, rollEvidenceMatches } = await import("../module/rules/outcomes.mjs");
  const c = {
      ...check,
      checkKind: "damage",
      sneakAttackTarget: { actorUuid: "Actor.target", protectionSignature: "unarmored" },
      sneakAttack: { dice: 1, formula: "1d6" }
    },
    e = rollEvidence(c);
  assert.equal(rollEvidenceMatches(e, c), true);
  for (const patch of [
    { sneakAttackTarget: { ...c.sneakAttackTarget, actorUuid: "Actor.other" } },
    { sneakAttack: { dice: 2, formula: "2d6" } }
  ])
    assert.equal(rollEvidenceMatches(e, { ...c, ...patch }), false);
  assert.equal(rollEvidenceMatches(rollEvidence({ ...c, sneakAttackTarget: null, sneakAttack: null }), c), false);
});

test("legacy evidence cannot acquire a new Tracking, Forensics, Jinx, conditional-save or Old School marker after settlement", async () => {
  const { rollEvidence, rollEvidenceMatches } = await import("../module/rules/outcomes.mjs");
  for (const restraintEscape of [undefined, { condition: "pinned", kind: "opposedGrapple" }]) {
    const c = { ...check, restraintEscape },
      e = rollEvidence(c);
    assert.equal(rollEvidenceMatches(e, c), true);
    for (const patch of [
      { trackingFeat: { version: 1, basics: true } },
      { trackingMasteryTask: { version: 1, source: "Tracking Mastery" } },
      { criticalActivation: { jinx: { version: 1, payerUuid: "Actor.payer" } } },
      { terrainSaveSource: { version: 1, checkId: "fort" } },
      { oldSchool: { version: 1, targetName: "Added target" } }
    ])
      assert.equal(rollEvidenceMatches(e, { ...c, ...patch }), false, JSON.stringify(patch));
  }
});
test("every optional modern roll context refuses newly added, removed or changed evidence while old null-prefix variants remain compatible", async () => {
  const { rollEvidence, rollEvidenceMatches } = await import("../module/rules/outcomes.mjs");
  const plain = [
      "meleeSkillFeats",
      "conveyanceBullRush",
      "bullRushAttack",
      "bullRushDefense",
      "stillStandingSave",
      "tumblePath",
      "tripDefense",
      "fallDistance",
      "balanceSurface",
      "hideCircumstances",
      "detectionObserver",
      "hideMovement",
      "attributeDamage",
      "targetSkillEffect",
      "rankSynergyFeats",
      "stoneCold",
      "threaten",
      "bugConcealment",
      "documentation",
      "trackingFeat",
      "trackingMasteryTask",
      "terrainSaveSource",
      "oldSchool",
      "analysisTask",
      "forensicGenius",
      "closedCourseFeat",
      "wheelFeat",
      "requestBenefit",
      "rerollSource",
      "practiceFeat",
      "fundedTaking",
      "gearAllowance",
      "gearCheckContext",
      "improvisedSearch",
      "terrainFeat",
      "pursuitFeat",
      "professionalFeat",
      "contactFeat",
      "polyglot",
      "photographicMemory",
      "charmer",
      "cardSharkKnowledge",
      "cardSharkProfession",
      "appearanceModifiers",
      "hardCore",
      "finalAttackRound",
      "finesseDamage",
      "damageSave",
      "coverSave",
      "cqbRange",
      "finalAttack",
      "twoWeaponFinalAttack",
      "shakenContext",
      "weaponFocusWork",
      "sneakAttackTarget",
      "sneakAttack"
    ],
    patches = [
      ...plain.map(k => ({ [k]: { version: 1, id: k } })),
      { criticalActivation: { jinx: { version: 1 } } },
      { skillGear: { toolShedKit: { version: 1 } } },
      ...[
        "superiorAccuracy",
        "trainedOnly",
        "accurized",
        "characterTarget",
        "cleaveThreatIncrease",
        "finesseThreatIncrease",
        "meleeFire",
        "cqbRange",
        "disarm"
      ].map(k => ({ attackContext: { [k]: 1 } }))
    ];
  const c = { ...check },
    e = rollEvidence(c),
    base = JSON.parse(e);
  assert.equal(rollEvidenceMatches(JSON.stringify([null, ...base]), c), true);
  assert.equal(rollEvidenceMatches(JSON.stringify([null, null, ...base]), c), true);
  for (const patch of patches) {
    const current = { ...c, ...patch },
      snapshot = rollEvidence(current);
    assert.equal(rollEvidenceMatches(snapshot, current), true);
    assert.equal(rollEvidenceMatches(e, current), false, JSON.stringify(patch));
    assert.equal(rollEvidenceMatches(snapshot, c), false);
    const changed = structuredClone(current),
      k = Object.keys(patch)[0];
    changed[k] = { changed: true };
    assert.equal(rollEvidenceMatches(snapshot, changed), false);
  }
  assert.equal(
    rollEvidenceMatches(rollEvidence({ ...c, restraintEscape: { kind: "opposedGrapple" } }), {
      ...c,
      restraintEscape: { kind: "opposedGrapple" }
    }),
    true
  );
});

test("ranges print as die faces and attacks hit or miss where other checks succeed or fail", async () => {
  const { formatRange, outcomeLabel } = await import("../module/rules/outcome-labels.mjs");
  assert.equal(formatRange("threat", 19), "19–20");
  assert.equal(formatRange("threat", 20), "20");
  assert.equal(formatRange("error", 1), "1");
  assert.equal(formatRange("error", 3), "1–3");
  assert.equal(formatRange("error", 0), "—");
  assert.equal(formatRange("threat", undefined), "—");
  assert.equal(outcomeLabel({ checkKind: "attack" }, "criticalSuccess"), "Critical hit");
  assert.equal(outcomeLabel({ checkKind: "attack" }, "criticalFailure"), "Critical miss");
  assert.equal(outcomeLabel({ checkKind: "skill" }, "criticalSuccess"), "Critical success");
  assert.equal(outcomeLabel({ checkKind: "save" }, "criticalFailure"), "Critical failure");
  const attack = { ...check, checkKind: "attack", naturalDie: 20, threat: 19, error: 2 };
  assert.match(checkFlavor({ ...attack, criticalSuccess: true }), /Critical hit\./);
  assert.match(checkFlavor({ ...attack, criticalFailure: true }), /Critical miss\./);
  assert.match(checkFlavor(attack), /Error range 1–2; threat range 19–20\./);
  assert.doesNotMatch(checkFlavor({ ...attack, criticalSuccess: true }), /Critical success/);
});
