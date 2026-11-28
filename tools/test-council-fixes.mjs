// Fixes from the second live UI/UX council review (2026-11-22).
import test from "node:test";
import assert from "node:assert/strict";
import { recordedAttackDistance } from "../module/rules/cqb.mjs";
import { agentTokenDefaults, equipsAsFirstWeapon, npcTokenDefaults } from "../module/rules/creation-defaults.mjs";
import { buildCreationTrack, buildSetupGuide } from "../module/sheets/agent-ux.mjs";
import { prerequisitesUseSkills } from "../module/rules/prerequisites.mjs";
import { orderSkillChecks, needsGear } from "../module/rules/skill-check-order.mjs";
import { combatMovementPlan } from "../module/rules/combat-movement.mjs";
import { quickAttackHasTarget } from "../module/apps/remembered-choices.mjs";
import { attackResolutionNote } from "../module/rules/damage-application.mjs";
import { rememberedPlacement, rememberSheetPlacement } from "../module/sheets/sheet-placement.mjs";

test("a damage roll reuses the distance its attack card recorded", () => {
  assert.equal(recordedAttackDistance({ attackContext: { distanceFeet: 25 } }), 25);
  assert.equal(recordedAttackDistance({ attackContext: { distanceFeet: null }, cqbRange: { distanceFeet: 20 } }), 20);
  assert.equal(recordedAttackDistance({ attackContext: { distanceFeet: "40" } }), 40);
  assert.equal(recordedAttackDistance({ attackContext: { distanceFeet: 0 } }), 0, "adjacent is a distance too");
  assert.equal(recordedAttackDistance({ attackContext: { distanceFeet: -5 } }), null);
  assert.equal(recordedAttackDistance({ attackContext: {} }), null);
  assert.equal(recordedAttackDistance(null), null);
});

test("flat-footed ends as a combatant's turn begins, except in a surprise round its side lost", async () => {
  const hooks = {};
  globalThis.Hooks = { on: (name, fn) => (hooks[name] ??= []).push(fn), once() {} };
  globalThis.foundry = { utils: { escapeHTML: String, randomID: () => "id" } };
  globalThis.ui = { notifications: { warn() {}, info() {} }, combat: null };
  const gm = { id: "gm", isGM: true };
  const settings = { fluidInitiative: false, startFlatFooted: true };
  globalThis.game = {
    user: gm,
    users: Object.assign([gm], { activeGM: gm }),
    settings: { get: (_scope, key) => settings[key] },
    i18n: { localize: String }
  };
  const { installFluidInitiativeHooks, flatFootedEndsOnTurn } = await import("../module/apps/gc/combat.mjs");
  assert.equal(flatFootedEndsOnTurn({ round: 1 }, { playerSide: true }), true);
  const surprise = { round: 1, surprise: { winners: ["opponents"], round: 1 } };
  assert.equal(flatFootedEndsOnTurn(surprise, { playerSide: true }), false);
  assert.equal(flatFootedEndsOnTurn(surprise, { playerSide: false }), true);
  assert.equal(flatFootedEndsOnTurn({ ...surprise, round: 2 }, { playerSide: true }), true);

  installFluidInitiativeHooks();
  globalThis.CONFIG = { statusEffects: [{ id: "flat-footed", name: "Flat-footed", img: "" }] };
  let n = 0;
  const actor = name => ({
    name,
    hasPlayerOwner: true,
    effects: [],
    get statuses() {
      return new Set(this.effects.flatMap(e => [...e.statuses]));
    },
    async createEmbeddedDocuments(_type, rows) {
      const made = rows.map(row => ({
        ...row,
        id: `e${++n}`,
        statuses: new Set(row.statuses),
        changes: [],
        toObject() {
          return { _id: this.id, changes: [] };
        }
      }));
      this.effects.push(...made);
      return made;
    },
    async deleteEmbeddedDocuments(_type, ids) {
      this.effects = this.effects.filter(e => !ids.includes(e.id));
    }
  });
  const a = { id: "a", actor: actor("A") },
    b = { id: "b", actor: actor("B") };
  const fight = {
    started: true,
    round: 1,
    turn: 0,
    flags: {},
    combatants: [a, b],
    turns: [a, b],
    get combatant() {
      return this.turns[this.turn];
    }
  };
  // The start is read from the combat's own update, so the lead GM marks a fight another GM began.
  assert.equal(hooks.combatStart, undefined);
  for (const fn of hooks.updateCombat) await fn(fight, { round: 1, turn: 0 }, { direction: 1 });
  assert.ok(!a.actor.statuses.has("flat-footed"), "A acts first and is no longer flat-footed");
  assert.ok(b.actor.statuses.has("flat-footed"), "B has not acted yet");
  fight.turn = 1;
  for (const fn of hooks.updateCombat) await fn(fight, { turn: 1 }, { direction: 1 });
  assert.ok(!b.actor.statuses.has("flat-footed"));
});

test("a new agent's token is friendly, linked and sighted unless its creator chose otherwise", () => {
  assert.deepEqual(agentTokenDefaults({}), { sight: { enabled: true }, actorLink: true, disposition: 1 });
  assert.deepEqual(agentTokenDefaults({ disposition: -1, actorLink: false }), { sight: { enabled: true } });
  assert.equal(agentTokenDefaults({ sight: { enabled: false }, actorLink: false, disposition: 0 }), null);
});

test("an agent's first weapon arrives equipped; later ones do not", () => {
  const weapon = { type: "weapon", system: { equipped: false } };
  assert.equal(equipsAsFirstWeapon(weapon, []), true);
  assert.equal(equipsAsFirstWeapon(weapon, [{ type: "weapon", system: { equipped: false } }]), true);
  assert.equal(equipsAsFirstWeapon(weapon, [{ type: "weapon", system: { equipped: true } }]), false);
  assert.equal(equipsAsFirstWeapon({ type: "gear", system: {} }, []), false);
});

test("a blank sheet starts at attributes in both the track and the next-step button", () => {
  const blank = [
    { order: 1, always: true, tab: "main", browse: { type: "origin", originType: "talent" }, text: "Choose a talent." },
    {
      order: 2,
      always: true,
      tab: "main",
      browse: { type: "origin", originType: "specialty" },
      text: "Choose a specialty."
    },
    { order: 10, always: true, tab: "main", text: "36 attribute points left to spend." }
  ];
  const track = buildCreationTrack(blank);
  assert.equal(track.steps.find(step => step.start).key, "attributes");
  assert.equal(track.steps.find(step => step.key === "origin").count, 2);
  assert.equal(buildSetupGuide(blank).next.text, "36 attribute points left to spend.");
});

test("an overspent budget holds the guidance on its step and marks the step as over", () => {
  const tasks = [
    {
      order: 29,
      always: true,
      error: true,
      tab: "skills",
      skillLevel: 1,
      text: "Level 1 skill points overspent by 2."
    },
    { order: 40, tab: "feats", weight: 2, text: "2 feat slots open (any tree)." },
    { order: 41, tab: "feats", weight: 1, text: "Bonus feat slots open: 1 Covert." }
  ];
  const track = buildCreationTrack(tasks);
  const skills = track.steps.find(step => step.key === "skills");
  assert.equal(skills.start, true);
  assert.equal(skills.error, true);
  assert.equal(buildSetupGuide(tasks).next.error, true);
  // The feats badge counts open slots, not reminder lines.
  assert.equal(track.steps.find(step => step.key === "feats").count, 3);
});

test("weapon proficiency picks belong to the class step", () => {
  const track = buildCreationTrack([{ order: 50, tab: "training", text: "6 weapon proficiency picks left." }]);
  assert.equal(track.steps.find(step => step.start).key, "class");
});

test("only prerequisites that read skill ranks are blocked by a broken skill history", () => {
  assert.equal(prerequisitesUseSkills({ type: "ability", key: "con", min: 13 }), false);
  assert.equal(
    prerequisitesUseSkills({
      type: "all",
      of: [
        { type: "feat", name: "X" },
        { type: "skill", key: "athletics", min: 4 }
      ]
    }),
    true
  );
  assert.equal(prerequisitesUseSkills({ type: "any", of: [{ type: "keySkill", min: 6 }] }), true);
  assert.equal(prerequisitesUseSkills(null), false);
});

test("a skill's open checks are offered before secret, passive and gear-only ones", () => {
  const checks = [
    { id: "bind", mode: "Secret", tags: "Gear Only (Bindings)" },
    { id: "climb", mode: "Active", tags: "Gear (Climbing Kit)" },
    { id: "awareness", mode: "Passive", tags: "" },
    { id: "ambush", mode: "Secret", tags: "" },
    { id: "escape", mode: "Active", tags: "" }
  ];
  assert.deepEqual(
    orderSkillChecks(checks).map(c => c.id),
    ["climb", "escape", "awareness", "ambush", "bind"]
  );
  assert.equal(needsGear(checks[0]), true);
  assert.equal(needsGear(checks[1]), false, "optional gear is not a requirement");
});

test("standing still needs no GC route confirmation; moving still does", () => {
  const system = {
    activeFeatNames: [],
    speed: 30,
    canRun: true,
    abilities: { dex: { value: 14, mod: 2 } },
    conditionContext: {},
    postureMovement: { standardMove: true }
  };
  const still = combatMovementPlan(system, { action: "totalDefense", distanceFeet: 0 });
  assert.equal(still.distanceFeet, 0);
  assert.throws(() => combatMovementPlan(system, { action: "totalDefense", distanceFeet: 10 }), /GC must confirm/);
});

test("a quick attack rolls at once only with one target that is not the attacker", () => {
  const me = { uuid: "Actor.me" },
    foe = { actor: { uuid: "Actor.foe" } };
  assert.equal(quickAttackHasTarget(me, [foe]), true);
  assert.equal(quickAttackHasTarget(me, []), false);
  assert.equal(quickAttackHasTarget(me, [foe, { actor: { uuid: "Actor.b" } }]), false);
  assert.equal(quickAttackHasTarget(me, [{ actor: me }]), false);
});

test("an action from the sheet marks its time on the acting character's own turn only", async () => {
  const notices = [];
  globalThis.ui = { notifications: { warn: m => notices.push(m), info() {} }, combat: null };
  const { markActionSpent, costsAction } = await import("../module/apps/gc/combat.mjs");
  const actor = { uuid: "Actor.a" };
  const combatant = {
    name: "Vector",
    actor,
    isOwner: true,
    flags: {},
    update(data) {
      this.flags = { spycraft2: { actions: data["flags.spycraft2.actions"] } };
      return this;
    }
  };
  const combat = { started: true, round: 2, combatant, combatants: [combatant] };
  combatant.parent = combat;
  actor.participatingCombat = combat;
  assert.equal((await markActionSpent(actor, "half")).left, 1);
  assert.equal(combatant.flags.spycraft2.actions.used, 1);
  // A full action with one half left is too much: the player is told and the turn reads as used up.
  assert.equal(await markActionSpent(actor, "full"), null);
  assert.equal(combatant.flags.spycraft2.actions.used, 2);
  combatant.flags.spycraft2.actions.used = 1;
  assert.match(notices[0], /Vector had 1 half action/);
  // Someone else's turn: nothing is marked.
  combat.combatant = { actor: { uuid: "Actor.other" } };
  assert.equal(await markActionSpent(actor, "half"), null);
  combat.combatant = combatant;
  // The wrapper spends only when the action went through.
  let rendered = 0;
  const sheet = { actor, render: () => rendered++ };
  await costsAction("half", () => false).call(sheet);
  assert.equal(combatant.flags.spycraft2.actions.used, 1);
  await costsAction("half", () => ({ ok: true })).call(sheet);
  assert.equal(combatant.flags.spycraft2.actions.used, 2);
  assert.equal(rendered, 1);
});

test("an attack's time comes from what was declared: fire actions, Pummel and untrained Disarm take the turn", async () => {
  const { attackActionCost } = await import("../module/rules/combat-actions.mjs");
  const card = attackContext => ({ flags: { spycraft2: { attackContext } } });
  assert.equal(attackActionCost(card({ fireAction: null })), "half");
  assert.equal(attackActionCost(card({ fireAction: { action: "burst" } })), "half");
  assert.equal(attackActionCost(card({ fireAction: { action: "autofire" } })), "full");
  assert.equal(attackActionCost(card({ fireAction: { action: "strafe" } })), "full");
  assert.equal(attackActionCost({ fireAction: "coverFire", save: null }), "full");
  assert.equal(attackActionCost({ fireAction: "suppressiveFire" }), "full");
  assert.equal(attackActionCost(card({ pummel: { blocked: false } })), "full");
  assert.equal(attackActionCost(card({ disarm: { active: true, fullAction: true } })), "full");
  assert.equal(attackActionCost(card({ disarm: { active: true, fullAction: false } })), "half");
  assert.equal(attackActionCost(true), "half");
});

test("Begin combat names whoever has no Initiative and can roll for NPCs first", async () => {
  const { unrolledCombatants, confirmInitiativeBeforeStart } = await import("../module/apps/gc/combat.mjs");
  const pc = { id: "pc", name: "Vector", hasPlayerOwner: true, initiative: null, players: [{ id: "u1" }] };
  const npc = { id: "npc", name: "Guard", hasPlayerOwner: false, initiative: null };
  const down = { id: "down", name: "Thug", isDefeated: true, initiative: null };
  const rolled = { id: "r", name: "Inez", hasPlayerOwner: true, initiative: 18 };
  const whispers = [];
  const combat = {
    combatants: [pc, npc, down, rolled],
    async rollInitiative(ids) {
      for (const id of ids) this.combatants.find(c => c.id === id).initiative = 12;
    }
  };
  assert.deepEqual(
    unrolledCombatants(combat).map(c => c.id),
    ["pc", "npc"]
  );
  globalThis.game = { ...globalThis.game, user: { isGM: true } };
  globalThis.ChatMessage = { create: data => whispers.push(data) };
  let asked;
  globalThis.foundry = {
    ...globalThis.foundry,
    applications: { api: { DialogV2: { wait: async options => ((asked = options), "roll") } } }
  };
  globalThis.ui = { notifications: { info() {}, warn() {} } };
  assert.equal(await confirmInitiativeBeforeStart(combat), false, "players are reminded before it begins");
  assert.match(asked.content, /Vector, Guard/);
  assert.equal(npc.initiative, 12);
  assert.deepEqual(whispers[0].whisper, ["u1"]);
  pc.initiative = 15;
  assert.equal(await confirmInitiativeBeforeStart(combat), true, "nothing to ask once everyone has rolled");
});

test("cover chosen at Resolve raises the Defense and a miss it alone caused hits the cover", async () => {
  const { coverOnResolution } = await import("../module/apps/damage-application.mjs");
  assert.equal(coverOnResolution("0"), null);
  assert.deepEqual(coverOnResolution("2"), { grade: 2, label: "One-half (1/2)", bonus: 4 });
  assert.deepEqual(
    coverOnResolution("4"),
    { grade: 4, label: "Total", bonus: 8 },
    "total cover uses mandatory interception and penetration"
  );
  assert.equal(coverOnResolution("5"), null);
  // Resolving again without cover clears the earlier cover, since updates merge.
  const again = { attackResolution: { hit: false, margin: -1, defense: 14, cover: null, hitsCover: false } };
  assert.equal(attackResolutionNote(again), "Against Defense 14: a miss by 1.");
  const note = attackResolutionNote({
    attackResolution: {
      targetName: "Anton",
      defense: 17,
      hit: false,
      margin: -2,
      cover: { grade: 2, label: "One-half (1/2)", bonus: 4 },
      hitsCover: true
    }
  });
  assert.match(note, /Defense 17 \(with One-half \(1\/2\) cover, \+4\)/);
  assert.match(note, /hits the cover/);
});

test("a sheet opens where this user last left one, fitted to the window", () => {
  const room = { width: 1600, height: 900, open: 0 };
  assert.deepEqual(rememberedPlacement({ left: 700, top: 40, width: 860, height: 760 }, room), {
    left: 700,
    top: 40,
    width: 860,
    height: 760
  });
  // A place kept on a bigger screen is pulled back inside this one.
  const small = rememberedPlacement({ left: 1500, top: 600, width: 860, height: 760 }, { width: 1280, height: 720 });
  assert.ok(small.left + small.width <= 1280 && small.top + small.height <= 720);
  assert.equal(rememberedPlacement(null, room), null);
  assert.equal(rememberedPlacement({ left: "x" }, room), null);
  const store = new Map();
  const storage = { setItem: (k, v) => store.set(k, v) };
  rememberSheetPlacement("agent", { left: 10, top: 20, width: 700, height: 500 }, storage);
  assert.deepEqual(JSON.parse(store.get("spycraft2.sheetPlacement.agent")), {
    left: 10,
    top: 20,
    width: 700,
    height: 500
  });
});

test("Add NPC lists world NPCs before compendium ones, reuses an imported copy and centres the token", async () => {
  globalThis.foundry = { ...globalThis.foundry, utils: { ...globalThis.foundry?.utils, escapeHTML: String } };
  const { npcChoices, importedCopy, viewCentreCorner } = await import("../module/apps/gc/add-npc.mjs");
  const actors = [
    { uuid: "Actor.b", name: "Thug", type: "npc" },
    {
      uuid: "Actor.a",
      name: "Anton",
      type: "npc",
      _stats: { compendiumSource: "Compendium.spycraft2.core-npcs.Actor.x" }
    },
    { uuid: "Actor.c", name: "Vector", type: "agent" }
  ];
  const packs = [
    { documentName: "Item" },
    {
      documentName: "Actor",
      collection: "spycraft2.core-npcs",
      title: "Core NPCs",
      getIndex: async () => [
        { _id: "y", name: "Soldier", type: "npc" },
        { _id: "x", name: "Guard", type: "npc" },
        { _id: "z", name: "Sample", type: "agent" }
      ]
    }
  ];
  const choices = await npcChoices({ actors, packs });
  assert.deepEqual(
    choices.map(c => [c.name, c.source]),
    [
      ["Anton", "World"],
      ["Thug", "World"],
      ["Guard", "Core NPCs"],
      ["Soldier", "Core NPCs"]
    ]
  );
  assert.equal(choices[2].uuid, "Compendium.spycraft2.core-npcs.Actor.x");
  assert.equal(importedCopy("Compendium.spycraft2.core-npcs.Actor.x", actors).name, "Anton");
  assert.equal(importedCopy("Compendium.spycraft2.core-npcs.Actor.y", actors), null);
  assert.deepEqual(viewCentreCorner({ centre: { x: 1000, y: 800 }, gridSize: 100 }), { x: 950, y: 750 });
  assert.deepEqual(viewCentreCorner({ centre: { x: 1000, y: 800 }, gridSize: 100, width: 2, height: 2 }), {
    x: 900,
    y: 700
  });
});

test("Add NPC spreads copies over free squares, numbers them, sets the side and joins the fight", async () => {
  const { spreadCorners, numberedNames, placementData, joinFight } = await import("../module/apps/gc/add-npc.mjs");
  const corners = spreadCorners({
    origin: { x: 200, y: 200 },
    count: 4,
    gridSize: 100,
    occupied: [
      { x: 200, y: 200 },
      { x: 100, y: 100, width: 1, height: 1 }
    ]
  });
  assert.equal(corners.length, 4);
  assert.equal(new Set(corners.map(c => `${c.x},${c.y}`)).size, 4, "no two share a square");
  assert.ok(!corners.some(c => (c.x === 200 && c.y === 200) || (c.x === 100 && c.y === 100)), "taken squares skipped");
  assert.deepEqual(spreadCorners({ origin: { x: 0, y: 0 }, count: 1, gridSize: 100 }), [{ x: 0, y: 0 }]);
  assert.ok(spreadCorners({ origin: { x: 0, y: 0 }, count: 5, gridSize: 100 }).every(c => c.x >= 0 && c.y >= 0));
  // The scene's rectangle bounds the spread, and a square behind a wall is skipped.
  const bounded = spreadCorners({
    origin: { x: 200, y: 200 },
    count: 6,
    gridSize: 100,
    bounds: { x: 200, y: 200, width: 300, height: 300 },
    blocked: point => point.x === 300 && point.y === 200
  });
  assert.equal(bounded.length, 6);
  assert.ok(
    bounded.every(c => c.x >= 200 && c.y >= 200 && c.x + 100 <= 500 && c.y + 100 <= 500),
    "inside the scene"
  );
  assert.ok(!bounded.some(c => c.x === 300 && c.y === 200), "not behind the wall");

  assert.deepEqual(numberedNames("Guard", 1), ["Guard"]);
  assert.deepEqual(numberedNames("Guard", 3), ["Guard 1", "Guard 2", "Guard 3"]);
  assert.deepEqual(numberedNames("Guard", 2, ["Guard 1", "Guard 4", "Guardian"]), ["Guard 5", "Guard 6"]);
  assert.deepEqual(numberedNames("Guard", 1, ["Guard"]), ["Guard 2"]);
  assert.deepEqual(numberedNames("Dr. X (clone)", 1, ["Dr. X (clone) 2"]), ["Dr. X (clone) 3"]);

  const rows = placementData(
    { name: "Guard", actorLink: true, disposition: 0 },
    {
      corners: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      names: ["Guard 1", "Guard 2"],
      hidden: true
    }
  );
  assert.deepEqual(rows[1], {
    name: "Guard 2",
    delta: { name: "Guard 2" },
    actorLink: false,
    appendNumber: false,
    disposition: -1,
    x: 100,
    y: 0,
    hidden: true
  });
  const kept = placementData(
    { name: "Boss", actorLink: true, disposition: 1 },
    { corners: [{ x: 0, y: 0 }], names: ["Boss"], disposition: "keep" }
  );
  assert.deepEqual([kept[0].actorLink, kept[0].disposition], [true, 1]);
  assert.equal("appendNumber" in kept[0], false, "a name left alone keeps the token's own setting");
  // A Minion squad's Commander is marked on its own token (p.447), and its name still counts for numbering.
  const squad = placementData(
    { name: "Guard", actorLink: false, disposition: -1 },
    {
      corners: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      names: ["Guard 1", "Guard 2"],
      commanderIndex: 0
    }
  );
  assert.equal(squad[0].name, "Guard 1 (Commander)");
  assert.deepEqual(squad[0].delta, { name: "Guard 1 (Commander)", system: { commander: true } });
  assert.deepEqual(squad[1].delta, { name: "Guard 2" });
  assert.deepEqual(numberedNames("Guard", 1, ["Guard 1 (Commander)", "Guard 2"]), ["Guard 3"]);

  const created = [];
  const fight = {
    combatants: [{ actorId: "guard", initiative: 14 }],
    createEmbeddedDocuments: async (_type, data) => (created.push(...data), data)
  };
  await joinFight(fight, [
    { id: "t1", actorId: "guard", hidden: false, parent: { id: "s1" } },
    { id: "t2", actorId: "thug", hidden: true, parent: { id: "s1" } }
  ]);
  assert.deepEqual(created, [
    { tokenId: "t1", sceneId: "s1", actorId: "guard", hidden: false, initiative: 14 },
    { tokenId: "t2", sceneId: "s1", actorId: "thug", hidden: true }
  ]);
});

test("an NPC sheet may be narrower than an agent sheet", async () => {
  const { sheetPlacement } = await import("../module/sheets/sheet-placement.mjs");
  const room = { width: 1280, height: 720, sidebar: 348, open: 0 };
  assert.equal(sheetPlacement({ width: 480, height: 640 }, room, "npc").width, 480);
  assert.equal(sheetPlacement({ width: 860, height: 760 }, { ...room, width: 1000 }, "agent").width, 640);
  assert.equal(rememberedPlacement({ left: 0, top: 0, width: 300, height: 500 }, room, "npc").width, 420);
  assert.equal(rememberedPlacement({ left: 0, top: 0, width: 300, height: 500 }, room, "agent").width, 640);
  // The GC Console in its own window at the left: a new sheet opens beside it when the map has room for both.
  const wide = { ...room, width: 1920, height: 1080 };
  assert.equal(
    sheetPlacement({ width: 480, height: 640 }, { ...wide, avoid: { left: 110, width: 720 } }, "npc").left,
    842
  );
  assert.equal(
    sheetPlacement({ width: 480, height: 640 }, { ...room, avoid: { left: 110, width: 720 } }, "npc").left,
    110
  );
  assert.equal(
    sheetPlacement({ width: 480, height: 640 }, { ...wide, avoid: { left: 1200, width: 300 } }, "npc").left,
    110
  );
});

test("a dialog field marked for one choice shows only while that choice is made", async () => {
  const { whenMatches, focusFirstField } = await import("../module/apps/dialog-kit.mjs");
  const form = { kind: "security", id: "ready" };
  const valueOf = name => form[name];
  assert.equal(whenMatches("kind=security", valueOf), true);
  assert.equal(whenMatches("kind=bundle|other", valueOf), false);
  assert.equal(whenMatches("id!=press|ready", valueOf), false);
  assert.equal(whenMatches("id!=press", valueOf), true);
  assert.equal(whenMatches("", valueOf), true, "an unmarked field always shows");
  assert.equal(whenMatches("missing=x", valueOf), false);
  // The keyboard starts in the first field a person fills in, not on a tick box or the submit button.
  assert.equal(
    focusFirstField('<input type="checkbox" name="a" /><select name="b"></select><input name="c" />'),
    '<input type="checkbox" name="a" /><select autofocus name="b"></select><input name="c" />'
  );
});

test("a renamed NPC takes its tokens along unless the GC named them by hand", async () => {
  const { renamedTokenName } = await import("../module/rules/creation-defaults.mjs");
  assert.equal(renamedTokenName("Guard", "Guard", "Sentry"), "Sentry");
  assert.equal(renamedTokenName("Guard 3", "Guard", "Sentry"), "Sentry 3");
  assert.equal(renamedTokenName("Guardian", "Guard", "Sentry"), null);
  assert.equal(renamedTokenName("Guard captain", "Guard", "Sentry"), null);
  assert.equal(renamedTokenName("The Broker", "Guard", "Sentry"), null);
  assert.equal(renamedTokenName("Guard", "Guard", "Guard"), null);
  assert.equal(renamedTokenName(undefined, "Guard", "Sentry"), null);
  assert.equal(renamedTokenName("Guard (2)", "Guard", "Sentry"), "Sentry (2)", "Foundry's own numbering follows");
  const { renamedFromAny } = await import("../module/rules/creation-defaults.mjs");
  assert.equal(renamedFromAny("Guard 2", ["Sentry", "Guard"], "Watch"), "Watch 2", "a token behind a quick rename");
  assert.equal(renamedFromAny("Bob", ["Sentry", "Guard"], "Watch"), null);
});

test("a dialog's Cancel button answers like closing the dialog", async () => {
  const { cancellable } = await import("../module/apps/dialog-kit.mjs");
  assert.equal(await cancellable(async () => "cancel", {}), null, "Foundry answers a plain button with its name");
  assert.deepEqual(await cancellable(async options => options, { name: "x" }), { name: "x" });
  assert.equal(await cancellable(async () => null, {}), null);
});

test("a hidden field's limits are set aside so it cannot hold the dialog, and come back when it shows", async () => {
  const { relaxHiddenRules, freeCancel } = await import("../module/apps/dialog-kit.mjs");
  const attrs = new Map([
    ["max", "8"],
    ["required", ""]
  ]);
  const control = {
    dataset: {},
    hasAttribute: name => attrs.has(name),
    getAttribute: name => attrs.get(name),
    setAttribute: (name, value) => attrs.set(name, value),
    removeAttribute: name => attrs.delete(name)
  };
  const field = { hidden: true, querySelectorAll: () => [control] };
  relaxHiddenRules(field);
  assert.deepEqual([...attrs.keys()], []);
  field.hidden = false;
  relaxHiddenRules(field);
  assert.deepEqual(Object.fromEntries(attrs), { max: "8", required: "" });
  assert.equal(control.dataset.heldRules, undefined);
  const cancel = {};
  freeCancel({ querySelectorAll: () => [cancel] });
  assert.equal(cancel.formNoValidate, true);
});

test("Add NPC: a stale import is not reused, and a hex grid's corners land on the grid", async () => {
  const { importedCopy, onGrid } = await import("../module/apps/gc/add-npc.mjs");
  const uuid = "Compendium.spycraft2.core-npcs.Actor.x";
  const actors = [{ name: "Anton", _stats: { compendiumSource: uuid, createdTime: 100 } }];
  assert.equal(importedCopy(uuid, actors, { _stats: { modifiedTime: 50 } }).name, "Anton");
  assert.equal(importedCopy(uuid, actors, { _stats: { modifiedTime: 200 } }), null, "rebuilt since the import");
  const square = [{ x: 0, y: 0 }];
  assert.equal(onGrid(square, { isSquare: true }), square);
  const hex = {
    isSquare: false,
    getTopLeftPoint: p => ({ x: Math.round(p.x / 87) * 87, y: Math.round(p.y / 100) * 100 })
  };
  assert.deepEqual(
    onGrid(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 10, y: 0 }
      ],
      hex
    ),
    [
      { x: 0, y: 0 },
      { x: 87, y: 0 }
    ]
  );
});

test("a new NPC's token is hostile and readable by the GC; a special one is linked with its two bars (B-062)", () => {
  assert.deepEqual(npcTokenDefaults({}, "standard"), { disposition: -1, displayName: 20 });
  assert.deepEqual(npcTokenDefaults({}, "special"), {
    disposition: -1,
    displayName: 20,
    actorLink: true,
    displayBars: 40,
    bar1: { attribute: "vitality" },
    bar2: { attribute: "wounds" }
  });
  // What the creator chose is kept.
  assert.deepEqual(npcTokenDefaults({ disposition: 1, displayName: 0 }, "standard"), null);
  assert.equal(npcTokenDefaults({ actorLink: false }, "special").actorLink, undefined);
});

test("copies laid out on a hex grid never share a hex and the group keeps its size (B-230)", async () => {
  const { spreadCorners } = await import("../module/apps/gc/add-npc.mjs");
  // A coarse snap that maps two neighbouring squares of each row onto one cell, as a hex row offset can.
  const snap = point => ({ x: Math.floor(point.x / 200) * 200, y: point.y });
  const corners = spreadCorners({ origin: { x: 400, y: 400 }, count: 6, gridSize: 100, snap });
  assert.equal(corners.length, 6);
  assert.equal(new Set(corners.map(point => `${point.x},${point.y}`)).size, 6);
});

test("an unlinked copy's own actor carries the token's name, at placement and after a rename (B-251)", async () => {
  const { placementData } = await import("../module/apps/gc/add-npc.mjs");
  const { unlinkedRename } = await import("../module/apps/token-links.mjs");
  const placed = placementData(
    { name: "Guard", actorLink: false },
    {
      corners: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      names: ["Guard 1", "Guard 2"],
      commanderIndex: 1
    }
  );
  assert.equal(placed[0].delta.name, "Guard 1");
  assert.deepEqual(placed[1].delta, { name: "Guard 2 (Commander)", system: { commander: true } });
  // A lone linked token keeps the actor's own name.
  assert.equal(
    placementData({ name: "Boss", actorLink: true }, { corners: [{ x: 0, y: 0 }], names: [] })[0].delta,
    undefined
  );
  const token = { actorLink: false, actor: { name: "Guard 1" } };
  assert.equal(unlinkedRename(token, { name: "Sergeant" }), "Sergeant");
  assert.equal(unlinkedRename(token, { name: "Guard 1" }), null);
  assert.equal(unlinkedRename({ ...token, actorLink: true }, { name: "Sergeant" }), null);
  assert.equal(unlinkedRename(token, { x: 5 }), null);
});

test("the save dialog always offers the GC's modifier (B-102)", async () => {
  await import("../module/rolls/dialogs/save.mjs");
  const { rollPipeline } = await import("../module/rules/roll-pipeline.mjs");
  const content = rollPipeline.dialog({
    dialog: "save",
    actor: { system: {} },
    feats: new Set(),
    key: "fort",
    stillStandingContent: "",
    options: {}
  });
  assert.match(content, /name="situationalModifier"/);
});
