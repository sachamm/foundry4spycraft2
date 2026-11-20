import test from "node:test";
import assert from "node:assert/strict";

/* Minimal DOM and Foundry stand-ins: enough to lay the buttons out and click them. */
class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.listeners = {};
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }
  setAttribute(name, value) {
    (this.attributes ??= {})[name] = String(value);
  }
  querySelector(selector) {
    return selector === ".message-content" ? (this.content ??= new Element("div")) : null;
  }
}
globalThis.document = { createElement: tag => new Element(tag) };
globalThis.game = { user: { isGM: false } };
let actor;
globalThis.fromUuidSync = () => actor;

await import("../module/rolls/index.mjs");
const { renderCheckControls } = await import("../module/rolls/chat-controls.mjs");
const { rollPipeline } = await import("../module/rules/roll-pipeline.mjs");

const makeActor = (overrides = {}) => ({
  isOwner: true,
  flags: {},
  system: { classLevels: {}, activeFeatNames: [], resourceUses: {} },
  limitedUseStatus: [],
  calls: [],
  ...Object.fromEntries(
    [
      "boostCheck",
      "boostWithGenerous",
      "finishCheck",
      "rerollCheck",
      "confirmCheckOutcome",
      "activateCritical",
      "useCunningPlan",
      "useManualAdjustment",
      "applyRestraintEscape",
      "confirmRestraintEscapeMove",
      "reviewRestraintRelease",
      "resolveUnnerving",
      "useStrut"
    ].map(name => [
      name,
      function (...args) {
        this.calls.push([name, ...args]);
      }
    ])
  ),
  ...overrides
});
const message = (check, overrides = {}) => ({
  id: "msg",
  isAuthor: true,
  blind: false,
  flags: { spycraft2: { actorUuid: "Actor.a", rawTotal: 14, checkKind: "skill", checkMethod: "roll", ...check } },
  ...overrides
});
const labels = (msg, user = game.user) =>
  rollPipeline
    .chatControls({ message: msg, check: msg.flags.spycraft2, actor, user, checkKind: msg.flags.spycraft2.checkKind })
    .map(c => `${c.placement}:${c.label}`);

test("an open check offers boosting and resolution, in one row under the card", () => {
  actor = makeActor();
  assert.deepEqual(labels(message({})), [
    "card:Boost before outcome",
    "card:Generous teammate die",
    "card:Compare with an opposing check",
    "card:Outcome resolved"
  ]);
  assert.deepEqual(labels(message({ generousBoost: { id: "g" } })), [
    "card:Boost before outcome",
    "card:Compare with an opposing check",
    "card:Outcome resolved"
  ]);
  assert.deepEqual(labels(message({ actionDiceAllowed: false })), [
    "card:Compare with an opposing check",
    "card:Outcome resolved"
  ]);
  // Taking 10 or 20 is not allowed on an opposed check, and a settled comparison is not offered again.
  assert.deepEqual(labels(message({ actionDiceAllowed: false, checkMethod: "take10" })), ["card:Outcome resolved"]);
  assert.deepEqual(labels(message({ actionDiceAllowed: false, opposed: { outcome: "won", total: 12 } })), [
    "card:Outcome resolved"
  ]);
});

test("confirmation, critical activation and a required bonus die appear in their fixed positions", () => {
  actor = makeActor();
  const got = labels(message({ naturalDie: 20, threat: 20, threatConfirmed: true, requiredBonusPoolId: "pool" }));
  assert.deepEqual(got, [
    "card:Spend required class bonus die",
    "card:Activate critical",
    "card:Boost before outcome",
    "card:Generous teammate die",
    "card:Compare with an opposing check",
    "card:Confirm result",
    "card:Outcome resolved"
  ]);
  // Once the critical is activated, or the required die is spent, those buttons go.
  const after = labels(
    message({
      naturalDie: 20,
      threat: 20,
      threatConfirmed: true,
      criticalSuccess: true,
      requiredBonusPoolId: "pool",
      requiredBonusSpent: true
    })
  );
  assert.equal(after.includes("card:Activate critical"), false);
  assert.equal(after.includes("card:Spend required class bonus die"), false);
});

test("a reroll is offered only for a rolled check with an eligible ability left", () => {
  actor = makeActor({ limitedUseStatus: [{ id: "x", remaining: 0 }] });
  assert.equal(labels(message({})).includes("card:Reroll with ability"), false);
  assert.equal(labels(message({ checkMethod: "take10" })).includes("card:Reroll with ability"), false);
});

test("someone who neither rolled the check nor runs the game gets none of the outcome buttons", () => {
  actor = makeActor();
  assert.deepEqual(labels(message({}, { isAuthor: false })), []);
  assert.equal(labels(message({}, { isAuthor: false }), { isGM: true }).length, 4);
  assert.deepEqual(labels(message({ rawTotal: undefined })), []);
});

test("a resolved check shows only what is left to complete, inside the message body", () => {
  actor = makeActor({ system: { classLevels: {}, activeFeatNames: [], missionReserves: { attempts: { a1: {} } } } });
  assert.deepEqual(labels(message({ resolved: true })), []);
  const acquisition = { resolved: true, gearAttempt: { id: "a1", settlement: { id: "s1" } } };
  assert.deepEqual(labels(message(acquisition)), ["content:Complete acquisition record"]);
  actor.system.missionReserves.attempts.a1.settlementId = "s1";
  assert.deepEqual(labels(message(acquisition)), []);
  assert.deepEqual(labels(message({ ...acquisition, superseded: true })), []);
});

test("a resolved grapple escape walks through benefit, movement and GC review", () => {
  const escape = { resolved: true, restraintEscape: { sourceSnapshot: {} }, successConfirmed: true };
  actor = makeActor();
  assert.deepEqual(labels(message(escape)), ["content:Apply grapple escape benefit"]);
  assert.deepEqual(labels(message({ ...escape, successConfirmed: false })), []);
  actor = makeActor({ flags: { spycraft2: { restraintReleases: { msg: { movement: { state: "required" } } } } } });
  assert.deepEqual(labels(message(escape)), ["content:Confirm actual escape movement"]);
  actor = makeActor({
    system: { classLevels: {}, activeFeatNames: [], restraintReleaseReview: { needsReview: true, id: "msg" } }
  });
  assert.deepEqual(labels(message(escape)), []);
  assert.deepEqual(labels(message(escape), { isGM: true }), ["content:GC review grapple release"]);
  // An escape check never falls through to the acquisition button.
  assert.deepEqual(
    labels(message({ ...escape, successConfirmed: false, gearAttempt: { id: "a", settlement: { id: "s" } } })),
    []
  );
});

test("the chat hook lays buttons out by placement and runs them once per click", async () => {
  actor = makeActor();
  const html = new Element("li"),
    msg = message({});
  renderCheckControls(msg, html);
  assert.equal(html.children.length, 1);
  const row = html.children[0];
  assert.equal(row.className, "spycraft2 roll-controls");
  assert.deepEqual(
    row.children.map(b => b.textContent),
    ["Boost before outcome", "Generous teammate die", "Compare with an opposing check", "Outcome resolved"]
  );
  assert.deepEqual(
    row.children.map(b => b.dataset.rollControl),
    ["boostControl", "generousControl", "opposedCheckControl", "finishControl"]
  );
  const finish = row.children[3];
  assert.equal(finish.attributes["aria-label"], "Outcome resolved");
  await finish.listeners.click();
  assert.deepEqual(actor.calls, [["finishCheck", msg]]);
  assert.equal(finish.disabled, false);

  // Body placement goes inside the message content, not under the card.
  actor = makeActor({ system: { classLevels: {}, activeFeatNames: [], missionReserves: { attempts: {} } } });
  const resolved = new Element("li");
  renderCheckControls(message({ resolved: true, gearAttempt: { id: "a1", settlement: { id: "s1" } } }), resolved);
  assert.equal(resolved.children.length, 0);
  assert.deepEqual(
    resolved.content.children[0].children.map(b => b.textContent),
    ["Complete acquisition record"]
  );

  // Hidden results and other people's characters get nothing.
  const blind = new Element("li");
  renderCheckControls(message({}, { blind: true }), blind);
  assert.equal(blind.children.length, 0);
  actor = makeActor({ isOwner: false });
  const foreign = new Element("li");
  renderCheckControls(message({}), foreign);
  assert.equal(foreign.children.length, 0);
});

test("button text is translated by contributor id and falls back to the contributor's own label", async () => {
  const { localizedLabel } = await import("../module/rolls/chat-controls.mjs");
  const { readFile } = await import("node:fs/promises");
  const strings = JSON.parse(await readFile(new URL("../lang/en.json", import.meta.url), "utf8")).SPYCRAFT.RollControl;
  const i18n = { has: key => key === "SPYCRAFT.RollControl.finishControl", localize: () => "Résolu" };
  assert.equal(localizedLabel({ id: "finishControl", label: "Outcome resolved" }, i18n), "Résolu");
  assert.equal(
    localizedLabel({ id: "restraintEscapeControl", label: "Apply grapple escape benefit" }, i18n),
    "Apply grapple escape benefit"
  );
  assert.equal(localizedLabel({ id: "finishControl", label: "Outcome resolved" }, undefined), "Outcome resolved");
  // Every fixed-label button has an English entry that matches what the contributor supplies.
  actor = makeActor();
  const shown = Object.fromEntries(
    rollPipeline
      .chatControls({
        message: message({ naturalDie: 20, threat: 20, threatConfirmed: true, requiredBonusPoolId: "p" }),
        check: message({ naturalDie: 20, threat: 20, threatConfirmed: true, requiredBonusPoolId: "p" }).flags.spycraft2,
        actor,
        user: game.user,
        checkKind: "skill"
      })
      .map(c => [c.id, c.label])
  );
  for (const [id, label] of Object.entries(shown)) assert.equal(strings[id], label, id);
});

test("a check posted in another language has its notes written again for the viewer", async () => {
  const { viewerFlavor, checkFlavor } = await import("../module/rules/outcomes.mjs");
  const check = {
    lang: "fr",
    baseFlavor: "Escalade",
    checkMethod: "roll",
    error: 1,
    threat: 20,
    successConfirmed: true
  };
  assert.equal(viewerFlavor(check, "fr"), null, "the same language: the posted text serves");
  assert.equal(viewerFlavor({ ...check, lang: undefined }, "en"), null, "older cards carry no language");
  assert.equal(viewerFlavor(check, "en"), checkFlavor(check));
  assert.match(viewerFlavor(check, "en"), /^Escalade<br>.*Succeeded\./);
});
