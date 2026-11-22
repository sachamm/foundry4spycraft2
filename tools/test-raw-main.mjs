import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { computeAgent } from "../module/rules/engine.mjs";

const read = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const origins = read("origins");
const allOrigins = [...origins.talents, ...origins.specialties];
const makeOrigin = (name, originChoices = {}) => {
  const data = allOrigins.find(o => o.name === name);
  return { id: name, name, type: "origin", system: { ...data, originChoices } };
};
function agent(level = 1, bases = {}) {
  return {
    abilities: Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: bases[k] ?? 10, misc: 0 }])
    ),
    progression: Array.from({ length: level }, () => ({ classId: "test", vitality: 1, skills: {} })),
    abilityIncreases: {},
    skills: {},
    focuses: {},
    proficiencies: {},
    misc: {},
    pointBuyBudget: 36
  };
}
function compute(level = 1, items = [], bases = {}) {
  const sys = agent(level, bases);
  const cls = {
    id: "test",
    name: "Test",
    type: "class",
    system: { identifier: "test", skillPoints: 4, vitalityDie: 6, table: [], classSkills: [], bonuses: [] }
  };
  return computeAgent(sys, [cls, ...items], cfg);
}

test("RAW p.15: all eleven creation point costs and all six attribute modifiers", () => {
  const costs = [0, 1, 2, 3, 4, 6, 8, 11, 14, 18, 22];
  for (let score = 8; score <= 18; score++) {
    const sys = compute(1, [], Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, score])));
    assert.equal(sys.pointBuy.spent, 6 * costs[score - 8]);
    for (const ability of Object.values(sys.abilities)) assert.equal(ability.mod, Math.floor((score - 10) / 2));
  }
  for (const score of [1, 3, 5, 7, 19, 20])
    assert.ok(compute(1, [], { str: score }).warnings.some(w => w.startsWith("STR") && w.includes("point-buy")));
});

test("RAW pp.16,59: vitality has a per-level minimum and responds retroactively to Constitution", () => {
  const sys = compute(3, [], { con: 1 });
  assert.equal(sys.vitality.max, 3); // d6−5=1, 1−5→1, 1−5→1.
  assert.equal(compute(3, [], { con: 14 }).vitality.max, 14); // 6+2, 1+2, 1+2.
});

test("RAW p.27: all twenty-one action-die and XP rows, including level 18", () => {
  const xp = [
    0, 1000, 3000, 6000, 12000, 20000, 35000, 55000, 80000, 110000, 150000, 195000, 250000, 310000, 380000, 460000,
    550000, 650000, 760000, 875000, 1000000
  ];
  for (let level = 0; level <= 20; level++) {
    const sys = compute(level);
    const band = level === 0 ? 0 : Math.floor((level - 1) / 5);
    assert.equal(sys.actionDice.max, level === 0 ? 2 : 3 + band);
    assert.equal(sys.actionDice.die, 4 + 2 * band);
    assert.equal(cfg.tables.levels[level].xp, xp[level]);
    assert.equal(sys.xpNext, level === 20 ? null : xp[level + 1]);
  }
});

test("RAW p.218: every carrying table row and high-Strength multiplier", () => {
  const light = [
    3, 6, 10, 13, 16, 20, 23, 26, 30, 33, 38, 43, 50, 58, 66, 76, 86, 100, 116, 133, 153, 173, 200, 233, 266, 306, 346,
    400, 466
  ];
  const medium = [
    6, 13, 20, 26, 33, 40, 46, 53, 60, 66, 76, 86, 100, 116, 133, 153, 173, 200, 233, 266, 306, 346, 400, 466, 533, 613,
    693, 800, 933
  ];
  const heavy = [
    10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 115, 130, 150, 175, 200, 230, 260, 300, 350, 400, 460, 520, 600, 700, 800,
    920, 1040, 1200, 1400
  ];
  for (let str = 1; str <= 49; str++) {
    const steps = str < 30 ? 0 : Math.floor((str - 20) / 10),
      key = str - steps * 10 - 1,
      factor = 4 ** steps;
    const carry = compute(1, [], { str }).carry;
    assert.deepEqual(
      [
        carry.light,
        carry.medium,
        carry.heavy,
        carry.extreme,
        carry.overload,
        carry.liftOverhead,
        carry.liftGround,
        carry.push
      ],
      [
        light[key] * factor,
        medium[key] * factor,
        heavy[key] * factor,
        heavy[key] * 2 * factor,
        heavy[key] * 2 * factor + 1,
        heavy[key] * factor,
        heavy[key] * 2 * factor,
        heavy[key] * 5 * factor
      ]
    );
  }
  assert.equal(compute(1, [], { str: 0 }).carry.heavy, 0);
});

// Independently transcribed unconditional Main-tab origin benefits, pp.18–26.
// Columns: STR, DEX, CON, INT, WIS, CHA, speed, baseDefense, Fort, Ref, Will, Initiative, Knowledge, wounds, vitality, stress, subdual, actionDieBonus, actionDieCount.
const expected = {
  Adaptable: { actionDieBonus: "t1" },
  Agile: { str: -2, dex: 2, speed: 5, ref: "t1" },
  Brainy: { str: -2, int: 2, knowledge: "t1" },
  Burly: { str: 2, dex: -2, baseDefense: 1, wounds: "t1" },
  Caustic: { wis: -2, cha: 2 },
  Clever: { con: -2, int: 2, ref: "t1" },
  Convincing: { int: -2, cha: 2 },
  Cunning: { int: 2, wis: -2 },
  Daring: { dex: 2, int: -2, initiative: "t1", actionDieBonus: "t1" },
  Disciplined: { will: "t1" },
  Fierce: { str: 2, cha: -2, initiative: "t1" },
  Fit: { str: 2, int: -2, speed: 5, fort: "t1" },
  Gifted: {},
  Gonzo: { wounds: "t1" },
  Graceful: { dex: 2, con: -2 },
  Grizzled: { dex: -2, con: 2, baseDefense: 2, wounds: "t1" },
  Mysterious: { baseDefense: 1 },
  Orphaned: { actionDieCount: 1 },
  Persistent: { con: 2, cha: -2, fort: "t1" },
  Privileged: {},
  Reliable: {},
  Resolute: { dex: -2, wis: 2, will: "t1" },
  Retired: {},
  Rowdy: { con: 2, wis: -2, speed: 5 },
  Shrewd: { con: -2, wis: 2 },
  Veteran: {},
  Vigilant: { wis: 2, cha: -2 },
  Witty: { str: -2, cha: 2 },
  Authority: {},
  Celebrity: {},
  "City Dweller": {},
  Clergyman: {},
  "Contract Pro": {},
  Criminal: {},
  Doctor: {},
  Entertainer: {},
  Financier: {},
  Geek: {},
  Grifter: {},
  "Hot Rodder": {},
  Hunter: { speed: 5, subdual: "t3" },
  Icon: {},
  Instructor: {},
  Investigator: {},
  "Jack of All Trades": { knowledge: "t1" },
  Journalist: {},
  Mercenary: {},
  Motorhead: {},
  Operative: {},
  Outdoorsman: {},
  Pickpocket: { speed: 5 },
  Pilot: {},
  Playboy: {},
  Recruit: {},
  Rescuer: { speed: 5 },
  Researcher: {},
  Sailor: {},
  "Special Ops": {},
  Spiritualist: { baseDefense: 1, stress: "t3" },
  Stranger: { stress: "t3" },
  Student: {},
  Suit: {},
  "Test Subject": {},
  "Thrill Seeker": { speed: 5 },
  Tradesman: {},
  Tribesman: {},
  Wanderer: { vitality: "level+1" },
  Warrior: {}
};
test("RAW pp.18–26: all 68 origins have their unconditional Main statistics checked at every career level", () => {
  assert.deepEqual(Object.keys(expected).sort(), allOrigins.map(o => o.name).sort());
  for (const [name, values] of Object.entries(expected))
    for (let level = 1; level <= 20; level++) {
      const sys = compute(level, [makeOrigin(name)]);
      const val = key => {
        const value = values[key] ?? 0;
        return value === "t1"
          ? 1 + Math.floor(level / 4)
          : value === "t3"
            ? 1 + Math.floor(level / 6)
            : value === "level+1"
              ? level + 1
              : value;
      };
      const mods = Object.fromEntries(
        ["str", "dex", "con", "int", "wis", "cha"].map(key => [key, Math.floor(val(key) / 2)])
      );
      for (const key of Object.keys(mods))
        assert.equal(sys.abilities[key].value, 10 + val(key), `${name} L${level} ${key}`);
      assert.equal(sys.speed, 30 + val("speed"), name);
      assert.equal(sys.base.defense, val("baseDefense"), name);
      assert.equal(sys.defense.total, 10 + val("baseDefense") + mods.dex, name);
      for (const [save, key] of [
        ["fort", "con"],
        ["ref", "dex"],
        ["will", "wis"]
      ])
        assert.equal(sys.saves[save].total, mods[key] + val(save), name);
      assert.equal(sys.initiative.total, mods.dex + val("initiative"), name);
      assert.equal(sys.knowledge, level + mods.int + val("knowledge"), name);
      assert.equal(sys.requestCheck, level + mods.cha, name);
      assert.equal(sys.gearCheck, level + mods.wis, name);
      assert.equal(sys.wounds.max, 10 + val("con") + val("wounds"), name);
      assert.equal(
        sys.vitality.max,
        Math.max(1, 6 + mods.con) + (level - 1) * Math.max(1, 1 + mods.con) + val("vitality"),
        name
      );
      assert.equal(sys.stressThreshold, 10 + val("wis") + val("stress"), name);
      assert.equal(sys.subdualThreshold, 10 + val("con") + val("subdual"), name);
      assert.equal(sys.actionDice.bonus, val("actionDieBonus"), name);
      assert.equal(sys.actionDice.max, 3 + Math.floor((level - 1) / 5) + val("actionDieCount"), name);
    }
});

test("RAW pp.19–25: every flexible-attribute origin resolves the chosen +2 and −2", () => {
  for (const name of ["Disciplined", "Gifted", "Gonzo", "Orphaned", "Reliable", "Retired", "Test Subject"]) {
    const bases = name === "Test Subject" ? { str: 16, cha: 8 } : { str: 8, cha: 16 };
    const sys = compute(1, [makeOrigin(name, { up: "str", down: "cha" })], bases);
    assert.equal(sys.abilities.str.value, bases.str + 2, name);
    assert.equal(sys.abilities.cha.value, bases.cha - 2, name);
  }
  const bad = compute(1, [makeOrigin("Reliable", { up: "cha", down: "str" })], { str: 8, cha: 16 });
  assert.equal(bad.abilities.cha.value, 16);
  assert.ok(bad.warnings.some(w => w.includes("creation attribute")));
  assert.ok(compute(1, [makeOrigin("Gifted")]).todo.some(t => t.text.includes("+2")));
});

test("RAW pp.20–24: Gifted and City Dweller grant the chosen skill and its cap; threat choices scale separately", () => {
  for (const name of ["Gifted", "City Dweller"]) {
    const sys = compute(10, [
      makeOrigin(name, { up: "str", down: "cha", classSkill0: "bluff", threatSkill: "notice" })
    ]);
    assert.equal(sys.skillTotals.bluff.isClass, true);
    assert.equal(sys.skillTotals.bluff.cap, compute(10).skillTotals.bluff.cap + 5);
    if (name === "Gifted") assert.equal(sys.skillTotals.notice.threat, 17);
  }
  assert.equal(compute(10, [makeOrigin("Retired", { threatSkill: "notice" })]).skillTotals.notice.threat, 17);
});

test("RAW pp.20–24: class-skill and maximum-rank selections are gained at their actual milestones", () => {
  for (const name of ["Reliable", "Rowdy"]) {
    const selected = makeOrigin(name, { classSkill0: "bluff", classSkill1: "notice" });
    assert.equal(compute(3, [selected]).skillTotals.notice.isClass, false);
    assert.equal(compute(4, [selected]).skillTotals.notice.isClass, true);
  }
  for (const name of ["Contract Pro", "Jack of All Trades"]) {
    assert.equal(compute(4, [makeOrigin(name, { maxRank0: "bluff" })]).skillTotals.bluff.maxRanks, 8);
  }
});

test("RAW pp.25,347–451: all 19 Test Subject qualities are selectable; Fleet and Hulking adjust permanent totals", () => {
  assert.equal(Object.keys(cfg.tables.testSubjectQualities).length, 19);
  for (const key of Object.keys(cfg.tables.testSubjectQualities)) {
    const sys = compute(1, [makeOrigin("Test Subject", { up: "str", down: "cha", npcQuality0: key })], {
      str: 16,
      cha: 8,
      con: 11
    });
    assert.equal(sys.originEffects.length, 1, key);
    assert.ok(sys.originEffects[0].text, key);
  }
  const sys = compute(
    1,
    [makeOrigin("Test Subject", { up: "str", down: "cha", npcQuality0: "hulking", npcQuality1: "fleet" })],
    { str: 16, cha: 8, con: 11 }
  );
  assert.equal(sys.size, "Large (1×1)");
  assert.equal(sys.wounds.max, 16); // 1.5×11, round down.
  assert.equal(sys.defense.total, 9);
  assert.equal(sys.attack.melee, 3); // STR 18 (+4), Large −1.
  assert.equal(sys.speed, 40);
  assert.equal(sys.carry.heavy, 600); // STR 18, 300×2.
});

test("RAW p.59: vitality tooltip components include the minimum adjustment", () => {
  const sys = compute(3, [], { con: 1 });
  assert.deepEqual(sys.vitalityBreakdown, { dice: 8, constitution: -15, minimumAdjustment: 10 });
  assert.equal(
    Object.values(sys.vitalityBreakdown).reduce((a, b) => a + b, 0),
    sys.vitality.max
  );
});

test("Improved Fortune shares add to starting dice once, cap native plus teammates at three, and increase starting-die-based ability limits", () => {
  for (const ownLevel of [1, 10, 20]) {
    const pointman = {
      id: "p",
      name: "Pointman",
      type: "class",
      system: {
        identifier: "pointman",
        table: [],
        classSkills: [],
        skillPoints: 4,
        vitalityDie: 8,
        bonuses: [
          { target: "actionDice.count", value: "1", level: 10 },
          { target: "actionDice.count", value: "1", level: 20 }
        ]
      }
    };
    const base = {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { base: 10 }])),
      progression: Array.from({ length: ownLevel }, () => ({ classId: "pointman", skills: {}, vitality: 4 }))
    };
    const solo = computeAgent(structuredClone(base), [pointman], cfg),
      team = computeAgent(
        {
          ...structuredClone(base),
          fortuneTeammates: [
            { id: "a", level: 20 },
            { id: "b", level: 10 }
          ]
        },
        [pointman],
        cfg
      );
    const native = ownLevel >= 20 ? 2 : ownLevel >= 10 ? 1 : 0;
    assert.equal(solo.improvedFortune.value, native);
    assert.equal(team.improvedFortune.value, 3);
    assert.equal(team.actionDice.max - solo.actionDice.max, 3 - native);
  }
  const soldier = {
    id: "s",
    name: "Soldier",
    type: "class",
    system: { identifier: "soldier", table: [], classSkills: [], skillPoints: 4, vitalityDie: 12 }
  };
  const input = {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { base: 10 }])),
    progression: Array.from({ length: 2 }, () => ({ classId: "soldier", skills: {}, vitality: 6 }))
  };
  const solo = computeAgent(structuredClone(input), [soldier], cfg),
    team = computeAgent(
      {
        ...structuredClone(input),
        fortuneTeammates: [
          { id: "a", level: 20 },
          { id: "b", level: 10 }
        ]
      },
      [soldier],
      cfg
    );
  assert.equal(
    team.limitedUses.find(s => s.id === "fortunesOfWar").limit,
    solo.limitedUses.find(s => s.id === "fortunesOfWar").limit + 3
  );
});

test("Test Subject DR quality applications combine with each other but never add to identical armor/class DR benefits (p.446)", () => {
  for (const [level, grade] of [
    [1, 0],
    [2, 1],
    [11, 2],
    [19, 3]
  ])
    for (const copies of [1, 2])
      for (const armorDR of [0, 1, 4]) {
        const soldier = {
            id: "soldier",
            name: "Soldier",
            type: "class",
            system: {
              ...cfg.classFeatures.soldier,
              identifier: "soldier",
              table: [],
              classSkills: [],
              skillPoints: 4,
              vitalityDie: 12
            }
          },
          subject = makeOrigin("Test Subject", {
            npcQuality0: "damageReduction",
            npcQuality1: copies === 2 ? "damageReduction" : "improvedHearing"
          }),
          armor = {
            id: "armor",
            name: "Synthetic armor",
            type: "armor",
            system: {
              equipped: true,
              armorSlot: "body",
              damageReduction: armorDR,
              damageReductionSubdual: armorDR ? 1 : 0
            }
          },
          source = {
            ...agent(level),
            progression: Array.from({ length: level }, () => ({ classId: "soldier", skills: {}, vitality: 6 }))
          },
          s = computeAgent(source, [soldier, subject, armor], cfg);
        assert.equal(s.qualityNaturalDR, 2 * copies);
        assert.equal(s.naturalDR, Math.max(2 * copies, grade));
        assert.equal(s.dr.melee, Math.max(2 * copies, grade + armorDR));
        assert.equal(s.dr.other, Math.max(2 * copies, grade + (armorDR ? 1 : 0)));
      }
});
test("doubling Fortunes of War never doubles or stacks the quality’s DR, and quality/armor removal recalculates the best applicable benefit", () => {
  const level = 19,
    soldier = {
      id: "soldier",
      name: "Soldier",
      type: "class",
      system: {
        ...cfg.classFeatures.soldier,
        identifier: "soldier",
        table: [],
        classSkills: [],
        skillPoints: 4,
        vitalityDie: 12
      }
    },
    subject = makeOrigin("Test Subject", { npcQuality0: "damageReduction", npcQuality1: "damageReduction" }),
    armor = {
      id: "armor",
      name: "Synthetic armor",
      type: "armor",
      system: { equipped: true, armorSlot: "body", damageReduction: 2, damageReductionSubdual: 1 }
    },
    source = {
      ...agent(level),
      progression: Array.from({ length: level }, () => ({ classId: "soldier", skills: {}, vitality: 6 })),
      usagePeriods: { session: "s" },
      fortunesCombatContext: { id: "c", started: true, round: 1, turn: 0, ownTurnIndex: 0, combatantId: "own" },
      fortunesOfWarBoost: { combatId: "c", combatantId: "own", startRound: 1, dueRound: 2, session: "s" }
    };
  const s = computeAgent(structuredClone(source), [soldier, subject, armor], cfg);
  assert.equal(s.naturalDR, 6);
  assert.equal(s.qualityNaturalDR, 4);
  assert.deepEqual(s.dr, { melee: 8, other: 7 });
  source.fortunesCombatContext.round = 2;
  const expired = computeAgent(structuredClone(source), [soldier, subject, armor], cfg);
  assert.deepEqual(expired.dr, { melee: 5, other: 4 });
  assert.deepEqual(computeAgent(structuredClone(source), [soldier, subject], cfg).dr, { melee: 4, other: 4 });
  assert.deepEqual(computeAgent(structuredClone(source), [soldier, armor], cfg).dr, { melee: 5, other: 4 });
});

const classDefinitions = read("classes");
function fleetFixture({ level = 6, grades = 2, sprint = true, extra = [] } = {}) {
  const d = classDefinitions.find(c => c.key === "intruder"),
    at = d.choiceSchedule.findIndex(s => s.list === "criminalMind" && s.level === 6),
    cls = {
      id: "intruder",
      name: d.name,
      type: "class",
      system: { ...d, identifier: d.key, vitalityDie: d.vitality, choices: sprint ? { [at]: 7 } : {} }
    },
    subject = makeOrigin("Test Subject", {
      up: "str",
      down: "cha",
      npcQuality0: grades ? "fleet" : "fearless",
      npcQuality1: grades === 2 ? "fleet" : "fearless"
    }),
    source = agent(level);
  source.progression = source.progression.map(p => ({ ...p, classId: "intruder" }));
  return { source, items: [cls, subject, ...extra], subject, cls };
}
test("Fleet competes with the actual Intruder Sprint choice at its earned milestone and combines repeated quality applications only with each other", () => {
  for (const level of [1, 5, 6, 9, 20])
    for (const grades of [0, 1, 2]) {
      const f = fleetFixture({ level, grades }),
        s = computeAgent(f.source, f.items, cfg);
      assert.equal(s.speed, 30 + Math.max(level >= 6 ? 10 : 0, 10 * grades), `${level}/${grades}`);
      assert.equal(s.fleetSpeed.grade, grades);
      assert.equal(s.fleetSpeed.normalSpeed, level >= 6 ? 40 : 30);
    }
});
test("Fleet limits only its own contribution to Speed sixty and preserves faster independent/class totals", () => {
  for (const bonus of [0, 10, 20, 40])
    for (const sprint of [false, true]) {
      const feat = {
          id: "speed-feat",
          name: "Synthetic independent Speed",
          type: "feat",
          system: { tree: "basicCombat", acquiredAtLevel: 1, bonuses: [{ target: "speed", value: String(bonus) }] }
        },
        f = fleetFixture({ sprint, extra: [makeOrigin("Agile"), feat] }),
        s = computeAgent(f.source, f.items, cfg),
        normal = 35 + bonus + (sprint ? 10 : 0),
        quality = Math.max(35 + bonus, Math.min(60, 55 + bonus));
      assert.equal(s.speed, Math.max(normal, quality), `${bonus}/${sprint}`);
      assert.equal(s.fleetSpeed.qualityLimit, 60);
    }
});
test("Fleet alternatives preserve named bonus stacking and penalties, compete with positive armor Speed and retain load immobility", () => {
  let f = fleetFixture({ sprint: false });
  f.cls.system.bonuses = [
    { target: "speed", value: "10", bonusType: "insight" },
    { target: "speed", value: "-5", bonusType: "circumstance" }
  ];
  f.items.push({
    id: "speed-feat",
    type: "feat",
    name: "Synthetic insight Speed",
    system: {
      tree: "basicCombat",
      acquiredAtLevel: 1,
      bonuses: [{ target: "speed", value: "8", bonusType: "insight" }]
    }
  });
  let s = computeAgent(f.source, f.items, cfg);
  assert.equal(s.speed, 53);
  const armor = {
    id: "armor",
    type: "armor",
    name: "Synthetic armor Speed",
    system: { equipped: true, armorSlot: "body", speedPenalty: 30 }
  };
  f = fleetFixture({ extra: [armor] });
  s = computeAgent(f.source, f.items, cfg);
  assert.equal(s.speed, 70);
  armor.system.speedPenalty = -10;
  s = computeAgent(f.source, f.items, cfg);
  assert.equal(s.speed, 40);
  f.items.push({
    id: "overload",
    type: "gear",
    name: "Heavy load",
    system: { carried: true, quantity: 1, weight: 100000 }
  });
  s = computeAgent(f.source, f.items, cfg);
  assert.equal(s.speed, 0);
});
test("changing or losing Fleet immediately recalculates the alternative without removing independent class Speed", () => {
  const f = fleetFixture();
  let s = computeAgent(f.source, f.items, cfg);
  assert.equal(s.speed, 50);
  f.subject.system.originChoices.npcQuality1 = "aquatic";
  s = computeAgent(f.source, f.items, cfg);
  assert.equal(s.speed, 40);
  assert.equal(s.survivalStats.underwaterSpeed, 40);
  f.subject.system.originChoices.npcQuality0 = "fearless";
  s = computeAgent(f.source, f.items, cfg);
  assert.equal(s.speed, 40);
  assert.equal(s.fleetSpeed.grade, 0);
  assert.equal(s.fleetSpeed.qualityIncrease, 0);
});

test("the canonical Sprint feat remains independent of Fleet quality/class competition", () => {
  const definitions = read("feats"),
    dash = {
      id: "dash",
      name: "Dash",
      type: "feat",
      system: {
        ...structuredClone(definitions.find(f => f.name === "Dash")),
        granted: true,
        acquiredAtLevel: 1,
        tree: "chase"
      }
    },
    sprint = {
      id: "sprint-feat",
      name: "Sprint",
      type: "feat",
      system: { ...structuredClone(definitions.find(f => f.name === "Sprint")), acquiredAtLevel: 3, tree: "chase" }
    };
  for (const grades of [0, 1, 2])
    for (const classSprint of [false, true]) {
      const f = fleetFixture({ level: 6, grades, sprint: classSprint, extra: [dash, sprint] }),
        s = computeAgent(f.source, f.items, cfg);
      assert.equal(s.featStatus["sprint-feat"].ok, true);
      assert.equal(s.speed, 40 + Math.max(classSprint ? 10 : 0, 10 * grades));
      assert.equal(s.fleetSpeed.independentSpeed, 40);
    }
});
