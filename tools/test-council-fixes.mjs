// Fixes from the second live UI/UX council review (2026-11-22).
import test from "node:test";
import assert from "node:assert/strict";
import { recordedAttackDistance } from "../module/rules/cqb.mjs";
import { agentTokenDefaults, equipsAsFirstWeapon } from "../module/rules/creation-defaults.mjs";
import { buildCreationTrack, buildSetupGuide } from "../module/sheets/agent-ux.mjs";
import { prerequisitesUseSkills } from "../module/rules/prerequisites.mjs";

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
  await Promise.all(hooks.combatStart.map(fn => fn(fight)));
  assert.ok(a.actor.statuses.has("flat-footed") && b.actor.statuses.has("flat-footed"));
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
