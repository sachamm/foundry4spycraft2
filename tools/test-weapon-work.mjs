import test from "node:test";
import assert from "node:assert/strict";
import { weaponFocusWorkPlan as plan } from "../module/rules/weapon-work.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { rollEvidence, rollEvidenceMatches } from "../module/rules/outcomes.mjs";
import { makeFatigueActor } from "./fixtures/fatigue-actor.mjs";
foundry.utils.escapeHTML = s => String(s);
const declaration = (proficiency = "rifle", dc = 30) => ({
  weaponWork: true,
  weaponWorkProficiency: proficiency,
  weaponWorkName: "GC-confirmed target weapon",
  weaponWorkDC: dc,
  weaponWorkConfirmed: true
});
const focus = choice => ({ name: "Weapon Focus", choice });
test("every permitted Weapon Focus proficiency applies once to all six Build/Modify/Repair uses and exact DC floor boundaries", () => {
  for (const proficiency of Object.keys(cfg.proficiencies).filter(k => k !== "unarmed"))
    for (const key of ["electronics", "mechanics"])
      for (const id of ["build", "modify", "repair"])
        for (let dc = 0; dc <= 35; dc++) {
          const s = { activeFeatSelections: [focus(proficiency), focus(proficiency)] },
            r = plan(s, cfg, key, { id }, declaration(proficiency, dc));
          assert.equal(r.applicable, true, proficiency + "/" + key + "/" + id);
          assert.equal(r.effectiveDC, Math.min(dc, Math.max(5, dc - 10)));
          assert.equal(r.reduction, dc - r.effectiveDC);
          assert.equal(r.baseDC, dc);
          assert.equal(r.proficiency, proficiency);
        }
  const r = plan(
    { activeFeatSelections: [focus(cfg.proficiencies.rifle.label)] },
    cfg,
    "mechanics",
    { id: "repair" },
    declaration()
  );
  assert.equal(r.effectiveDC, 20);
});
test("only the three exact named uses accept the reduction; fortes, unarmed, unconfirmed targets and malformed DCs cannot supply it", () => {
  const s = { activeFeatSelections: [focus("rifle")] };
  for (const [key, skill] of Object.entries(cfg.skills))
    for (const check of skill.checks ?? []) {
      const r = plan(s, cfg, key, check, declaration()),
        applies = ["electronics", "mechanics"].includes(key) && ["build", "modify", "repair"].includes(check.id);
      assert.equal(r.applicable, applies, key + "/" + check.id);
      if (!applies) assert.ok(r.blockedReason);
    }
  for (const options of [
    { ...declaration(), weaponWork: "true" },
    { ...declaration(), weaponWorkConfirmed: false },
    { ...declaration(), weaponWorkProficiency: "unarmed" },
    { ...declaration(), weaponWorkProficiency: "invalid" },
    { ...declaration(), weaponWorkName: "" },
    ...[-1, 1.5, NaN, Infinity, "", null, true].map(weaponWorkDC => ({ ...declaration(), weaponWorkDC }))
  ])
    assert.ok(plan(s, cfg, "mechanics", { id: "repair" }, options).blockedReason);
  assert.ok(
    plan(
      { activeFeatSelections: [], proficiencyTotals: { rifle: { forte: true } } },
      cfg,
      "mechanics",
      { id: "repair" },
      declaration()
    ).blockedReason
  );
  assert.equal(plan(s, cfg, "mechanics", { id: "repair" }, {}).applicable, false);
});
test("an actual selected weapon supplies its authoritative proficiency and model identity rather than submitted manual overrides", () => {
  const s = { activeFeatSelections: [focus("rifle")] },
    weapon = { type: "weapon", name: "Actual rifle", uuid: "Actor.a.Item.rifle", system: { proficiency: "rifle" } },
    r = plan(s, cfg, "mechanics", { id: "repair" }, { ...declaration("handgun"), weaponWorkItem: weapon });
  assert.equal(r.proficiency, "rifle");
  assert.equal(r.targetName, "Actual rifle");
  assert.equal(r.targetUuid, weapon.uuid);
  weapon.system.proficiency = "handgun";
  assert.ok(plan(s, cfg, "mechanics", { id: "repair" }, { ...declaration(), weaponWorkItem: weapon }).blockedReason);
  weapon.type = "armor";
  assert.ok(plan(s, cfg, "mechanics", { id: "repair" }, { ...declaration(), weaponWorkItem: weapon }).blockedReason);
});
function actor() {
  game.time.worldTime = 0;
  const a = makeFatigueActor();
  a.raw.proficiencies = { rifle: { proficient: true } };
  a.items.push({
    id: "focus",
    type: "feat",
    name: "Weapon Focus",
    system: { granted: true, choice: "rifle", bonuses: [] }
  });
  a.items.get = id => a.items.find(i => i.id === id);
  a.derive();
  return a;
}
test("actual skill calculations change only the target DC, preserving total/cap/time/error/threat and synergy across all six uses", () => {
  const a = actor();
  for (const key of ["electronics", "mechanics"])
    for (const id of ["build", "modify", "repair"]) {
      const check = cfg.skills[key].checks.find(c => c.id === id),
        options = { gearStatus: "available" },
        base = resolveSkillCheck(a.system, key, check, options),
        r = resolveSkillCheck(a.system, key, check, { ...options, ...declaration() });
      assert.equal(r.weaponFocusWork.effectiveDC, 20);
      for (const field of ["total", "cap", "timeMultiplier", "error", "threat", "synergy"])
        assert.equal(r[field], base[field], key + "/" + id + "/" + field);
      assert.match(r.notes, /DC 30 → 20/);
      assert.equal(r.blocked, base.blocked);
    }
});
test("the actual character entry saves the DC context, accepts owned or confirmed blueprint targets, and rejects stale/mismatched target selections", async () => {
  const a = actor();
  let calls = 0;
  a.rollCheck = async (formula, data, options) => {
    calls++;
    return { formula, data, options };
  };
  const target = {
    id: "target",
    uuid: "Actor.fatigue.Item.target",
    type: "weapon",
    name: "Actual target rifle",
    system: { proficiency: "rifle", quantity: 1, weight: 0, carried: true }
  };
  a.items.push(target);
  const r = await a.rollSkill("mechanics", null, {
    check: "repair",
    gearStatus: "available",
    ...declaration("handgun"),
    weaponWorkItemId: "target"
  });
  assert.equal(r.options.weaponFocusWork.proficiency, "rifle");
  assert.equal(r.options.weaponFocusWork.targetUuid, target.uuid);
  assert.equal(r.options.weaponFocusWork.effectiveDC, 20);
  const ordinary = await a.rollSkill("mechanics", null, {
    check: "repair",
    gearStatus: "available",
    weaponWork: false,
    weaponWorkItemId: "ignored-missing-target"
  });
  assert.equal(ordinary.options.weaponFocusWork, null);
  assert.equal(r.data.total, ordinary.data.total);
  const blueprint = await a.rollSkill("electronics", null, {
    check: "build",
    gearStatus: "available",
    ...declaration()
  });
  assert.equal(blueprint.options.weaponFocusWork.targetUuid, "");
  assert.equal(calls, 3);
  assert.equal(
    await a.rollSkill("mechanics", false, {
      check: "repair",
      gearStatus: "available",
      ...declaration(),
      weaponWorkItemId: "missing"
    }),
    false
  );
  target.system.proficiency = "handgun";
  assert.equal(
    await a.rollSkill("mechanics", null, {
      check: "repair",
      gearStatus: "available",
      ...declaration(),
      weaponWorkItemId: "target"
    }),
    false
  );
  assert.equal(calls, 3);
});
test("source removal immediately blocks the DC benefit and outcome evidence cannot accept edited DCs or target proficiency", async () => {
  const a = actor(),
    check = cfg.skills.mechanics.checks.find(c => c.id === "repair"),
    r = resolveSkillCheck(a.system, "mechanics", check, { gearStatus: "available", ...declaration() }),
    c = { checkKind: "skill", weaponFocusWork: r.weaponFocusWork },
    e = rollEvidence(c);
  assert.equal(rollEvidenceMatches(e, c), true);
  for (const patch of [{ effectiveDC: 10 }, { proficiency: "handgun" }, { targetName: "Another target" }])
    assert.equal(rollEvidenceMatches(e, { ...c, weaponFocusWork: { ...r.weaponFocusWork, ...patch } }), false);
  assert.equal(rollEvidenceMatches(rollEvidence({ checkKind: "skill" }), c), false);
  a.items = a.items.filter(i => i.id !== "focus");
  a.derive();
  assert.equal(
    resolveSkillCheck(a.system, "mechanics", check, { gearStatus: "available", ...declaration() }).blocked,
    true
  );
});

test("a selected target that disappears between preview and actual resolution is rejected before the roll", async () => {
  const a = actor(),
    target = { id: "target", type: "weapon", name: "Rifle", system: { proficiency: "rifle" } };
  let reads = 0,
    rolls = 0;
  a.items.get = id => (id === "target" && ++reads <= 2 ? target : null);
  a.rollCheck = async () => {
    rolls++;
  };
  await assert.rejects(
    a.rollSkill("mechanics", null, {
      check: "repair",
      gearStatus: "available",
      ...declaration(),
      weaponWorkItemId: "target"
    }),
    /no longer available/
  );
  assert.equal(rolls, 0);
});
