// Drives the Foundry-facing GC tools through minimal stubs. This checks the bookkeeping and wiring;
// it is not a substitute for a live Foundry world.
import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT } from "../module/config.mjs";

const settings = new Map(),
  registered = new Map(),
  messages = [],
  warnings = [];
let dialogAnswers = [],
  confirmAnswers = [],
  diceQueue = [],
  idCounter = 0;
const answer = (...list) => {
  dialogAnswers.push(...list);
};
const dice = (...list) => {
  diceQueue.push(...list);
};
class Roll {
  constructor(formula) {
    this.formula = formula;
  }
  async evaluate() {
    const match = /^(\d+)d(\d+)(?:\s*\+\s*(\d+))?/.exec(this.formula);
    if (!diceQueue.length) throw new Error(`No queued die for ${this.formula}`);
    this.total =
      match && Number(match[1]) > 1
        ? diceQueue.splice(0, Number(match[1])).reduce((a, b) => a + b, 0) + Number(match[3] ?? 0)
        : diceQueue.shift();
    // One die: the natural face is kept apart from the total, as Foundry's own Roll does.
    if (!(match && Number(match[1]) > 1)) this.dice = [{ total: this.total }];
    return this;
  }
  async toMessage(data) {
    messages.push({ content: data.flavor, roll: this.total });
    return data;
  }
}
const makeActor = (id, type, system, extra = {}) => ({
  id,
  uuid: `Actor.${id}`,
  name: extra.name ?? id,
  type,
  system,
  flags: {},
  isOwner: true,
  hasPlayerOwner: type === "agent",
  statuses: new Set(),
  effects: [],
  isToken: false,
  async update(change) {
    for (const [path, value] of Object.entries(change)) {
      const keys = path.split(".");
      let target = this;
      for (const key of keys.slice(0, -1)) target = target[key] ??= {};
      const last = keys.at(-1);
      if (last.startsWith("-=")) delete target[last.slice(2)];
      else target[last.replace(/^==/, "")] = value;
    }
    return this;
  },
  async toggleStatusEffect(status, { active }) {
    if (active) this.statuses.add(status);
    else this.statuses.delete(status);
  },
  async createEmbeddedDocuments(_type, [data]) {
    for (const status of data.statuses) this.statuses.add(status);
    const effect = { id: `e${++idCounter}`, ...data };
    this.effects.push(effect);
    return [effect];
  },
  reset() {},
  ...extra
});
const actors = new Map();
globalThis.foundry = {
  utils: {
    escapeHTML: text => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    randomID: () => `id${++idCounter}`
  },
  applications: {
    sidebar: {
      AbstractSidebarTab: class {
        async _prepareContext() {
          return {};
        }
        _canRender() {}
        async _onFirstRender() {}
        render() {
          return this;
        }
      }
    },
    api: {
      DialogV2: {
        input: async () => {
          if (!dialogAnswers.length) throw new Error("Unexpected dialog");
          const answer = dialogAnswers.shift();
          return typeof answer === "function" ? answer() : answer;
        },
        confirm: async () => {
          const answer = confirmAnswers.length ? confirmAnswers.shift() : true;
          return typeof answer === "function" ? answer() : answer;
        }
      },
      ApplicationV2: class {
        render() {
          return this;
        }
      },
      HandlebarsApplicationMixin: Base => Base
    }
  }
};
globalThis.CONFIG = {
  SPYCRAFT,
  statusEffects: [
    { id: "flat-footed", name: "Flat-footed" },
    { id: "reeling", name: "Reeling" }
  ]
};
globalThis.ui = {
  notifications: {
    warn: message => {
      warnings.push(message);
      return null;
    },
    info: () => null
  },
  combat: { render() {} }
};
globalThis.Roll = Roll;
globalThis.ChatMessage = {
  create: async data => {
    messages.push(data);
    return data;
  },
  getSpeaker: () => ({}),
  getWhisperRecipients: () => [{ id: "gm" }]
};
globalThis.Hooks = { on() {}, once() {} };
globalThis.fromUuid = async uuid => [...actors.values()].find(actor => actor.uuid === uuid) ?? null;
globalThis.game = {
  user: { isGM: true, id: "gm" },
  users: { activeGM: { id: "gm" } },
  ready: false,
  spycraft2: { gc: {} },
  i18n: { localize: text => text },
  settings: {
    register: (scope, key, config) => registered.set(`${scope}.${key}`, config),
    get: (scope, key) => {
      const id = `${scope}.${key}`;
      if (!registered.has(id)) throw new Error(`${id} is not registered`);
      return settings.has(id) ? structuredClone(settings.get(id)) : structuredClone(registered.get(id).default);
    },
    set: async (scope, key, value) => {
      settings.set(`${scope}.${key}`, structuredClone(value));
      return value;
    }
  },
  actors: { get: id => actors.get(id), [Symbol.iterator]: () => actors.values() },
  combats: [],
  combat: null
};
for (const key of ["usagePeriods", "usagePeriodReview", "gcActionDice"])
  game.settings.register("spycraft2", key, { default: {} });

const state = await import("../module/apps/gc/state.mjs");
state.registerGCSettings();
const mission = await import("../module/apps/gc/mission.mjs");
const npc = await import("../module/apps/gc/npc-play.mjs");
const spend = await import("../module/apps/gc/spend.mjs");
const combat = await import("../module/apps/gc/combat.mjs");
const conflicts = await import("../module/apps/gc/conflicts.mjs");
const tables = await import("../module/apps/gc/tables.mjs");
const { consoleContext, consoleSections, GCConsole, registerGCConsoleTab, openGCConsole } =
  await import("../module/apps/gc/console.mjs");
const { initializeGCDice, gcDiceStatus } = await import("../module/services/gc-dice.mjs");
const { missionSettlementDefaults } = await import("../module/apps/gc/mission-defaults.mjs");

const agent = (id, level) =>
  makeActor(id, "agent", {
    level,
    reputation: 2,
    netWorth: 100000,
    actionDice: { value: 3, max: 3 },
    actionDieAwardSummary: { count: 1 },
    abilities: { int: { mod: 2 } },
    initiative: { total: 4 }
  });
const npcSystem = (overrides = {}) => ({
  npcType: "standard",
  npcProfile: { enabled: true, qualities: [], grades: {} },
  npcBuild: { xp: 37, skills: [{ key: "notice", bonus: 9 }] },
  competence: 4,
  damageSave: 6,
  damageSaveAdjust: 0,
  damageTrack: null,
  usagePeriods: {},
  disposition: { base: "neutral", toward: {} },
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { mod: k === "wis" ? 2 : 0 }])),
  initiative: { total: 3 },
  ...overrides
});
for (const [id, level] of [
  ["a1", 5],
  ["a2", 5],
  ["a3", 5],
  ["a4", 5]
])
  actors.set(id, agent(id, level));
const guard = makeActor("guard", "npc", npcSystem(), {
  name: "Guard",
  rollCheck: async (formula, data, options) => ({ formula, data, options })
});
const boss = makeActor(
  "boss",
  "npc",
  npcSystem({
    npcType: "special",
    npcProfile: { enabled: true, qualities: [{ id: "mastermind" }], grades: {} },
    npcBuild: { xp: 50, skills: [] }
  }),
  { name: "Boss" }
);
actors.set("guard", guard);
actors.set("boss", boss);
const lastMessage = () => messages.at(-1)?.content ?? "";

test("mission record: Threat Level is fixed at mission start and feeds the XP defaults", async () => {
  assert.equal(state.missionThreatLevel(), null);
  assert.deepEqual(missionSettlementDefaults(), { baseXP: 0, threatLevel: null, triumph: false });
  answer({
    name: "Cold Open",
    caliber: 3,
    threatAdjust: 2,
    threatOverride: "",
    dramaticScenes: 1,
    timeLimit: true,
    bundleCommonItems: 0,
    scenesPlayed: 0,
    notes: "",
    "team-a1": true,
    "team-a2": true,
    "team-a3": true,
    "team-a4": true
  });
  await mission.editMission();
  const tl = await mission.startMission();
  assert.deepEqual([tl.base, tl.value, tl.bonusDice], [4, 6, 0]);
  assert.equal(state.missionThreatLevel(), 6);
  assert.match(lastMessage(), /Threat Level <b>6<\/b>/);
  answer({ sample: "", name: "Steal the ledger", grade: 3, critical: true });
  await mission.addObjective();
  answer(
    { uuid: "Actor.guard", name: "", xp: 0, type: "", full: false, scenes: 1 },
    { uuid: "Actor.boss", name: "", xp: 0, type: "", full: false, scenes: 1 }
  );
  await mission.addAntagonist();
  await mission.addAntagonist();
  let m = state.getMission();
  assert.deepEqual(
    m.antagonists.map(a => [a.name, a.xp, a.type]),
    [
      ["Guard", 37, "standard"],
      ["Boss", 50, "special"]
    ]
  );
  assert.equal(state.missionXP().total, 50, "only the time limit so far");
  assert.equal(state.missionXP({ planned: true }).total, 50 + 75 + 37 + 200);
  await mission.changeEntry("objectives", m.objectives[0].id, "complete");
  await mission.changeEntry("antagonists", m.antagonists[1].id, "encountered");
  assert.equal(state.missionXP().total, 50 + 75 + 200);
  assert.deepEqual(missionSettlementDefaults(), { baseXP: 325, threatLevel: 6, triumph: false });
  await mission.missionReport();
  assert.match(lastMessage(), /\(325 \+ 25\) × 5 = <b>1750<\/b>/);
});

test("complications: security device XP by Power Rating, scripted quality, removal", async () => {
  answer({ kind: "security", security: "acid-jet", pr: 4, deviceXP: "", count: 1 });
  await mission.addComplication();
  assert.equal(state.getMission().security[0].xp, 40);
  answer({ kind: "quality", quality: "gritty", count: 1 });
  await mission.addComplication();
  assert.equal(state.missionXP().total, 325 + 40 + 100);
  answer({ kind: "quality", quality: "gritty", count: 1 });
  await mission.addComplication();
  assert.match(warnings.at(-1), /already in force/);
  await mission.changeEntry("security", state.getMission().security[0].key, "ignored");
  assert.equal(state.missionXP().total, 325 + 20 + 100);
  await mission.changeEntry("qualities", "gritty", "remove");
  await mission.changeEntry("security", state.getMission().security[0].key, "remove");
  assert.equal(state.missionXP().total, 325);
});

test("exposure infractions reduce standing at once; standing award pays the Caliber reward", async () => {
  answer({
    actor: "a1",
    infraction: "adhere-to-honor-code|0",
    currency: "reputation",
    preventing: false,
    honor: false
  });
  await mission.recordInfraction();
  assert.equal(actors.get("a1").system.reputation, 0);
  answer({ actor: "a1", infraction: "adhere-to-honor-code|1", currency: "reputation", preventing: true, honor: false });
  await mission.recordInfraction();
  assert.equal(actors.get("a1").system.reputation, -2);
  assert.match(lastMessage(), /Negative standing/);
  // A row can be taken off again, and the agent gets back what it cost.
  const rows = state.getMission().infractions;
  assert.ok(
    rows.every(row => row.id),
    "each row has its own id"
  );
  assert.ok(
    messages.findLast(message => message.flags?.spycraft2?.undo?.addedInfractions),
    "an Undo note"
  );
  await mission.removeInfraction(rows.at(-1).id);
  assert.equal(actors.get("a1").system.reputation, 0);
  assert.equal(state.getMission().infractions.length, rows.length - 1);
  assert.equal(await mission.removeInfraction("gone"), false);
  answer({ actor: "a1", infraction: "adhere-to-honor-code|1", currency: "reputation", preventing: true, honor: false });
  await mission.recordInfraction();
  assert.equal(actors.get("a1").system.reputation, -2);
  answer({ currency: "reputation" });
  assert.equal(await mission.awardStanding(), 12, "Caliber III is 10, +2 for a Threat Level raised by 2");
  assert.equal(actors.get("a2").system.reputation, 14);
});

test("the standing award pays each agent once per mission; a correction pays again", async () => {
  assert.deepEqual(Object.keys(state.getMission().standingPaid), ["a1", "a2", "a3", "a4"]);
  answer({ currency: "reputation", again: false });
  assert.equal(await mission.awardStanding(), null, "nobody is unpaid");
  assert.equal(actors.get("a2").system.reputation, 14);
  const record = state.getMission().standingPaid;
  delete record.a3;
  delete record.a4;
  await state.updateMission({ standingPaid: record });
  answer({ currency: "reputation", again: false });
  await mission.awardStanding();
  assert.equal(actors.get("a2").system.reputation, 14, "paid agents are skipped on a retry");
  assert.equal(actors.get("a3").system.reputation, 26);
  assert.match(lastMessage(), /awarded: a3 \(Reputation \+12\), a4 \(Reputation \+12\)\./);
  answer({ currency: "reputation", again: true });
  await mission.awardStanding();
  assert.equal(actors.get("a2").system.reputation, 26, "the correction pays everyone");
  const paidNote = messages.findLast(message => message.flags?.spycraft2?.undo?.standingPaid)?.flags.spycraft2.undo;
  assert.equal(paidNote.standingPaid.period, state.missionEpoch(), "Undo is tied to the mission that paid");
  assert.ok(paidNote.standingPaid.marks.a2, "the earlier marks are kept for Undo");
  for (const id of ["a2", "a3", "a4"]) await actors.get(id).update({ "system.reputation": 14 });
});

test("End mission asks first, keeps the record for settlement, and Resume reopens it unchanged", async () => {
  dialogAnswers.push(null);
  assert.equal(await mission.endMission(), null);
  assert.equal(state.getMission().active, true, "cancelled");
  dialogAnswers.push({ countFinalScene: false });
  assert.equal(await mission.endMission(), true);
  let m = state.getMission();
  assert.deepEqual([m.active, m.ended], [false, true]);
  assert.match(lastMessage(), /ended/);
  assert.deepEqual(
    missionSettlementDefaults(),
    { baseXP: 325, threatLevel: 6, triumph: false },
    "settlement still has the totals"
  );
  // The figures are kept with the ended mission: a season quality added later does not move them.
  const season = game.settings.get("spycraft2", "campaign");
  await game.settings.set("spycraft2", "campaign", {
    ...season,
    qualities: [...(season?.qualities ?? []), "cakewalk"]
  });
  assert.equal(missionSettlementDefaults().baseXP, 325);
  const kept = state.getMission().settlementFigures;
  await state.updateMission({ settlementFigures: null });
  assert.notEqual(missionSettlementDefaults().baseXP, 325, "without the kept figures the quality would count");
  await state.updateMission({ settlementFigures: kept });
  await game.settings.set("spycraft2", "campaign", season);
  assert.equal(consoleContext().mission.ended, true);
  await mission.resumeMission();
  m = state.getMission();
  assert.deepEqual([m.active, m.ended, m.infractions.length], [true, false, 2]);
  assert.equal(m.objectives[0].complete, true);
  assert.equal(await mission.resumeMission(), null, "already active");
});

test("a change made while End mission is asking is kept; a record ended by an older version reads as ended", async () => {
  const id = state.getMission().objectives[0].id;
  await mission.changeEntry("objectives", id, "complete");
  assert.equal(state.getMission().objectives[0].complete, false);
  dialogAnswers.push(async () => {
    await mission.changeEntry("objectives", id, "complete");
    return { countFinalScene: false };
  });
  await mission.endMission();
  assert.equal(state.getMission().objectives[0].complete, true, "ticked while the question was open");
  const stored = { ...state.getMission() };
  delete stored.ended;
  await game.settings.set("spycraft2", "mission", stored);
  assert.equal(state.getMission().ended, true, "inactive with a fixed Threat Level");
  await mission.resumeMission();
});

test("starting an ended mission again asks, then clears the last run's results", async () => {
  const scenes = state.getMission().scenesPlayed ?? 0;
  dialogAnswers.push({ countFinalScene: true });
  await mission.endMission();
  assert.equal(state.getMission().scenesPlayed, scenes + 1, "the scene being played is counted");
  confirmAnswers.push(false);
  assert.equal(await mission.startMission(), null);
  assert.equal(state.getMission().objectives[0].complete, true, "cancelled: nothing cleared");
  // Asked about the exposure losses: kept.
  const reputation = actors.get("a1").system.reputation;
  confirmAnswers.push(true, false);
  await mission.startMission();
  assert.equal(actors.get("a1").system.reputation, reputation, "the losses stay when the GC keeps them");
  const m = state.getMission();
  assert.deepEqual([m.active, m.ended, m.infractions.length, m.scenesPlayed], [true, false, 0, 0]);
  assert.equal(m.objectives[0].complete, false);
  assert.equal(m.antagonists[1].encountered, false);
  assert.deepEqual(m.standingPaid, {});
  await mission.changeEntry("objectives", m.objectives[0].id, "complete");
  await mission.changeEntry("antagonists", m.antagonists[1].id, "encountered");
});

test("dice that could not be taken at 0 are not handed back when the change goes", async () => {
  const a1 = actors.get("a1"),
    kept = { value: a1.system.actionDice.value, flag: a1.flags.spycraft2?.sessionDiceAdjusted };
  a1.system.actionDice.value = 1;
  a1.flags.spycraft2 ??= {};
  delete a1.flags.spycraft2.sessionDiceAdjusted;
  await state.setCampaign({ qualities: ["bleak"] });
  await mission.applySessionDiceAdjustments({ quiet: true });
  assert.equal(a1.system.actionDice.value, 0);
  assert.deepEqual(a1.flags.spycraft2.sessionDiceAdjusted, { session: "initial", change: -2, applied: -1 });
  await state.setCampaign({ qualities: [] });
  await mission.applySessionDiceAdjustments({ quiet: true });
  assert.equal(a1.system.actionDice.value, 1, "only the one die really taken comes back");
  // A wrong adjustment is undone from its note: the dice and the adjusted mark go back, so it can run again (U5).
  delete a1.flags.spycraft2.sessionDiceAdjusted;
  await state.setCampaign({ qualities: ["bleak"] });
  await mission.applySessionDiceAdjustments({ quiet: true });
  assert.equal(a1.system.actionDice.value, 0);
  const note = messages.findLast(message => message.flags?.spycraft2?.undo);
  assert.equal(note.flags.spycraft2.undo.label, "Starting action dice adjusted");
  const { applyUndo } = await import("../module/apps/undo.mjs");
  await applyUndo({ id: "dice-undo", flags: structuredClone(note.flags), update: async () => null });
  assert.equal(a1.system.actionDice.value, 1);
  assert.equal(a1.flags.spycraft2.sessionDiceAdjusted, undefined);
  await state.setCampaign({ qualities: [] });
  a1.system.actionDice.value = kept.value;
  if (kept.flag) a1.flags.spycraft2.sessionDiceAdjusted = kept.flag;
  else delete a1.flags.spycraft2.sessionDiceAdjusted;
});

test("an agent whose dice convert gains or loses the converted number (Fortune Favors the Bold)", async () => {
  const a1 = actors.get("a1"),
    kept = {
      value: a1.system.actionDice.value,
      max: a1.system.actionDice.max,
      flag: a1.flags.spycraft2?.sessionDiceAdjusted
    };
  Object.assign(a1.system.actionDice, { value: 6, max: 6, gainMultiplier: 2 });
  a1.flags.spycraft2 ??= {};
  delete a1.flags.spycraft2.sessionDiceAdjusted;
  await state.setCampaign({ qualities: ["bleak"] });
  await mission.applySessionDiceAdjustments({ quiet: true });
  assert.equal(a1.system.actionDice.value, 2, "two d6 for each die Bleak takes");
  await state.setCampaign({ qualities: [] });
  await mission.applySessionDiceAdjustments({ quiet: true });
  delete a1.system.actionDice.gainMultiplier;
  Object.assign(a1.system.actionDice, { value: kept.value, max: kept.max });
  if (kept.flag) a1.flags.spycraft2.sessionDiceAdjusted = kept.flag;
  else delete a1.flags.spycraft2.sessionDiceAdjusted;
});

test("starting-dice adjustments apply once per session", async () => {
  await state.setCampaign({ qualities: ["bleak"] });
  await mission.applySessionDiceAdjustments();
  assert.equal(actors.get("a1").system.actionDice.value, 1);
  await mission.applySessionDiceAdjustments();
  assert.equal(actors.get("a1").system.actionDice.value, 1);
  await state.setCampaign({ qualities: [] });
});

test("a change that arrives after the first adjustment gives only the difference", async () => {
  const a1 = actors.get("a1");
  assert.deepEqual(a1.flags.spycraft2.sessionDiceAdjusted, { session: "initial", change: -2, applied: -2 });
  await mission.applySessionDiceAdjustments();
  assert.equal(a1.system.actionDice.value, 3, "the quality is gone, so its 2 dice come back");
  assert.equal(a1.flags.spycraft2.sessionDiceAdjusted.change, 0);
  a1.flags.spycraft2.sessionDiceAdjusted = "initial";
  await state.setCampaign({ qualities: ["bleak"] });
  await mission.applySessionDiceAdjustments();
  assert.equal(a1.system.actionDice.value, 3, "a flag from an older version counts as already adjusted");
  await state.setCampaign({ qualities: [] });
  for (const id of ["a1", "a2", "a3", "a4"]) {
    actors.get(id).flags.spycraft2.sessionDiceAdjusted = undefined;
    await actors.get(id).update({ "system.actionDice.value": 3 });
  }
});

test("NPC skill check uses Competence or the skilled bonus plus the attribute", async () => {
  answer({ key: "notice", ability: "", modifier: 1, error: 1, secret: false });
  let roll = await npc.rollNpcSkill(guard);
  assert.equal(roll.data.total, 9 + 2 + 1);
  assert.equal(roll.options.cap, 40);
  answer({ key: "athletics", ability: "", modifier: 0, error: 1, secret: true });
  roll = await npc.rollNpcSkill(guard);
  assert.equal(roll.data.total, 4);
  assert.equal(roll.options.cap, 30);
  assert.equal(roll.options.rollMode, "gmroll");
});

test("Comedy of Errors widens an NPC's error range on its lowest attribute (p.406)", async () => {
  const abilities = guard.system.abilities;
  guard.system.abilities = Object.fromEntries(
    Object.entries(abilities).map(([key, value]) => [key, { ...value, value: key === "wis" ? 8 : 14 }])
  );
  await state.setCampaign({ qualities: ["comedy-of-errors"] });
  try {
    answer({ key: "notice", ability: "wis", modifier: 0, error: 1, secret: false });
    assert.equal((await npc.rollNpcSkill(guard)).options.error, 3);
    answer({ key: "notice", ability: "int", modifier: 0, error: 1, secret: false });
    assert.equal((await npc.rollNpcSkill(guard)).options.error, 1);
  } finally {
    guard.system.abilities = abilities;
    await state.setCampaign({ qualities: [] });
  }
});

test("an NPC skill check is posted as the named check, with that check's own error range (p.88)", async () => {
  answer({ skillCheck: "medicine:surgery", ability: "", modifier: 0, error: "", secret: false });
  let roll = await npc.rollNpcSkill(guard);
  assert.equal(roll.options.checkKind, "skill");
  assert.equal(roll.options.skillKey, "medicine");
  assert.equal(roll.options.checkId, "surgery");
  assert.equal(roll.options.error, 4);
  // The sheet's quick roll names only the skill: its first check, at that check's error range.
  roll = await npc.rollNpcSkill(guard, { key: "acrobatics", ability: "", modifier: 0 });
  assert.equal(roll.options.checkId, "balance");
  assert.equal(roll.options.error, 1);
  roll = await npc.rollNpcSkill(guard, { key: "acrobatics", check: "falling", ability: "", modifier: 0 });
  assert.equal(roll.options.error, 3);
  // A typed error range still wins.
  roll = await npc.rollNpcSkill(guard, { key: "medicine", check: "surgery", modifier: 0, error: 2 });
  assert.equal(roll.options.error, 2);
});

test("an NPC's conditions and Size reach its skill checks, halved under Omni-Competent (pp.340–342, 349, 408)", async () => {
  const system = guard.system;
  try {
    system.conditionContext = { sickened: true };
    let roll = await npc.rollNpcSkill(guard, { key: "notice", check: "awareness", modifier: 0 });
    assert.equal(roll.data.total, 9 + 2 - 2);
    system.conditionContext = {};
    system.sizeHideModifier = -4;
    roll = await npc.rollNpcSkill(guard, { key: "blend", check: "stealth", ability: "dex", modifier: 0 });
    assert.equal(roll.data.total, 4 - 4);
    roll = await npc.rollNpcSkill(guard, { key: "sneak", check: "hide", ability: "dex", modifier: 0 });
    assert.equal(roll.data.total, 4 - 4);
    delete system.sizeHideModifier;
    await state.setCampaign({ qualities: ["omni-competent"] });
    roll = await npc.rollNpcSkill(guard, { key: "notice", check: "awareness", modifier: -4 });
    assert.equal(roll.data.total, 9 + 2 - 2);
  } finally {
    delete system.conditionContext;
    delete system.sizeHideModifier;
    await state.setCampaign({ qualities: [] });
  }
});

test("Paranoid gives a special NPC its surprise bonus on a Hide check (p.408)", async () => {
  const kept = guard.system.npcType;
  guard.system.npcType = "special";
  await state.setCampaign({ qualities: ["paranoid"] });
  try {
    const roll = await npc.rollNpcSkill(guard, { key: "sneak", check: "hide", ability: "dex", surprise: true });
    assert.equal(roll.data.total, 4 + 4);
    const plain = await npc.rollNpcSkill(guard, { key: "sneak", check: "hide", ability: "dex" });
    assert.equal(plain.data.total, 4);
  } finally {
    guard.system.npcType = kept;
    await state.setCampaign({ qualities: [] });
  }
});

test("Omni-Competent halves Paranoid's persuasion penalty on an NPC check (p.408)", async () => {
  await state.setCampaign({ qualities: ["paranoid"] });
  try {
    let roll = await npc.rollNpcSkill(guard, { key: "notice", check: "awareness", paranoidPersuasion: true });
    assert.equal(roll.data.total, 9 + 2 - 4);
    await state.setCampaign({ qualities: ["paranoid", "omni-competent"] });
    roll = await npc.rollNpcSkill(guard, { key: "notice", check: "awareness", paranoidPersuasion: true });
    assert.equal(roll.data.total, 9 + 2 - 2);
  } finally {
    await state.setCampaign({ qualities: [] });
  }
});

test("an animal's trained qualities steady its Morale, and a check off its list warns (p.445)", async () => {
  const system = guard.system,
    kept = { type: system.npcType, effects: system.qualityEffects };
  system.npcType = "animal";
  system.qualityEffects = { skillOptions: [], trainedQualities: 2 };
  try {
    const roll = await npc.rollNpcSkill(guard, { key: "resolve", check: "morale", modifier: 0, riderCharisma: 2 });
    assert.equal(roll.data.total, 4 + 2 + 2);
    assert.equal(roll.options.error, 0);
    assert.equal(roll.options.cap, npc.npcSkillPlan(guard, "resolve").cap + 4);
    system.qualityEffects = { skillOptions: [], trainedQualities: 1 };
    const one = await npc.rollNpcSkill(guard, { key: "resolve", check: "morale", modifier: 0, riderCharisma: 2 });
    assert.equal(one.options.error, 1);
    assert.equal(one.options.cap, npc.npcSkillPlan(guard, "resolve").cap);
    const before = warnings.length;
    await npc.rollNpcSkill(guard, { key: "medicine", check: "surgery" });
    assert.match(warnings.at(-1), /Animals may not normally make/);
    await npc.rollNpcSkill(guard, { key: "athletics", check: "swim" });
    assert.equal(warnings.length, before + 1);
  } finally {
    system.npcType = kept.type;
    system.qualityEffects = kept.effects;
  }
});

test("standard NPC Damage saves accumulate, kill and reset; special NPCs are refused", async () => {
  dice(12);
  let result = await npc.npcDamageSave(guard, { damage: 8, kind: "lethal" });
  assert.deepEqual([result.dc, result.failed, guard.system.damageTrack.accumulated], [14, false, 8]);
  const combatant = (actor, defeated = false) => ({
      actor,
      defeated,
      flags: {},
      async update(change) {
        if ("defeated" in change) this.defeated = change.defeated;
        if (change["flags.spycraft2.defeatedByDamageSave"]) this.flags.spycraft2 = { defeatedByDamageSave: true };
        if ("flags.spycraft2.-=defeatedByDamageSave" in change) delete this.flags.spycraft2?.defeatedByDamageSave;
      }
    }),
    saved = combatant(guard),
    byHand = combatant(guard, true),
    keptCombats = game.combats;
  game.combats = [{ combatants: [saved] }, { combatants: [byHand] }];
  try {
    dice(3);
    result = await npc.npcDamageSave(guard, { damage: 10, kind: "lethal" });
    assert.deepEqual([result.dc, result.state], [19, "dead"]);
    assert.ok(guard.statuses.has("dead"));
    assert.equal(saved.defeated, true);
    assert.equal(await npc.npcDamageSave(guard, { damage: 1, kind: "lethal" }), false);
    assert.match(warnings.at(-1), /already dead/);
    await npc.resetDamageTrack(guard);
    assert.equal(guard.system.damageTrack.state, "active");
    assert.ok(!guard.statuses.has("dead"));
    // Reset clears the defeat the save set, and leaves the one marked by hand.
    assert.deepEqual([saved.defeated, byHand.defeated], [false, true]);
  } finally {
    game.combats = keptCombats;
  }
  await npc.npcDamageSave(boss, { damage: 5, kind: "lethal" });
  assert.match(warnings.at(-1), /Special NPCs/);
});

test("GC action dice: die type, cost, dramatic scene, promotion and healing", async () => {
  await initializeGCDice({ playersPresent: 4, caliber: 3 });
  assert.equal(gcDiceStatus().value, 10);
  dice(4, 2);
  let result = await spend.spendGCDice({ id: "boostRoll", actor: guard });
  assert.deepEqual([result.die.faces, result.die.total], [4, 6]);
  assert.equal(gcDiceStatus().value, 9);
  await spend.spendGCDice({ id: "activateThreat", actor: guard, checkKind: "attack" });
  assert.match(warnings.at(-1), /treacherous/);
  assert.equal(gcDiceStatus().value, 9);
  dice(7);
  result = await spend.spendGCDice({ id: "boostRoll", actor: boss });
  assert.equal(result.die.faces, 10);
  await spend.spendGCDice({ id: "promote", actor: guard });
  assert.equal(gcDiceStatus().value, 6);
  assert.ok(npc.npcIsSpecial(guard), "promoted for the current mission");
  const promotedRow = () =>
    state.getMission().antagonists.find(entry => entry.uuid === guard.uuid || entry.typeKey === guard.uuid);
  assert.deepEqual([promotedRow().promoted, promotedRow().scenes], [true, 1], "its XP is counted per scene");
  const promoteNote = messages.findLast(message => message.flags?.spycraft2?.undo)?.flags.spycraft2.undo;
  assert.equal(promoteNote.antagonist.id, promotedRow().id, "the Undo note can put the antagonist row back");
  assert.equal(promotedRow().encountered, true, "a promoted NPC is in play, so it has been faced");
  assert.notEqual(promoteNote.antagonist.entry?.promoted, true);
  assert.equal(promoteNote.antagonist.period, state.missionEpoch());
  {
    // Undone after a later run of the mission has begun: the row that run keeps is left alone.
    const { applyUndo } = await import("../module/apps/undo.mjs");
    const periods = game.settings.get("spycraft2", "usagePeriods"),
      rowsBefore = structuredClone(state.getMission().antagonists);
    await game.settings.set("spycraft2", "usagePeriods", { ...periods, mission: "a-later-run" });
    const stale = structuredClone({ ...promoteNote, entries: [], gcDice: 0 });
    await applyUndo({ id: "stale-promotion", flags: { spycraft2: { undo: stale } }, update: async () => null });
    assert.deepEqual(state.getMission().antagonists, rowsBefore);
    assert.match(warnings.at(-1), /later mission has begun/);
    await game.settings.set("spycraft2", "usagePeriods", periods);
  }
  await mission.changeEntry("antagonists", promotedRow().id, "scenesUp");
  assert.equal(promotedRow().scenes, 2);
  await mission.changeEntry("antagonists", promotedRow().id, "scenesDown");
  await mission.changeEntry("antagonists", promotedRow().id, "scenesDown");
  assert.equal(promotedRow().scenes, 1, "never below one scene");
  await guard.update({ "system.promotion": null });
  await npc.npcDamageSave(guard, { damage: 9, kind: "lethal" }).catch(() => {});
  await spend.spendGCDice({ id: "dramaticScene" });
  assert.equal(state.isDramaticScene(), true);
  assert.equal(gcDiceStatus().value, 2);
  await spend.spendGCDice({ id: "saveNpc", actor: boss });
  assert.match(warnings.at(-1), /dramatic scene cannot be saved/);
  dice(1, 12, 5);
  await spend.spendGCDice({ id: "boostDC" });
  assert.match(warnings.at(-1), /Name the check whose DC rises/);
  result = await spend.spendGCDice({ id: "boostDC", dcCheck: "Vault door" });
  assert.equal(result.die.total, 18, "dramatic scene: a natural 1 explodes too");
  assert.equal(state.getSceneState().dcBoostsByCheck["vault door"].count, 1, "counted against that check");
  assert.equal(
    messages.findLast(message => message.flags?.spycraft2?.undo).flags.spycraft2.undo.dcBoost.key,
    "vault door",
    "its Undo note can take the boost off the count"
  );
  await state.setSceneState({ dcBoostsByCheck: { "vault door": { name: "Vault door", count: 3 } } });
  await spend.spendGCDice({ id: "boostDC", dcCheck: "vault door" });
  assert.match(warnings.at(-1), /Only 3 action dice may boost one DC/);
  await spend.spendGCDice({ id: "saveNpc", actor: boss, fromCapture: true });
  assert.match(warnings.at(-1), /costs 2 action dice; the GC has 1/);
  await spend.setDramaticScene(false);
  assert.equal(state.isDramaticScene(), false);
});

test("a GC spend heals a special NPC's vitality or 2 wounds on the sheet, under the spend's Undo (U9)", async () => {
  await initializeGCDice({ playersPresent: 4, caliber: 3, replaceExisting: true });
  const kept = { vitality: boss.system.vitality, wounds: boss.system.wounds };
  boss.system.vitality = { value: 5, max: 30 };
  boss.system.wounds = { value: 9, max: 10 };
  dice(6);
  await spend.spendGCDice({ id: "healNpc", actor: boss });
  assert.equal(boss.system.vitality.value, 11, "vitality equal to the die by default");
  const note = messages.findLast(message => message.flags?.spycraft2?.undo).flags.spycraft2.undo;
  assert.ok(note.entries[0].restore.some(([path, value]) => path === "system.vitality.value" && value === 5));
  dice(3);
  await spend.spendGCDice({ id: "healNpc", actor: boss, healAs: "wounds" });
  assert.equal(boss.system.wounds.value, 10, "2 wounds, never past the maximum");
  assert.equal(boss.system.vitality.value, 11);
  Object.assign(boss.system, kept);
});

const makeCombat = list => {
  const combatants = new Map();
  const fight = {
    id: "c1",
    round: 1,
    started: true,
    turn: 0,
    flags: {},
    combatants: {
      get: id => combatants.get(id),
      find: fn => [...combatants.values()].find(fn),
      filter: fn => [...combatants.values()].filter(fn),
      [Symbol.iterator]: () => combatants.values()
    },
    get turns() {
      return [...combatants.values()].sort((a, b) => (b.initiative ?? -99) - (a.initiative ?? -99));
    },
    get combatant() {
      return this.turns[this.turn ?? 0];
    },
    async update(change) {
      for (const [path, value] of Object.entries(change)) {
        const keys = path.split(".");
        let target = this;
        for (const key of keys.slice(0, -1)) target = target[key] ??= {};
        target[keys.at(-1)] = value;
      }
    },
    setupTurns() {}
  };
  for (const [id, actor, initiative, playerOwned] of list) {
    const c = makeActor(id, "combatant", null, {
      name: actor.name,
      actor,
      initiative,
      parent: fight,
      hasPlayerOwner: playerOwned,
      actorId: actor.id
    });
    delete c.system;
    combatants.set(id, c);
  }
  return fight;
};

test("fluid initiative: record events, immediate actions, end-of-round application", async () => {
  const fight = makeCombat([
    ["c-a1", actors.get("a1"), 22, true],
    ["c-guard", guard, 4, false],
    ["c-boss", boss, 45, false]
  ]);
  const [hero, mook, villain] = ["c-a1", "c-guard", "c-boss"].map(id => fight.combatants.get(id));
  await combat.recordFluidEvent(hero, "aim");
  await combat.recordFluidEvent(hero, "finalAttack", { times: 2 });
  assert.equal(hero.initiative, 22, "recorded modifiers wait for the end of the round");
  assert.equal((await combat.recordFluidEvent(hero, "delay", { times: 3 })).count, 19);
  await assert.rejects(() => combat.recordFluidEvent(hero, "press"), /25 or higher/);
  assert.equal((await combat.recordFluidEvent(villain, "press")).count, 25);
  await assert.rejects(() => combat.recordFluidEvent(villain, "press"), /once per round/);
  await combat.recordFluidEvent(villain, "triumph");
  await combat.recordFluidEvent(mook, "failedStressSave");
  await combat.recordFluidEvent(hero, "regroup");
  assert.equal(hero.flags.spycraft2.fluid.modifiers.at(-1).amount, 7, "5 + Int bonus 2");
  const lines = await combat.applyEndOfRound(fight, 1);
  assert.equal(lines.length, 3);
  assert.equal(hero.initiative, 19 + 1 - 4 + 7);
  assert.equal(villain.initiative, 35);
  assert.equal(mook.initiative, 19, "4 − 5 = −1: reeling, +20");
  assert.ok(guard.statuses.has("reeling") && guard.statuses.has("flat-footed"));
  assert.match(lastMessage(), /reeling and flat-footed/);
  assert.deepEqual(hero.flags.spycraft2.fluid.modifiers, []);
  assert.equal((await combat.applyEndOfRound(fight, 1)).length, 0, "nothing is applied twice");
});

test("delaying on your own turn hands the turn to whoever is next, so nobody is skipped (p.356)", async () => {
  const fight = makeCombat([
    ["c-a1", actors.get("a1"), 22, true],
    ["c-guard", guard, 20, false],
    ["c-boss", boss, 18, false]
  ]);
  const hero = fight.combatants.get("c-a1");
  assert.equal(fight.combatant, hero);
  assert.equal((await combat.recordFluidEvent(hero, "delay", { times: 3 })).count, 19);
  assert.equal(fight.combatant.id, "c-guard", "the guard at 20 acts next; the hero acts again at 19");
  // Someone who is not acting can delay without moving the turn.
  const boss2 = fight.combatants.get("c-boss");
  fight.turn = 0;
  await combat.recordFluidEvent(boss2, "delay", { times: 1 });
  assert.equal(fight.turn, 0);
});

test("group initiative rolls NPCs only and names an agent nobody owns instead of rolling it", async () => {
  const absent = makeActor("absent", "agent", { initiative: { total: 2 } }, { name: "Absent", hasPlayerOwner: false });
  absent.hasPlayerOwner = false;
  const fight = makeCombat([
    ["g1", guard, null, false],
    ["x", absent, null, false]
  ]);
  dice(10);
  assert.equal(await combat.rollGroupInitiative(fight), 1);
  assert.equal(fight.combatants.get("x").initiative, null);
  assert.match(lastMessage(), /Not rolled, no player owns them: Absent/);
});

test("group initiative takes its d20 from the first member's own roll and holds back a member under Shaken review (F5)", async () => {
  const twin = makeActor("guard-twin", "npc", npcSystem({ initiative: { total: 5 } }), { name: "Guard twin" });
  const fight = makeCombat([
    ["g1", guard, null, false],
    ["g2", twin, null, false],
    ["g3", twin, null, false]
  ]);
  let asked = 0;
  // The first member's roll stands in for Combatant#getInitiativeRoll: a kept d20 of 14 (as Lightning Reflexes may
  // choose), plus its own bonus.
  fight.combatants.get("g1").getInitiativeRoll = () => ({
    evaluate: async () => (asked++, { total: 14 + 3, dice: [{ total: 14 }] })
  });
  fight.combatants.get("g2").getInitiativeRoll = () => ({ evaluate: async () => ({ total: 0, dice: [] }) });
  fight.combatants.get("g3").getInitiativeRoll = () => {
    throw new Error("Review the Shaken sources before rolling Initiative.");
  };
  assert.equal(await combat.rollGroupInitiative(fight, { single: true }), 1);
  assert.equal(asked, 1, "one roll for the group");
  assert.equal(fight.combatants.get("g1").initiative, 14 + 3);
  assert.equal(fight.combatants.get("g2").initiative, 14 + 5, "each member adds its own bonus");
  assert.equal(fight.combatants.get("g3").initiative, null);
  assert.match(lastMessage(), /Guard twin: not rolled \(Review the Shaken sources/);
});

test("the tracker menu entries use the Foundry 14 shape and act on the clicked row", async () => {
  const fight = makeCombat([
    ["c-a1", actors.get("a1"), 22, true],
    ["c-guard", guard, 20, false]
  ]);
  game.combat = fight;
  const entries = combat.trackerMenuEntries();
  for (const entry of entries) {
    assert.deepEqual(Object.keys(entry), ["label", "icon", "visible", "onClick"]);
    assert.match(entry.icon, /^fa-solid fa-/);
  }
  const row = { dataset: { combatantId: "c-guard" } };
  const find = label => entries.find(entry => entry.label === label);
  assert.equal(find("Spend a half action").visible(row), true);
  assert.equal(find("Readied action triggered").visible(row), false);
  await find("Delay 1 Count").onClick(null, row);
  const mook = fight.combatants.get("c-guard");
  assert.equal(mook.initiative, 19);
  // Readying costs a half action on the character's own turn; off its turn it is refused.
  assert.ok(!(await find("Ready an action").onClick(null, row)));
  assert.equal(mook.flags.spycraft2?.readied, undefined);
  fight.turn = 1;
  assert.equal(fight.combatant, mook);
  await find("Ready an action").onClick(null, row);
  assert.deepEqual(mook.flags.spycraft2.readied, { round: fight.round });
  assert.equal(combat.halfActionsLeft(mook), 1);
  assert.equal(find("Ready an action").visible(row), false);
  assert.equal(find("Readied action triggered").visible(row), true);
  // The trigger comes on the acting character's Count; the guard is already lower, so it stays put.
  await find("Readied action triggered").onClick(null, row);
  assert.equal(mook.initiative, 19);
  assert.equal(mook.flags.spycraft2.readied, null);
  game.combat = null;
});

test("group initiative makes one roll per NPC type; tie-breaks are stored", async () => {
  const twin = makeActor("guard2", "npc", npcSystem(), { name: "Guard" });
  const fight = makeCombat([
    ["g1", guard, null, false],
    ["g2", guard, null, false],
    ["b", boss, null, false],
    ["h", actors.get("a1"), null, true]
  ]);
  dice(10, 15);
  assert.equal(await combat.rollGroupInitiative(fight), 2);
  assert.deepEqual(
    ["g1", "g2", "b", "h"].map(id => fight.combatants.get(id).initiative),
    [13, 13, 18, null]
  );
  dice(4, 17);
  assert.equal(await combat.rollTiebreaks(fight), 2);
  const sorted = [fight.combatants.get("g1"), fight.combatants.get("g2")].sort(
    (a, b) => b.flags.spycraft2.tiebreak - a.flags.spycraft2.tiebreak
  );
  assert.equal(sorted[0].id, "g2");
  const Sorted = combat.fluidCombatClass(class {});
  const order = [
    { id: "x", initiative: 12, actor: { system: { initiative: { total: 1 } } }, flags: {} },
    { id: "y", initiative: 12, actor: { system: { initiative: { total: 6 } } }, flags: {} }
  ].sort(new Sorted()._sortCombatants);
  assert.equal(order[0].id, "y", "equal Counts: higher Initiative bonus first");
  void twin;
});

test("surprise round dialog flags the winners", async () => {
  const fight = makeCombat([["h", actors.get("a1"), 10, true]]);
  answer({ aware: "some", players: 14, opponents: 19, actingGroup: "opponents" });
  const result = await combat.surpriseRoundDialog(fight);
  assert.equal(result.occurs, true);
  assert.deepEqual(fight.flags.spycraft2.surprise.winners, ["opponents"]);
});

test("a Dramatic Conflict runs start to finish through the tracker", async () => {
  answer(
    { type: "chase", name: "Docks", predator: "Agents", prey: "Courier" },
    { lead: 2, p0: 6, q0: 4, p1: 3, q1: 6 }
  );
  const id = await conflicts.startConflictDialog();
  assert.equal(conflicts.conflictRows()[0].lead, 2);
  answer({ strategy: "redline", confirmOther: false }, { strategy: "outfox", confirmOther: false });
  await conflicts.advanceConflict(id);
  await conflicts.advanceConflict(id);
  assert.match(lastMessage(), /Strategies revealed/);
  answer({ predator: 24, predatorCritical: "", prey: 15, preyCritical: "", tieWinner: "" });
  await conflicts.advanceConflict(id);
  answer({ "pick-lead": 3, leadShift: "" });
  await conflicts.advanceConflict(id);
  const row = conflicts.conflictRows()[0];
  assert.deepEqual([row.lead, row.winner], [0, "predator"]);
  assert.match(lastMessage(), /Agents \(predator\) wins/);
  answer({ action: "remove", lead: 0 });
  await conflicts.manageConflict(id);
  assert.equal(conflicts.conflictRows().length, 0);
});

test("reference tools: security device, hazards, events, possessions", async () => {
  dice(11);
  answer({ id: "acid-jet", pr: 5, action: "trap", target: 10, save: 20 });
  dice(3, 3, 3, 3, 3);
  diceQueue.shift();
  await tables.securityDeviceDialog();
  assert.match(lastMessage(), /Reflex save DC 15: saved/);
  assert.match(lastMessage(), /= 15 → <b>7<\/b>/);
  answer({ hazard: "", fury: "Earthquake", cost: 1 });
  await tables.hazardLookupDialog();
  assert.match(lastMessage(), /Tremor/);
  answer({ id: "wanted" });
  await tables.eventReferenceDialog();
  assert.match(lastMessage(), /Wanted/);
  dice(20);
  answer({ id: "random-possessions-minion", count: 1 });
  await tables.randomPossessionsDialog();
  assert.equal((lastMessage().match(/20: /g) ?? []).length, 2, "the printed overlap at 20 yields both rows");
});

test("console context summarises everything without throwing", async () => {
  const context = consoleContext();
  assert.equal(context.mission.threatLevel, 6);
  assert.equal(context.mission.caliberLabel, "III");
  assert.equal(context.xp.earned, 625, "the promoted guard counts 300 for its scene");
  assert.equal(context.dice.expected, 10);
  assert.equal(context.scene.dramatic, false);
  assert.ok(Array.isArray(context.conflicts));
  if (process.env.GC_CONTEXT_OUT)
    (await import("node:fs")).writeFileSync(process.env.GC_CONTEXT_OUT, JSON.stringify(context));
});

test("removing a mission row leaves an Undo note that puts it back in its place", async () => {
  const before = state.getMission().objectives;
  assert.ok(before.length, "the test world has objectives");
  const extra = { id: "obj-extra", name: "Photograph the plans", grade: 2, complete: false, critical: false };
  await state.updateMission(m => ({ objectives: [extra, ...m.objectives] }));
  await mission.changeEntry("objectives", "obj-extra", "remove", { notify: true });
  assert.ok(!state.getMission().objectives.some(entry => entry.id === "obj-extra"));
  const note = messages.findLast(message => message.flags?.spycraft2?.undo?.missionRow);
  assert.equal(note.flags.spycraft2.undo.label, "Removed from the mission: Photograph the plans");
  const { applyUndo } = await import("../module/apps/undo.mjs");
  await applyUndo({ id: "row-undo", flags: structuredClone(note.flags), update: async () => null });
  assert.equal(state.getMission().objectives[0].id, "obj-extra", "back where it was");
  await state.updateMission(m => ({ objectives: m.objectives.filter(entry => entry.id !== "obj-extra") }));
  assert.deepEqual(state.getMission().objectives, before);
});

test("planning the next mission files the ended one in a journal entry and keeps the team and Caliber", async () => {
  const kept = structuredClone(state.getMission());
  const made = [];
  const previous = { Folder: CONFIG.Folder, JournalEntry: CONFIG.JournalEntry, folders: game.folders };
  CONFIG.Folder = { documentClass: { create: async data => (made.push(["folder", data]), { id: "f1", ...data }) } };
  CONFIG.JournalEntry = { documentClass: { create: async data => (made.push(["journal", data]), data) } };
  game.folders = [];
  try {
    await state.setMission({ ...kept, active: true, ended: false });
    assert.equal(await mission.planNextMission(), false, "an active mission is ended first");
    await state.setMission({ ...kept, active: false, ended: true, name: "Cold <Open>" });
    const entry = await mission.planNextMission();
    assert.equal(entry.name, "Cold <Open>");
    assert.equal(entry.folder, "f1");
    assert.match(entry.pages[0].text.content, /Cold &lt;Open&gt;|Objectives/);
    assert.doesNotMatch(entry.pages[0].text.content, /<Open>/, "names are escaped");
    const fresh = state.getMission();
    assert.equal(fresh.name, "");
    assert.deepEqual(fresh.team, kept.team);
    assert.equal(fresh.caliber, kept.caliber);
    assert.deepEqual(fresh.objectives, []);
  } finally {
    Object.assign(CONFIG, { Folder: previous.Folder, JournalEntry: previous.JournalEntry });
    game.folders = previous.folders;
    await state.setMission(kept);
  }
});

test("the console starts a fight with the selected tokens and adds late arrivals once", async () => {
  const { addSelectedToFight } = await import("../module/apps/gc/combat.mjs");
  const previous = { canvas: globalThis.canvas, Combat: CONFIG.Combat, combats: game.combats };
  const created = [];
  const fight = {
    scene: { id: "s1" },
    active: true,
    combatants: [],
    async createEmbeddedDocuments(type, rows) {
      created.push(...rows);
      this.combatants.push(...rows);
      return rows;
    }
  };
  CONFIG.Combat = { documentClass: { create: async () => fight } };
  game.combats = [];
  const token = id => ({ document: { id, name: `Token ${id}`, actorId: "guard", hidden: false } });
  try {
    globalThis.canvas = { scene: { id: "s1" }, tokens: { controlled: [] } };
    warnings.length = 0;
    assert.equal(await addSelectedToFight(), false, "nothing selected");
    assert.match(warnings.at(-1), /Select the tokens/);
    globalThis.canvas.tokens.controlled = [token("t1"), token("t2")];
    assert.equal(await addSelectedToFight(), fight);
    assert.deepEqual(
      created.map(row => row.tokenId),
      ["t1", "t2"]
    );
    game.combats = [fight];
    globalThis.canvas.tokens.controlled = [token("t2"), token("t3")];
    await addSelectedToFight();
    assert.deepEqual(
      created.map(row => row.tokenId),
      ["t1", "t2", "t3"],
      "a token already in the fight is not added twice"
    );
  } finally {
    globalThis.canvas = previous.canvas;
    CONFIG.Combat = previous.Combat;
    game.combats = previous.combats;
  }
});

test("season qualities save what is ticked and keep the campaign's others out", async () => {
  const kept = structuredClone(state.getCampaign());
  try {
    const id = (await import("../module/rules/gc-tables.mjs")).GC_DATA.campaignQualities[0].id;
    answer({ [`q-${id}`]: true, qualitySearch: "" });
    await mission.editSeasonQualities();
    assert.deepEqual(state.getCampaign().qualities, [id]);
  } finally {
    await state.setCampaign(kept);
  }
});

test("Undo after Add NPC takes the placed tokens and their combatants off, and nothing else", async () => {
  const { applyUndo } = await import("../module/apps/undo.mjs");
  const deleted = [];
  const holder = (type, ids) => ({
    get: id => (ids.includes(id) ? { id } : null),
    ids
  });
  const scene = {
    tokens: holder("Token", ["t1", "t2", "keep"]),
    deleteEmbeddedDocuments: async (type, ids) => deleted.push([type, ids])
  };
  const fight = {
    combatants: holder("Combatant", ["c1"]),
    deleteEmbeddedDocuments: async (type, ids) => deleted.push([type, ids])
  };
  const previous = { scenes: game.scenes, combats: game.combats };
  game.scenes = { get: id => (id === "s1" ? scene : null) };
  game.combats = Object.assign([fight], { get: id => (id === "f1" ? fight : null) });
  try {
    const flags = {
      spycraft2: {
        undo: {
          label: "Placed 2 × Guard",
          entries: [],
          placedTokens: { scene: "s1", ids: ["t1", "t2", "gone"], combat: "f1", combatants: ["c1", "c9"] }
        }
      }
    };
    await applyUndo({ id: "placed", flags, update: async () => null });
    assert.deepEqual(deleted, [
      ["Combatant", ["c1"]],
      ["Token", ["t1", "t2"]]
    ]);
  } finally {
    game.scenes = previous.scenes;
    game.combats = previous.combats;
  }
});

test("the acting block names damage only when its newest card is damage nobody applied", async () => {
  const { pendingDamageTarget } = await import("../module/apps/gc/console-turn.mjs");
  const previous = game.messages;
  const combatant = { tokenId: "t1", actor: { id: "guard" } };
  const card = flags => ({ speaker: { token: "t1" }, flags: { spycraft2: flags } });
  try {
    game.messages = [card({ checkKind: "attack" })];
    assert.equal(pendingDamageTarget(combatant), "", "an attack card is not damage");
    game.messages = [card({ checkKind: "damage", damageApplied: { a: { amount: 4 } }, superseded: true })];
    assert.equal(pendingDamageTarget(combatant), "", "a replaced card is passed over");
    game.messages = [card({ checkKind: "damage" }), { speaker: { token: "t1" }, flags: {} }];
    assert.equal(pendingDamageTarget(combatant), "", "only the newest card counts");
    // Several targeted tokens: those already hit on the card drop out, and none left means nothing pending.
    const a = { uuid: "Actor.ta", name: "Guard A", type: "npc", isOwner: true };
    const b = { uuid: "Actor.tb", name: "Guard B", type: "npc", isOwner: true };
    const keepTargets = game.user.targets;
    game.user.targets = new Set([{ actor: a }, { actor: b }]);
    try {
      game.messages = [card({ checkKind: "damage" })];
      assert.equal(pendingDamageTarget(combatant), "2 targets");
      game.messages = [card({ checkKind: "damage", damageAppliedBy: { x: { targetUuid: "Actor.ta" } } })];
      assert.equal(pendingDamageTarget(combatant), "Guard B");
      game.messages = [
        card({ checkKind: "damage", damageAppliedBy: { x: { targetUuid: "Actor.ta" }, y: { targetUuid: "Actor.tb" } } })
      ];
      assert.equal(pendingDamageTarget(combatant), "", "every target already took the damage");
    } finally {
      game.user.targets = keepTargets;
    }
  } finally {
    game.messages = previous;
  }
});

test("each view has one filled button, chosen from the state", async () => {
  const { primaryAction } = await import("../module/apps/gc/console-view.mjs");
  const base = { checklistShown: false, missionActive: true, missionEnded: false, diceCurrent: true, combat: null };
  assert.equal(primaryAction({ ...base, view: "prep", checklistShown: true }), "checklist");
  assert.equal(primaryAction({ ...base, view: "prep", missionActive: false }), "startMission");
  assert.equal(primaryAction({ ...base, view: "prep" }), "editMission");
  assert.equal(primaryAction({ ...base, view: "prep", missionActive: false, missionEnded: true }), "planNextMission");
  assert.equal(primaryAction({ ...base, view: "play", diceCurrent: false }), "beginSession");
  assert.equal(primaryAction({ ...base, view: "play" }), "nextScene");
  assert.equal(primaryAction({ ...base, view: "play", combat: { started: false, unrolled: 2 } }), "groupInitiative");
  assert.equal(primaryAction({ ...base, view: "play", combat: { started: false, unrolled: 0 } }), "nextTurn");
  assert.equal(primaryAction({ ...base, view: "wrap", combat: { started: true } }), "nextTurn");
  assert.equal(primaryAction({ ...base, view: "wrap" }), "endMission");
  assert.equal(primaryAction({ ...base, view: "wrap", missionActive: false, missionEnded: true }), "missionReport");
});

test("an acting button drawn for one combatant does nothing once the turn has moved", async () => {
  const calls = [];
  const acting = { id: "c2", name: "Colonel Dragan", actor: { uuid: "Actor.d", items: { get: () => null } } };
  const previous = game.combat;
  game.combat = { started: true, combatant: acting, nextTurn: () => calls.push("next") };
  try {
    const warned = [];
    const keep = ui.notifications.warn;
    ui.notifications.warn = message => warned.push(message);
    await GCConsole.DEFAULT_OPTIONS.actions.actingDelay.call(
      { render: () => null },
      { detail: 1 },
      { dataset: { combatant: "c1" } }
    );
    ui.notifications.warn = keep;
    assert.deepEqual(warned, ["The turn has moved to Colonel Dragan; nothing was done."]);
  } finally {
    game.combat = previous;
  }
});

test("the console picks Prep, Play or Wrap-up from the state and keeps the GC's choice for that state", async () => {
  const { consoleView, firstSessionChecklist } = await import("../module/apps/gc/console.mjs");
  assert.equal(consoleView("planning"), "prep");
  assert.equal(consoleView("active"), "play");
  assert.equal(consoleView("combat"), "play");
  assert.equal(consoleView("ended"), "wrap");
  assert.equal(consoleView("active", { view: "prep", state: "active" }), "prep");
  assert.equal(consoleView("combat", { view: "prep", state: "active" }), "play", "a fight brings Play back");
  assert.equal(consoleView("active", { view: "nonsense", state: "active" }), "play");
  assert.equal(
    consoleView("combat", { view: "prep", state: "combat", key: "fight1" }, "fight2"),
    "play",
    "a choice made in one fight does not hide Combat in the next"
  );
  assert.equal(consoleView("combat", { view: "prep", state: "combat", key: "fight1" }, "fight1"), "prep");
  const context = consoleContext();
  assert.equal(context.view, "play");
  assert.equal(context.hiddenSections.combat, false);
  assert.equal(context.hiddenSections.campaign, true);
  assert.match(context.status.dice, /left of 10|none until Begin session/);
  assert.equal(context.status.missionState, "active");

  const blank = firstSessionChecklist({ mission: { objectives: [] }, diceCurrent: false, npcActors: 0 });
  assert.deepEqual([blank.done, blank.total, blank.complete], [0, 6, false]);
  assert.equal(blank.steps.find(step => step.next).id, "mission");
  const ready = firstSessionChecklist({
    mission: { name: "Cold Open", objectives: [{}], active: true },
    diceCurrent: true,
    npcActors: 2,
    combatSeen: false
  });
  assert.equal(ready.steps.find(step => step.next).id, "combat");
  assert.equal(
    firstSessionChecklist({
      ...{ mission: { name: "x", objectives: [{}], ended: true } },
      diceCurrent: true,
      npcActors: 1,
      combatSeen: true
    }).complete,
    true
  );
});

test("the Combat section names the acting combatant, words each row and finds the mobs", async () => {
  const turnTools = await import("../module/apps/gc/console-turn.mjs");
  const twin = makeActor("guard", "npc", npcSystem(), { name: "Guard" });
  const fight = makeCombat([
    ["h", actors.get("a1"), 22, true],
    ["g1", guard, 15, false],
    ["g2", twin, 15, false],
    ["b", boss, null, false]
  ]);
  fight.combatants.get("g2").isDefeated = false;
  const acting = turnTools.actingBlock(fight);
  assert.equal(acting.name, "a1");
  assert.equal(acting.halfActions, "2 half actions left");
  assert.equal(acting.npc, false);
  // The combat outcomes the sheets offer, each settled by a function of that name (U2).
  assert.deepEqual(
    acting.outcomes.map(row => row.step),
    turnTools.ACTING_OUTCOMES.map(([step]) => step)
  );
  for (const [step, , load] of turnTools.ACTING_OUTCOMES) assert.equal(typeof (await load())[step], "function", step);
  const rows = turnTools.combatRows(fight);
  assert.deepEqual(
    rows.map(row => [row.id, row.count, row.current]),
    [
      ["h", "Count 22", true],
      ["g1", "Count 15", false],
      ["g2", "Count 15", false],
      ["b", "not rolled", false]
    ]
  );
  // Two combatants named alike are numbered in turn order; a unique name stays as it is.
  assert.deepEqual(
    rows.map(row => row.name),
    ["a1", "Guard #1", "Guard #2", fight.combatants.get("b").name]
  );
  const mobs = turnTools.mobGroups(fight);
  assert.deepEqual(
    mobs.map(group => [group.key, group.count]),
    [["guard", 2]]
  );
  fight.combatants.get("g2").isDefeated = true;
  assert.equal(turnTools.mobGroups(fight).length, 0, "one standing guard is not a mob");
  assert.match(turnTools.combatRows(fight)[2].notes, /defeated/);
  assert.deepEqual(turnTools.shareTargets(["a", "b", "c"], ["x", "y"]), [
    ["a", "x"],
    ["b", "y"],
    ["c", "x"]
  ]);
  assert.deepEqual(turnTools.shareTargets(["a"], []), []);
  // One Next for the group: the turn moves on until it leaves the mob.
  fight.combatants.get("g2").isDefeated = false;
  fight.turn = 1;
  fight.nextTurn = async function () {
    this.turn++;
  };
  assert.equal(await turnTools.passGroup(fight, [fight.combatants.get("g1"), fight.combatants.get("g2")]), 2);
  assert.equal(fight.combatant.id, "b"); // Off the group's own turn the mob does not attack.
  assert.ok(!(await turnTools.mobAttackDialog(fight, "guard")), "the turn is someone else's");
  // Weapons are matched by item, and a member who lacks the weapon is named.
  const knife = { id: "w1", name: "Knife", type: "weapon", system: { proficiency: "edged" } };
  guard.items = [knife];
  twin.items = [];
  const [weapon] = turnTools.mobWeapons([fight.combatants.get("g1"), fight.combatants.get("g2")]);
  assert.equal(weapon.items.get("g1"), knife);
  assert.deepEqual(
    weapon.without.map(member => member.id),
    ["g2"]
  );
  // Only the members on the acting Count attack now; one on a later Count acts on its own turn.
  fight.turn = 1;
  assert.deepEqual(
    turnTools.mobAttackers(fight, turnTools.mobGroups(fight)[0]).map(member => member.id),
    ["g1", "g2"]
  );
  fight.combatants.get("g2").initiative = 10;
  assert.deepEqual(
    turnTools.mobAttackers(fight, { members: [fight.combatants.get("g1"), fight.combatants.get("g2")] }).map(m => m.id),
    ["g1"]
  );
  fight.combatants.get("g2").initiative = 15;
  // Allies on the mob's side are not offered as targets.
  for (const [id, disposition] of [
    ["h", 1],
    ["g1", -1],
    ["g2", -1],
    ["b", -1]
  ])
    fight.combatants.get(id).token = { id: `t-${id}`, disposition };
  assert.deepEqual(
    turnTools.mobFoes(fight, turnTools.mobGroups(fight)[0]).map(foe => foe.id),
    ["h"]
  );
  assert.equal(turnTools.mobAttackBlocked(fight, turnTools.mobGroups(fight)[0]), "");
  delete guard.items;
  delete twin.items;
  for (const id of ["h", "g1", "g2", "b"]) delete fight.combatants.get(id).token;
});

test("a Count that changes off-turn leaves the turn with the character who was acting", async () => {
  const { keepActingTurn } = await import("../module/apps/gc/combat.mjs");
  const order = ["x", "b", "r"].map(id => ({ id }));
  const fight = {
    id: "keep",
    started: true,
    turn: 1,
    turns: order,
    get combatant() {
      return this.turns[this.turn];
    },
    updates: [],
    async update(change, options) {
      this.updates.push([change, options?.spycraft2KeepTurn]);
      Object.assign(this, change);
    }
  };
  // First sight: the acting character is learned, nothing is written.
  assert.equal(await keepActingTurn(fight), null);
  assert.deepEqual(fight.updates, []);
  // R's readied action goes off and R now sorts ahead of B: place 1 is R, but B is still acting.
  fight.turns = ["x", "r", "b"].map(id => ({ id }));
  await keepActingTurn(fight);
  assert.deepEqual(fight.updates, [[{ turn: 2 }, true]]);
  assert.equal(fight.combatant.id, "b");
  // The acting character steps down on purpose: the turn passes to whoever stands in its place.
  fight.turns = ["x", "r", "q", "b"].map(id => ({ id }));
  await keepActingTurn(fight, { handOver: true });
  assert.equal(fight.updates.length, 1);
  assert.equal(fight.combatant.id, "q");
  fight.turns = ["q", "x", "r", "b"].map(id => ({ id }));
  await keepActingTurn(fight);
  assert.deepEqual(fight.updates.at(-1), [{ turn: 0 }, true]);
});

test("console sections open for the state in play and keep the GC's choice until that state changes", () => {
  const planning = consoleSections({ missionActive: false, combat: false, conflictsRunning: false });
  assert.equal(planning.mission.open, true);
  assert.equal(planning.combat.open, false);
  assert.equal(planning.clock.open, false);
  const fighting = consoleSections({ missionActive: true, combat: true, conflictsRunning: true });
  assert.equal(fighting.mission.open, false);
  assert.equal(fighting.combat.open, true);
  assert.equal(fighting.conflicts.open, true);
  // Closing Combat during a fight sticks for that fight, but the next combat opens it again.
  const closed = { combat: { state: "running", open: false }, clock: { state: "always", open: true } };
  assert.equal(consoleSections({ missionActive: true, combat: true }, closed).combat.open, false);
  // Between fights Combat opens again, so Start a fight is in sight.
  assert.equal(consoleSections({ missionActive: true, combat: false }, closed).combat.open, true);
  assert.equal(
    consoleSections({ missionActive: true, combat: true }, { combat: { state: "idle", open: false } }).combat.open,
    true
  );
  assert.equal(consoleSections({ missionActive: true, combat: false }, closed).clock.open, true);
});

test("a new scene returns to standard; players cannot change GC state", async () => {
  await spend.setDramaticScene(true);
  assert.equal(state.isDramaticScene(), true);
  await game.settings.set("spycraft2", "usagePeriods", { scene: "scene-2" });
  assert.equal(state.isDramaticScene(), false);
  game.user.isGM = false;
  await assert.rejects(() => state.setMission({}), /Only the GC/);
  game.user.isGM = true;
});

test("GC console registers a GM-only sidebar tab and opens the shared sidebar instance", async () => {
  const previousUI = CONFIG.ui;
  CONFIG.ui = {
    sidebar: class {
      static TABS = { chat: {}, combat: {}, scenes: { gmOnly: true } };
    }
  };
  try {
    registerGCConsoleTab();
    registerGCConsoleTab();
    assert.equal(CONFIG.ui.gc, GCConsole);
    // Beside the tracker it works with; Chat keeps its place at the front.
    assert.deepEqual(Object.keys(CONFIG.ui.sidebar.TABS), ["chat", "combat", "gc", "scenes"]);
    assert.equal(CONFIG.ui.sidebar.TABS.gc.gmOnly, true);
    const calls = [];
    ui.gc = {
      async render(options) {
        calls.push(["render", options]);
      },
      activate() {
        calls.push(["activate"]);
      }
    };
    // With no pop-out to offer, the console opens in the sidebar.
    assert.equal(await openGCConsole(), ui.gc);
    assert.equal(game.spycraft2.gc.console, ui.gc);
    assert.deepEqual(calls, [["render", { force: true }], ["activate"]]);
    // By default it opens as a window, so the chat log stays in the sidebar.
    const popout = { bringToFront: () => calls.push(["front"]) };
    ui.gc.renderPopout = async () => (calls.push(["popout"]), popout);
    assert.equal(await openGCConsole(), popout);
    assert.deepEqual(calls.slice(2), [["popout"], ["front"]]);
    assert.equal(await openGCConsole({ window: false }), ui.gc);
    calls.splice(2);
    delete ui.gc.renderPopout;
    game.user.isGM = false;
    assert.equal(GCConsole.prototype._canRender({}), false);
    await openGCConsole();
    assert.equal(calls.length, 2, "player requests cannot open the console");
  } finally {
    CONFIG.ui = previousUI;
    game.user.isGM = true;
    delete ui.gc;
    game.spycraft2.gc.console = null;
  }
});

test("a dramatic scene doubles hostile combatants only (p.424)", () => {
  assert.equal(spend.dramaticOpponent({ hasPlayerOwner: false, token: { disposition: -1 } }), true);
  assert.equal(spend.dramaticOpponent({ hasPlayerOwner: false, token: { disposition: 1 } }), false, "an ally");
  assert.equal(spend.dramaticOpponent({ hasPlayerOwner: false, token: { disposition: 0 } }), false, "neutral");
  assert.equal(spend.dramaticOpponent({ hasPlayerOwner: true, token: { disposition: -1 } }), false);
  assert.equal(spend.dramaticOpponent({ hasPlayerOwner: false }), true, "no token: any NPC");
});

test("an agent's Triumph since the mission began ticks the settlement's Triumph box (p.331)", async () => {
  const saved = state.getMission();
  await state.updateMission({ active: true, startedAt: 1000 });
  try {
    game.messages = [{ timestamp: 2000, speaker: { actor: "guard" }, flags: { spycraft2: { triumphed: true } } }];
    assert.equal(missionSettlementDefaults().triumph, false, "an NPC's Triumph does not count");
    game.messages.push({ timestamp: 500, speaker: { actor: "a1" }, flags: { spycraft2: { triumphed: true } } });
    assert.equal(missionSettlementDefaults().triumph, false, "one from before the mission does not count");
    game.messages.push({ timestamp: 2000, speaker: { actor: "a1" }, flags: { spycraft2: { triumphed: true } } });
    assert.equal(missionSettlementDefaults().triumph, true);
    // An agent who is not on the mission's team does not count.
    await state.updateMission({ team: ["a2"] });
    assert.equal(missionSettlementDefaults().triumph, false, "a1 is not on this team");
    await state.updateMission({ team: ["a1", "a2"] });
    assert.equal(missionSettlementDefaults().triumph, true);
  } finally {
    delete game.messages;
    await state.setMission(saved);
  }
});

test("End mission can record exposure for a critical objective left undone (pp.435–436)", async () => {
  const saved = state.getMission(),
    before = actors.get("a1").system.reputation;
  await state.setMission({
    ...saved,
    active: true,
    ended: false,
    objectives: [{ id: "c1", name: "Recover the ledger", grade: 2, critical: true, complete: false, scenes: 1 }],
    infractions: []
  });
  try {
    dialogAnswers.push({ countFinalScene: false, recordCritical: true });
    assert.equal(await mission.endMission(), true);
    assert.equal(actors.get("a1").system.reputation, before - 2, "Grade II costs 2 Reputation");
    assert.equal(state.getMission().infractions.length, state.teamActors().length);
    // Resume and End again: the objective already charged is not charged a second time.
    await mission.resumeMission();
    dialogAnswers.push({ countFinalScene: false, recordCritical: true });
    assert.equal(await mission.endMission(), true);
    assert.equal(actors.get("a1").system.reputation, before - 2, "charged once per mission");
    assert.equal(state.getMission().infractions.length, state.teamActors().length);
    // Undo gives the standing back and takes off only the rows it added, so End can charge them again.
    await state.updateMission(m => ({ infractions: [...m.infractions, { id: "other", actor: "a2", penalty: -1 }] }));
    const note = messages.findLast(message => message.flags?.spycraft2?.undo?.addedInfractions);
    const { applyUndo } = await import("../module/apps/undo.mjs");
    await applyUndo({ id: "exposure-undo", flags: structuredClone(note.flags), update: async () => null });
    assert.equal(actors.get("a1").system.reputation, before);
    assert.deepEqual(
      state.getMission().infractions.map(entry => entry.id),
      ["other"]
    );
    await mission.resumeMission();
    dialogAnswers.push({ countFinalScene: false, recordCritical: true });
    await mission.endMission();
    assert.equal(actors.get("a1").system.reputation, before - 2, "charged again after Undo");
    // An objective ticked complete while the End dialog is open is not charged.
    for (const actor of state.teamActors()) await actor.update({ "system.reputation": before });
    await state.setMission({ ...state.getMission(), active: true, ended: false, infractions: [] });
    dialogAnswers.push(async () => {
      await state.updateMission(m => ({ objectives: m.objectives.map(o => ({ ...o, complete: true })) }));
      return { countFinalScene: false, recordCritical: true };
    });
    await mission.endMission();
    assert.equal(actors.get("a1").system.reputation, before, "completed while the dialog was open");
    assert.deepEqual(state.getMission().infractions, []);
  } finally {
    for (const actor of state.teamActors()) await actor.update({ "system.reputation": before });
    await state.setMission(saved);
  }
});

test("a mission Caliber increase reaches the team's reserves, with an Undo, and reminds them of the swap (p.398)", async () => {
  const saved = state.getMission(),
    a1 = actors.get("a1"),
    a2 = actors.get("a2"),
    before = { a1: structuredClone(a1.system), a2: structuredClone(a2.system) };
  try {
    await state.setMission({ ...saved, active: true, ended: false, caliber: 1, team: ["a1", "a2"] });
    a1.system.usagePeriods = { mission: "m1" };
    a1.system.missionReserves = { epoch: "m1", caliber: 1, picks: { W: 1 }, spent: {}, common: 0 };
    a2.system.usagePeriods = { mission: "m1" };
    delete a2.system.missionReserves;
    const start = messages.length;
    assert.equal(await spend.recordCaliberIncrease(3), 2);
    assert.equal(state.getMission().caliber, 3);
    assert.equal(a1.system.missionReserves.caliber, 3);
    assert.equal(a2.system.missionReserves, undefined, "no reserves yet: nothing to raise");
    const posted = messages.slice(start);
    const undo = posted.find(m => m.flags?.spycraft2?.undo);
    assert.equal(undo?.flags.spycraft2.undo.entries.length, 1, "an Undo note for the one agent changed");
    assert.ok(posted.some(m => /Mission Caliber is now III/.test(m.content) && /p\.398/.test(m.content)));
  } finally {
    await state.setMission(saved);
    a1.system = before.a1;
    a2.system = before.a2;
  }
});

test("a mission's start rolls liquidation for each targeted agent and keeps the count, with an Undo (p.440)", async () => {
  const a3 = actors.get("a3"),
    a4 = actors.get("a4"),
    before = { a3: a3.system.reputation, a4: a4.system.reputation, flags3: a3.flags, flags4: a4.flags };
  try {
    a3.system.reputation = -25;
    a3.flags = { spycraft2: { liquidationMissions: 1 } };
    a4.flags = { spycraft2: { liquidationMissions: 2 } };
    const start = messages.length;
    dice(6);
    const results = await mission.rollLiquidations([a3, a4]);
    assert.deepEqual(results, [{ actor: "a3", missions: 2, total: 6, target: 6, marked: true }]);
    assert.equal(a3.flags.spycraft2.liquidationMissions, 2);
    assert.equal(a4.flags.spycraft2.liquidationMissions, 0, "no longer targeted: the run of missions ends");
    const posted = messages.slice(start);
    assert.ok(posted.some(m => /Marked for Death: a3 is the target/.test(m.content)));
    assert.ok(posted.some(m => m.flags?.spycraft2?.undo));
    assert.deepEqual(await mission.rollLiquidations([a4]), [], "nothing to roll or clear");
  } finally {
    a3.system.reputation = before.a3;
    a4.system.reputation = before.a4;
    a3.flags = before.flags3;
    a4.flags = before.flags4;
  }
});

test("round-3 council: an NPC card's critical is priced like an agent's, a free one spends nothing, and the card text is rebuilt", async () => {
  const { gcActivateThreat } = await import("../module/apps/gc/npc-card-dice.mjs");
  const card = check => ({
    flags: { spycraft2: { checkKind: "attack", threatConfirmed: true, rawTotal: 20, effectiveTotal: 20, ...check } },
    async update(patch) {
      this.patch = patch;
      for (const [path, value] of Object.entries(patch))
        if (path.startsWith("flags.spycraft2.")) this.flags.spycraft2[path.slice(16)] = value;
    }
  });
  const before = gcDiceStatus().value;
  // Laser damage takes the 1-die wounds critical to 0: recorded without a spend.
  const laser = card({ attackContext: { laser: true } });
  assert.equal(await gcActivateThreat(laser, boss, { preset: "hit.wounds" }), true);
  assert.equal(laser.flags.spycraft2.criticalActivation.cost, 0);
  assert.deepEqual(laser.flags.spycraft2.criticalActivation.sources, ["Laser damage –1"]);
  assert.equal(typeof laser.patch.flavor, "string", "the card's text is rebuilt");
  assert.equal(gcDiceStatus().value, before);
  // Tough Luck adds a die to what the GC pays.
  const marked = card({ blackCat: { toughLuck: true } });
  assert.equal(await gcActivateThreat(marked, boss, { preset: "hit.wounds" }), true);
  assert.equal(marked.flags.spycraft2.criticalActivation.cost, 2);
  assert.equal(gcDiceStatus().value, before - 2);
  // A standard NPC without treacherous gets no laser discount and no critical.
  const plain = card({ attackContext: { laser: true } });
  assert.equal(await gcActivateThreat(plain, guard, { preset: "hit.wounds" }), null);
  assert.equal(plain.flags.spycraft2.criticalSuccess, undefined);
});

// Last: it begins a session, which later tests do not expect.
test("Begin session sets the GC pool from the player characters present, not the whole team", async () => {
  const { gcDiceStatus } = await import("../module/services/gc-dice.mjs");
  answer({ present: 1 });
  assert.equal(await mission.beginSession(), true);
  assert.equal(gcDiceStatus().playersPresent, 1);
  assert.equal(gcDiceStatus().value, 1 + 2 * state.getMission().caliber);
});

test("Previous turn passes over a defeated combatant", async () => {
  const { stepBackTurn } = await import("../module/apps/gc/combat.mjs");
  const calls = [];
  const fight = {
    started: true,
    round: 2,
    turn: 2,
    turns: [{ isDefeated: false }, { isDefeated: true }, { isDefeated: false }],
    update: async (change, options) => calls.push(["update", change, options]),
    previousTurn: async () => calls.push(["previous"])
  };
  await stepBackTurn(fight);
  assert.deepEqual(calls, [["update", { turn: 0 }, { direction: -1 }]]);
  fight.turn = 0;
  await stepBackTurn(fight);
  assert.deepEqual(calls.at(-1), ["previous"]);
});

test("an NPC dropped on an organization row is linked once and can be unlinked", async () => {
  const orgs = await import("../module/apps/gc/organizations.mjs");
  const id = await (async () => {
    const all = state.getOrganizations();
    const key = "orgLinkTest";
    await state.saveOrganization(key, { ...(Object.values(all)[0] ?? {}), name: "Directorate", npcs: [] });
    return key;
  })();
  const npc = { type: "npc", uuid: "Actor.linkme", name: "Handler" };
  assert.equal(await orgs.linkOrganizationNpc(id, npc), "Actor.linkme");
  assert.equal(await orgs.linkOrganizationNpc(id, npc), null);
  assert.deepEqual(state.getOrganizations()[id].npcs, [{ uuid: "Actor.linkme", name: "Handler" }]);
  assert.deepEqual(orgs.organizationRows().find(row => row.id === id).npcs, [
    { uuid: "Actor.linkme", name: "Handler" }
  ]);
  await orgs.unlinkOrganizationNpc(id, "Actor.linkme");
  assert.deepEqual(state.getOrganizations()[id].npcs, []);
  await state.saveOrganization(id, null);
});

test("Edit on a mission row replaces that row in place and keeps its marks", async () => {
  const objective = { id: "objEdit", name: "Old", grade: 1, critical: false, complete: true, scenes: 1 };
  const row = {
    id: "antEdit",
    uuid: null,
    typeKey: null,
    name: "Thug",
    xp: 10,
    type: "standard",
    full: false,
    scenes: 1,
    encountered: true
  };
  await state.updateMission(m => ({ objectives: [...m.objectives, objective], antagonists: [...m.antagonists, row] }));
  answer({ sample: "", name: "Steal the plans", grade: 3, critical: true });
  await mission.editObjective("objEdit");
  const saved = state.getMission().objectives.find(entry => entry.id === "objEdit");
  assert.deepEqual([saved.name, saved.grade, saved.critical, saved.complete], ["Steal the plans", 3, true, true]);
  answer({ uuid: "", name: "Enforcer", xp: 40, type: "special", full: false, scenes: 1 });
  await mission.editAntagonist("antEdit");
  const edited = state.getMission().antagonists.find(entry => entry.id === "antEdit");
  assert.deepEqual([edited.name, edited.xp, edited.type, edited.encountered], ["Enforcer", 40, "special", true]);
  assert.equal(state.getMission().antagonists.filter(entry => entry.id === "antEdit").length, 1);
  // A row recorded from a compendium NPC keeps its link through a name-only edit.
  const linked = { ...row, id: "antPack", uuid: "Compendium.x.npcs.Actor.p1", typeKey: "Compendium.x.npcs.Actor.p1" };
  await state.updateMission(m => ({ antagonists: [...m.antagonists, linked] }));
  answer({ uuid: "", name: "Renamed", xp: 10, type: "", full: false, scenes: 1 });
  await mission.editAntagonist("antPack");
  const kept = state.getMission().antagonists.find(entry => entry.id === "antPack");
  assert.deepEqual([kept.name, kept.uuid, kept.typeKey], ["Renamed", linked.uuid, linked.typeKey]);
  await state.updateMission(m => ({
    objectives: m.objectives.filter(entry => entry.id !== "objEdit"),
    antagonists: m.antagonists.filter(entry => !["antEdit", "antPack"].includes(entry.id))
  }));
});

test("campaign qualities say whether the system applies them, and effect keys read as words", async () => {
  const { qualityHandling, effectLabel } = await import("../module/apps/gc/console-view.mjs");
  assert.equal(qualityHandling({ effects: { gearCaliberShift: 1, wealthBonus: 4 } }), "auto");
  assert.equal(qualityHandling({ effects: { goodAndEvil: true } }), "hand");
  assert.equal(qualityHandling({ effects: { goodAndEvil: true, attackModifier: 1 } }), "partly");
  assert.equal(effectLabel("gearCaliberShift"), "gear Caliber shift");
});

test("the fluid event dialog finds an event's refusal before closing", async () => {
  const { fluidEventRefusal } = await import("../module/apps/gc/combat.mjs");
  const fight = { round: 1 };
  const unrolled = { name: "Guard", isOwner: true, initiative: null, parent: fight, flags: {} };
  assert.match(fluidEventRefusal(unrolled, "press", {}), /not rolled Initiative/);
  assert.match(fluidEventRefusal({ ...unrolled, isOwner: false }, "press", {}), /do not control/);
  const pressed = {
    ...unrolled,
    initiative: 30,
    flags: { spycraft2: { fluid: { round: 1, pressed: true, modifiers: [] } } }
  };
  assert.notEqual(fluidEventRefusal(pressed, "press", {}), "");
  assert.equal(fluidEventRefusal({ ...pressed, flags: {} }, "press", {}), "");
});

test("objectives typed as lines read a leading grade and a closing ! for critical", async () => {
  assert.deepEqual(
    mission.parseObjectiveLines("3 Steal the plans !\n- Photograph the courier\n\n5: Free the asset\n9 lives"),
    [
      { name: "Steal the plans", grade: 3, critical: true },
      { name: "Photograph the courier", grade: 1, critical: false },
      { name: "Free the asset", grade: 5, critical: false },
      { name: "9 lives", grade: 1, critical: false }
    ]
  );
  const before = state.getMission().objectives.length;
  assert.equal(await mission.addObjectiveLines("2 Tap the line\n4 Burn the files !"), 2);
  const added = state.getMission().objectives.slice(before);
  assert.deepEqual(
    added.map(entry => [entry.name, entry.grade, entry.critical, entry.complete]),
    [
      ["Tap the line", 2, false, false],
      ["Burn the files", 4, true, false]
    ]
  );
  assert.equal(await mission.addObjectiveLines("   \n"), 0);
  await state.updateMission(m => ({ objectives: m.objectives.slice(0, before) }));
});

test("an objective half typed in the inline field survives a console redraw", async () => {
  const { captureConsoleState, restoreConsoleState } = await import("../module/apps/gc/console.mjs");
  const keep = globalThis.document;
  globalThis.document = { activeElement: null };
  try {
    const root = field => ({
      querySelector: selector => (selector === "input[name='quickObjective']" ? field : null),
      querySelectorAll: () => [],
      contains: () => false,
      scrollHeight: 0,
      clientHeight: 0
    });
    const kept = captureConsoleState(root({ value: "3 Tap the line" }));
    assert.equal(kept.draft, "3 Tap the line");
    const fresh = { value: "" };
    restoreConsoleState(root(fresh), kept);
    assert.equal(fresh.value, "3 Tap the line");
  } finally {
    globalThis.document = keep;
  }
});

test("the inline objective gives its words back when the save fails", async () => {
  const field = { value: "2 Tap the line", focus() {} };
  const target = { closest: () => ({ querySelector: () => field }) };
  const context = { element: { querySelector: () => field }, render() {} };
  const warned = [];
  const warn = ui.notifications.warn;
  ui.notifications.warn = message => warned.push(message);
  const settings = game.settings.set;
  game.settings.set = async () => {
    throw new Error("Setting refused");
  };
  try {
    await GCConsole.DEFAULT_OPTIONS.actions.quickObjective.call(context, { detail: 0 }, target);
  } finally {
    game.settings.set = settings;
    ui.notifications.warn = warn;
  }
  assert.equal(field.value, "2 Tap the line");
  assert.deepEqual(warned, ["Setting refused"]);
});
