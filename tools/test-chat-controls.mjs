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
// A Pointman teammate this user also owns, so Generous has a donor unless a test takes it away.
const pointman = { type: "agent", uuid: "Actor.p", isOwner: true, system: { coreClassIds: ["pointman"] } };
globalThis.game = { user: { isGM: false }, actors: [pointman] };
let actor;
globalThis.fromUuidSync = () => actor;

await import("../module/rolls/index.mjs");
const { renderCheckControls } = await import("../module/rolls/chat-controls.mjs");
const { rollPipeline } = await import("../module/rules/roll-pipeline.mjs");

const makeActor = (overrides = {}) => ({
  type: "agent",
  uuid: "Actor.a",
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

test("an automatic origin Resource with no check total offers only delivery and can finish an interrupted receipt", async () => {
  const { localizedLabel } = await import("../module/rolls/chat-controls.mjs");
  actor = makeActor();
  const attempt = { id: "a", epoch: "mission", requestAbility: "requestPrivileged", freePick: true, automatic: true };
  actor.system.missionReserves = { epoch: "mission", attempts: { a: attempt } };
  const msg = message({
    rawTotal: undefined,
    checkKind: "request",
    actionDiceAllowed: false,
    requestBenefit: { id: "requestPrivileged", source: { freePick: true, automatic: true } },
    gearAttempt: { id: "a", epoch: "mission" }
  });
  assert.deepEqual(labels(msg), ["card:Resolve delivery"]);
  const controls = rollPipeline.chatControls({
    message: msg,
    check: msg.flags.spycraft2,
    actor,
    user: game.user,
    checkKind: "request"
  });
  assert.equal(controls[0].emphasis, "primary");
  assert.equal(
    localizedLabel(controls[0], {
      has: key => key === "SPYCRAFT.RollControl.ResolveDelivery",
      localize: () => "Translated delivery"
    }),
    "Translated delivery"
  );
  await controls[0].run();
  assert.equal(actor.calls[0][0], "finishCheck");
  msg.flags.spycraft2.resolved = true;
  msg.flags.spycraft2.gearAttempt.settlement = { id: "settlement", version: 2, stage: "rolling" };
  assert.deepEqual(labels(msg), ["content:Complete acquisition record"]);
  attempt.settlementId = "settlement";
  assert.deepEqual(labels(msg), []);
  delete attempt.settlementId;
  actor.isOwner = false;
  assert.deepEqual(labels(msg), []);
  actor.isOwner = true;
  msg.flags.spycraft2.requestBenefit = { id: "requestPrivileged" };
  assert.deepEqual(labels(msg), []);
});

test("an open check offers boosting and resolution, in one row under the card", () => {
  actor = makeActor();
  assert.deepEqual(labels(message({})), [
    "card:Spend action dice…",
    "card:Generous teammate die",
    "card:Compare with an opposing check",
    "card:Finish"
  ]);
  assert.deepEqual(labels(message({ generousBoost: { id: "g" } })), [
    "card:Spend action dice…",
    "card:Compare with an opposing check",
    "card:Finish"
  ]);
  assert.deepEqual(labels(message({ actionDiceAllowed: false })), [
    "card:Compare with an opposing check",
    "card:Finish"
  ]);
  // Taking 10 or 20 is not allowed on an opposed check, and a settled comparison is not offered again.
  assert.deepEqual(labels(message({ actionDiceAllowed: false, checkMethod: "take10" })), ["card:Finish"]);
  assert.deepEqual(labels(message({ actionDiceAllowed: false, opposed: { outcome: "won", total: 12 } })), [
    "card:Finish"
  ]);
});

test("a closed acquisition retains its completion control while delivery or the actor receipt is incomplete", () => {
  actor = makeActor({ system: { missionReserves: { epoch: "mission", attempts: { a: {} } } } });
  const receipt = { id: "receipt", epoch: "mission", attemptId: "a", stage: "rolling" };
  const msg = message({ resolved: true, gearAttempt: { id: "a", settlement: receipt } });
  assert.deepEqual(labels(msg), ["content:Complete acquisition record"]);
  receipt.stage = "complete";
  assert.deepEqual(labels(msg), ["content:Complete acquisition record"]);
  actor.system.missionReserves.attempts.a.settlementId = "receipt";
  assert.deepEqual(labels(msg), []);
});

test("confirmation, critical activation and a required bonus die appear in their fixed positions", () => {
  actor = makeActor();
  const got = labels(message({ naturalDie: 20, threat: 20, threatConfirmed: true, requiredBonusPoolId: "pool" }));
  assert.deepEqual(got, [
    "card:Spend required class bonus die",
    "card:Activate critical success…",
    "card:Spend action dice…",
    "card:Generous teammate die",
    "card:Compare with an opposing check",
    "card:Confirm result",
    "card:Finish"
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
  assert.equal(
    after.some(label => label.startsWith("card:Activate critical")),
    false
  );
  // An agent's error is the GC's to activate and pay for: the player who rolled is not offered it.
  const error = message({ naturalDie: 1, errorConfirmed: true });
  assert.equal(
    labels(error).some(label => label.startsWith("card:Activate critical")),
    false
  );
  assert.equal(labels(error, { isGM: true }).includes("card:Activate critical failure… (an opponent pays)"), true);
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

test("a button with a hint shows its short label and carries the full wording as its name and tooltip", () => {
  actor = makeActor();
  const response = rollPipeline.chatControls;
  rollPipeline.chatControls = () => [
    { id: "x", label: "Short", hint: "The full wording of this step", run() {}, placement: "card" },
    { id: "y", label: "Plain words", run() {}, placement: "card" }
  ];
  try {
    const html = new Element("li");
    renderCheckControls(message({}), html);
    const [short, plain] = html.children[0].children;
    assert.equal(short.textContent, "Short");
    // The name holds the words on the face; a button with no fuller wording gets no tooltip repeating it.
    assert.equal(short.attributes["aria-label"], "Short: The full wording of this step");
    assert.equal(short.attributes["data-tooltip"], "The full wording of this step");
    assert.equal(plain.attributes?.["data-tooltip"], undefined);
    assert.equal(plain.attributes?.["aria-label"], undefined);
  } finally {
    rollPipeline.chatControls = response;
  }
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
    ["Spend action dice…", "Generous teammate die", "Compare with an opposing check", "Finish"]
  );
  assert.deepEqual(
    row.children.map(b => b.dataset.rollControl),
    ["boostControl", "generousControl", "opposedCheckControl", "finishControl"]
  );
  const finish = row.children[3];
  assert.equal(finish.attributes?.["aria-label"], undefined);
  assert.equal(finish.textContent, "Finish");
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

test("one-click boost, Generous and NPC cards: only buttons that can work are shown", () => {
  // One ordinary die with nothing to choose: spent in one click, with the die named.
  actor = makeActor({ system: { classLevels: {}, activeFeatNames: [], actionDice: { value: 2, die: 6 } } });
  const quick = labels(message({}));
  assert.equal(quick[0], "card:Spend 1 action die (+1d6)");
  rollPipeline
    .chatControls({ message: message({}), check: message({}).flags.spycraft2, actor, user: game.user })
    .find(c => c.id === "quickBoostControl")
    .run();
  assert.deepEqual(actor.calls[0].slice(2), [{ count: 1, bonusPoolId: "", openingRound: false, calculating: false }]);
  // A Counterterrorist's die doubles in the opening round: the button names both dice it will roll.
  const savedCombat = game.combat;
  game.combat = { started: true, round: 1 };
  actor = makeActor({
    system: {
      classLevels: {},
      activeFeatNames: [],
      coreClassIds: ["counterterrorist"],
      actionDice: { value: 2, die: 4 }
    }
  });
  assert.equal(labels(message({ checkKind: "save" }))[0], "card:Spend 1 action die (+2d4)");
  game.combat = savedCombat;
  // No action dice left: only the dialog, which explains why.
  actor = makeActor();
  assert.equal(
    labels(message({})).some(l => l.startsWith("card:Spend 1 action die")),
    false
  );
  // No Pointman in the party: no Generous.
  game.actors = [];
  assert.equal(labels(message({})).includes("card:Generous teammate die"), false);
  game.actors = [pointman];
  // An NPC has no action dice of its own.
  actor = makeActor({ type: "npc" });
  assert.deepEqual(labels(message({})), ["card:Compare with an opposing check", "card:Finish"]);
});

test("the GC spends the session pool from an NPC's card; the NPC's own threat is not offered to agents' wallets", () => {
  actor = makeActor({ type: "npc", system: { classLevels: {}, activeFeatNames: [], npcType: "standard" } });
  const gc = { isGM: true };
  assert.deepEqual(labels(message({ checkKind: "attack" }), gc).slice(0, 1), ["card:GC boost (+1d4)"]);
  const threat = labels(message({ checkKind: "attack", threatConfirmed: true }), gc);
  assert.deepEqual(threat.slice(0, 2), ["card:Activate threat (GC dice)", "card:GC boost (+1d4)"]);
  // A standard NPC without treacherous may not activate it: the button is shown disabled with the reason (p.452).
  const threatCard = message({ checkKind: "attack", threatConfirmed: true });
  const activate = rollPipeline
    .chatControls({ message: threatCard, check: threatCard.flags.spycraft2, actor, user: gc, checkKind: "attack" })
    .find(c => c.label === "Activate threat (GC dice)");
  assert.match(activate.disabled, /treacherous/);
  assert.equal(
    threat.some(label => label.startsWith("card:Activate critical")),
    false
  );
  // An NPC's error is still activated by its opponents through the usual dialog.
  assert.equal(
    labels(message({ errorConfirmed: true }), gc).includes("card:Activate critical failure… (an opponent pays)"),
    true
  );
  // Players never see the GC's buttons.
  assert.equal(labels(message({ checkKind: "attack" })).includes("card:GC boost (+1d4)"), false);
  // An NPC skill roll is posted as a plain check naming the skill.
  assert.equal(labels(message({ checkKind: "check", npcSkill: "notice" }), gc).includes("card:GC boost (+1d4)"), true);
  // An activated critical failure cannot be boosted.
  assert.equal(
    labels(message({ checkKind: "attack", errorConfirmed: true, criticalFailure: true }), gc).includes(
      "card:GC boost (+1d4)"
    ),
    false
  );
});

test("an attack waiting to be resolved does not offer to close its outcome", () => {
  actor = makeActor();
  const attack = { checkKind: "attack" };
  assert.equal(labels(message(attack)).includes("card:Finish"), false);
  assert.equal(
    labels(message({ ...attack, attackResolution: { hit: true }, successConfirmed: true })).includes("card:Finish"),
    true
  );
  // Strafe has no single Defense to resolve against.
  assert.equal(
    labels(message({ ...attack, attackContext: { fireAction: { action: "strafe" } } })).includes("card:Finish"),
    true
  );
});

test("a row puts the primary step first and quiet steps last, styled to match", async () => {
  const { byEmphasis } = await import("../module/rolls/chat-controls.mjs");
  const order = byEmphasis([
    { label: "a" },
    { label: "close", emphasis: "quiet" },
    { label: "b" },
    { label: "next", emphasis: "primary" }
  ]).map(c => c.label);
  assert.deepEqual(order, ["next", "a", "b", "close"]);
  actor = makeActor();
  const html = new Element("li");
  renderCheckControls(message({}), html);
  const finish = html.children[0].children.at(-1);
  assert.equal(finish.className, "sc2-quiet-action");
});

test("button text is translated by contributor id and falls back to the contributor's own label", async () => {
  const { localizedLabel } = await import("../module/rolls/chat-controls.mjs");
  const { readFile } = await import("node:fs/promises");
  const strings = JSON.parse(await readFile(new URL("../lang/en.json", import.meta.url), "utf8")).SPYCRAFT.RollControl;
  const i18n = { has: key => key === "SPYCRAFT.RollControl.finishControl", localize: () => "Résolu" };
  assert.equal(localizedLabel({ id: "finishControl", label: "Finish" }, i18n), "Résolu");
  assert.equal(
    localizedLabel({ id: "restraintEscapeControl", label: "Apply grapple escape benefit" }, i18n),
    "Apply grapple escape benefit"
  );
  assert.equal(localizedLabel({ id: "finishControl", label: "Finish" }, undefined), "Finish");
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
  // A button whose text depends on the check (which critical, which dice) is written with loc in the source instead.
  const varies = new Set(["criticalControl", "boostControl"]);
  for (const [id, label] of Object.entries(shown)) if (!varies.has(id)) assert.equal(strings[id], label, id);
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

test("a damage card stops offering boosts once its damage is applied", () => {
  actor = makeActor();
  const before = labels(message({ checkKind: "damage" }));
  assert.ok(before.some(label => label.includes("Spend action dice…")));
  const after = labels(message({ checkKind: "damage", damageApplied: [{ targetUuid: "Actor.t" }] }));
  assert.equal(
    after.some(label => /Boost|Spend 1 action die|Generous/.test(label)),
    false
  );
});

test("a card shortcut presses the newest enabled matching button, skipping cards without one", async () => {
  const { newestCardButton } = await import("../module/apps/keybindings.mjs");
  const card = buttons => ({ querySelectorAll: () => buttons });
  const old = { disabled: false, name: "old" },
    spent = { disabled: true, name: "spent" };
  const root = { querySelectorAll: () => [card([old]), card([spent]), card([])] };
  assert.equal(newestCardButton(root, "button"), old);
  assert.equal(newestCardButton({ querySelectorAll: () => [] }, "button"), null);
});

test("the console's next step presses only the acting combatant's newest card and says which", async () => {
  const { pressActorCard } = await import("../module/apps/keybindings.mjs");
  const pressed = [];
  const button = name => ({ disabled: false, textContent: name, click: () => pressed.push(name) });
  const card = (id, buttons) => ({ dataset: { messageId: id }, querySelectorAll: () => buttons });
  const cards = [card("g1", [button("Roll damage")]), card("p1", [button("Apply")]), card("g2", [])];
  const speakers = { g1: { actor: "guard", token: "t1" }, p1: { actor: "agent", token: "t9" }, g2: { token: "t1" } };
  const previous = { document: globalThis.document, game: globalThis.game, ui: globalThis.ui };
  const notes = [];
  globalThis.document = { querySelector: () => ({ querySelectorAll: () => cards }) };
  globalThis.game = { messages: { get: id => ({ speaker: speakers[id] }) } };
  globalThis.ui = { notifications: { info: message => notes.push(message) }, chat: {} };
  try {
    const guard = { name: "Guard (Rook)", tokenId: "t1", actor: { id: "guard" } };
    // Its newest card has no step left, so an older card's step is not pressed a second time.
    assert.equal(pressActorCard(guard, "button"), false);
    assert.deepEqual(pressed, []);
    notes.length = 0;
    cards.pop();
    assert.equal(pressActorCard(guard, "button"), true);
    assert.deepEqual(pressed, ["Roll damage"], "the agent's newer card is passed over");
    assert.deepEqual(notes, ["Roll damage: Guard (Rook)."]);
    assert.equal(pressActorCard({ name: "Driver", tokenId: "t5", actor: { id: "driver" } }, "button"), false);
    assert.equal(notes.at(-1), "No card of Driver is waiting for a next step.");
  } finally {
    Object.assign(globalThis, previous);
  }
});

test("the GC boost shortcut takes the card under the pointer, else the newest card this user posted", async () => {
  const { boostCardButton } = await import("../module/apps/keybindings.mjs");
  const card = (id, buttons) => ({ dataset: { messageId: id }, querySelectorAll: () => buttons });
  const mineOld = { disabled: false, name: "mine-old" },
    theirs = { disabled: false, name: "theirs" },
    spent = { disabled: true, name: "spent" };
  const cards = [card("m1", [mineOld]), card("m2", [spent]), card("t1", [theirs])];
  const root = hovered => ({ querySelector: () => hovered ?? null, querySelectorAll: () => cards });
  const mine = id => id.startsWith("m");
  assert.equal(boostCardButton(root(), mine), mineOld, "another GC's newer card is passed over");
  assert.equal(boostCardButton(root(cards[2]), mine), theirs, "the pointer chooses any card");
  assert.equal(boostCardButton(root(cards[1]), mine), null, "a spent card under the pointer boosts nothing else");
  // A card pointed at in a popped-out chat log is outside the sidebar's list, and still the one chosen.
  const popout = card("t9", [{ disabled: false, name: "popout" }]);
  assert.equal(boostCardButton(root(), mine, undefined, root(popout)).name, "popout");
  assert.equal(
    boostCardButton(root(), () => false),
    null
  );
  const { boostRefusal } = await import("../module/apps/keybindings.mjs");
  const pointed = button => ({
    querySelector: selector => (selector.includes("message-id") ? { querySelector: () => button } : null)
  });
  assert.match(boostRefusal(pointed(null)), /has no GC boost/);
  assert.match(
    boostRefusal(pointed({ dataset: { tooltip: "Already boosted." } })),
    /cannot be boosted: Already boosted\./
  );
  assert.match(boostRefusal({ querySelector: () => null }), /None of your cards/);
});

test("a mouse click lets go of a button so shortcuts keep working; a keyboard press keeps its focus", async () => {
  const { releaseFocusAfterClick } = await import("../module/apps/keybindings.mjs");
  let blurred = 0;
  const button = (inside, dialog = false) => {
    const self = {
      blur: () => blurred++,
      closest: selector =>
        selector.startsWith("button") ? self : selector.startsWith("dialog") ? (dialog ? {} : null) : inside ? {} : null
    };
    return self;
  };
  const sheetButton = button(true);
  assert.equal(releaseFocusAfterClick({ detail: 1, target: sheetButton }, sheetButton), true);
  assert.equal(blurred, 1);
  assert.equal(releaseFocusAfterClick({ detail: 0, target: sheetButton }, sheetButton), false, "keyboard press");
  const elsewhere = button(false);
  assert.equal(releaseFocusAfterClick({ detail: 1, target: elsewhere }, elsewhere), false, "not this system's");
  const inDialog = button(true, true);
  assert.equal(releaseFocusAfterClick({ detail: 1, target: inDialog }, inDialog), false, "dialogs keep focus");
  assert.equal(releaseFocusAfterClick({ detail: 1, target: sheetButton }, {}), false, "focus already moved");
  assert.equal(blurred, 1);
});

test("the focus release leaves Foundry's own sidebar buttons alone", async () => {
  const { releaseFocusAfterClick } = await import("../module/apps/keybindings.mjs");
  const tab = {
    blur() {},
    closest: selector => (selector.startsWith("button") ? tab : selector.includes("#sidebar") ? {} : null)
  };
  assert.equal(releaseFocusAfterClick({ detail: 1, target: tab }, tab), false);
});

test("a damage card shows what applying it did, as text, one line per outcome", async () => {
  const { renderDamageResults } = await import("../module/rolls/chat-controls.mjs");
  const html = new Element("li");
  renderDamageResults(
    {
      checkKind: "damage",
      damageAppliedBy: {
        a: { targetUuid: "Actor.k", name: "Kevin", damage: 9, kind: "lethal", report: ["Kevin takes 9 damage."] },
        b: {
          targetUuid: "Actor.g",
          name: "Guard",
          damage: 4,
          kind: "lethal",
          report: ["<img src=x onerror=alert(1)>"]
        },
        c: { targetUuid: "Actor.n", name: "Old", damage: 2, kind: "lethal" }
      }
    },
    html
  );
  const section = html.content.children[0];
  assert.equal(section.className, "spycraft2 sc2-damage-results");
  assert.deepEqual(
    section.children.map(p => [p.tag, p.textContent, p.innerHTML]),
    [
      ["p", "Kevin takes 9 damage.", undefined],
      ["p", "<img src=x onerror=alert(1)>", undefined]
    ]
  );
  const none = new Element("li");
  renderDamageResults({ checkKind: "attack", damageAppliedBy: { a: { report: ["x"] } } }, none);
  assert.equal(none.content, undefined);
});

test("a damage report kept on the card is plain text within its limits", async () => {
  const { reportText, validReport } = await import("../module/rules/damage-application.mjs");
  assert.deepEqual(reportText(["<b>Kevin</b> &amp; Co take 9 damage.", "", 3, "  two   spaces "]), [
    "Kevin & Co take 9 damage.",
    "two spaces"
  ]);
  assert.equal(reportText(Array(20).fill("x")).length, 12);
  assert.equal(validReport(undefined), true);
  assert.equal(validReport(["ok"]), true);
  assert.equal(validReport([{}]), false);
  assert.equal(validReport(["x".repeat(401)]), false);
});
