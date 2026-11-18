import test from "node:test";
import assert from "node:assert/strict";
import { ghostCoverContent, ghostCoverPreview, validateGhostCoverPreview } from "../module/apps/ghost-cover.mjs";
import { checkIncomingDefense } from "../module/apps/incoming-defense.mjs";
const system = () => ({
    activeFeatNames: [],
    classLevels: {},
    defense: { total: 18, dodgeBonuses: 3, dexterity: 2 },
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 14, mod: 2 }])),
    conditionContext: {}
  }),
  make = (id, names = []) => ({
    id,
    uuid: "Actor." + id,
    name: id,
    type: "agent",
    isOwner: true,
    items: [],
    system: { ...system(), activeFeatNames: names }
  });
const input = (patch = {}) => ({
  ghostCoverDeclared: true,
  ghostActorUuid: "Actor.ghost",
  ghostHidden: true,
  ghostSceneryCover: "3",
  ghostVisibleMaterial: "0",
  ghostDisturbingMovement: "0",
  ghostCoverConfirmed: true,
  ...patch
});
let warnings = [],
  dialogs = [],
  reply;
globalThis.game = { user: { id: "gm", isGM: true }, actors: [] };
globalThis.foundry = {
  utils: { escapeHTML: s => String(s).replaceAll("<", "&lt;") },
  applications: {
    api: {
      DialogV2: {
        input: async o => {
          dialogs.push(o);
          return await reply(o, dialogs.length);
        }
      }
    }
  }
};
globalThis.ui = {
  notifications: {
    warn: s => {
      warnings.push(s);
      return null;
    }
  }
};
function setup() {
  const ghost = make("ghost", ["Ghost Mastery"]),
    opponent = make("opponent");
  game.user = { id: "gm", isGM: true };
  game.actors = [ghost, opponent];
  Object.defineProperty(game.actors, "get", { value: id => game.actors.find(a => a.id === id) });
  warnings = [];
  dialogs = [];
  reply = async (_o, n) => (n === 1 ? input() : null);
  return { ghost, opponent };
}
test("actual preview uses real source and opponent identities, never caller-supplied systems or names", () => {
  const { ghost, opponent } = setup();
  const p = ghostCoverPreview(
    opponent,
    input({ actorName: "Forged", targetSystem: { activeFeatNames: ["Ghost Supremacy"] } })
  );
  assert.equal(p.context.actorName, ghost.name);
  assert.equal(p.context.opponentActorUuid, opponent.uuid);
  assert.deepEqual(p.sources, ["Ghost Mastery"]);
  assert.equal(
    ghostCoverPreview(
      opponent,
      input({ ghostSceneryCover: "2", targetSystem: { activeFeatNames: ["Ghost Supremacy"] } })
    ).invisible,
    false
  );
  for (const patch of [
    { ghostCoverDeclared: "true" },
    { ghostActorUuid: opponent.uuid },
    { ghostActorUuid: "Actor.missing" },
    { ghostSceneryCover: "" },
    { ghostVisibleMaterial: "" },
    { ghostDisturbingMovement: "bad" },
    { ghostCoverConfirmed: false }
  ])
    assert.throws(() => ghostCoverPreview(opponent, input(patch)));
});
test("source visibility checks precede private data reads; readable agents only, with disabled retained fields ignored", () => {
  const { ghost, opponent } = setup();
  game.user = { id: "player", isGM: false };
  for (const allowed of ["owner", "observer", "gm"]) {
    ghost.isOwner = allowed === "owner";
    ghost.testUserPermission = (_u, p) => allowed === "observer" && p === "OBSERVER";
    game.user.isGM = allowed === "gm";
    assert.ok(ghostCoverPreview(opponent, input()).invisible);
  }
  game.user.isGM = false;
  ghost.isOwner = false;
  ghost.testUserPermission = () => false;
  Object.defineProperty(ghost, "system", {
    get() {
      throw Error("Private system read");
    }
  });
  assert.throws(() => ghostCoverPreview(opponent, input()), /readable/);
  assert.ok(!ghostCoverContent(opponent).includes('<option value="Actor.ghost">'));
  assert.equal(ghostCoverPreview(opponent, input({ ghostCoverDeclared: false })), null);
  validateGhostCoverPreview(opponent, input({ ghostCoverDeclared: false }), null);
  const npc = make("ghost", ["Ghost Mastery"]);
  npc.type = "npc";
  game.actors = [npc, opponent];
  assert.throws(() => ghostCoverPreview(opponent, input()), /readable/);
});
test("current proof rejects name, source, permission, identity, grade and circumstance drift, including an added higher tier", () => {
  const { ghost, opponent } = setup(),
    i = input(),
    p = ghostCoverPreview(opponent, i);
  validateGhostCoverPreview(opponent, i, p);
  for (const [k, v] of Object.entries({
    ghostActorUuid: opponent.uuid,
    ghostSceneryCover: "4",
    ghostHidden: false,
    ghostVisibleMaterial: "1",
    ghostDisturbingMovement: "1",
    ghostCoverDeclared: false
  }))
    assert.throws(() => validateGhostCoverPreview(opponent, { ...i, [k]: v }, p), k);
  for (const a of [ghost, opponent]) {
    a.name += " changed";
    assert.throws(() => validateGhostCoverPreview(opponent, i, p));
    a.name = a.id;
  }
  ghost.system.activeFeatNames.push("Ghost Supremacy");
  assert.throws(() => validateGhostCoverPreview(opponent, i, p));
  ghost.system.activeFeatNames = [];
  assert.throws(() => validateGhostCoverPreview(opponent, i, p));
});
test("actual incoming Defense uses Ghost invisibility once, keeps source scenery separate, and respects Uncanny Dodge", async () => {
  for (const grade of [0, 1]) {
    const { opponent } = setup();
    opponent.system.classLevels = { intruder: grade * 4 };
    const p = await checkIncomingDefense(opponent);
    assert.equal(p.total, grade ? 15 : 13);
    assert.equal(p.dodgeLost, 3);
    assert.equal(p.dexterity, grade ? 2 : 0);
    assert.equal(p.ghostCover.invisible, true);
    assert.equal(p.cover.grade, 0);
    assert.ok(dialogs[0].content.includes('name="ghostCoverConfirmed"'));
    assert.ok(dialogs[1].content.includes("invisible to opponent: yes"));
    assert.equal(warnings.length, 0);
  }
  const { opponent } = setup();
  reply = async (_o, n) => (n === 1 ? input({ sceneryCover: "1", invisibleAttacker: true }) : null);
  const p = await checkIncomingDefense(opponent);
  assert.equal(p.total, 15);
  assert.equal(p.cover.grade, 1);
  assert.equal(p.ghostCover.context.sceneryCover, 3);
});
test("missing cover, hidden state or uninterrupted invisibility yields ordinary Defense, while manual other-source invisibility remains available", async () => {
  for (const patch of [
    { ghostSceneryCover: "2" },
    { ghostHidden: false },
    { ghostVisibleMaterial: "25" },
    { ghostDisturbingMovement: "5.001" }
  ]) {
    const { opponent } = setup();
    reply = async (_o, n) => (n === 1 ? input(patch) : null);
    const p = await checkIncomingDefense(opponent);
    assert.equal(p.total, 18);
    assert.equal(p.ghostCover.invisible, false);
  }
  for (const invisibleAttacker of [false, true]) {
    const { opponent } = setup();
    reply = async (_o, n) =>
      n === 1
        ? input({
            ghostCoverDeclared: false,
            ghostActorUuid: "Actor.missing",
            ghostSceneryCover: "bad",
            invisibleAttacker
          })
        : null;
    const p = await checkIncomingDefense(opponent);
    assert.equal(p.total, invisibleAttacker ? 13 : 18);
    assert.equal(Object.hasOwn(p, "ghostCover"), false);
  }
});
test("actual incoming dialogs reject changed live sources at either boundary and mismatched attack source declarations", async () => {
  for (const stage of ["entry", "result"])
    for (const change of ["source", "name", "permission", "delete"]) {
      const { ghost, opponent } = setup();
      reply = async (_o, n) => {
        if (n === (stage === "entry" ? 1 : 2)) {
          if (change === "source") ghost.system.activeFeatNames = [];
          if (change === "name") ghost.name = "Changed";
          if (change === "permission") {
            game.user.isGM = false;
            ghost.isOwner = false;
          }
          if (change === "delete") game.actors = [opponent];
        }
        return n === 1 ? input() : null;
      };
      const p = await checkIncomingDefense(opponent);
      if (stage === "entry" && change === "name") {
        assert.equal(p.ghostCover.context.actorName, "Changed");
        continue;
      }
      assert.equal(p, null, stage + "/" + change);
      assert.equal(warnings.length, 1);
    }
  const { opponent } = setup(),
    other = make("other");
  other.system.classLevels = { counterterrorist: 4 };
  game.actors.push(other);
  reply = async (_o, n) => (n === 1 ? input({ precisionAttacker: other.id }) : null);
  assert.equal(await checkIncomingDefense(opponent), null);
  assert.match(warnings[0], /same actual attacker/);
});
test("read-only preview never mutates actors, creates receipts or spends any resources", async () => {
  const { opponent } = setup(),
    before = structuredClone(game.actors);
  const p = await checkIncomingDefense(opponent);
  assert.ok(p.ghostCover.invisible);
  assert.deepEqual(game.actors, before);
  assert.equal(dialogs.length, 2);
});
