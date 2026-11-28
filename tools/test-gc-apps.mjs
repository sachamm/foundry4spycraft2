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
      const key = keys.at(-1);
      if (key.startsWith("-=")) delete target[key.slice(2)];
      else target[key.replace(/^==/, "")] = structuredClone(value);
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
          return dialogAnswers.shift();
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
    const message = {
      ...data,
      id: `message${++idCounter}`,
      uuid: `ChatMessage.message${idCounter}`,
      isOwner: true,
      async update(change) {
        for (const [path, value] of Object.entries(change)) {
          const keys = path.split(".");
          let target = this;
          for (const key of keys.slice(0, -1)) target = target[key] ??= {};
          const key = keys.at(-1);
          if (key.startsWith("-=")) delete target[key.slice(2)];
          else target[key.replace(/^==/, "")] = structuredClone(value);
        }
      }
    };
    messages.push(message);
    return message;
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
  survivalStats: { resistances: {}, resistanceSources: [] },
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
  assert.deepEqual(missionSettlementDefaults(), { baseXP: 0, threatLevel: null });
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
  assert.deepEqual(missionSettlementDefaults(), { baseXP: 325, threatLevel: 6 });
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
  assert.match(lastMessage(), /to a3, a4\./);
  answer({ currency: "reputation", again: true });
  await mission.awardStanding();
  assert.equal(actors.get("a2").system.reputation, 26, "the correction pays everyone");
  for (const id of ["a2", "a3", "a4"]) await actors.get(id).update({ "system.reputation": 14 });
});

test("mission teams exclude agent-built companions and an invalid explicit list never substitutes unlisted PCs", () => {
  const companion = makeActor("team-companion", "agent", { level: 10, companionOf: { ownerUuid: "Actor.a1" } });
  actors.set(companion.id, companion);
  try {
    assert.equal(
      state.teamActors({ team: [] }).some(a => a.id === companion.id),
      false
    );
    assert.deepEqual(state.teamActors({ team: [companion.id] }), []);
    assert.deepEqual(state.teamActors({ team: ["missing"] }), []);
    assert.deepEqual(
      state.teamActors({ team: ["a1", companion.id] }).map(a => a.id),
      ["a1"]
    );
  } finally {
    actors.delete(companion.id);
  }
});

test("Hybrid standing pays each affiliation's currency and conflicting Faction selections stop the whole payout", async () => {
  const savedMission = structuredClone(state.getMission()),
    savedCampaign = structuredClone(state.getCampaign());
  const a = actors.get("a1"),
    b = actors.get("a2");
  const before = [structuredClone(a.system), structuredClone(b.system)];
  try {
    await state.setCampaign({ qualities: ["hybrid"] });
    await state.setMission({ ...savedMission, team: [a.id, b.id], standingPaid: {} });
    Object.assign(a.system, { affiliationType: "faction", reputation: 0, netWorth: 0 });
    Object.assign(b.system, { affiliationType: "freelance", reputation: 0, netWorth: 0 });
    answer({ currency: "automatic" });
    await mission.awardStanding();
    assert.ok(a.system.reputation > 0);
    assert.equal(a.system.netWorth, 0);
    assert.ok(b.system.netWorth > 0);
    assert.equal(b.system.reputation, 0);
    assert.equal(state.getMission().standingPaid[a.id].currency, "reputation");
    assert.equal(state.getMission().standingPaid[b.id].currency, "netWorth");
    const freelancerMoney = b.system.netWorth;
    answer({
      actor: b.id,
      infraction: "adhere-to-honor-code|0",
      currency: "reputation",
      preventing: false,
      honor: false
    });
    await mission.recordInfraction();
    assert.ok(b.system.netWorth < freelancerMoney, "Exposure uses the same affiliation policy");
    assert.equal(b.system.reputation, 0);
    await state.setCampaign({ qualities: ["faction"] });
    await state.updateMission({ standingPaid: {} });
    const aRep = a.system.reputation;
    answer({ currency: "automatic" });
    assert.equal(await mission.awardStanding(), false);
    assert.equal(a.system.reputation, aRep, "All affiliations are checked before paying anyone");
    assert.deepEqual(state.getMission().standingPaid, {});
    assert.match(warnings.at(-1), /requires Faction/);
    b.system.affiliationType = "faction";
    await state.setCampaign({ qualities: ["faction", "freelance"] });
    answer({ currency: "automatic" });
    assert.equal(await mission.awardStanding(), false);
    assert.match(warnings.at(-1), /conflicting affiliation/);
  } finally {
    a.system = before[0];
    b.system = before[1];
    await state.setCampaign(savedCampaign);
    await state.setMission(savedMission);
  }
});

test("End mission asks first, keeps the record for settlement, and Resume reopens it unchanged", async () => {
  confirmAnswers.push(false);
  assert.equal(await mission.endMission(), null);
  assert.equal(state.getMission().active, true, "cancelled");
  assert.equal(await mission.endMission(), true);
  let m = state.getMission();
  assert.deepEqual([m.active, m.ended], [false, true]);
  assert.match(lastMessage(), /ended/);
  assert.deepEqual(missionSettlementDefaults(), { baseXP: 325, threatLevel: 6 }, "settlement still has the totals");
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
  confirmAnswers.push(async () => {
    await mission.changeEntry("objectives", id, "complete");
    return true;
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
  await mission.endMission();
  confirmAnswers.push(false);
  assert.equal(await mission.startMission(), null);
  assert.equal(state.getMission().objectives[0].complete, true, "cancelled: nothing cleared");
  await mission.startMission();
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
  a1.system.actionDice.value = kept.value;
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

test("NPC ordinary Grapple records actual proficiency time, error and Size without inventing an attack penalty", async () => {
  const base = { key: "athletics/grapple", ability: "str", grappleContextConfirmed: true, grappleSizeDifference: 0 };
  const trained = await npc.rollNpcSkill(guard, { ...base, grappleProficient: true });
  const untrained = await npc.rollNpcSkill(guard, { ...base, grappleProficient: false, grappleSizeDifference: 2 });
  assert.equal(untrained.options.error, trained.options.error + 2);
  assert.equal(untrained.data.total, trained.data.total + 8);
  assert.equal(untrained.options.grappleFeats.proficiency.fullActions, 2);
  assert.equal(untrained.options.npcSkillContext.restraint.proficient, false);
  assert.equal(untrained.options.restraintEscape, null);
  assert.equal(untrained.options.skillTiming.multiplier, 1);
  assert.equal(untrained.options.skillTiming.policy, "additive-one-reduction");
});

test("NPC named Grapple applies second-hold, Mute, conversion and armor penalties with recorded evidence", async () => {
  const oldArmor = guard.system.armor;
  guard.system.armor = { check: -3 };
  const roll = await npc.rollNpcSkill(guard, {
    key: "athletics/grapple",
    grappleProficient: true,
    grappleContextConfirmed: true,
    grappleSizeDifference: 0,
    ability: "str",
    grappleHoldingTwo: true,
    grappleSecondOpponent: true,
    grappleMuting: true,
    grappleDamageConversion: true
  });
  assert.equal(roll.data.total, 4 - 4 - 2 - 4 - 3);
  assert.equal(roll.options.grappleFeats.second, true);
  assert.equal(roll.options.grappleFeats.conversion.attackPenalty, -4);
  const general = await npc.rollNpcSkill(guard, { key: "athletics", ability: "str", grappleHoldingTwo: true });
  assert.equal(
    general.data.total,
    0,
    "all Athletics checks take the holding-two penalty, without guessing unnamed armor tags"
  );
  assert.ok(roll.options.breakdown.some(row => row.label === "Armor/encumbrance check penalty" && row.value === -3));
  guard.system.armor.check = -4;
  assert.throws(() => roll.options.validateSkillContext(), /armor or encumbrance changed/);
  guard.system.armor = oldArmor;
});

test("NPC named Vision checks use armor penalties and Omni-Competent halves each grapple penalty separately", async () => {
  const armor = guard.system.armor,
    effects = guard.system.campaignEffects;
  const check = SPYCRAFT.skills.notice.checks.find(c => c.tags.includes("Vision"));
  assert.ok(check);
  guard.system.armor = { visionCheck: -3, check: -3 };
  const vision = await npc.rollNpcSkill(guard, { key: `notice/${check.id}`, ability: "wis" });
  assert.equal(vision.data.total, 9 + 2 - 3);
  guard.system.campaignEffects = { ...effects, skillPenaltyDivisor: 2 };
  const grapple = await npc.rollNpcSkill(guard, {
    key: "athletics/grapple",
    grappleProficient: true,
    grappleContextConfirmed: true,
    grappleSizeDifference: 0,
    ability: "str",
    grappleHoldingTwo: true,
    grappleMuting: true,
    grappleDamageConversion: true
  });
  assert.equal(grapple.data.total, 4 - 2 - 1 - 2 - 1);
  guard.system.armor = armor;
  guard.system.campaignEffects = effects;
});

test("actual NPC passive checks keep blind visibility and deny action dice; active campaign conversion records the new category", async () => {
  const effects = guard.system.campaignEffects;
  guard.system.campaignEffects = {};
  const check = SPYCRAFT.skills.notice.checks.find(c => c.mode.includes("Passive"));
  assert.ok(check);
  const passive = await npc.rollNpcSkill(guard, { key: `notice/${check.id}`, ability: "wis", secret: true });
  assert.equal(passive.options.rollMode, "blindroll");
  assert.equal(passive.options.actionDiceAllowed, false);
  assert.match(passive.options.npcSkillContext.mode, /Passive/);
  game.user.isGM = false;
  await assert.rejects(npc.rollNpcSkill(guard, { key: `notice/${check.id}`, ability: "wis" }), /GC rolls/);
  game.user.isGM = true;
  guard.system.campaignEffects = { activeSkillChecks: 1 };
  const active = await npc.rollNpcSkill(guard, { key: `notice/${check.id}`, ability: "wis" });
  assert.equal(active.options.rollMode, undefined);
  assert.equal(active.options.actionDiceAllowed, true);
  assert.equal(active.options.npcSkillContext.mode, "Active");
  assert.throws(() => passive.options.validateSkillContext(), /category, conditions/);
  guard.system.campaignEffects = effects;
});

test("actual NPC incapacity guards refuse before the roll and an escape keeps proficiency, Size and original source evidence", async () => {
  const context = guard.system.conditionContext,
    statuses = guard.statuses,
    effects = guard.effects;
  guard.system.conditionContext = { unconscious: true };
  await assert.rejects(
    npc.rollNpcSkill(guard, {
      key: "athletics/grapple",
      grappleProficient: true,
      grappleContextConfirmed: true,
      grappleSizeDifference: 0,
      ability: "str"
    }),
    /Unconscious/
  );
  guard.system.conditionContext = { held: true };
  await assert.rejects(
    npc.rollNpcSkill(guard, {
      key: "athletics/grapple",
      grappleProficient: true,
      grappleContextConfirmed: true,
      grappleSizeDifference: 0,
      ability: "str"
    }),
    /Held/
  );
  guard.statuses = new Set(["held"]);
  guard.effects = [{ id: "hold", statuses: new Set(["held"]), active: true }];
  const roll = await npc.rollNpcSkill(guard, {
    key: "athletics/restraint-escape",
    ability: "str",
    grappleProficient: "false",
    grappleSizeDifference: "1",
    grappleContextConfirmed: true
  });
  assert.equal(roll.data.total, 8);
  assert.equal(roll.options.error, 3);
  assert.equal(roll.options.restraintEscape.fullActions, 2);
  assert.equal(roll.options.restraintEscape.sourceSnapshot.sources[0].id, "hold");
  guard.statuses.clear();
  assert.throws(() => roll.options.validateSkillContext(), /grapple sources changed/);
  guard.statuses = statuses;
  guard.effects = effects;
  guard.system.conditionContext = context;
});

test("actual NPC tagged sense checks apply blindness to their modifier and cap, and refuse tasks requiring sight", async () => {
  const context = guard.system.conditionContext;
  guard.system.conditionContext = { blinded: true };
  const named = SPYCRAFT.skills.notice.checks.find(c => c.tags.includes("Vision"));
  const result = await npc.rollNpcSkill(guard, { key: `notice/${named.id}`, ability: "wis" });
  assert.equal(result.data.total, 9 + 2 - 8);
  assert.equal(result.options.cap, 20);
  assert.equal(result.options.sensoryConditions.blinded, true);
  await assert.rejects(
    npc.rollNpcSkill(guard, { key: `notice/${named.id}`, ability: "wis", requiresEyesight: true }),
    /requires eyesight/
  );
  guard.system.conditionContext = context;
});

test("the actual GC boost API refuses passive and fixed-result NPC cards before payment or RNG", async () => {
  const { gcBoostable, gcBoostCard } = await import("../module/apps/gc/npc-card-dice.mjs"),
    base = { rawTotal: 20, checkMethod: "roll", actionDiceAllowed: true };
  assert.equal(gcBoostable(base), true);
  for (const patch of [{ actionDiceAllowed: false }, { checkMethod: "take10" }, { checkMethod: "take20" }]) {
    const before = structuredClone([...settings]),
      queued = diceQueue.length;
    const message = {
      flags: { spycraft2: { ...base, ...patch } },
      update: () => {
        throw Error("Blocked boost must not update the card");
      }
    };
    assert.equal(gcBoostable(message.flags.spycraft2), false);
    assert.equal(await gcBoostCard(message, guard), null);
    assert.equal(diceQueue.length, queued);
    assert.deepEqual([...settings], before);
  }
});

test("standard NPC Damage saves accumulate, kill and reset; special NPCs are refused", async () => {
  dice(12);
  let result = await npc.npcDamageSave(guard, { damage: 8, kind: "lethal" });
  assert.deepEqual([result.dc, result.failed, guard.system.damageTrack.accumulated], [14, false, 8]);
  dice(3);
  result = await npc.npcDamageSave(guard, { damage: 10, kind: "lethal" });
  assert.deepEqual([result.dc, result.state], [19, "dead"]);
  assert.ok(guard.statuses.has("dead"));
  assert.equal(await npc.npcDamageSave(guard, { damage: 1, kind: "lethal" }), false);
  assert.match(warnings.at(-1), /already dead/);
  await npc.resetDamageTrack(guard);
  assert.equal(guard.system.damageTrack.state, "active");
  assert.ok(!guard.statuses.has("dead"));
  await npc.npcDamageSave(boss, { damage: 5, kind: "lethal" });
  assert.match(warnings.at(-1), /Special NPCs/);
});

test("standard NPC damage validates before dice and fully resisted critical subdual/stress rolls no save", async () => {
  const target = makeActor(
    "resistant-guard",
    "npc",
    npcSystem({ survivalStats: { resistances: { stress: 8, subdual: 8 }, resistanceSources: [] } })
  );
  const before = diceQueue.length;
  for (const patch of [
    { damage: 0 },
    { damage: 1.5 },
    { kind: "unknown" },
    { bonus: 0.5 },
    { criticalDice: -1 },
    { blast: "yes" }
  ])
    assert.equal(await npc.npcDamageSave(target, { damage: 6, kind: "lethal", ...patch }), false);
  for (const kind of ["stress", "subdual"]) {
    const result = await npc.npcDamageSave(target, { damage: 6, kind, criticalDice: 2 });
    assert.equal(result.damage, 0);
    assert.equal(result.prevented, true);
    assert.equal(target.system.damageTrack, null);
  }
  assert.equal(diceQueue.length, before);
});

test("standard NPC stress applies campaign adjustment once and resistance afterward", async () => {
  for (const already of [false, true]) {
    const target = makeActor(
      `campaign-resistant-${already}`,
      "npc",
      npcSystem({
        campaignEffects: { stressDamageMultipliers: [0.5], stressDamageMinimum: 1 },
        survivalStats: { resistances: { stress: 2 }, resistanceSources: [] }
      })
    );
    dice(12);
    const result = await npc.npcDamageSave(target, {
      damage: already ? 3 : 7,
      kind: "stress",
      campaignStressAdjusted: already
    });
    assert.equal(result.damage, 1);
    assert.equal(target.system.damageTrack.accumulated, 1);
  }
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
  await guard.update({ "system.promotion": null });
  await npc.npcDamageSave(guard, { damage: 9, kind: "lethal" }).catch(() => {});
  await spend.spendGCDice({ id: "dramaticScene" });
  assert.equal(state.isDramaticScene(), true);
  assert.equal(gcDiceStatus().value, 2);
  await spend.spendGCDice({ id: "saveNpc", actor: boss });
  assert.match(warnings.at(-1), /dramatic scene cannot be saved/);
  dice(1, 12, 5);
  result = await spend.spendGCDice({ id: "boostDC", actor: boss, skillKey: "notice", baseDC: 15 });
  assert.deepEqual(result.dice, [[1, 12, 5]], "dramatic scene: a natural 1 explodes too");
  assert.equal(result.state, "ready", "the actual declared DC waits for its matching check");
  await spend.spendGCDice({ id: "saveNpc", actor: boss, fromCapture: true });
  assert.match(warnings.at(-1), /costs 2 action dice; the GC has 1/);
  await spend.setDramaticScene(false);
  assert.equal(state.isDramaticScene(), false);
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
  assert.equal(context.xp.earned, 325);
  assert.equal(context.dice.expected, 10);
  assert.equal(context.scene.dramatic, false);
  assert.ok(Array.isArray(context.conflicts));
  if (process.env.GC_CONTEXT_OUT)
    (await import("node:fs")).writeFileSync(process.env.GC_CONTEXT_OUT, JSON.stringify(context));
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
  assert.match(context.status.dice, /left of 10|not set up/);
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
  assert.equal(consoleSections({ missionActive: true, combat: false }, closed).combat.open, false);
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
    assert.deepEqual(Object.keys(CONFIG.ui.sidebar.TABS), ["gc", "chat", "combat", "scenes"]);
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
    assert.equal(await openGCConsole(), ui.gc);
    assert.equal(game.spycraft2.gc.console, ui.gc);
    assert.deepEqual(calls, [["render", { force: true }], ["activate"]]);
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
