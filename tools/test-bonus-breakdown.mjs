/**
 * Bonus breakdowns (module/rules/bonus-breakdown.mjs): the rows behind a tooltip always add up to the figure the
 * button or card shows, for every sample agent, and a posted check explains its own total.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildPacks } from "./lib/pack-docs.mjs";
import { computeAgent } from "../module/rules/engine.mjs";
import { SPYCRAFT } from "../module/config.mjs";
import { weaponAttack, weaponDamage } from "../module/rules/gear.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import {
  abilityBreakdown,
  breakdownRows,
  checkBreakdown,
  expandRow,
  skillCheckBreakdown,
  weaponAttackBreakdown
} from "../module/rules/bonus-breakdown.mjs";
import {
  abilityTip,
  agentBonusTips,
  npcSkillTip,
  saveTip,
  skillTip,
  weaponAttackTip
} from "../module/sheets/bonus-tips.mjs";
import { tipHtml, tipLines } from "../module/handlebars-helpers.mjs";
import { breakdownTipRows } from "../module/rolls/chat-breakdown.mjs";

const sum = rows => rows.reduce((total, row) => total + row.value, 0);
const pack = buildPacks().packs["sample-agents"];
const agents = pack.docs.flatMap(doc =>
  [1, 5, 10].map(level => {
    const system = structuredClone(doc.system);
    while (system.progression.length < level) system.progression.push(structuredClone(system.progression[0]));
    const items = doc.embedded.items.map(item => ({ ...structuredClone(item), id: item._id }));
    return { name: `${doc.name} L${level}`, items, system: computeAgent(system, items, SPYCRAFT) };
  })
);
/** A tooltip's rows before its total add up to that total. */
const assertAddsUp = (rows, total, what) => {
  const parts = rows.filter(row => row[2] !== "total");
  const closing = rows.find(row => row[2] === "total");
  assert.ok(closing, `${what}: no total line`);
  assert.equal(closing[1], total, `${what}: total line`);
  assert.equal(
    parts.reduce((n, [, value]) => n + value, 0),
    total,
    `${what}: ${JSON.stringify(rows)}`
  );
};

test("the rows keep what counts and add one for any difference from the total", () => {
  assert.deepEqual(
    breakdownRows(
      [{ label: "Class", value: 0, keep: true }, { label: "DEX", value: 2 }, { label: "Misc", value: 0 }, null],
      5
    ),
    [
      { label: "Class", value: 0 },
      { label: "DEX", value: 2 },
      { label: "Other modifiers", value: 3 }
    ]
  );
  assert.deepEqual(breakdownRows([{ label: "DEX", value: -1 }], -1), [{ label: "DEX", value: -1 }]);
  assert.deepEqual(breakdownRows([], 0), []);
});

test("a row is replaced by its parts only when they add up to it", () => {
  const rows = [
    { label: "Save bonus", value: 5 },
    { label: "Cover", value: 2 }
  ];
  assert.deepEqual(
    expandRow(rows, "Save bonus", [
      { label: "Class", value: 2 },
      { label: "CON", value: 3 }
    ]).map(row => row.label),
    ["Class", "CON", "Cover"]
  );
  assert.equal(expandRow(rows, "Save bonus", [{ label: "Class", value: 2 }]), rows);
  assert.equal(expandRow(rows, "Missing", [{ label: "Class", value: 5 }]), rows);
});

test("every roll bonus on a sample agent's sheet has a tooltip whose rows add up to it", () => {
  for (const { name, system, items } of agents) {
    const tips = agentBonusTips(system);
    assertAddsUp(tips.initiative, system.initiative.total, `${name} initiative`);
    assertAddsUp(tips.knowledge, system.knowledge, `${name} knowledge`);
    assertAddsUp(tips.request, system.requestCheck, `${name} request`);
    assertAddsUp(tips.gearCheck, system.gearCheck, `${name} gear check`);
    assertAddsUp(tips.bab, system.bab, `${name} base attack`);
    for (const kind of ["unarmed", "melee", "ranged"])
      assertAddsUp(tips[`attack${kind[0].toUpperCase()}${kind.slice(1)}`], system.attack[kind], `${name} ${kind}`);
    for (const key of ["fort", "ref", "will"]) {
      const tip = saveTip(system, key, SPYCRAFT.saves[key].ability);
      assertAddsUp(tip, system.saves[key].total, `${name} ${key}`);
      assert.ok(!tip.some(([label]) => label === "Other modifiers"), `${name} ${key}: every part is named`);
    }
    for (const skill of Object.values(system.skillTotals))
      for (const row of skill.totals) {
        const tip = skillTip(system, skill.key, [row.ability]);
        assertAddsUp(tip, row.total, `${name} ${skill.key} ${row.ability}`);
        assert.ok(!tip.some(([label]) => label === "Other modifiers"), `${name} ${skill.key}: every part is named`);
      }
    for (const key of Object.keys(SPYCRAFT.abilities)) {
      const { base, score, value } = abilityBreakdown(system, key);
      assert.equal(base + sum(score), value, `${name} ${key} score`);
      assert.match(abilityTip(system, key, "Name").at(-1)[0], new RegExp(`^Score ${value}: modifier [+-]\\d+$`));
    }
    for (const weapon of items.filter(item => item.type === "weapon")) {
      const attack = weaponAttack(
        system,
        { ...weapon.system, id: weapon.id, name: weapon.name },
        SPYCRAFT,
        "agent",
        {}
      );
      if (!Number.isFinite(attack?.total)) continue;
      const tip = weaponAttackTip(attack);
      assertAddsUp(tip, attack.total, `${name} ${weapon.name}`);
      assert.deepEqual(
        tip.slice(0, 2).map(([label]) => label),
        ["Base attack bonus", attack.ability.toUpperCase()],
        `${name} ${weapon.name}: the base attack bonus and attribute come first, even at +0`
      );
      const damage = weaponDamage(system, { ...weapon.system, id: weapon.id, name: weapon.name }, {}, "agent");
      if (damage?.bonusRows) assert.equal(sum(damage.bonusRows), damage.bonus, `${name} ${weapon.name} damage`);
    }
  }
});

test("a bonus of +0 still says what it is made of", () => {
  const { system } = agents[0];
  const zero = { ...system, initiative: { base: 0, total: 0 }, abilities: { ...system.abilities, dex: { mod: 0 } } };
  assert.deepEqual(agentBonusTips({ ...zero, bonusSources: {}, misc: {} }).initiative, [
    ["Class", 0],
    ["DEX", 0],
    ["Total", 0, "total"]
  ]);
});

test("a skill button with two attributes explains each total", () => {
  const { system } = agents[0];
  const skill = Object.values(system.skillTotals).find(entry => entry.totals.length > 1);
  const tip = skillTip(
    system,
    skill.key,
    skill.totals.map(row => row.ability)
  );
  assert.deepEqual(
    tip.filter(row => row[2] === "total").map(([label, value]) => [label, value]),
    skill.totals.map(row => [`Total with ${row.ability.toUpperCase()}`, row.total])
  );
});

test("an NPC skill button names the grade behind its bonus and says the attribute is added", () => {
  const tip = npcSkillTip({ competence: 3, listed: 6, bonus: 6, normalBonus: 6 });
  assert.deepEqual(tip.slice(1, 3), [
    ["Skill grade", 6],
    ["Total", 6, "total"]
  ]);
  assert.match(tip.at(-1)[0], /attribute modifier/);
  assert.deepEqual(npcSkillTip({ competence: 4, listed: null, bonus: 2, normalBonus: 4 }).slice(1, 4), [
    ["Competence", 4],
    ["Baffled/Incompetent", -2],
    ["Total", 2, "total"]
  ]);
});

test("tooltip lines: signed parts, plain figures, and a bold total", () => {
  const lines = tipLines([["Strength"], ["Base", 12, "plain"], ["A <b>", -2], ["Total", 3, "total"], null, []]);
  assert.deepEqual(
    lines.map(line => line.text),
    ["Strength", "Base 12", "A <b> -2", "Total +3"]
  );
  assert.equal(
    tipHtml(lines, text => text.replaceAll("<", "&lt;").replaceAll(">", "&gt;")),
    "Strength<br>Base 12<br>A &lt;b&gt; -2<br><strong>Total +3</strong>"
  );
  assert.deepEqual(tipLines(undefined), []);
});

test("a planned skill check's parts add up to its total, with the skill's own parts in place of one row", () => {
  let checked = 0;
  for (const { name, system } of agents.slice(0, 12)) {
    for (const skill of Object.values(system.skillTotals).filter(entry => entry.ranks > 0)) {
      const check = SPYCRAFT.skills[skill.key]?.checks?.[0];
      if (!check) continue;
      let plan;
      try {
        plan = resolveSkillCheck(system, skill.key, check, { ability: skill.ability, modifier: 2 });
      } catch {
        continue;
      }
      if (!plan || !Number.isFinite(plan.total)) continue;
      const rows = skillCheckBreakdown(system, skill.key, plan, 2);
      assert.equal(sum(rows), plan.total, `${name} ${skill.key}: ${JSON.stringify(rows)}`);
      assert.ok(
        rows.some(row => row.label === "Situational modifier" && row.value === 2),
        `${name} ${skill.key}: the typed modifier has its own row`
      );
      assert.ok(
        rows.some(row => row.label === "Ranks"),
        `${name} ${skill.key}: ${JSON.stringify(rows)}`
      );
      checked++;
    }
  }
  assert.ok(checked > 10, `checked ${checked} skill plans`);
});

test("a weapon attack's parts name the attribute used", () => {
  const rows = weaponAttackBreakdown({
    total: 4,
    ability: "dex",
    modifiers: [
      { label: "Range", value: -2 },
      { label: "Base attack bonus", value: 3 },
      { label: "Attribute", value: 2 }
    ]
  });
  assert.deepEqual(rows, [
    { label: "Base attack bonus", value: 3 },
    { label: "DEX", value: 2 },
    { label: "Range", value: -2 },
    { label: "Other modifiers", value: 1 }
  ]);
  assert.deepEqual(weaponAttackBreakdown(null), []);
});

test("a posted check explains its total: the die, the recorded parts and what was added to the dice", () => {
  const check = {
    checkKind: "attack",
    naturalDie: 14,
    rawTotal: 22,
    breakdown: [
      { label: "Base attack bonus", value: 3 },
      { label: "DEX", value: 2 }
    ],
    pipelineModifiers: [{ id: "cover", label: "Point blank", value: 1 }],
    oldSchool: { bonus: 2 }
  };
  const result = checkBreakdown(check);
  assert.equal(result.die + sum(result.rows), 22);
  assert.deepEqual(
    result.rows.map(row => row.label),
    ["Base attack bonus", "DEX", "Point blank", "Old School"]
  );
  assert.deepEqual(breakdownTipRows(check).at(0), ["Die", 14, "plain"]);
  assert.deepEqual(breakdownTipRows(check).at(-1), ["Total", 22, "plain total"]);
});

test("a check without recorded parts shows the die and one bonus row; a fixed result says it was taken", () => {
  assert.deepEqual(checkBreakdown({ checkKind: "gear", naturalDie: 9, rawTotal: 13 }).rows, [
    { label: "Bonus", value: 4 }
  ]);
  assert.deepEqual(checkBreakdown({ checkKind: "ability", naturalDie: 9, rawTotal: 9 }).rows, []);
  const taken = { checkKind: "skill", checkMethod: "take10", naturalDie: null, rawTotal: 17, breakdown: [] };
  assert.deepEqual(breakdownTipRows(taken), [
    ["Taken", 10, "plain"],
    ["Bonus", 7],
    ["Total", 17, "plain total"]
  ]);
  assert.equal(checkBreakdown({ checkKind: "skill", rawTotal: 5, naturalDie: null }), null);
  assert.equal(checkBreakdown({ checkKind: "skill" }), null);
});

test("a damage card explains its flat bonus, and stays quiet without one", () => {
  const rows = breakdownTipRows({
    checkKind: "damage",
    rawTotal: 9,
    breakdown: [
      { label: "STR", value: 3 },
      { label: "Improvised weapon", value: -2 }
    ]
  });
  assert.deepEqual(rows, [
    ["STR", 3],
    ["Improvised weapon", -2],
    ["Damage bonus", 1, "total"]
  ]);
  assert.equal(breakdownTipRows({ checkKind: "damage", rawTotal: 4 }), null);
});
