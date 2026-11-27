import test from "node:test";
import assert from "node:assert/strict";
import {
  ORG,
  conflictRatings,
  defaultOrganization,
  facetChecks,
  goalDice,
  imageBenefits,
  imageSpent,
  ratingDetails,
  ratingPool,
  reviewOrganization,
  siteForRequest,
  siteRequestTime,
  toolsCalibers,
  turningPointBoost
} from "../module/rules/gc/organization.mjs";

const sample = () => ({
  ...defaultOrganization("org1"),
  name: "Test Bureau",
  ratings: { goals: 2, history: 1, image: 3, sites: 1, tools: 1 },
  goals: [ORG.goals[0].id, ORG.goals[1].id],
  turningPoints: [{ id: "triumphant", check: "Bureaucracy/Request" }],
  image: { goals: "recorded", methods: "mysterious", leaders: "secretive", members: "recorded", sites: "recorded" },
  sites: [ORG.sites[0].id],
  tools: { E: 1, G: 1, R: 0, S: 0, T: 0, V: 0, W: 0 }
});

test("the data covers every table the rules read", () => {
  assert.equal(ORG.goals.length, 20);
  assert.equal(ORG.turningPoints.length, 20);
  assert.equal(ORG.sites.length, 20);
  assert.equal(ORG.image.levels.length, 5);
  assert.deepEqual(ORG.ratings, ["goals", "history", "image", "sites", "tools"]);
});

test("a fully spent organization is complete", () => {
  const review = reviewOrganization(sample());
  assert.deepEqual(review.problems, []);
  assert.deepEqual(review.unspent, []);
  assert.equal(review.complete, true);
  assert.equal(review.total, 8);
  assert.equal(review.imageSpent, 3);
  assert.equal(ratingPool(review.total), null);
});

test("over-spending is a problem and under-spending is unspent", () => {
  const org = sample();
  org.goals.push(ORG.goals[2].id);
  org.tools.W = 4;
  org.ratings.image = 5;
  const review = reviewOrganization(org);
  assert.ok(review.problems.some(line => line.startsWith("Goals: 3 chosen")));
  assert.ok(review.problems.some(line => line.includes("above Caliber V")));
  assert.ok(review.problems.some(line => line.startsWith("Tools: 6 Caliber increases")));
  assert.ok(review.unspent.some(line => line.startsWith("Image: 2")));
  assert.equal(review.complete, false);
});

test("a Triumphant turning point must name its check", () => {
  const org = sample();
  org.turningPoints = [{ id: "triumphant", check: "" }];
  assert.ok(reviewOrganization(org).problems.some(line => line.startsWith("Triumphant")));
});

test("Image levels cost points and move check DCs", () => {
  assert.equal(imageSpent({ goals: "renowned", methods: "prominent" }), 3);
  const org = sample();
  assert.equal(facetChecks(org, "methods").level, "mysterious");
  assert.equal(facetChecks(org, "goals").level, "recorded");
  const renowned = ORG.image.levels.find(row => row.id === "renowned");
  assert.deepEqual(facetChecks({ image: { goals: "renowned" } }, "goals").canvass, renowned.canvass);
  const benefits = imageBenefits(org);
  const secretive = ORG.image.levels.find(row => row.id === "secretive");
  assert.equal(benefits.leaders.coverIdentity, secretive.cover.leaders);
});

test("Tools start at Caliber II and stop at V", () => {
  const calibers = toolsCalibers({ E: 1, W: 9 });
  assert.equal(calibers.E, 3);
  assert.equal(calibers.W, 5);
  assert.equal(calibers.G, 2);
});

test("Sites give +4 and half the time to matching Requests", () => {
  const org = sample();
  const site = siteForRequest(org, ORG.sites[0].id);
  assert.equal(site.bonus, 4);
  assert.equal(siteForRequest(org, ORG.sites[1].id), null);
  assert.equal(siteRequestTime(5), 3);
});

test("goals give 2 dice each, turning points +2 morale per die", () => {
  const org = sample();
  assert.equal(goalDice(org), 4);
  assert.equal(turningPointBoost(org, "bureaucracy/request", 2), 4);
  assert.equal(turningPointBoost(org, "Athletics", 2), 0);
});

test("rating pools and conflict ratings", () => {
  assert.equal(ratingPool(15).min, 11);
  assert.equal(ratingPool(45).max, null);
  assert.equal(conflictRatings(sample())["Organization Image Rating"], 3);
  assert.match(ratingDetails(sample(), "tools"), /E–III/);
});
