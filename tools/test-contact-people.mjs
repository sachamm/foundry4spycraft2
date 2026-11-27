import test from "node:test";
import assert from "node:assert/strict";
import {
  consultantBonus,
  newContactPerson,
  personNpcGrade,
  reviewContactPeople,
  specialistLevels,
  summonPlan
} from "../module/rules/contact-people.mjs";

const contact = {
  name: "Harbor Pilot",
  rank: 2,
  people: [
    { kind: "specialist", grade: 1, skill: "", ability: "Behind the Scenes I", summoned: "" },
    { kind: "consultant", grade: 2, skill: "Analysis", ability: "", summoned: "" }
  ]
};

test("numbers by grade", () => {
  assert.equal(consultantBonus(1, 5), 13);
  assert.equal(consultantBonus(4, 10), 30);
  assert.equal(personNpcGrade(3), 6);
  assert.deepEqual(specialistLevels(2), { base: 8, expert: 4 });
  assert.equal(newContactPerson({ rank: 3 }).grade, 3);
});

test("a contact knows one person per grade, each with its skill or ability", () => {
  assert.deepEqual(reviewContactPeople(contact).problems, []);
  assert.equal(reviewContactPeople(contact).room, 0);
  const crowded = { ...contact, rank: 1 };
  const problems = reviewContactPeople(crowded).problems;
  assert.ok(problems.some(line => line.includes("not 2")));
  assert.ok(problems.some(line => line.includes("above the contact")));
  assert.ok(
    reviewContactPeople({ rank: 1, people: [{ kind: "consultant", grade: 1, skill: "" }] }).problems[0].includes(
      "skill"
    )
  );
});

test("summoning: once per mission, at the Threat Level", () => {
  const consultant = summonPlan(contact, 1, { mission: "m1", threatLevel: 6, checkSucceeded: true });
  assert.equal(consultant.bonus, 18);
  assert.equal(consultant.formula, "1d20 + 18");
  assert.equal(consultant.after.summoned, "m1");
  const specialist = summonPlan(contact, 0, { mission: "m1", threatLevel: 6, checkSucceeded: true });
  assert.equal(specialist.careerLevel, 6);
  assert.equal(specialist.npcGradeLabel, "II");
  const used = { ...contact, people: [contact.people[0], consultant.after] };
  assert.throws(() => summonPlan(used, 1, { mission: "m1", threatLevel: 6, checkSucceeded: true }), /once per mission/);
  assert.doesNotThrow(() => summonPlan(used, 1, { mission: "m2", threatLevel: 6, checkSucceeded: true }));
  assert.throws(() => summonPlan(contact, 1, { mission: "m1", threatLevel: 6 }), /Contact check/);
  assert.throws(
    () => summonPlan(contact, 1, { mission: "m1", threatLevel: null, checkSucceeded: true }),
    /Threat Level/
  );
});
