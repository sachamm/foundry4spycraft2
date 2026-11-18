import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { skillGearPlan } from "../module/rules/skill-gear.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { resolveKnowledgeCheck } from "../module/rules/knowledge.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
const kits = JSON.parse(await readFile(new URL("../src/data/kits.json", import.meta.url), "utf8")),
  state = () => ({
    activeFeatNames: [],
    skillTotals: Object.fromEntries(
      Object.values(cfg.skills).map(skill => [
        skill.key,
        {
          name: skill.name,
          ranks: 13,
          cap: 60,
          threat: 20,
          totals: skill.abilities.map(ability => ({ ability, total: 16 })),
          bonusEntries: []
        }
      ])
    )
  }),
  item = k => ({
    id: k.name,
    uuid: "Item." + k.name,
    name: k.name,
    type: "gear",
    system: {
      kitType: k.kitType,
      kitGrade: k.grade,
      kitNonPortable: k.nonPortable,
      kitLocation: k.nonPortable ? "Base laboratory" : "",
      quantity: 1
    }
  }),
  appraise = cfg.skills.analysis.checks.find(c => c.id === "appraise");
test("all forty Gear-tagged uses require declared gear; Gear Only blocks a missing-gear roll and ordinary Gear applies exactly minus four", () => {
  let count = 0;
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const check of skill.checks) {
      const tagged = /Gear(?: Only)? \(/.test(check.tags),
        only = /Gear Only \(/.test(check.tags),
        unknown = skillGearPlan(check),
        available = skillGearPlan(check, { gearStatus: "available" }),
        missing = skillGearPlan(check, { gearStatus: "missing" });
      assert.equal(unknown.required, tagged);
      assert.equal(!!unknown.blockedReason, tagged);
      assert.equal(available.blockedReason, "");
      assert.equal(!!missing.blockedReason, only);
      assert.equal(
        missing.bonuses.reduce((n, b) => n + b.value, 0),
        tagged && !only ? -4 : 0
      );
      if (tagged) {
        count++;
        assert.ok(skillGearPlan(check, { gearStatus: "invalid" }).blockedReason);
        const base = resolveSkillCheck(state(), key, check, {
            gearStatus: "available",
            synergySkill: "none",
            trackingSurface: "verySoft"
          }),
          no = resolveSkillCheck(state(), key, check, {
            gearStatus: "missing",
            synergySkill: "none",
            trackingSurface: "verySoft"
          });
        assert.equal(no.total - base.total, only ? 0 : -4);
        assert.equal(no.blocked, only);
      }
    }
  assert.equal(count, 40);
});
test("every one of the forty-eight kit records supplies only its corresponding use, with Grade II gear bonus and Grade III unrestricted cap increase", () => {
  for (const kit of kits) {
    const gearItem = item(kit),
      check = { tags: `Gear (${kit.kitType})` },
      p = skillGearPlan(check, { gearItem, kitAtLocation: true });
    assert.equal(p.blockedReason, "", kit.name);
    assert.equal(p.kitGrade, kit.grade);
    assert.equal(p.status, "available");
    assert.equal(
      p.bonuses.reduce((n, b) => n + b.value, 0),
      kit.grade >= 2 ? 1 : 0
    );
    assert.equal(p.capIncrease, kit.grade === 3 ? 5 : 0);
    assert.equal(
      skillGearPlan({ tags: "Gear (Unrelated Kit)" }, { gearItem, gearStatus: "available", kitAtLocation: true })
        .bonuses.length,
      0
    );
  }
});
test("kit aliases support both Electronics-or-Mechanics choices and First Aid III only as Surgery I", () => {
  const alternative = { tags: "Gear (Electronics or Mechanics Kit)" };
  for (const type of ["Electronics Kit", "Mechanics Kit"])
    for (const grade of [1, 2, 3])
      assert.equal(
        skillGearPlan(alternative, {
          gearItem: item(kits.find(k => k.kitType === type && k.grade === grade)),
          kitAtLocation: true
        }).kitGrade,
        grade
      );
  for (const grade of [1, 2, 3]) {
    const p = skillGearPlan(
      { tags: "Gear Only (Surgery Kit)" },
      { gearItem: item(kits.find(k => k.kitType === "First Aid Kit" && k.grade === grade)) }
    );
    assert.equal(p.kitGrade, grade === 3 ? 1 : 0);
    assert.equal(!!p.blockedReason, grade !== 3);
    assert.equal(p.capIncrease, 0);
    assert.equal(p.bonuses.length, 0);
  }
  const architect = kits.find(k => k.kitType === "Architect’s Kit" && k.grade === 1);
  assert.equal(skillGearPlan({ tags: "Gear (Architect's Kit)" }, { gearItem: item(architect) }).kitGrade, 1);
});
test("non-portable kits require an actual recorded location and per-use confirmation; invalid grades cannot grant benefits", () => {
  const k = item(kits.find(k => k.name === "Appraisal Kit III"));
  assert.ok(skillGearPlan(appraise, { gearItem: k }).blockedReason);
  k.system.kitLocation = "";
  assert.ok(skillGearPlan(appraise, { gearItem: k, kitAtLocation: true }).blockedReason);
  k.system.kitLocation = "Safehouse";
  assert.equal(skillGearPlan(appraise, { gearItem: k, kitAtLocation: true }).blockedReason, "");
  for (const grade of [0, 4, -1, 1.5, "3"]) {
    k.system.kitGrade = grade;
    assert.ok(skillGearPlan(appraise, { gearItem: k, kitAtLocation: true }).blockedReason);
  }
});
test("kit gear bonuses compete with existing gear bonuses and preserve gear penalties, while cap benefits stack above sixty without changing Knowledge", () => {
  const s = state(),
    gearItem = item(kits.find(k => k.name === "Appraisal Kit III"));
  for (const value of [-2, 0, 1, 3]) {
    s.skillTotals.analysis.bonusEntries = [{ type: "gear", value }];
    const base = resolveSkillCheck(s, "analysis", appraise, { gearStatus: "available", synergySkill: "none" }),
      r = resolveSkillCheck(s, "analysis", appraise, { gearItem, kitAtLocation: true, synergySkill: "none" });
    assert.equal(r.total - base.total, Math.max(1, value) - Math.max(0, value));
    assert.equal(r.cap, 65);
    s.skillTotals.analysis.cap = 65;
    assert.equal(
      resolveSkillCheck(s, "analysis", appraise, { gearItem, kitAtLocation: true, synergySkill: "none" }).cap,
      70
    );
    s.skillTotals.analysis.cap = 60;
  }
  s.knowledge = 8;
  assert.equal(
    resolveKnowledgeCheck(s, { skill: "analysis", gearItem }).total,
    resolveKnowledgeCheck(s, { skill: "analysis" }).total
  );
});
globalThis.Actor = class {
  constructor() {
    this.system = state();
    this.system.actionDice = { value: 0 };
    this.items = [];
    this.type = "agent";
    this.uuid = "Actor.skillGear";
    this.isOwner = true;
  }
};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { user: { isGM: true }, settings: { get: () => false }, i18n: { localize: s => s } };
globalThis.foundry = { utils: { escapeHTML: s => String(s) } };
globalThis.ui = { notifications: { warn: () => null } };
const { SpycraftActor } = await import("../module/documents/actor.mjs");
test("actual actor rejects unknown or missing Gear Only before rolling and freezes selected-kit benefits with current item availability", async () => {
  const a = new SpycraftActor();
  let rolls = 0;
  a.rollCheck = async (formula, data, options) => {
    rolls++;
    return { data, options };
  };
  assert.equal(await a.rollSkill("analysis", "int", { check: "appraise" }), null);
  assert.equal(rolls, 0);
  const missing = await a.rollSkill("analysis", "int", {
    check: "appraise",
    gearStatus: "missing",
    synergySkill: "none"
  });
  assert.equal(missing.data.total, 12);
  const firstAid = cfg.skills.medicine.checks.find(c => c.tags.includes("Gear Only (First Aid Kit)"));
  assert.equal(await a.rollSkill("medicine", "int", { check: firstAid.id, gearStatus: "missing" }), null);
  const k = item(kits.find(k => k.name === "Appraisal Kit III"));
  a.items = [k];
  a.items.get = id => a.items.find(i => i.id === id);
  const input = { check: "appraise", gearItem: k.id, kitAtLocation: true, synergySkill: "none" },
    r = await a.rollSkill("analysis", "int", input);
  assert.equal(r.options.cap, 65);
  assert.equal(r.options.skillGear.kitUuid, k.uuid);
  assert.equal(r.data.total, 17);
  k.system.quantity = 0;
  assert.equal(await a.rollSkill("analysis", "int", input), null);
  assert.equal(a.system.actionDice.value, 0);
});

import { computeAgent } from "../module/rules/engine.mjs";
test("introducing a non-portable kit requires recording its fixed location and cannot silently treat it as carried weight", () => {
  const kit = item(kits.find(k => k.name === "Appraisal Kit III"));
  kit.system.kitLocation = "";
  kit.system.carried = true;
  const source = {
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { base: 12 }])),
      progression: []
    },
    s = computeAgent(structuredClone(source), [kit], cfg);
  assert.ok(s.todo.some(t => t.tab === "gear" && t.text.includes("fixed location")));
  assert.ok(s.warnings.some(t => t.includes("non-portable kit cannot be carried")));
  kit.system.kitLocation = "Base";
  kit.system.carried = false;
  assert.equal(
    computeAgent(structuredClone(source), [kit], cfg).todo.some(t => t.text.includes("fixed location")),
    false
  );
});
