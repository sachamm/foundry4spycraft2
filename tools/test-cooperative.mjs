import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  HELPER_BASE_DC,
  applyCooperativeBonus,
  cooperativeNotes,
  cooperativeOutcome,
  helperDC,
  helperLimit,
  helperResult,
  validateCooperative
} from "../module/rules/cooperative.mjs";
import { cooperativeChecks } from "../module/rules/cooperative.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.foundry ??= { utils: { escapeHTML: String } };
const { cooperativeContent, cooperativeInput, helperChecks, openLeaderChecks, applyHelpers } =
  await import("../module/apps/cooperative.mjs");
const { rollPipeline } = await import("../module/rolls/index.mjs");

const check = (skill, id) => cfg.skills[skill].checks.find(c => c.id === id);

test("Table 2.9's helper limits are on the named checks", () => {
  const core = JSON.parse(readFileSync(new URL("../src/data/core.json", import.meta.url), "utf8"));
  const marked = core.skills.flatMap(s => s.checks.filter(c => c.cooperative).map(c => `${s.key}/${c.id}`));
  assert.equal(marked.length, 57);
  assert.deepEqual(helperLimit(check("analysis", "appraise")), {
    allowed: true,
    max: 5,
    special: false,
    smallItem: false
  });
  assert.deepEqual(helperLimit(check("athletics", "smash")), {
    allowed: true,
    max: 8,
    special: false,
    smallItem: true
  });
  assert.deepEqual(helperLimit(check("athletics", "sports")), {
    allowed: true,
    max: null,
    special: false,
    smallItem: false
  });
  assert.deepEqual(helperLimit(check("medicine", "first-aid")).max, 1);
  assert.equal(helperLimit(check("science", "chemistry")).special, true);
  assert.equal(helperLimit(check("acrobatics", "balance")).allowed, false);
  assert.equal(helperLimit(check("notice", "awareness")).allowed, false);
});

test("a limit set by Charisma follows the leader's bonus and allows nobody at +0 or less", () => {
  const persuasion = check("impress", "persuasion");
  assert.deepEqual(helperLimit(persuasion, { charismaMod: 3 }), {
    allowed: true,
    max: 3,
    special: false,
    smallItem: false
  });
  assert.equal(helperLimit(persuasion, { charismaMod: 0 }).allowed, false);
  assert.equal(helperLimit(persuasion, { charismaMod: -2 }).max, 0);
  assert.equal(helperLimit(check("mechanics", "repair"), { charismaMod: 2 }).smallItem, true);
});

test("helpers roll against 15, or the leader's result less 10 when the task has no set DC", () => {
  assert.equal(HELPER_BASE_DC, 15);
  assert.equal(helperDC({ setDC: true, leaderResult: 40 }), 15);
  assert.equal(helperDC({ leaderResult: 32 }), 22);
  assert.equal(helperDC({ leaderResult: 18 }), 15);
  assert.equal(helperDC({ leaderResult: 25 }), 15);
  assert.throws(() => helperDC({}), /leader's result/);
});

test("successes give synergy up to +5 that does not stack; criticals add +1 each without limit", () => {
  const ok = { success: true },
    crit = { success: true, critical: true },
    miss = { success: false };
  assert.deepEqual(cooperativeOutcome([ok, ok, miss]), {
    helpers: 3,
    ignored: 0,
    successes: 2,
    criticals: 0,
    synergy: 2,
    synergyGain: 2,
    unnamed: 0,
    bonus: 2,
    ruined: false
  });
  const many = cooperativeOutcome([ok, ok, ok, ok, ok, ok, crit, crit]);
  assert.equal(many.synergy, 5);
  assert.equal(many.unnamed, 2);
  assert.equal(many.bonus, 7);
  // The leader already had +3 synergy from a skill: four helpers add only one more point of synergy.
  assert.equal(cooperativeOutcome([ok, ok, ok, ok], { priorSynergy: 3 }).bonus, 1);
  assert.equal(cooperativeOutcome([ok, ok], { priorSynergy: 3 }).bonus, 0);
  assert.equal(cooperativeOutcome([crit], { priorSynergy: 5 }).bonus, 1);
});

test("helpers beyond the limit are not counted and one critical failure ruins the task", () => {
  const ok = { success: true };
  const limited = cooperativeOutcome([ok, ok, ok], { max: 1 });
  assert.equal(limited.helpers, 1);
  assert.equal(limited.ignored, 2);
  assert.equal(limited.bonus, 1);
  const ruined = cooperativeOutcome([ok, { success: false, criticalFailure: true }, ok]);
  assert.equal(ruined.ruined, true);
  assert.equal(ruined.bonus, 0);
});

test("a helper's posted check is read by its DC, or by the GC's ruling when there is one", () => {
  assert.deepEqual(helperResult({ effectiveTotal: 19, cooperative: { dc: 15 } }), {
    total: 19,
    dc: 15,
    success: true,
    critical: false,
    criticalFailure: false
  });
  assert.equal(helperResult({ effectiveTotal: 14, cooperative: { dc: 15 } }).success, false);
  assert.equal(helperResult({ effectiveTotal: 14, successConfirmed: true, cooperative: { dc: 15 } }).success, true);
  assert.equal(helperResult({ effectiveTotal: 30, criticalFailure: true, cooperative: { dc: 15 } }).success, false);
  assert.equal(helperResult({ effectiveTotal: 30, criticalSuccess: true, cooperative: { dc: 15 } }).critical, true);
});

test("the leader's result rises by the bonus, within the result cap, and a second tally replaces the first", () => {
  const leader = {
    rawTotal: 24,
    effectiveTotal: 24,
    naturalDie: 12,
    threat: 20,
    cap: 30,
    boostTotal: 0,
    cooperative: { role: "leader", setDC: true, max: 5, priorSynergy: 0 }
  };
  const first = applyCooperativeBonus(leader, [{ success: true }, { success: true }], { max: 5 });
  assert.equal(first.rawTotal, 26);
  assert.equal(first.effectiveTotal, 26);
  assert.equal(first.cooperative.result.bonus, 2);
  const second = applyCooperativeBonus(
    first,
    [{ success: true }, { success: true }, { success: true, critical: true }],
    {
      max: 5
    }
  );
  assert.equal(second.rawTotal, 28, "24 + 3 synergy + 1 critical, not stacked on the earlier +2");
  // The result cap still applies to the raised result.
  const capped = applyCooperativeBonus({ ...leader, rawTotal: 29, effectiveTotal: 29 }, [
    { success: true },
    { success: true }
  ]);
  assert.equal(capped.effectiveTotal, 30);
  assert.equal(capped.capped, true);
  // Action dice already spent stay on top.
  const boosted = applyCooperativeBonus({ ...leader, boostTotal: 4, effectiveTotal: 28 }, [{ success: true }]);
  assert.equal(boosted.effectiveTotal, 29);
  assert.throws(() => applyCooperativeBonus({ cooperative: { role: "helper" } }, []), /Only the leader/);
});

test("a declared role is checked against the named check and the method", () => {
  const appraise = check("analysis", "appraise"),
    balance = check("acrobatics", "balance"),
    persuasion = check("impress", "persuasion");
  assert.doesNotThrow(() => validateCooperative(null, { check: balance }));
  assert.doesNotThrow(() => validateCooperative({ role: "leader" }, { check: appraise }));
  assert.throws(() => validateCooperative({ role: "leader" }, { check: balance }), /cannot be made as a cooperative/);
  assert.throws(
    () => validateCooperative({ role: "leader" }, { check: appraise, checkMethod: "take10" }),
    /takes 10 or 20/
  );
  assert.throws(() => validateCooperative({ role: "leader" }, { check: persuasion, charismaMod: 0 }), /Charisma bonus/);
  assert.doesNotThrow(() => validateCooperative({ role: "helper", dc: 15 }, { check: persuasion, charismaMod: 0 }));
  assert.throws(() => validateCooperative({ role: "helper", dc: 12 }, { check: appraise }), /at least 15/);
  assert.throws(() => validateCooperative({ role: "helper", dc: NaN }, { check: appraise }), /at least 15/);
  assert.throws(() => validateCooperative({ role: "boss" }, { check: appraise }), /leader or helper/);
});

test("notes describe each part and the tally", () => {
  assert.deepEqual(cooperativeNotes({}), []);
  assert.match(
    cooperativeNotes({ cooperative: { role: "helper", leaderName: "Kim", dc: 17 } })[0],
    /Helping Kim.*DC 17/
  );
  const leader = { cooperative: { role: "leader", setDC: false, max: 5 } };
  assert.match(cooperativeNotes(leader)[0], /up to 5 helper\(s\).*less 10/);
  assert.match(
    cooperativeNotes({ cooperative: { role: "leader", setDC: true, max: null } })[0],
    /no stated limit.*DC 15/
  );
  const tallied = applyCooperativeBonus(
    { rawTotal: 20, effectiveTotal: 20, naturalDie: 10, ...leader },
    [{ success: true }, { success: false }],
    { max: 5 }
  );
  assert.match(cooperativeNotes(tallied)[1], /1 of 2 succeeded.*Result raised by 1/);
  const ruined = applyCooperativeBonus({ rawTotal: 20, effectiveTotal: 20, naturalDie: 10, ...leader }, [
    { success: false, criticalFailure: true }
  ]);
  assert.match(cooperativeNotes(ruined)[1], /ruined the task/);
});

/* ---- in play ---- */

const message = (id, alias, flags) => ({
  id,
  speaker: { alias },
  flags: { spycraft2: flags },
  async update(update) {
    this.flags.spycraft2 = update["flags.spycraft2"];
    this.flavor = update.flavor;
  }
});
const leaderMessage = () =>
  message("L1", "Kim", {
    actorUuid: "Actor.kim",
    checkKind: "skill",
    skillKey: "analysis",
    checkId: "appraise",
    focus: "Appraise",
    rawTotal: 27,
    effectiveTotal: 27,
    naturalDie: 11,
    threat: 20,
    cap: 40,
    cooperative: { role: "leader", setDC: false, max: 5, priorSynergy: 0 }
  });
const helperMessage = (id, actor, total, extra = {}) =>
  message(id, actor, {
    actorUuid: `Actor.${actor}`,
    checkKind: "skill",
    skillKey: "analysis",
    checkId: "appraise",
    effectiveTotal: total,
    cooperative: { role: "helper", leaderId: "L1", leaderName: "Kim", dc: 17 },
    ...extra
  });

test("dynamic Grapple cooperation records actual opening/joined participation and Size-based helper limits", () => {
  const actor = { uuid: "Actor.leader", system: {} };
  const named = cooperativeChecks("athletics", actor).find(c => c.id === "grapple");
  assert.equal(helperLimit(named).max, 7);
  const fields = {
    check: "grapple",
    cooperativeRole: "leader",
    cooperativeGrappleMax: "3",
    cooperativeGrappleMode: "opening",
    cooperativeGrappleConfirmed: true
  };
  const leader = cooperativeInput(fields, { actor, key: "athletics" }).cooperative;
  assert.equal(leader.max, 3);
  assert.equal(leader.setDC, false);
  for (const [field, value] of [
    ["cooperativeGrappleMax", "4"],
    ["cooperativeGrappleConfirmed", false],
    ["cooperativeSetDC", true],
    ["cooperativeGrappleMode", "independent"]
  ])
    assert.throws(
      () => cooperativeInput({ ...fields, [field]: value }, { actor, key: "athletics" }),
      /Confirm a simultaneous/
    );
  for (const max of [1, 3, 7])
    for (const grappleMode of ["opening", "joined"])
      assert.doesNotThrow(() =>
        validateCooperative({ role: "leader", max, grappleMode, grappleConfirmed: true }, { check: named })
      );
  const source = message("GL", "Leader", {
    actorUuid: actor.uuid,
    checkKind: "skill",
    skillKey: "athletics",
    checkId: "grapple",
    effectiveTotal: 30,
    cooperative: { ...leader, grappleMode: "joined" }
  });
  globalThis.game = { messages: Object.assign([source], { get: id => (id === "GL" ? source : null) }) };
  const helper = cooperativeInput(
    { check: "grapple", cooperativeRole: "helper", cooperativeLeader: "GL", cooperativeGrappleConfirmed: true },
    { actor: { uuid: "Actor.helper", system: {} }, key: "athletics" }
  ).cooperative;
  assert.equal(helper.max, 3);
  assert.equal(helper.grappleMode, "joined");
  assert.equal(helper.dc, 20);
  assert.throws(
    () =>
      cooperativeInput(
        { check: "grapple", cooperativeRole: "helper", cooperativeLeader: "GL", cooperativeGrappleConfirmed: true },
        { actor, key: "athletics" }
      ),
    /own helper/
  );
  assert.match(cooperativeContent("athletics", actor), /cooperativeGrappleMax/);
});

test("the actual grapple tally counts each helper once and refuses an over-cap or mismatched group", async () => {
  const actor = { uuid: "Actor.leader", system: {} },
    coop = { role: "leader", setDC: false, max: 1, grappleConfirmed: true, grappleMode: "joined", priorSynergy: 0 };
  const source = message("GL", "Leader", {
    actorUuid: actor.uuid,
    checkKind: "skill",
    skillKey: "athletics",
    checkId: "grapple",
    rawTotal: 20,
    effectiveTotal: 20,
    naturalDie: 10,
    cap: 40,
    threat: 20,
    cooperative: coop
  });
  const helper = message("GH", "Helper", {
    actorUuid: "Actor.helper",
    checkKind: "skill",
    skillKey: "athletics",
    checkId: "grapple",
    effectiveTotal: 20,
    cooperative: { role: "helper", leaderId: "GL", dc: 15, max: 1, grappleMode: "joined", grappleConfirmed: true }
  });
  const warnings = [],
    priorUI = globalThis.ui;
  globalThis.ui = { notifications: { warn: text => warnings.push(text) } };
  globalThis.fromUuidSync = () => actor;
  game.messages = [source, helper];
  try {
    await applyHelpers(source);
    assert.equal(source.flags.spycraft2.effectiveTotal, 21);
    await applyHelpers(source);
    assert.equal(source.flags.spycraft2.effectiveTotal, 21, "re-tally replaces the previous helper bonus");
    game.messages.push(message("GH2", "Extra", { ...helper.flags.spycraft2, actorUuid: "Actor.extra" }));
    await applyHelpers(source);
    assert.equal(source.flags.spycraft2.effectiveTotal, 21);
    assert.match(warnings.at(-1), /Size limit/);
    game.messages.pop();
    helper.flags.spycraft2.checkId = "climb";
    await applyHelpers(source);
    assert.equal(source.flags.spycraft2.effectiveTotal, 21);
    assert.match(warnings.at(-1), /Size limit/);
    source.flags.spycraft2.resolved = true;
    helper.flags.spycraft2.checkId = "grapple";
    await applyHelpers(source);
    assert.equal(source.flags.spycraft2.effectiveTotal, 21);
    assert.match(warnings.at(-1), /finished/);
    assert.deepEqual(openLeaderChecks("athletics"), []);
    game.messages.get = id => (id === "GL" ? source : null);
    assert.throws(
      () =>
        cooperativeInput(
          { check: "grapple", cooperativeRole: "helper", cooperativeLeader: "GL", cooperativeGrappleConfirmed: true },
          { actor: { uuid: "Actor.new", system: {} }, key: "athletics" }
        ),
      /no longer available/
    );
  } finally {
    globalThis.ui = priorUI;
  }
});

test("the skill dialog offers the section only for skills with a cooperative check, and lists open leaders", () => {
  const leader = leaderMessage();
  globalThis.game = { messages: Object.assign([leader], { get: id => (id === "L1" ? leader : null) }) };
  assert.equal(cooperativeContent("acrobatics", { uuid: "Actor.lee" }), "");
  const html = cooperativeContent("analysis", { uuid: "Actor.lee" });
  assert.match(html, /name="cooperativeRole"/);
  assert.match(html, /Kim: Appraise — DC 17/);
  assert.doesNotMatch(cooperativeContent("analysis", { uuid: "Actor.kim" }), /Kim: Appraise/, "not one's own check");
  assert.deepEqual(
    openLeaderChecks("analysis").map(m => m.id),
    ["L1"]
  );
  assert.deepEqual(openLeaderChecks("search"), []);
});

test("the section's fields become the recorded role, with the DC taken from the leader's check", () => {
  const leader = leaderMessage();
  globalThis.game = { messages: Object.assign([leader], { get: id => (id === "L1" ? leader : null) }) };
  const actor = { uuid: "Actor.lee", system: { abilities: { cha: { mod: 2 } } } };
  assert.equal(cooperativeInput({ check: "appraise" }, { actor, key: "analysis" }), null);
  assert.deepEqual(cooperativeInput({ check: "appraise", cooperativeRole: "leader" }, { actor, key: "analysis" }), {
    cooperative: { role: "leader", setDC: false, max: 5, smallItem: false, special: false }
  });
  assert.equal(
    cooperativeInput(
      { check: "decipher", cooperativeRole: "leader", cooperativeSetDC: true },
      { actor, key: "analysis" }
    ).cooperative.max,
    2
  );
  assert.deepEqual(
    cooperativeInput(
      { check: "appraise", cooperativeRole: "helper", cooperativeLeader: "L1" },
      { actor, key: "analysis" }
    ),
    { cooperative: { role: "helper", leaderId: "L1", leaderName: "Kim", dc: 17 } }
  );
  assert.throws(
    () =>
      cooperativeInput(
        { check: "forensics", cooperativeRole: "helper", cooperativeLeader: "L1" },
        { actor, key: "analysis" }
      ),
    /same named check/
  );
  assert.equal(
    cooperativeInput({ check: "appraise", cooperativeRole: "helper", cooperativeDC: "20" }, { actor, key: "analysis" })
      .cooperative.dc,
    20
  );
  // A scripted roll that already carries its role is left alone.
  assert.equal(cooperativeInput({ cooperative: null, cooperativeRole: "leader" }, { actor, key: "analysis" }), null);
});

test("the leader's tally reads each helper's latest standing check and updates the posted result", async () => {
  const leader = leaderMessage();
  const list = [
    leader,
    helperMessage("H1", "lee", 12),
    helperMessage("H2", "lee", 21),
    helperMessage("H3", "ana", 30, { criticalSuccess: true }),
    helperMessage("H4", "max", 40, { superseded: true }),
    message("X", "other", { checkKind: "skill", cooperative: { role: "helper", leaderId: "L9", dc: 15 } })
  ];
  globalThis.game = { messages: Object.assign(list, { get: id => list.find(m => m.id === id) }) };
  const warnings = [];
  globalThis.ui = { notifications: { warn: text => warnings.push(text) } };
  assert.deepEqual(
    helperChecks(leader).map(m => m.id),
    ["H2", "H3"]
  );
  const next = await applyHelpers(leader);
  assert.equal(next.effectiveTotal, 30, "27 + 2 synergy + 1 critical");
  assert.equal(leader.flags.spycraft2.cooperative.result.successes, 2);
  assert.match(leader.flavor, /2 of 2 succeeded/);
  const lonely = leaderMessage();
  lonely.id = "L2";
  assert.equal(await applyHelpers(lonely), false);
  assert.equal(warnings.at(-1), "No helper has posted a check for this leader yet.");
});

test("the pipeline records the role and offers the tally on a leader's check", () => {
  globalThis.game = { user: { id: "gc", isGM: true }, messages: [] };
  for (const id of ["cooperativeCheck", "cooperativeContent:skill", "cooperativeControl"])
    assert.ok(rollPipeline.has(id), id);
  assert.deepEqual(
    rollPipeline.flags({ checkKind: "skill", options: { cooperative: { role: "leader" } } }).cooperative,
    {
      role: "leader"
    }
  );
  const controls = rollPipeline
    .chatControls({
      checkKind: "skill",
      message: leaderMessage(),
      check: leaderMessage().flags.spycraft2,
      actor: { system: {} },
      user: { id: "gc", isGM: true }
    })
    .filter(c => c.id === "cooperativeControl");
  assert.equal(controls.length, 1);
  assert.equal(
    rollPipeline
      .chatControls({
        checkKind: "skill",
        message: {},
        check: { cooperative: { role: "helper" } },
        actor: { system: {} },
        user: { id: "gc", isGM: true }
      })
      .filter(c => c.id === "cooperativeControl").length,
    0
  );
});
