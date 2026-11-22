import test from "node:test";
import assert from "node:assert/strict";
import {
  OWNERSHIP,
  nameWords,
  matchingPlayer,
  ownershipProposal,
  pendingProposals,
  describeProposal,
  applyDefaultOwnership,
  reviewOwnership
} from "../module/apps/character-ownership.mjs";

const gm = { id: "gm", name: "Game Control", isGM: true };
const sacha = { id: "u1", name: "Sacha", isGM: false };
const robin = { id: "u2", name: "Robin Lee", isGM: false };
const users = [gm, sacha, robin];
const agent = (name, ownership = { default: 0, gm: 3 }, extra = {}) => ({
  id: name.toLowerCase().replace(/\W+/g, ""),
  type: "agent",
  name,
  ownership,
  ...extra
});

test("names are compared word by word, without accents, case or possessives", () => {
  assert.deepEqual(nameWords("Sacha's Agent"), ["sacha", "agent"]);
  assert.deepEqual(nameWords("Breakwater (Sácha)"), ["breakwater", "sacha"]);
  assert.deepEqual(nameWords("Robin’s"), ["robin"]);
});

test("a player is identified by assignment first, then by their whole user name in the character's name", () => {
  assert.equal(matchingPlayer(agent("Breakwater (Sacha)"), users).user, sacha);
  assert.equal(matchingPlayer(agent("Sacha's agent"), users).reason, "name");
  assert.equal(matchingPlayer(agent("Lee Robin, field agent"), users).user, robin);
  // Only part of a multi-word user name is not enough, and a substring inside a word never matches.
  assert.equal(matchingPlayer(agent("Robin Hood"), users), null);
  assert.equal(matchingPlayer(agent("Sachamaru"), users), null);
  // The GC's own name never identifies an owner.
  assert.equal(matchingPlayer(agent("Game Control"), users), null);
  const assigned = { ...robin, character: { id: "breakwater" } };
  const found = matchingPlayer(agent("Breakwater"), [gm, sacha, assigned]);
  assert.equal(found.user, assigned);
  assert.equal(found.reason, "assigned");
  // Two candidates: nobody is guessed.
  const twin = { id: "u3", name: "Sacha", isGM: false };
  assert.equal(matchingPlayer(agent("Breakwater (Sacha)"), [...users, twin]), null);
});

test("a proposal raises the default to Observer and makes an identified player Owner when no player owns it", () => {
  const proposal = ownershipProposal(agent("Breakwater (Sacha)"), users);
  assert.deepEqual(proposal.changes, { default: OWNERSHIP.OBSERVER, u1: OWNERSHIP.OWNER });
  assert.match(describeProposal(proposal), /all players: Observer; Sacha: Owner \(name match\)/);
  // Already owned by a player: only the default is proposed.
  assert.deepEqual(ownershipProposal(agent("Breakwater (Sacha)", { default: 0, u2: 3 }), users).changes, {
    default: OWNERSHIP.OBSERVER
  });
  // Nothing missing: no proposal.
  assert.equal(ownershipProposal(agent("Breakwater (Sacha)", { default: 2, u1: 3 }), users), null);
  assert.equal(ownershipProposal(agent("Nobody", { default: 2 }), users), null);
  // A higher default is left alone; with the setting at None only ownership is proposed.
  assert.equal(ownershipProposal(agent("Nobody", { default: 3 }), users), null);
  assert.equal(ownershipProposal(agent("Nobody"), users, { defaultLevel: OWNERSHIP.NONE }), null);
  // NPCs, vehicles and compendium entries are never touched.
  assert.equal(ownershipProposal({ ...agent("Sacha"), type: "npc" }, users), null);
  assert.equal(ownershipProposal(agent("Sacha", undefined, { pack: "world.agents" }), users), null);
});

test("rows the GC declined are not offered again until the proposal changes", () => {
  const actor = agent("Breakwater (Sacha)");
  const first = pendingProposals([actor], users);
  assert.equal(first.length, 1);
  const dismissed = { [actor.id]: first[0].signature };
  assert.equal(pendingProposals([actor], users, { dismissed }).length, 0);
  // A new player name now matches as well: the proposal differs, so it is asked again.
  const renamed = { ...actor, name: "Breakwater (Robin Lee)" };
  assert.equal(pendingProposals([renamed], users, { dismissed }).length, 1);
});

test("new agents get the default ownership unless their data already grants as much", () => {
  globalThis.game = { user: { id: "gm" }, settings: { get: () => OWNERSHIP.OBSERVER } };
  const made = (type, ownership) => {
    const doc = { type, _source: { ownership }, updates: [] };
    doc.updateSource = change => doc.updates.push(change);
    return doc;
  };
  const fresh = made("agent", { gm: 3 });
  applyDefaultOwnership(fresh, {}, {}, "gm");
  assert.deepEqual(fresh.updates, [{ "ownership.default": OWNERSHIP.OBSERVER }]);
  const open = made("agent", { default: 3 });
  applyDefaultOwnership(open, {}, {}, "gm");
  assert.deepEqual(open.updates, []);
  const npc = made("npc", {});
  applyDefaultOwnership(npc, {}, {}, "gm");
  assert.deepEqual(npc.updates, []);
  // Only the creating client writes the default.
  const elsewhere = made("agent", {});
  applyDefaultOwnership(elsewhere, {}, {}, "someone-else");
  assert.deepEqual(elsewhere.updates, []);
  const kept = made("agent", {});
  applyDefaultOwnership(kept, {}, { spycraft2KeepOwnership: true }, "gm");
  assert.deepEqual(kept.updates, []);
  globalThis.game.settings.get = () => OWNERSHIP.NONE;
  const off = made("agent", {});
  applyDefaultOwnership(off, {}, {}, "gm");
  assert.deepEqual(off.updates, []);
  delete globalThis.game;
});

test("the ranged attack dialog defaults to a Standard Attack", async () => {
  globalThis.foundry ??= { utils: { escapeHTML: s => String(s) } };
  const { rollPipeline } = await import("../module/rules/roll-pipeline.mjs");
  await import("../module/rolls/dialogs/rangedAttack.mjs");
  const html = rollPipeline.dialog({
    dialog: "rangedAttack",
    actor: { system: {}, items: [] },
    esc: s => String(s),
    item: { system: {} },
    options: {},
    preview: { range: 30, firearm: true, modes: ["single"], fireMode: "single" }
  });
  assert.match(html, /<select name="attackAction"><option value="standard" selected>/);
});

test("a row that changed while the review was open is not applied or remembered", async () => {
  const saved = {};
  globalThis.game = {
    user: { id: "gm", isGM: true },
    users: Object.assign([gm, sacha, robin], { activeGM: null }),
    settings: { get: () => ({}), set: async (_s, key, value) => (saved[key] = value) }
  };
  globalThis.ui = { notifications: { info() {} } };
  globalThis.foundry = {
    utils: { escapeHTML: s => String(s) },
    applications: { api: { DialogV2: { input: async () => ({ "apply-a": true, "apply-b": true }) } } }
  };
  const updates = [];
  const make = (id, name, ownership) => ({ ...agent(name, ownership), id, update: async d => updates.push([id, d]) });
  const stale = make("a", "Breakwater (Sacha)", { default: 0 });
  const kept = make("b", "Nobody", { default: 0 });
  const proposals = pendingProposals([stale, kept], users);
  // While the dialog was open, Robin was given Owner on the first agent.
  const recheck = actor =>
    ownershipProposal(actor.id === "a" ? { ...actor, ownership: { default: 0, u2: 3 } } : actor, users);
  const result = await reviewOwnership(proposals, { recheck });
  assert.deepEqual(result, { applied: 1, changed: 1 });
  assert.deepEqual(updates, [["b", { ownership: { default: OWNERSHIP.OBSERVER } }]]);
  assert.deepEqual(saved.ownershipReviewDismissed, {});
  delete globalThis.game;
  delete globalThis.ui;
});
