import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REMINDER_KINDS,
  chosenReminders,
  dialogRoll,
  featReminders,
  reminderApplies,
  reminderNote,
  reminderSection,
  reminderTokens
} from "../module/rules/feat-reminders.mjs";
import { RollPipeline } from "../module/rules/roll-pipeline.mjs";
import { rollPipeline } from "../module/rolls/index.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { FEAT_REMINDERS } from "../module/rules/tables.mjs";
import { MIGRATIONS, SCHEMA_VERSION, featReminderUpdate, migrateWorld } from "../module/migrations/index.mjs";

globalThis.foundry ??= { utils: { escapeHTML: String } };
globalThis.game ??= { user: { isGM: true, targets: new Set() }, actors: [], combats: [], i18n: { localize: String } };

const data = name => JSON.parse(readFileSync(new URL(`../src/data/${name}`, import.meta.url), "utf8"));
const feat = (id, name, rolls, text = "") => ({ id, name, type: "feat", system: { reminder: { rolls, text } } });

test("roll tokens are normalized and unknown ones dropped", () => {
  assert.deepEqual(reminderTokens("Attack, skill:sneak; save:will damage"), [
    "attack",
    "skill:sneak",
    "save:will",
    "damage"
  ]);
  assert.deepEqual(reminderTokens("attack, attack, initiative, save:luck, attack:sword, "), ["attack"]);
  assert.deepEqual(reminderTokens(["skill", "skill:drive"], ["drive"]), ["skill", "skill:drive"]);
  assert.deepEqual(reminderTokens("skill:nonsense", ["drive"]), []);
  assert.deepEqual(reminderTokens(undefined), []);
});

test("a token covers its roll kind, narrowed to one skill or save when it names one", () => {
  assert.equal(reminderApplies(["attack"], { kind: "attack" }), true);
  assert.equal(reminderApplies(["attack"], { kind: "damage" }), false);
  assert.equal(reminderApplies(["skill"], { kind: "skill", skillKey: "sneak" }), true);
  assert.equal(reminderApplies(["skill:drive"], { kind: "skill", skillKey: "sneak" }), false);
  assert.equal(reminderApplies(["skill:drive"], { kind: "skill", skillKey: "drive" }), true);
  assert.equal(reminderApplies(["save:ref"], { kind: "save", saveKey: "will" }), false);
  assert.equal(reminderApplies(["save:ref", "save"], { kind: "save", saveKey: "will" }), true);
});

test("a character's reminders for a roll are its matching feats, once per name, in name order", () => {
  const items = [
    feat("b", "Snap Shot", "attack", "extra shot"),
    feat("a", "Club Basics", "damage"),
    feat("c", "All or Nothing", "attack, skill, knowledge", "wider ranges"),
    feat("d", "Snap Shot", "attack", "duplicate selection"),
    feat("e", "Silent", ""),
    { id: "w", name: "Pistol", type: "weapon", system: { reminder: { rolls: "attack" } } }
  ];
  assert.deepEqual(featReminders(items, { kind: "attack" }), [
    { id: "c", name: "All or Nothing", text: "wider ranges" },
    { id: "b", name: "Snap Shot", text: "extra shot" }
  ]);
  assert.deepEqual(
    featReminders(items, { kind: "damage" }).map(r => r.name),
    ["Club Basics"]
  );
  assert.deepEqual(featReminders(items, { kind: "save", saveKey: "ref" }), []);
  assert.deepEqual(featReminders(null, { kind: "attack" }), []);
});

test("only ticked reminders that were offered are kept, and the note names them", () => {
  const offered = [
    { id: "a", name: "First", text: "does a thing" },
    { id: "b", name: "Second", text: "" }
  ];
  const chosen = chosenReminders(offered, { "featReminder-a": true, "featReminder-b": false, "featReminder-z": true });
  assert.deepEqual(chosen, [{ name: "First", text: "does a thing" }]);
  assert.equal(reminderNote(chosen), "Feats noted for the GC to apply: First (does a thing)");
  assert.equal(
    reminderNote([
      { name: "First", text: "x" },
      { name: "Second", text: "" }
    ]),
    "Feats noted for the GC to apply: First (x); Second"
  );
  assert.equal(reminderNote([]), "");
  assert.equal(reminderNote(undefined), "");
});

test("the dialog section escapes its text and is empty without reminders", () => {
  assert.equal(reminderSection([]), "");
  const html = reminderSection([{ id: 'x"1', name: "<b>Bold</b>", text: "a & b" }]);
  assert.match(html, /name="featReminder-x&quot;1"/);
  assert.match(html, /&lt;b&gt;Bold&lt;\/b&gt;/);
  assert.match(html, /a &amp; b/);
  assert.doesNotMatch(html, /<b>Bold/);
});

test("each roll dialog maps to the roll it is for", () => {
  assert.deepEqual(dialogRoll("skill", { key: "sneak" }), { kind: "skill", skillKey: "sneak" });
  assert.deepEqual(dialogRoll("save", { key: "will" }), { kind: "save", saveKey: "will" });
  assert.deepEqual(dialogRoll("attack"), { kind: "attack" });
  assert.deepEqual(dialogRoll("rangedAttack"), { kind: "attack" });
  assert.deepEqual(dialogRoll("damage"), { kind: "damage" });
  assert.deepEqual(dialogRoll("knowledge"), { kind: "knowledge" });
  assert.equal(dialogRoll("reachGeometry"), null);
});

test("the registered contributor adds a section to every roll dialog, reads the ticks and records them", () => {
  assert.ok(rollPipeline.has("featReminders"));
  const actor = {
    system: { conditionContext: {}, classLevels: {} },
    items: [feat("a", "Snap Shot", "attack", "extra shot"), feat("b", "Mingle", "skill:blend", "crowds")]
  };
  const attack = rollPipeline.dialog({
    dialog: "damage",
    actor,
    attackBonusHits: [],
    sideHits: [],
    targetChoices: { actors: [] }
  });
  assert.doesNotMatch(attack, /Snap Shot|Mingle/, "neither feat bears on damage");
  const save = rollPipeline.dialog({ dialog: "save", actor, feats: new Set(), key: "will", stillStandingContent: "" });
  assert.doesNotMatch(save, /Feats to keep in mind/);
  actor.items.push(feat("c", "Trick Shot", "attack, damage", "hold instead"));
  const damage = rollPipeline.dialog({
    dialog: "damage",
    actor,
    attackBonusHits: [],
    sideHits: [],
    targetChoices: { actors: [] }
  });
  assert.match(damage, /Feats to keep in mind/);
  assert.match(damage, /Trick Shot/);
  assert.doesNotMatch(damage, /Mingle/);
  assert.ok(damage.endsWith("</fieldset>"), "the section closes the form");
  // The attack dialog's contributors read what was entered from `entered`.
  const read = rollPipeline.read(
    { dialog: "attack", actor, item: { system: {} }, needsCQB: false, entered: { "featReminder-a": true } },
    {}
  );
  assert.deepEqual(read.featReminders, [{ name: "Snap Shot", text: "extra shot" }]);
  const skill = rollPipeline.read(
    { dialog: "skill", actor, key: "blend" },
    { check: "stealth", "featReminder-b": true }
  );
  assert.deepEqual(skill.featReminders, [{ name: "Mingle", text: "crowds" }]);
  // A caller's own list is left alone.
  const kept = rollPipeline.read({ dialog: "skill", actor, key: "blend" }, { check: "stealth", featReminders: [] });
  assert.deepEqual(kept.featReminders, []);
  // With nothing to offer, what was entered is passed on as the same object.
  const entered = { check: "hide" };
  assert.equal(rollPipeline.read({ dialog: "skill", actor, key: "sneak" }, entered), entered);
  const flags = rollPipeline.flags({ checkKind: "skill", options: { featReminders: skill.featReminders } });
  assert.deepEqual(flags.featReminders, [{ name: "Mingle", text: "crowds" }]);
  assert.equal(rollPipeline.flags({ checkKind: "skill", options: {} }).featReminders, null);
  assert.ok(new RollPipeline() instanceof RollPipeline);
});

test("the shipped reminder data names real feats, valid rolls and has a summary for each", () => {
  const reminders = data("feat-reminders.json").feats,
    feats = new Set(data("feats.json").map(f => f.name)),
    summaries = data("summaries.json").feats,
    skills = Object.keys(cfg.skills);
  // Feats the system comes to carry out leave this list, so it shrinks over time.
  assert.ok(Object.keys(reminders).length >= 25);
  for (const [name, rolls] of Object.entries(reminders)) {
    assert.ok(feats.has(name), `${name} is a feat`);
    assert.ok(rolls.length, `${name} names a roll`);
    assert.deepEqual(reminderTokens(rolls, skills), rolls, `${name}: every roll kind is valid`);
    assert.ok(summaries[name], `${name} has a summary`);
    assert.deepEqual(FEAT_REMINDERS[name], { rolls: rolls.join(", "), text: summaries[name] }, `${name} is generated`);
  }
  assert.deepEqual(Object.keys(FEAT_REMINDERS).sort(), Object.keys(reminders).sort());
  for (const kind of REMINDER_KINDS) assert.match(kind, /^[a-z]+$/);
});

test("version 2 gives feats already in a world their reminder, once, and leaves edited ones alone", async () => {
  assert.ok(SCHEMA_VERSION >= 2);
  assert.ok(MIGRATIONS.some(m => m.version === 2 && typeof m.item === "function"));
  const table = { "Snap Shot": { rolls: "attack", text: "extra shot" } };
  assert.deepEqual(featReminderUpdate({ type: "feat", name: "Snap Shot", system: {} }, table), {
    "system.reminder": { rolls: "attack", text: "extra shot" }
  });
  assert.equal(featReminderUpdate({ type: "weapon", name: "Snap Shot", system: {} }, table), null);
  assert.equal(featReminderUpdate({ type: "feat", name: "Homebrew", system: {} }, table), null);
  assert.equal(featReminderUpdate({ type: "feat", name: "toString", system: {} }, table), null);
  assert.equal(
    featReminderUpdate({ type: "feat", name: "Snap Shot", system: { reminder: { rolls: "damage", text: "" } } }, table),
    null
  );
  const doc = source => ({
    source,
    updates: 0,
    toObject() {
      return structuredClone(this.source);
    },
    async update(update) {
      this.updates += 1;
      this.source.system.reminder = update["system.reminder"];
    }
  });
  const name = Object.keys(FEAT_REMINDERS)[0];
  const owned = doc({ type: "feat", name, system: {} });
  const actor = { ...doc({ type: "agent", name: "Agent", system: {} }), items: [owned] };
  const world = { version: 1, actors: [actor], items: [], setVersion: async v => (world.version = v) };
  const report = await migrateWorld(world);
  assert.equal(report.updated, 1);
  assert.equal(world.version, SCHEMA_VERSION);
  assert.deepEqual(owned.source.system.reminder, FEAT_REMINDERS[name]);
  world.version = 1;
  assert.equal((await migrateWorld(world)).updated, 0, "a second run changes nothing");
});
