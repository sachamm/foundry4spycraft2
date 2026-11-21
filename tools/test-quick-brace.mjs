import test from "node:test";
import assert from "node:assert/strict";
import {
  quickRangedAimContent as content,
  quickRangedAimInput as input
} from "../module/apps/standard-attack-context.mjs";
test("quick Brace and stable-surface controls preserve checked state and use one explicit declaration each", () => {
  for (const braced of [false, true])
    for (const stableSurface of [false, true]) {
      const html = content({ braced, stableSurface });
      for (const key of ["braced", "stableSurface"]) {
        assert.equal((html.match(new RegExp('name="' + key + '"', "g")) ?? []).length, 1);
        assert.equal(html.includes('name="' + key + '" type="checkbox" checked'), { braced, stableSurface }[key]);
      }
      assert.match(html, /already taken separately/);
      assert.match(html, /not moved.*90° cone/);
      assert.match(html, /unnecessary with Marksmanship Basics/);
    }
});
test("quick Brace parser requires actual booleans, preserves explicit false and ignores fabricated benefits", () => {
  assert.deepEqual(
    input({ braced: true, stableSurface: false, braceBonus: 99, superiorAccuracy: { threatIncrease: 99 } }),
    { braced: true, stableSurface: false }
  );
  assert.deepEqual(input({}), {});
  for (const key of ["braced", "stableSurface"])
    for (const value of ["true", 1, null, {}, []])
      assert.throws(() => input({ [key]: value }), /Brace|bracing surface/);
});
const { makeFatigueActor } = await import("./fixtures/fatigue-actor.mjs");
foundry.utils.escapeHTML = String;
globalThis.ChatMessage = { getSpeaker: () => ({}) };
let reply = {},
  captured = "",
  posts = [],
  rolls = 0,
  warnings = [];
foundry.applications.api.DialogV2.input = async o => {
  captured = o.content;
  return reply;
};
ui.notifications.warn = s => {
  warnings.push(s);
  return null;
};
globalThis.Roll = class {
  constructor(_f, data) {
    this.total = 12 + (data.total ?? 0);
    this.dice = [{ total: 12 }];
  }
  async evaluate() {
    rolls++;
    return this;
  }
  async toMessage(d) {
    posts.push(d);
    return d;
  }
};
function actor({ trained = true, melee = false, feats = [], prone = false } = {}) {
  const a = makeFatigueActor();
  a.system = {
    size: "Medium",
    bab: 3,
    abilities: { str: { value: 14, mod: 2 }, dex: { value: 14, mod: 2 } },
    conditionContext: { prone },
    classLevels: {},
    activeFeatNames: feats,
    proficiencyTotals: { rifle: { proficient: trained }, edged: { proficient: true } },
    actionDice: { value: 0 },
    vitality: { value: 4 },
    wounds: { value: 4 }
  };
  a.flags = {};
  a.items = [
    {
      id: "weapon",
      uuid: "Actor.fatigue.Item.weapon",
      name: "Actual owned weapon",
      type: "weapon",
      system: {
        proficiency: melee ? "edged" : "rifle",
        weaponCategory: melee ? "other" : "boltActionRifle",
        qualities: melee ? "" : "ACC, SPA",
        equipped: true,
        carried: true,
        quantity: 1,
        sizeHands: melee ? "S/1h" : "S/2h",
        range: melee ? 0 : 100,
        recoil: 18,
        fireModes: melee ? [] : ["single"],
        fireMode: "single",
        error: 1,
        threat: 20,
        damage: "1d6"
      }
    }
  ];
  a.items.get = id => a.items.find(i => i.id === id);
  a.getRollData = () => ({});
  Object.defineProperty(a, "participatingCombat", { value: null });
  return a;
}
test("actual quick dialog executes the complete training/Aim/Brace matrix and normal Brace attack/recoil math", async () => {
  for (const trained of [false, true])
    for (const aimed of [false, true])
      for (const braced of [false, true]) {
        const a = actor({ trained });
        reply = { aimed, braced, stableSurface: true, attackAction: "standard" };
        const m = await a.rollAttack(a.items[0], { askContext: true }),
          c = m.flags.spycraft2.attackContext;
        assert.equal(m.flags.spycraft2.threat, 20 - (trained && aimed ? 1 : 0) - (trained && aimed && braced ? 1 : 0));
        assert.equal(c.braced, braced);
        assert.equal(c.braceBonus, braced ? 1 : 0);
        assert.equal(c.recoilStrength, braced ? 16 : 14);
        assert.equal(c.superiorAccuracy.braced, braced);
        assert.equal(c.superiorAccuracy.trained, trained);
        assert.equal(c.braceAction, braced ? "half" : null);
        for (const name of ["aimed", "braced", "stableSurface", "attackAction"])
          assert.equal((captured.match(new RegExp('name="' + name + '"', "g")) ?? []).length, 1, name);
      }
});
test("actual quick Brace requires a stable surface, honors Marksmanship Basics and retains prone free-action timing", async () => {
  let a = actor();
  reply = { braced: true, stableSurface: false, aimed: true, attackAction: "standard" };
  posts = [];
  rolls = 0;
  warnings = [];
  assert.equal(await a.rollAttack(a.items[0], { askContext: true }), false);
  assert.equal(posts.length, 0);
  assert.equal(rolls, 0);
  assert.match(warnings[0], /stable surface/);
  a = actor({ feats: ["Marksmanship Basics"] });
  let m = await a.rollAttack(a.items[0], { askContext: true });
  assert.equal(m.flags.spycraft2.attackContext.braceAction, "free");
  assert.equal(m.flags.spycraft2.threat, 18);
  a = actor({ prone: true });
  reply = { ...reply, stableSurface: true };
  m = await a.rollAttack(a.items[0], { askContext: true });
  assert.equal(m.flags.spycraft2.attackContext.braceAction, "free");
});
test("legacy missing fields preserve prior declarations while explicit unchecking clears Brace and malformed input never rolls", async () => {
  let a = actor();
  reply = {};
  let m = await a.rollAttack(a.items[0], {
    askContext: true,
    aimed: true,
    braced: true,
    stableSurface: true,
    attackAction: "standard"
  });
  assert.equal(m.flags.spycraft2.threat, 18);
  assert.match(captured, /name="braced" type="checkbox" checked/);
  reply = { braced: false };
  m = await a.rollAttack(a.items[0], {
    askContext: true,
    aimed: true,
    braced: true,
    stableSurface: true,
    attackAction: "standard"
  });
  assert.equal(m.flags.spycraft2.threat, 19);
  assert.equal(m.flags.spycraft2.attackContext.braced, false);
  for (const patch of [{ braced: "true" }, { stableSurface: "true" }]) {
    a = actor();
    reply = patch;
    posts = [];
    rolls = 0;
    await assert.rejects(a.rollAttack(a.items[0], { askContext: true }), /Brace|bracing surface/);
    assert.equal(posts.length, 0);
    assert.equal(rolls, 0);
  }
});
test("melee quick dialogs cannot import ranged Brace inputs and cancelling changes no resources or messages", async () => {
  let a = actor({ melee: true });
  reply = { braced: true, stableSurface: true, aimed: true };
  let m = await a.rollAttack(a.items[0], { askContext: true });
  assert.equal(captured.includes('name="braced"'), false);
  assert.equal(captured.includes('name="stableSurface"'), false);
  assert.equal(m.flags.spycraft2.attackContext.braced, false);
  a = actor();
  reply = null;
  posts = [];
  assert.equal(await a.rollAttack(a.items[0], { askContext: true }), null);
  assert.equal(posts.length, 0);
  assert.equal(a.system.actionDice.value, 0);
});
