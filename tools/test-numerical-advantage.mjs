import test from "node:test";
import assert from "node:assert/strict";
import { numericalAdvantagePlan as plan } from "../module/rules/numerical-advantage.mjs";
import { numericalAdvantageCandidates, checkNumericalAdvantage } from "../module/apps/numerical-advantage.mjs";
const row = (id, patch = {}) => ({
    id,
    name: id,
    characters: 1,
    countsAs: 1,
    team: "team",
    countingSource: "",
    tacticalAdvantage: false,
    ...patch
  }),
  calculate = (own, opposition) => plan({ own, opposition, rosterConfirmed: true });
test("all ordinary/Tactical counts on both sides meet exact two-to-one and three-to-one thresholds without counting absent characters", () => {
  for (let own = 0; own <= 12; own++)
    for (let enemy = 0; enemy <= 12; enemy++)
      for (const a of [false, true])
        for (const b of [false, true]) {
          const p = calculate(
            [row("own", { characters: own, tacticalAdvantage: a })],
            [row("enemy", { characters: enemy, tacticalAdvantage: b })]
          );
          assert.equal(p.own.physical, own);
          assert.equal(p.opposition.physical, enemy);
          assert.equal(p.own.effective, own * (a ? 2 : 1));
          assert.equal(p.opposition.effective, enemy * (b ? 2 : 1));
          assert.equal(p.twoToOne, own > 0 && enemy > 0 && own * (a ? 2 : 1) >= 2 * enemy * (b ? 2 : 1));
          assert.equal(p.threeToOne, own > 0 && enemy > 0 && own * (a ? 2 : 1) >= 3 * enemy * (b ? 2 : 1));
        }
});
test("Tactical Advantage distinguishes actual teammate groups from allies, cannot double twice and preserves higher counting abilities", () => {
  let p = calculate(
    [row("source", { tacticalAdvantage: true }), row("teammate"), row("ally", { team: "allied-squad" })],
    [row("enemy")]
  );
  assert.deepEqual(
    p.own.rows.map(r => r.perCharacter),
    [2, 2, 1]
  );
  p = calculate(
    [row("one", { tacticalAdvantage: true }), row("two", { tacticalAdvantage: true }), row("three")],
    [row("enemy")]
  );
  assert.equal(p.own.effective, 6);
  for (const base of [2, 3, 7]) {
    p = calculate(
      [
        row("source", { tacticalAdvantage: true }),
        row("other", { countsAs: base, countingSource: "GC-confirmed other ability" })
      ],
      [row("enemy")]
    );
    assert.equal(p.own.rows[1].perCharacter, base);
  }
  p = calculate([row("independent", { team: "", tacticalAdvantage: true }), row("ally", { team: "" })], [row("enemy")]);
  assert.deepEqual(
    p.own.rows.map(r => r.perCharacter),
    [2, 1]
  );
});
test("declared grouped characters and remote teammate providers do not add nonexistent bodies or require an invented proximity limit", () => {
  const p = calculate(
    [row("remote", { characters: 0, tacticalAdvantage: true }), row("members", { characters: 3, team: " TEAM " })],
    [row("opposing-group", { characters: 2 })]
  );
  assert.equal(p.own.physical, 3);
  assert.equal(p.own.effective, 6);
  assert.equal(p.own.providers[0].physicallyCounted, false);
  assert.equal(p.threeToOne, true);
  assert.equal(p.own.rows[1].team, "team");
});
test("invalid rosters, duplicate entities, missing other-ability sources and unsafe arithmetic cannot manufacture an advantage", () => {
  for (const patch of [
    { characters: -1 },
    { characters: 1.5 },
    { characters: "2" },
    { countsAs: 0 },
    { countsAs: 2, countingSource: "" },
    { tacticalAdvantage: "true" },
    { team: null },
    { name: "" },
    { id: "" }
  ])
    assert.throws(() => calculate([row("own", patch)], [row("enemy")]));
  assert.throws(() => calculate([row("one"), row("one")], [row("enemy")]));
  assert.throws(() =>
    calculate([row("huge", { characters: Number.MAX_SAFE_INTEGER, tacticalAdvantage: true })], [row("enemy")])
  );
  assert.throws(() => plan({ own: [], opposition: [], rosterConfirmed: "true" }));
  const own = [row("one", { tacticalAdvantage: true }), row("two")],
    before = structuredClone(own);
  calculate(own, [row("enemy")]);
  assert.deepEqual(own, before);
});
let response = null,
  contents = [],
  warnings = [],
  hook = null,
  documents;
globalThis.game = { user: { isGM: true }, actors: [], scenes: { active: null } };
globalThis.foundry = {
  utils: { escapeHTML: s => String(s) },
  applications: {
    api: {
      DialogV2: {
        input: async d => {
          contents.push(d.content);
          if (contents.length === 1) {
            await hook?.();
            return response;
          }
          return null;
        }
      }
    }
  }
};
globalThis.ui = {
  notifications: {
    warn: s => {
      warnings.push(s);
      return { warning: s };
    }
  }
};
globalThis.fromUuid = async uuid => documents.get(uuid);
const actor = (id, patch = {}) => ({
  uuid: "Actor." + id,
  name: id,
  documentName: "Actor",
  type: "agent",
  isOwner: true,
  visible: true,
  system: { activeFeatNames: [] },
  ...patch
});
function setup() {
  contents = [];
  warnings = [];
  response = null;
  hook = null;
  const a = actor("requester");
  a.system.activeFeatNames = ["Tactical Advantage"];
  const enemy = actor("enemy"),
    teammate = actor("teammate");
  game.actors = [a, enemy, teammate];
  game.user.isGM = true;
  game.scenes.active = null;
  game.combat = null;
  documents = new Map(game.actors.map(a => [a.uuid, a]));
  return { a, enemy, teammate };
}
const declarations = () => ({
  rosterConfirmed: true,
  ownCount__0: 1,
  ownTeam__0: "team",
  ownBase__0: 1,
  ownSource__0: "",
  ownCount__2: 1,
  ownTeam__2: "team",
  ownBase__2: 1,
  ownSource__2: "",
  enemyCount__1: 2,
  enemyTeam__1: "",
  enemyBase__1: 1,
  enemySource__1: ""
});
test("candidate lists use actual visible token identities, avoid duplicate Actor prototypes and preserve separate repeated-token characters", () => {
  const { a, enemy } = setup();
  const t1 = { uuid: "Scene.s.Token.one", documentName: "Token", name: "First", actor: a, hidden: false },
    t2 = { ...t1, uuid: "Scene.s.Token.two", name: "Second" },
    hidden = { ...t1, uuid: "Scene.s.Token.hidden", actor: enemy, hidden: true };
  game.scenes.active = { tokens: [t1, t2, hidden] };
  let rows = numericalAdvantageCandidates(a);
  assert.equal(rows.filter(r => r.actorUuid === a.uuid).length, 2);
  assert.equal(rows.filter(r => r.defaultOwn === 1).length, 1);
  game.user.isGM = false;
  rows = numericalAdvantageCandidates(a);
  assert.equal(
    rows.some(r => r.uuid === hidden.uuid),
    false
  );
  assert.equal(
    rows.some(r => r.uuid === enemy.uuid),
    true
  );
});
test("running combat suggests counts from its own scene, preserving tokens and leaving team relationships unassigned", async () => {
  const { a, enemy, teammate } = setup();
  const token = (id, actor, disposition) => ({
    uuid: `Scene.fight.Token.${id}`,
    documentName: "Token",
    name: id,
    actor,
    disposition
  });
  const tokens = [
    token("self", a, 1),
    token("ally", teammate, 1),
    token("enemy", enemy, -1),
    token("anotherEnemy", enemy, -1),
    token("neutral", actor("neutral"), 0),
    token("defeated", enemy, -1),
    token("bystander", teammate, 1),
    token("hidden", enemy, -1)
  ];
  game.combat = {
    started: true,
    scene: { tokens },
    combatants: tokens
      .filter(t => t.name !== "bystander")
      .map(t => ({
        actor: t.actor,
        token: t,
        defeated: t.name === "defeated",
        hidden: t.name === "hidden"
      }))
  };
  game.scenes.active = { tokens: [token("wrongScene", a, 1)] };
  let rows = numericalAdvantageCandidates(a);
  const counts = rows => rows.map(r => [r.name, r.defaultOwn, r.defaultEnemy]);
  assert.deepEqual(counts(rows), [
    ["self", 1, 0],
    ["ally", 1, 0],
    ["enemy", 0, 1],
    ["anotherEnemy", 0, 1],
    ["neutral", 0, 0],
    ["defeated", 0, 0],
    ["bystander", 0, 0],
    ["hidden", 0, 1]
  ]);
  assert.equal(rows[0].defaultTeam, "your-team");
  assert.equal(rows[1].defaultTeam, "");
  for (const t of tokens) documents.set(t.uuid, t);
  response = { rosterConfirmed: true };
  for (const r of rows)
    for (const side of ["own", "enemy"]) {
      response[`${side}Count__${r.key}`] = side === "own" ? r.defaultOwn : r.defaultEnemy;
      response[`${side}Team__${r.key}`] = side === "own" && r.defaultOwn ? r.defaultTeam : "";
      response[`${side}Base__${r.key}`] = 1;
    }
  const p = await checkNumericalAdvantage(a);
  assert.equal(p.own.physical, 2);
  assert.equal(p.own.effective, 3); // An ally is not automatically a Tactical Advantage teammate.
  assert.equal(p.opposition.physical, 3);
  assert.match(contents[0], /Counts are suggested from the running combat/);
  assert.match(contents[0], /name="enemyCount__2"[^>]*value="1"/);
  game.user.isGM = false;
  rows = numericalAdvantageCandidates(a);
  assert.equal(
    rows.some(r => r.name === "hidden"),
    false
  );
  assert.equal(rows.filter(r => r.defaultEnemy).length, 2);
});

test("neutral, absent and repeated linked requesters do not invent sides or directory counts", () => {
  const { a, enemy } = setup();
  const self = { uuid: "Token.self", actor: a, disposition: 0 },
    other = { uuid: "Token.other", actor: a, disposition: -1 },
    foe = { uuid: "Token.foe", actor: enemy, disposition: 1 };
  game.combat = {
    started: true,
    scene: { tokens: [self, other, foe] },
    combatants: [self, other, foe].map(token => ({ token, actor: token.actor }))
  };
  a.token = self;
  let rows = numericalAdvantageCandidates(a);
  assert.deepEqual(
    rows.map(r => [r.defaultOwn, r.defaultEnemy]),
    [
      [1, 0],
      [0, 0],
      [0, 0],
      [0, 0]
    ]
  );
  a.token = other;
  rows = numericalAdvantageCandidates(a);
  assert.deepEqual(
    rows.map(r => [r.defaultOwn, r.defaultEnemy]),
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [0, 0]
    ]
  );
  rows = numericalAdvantageCandidates(actor("absent"));
  assert.ok(rows.every(r => !r.defaultOwn && !r.defaultEnemy));
  game.combat.started = false;
  rows = numericalAdvantageCandidates(a);
  assert.equal(rows.filter(r => r.defaultOwn).length, 1);
  assert.ok(rows.every(r => !r.defaultEnemy));
});

test("the actual dialog resolves live Tactical Advantage sources and teammate relationships without changing character resources", async () => {
  const { a } = setup();
  response = declarations();
  let p = await checkNumericalAdvantage(a);
  assert.equal(p.own.physical, 2);
  assert.equal(p.own.effective, 4);
  assert.equal(p.opposition.effective, 2);
  assert.equal(p.twoToOne, true);
  assert.equal(p.threeToOne, false);
  assert.match(contents[1], /2 physical \/ 4 counted/);
  setup();
  response = declarations();
  response.ownTeam__2 = "other-allies";
  p = await checkNumericalAdvantage(game.actors[0]);
  assert.equal(p.own.effective, 3);
  assert.equal(p.twoToOne, false);
  setup();
  response = declarations();
  hook = () => {
    game.actors[0].system.activeFeatNames = [];
  };
  p = await checkNumericalAdvantage(game.actors[0]);
  assert.equal(p.own.effective, 2);
  assert.equal(p.twoToOne, false);
});
test("cancelled, unconfirmed, disappeared or redirected roster fields cannot silently produce another roster", async () => {
  let { a } = setup();
  assert.equal(await checkNumericalAdvantage(a), null);
  assert.equal(contents.length, 1);
  for (const cause of ["unconfirmed", "missing", "unknown", "badCount"]) {
    ({ a } = setup());
    response = declarations();
    if (cause === "unconfirmed") response.rosterConfirmed = false;
    if (cause === "missing") hook = () => documents.delete("Actor.teammate");
    if (cause === "unknown")
      Object.assign(response, { ownCount__99: 1, ownTeam__99: "team", ownBase__99: 1, ownSource__99: "" });
    if (cause === "badCount") response.ownCount__2 = "";
    const p = await checkNumericalAdvantage(a);
    assert.ok(p.warning, cause);
    assert.equal(contents.length, 1);
  }
});
