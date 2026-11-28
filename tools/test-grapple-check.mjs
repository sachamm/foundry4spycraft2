import test from "node:test";
import assert from "node:assert/strict";
import "../module/rolls/index.mjs";
import { grappleSkillChecks, grappleCheckPlan, GRAPPLE_CHECK } from "../module/rules/grapple-check.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { conditionRollPenalties } from "../module/rules/attributes.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const state = (feats, extra = {}) => ({
  activeFeatNames: feats,
  classOptionSelections: [],
  skillTotals: Object.fromEntries(
    Object.values(cfg.skills).map(s => [
      s.key,
      { name: s.name, ranks: 5, cap: 50, threat: 20, totals: s.abilities.map(ability => ({ ability, total: 8 })) }
    ])
  ),
  ...extra
});
const roll = (system, input = {}) =>
  resolveSkillCheck(system, "athletics", GRAPPLE_CHECK, { synergySkill: "none", gearStatus: "available", ...input });

test("Grapple is a named Athletics check", () => {
  assert.ok(grappleSkillChecks("athletics", []).some(c => c.id === "grapple"));
  assert.deepEqual(grappleSkillChecks("notice", []), []);
});

test("second-opponent, Mute and converted-damage penalties reach actual skill planning without double-counting a second hold", () => {
  const system = state([]),
    base = roll(system).total;
  assert.equal(roll(system, { grappleSecondOpponent: true }).total, base - 4);
  assert.equal(roll(system, { grappleHoldingTwo: true, grappleSecondOpponent: true }).total, base - 4);
  const plan = roll(system, { grappleHoldingTwo: true, grappleMuting: true, grappleDamageConversion: true });
  assert.equal(plan.total, base - 10);
  assert.equal(plan.grappleFeats.second, true);
  assert.equal(plan.grappleFeats.muting, true);
  assert.equal(plan.grappleFeats.conversion.attackPenalty, -4);
  const climb = cfg.skills.athletics.checks.find(c => c.id === "climb");
  assert.equal(
    resolveSkillCheck(system, "athletics", climb, { grappleHoldingTwo: true }).total,
    resolveSkillCheck(system, "athletics", climb).total - 4
  );
  assert.equal(grappleCheckPlan(system, "notice", { id: "awareness" }, { grappleHoldingTwo: true }).bonuses.length, 0);
});

test("grapple conversion uses actual Bludgeon or readied Club Basics waivers and rejects missing or two-handed weapons", () => {
  const plain = state([]),
    bludgeon = state(["Bludgeon"]),
    input = { grappleDamageConversion: true };
  assert.equal(roll(bludgeon, input).total, roll(bludgeon).total);
  assert.equal(roll(bludgeon, input).grappleFeats.conversion.waivedBy, "Bludgeon");
  const club = {
      id: "club",
      type: "weapon",
      name: "Club",
      system: { proficiency: "blunt", damage: "1d6 lethal", equipped: true, sizeHands: "Small/1h" }
    },
    system = state(["Club Basics"], {
      readiedMeleeWeapons: [
        { id: "club", name: "Club", family: "club", proficiency: "blunt", hands: 1, requiredHands: 1 }
      ]
    }),
    plan = options =>
      grappleCheckPlan(system, "athletics", GRAPPLE_CHECK, {
        ...input,
        grappleConversionWeaponId: "club",
        grappleConversionWeapon: club,
        ...options
      });
  assert.equal(plan().evidence.conversion.waivedBy, "Club Basics");
  assert.equal(plan().evidence.conversion.from, "lethal");
  assert.equal(plan().evidence.conversion.attackPenalty, 0);
  assert.ok(plan({ grappleConversionWeapon: null }).blockedReason);
  club.system.sizeHands = "Medium/2h";
  assert.ok(plan().blockedReason);
  assert.equal(roll(plain, { ...input, grappleConversionFrom: "lethal" }).grappleFeats.conversion.to, "subdual");
});

test("Prone Stance +1, Horde Mastery +1 morale and Garrote Basics threat +2 apply to Grapple checks", () => {
  const plain = roll(state([]));
  const prone = roll(state(["Submission Basics"], { combatStance: { version: 1, id: "p", key: "prone" } }));
  assert.equal(prone.total, plain.total + 1);
  assert.equal(roll(state(["Horde Mastery"]), { grappleAdvantageConfirmed: true }).total, plain.total + 1);
  assert.equal(roll(state(["Horde Mastery"])).total, plain.total);
  const garrote = roll(state(["Garrote Basics"]), { grappleGarrote: true });
  assert.equal(garrote.threat, plain.threat - 2);
  assert.match(
    grappleCheckPlan(state(["Garrote Basics"]), "athletics", GRAPPLE_CHECK, { grappleGarrote: true }).notes[0],
    /mute/
  );
});

test("Prone Stance turns becoming sprawled into becoming prone", () => {
  const sys = {
    activeFeatNames: ["Submission Basics"],
    combatStance: { key: "prone" },
    conditionContext: { sprawled: true }
  };
  const c = conditionRollPenalties(sys);
  assert.deepEqual([c.sprawled, c.prone], [false, true]);
  const plain = conditionRollPenalties({ activeFeatNames: [], conditionContext: { sprawled: true } });
  assert.deepEqual([plain.sprawled, plain.prone], [true, false]);
});

test("Submission Basics doubles Cheap Shot penalties; Submission Supremacy allows a different one", async () => {
  const { cheapShotApplyPlan, cheapShotPenalty, cheapShotSpeedPenalty } =
    await import("../module/rules/cheap-shot-effects.mjs");
  const hit = (choice, extra = {}) => ({
    checkKind: "attack",
    resolved: true,
    successConfirmed: true,
    actorUuid: "Actor.a",
    attackContext: { cheapShot: { active: true, choice, scene: "s", madeAt: 10 } },
    ...extra
  });
  const base = { usagePeriods: { scene: "s" }, cheapShots: [] };
  const first = cheapShotApplyPlan(base, hit("dex"), {
    sourceMessage: "M1",
    now: 20,
    scene: "s",
    doubled: true
  }).record;
  const sys = { ...base, cheapShots: [first] };
  assert.equal(cheapShotPenalty(sys, "dex"), -4);
  assert.throws(
    () => cheapShotApplyPlan(sys, hit("str"), { sourceMessage: "M2", now: 20, scene: "s" }),
    /already suffered/
  );
  assert.throws(
    () => cheapShotApplyPlan(sys, hit("dex"), { sourceMessage: "M2", now: 20, scene: "s", supremacy: true }),
    /not already suffered/
  );
  const second = cheapShotApplyPlan(sys, hit("speed"), {
    sourceMessage: "M2",
    now: 20,
    scene: "s",
    supremacy: true
  }).record;
  const both = { ...base, cheapShots: [first, second] };
  assert.equal(second.repeat, true);
  assert.equal(cheapShotSpeedPenalty(both), -10);
  assert.equal(cheapShotPenalty(both, "dex"), -4);
});

test("Stone Cold stacks +1 Intimidate per confirmed drop this combat, to +4; Glint of Madness states its stress", async () => {
  const { woundDropRecord, stoneColdIntimidateBonus, woundDropEligible } =
    await import("../module/rules/wound-drop.mjs");
  let r = null;
  for (let i = 0; i < 6; i++) r = woundDropRecord({ woundDrops: r }, "c");
  assert.equal(r.count, 6);
  assert.equal(woundDropRecord({ woundDrops: r }, "d").count, 1, "a new combat starts again");
  const sys = { activeFeatNames: ["Stone Cold"], woundDrops: r, currentCombatId: "c" };
  assert.equal(stoneColdIntimidateBonus(sys), 4);
  assert.equal(stoneColdIntimidateBonus({ ...sys, currentCombatId: "d" }), 0);
  const hit = { checkKind: "attack", resolved: true, successConfirmed: true, rollCombat: { id: "c" } };
  assert.ok(woundDropEligible({ activeFeatNames: ["Glint of Madness"] }, hit));
  assert.equal(woundDropEligible({ activeFeatNames: [] }, hit), false);
  assert.equal(woundDropEligible(sys, { ...hit, woundDrop: true }), false);
});

test("One Warning lets a Spirit Moves character Threaten an uninjured target", async () => {
  const { threatenCheckPlan } = await import("../module/rules/threaten.mjs");
  const combat = { id: "c", started: true, round: 1, turn: 0, combatantId: "own", ownTurnIndex: 0 };
  const input = extra => ({
    threatenOpponentName: "Vex",
    threatenOpponentConfirmed: true,
    threatenContextConfirmed: true,
    threatenDistanceFeet: 10,
    threatenCombat: combat,
    ...extra
  });
  const sys = feats => ({ activeFeatNames: feats, cqbRange: 30, readiedRangedWeapons: [] });
  const check = { id: "threaten" };
  assert.match(
    threatenCheckPlan(sys([]), "intimidate", check, input({ threatenOneWarning: true })).blockedReason,
    /lost5vitality/
  );
  const plan = threatenCheckPlan(sys(["Spirit Moves"]), "intimidate", check, input({ threatenOneWarning: true }));
  assert.equal(plan.blockedReason, "");
  assert.equal(plan.evidence.target.oneWarning, true);
  assert.match(plan.notes[0], /One Warning/);
  const { shatterWeaponEligible } = await import("../module/apps/shatter-weapon.mjs");
  const def = { activeFeatNames: ["Spirit Moves"], totalDefenseState: { active: true } };
  assert.ok(shatterWeaponEligible(def, { checkKind: "attack", resolved: true }));
  assert.equal(shatterWeaponEligible(def, { checkKind: "attack", resolved: true, ranged: true }), false);
});

test("Snake Strike: once per opponent per combat with an unused weapon; one sneak die on its next hit this round", async () => {
  const { snakeStrikePlan, snakeStrikeOpen } = await import("../module/rules/snake-strike.mjs");
  const { sneakAttackSources } = await import("../module/rules/sneak-attack.mjs");
  const sys = { activeFeatNames: ["Snake Strike"], snakeStrikes: [] };
  const combat = { id: "c", started: true, round: 2 };
  const args = { targetUuid: "Actor.t", weaponId: "w", weaponUuid: "Item.w", feintWonConfirmed: true };
  const record = { ...snakeStrikePlan(sys, combat, args), id: "S1" };
  assert.throws(
    () =>
      snakeStrikePlan(sys, combat, {
        ...args,
        posted: [{ checkKind: "attack", weaponUuid: "Item.w", rollCombat: { id: "c" } }]
      }),
    /not used yet/
  );
  const after = { ...sys, snakeStrikes: [record] };
  assert.throws(() => snakeStrikePlan(after, combat, args), /already used against this opponent/);
  const open = q => snakeStrikeOpen(after, { combatId: "c", round: 2, weaponId: "w", targetUuid: "Actor.t", ...q });
  assert.equal(open({}).id, "S1");
  assert.equal(open({ round: 3 }), null);
  assert.equal(open({ posted: [{ checkKind: "damage", snakeStrike: "S1" }] }), null);
  const rows = sneakAttackSources(
    { activeFeatNames: [] },
    { proficiency: "rifle", range: 100 },
    { trickSneak: { source: "Snake Strike", dice: 1 } }
  );
  assert.deepEqual(rows.find(r => r.source === "Snake Strike")?.dice, 1);
});

test("Clobber rides the Grapple check; Joint Lock hampers escape; Berserker Supremacy resists frenzy", async () => {
  const { skillTrickPlan } = await import("../module/rules/skill-tricks.mjs");
  const sys = { activeFeatNames: ["Battering Blows", "Darting Weapon"], unarmed: { die: 4, damageBonus: 1 } };
  const one = skillTrickPlan(sys, "athletics", { id: "grapple" }, { skillTrick: "clobber" });
  assert.equal(one.sizeBonus, -2);
  assert.match(one.notes[0], /weapon’s damage 2 time\(s\)/);
  assert.equal(
    skillTrickPlan(sys, "athletics", { id: "grapple" }, { skillTrick: "clobber", skillTrickTwoHanded: true }).sizeBonus,
    -4
  );
  const escape = { id: "restraint-escape" };
  assert.deepEqual(grappleCheckPlan(state([]), "athletics", escape, { grappleJointLock: true }).bonuses, [
    { source: "Joint Lock", value: -4 }
  ]);
  assert.deepEqual(grappleCheckPlan(state([]), "athletics", GRAPPLE_CHECK, { grappleJointLock: true }).bonuses, []);
  const { frenzySaveBonus } = await import("../module/rules/berserker.mjs");
  assert.equal(frenzySaveBonus({ activeFeatNames: ["Berserker Supremacy"] }, { resistFrenzy: true }), 4);
  assert.equal(frenzySaveBonus({ activeFeatNames: [] }, { resistFrenzy: true }), 0);
});
