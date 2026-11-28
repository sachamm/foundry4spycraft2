import test from "node:test";
import assert from "node:assert/strict";
import { knowledgeLines, knowledgeRole, knowsNothingCost, npcKnowledge } from "../module/rules/gc/npc-knowledge.mjs";
import { defaultOrganization } from "../module/rules/gc/organization.mjs";

test("the margin picks the row, capped by Competence", () => {
  assert.equal(npcKnowledge({ difference: 0, competence: 5, role: "villain" }).grade, 0);
  assert.equal(npcKnowledge({ difference: 3, competence: 5, role: "villain" }).grade, 1);
  assert.equal(npcKnowledge({ difference: 14, competence: 5, role: "villain" }).grade, 4);
  const capped = npcKnowledge({ difference: 34, competence: 3, role: "mastermind" });
  assert.equal(capped.grade, 3);
  assert.equal(capped.limit, "competence");
});

test("only villains pass grade III, and only henchmen and masterminds pass VII", () => {
  const other = npcKnowledge({ difference: 30, competence: 10, role: "other" });
  assert.equal(other.grade, 3);
  assert.equal(other.limit, "role");
  assert.equal(other.flawed, true);
  assert.equal(npcKnowledge({ difference: 45, competence: 10, role: "villain" }).grade, 7);
  const henchman = npcKnowledge({ difference: 45, competence: 10, role: "henchman" });
  assert.equal(henchman.grade, 10);
  assert.equal(henchman.ratings, 5);
  assert.equal(henchman.rows.length, 10);
});

test("roles, and what it costs to know nothing", () => {
  assert.equal(knowledgeRole({ qualities: [{ id: "mastermind" }] }), "mastermind");
  assert.equal(knowledgeRole({ qualities: ["minion"] }), "villain");
  assert.equal(knowledgeRole({ npcType: "standard" }), "other");
  assert.equal(knowsNothingCost("mastermind"), null);
  assert.equal(knowsNothingCost("henchman", "special"), 2);
  assert.equal(knowsNothingCost("other", "standard"), 1);
  assert.equal(knowsNothingCost("other", "special"), 2);
});

test("Ratings learned come from the recorded organization", () => {
  const result = npcKnowledge({ difference: 18, competence: 6, role: "villain" });
  assert.equal(result.ratings, 2);
  const org = { ...defaultOrganization("x"), ratings: { goals: 1, history: 0, image: 0, sites: 0, tools: 2 } };
  const lines = knowledgeLines(result, org, ["tools", "goals"]);
  assert.equal(lines.length, 7);
  assert.match(lines[5], /^Tools 2/);
  assert.match(knowledgeLines(result).at(-1), /2 of the enemy organization/);
});
