import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import {
  isPistol,
  styleOverCaliberEligible,
  styleOverCaliberWeapon,
  STYLE_OVER_CALIBER_DAMAGE
} from "../module/rules/style-over-caliber.mjs";
import { weaponDamage } from "../module/rules/gear.mjs";
import { rollPipeline } from "../module/rules/roll-pipeline.mjs";

const feats = JSON.parse(readFileSync(new URL("../src/data/feats.json", import.meta.url)));
const cls = JSON.parse(readFileSync(new URL("../src/data/classes.json", import.meta.url))).find(
  c => c.key === "soldier"
);
const sword = (patch = {}) => ({
  id: "sword",
  name: "Sabre",
  type: "weapon",
  system: { proficiency: "edged", sizeHands: "S/1h", equipped: true, carried: true, quantity: 1, ...patch }
});
function agent(names, items = [sword()]) {
  return computeAgent(
    {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
      progression: Array.from({ length: 12 }, () => ({ classId: "soldier", vitality: 6, skills: {} })),
      skills: {},
      focuses: {},
      proficiencies: { edged: { proficient: true } },
      misc: {},
      conditionContext: {},
      actionDice: { value: 0 },
      vitality: { value: 4 },
      wounds: { value: 4 }
    },
    [
      {
        id: "soldier",
        name: cls.name,
        type: "class",
        system: { ...structuredClone(cls), identifier: "soldier", vitalityDie: cls.vitality }
      },
      ...names.map((name, i) => ({
        id: "f" + i,
        name,
        type: "feat",
        system: { ...structuredClone(feats.find(f => f.name === name)), acquiredAtLevel: 1 + i }
      })),
      ...items
    ],
    cfg
  );
}

test("Dueling Supremacy adds a +2 dodge bonus to Defense", () => {
  const base = agent(["Dueling Basics", "Dueling Mastery"], []),
    s = agent(["Dueling Basics", "Dueling Mastery", "Dueling Supremacy"], []);
  assert.equal(s.featStatus.f2.ok, true, JSON.stringify(s.featStatus.f2));
  assert.equal(s.defense.total - base.defense.total, 2);
  assert.equal(s.defense.dodgeBonuses - (base.defense.dodgeBonuses ?? 0), 2);
});

test("Dueling Mastery adds +1 to Defense only while a readied melee weapon is held", () => {
  const held = agent(["Dueling Basics", "Dueling Mastery"]),
    none = agent(["Dueling Basics", "Dueling Mastery"], []),
    stowed = agent(["Dueling Basics", "Dueling Mastery"], [sword({ equipped: false })]),
    gun = agent(["Dueling Basics", "Dueling Mastery"], [sword({ proficiency: "handgun", sizeHands: "D/1h" })]),
    without = agent(["Dueling Basics"]);
  assert.equal(held.featStatus.f1.ok, true);
  assert.equal(held.defense.total - none.defense.total, 1);
  assert.equal(stowed.defense.total, none.defense.total);
  assert.equal(gun.defense.total, none.defense.total);
  assert.equal(held.defense.total - without.defense.total, 1);
});

test("Style Over Caliber swaps only a pistol's standard damage for 1d10+2", () => {
  const owner = { activeFeatNames: ["Style Over Caliber"] },
    pistol = {
      proficiency: "handgun",
      damage: "1d6+1",
      qualities: "AP 2",
      sourceTable: "Table 4.38: service pistol Picks"
    };
  assert.ok(isPistol(pistol));
  assert.ok(isPistol({ proficiency: "handgun" }), "a hand-built handgun counts");
  assert.equal(isPistol({ proficiency: "handgun", sourceTable: "Table 4.30: blunt melee weapon Picks" }), false);
  assert.equal(isPistol({ proficiency: "rifle" }), false);
  assert.equal(styleOverCaliberEligible({ activeFeatNames: [] }, pistol), false);
  const swapped = styleOverCaliberWeapon(owner, pistol, { styleOverCaliber: true });
  assert.equal(swapped.damage, STYLE_OVER_CALIBER_DAMAGE);
  assert.equal(swapped.qualities, "AP 2");
  assert.equal(styleOverCaliberWeapon(owner, pistol, {}), pistol);
  assert.throws(() => styleOverCaliberWeapon({ activeFeatNames: [] }, pistol, { styleOverCaliber: true }), /needs/);
  assert.match(weaponDamage({ abilities: { str: { mod: 0 } } }, swapped).formula, /1d10/);
  const html = rollPipeline.dialog({
    dialog: "damage",
    actor: { system: owner, limitedUseStatus: [] },
    item: { system: pistol },
    attackBonusHits: [],
    automaticAttackBonus: null,
    sideHits: [],
    targetChoices: { actors: [], selected: "" },
    trickSneakHit: null
  });
  assert.match(html, /name="styleOverCaliber"/);
});

test("Dueling controls: Supremacy on the owner's melee-weapon hit, Mastery for the GC on a miss against its owner", async () => {
  await import("../module/apps/dueling.mjs");
  const target = { uuid: "Actor.duelist", system: { activeFeatNames: ["Dueling Mastery"] } };
  globalThis.fromUuidSync = uuid => (uuid === target.uuid ? target : null);
  const attack = patch => ({
    checkKind: "attack",
    resolved: true,
    weaponProficiency: "edged",
    attackContext: { ranged: false, targetActorUuid: target.uuid },
    ...patch
  });
  const labels = (check, actorFeats, isGM = false) =>
    (
      rollPipeline.chatControls({
        message: { uuid: "ChatMessage.m", flags: { spycraft2: check } },
        check,
        actor: { uuid: "Actor.a", system: { activeFeatNames: actorFeats } },
        user: { isGM },
        checkKind: "attack"
      }) ?? []
    ).map(c => c.label);
  assert.ok(labels(attack({ successConfirmed: true }), ["Dueling Supremacy"]).some(l => /Supremacy/.test(l)));
  assert.equal(
    labels(attack({ successConfirmed: true, weaponProficiency: "unarmed" }), ["Dueling Supremacy"]).some(l =>
      /Supremacy/.test(l)
    ),
    false,
    "unarmed is not a melee weapon"
  );
  assert.equal(
    labels(attack({ successConfirmed: true, duelingSupremacy: { amount: 1 } }), ["Dueling Supremacy"]).length,
    0,
    "once per hit"
  );
  assert.ok(
    labels(attack({ successConfirmed: false, weaponProficiency: "handgun" }), [], true).some(l => /Mastery/.test(l))
  );
  assert.equal(labels(attack({ successConfirmed: false }), [], false).length, 0, "the GC confirms adjacency");
  assert.equal(labels(attack({ successConfirmed: true }), [], true).length, 0, "only on a miss");
});
