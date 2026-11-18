import test from "node:test";
import assert from "node:assert/strict";
import { chatSearchRecord, chatRollType, searchChatRecords } from "../module/apps/chat-search.mjs";

const text = html => html;
const message = (patch = {}) => ({
  id: "m1",
  visible: true,
  isContentVisible: true,
  speaker: { alias: "Étienne Beaulieu" },
  flavor: "Attack: Browning",
  content: "Result 17",
  timestamp: 100,
  isRoll: true,
  rolls: [{ formula: "1d20 + 1", total: 17 }],
  flags: {},
  ...patch
});

test("unreadable whispers and private/blind roll placeholders are excluded before any metadata is read", () => {
  for (const permissions of [
    { visible: false, isContentVisible: false },
    { visible: true, isContentVisible: false }
  ]) {
    const hidden = { ...permissions };
    for (const key of ["flavor", "content", "speaker", "flags", "rolls", "speakerActor"]) {
      Object.defineProperty(hidden, key, {
        get() {
          throw Error("Read private " + key);
        }
      });
    }
    assert.equal(
      chatSearchRecord(hidden, () => {
        throw Error("Indexed private content");
      }),
      null
    );
  }
});

test("only visible message text, flavor and dice are indexed; secret inclusion follows Foundry speaker ownership", () => {
  const calls = [];
  const record = chatSearchRecord(
    message({
      speakerActor: { isOwner: false },
      flags: {
        spycraft2: {
          checkKind: "attack",
          targetSecret: "hidden enemy",
          dc: 99
        }
      }
    }),
    (html, includeSecrets) => {
      calls.push(includeSecrets);
      return html;
    }
  );
  assert.deepEqual(calls, [false, false]);
  assert.ok(record.searchText.includes("browning"));
  assert.ok(record.searchText.includes("1d20 + 1"));
  assert.ok(!record.searchText.includes("hidden enemy"));
  assert.ok(!record.searchText.includes("99"));
  const owner = [];
  chatSearchRecord(message({ speakerActor: { isOwner: true } }), (html, secrets) => {
    owner.push(secrets);
    return html;
  });
  assert.deepEqual(owner, [true, true]);
});

test("character, roll type and all text terms combine, with case/accent-insensitive literal matching", () => {
  const records = [
    chatSearchRecord(message(), text),
    chatSearchRecord(message({ id: "m2", timestamp: 200, flavor: "Damage: Browning", content: "Result 8" }), text),
    chatSearchRecord(message({ id: "m3", speaker: { alias: "Dan" }, flavor: "Attack: Knife" }), text)
  ];
  assert.deepEqual(
    searchChatRecords(records, { character: "etienne beaulieu", type: "attack", text: "BROWNING 17" }).map(r => r.id),
    ["m1"]
  );
  assert.equal(searchChatRecords(records, { character: "dan", type: "damage" }).length, 0);
  assert.equal(searchChatRecords(records, { text: "[.*]" }).length, 0);
  assert.equal(searchChatRecords(records, { text: "Browning missing" }).length, 0);
  assert.deepEqual(
    searchChatRecords(records, { text: "browning" }).map(r => r.id),
    ["m2", "m1"]
  );
  assert.equal(searchChatRecords(records).length, 3);
});

test("typed checks, taking results, native initiative and old unflagged rolls have useful categories", () => {
  assert.equal(
    chatRollType(message({ flags: { spycraft2: { checkKind: "skill" } } }), "Attack: custom label"),
    "skill"
  );
  assert.equal(chatRollType(message({ isRoll: false, flags: { spycraft2: { checkKind: "skill" } } })), "skill");
  assert.equal(chatRollType(message({ flags: { core: { initiativeRoll: true } } })), "initiative");
  for (const [flavor, expected] of [
    ["Fortitude (error 1, threat 20)", "save"],
    ["Reflex", "save"],
    ["Wisdom", "ability"],
    ["Étienne Beaulieu rolls for Initiative!", "initiative"],
    ["Spend an action die", "actionDie"],
    ["Sneak (Dexterity) — cross-class", "skill"],
    ["Knowledge", "knowledge"],
    ["Gear check", "gear"],
    ["Request", "request"],
    ["1d6", "other"]
  ])
    assert.equal(chatRollType(message(), flavor), expected);
  assert.equal(chatRollType(message({ isRoll: false }), "Attack: we should wait"), "message");
  assert.equal(
    chatRollType(message({ isRoll: false, flags: { spycraft2: { checkKind: "actionDieAward" } } })),
    "message"
  );
});

test("search covers the entire collection, not the current rendered batch, and keeps historical speaker names", () => {
  const records = Array.from({ length: 125 }, (_, i) =>
    chatSearchRecord(
      message({
        id: String(i),
        timestamp: i,
        speaker: { alias: i === 0 ? "Retired agent" : "Dan" },
        flavor: i === 0 ? "Attack: old Browning" : "Damage: Knife"
      }),
      text
    )
  );
  assert.equal(searchChatRecords(records, { text: "old browning" })[0].character, "Retired agent");
  assert.equal(searchChatRecords(records, { type: "roll" }).length, 125);
  assert.equal(searchChatRecords(records, { type: "message" }).length, 0);
  assert.equal(searchChatRecords(records)[0].timestamp, 124);
});
