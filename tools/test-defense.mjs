import { shakenInitiativeMarker } from "../module/rules/shaken-initiative.mjs";
import { reconcileShakenInitiative } from "../module/apps/shaken-initiative.mjs";
import { shakenStateFromActor } from "../module/rules/shaken.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { uncannyDodgePlan, initiativeLossPlan, incomingDefensePlan } from "../module/rules/defense.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const defs = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))),
  ci = key => {
    const c = defs.find(c => c.key === key);
    return {
      id: key,
      name: c.name,
      type: "class",
      system: { ...structuredClone(c), identifier: key, vitalityDie: c.vitality }
    };
  };
const calculate = (classes = {}, conditions = {}, dex = 16) => {
  if (!Object.keys(classes).length) classes = { soldier: 1 };
  const items = Object.keys(classes).map(ci);
  items.push({
    id: "bonuses",
    name: "Defense test modifiers",
    type: "origin",
    system: {
      bonuses: [
        { target: "defense", value: "2", bonusType: "dodge" },
        { target: "defense", value: "-1", bonusType: "dodge" },
        { target: "defense", value: "2", bonusType: "unnamed" }
      ]
    }
  });
  return computeAgent(
    {
      conditionContext: conditions,
      abilities: Object.fromEntries(
        ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: k === "dex" ? dex : 12 }])
      ),
      progression: Object.entries(classes).flatMap(([classId, n]) =>
        Array.from({ length: n }, () => ({ classId, vitality: 6, skills: {} }))
      ),
      actionDice: { value: 2 },
      wounds: { value: 4 },
      vitality: { value: 4 }
    },
    items,
    cfg
  );
};
test("all native Uncanny Dodge levels and legal multiclass combinations use summed legacy grades with the highest offered cap", () => {
  for (let explorer = 0; explorer <= 20; explorer++)
    for (let intruder = 0; intruder <= 20 - explorer; intruder++)
      for (let triggerman = 0; triggerman <= Math.min(10, 20 - explorer - intruder); triggerman++) {
        const s = { classLevels: { explorer, intruder, triggerman } },
          p = uncannyDodgePlan(s),
          cap = explorer || intruder ? 5 : triggerman ? 2 : 0,
          expected = Math.min(
            cap,
            Math.floor(explorer / 4) + Math.floor(intruder / 4) + Math.min(2, Math.floor(triggerman / 4))
          );
        assert.equal(p.grade, expected);
        assert.equal(p.securityBonus, expected >= 3 ? 4 : 0);
        assert.equal(p.cannotBeFlanked, expected >= 2);
        assert.equal(p.cannotBeFlatFooted, expected >= 5);
      }
  assert.equal(uncannyDodgePlan({ classLevels: { explorer: 9, triggerman: 5 } }).grade, 3);
});
test("borrowed first grades contribute without inventing later emulated-class offerings; a native class can raise the cap", () => {
  const inheritedClassChoices = [
    { name: "Explorer: Uncanny dodge I", ownerClass: "scientist" },
    { name: "Intruder: Uncanny dodge I", ownerClass: "snoop" }
  ];
  assert.equal(uncannyDodgePlan({ inheritedClassChoices }).grade, 1);
  assert.equal(uncannyDodgePlan({ inheritedClassChoices, classLevels: { triggerman: 4 } }).grade, 2);
  assert.equal(uncannyDodgePlan({ inheritedClassChoices, classLevels: { explorer: 1, triggerman: 4 } }).grade, 3);
  assert.equal(uncannyDodgePlan({ classLevels: { explorer: 3.5 } }).grade, 0);
});
test("flat-footed and invisible incoming attacks remove dodge bonuses; Uncanny Dodge I retains positive DEX only, while V prevents flat-footedness", () => {
  for (const dex of [6, 10, 16])
    for (const level of [0, 4, 8, 12, 16, 20]) {
      const s = calculate(level ? { explorer: level } : {}, {}, dex),
        normal = incomingDefensePlan(s),
        flat = incomingDefensePlan(s, { flatFooted: true }),
        invisible = incomingDefensePlan(s, { invisibleAttacker: true }),
        mod = Math.floor((dex - 10) / 2);
      assert.equal(normal.total, s.defense.total);
      assert.equal(flat.dexterity, level >= 4 ? mod : Math.min(0, mod));
      assert.equal(flat.dodgeLost, level >= 20 ? 0 : 2);
      assert.equal(flat.flatFooted, level < 20);
      assert.equal(invisible.dexterity, level >= 4 ? mod : Math.min(0, mod));
      assert.equal(invisible.dodgeLost, 2);
      assert.equal(invisible.total, s.defense.total - 2 - (level < 4 ? Math.max(0, mod) : 0));
    }
  const s = calculate({ explorer: 4 }, { flatFooted: true });
  assert.equal(s.defense.dexterity, 3);
  assert.equal(s.defense.dodgeLost, 2);
  assert.equal(incomingDefensePlan(s).total, s.defense.total);
});
test("independent vulnerability still removes DEX with Uncanny Dodge V; negative DEX/dodge penalties and unnamed Defense survive", () => {
  for (const status of ["held", "pinned", "unconscious", "stunned", "blinded", "vulnerable"])
    for (const dex of [6, 16]) {
      const s = calculate({ explorer: 20 }, { [status]: true }, dex),
        p = incomingDefensePlan(s, { flatFooted: true, invisibleAttacker: true });
      assert.equal(p.dexterity, Math.min(0, Math.floor((dex - 10) / 2)));
      assert.equal(p.dodgeLost, 2);
      assert.equal(p.total, s.defense.total);
      assert.equal(s.defense.bonus, 1);
      assert.equal(s.actionDice.value, 2);
      assert.equal(s.wounds.value, 4);
    }
});
test("security devices add four once at grade III; II suppresses only flanking, and V retains exact Coup de Grace exceptions and adjacency", () => {
  for (const level of [0, 4, 8, 12, 16, 20]) {
    const s = calculate(level ? { explorer: level } : {}),
      p = incomingDefensePlan(s, { securityDevice: true, flanked: true });
    assert.equal(p.securityBonus, level >= 12 ? 4 : 0);
    assert.equal(p.total, s.defense.total + (level >= 12 ? 4 : 0));
    assert.equal(p.flanked, level < 8);
  }
  for (const condition of ["sleeping", "helpless", "paralyzed", "unconscious"])
    for (const level of [16, 20]) {
      const s = calculate({ explorer: level }, { [condition]: true }),
        near = incomingDefensePlan(s, { adjacent: true });
      assert.equal(near.attackerBonus, condition === "sleeping" ? 6 : 4);
      assert.equal(near.coupDeGraceEligible, level < 20 || ["paralyzed", "unconscious"].includes(condition));
      assert.equal(incomingDefensePlan(s).coupDeGraceEligible, false);
      assert.equal(incomingDefensePlan(s).attackerBonus, condition === "sleeping" ? 2 : 0);
    }
  const s = calculate({ explorer: 20 }, { helpless: true, held: true });
  assert.equal(incomingDefensePlan(s, { adjacent: true }).coupDeGraceEligible, true);
});
test("Eye of the Storm grants +3 adjacent at Triggerman 4 and +6 adjacent/+3 other at 8, all lost when vulnerable", () => {
  for (const n of [3, 4, 7, 8, 10]) {
    const s = calculate({ triggerman: n }),
      normal = incomingDefensePlan(s),
      adjacent = incomingDefensePlan(s, { adjacent: true });
    assert.equal(s.defense.dodgeBonuses, n >= 8 ? 5 : 2);
    assert.equal(adjacent.total - normal.total, n >= 4 ? 3 : 0);
    assert.equal(incomingDefensePlan(s, { adjacent: true, flatFooted: true }).eyeOfStorm, 0);
  }
  assert.throws(() => incomingDefensePlan(calculate(), { flatFooted: "true" }), /circumstance/);
});
test("Uncanny Dodge IV halves every incoming whole loss downward and never discounts own-action penalties", () => {
  for (const grade of [0, 1, 2, 3, 4, 5])
    for (let loss = 0; loss <= 101; loss++) {
      const s = { classLevels: { explorer: grade * 4 } };
      assert.equal(initiativeLossPlan(s, { loss }).loss, grade >= 4 ? Math.floor(loss / 2) : loss);
      assert.equal(initiativeLossPlan(s, { loss, selfInflicted: true }).loss, loss);
    }
  for (const loss of [-1, 0.5, NaN, Infinity, "3"]) assert.throws(() => initiativeLossPlan({}, { loss }));
});
let failPost = false,
  postHook = null,
  input = null,
  posts = [],
  warnings = [];
globalThis.Actor = class {};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, i18n: { localize: s => s }, settings: { get: () => ({}) }, combat: null };
let countSequence = 0;
globalThis.foundry = {
  utils: { randomID: () => `count${++countSequence}`, escapeHTML: s => String(s), deepClone: structuredClone },
  applications: { api: { DialogV2: { input: async () => input } } }
};
globalThis.ui = {
  notifications: {
    warn: s => {
      warnings.push(s);
      return null;
    }
  }
};
globalThis.ChatMessage = {
  getSpeaker: () => ({}),
  async create(d) {
    await postHook?.();
    if (failPost) throw Error("post failed");
    posts.push(d);
    return d;
  }
};
const { SpycraftActor } = await import("../module/documents/actor.mjs");
function actor() {
  game.messages = [];
  failPost = false;
  postHook = null;
  posts = [];
  warnings = [];
  input = null;
  const a = new SpycraftActor();
  Object.assign(a, {
    uuid: "Actor.defense",
    name: "Defense fixture",
    type: "agent",
    isOwner: true,
    system: calculate({ explorer: 16 }),
    statuses: new Set()
  });
  const c = {
    id: "own",
    name: a.name,
    actor: a,
    initiative: 20,
    flags: { spycraft2: { shakenInitiative: shakenInitiativeMarker(a.system, 20) } },
    async update(data) {
      if (Object.hasOwn(data, "initiative")) this.initiative = data.initiative;
      if (data["flags.spycraft2.shakenInitiative"])
        this.flags.spycraft2.shakenInitiative = structuredClone(data["flags.spycraft2.shakenInitiative"]);
      return this;
    }
  };
  game.combat = { id: "combat", started: true, combatants: [c] };
  return { a, c };
}
test("security-device Reflex save uses fresh combined grade, is explicit, and never leaks into Fortitude or ordinary Reflex saves", async () => {
  const { a } = actor();
  a.rollCheck = async (formula, data, options) => ({ formula, ...data, ...options });
  for (const key of ["ref", "fort", "will"]) {
    const base = a.system.saves[key].total;
    assert.equal((await a.rollSave(key, { securityDevice: true })).total, base + (key === "ref" ? 4 : 0));
    assert.equal((await a.rollSave(key)).total, base);
    assert.equal((await a.rollSave(key, { securityDevice: "true" })).securityBonus, 0);
  }
  assert.equal(await a.rollSave("ref", { askContext: true }), null);
});
test("real initiative workflow serializes incoming losses, requires declaration/owned combatant, refunds failed posts and preserves later external edits", async () => {
  let { a, c } = actor();
  assert.equal(await a.sufferInitiativeLoss({ loss: 5 }), null);
  await Promise.all([
    a.sufferInitiativeLoss({ loss: 5, confirmed: true }),
    a.sufferInitiativeLoss({ loss: 5, confirmed: true })
  ]);
  assert.equal(c.initiative, 16);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].flags.spycraft2.initiativeLoss.loss, 2);
  assert.equal(a.system.actionDice.value, 2);
  assert.equal(a.system.wounds.value, 4);
  await a.sufferInitiativeLoss({ loss: 5, selfInflicted: true, confirmed: true });
  assert.equal(c.initiative, 11);
  ({ a, c } = actor());
  failPost = true;
  await assert.rejects(a.sufferInitiativeLoss({ loss: 5, confirmed: true }), /post failed/);
  assert.equal(c.initiative, 20);
  postHook = () => {
    c.initiative = 9;
  };
  await assert.rejects(a.sufferInitiativeLoss({ loss: 5, confirmed: true }), /post failed/);
  assert.equal(c.initiative, 9);
  assert.match(warnings.at(-1), /changed again/);
  failPost = false;
  postHook = null;
  await assert.rejects(a.sufferInitiativeLoss({ loss: 1, confirmed: true, combatantId: "other" }), /combatant/);
  game.combat = null;
  await assert.rejects(a.sufferInitiativeLoss({ loss: 1, confirmed: true }), /combatant/);
});

test("Blinded halves Speed rounded down and removes positive Dexterity/dodge even with Uncanny Dodge V, while independent immobility wins", () => {
  for (const dex of [6, 16]) {
    const normal = calculate({ explorer: 20 }, {}, dex),
      blind = calculate({ explorer: 20 }, { blinded: true }, dex);
    assert.equal(blind.speed, 15);
    assert.equal(blind.vulnerable, true);
    assert.equal(blind.defense.dexterity, Math.min(0, Math.floor((dex - 10) / 2)));
    assert.equal(blind.defense.dodgeLost, 2);
    assert.equal(blind.abilities.dex.value, dex);
    assert.equal(blind.wounds.value, 4);
    assert.equal(blind.actionDice.value, 2);
    assert.equal(blind.attack.ranged, normal.attack.ranged);
  }
  const overlap = calculate({ soldier: 1 }, { blinded: true, exhausted: true });
  assert.equal(overlap.speed, null);
  assert.equal(overlap.conditionSpeedReview, true);
  const immobile = calculate({ soldier: 1 }, { blinded: true, bound: true });
  assert.equal(immobile.speed, 0);
  assert.equal(immobile.conditionSpeedReview, false);
});
test("a blinded target grants opponents +2 at every range; an independent helpless-target +4 adds only within Melee Range", () => {
  for (const adjacent of [false, true])
    for (const withinMeleeRange of [false, true])
      for (const helpless of [false, true]) {
        const s = calculate({ soldier: 1 }, { blinded: true, helpless }),
          p = incomingDefensePlan(s, { adjacent, withinMeleeRange });
        assert.equal(p.blindedAttackerBonus, 2);
        assert.equal(p.helplessAttackerBonus, helpless && (adjacent || withinMeleeRange) ? 4 : 0);
        assert.equal(p.attackerBonus, 2 + p.helplessAttackerBonus);
        assert.equal(p.total, s.defense.total);
        assert.equal(s.actionDice.value, 2);
      }
});

test("Crouched halves Speed once and penalizes only non-adjacent ranged attackers without changing Defense", () => {
  const normal = calculate(),
    s = calculate({}, { crouched: true });
  assert.equal(s.speed, Math.floor(normal.speed / 2));
  assert.equal(s.canRun, true);
  assert.equal(s.defense.total, normal.defense.total);
  for (const ranged of [false, true])
    for (const adjacent of [false, true]) {
      const p = incomingDefensePlan(s, { ranged, adjacent });
      assert.equal(p.crouchedAttackerPenalty, ranged && !adjacent ? -1 : 0);
      assert.equal(p.attackerBonus, p.crouchedAttackerPenalty);
      assert.equal(p.total, s.defense.total);
    }
  const mixed = calculate({}, { crouched: true, blinded: true });
  assert.equal(mixed.speed, null);
  assert.equal(mixed.conditionSpeedReview, true);
  assert.equal(incomingDefensePlan(mixed, { ranged: true }).attackerBonus, 1);
  assert.equal(calculate({}, { crouched: true, bound: true }).speed, 0);
});

test("Prone target penalty applies only to non-adjacent ranged attackers and combines with blindness separately from Defense", () => {
  const s = calculate({}, { prone: true });
  for (const ranged of [false, true])
    for (const adjacent of [false, true]) {
      const p = incomingDefensePlan(s, { ranged, adjacent });
      assert.equal(p.proneAttackerPenalty, ranged && !adjacent ? -2 : 0);
      assert.equal(p.attackerBonus, p.proneAttackerPenalty);
      assert.equal(p.total, s.defense.total);
    }
  assert.equal(incomingDefensePlan(calculate({}, { prone: true, blinded: true }), { ranged: true }).attackerBonus, 0);
});

test("Pinned grants adjacent melee/unarmed attackers +4, while Held alone and ranged/non-adjacent attacks gain no pin bonus", () => {
  for (const held of [false, true])
    for (const pinned of [false, true])
      for (const adjacent of [false, true])
        for (const ranged of [false, true]) {
          const s = calculate({}, { held, pinned }),
            p = incomingDefensePlan(s, { adjacent, ranged }),
            expected = pinned && adjacent && !ranged ? 4 : 0;
          assert.equal(p.pinnedAttackerBonus, expected);
          assert.equal(p.attackerBonus, expected);
          assert.equal(p.helpless, false);
          assert.equal(p.vulnerable, held || pinned);
          assert.equal(p.total, s.defense.total);
        }
  const p = incomingDefensePlan(calculate({}, { pinned: true, blinded: true }), { adjacent: true });
  assert.equal(p.attackerBonus, 6);
  assert.equal(p.helplessAttackerBonus, 0);
});
import { weaponAttack } from "../module/rules/gear.mjs";
test("the pinned-target bonus is applied once across every catalog weapon without changing damage, range, threat, error or restrictions", () => {
  const equipment = JSON.parse(readFileSync(new URL("../src/data/equipment.json", import.meta.url))),
    s = calculate();
  for (const w of equipment.weapons) {
    const normal = weaponAttack(s, w, cfg),
      p = weaponAttack(s, w, cfg, "agent", { targetPinnedAdjacent: true }),
      ignored = weaponAttack(s, w, cfg, "agent", { targetPinnedAdjacent: false }),
      expected = normal.ranged ? 0 : 4;
    assert.equal(p.pinnedTargetBonus, expected, w.name);
    assert.equal(p.total, normal.total + expected, w.name);
    assert.equal(ignored.total, normal.total, w.name);
    for (const key of ["blocked", "reason", "range", "threat", "error", "recoilPenalty"])
      assert.deepEqual(p[key], normal[key], w.name + "/" + key);
  }
  assert.equal(equipment.weapons.length, 458);
});
test("the actual attack dialog and receipt retain the scoped Pinned-target declaration and arithmetic", async () => {
  const { a } = actor(),
    item = {
      id: "blade",
      uuid: "Item.blade",
      name: "QA blade",
      system: { proficiency: "edged", damage: "1d6", errorThreat: "1/20", sizeHands: "S/1h", qualities: "" }
    };
  game.combat = null;
  a.rollCheck = async (formula, data, flags) => ({ formula, data, flags });
  const normal = await a.rollAttack(item, {});
  input = { targetPinnedAdjacent: true };
  const pin = await a.rollAttack(item, { askContext: true });
  assert.equal(pin.flags.attackContext.targetPinnedAdjacent, true);
  assert.equal(pin.flags.attackContext.pinnedTargetBonus, 4);
  assert.equal(pin.data.total, normal.data.total + 4);
  assert.equal(a.system.actionDice.value, 2);
});
test("other Initiative losses and their post-failure rollback preserve a protected Shaken component instead of replacing it with the full check penalty", async () => {
  for (const fail of [false, true]) {
    const { a, c } = actor();
    a.effects = [
      {
        id: "shaken",
        uuid: "Effect.shaken",
        name: "Shaken",
        active: true,
        statuses: new Set(["shaken-2"]),
        flags: { spycraft2: { shakenGrade: 2, shakenSelfInflicted: false } }
      }
    ];
    a.appliedEffects = a.effects;
    a.system.shakenState = shakenStateFromActor(a);
    c.initiative = 18;
    c.flags.spycraft2.shakenInitiative = { ...shakenInitiativeMarker(a.system, 18), includedPenalty: -2 };
    game.combats = [game.combat];
    failPost = fail;
    if (fail) await assert.rejects(a.sufferInitiativeLoss({ loss: 5, confirmed: true }), /post failed/);
    else await a.sufferInitiativeLoss({ loss: 5, confirmed: true });
    assert.equal(c.initiative, fail ? 18 : 16);
    assert.equal(c.flags.spycraft2.shakenInitiative.includedPenalty, -2);
    a.effects = [];
    a.appliedEffects = [];
    await reconcileShakenInitiative(a);
    assert.equal(c.initiative, fail ? 20 : 18);
    assert.equal(c.flags.spycraft2.shakenInitiative.includedPenalty, 0);
  }
});
test("a committed initiative-loss post retains the actual loss and independent later Count changes instead of refunding a posted event", async () => {
  const create = ChatMessage.create;
  try {
    for (const later of [0, 3]) {
      const { a, c } = actor();
      ChatMessage.create = async data => {
        game.messages.push(data);
        c.initiative -= later;
        throw Error("post committed then failed");
      };
      const r = await a.sufferInitiativeLoss({ loss: 5, confirmed: true });
      assert.equal(r.after, 18);
      assert.equal(c.initiative, 18 - later);
      assert.equal(game.messages.length, 1);
      assert.ok(game.messages[0].flags.spycraft2.initiativeLossReceiptId);
      assert.equal(c.flags.spycraft2.shakenInitiative.includedPenalty, 0);
    }
  } finally {
    ChatMessage.create = create;
  }
});

test("Armor Mastery bars non-helpless Coup de Grace exceptions while preserving adjacency and Uncanny Dodge V restrictions", () => {
  for (const mastery of [false, true])
    for (const helpless of [false, true])
      for (const adjacent of [false, true])
        for (const exception of [false, true]) {
          const s = calculate({}, { helpless });
          s.armorFeatRules = { coupDeGraceRequiresHelpless: mastery, sneakAttackImmune: mastery };
          s.armorDRByAttack = { meleeWeapon: 7 };
          const p = incomingDefensePlan(s, {
            adjacent,
            coupDeGraceException: exception,
            coupDeGraceExceptionSource: exception ? "Actual class option" : ""
          });
          assert.equal(p.coupDeGraceEligible, adjacent && (helpless || exception) && (!mastery || helpless));
          assert.equal(p.sneakAttackImmune, mastery);
          assert.equal(p.listedDR.meleeWeapon, 7);
        }
  for (const s of [calculate({ explorer: 20 }), calculate({ explorer: 20 }, { helpless: true })])
    assert.equal(
      incomingDefensePlan(s, {
        adjacent: true,
        coupDeGraceException: true,
        coupDeGraceExceptionSource: "Actual class option"
      }).coupDeGraceEligible,
      false
    );
  assert.throws(() => incomingDefensePlan(calculate(), { coupDeGraceException: true }), /Name/);
  assert.throws(() => incomingDefensePlan(calculate(), { coupDeGraceException: "true" }), /circumstance/);
});
test("Whatever's Handy adds its bonus to Defense only while an improvised weapon is readied", () => {
  const circumstances = {
    flatFooted: false,
    invisibleAttacker: false,
    flanked: false,
    securityDevice: false,
    adjacent: true,
    withinMeleeRange: true,
    ranged: false,
    coupDeGraceException: false
  };
  const brawler = calculate({ soldier: 4, brawler: 5 });
  const bare = incomingDefensePlan(brawler, circumstances).total;
  const armed = incomingDefensePlan({ ...brawler, readiedImprovised: true }, circumstances);
  assert.equal(armed.total - bare, 2);
  assert.ok(armed.notes.some(note => note.includes("Whatever's Handy")));
  const soldier = calculate({ soldier: 5 });
  assert.equal(
    incomingDefensePlan({ ...soldier, readiedImprovised: true }, circumstances).total,
    incomingDefensePlan(soldier, circumstances).total
  );
});
