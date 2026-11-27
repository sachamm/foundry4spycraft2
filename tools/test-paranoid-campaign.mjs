import test from "node:test";
import assert from "node:assert/strict";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { campaignSkillChecks, moraleSkillPenalty } from "../module/rules/campaign-skills.mjs";
import { campaignEffects, activeQualities } from "../module/rules/gc/campaign.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { rollNpcSkill } from "../module/apps/gc/npc-play.mjs";
const effects = campaignEffects(activeQualities(["paranoid"])).effects;
const state = (conditionContext = {}) => ({
  conditionContext,
  campaignEffects: effects,
  activeFeatNames: [],
  abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 12, mod: 1 }])),
  skillTotals: Object.fromEntries(
    Object.entries(cfg.skills).map(([key, s]) => [
      key,
      {
        ranks: 5,
        cap: 30,
        threat: 20,
        totals: s.abilities.map(ability => ({ ability, total: 8, normalSkillBonus: 8 }))
      }
    ])
  )
});
const opts = { gearStatus: "available", synergySkill: "none" };
const resolve = (s, key, id, extra = {}) =>
  resolveSkillCheck(
    s,
    key,
    cfg.skills[key].checks.find(c => c.id === id),
    { ...opts, ...extra }
  );
test("Paranoid morale bonus requires the actual named surprise use and player/special role", () => {
  for (const npcType of [undefined, "standard", "special", "villain"]) {
    const s = { ...state(), npcType };
    for (const [key, id] of [
      ["blend", "stealth"],
      ["sneak", "hide"]
    ]) {
      assert.equal(
        campaignSkillChecks(s, key, { id }, { surprise: true }).evidence?.bonus ?? 0,
        npcType === "standard" ? 0 : 4
      );
      assert.equal(campaignSkillChecks(s, key, { id }).evidence, null);
    }
    assert.equal(campaignSkillChecks(s, "blend", { id: "fake" }, { surprise: true }).evidence, null);
  }
  assert.equal(
    campaignSkillChecks(
      { ...state(), npcType: "standard", promotion: { mission: "m" }, usagePeriods: { mission: "m" } },
      "sneak",
      { id: "hide" },
      { surprise: true }
    ).evidence.bonus,
    4
  );
});
test("all named disposition uses and declared persuasion apply one morale penalty, never to unrelated checks", () => {
  for (const [key, id] of [
    ["impress", "influence"],
    ["impress", "persuasion"],
    ["intimidate", "domination"],
    ["manipulate", "slander"],
    ["networking", "endorsement"]
  ]) {
    assert.equal(campaignSkillChecks(state(), key, { id }).evidence.penalty, -4);
    assert.equal(resolve(state(), key, id).total, 4);
  }
  assert.equal(campaignSkillChecks(state(), "impress", { id: "seduction" }).evidence.penalty, -4);
  assert.equal(campaignSkillChecks(state(), "athletics", { id: "climb" }).evidence, null);
  assert.equal(
    campaignSkillChecks(state(), "athletics", { id: "climb" }, { persuadingAction: true }).evidence.penalty,
    -4
  );
});
test("Paranoid and Shaken share the worst morale penalty; Baffled and Incompetent cannot erase it", () => {
  assert.equal(resolve(state({ shakenI: true }), "impress", "persuasion").total, 4);
  assert.equal(resolve(state({ baffled: true }), "impress", "persuasion").total, 0);
  assert.equal(resolve(state({ incompetent: true }), "impress", "persuasion").total, -4);
  assert.equal(resolve(state({ baffled: true, shakenI: true }), "impress", "persuasion").total, 0);
  assert.equal(
    moraleSkillPenalty(
      [
        { type: "morale", value: -2 },
        { type: "morale", value: -6 }
      ],
      -4
    ),
    -6
  );
  const s = state({ shakenI: true });
  s.skillTotals.impress.bonusEntries = [{ type: "morale", value: -2 }];
  assert.equal(resolve(s, "impress", "persuasion").total, 6);
});
test("the surprise bonus uses ordinary morale stacking and does not affect non-surprise checks", () => {
  const s = state();
  const normal = resolve(s, "blend", "stealth").total;
  assert.equal(resolve(s, "blend", "stealth", { surprise: true }).total, normal + 4);
  s.skillTotals.blend.bonusEntries = [{ type: "morale", value: 5 }];
  assert.equal(resolve(s, "blend", "stealth", { surprise: true }).total, normal);
});
test("actual NPC skill path applies role-scoped surprise and shared Shaken/social penalties with saved check evidence", async () => {
  globalThis.CONFIG = { SPYCRAFT: cfg };
  const actor = {
    isOwner: true,
    system: { ...state(), npcType: "standard", npcProfile: { enabled: true }, competence: 5 },
    rollCheck: async (_formula, data, options) => ({ data, options })
  };
  let r = await rollNpcSkill(actor, { key: "blend", ability: "cha", surprise: true });
  assert.equal(r.data.total, 6);
  actor.system.npcType = "special";
  r = await rollNpcSkill(actor, { key: "blend", ability: "cha", surprise: true });
  assert.equal(r.data.total, 10);
  assert.equal(r.options.campaignSkillChecks.bonus, 4);
  actor.system.conditionContext = { shakenI: true };
  r = await rollNpcSkill(actor, { key: "impress", ability: "cha", persuadingAction: true });
  assert.equal(r.data.total, 2);
  assert.equal(r.options.checkKind, "skill");
  assert.equal(r.options.campaignSkillChecks.penalty, -4);
  r.options.validateSkillContext();
  actor.system.campaignEffects = {};
  assert.throws(() => r.options.validateSkillContext(), /changed before posting/);
  await assert.rejects(rollNpcSkill(actor, { key: "impress", surprise: true }), /Blend\/Stealth/);
});

test("the actual PC roll forwards campaign evidence and guards both adding and removing campaign effects before posting", async () => {
  globalThis.Actor = class {
    constructor() {
      this.system = state();
      this.items = [];
      this.type = "agent";
      this.uuid = "Actor.performer";
      this.isOwner = true;
    }
  };
  globalThis.CONFIG = { SPYCRAFT: cfg };
  globalThis.game = {
    user: { id: "gc", isGM: true },
    settings: { get: () => false },
    i18n: { localize: String },
    actors: []
  };
  globalThis.foundry = { utils: { escapeHTML: String } };
  globalThis.ui = { notifications: { warn: () => null } };
  const { SpycraftActor } = await import("../module/documents/actor.mjs"),
    a = new SpycraftActor();
  a.rollCheck = async (_formula, data, options) => ({ data, options });
  const request = { check: "persuasion", ...opts };
  let r = await a.rollSkill("impress", "cha", request);
  assert.equal(r.options.campaignSkillChecks.penalty, -4);
  assert.equal(r.data.total, 4);
  r.options.validateSkillContext();
  a.system.campaignEffects = {};
  assert.throws(() => r.options.validateSkillContext(), /changed before/);
  r = await a.rollSkill("impress", "cha", request);
  assert.equal(r.options.campaignSkillChecks, null);
  a.system.campaignEffects = effects;
  assert.throws(() => r.options.validateSkillContext(), /changed before/);
});
