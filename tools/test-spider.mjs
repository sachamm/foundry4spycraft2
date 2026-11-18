import test from "node:test";
import assert from "node:assert/strict";
import "../module/rolls/index.mjs";
import { resolveSkillCheck } from "../module/rules/skills.mjs";
import { SPYCRAFT as cfg } from "../module/config.mjs";

const state = names => ({
  activeFeatNames: names,
  classOptionSelections: [],
  armor: { visionCheck: -2 },
  skillTotals: Object.fromEntries(
    Object.values(cfg.skills).map(skill => [
      skill.key,
      {
        name: skill.name,
        ranks: 10,
        cap: 50,
        threat: 20,
        totals: skill.abilities.map(ability => ({ ability, total: 13 }))
      }
    ])
  )
});
const climb = cfg.skills.athletics.checks.find(c => c.id === "climb");
const roll = (names, input) => resolveSkillCheck(state(names), "athletics", climb, { synergySkill: "none", ...input });

test("Spider Basics: Climb drops the Vision and Hands-On penalties and the missing-kit penalty", () => {
  const plain = roll([], { gearStatus: "missing" }),
    spider = roll(["Spider Basics"], { gearStatus: "missing" });
  assert.equal(spider.total, plain.total + 2 + 4, "armor vision −2 and missing gear −4 are gone");
  assert.equal(
    roll(["Spider Basics"], { gearStatus: "available" }).total,
    roll([], { gearStatus: "available" }).total + 2
  );
});

test("Spider Supremacy: a climbing kit gives +5 (DC −5) and error −1", () => {
  const basics = roll(["Spider Basics", "Spider Supremacy"], { gearStatus: "available" }),
    kit = roll(["Spider Basics", "Spider Supremacy"], { gearStatus: "available", spiderClimbingKit: true });
  assert.equal(kit.total, basics.total + 5);
  assert.equal(kit.error, Math.max(0, basics.error - 1));
});
