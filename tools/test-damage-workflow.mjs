import test from "node:test";
import assert from "node:assert/strict";

/* Foundry stand-ins: enough for the attack, damage, ammunition and opposed-check workflows to run. */
const registry = new Map();
const posted = [];
const warnings = [];
globalThis.foundry = {
  utils: {
    escapeHTML: value => String(value),
    randomID: (() => {
      let n = 0;
      return () => `id${++n}`;
    })()
  },
  applications: { api: { DialogV2: { input: async () => null } } }
};
globalThis.ui = { notifications: { warn: text => (warnings.push(text), null), info: () => null } };
globalThis.Roll = class {
  constructor(formula) {
    this.formula = formula;
  }
  async evaluate() {
    // Every die shows 5: "1d20 + 31" is 36.
    this.total = String(this.formula)
      .split("+")
      .reduce((sum, part) => sum + (/d/.test(part) ? 5 : Number(part)), 0);
    return this;
  }
};
globalThis.ChatMessage = {
  getSpeaker: ({ actor }) => ({ alias: actor?.name }),
  create: async data => (posted.push(data), data)
};
globalThis.game = {
  user: { isGM: true, targets: [] },
  actors: [],
  combats: [],
  messages: [],
  settings: { get: () => true }
};
globalThis.fromUuidSync = uuid => registry.get(uuid) ?? null;
globalThis.fromUuid = async uuid => registry.get(uuid) ?? null;
globalThis.CONFIG = {
  statusEffects: ["fatigued", "unconscious", "dying", "dead", "flat-footed", "held", "pinned", "sprawled", "prone"].map(
    id => ({ id, name: id, img: "" })
  )
};

const { resolveAttack, applyDamage, applyBlast, defenseOf, rollReportedSave, nonLethalTotals, standardReduction } =
  await import("../module/apps/damage-application.mjs");
const { appliedDamageEntries } = await import("../module/rules/damage-application.mjs");
const { hazardSaveResolvers } = await import("../module/apps/hazards.mjs");
const { rollPipeline } = await import("../module/rules/roll-pipeline.mjs");
const { settleGrapple } = await import("../module/apps/combat-actions.mjs");
const { restAndRecover } = await import("../module/apps/healing.mjs");
const { reloadWeapon, spendWeaponShots, weaponAmmunition } = await import("../module/apps/ammunition-use.mjs");
const { compareOpposed, recentResults } = await import("../module/apps/opposed-checks.mjs");

const set = (object, path, value) => {
  const keys = path.split(".");
  let at = object;
  for (const key of keys.slice(0, -1)) at = at[key] ??= {};
  const last = keys.at(-1);
  if (last.startsWith("-=")) delete at[last.slice(2)];
  else at[last] = value;
};
const document = data => ({
  ...data,
  async update(patch) {
    for (const [path, value] of Object.entries(patch)) set(this, path, value);
    return this;
  }
});
function character(name, system, extra = {}) {
  const actor = document({
    uuid: `Actor.${name}`,
    name,
    type: "agent",
    isOwner: true,
    system,
    flags: {},
    statuses: new Set(),
    effects: [],
    confirmed: [],
    async confirmCheckOutcome(message, options) {
      this.confirmed.push(options);
      message.flags.spycraft2.successConfirmed = options.succeeded;
    },
    async createEmbeddedDocuments(kind, rows) {
      for (const row of rows) for (const status of row.statuses) this.statuses.add(status);
      return rows.map(row => ({ ...row, id: "effect" }));
    },
    ...extra
  });
  registry.set(actor.uuid, actor);
  return actor;
}
function card(id, check) {
  const message = document({
    id,
    uuid: `ChatMessage.${id}`,
    isAuthor: true,
    blind: false,
    flags: { spycraft2: check },
    rolls: []
  });
  registry.set(message.uuid, message);
  return message;
}
const reset = () => {
  posted.length = 0;
  warnings.length = 0;
};

test("an attack is settled against the target's listed Defense and its outcome confirmed", async () => {
  reset();
  const attacker = character("Kevin", { activeFeatNames: [] });
  const guard = character("Guard", { defense: { total: 15 } });
  guard.statuses.add("flat-footed");
  guard.effects = [{ id: "e", statuses: new Set(["flat-footed"]), active: true, toObject: () => ({ _id: "e" }) }];
  guard.deleteEmbeddedDocuments = async () => guard.statuses.delete("flat-footed");
  assert.equal(defenseOf(guard), 15);
  const attack = card("a1", { actorUuid: attacker.uuid, checkKind: "attack", rawTotal: 18, effectiveTotal: 18 });
  const hit = await resolveAttack(attack, { targetUuid: guard.uuid });
  assert.deepEqual([hit.hit, hit.margin, hit.defense, hit.targetName], [true, 3, 15, "Guard"]);
  assert.deepEqual(attacker.confirmed, [{ succeeded: true, difficultyClass: 15 }]);
  assert.equal(attack.flags.spycraft2.attackResolution.hit, true);
  assert.equal(guard.statuses.has("flat-footed"), false, "a successful attack ends flat-footedness");
  // An entered Defense (cover, a declared defense) replaces the listed one.
  const miss = await resolveAttack(attack, { targetUuid: guard.uuid, defense: 19 });
  assert.deepEqual([miss.hit, miss.margin], [false, -1]);
  assert.deepEqual(attacker.confirmed.at(-1), { succeeded: false, difficultyClass: 19 });
});

test("an attack that cannot be confirmed keeps no resolution, and a resolved one is left alone", async () => {
  reset();
  const attacker = character(
    "Kevin",
    { activeFeatNames: [] },
    {
      async confirmCheckOutcome() {
        throw new Error("no");
      }
    }
  );
  const attack = card("a2", { actorUuid: attacker.uuid, checkKind: "attack", rawTotal: 18, effectiveTotal: 18 });
  await resolveAttack(attack, { defense: 12 });
  assert.equal(attack.flags.spycraft2.attackResolution, undefined);
  assert.deepEqual(warnings, ["no"]);
  attack.flags.spycraft2.resolved = true;
  await resolveAttack(attack, { defense: 12 });
  assert.match(warnings.at(-1), /already been resolved/);
});

test("lethal damage comes off a special character's vitality and wounds and sets the conditions", async () => {
  reset();
  const kevin = character("Kevin", {
    vitality: { value: 6, max: 20 },
    wounds: { value: 12, max: 12 },
    dr: { melee: 0, other: 2 }
  });
  const damage = card("d1", { actorUuid: "Actor.Guard", checkKind: "damage", effectiveTotal: 11 });
  await applyDamage(damage, { targetUuid: kevin.uuid, damage: 11, kind: "lethal", attackKind: "rangedWeapon" });
  assert.deepEqual([kevin.system.vitality.value, kevin.system.wounds.value], [0, 9]);
  assert.equal(kevin.statuses.has("fatigued"), true);
  assert.match(posted.at(-1).content, /takes 9 damage \(11 less damage reduction 2\)/);
  assert.deepEqual(appliedDamageEntries(damage.flags.spycraft2), [
    { targetUuid: kevin.uuid, name: "Kevin", damage: 11, kind: "lethal" }
  ]);
  // A critical hit while vitality remains goes to wounds; armor-piercing lowers the DR.
  kevin.system.vitality.value = 10;
  await applyDamage(damage, {
    targetUuid: kevin.uuid,
    damage: 10,
    kind: "lethal",
    attackKind: "rangedWeapon",
    armorPiercing: 2,
    critical: true
  });
  assert.deepEqual([kevin.system.vitality.value, kevin.system.wounds.value], [10, -1]);
  assert.equal(kevin.statuses.has("unconscious"), true);
  assert.equal(kevin.statuses.has("dying"), true);
});

test("damage to a character the user does not own is sent to the GC instead of applied here", async () => {
  reset();
  const other = character("Stranger", { vitality: { value: 6, max: 20 }, wounds: { value: 12, max: 12 } });
  other.isOwner = false;
  const damage = card("d2", { actorUuid: "Actor.Guard", checkKind: "damage", effectiveTotal: 5 });
  const user = game.user,
    users = game.users,
    messages = game.messages;
  const sent = [];
  game.user = { ...user, id: "player", isGM: false };
  game.messages = { get: id => (id === damage.id ? damage : undefined) };
  try {
    // No GC connected: nothing changes and the player is told why.
    game.users = { activeGM: null };
    await applyDamage(damage, { targetUuid: other.uuid, damage: 5, kind: "lethal" });
    assert.equal(other.system.vitality.value, 6);
    assert.match(warnings.at(-1), /No GC is connected/);
    // A GC connected: the request carries the card and the fields, and nothing is applied on this client.
    game.users = { activeGM: { query: async (_name, payload) => (sent.push(payload), { value: true }) } };
    await applyDamage(damage, { targetUuid: other.uuid, damage: 5, kind: "lethal", reviewType: true });
    assert.equal(other.system.vitality.value, 6);
    assert.deepEqual(sent, [
      {
        action: "applyDamage",
        userId: "player",
        data: { messageId: "d2", input: { targetUuid: other.uuid, damage: 5, kind: "lethal" } }
      }
    ]);
  } finally {
    game.user = user;
    game.users = users;
    game.messages = messages;
  }
});

test("a standard character's damage reduction counts double against subdual damage and not against stress", () => {
  const hit = { damage: 9, dr: 2, armorPiercing: 0, armorPiercingAll: false };
  assert.equal(standardReduction("lethal", hit).net, 7);
  assert.equal(standardReduction("subdual", hit).net, 5);
  assert.equal(standardReduction("subdual", { ...hit, armorPiercing: 1 }).net, 7);
  assert.equal(standardReduction("subdual", { ...hit, armorPiercingAll: true }).net, 9);
  assert.equal(standardReduction("stress", hit).net, 9);
  assert.equal(standardReduction("subdual", { ...hit, damage: 3 }).stopped, true);
});

test("attacks spend counted shots and Reload draws on the reserve", async () => {
  reset();
  const owner = character("Kevin", {});
  const pistol = document({ type: "weapon", name: "Pistol", isOwner: true, parent: owner, system: { ammo: "15M2" } });
  assert.equal(weaponAmmunition(pistol).loaded, 15);
  await spendWeaponShots(pistol, 3);
  assert.deepEqual([pistol.system.shotsLoaded, pistol.system.shotsSpare], [12, 15]);
  assert.equal(await spendWeaponShots(pistol, 13), null, "more shots than the weapon holds");
  assert.match(warnings.at(-1), /Reload first/);
  const plan = await reloadWeapon(pistol);
  assert.deepEqual([plan.moved, pistol.system.shotsLoaded, pistol.system.shotsSpare], [3, 15, 12]);
  assert.match(posted.at(-1).content, /Reload: Pistol takes 3 shot/);
  // The world setting turns the count off.
  game.settings.get = () => false;
  assert.equal(weaponAmmunition(pistol), null);
  game.settings.get = () => true;
  assert.equal(weaponAmmunition(document({ type: "weapon", parent: owner, system: { ammo: "—" } })), null);
});

test("an opposed check is compared with the other side's posted result and both are confirmed", async () => {
  reset();
  const kevin = character("Kevin", {});
  const guard = character("Guard", {});
  const sneak = card("s1", {
    actorUuid: kevin.uuid,
    checkKind: "skill",
    rawTotal: 19,
    effectiveTotal: 19,
    naturalDie: 10
  });
  const notice = card("s2", {
    actorUuid: guard.uuid,
    checkKind: "skill",
    rawTotal: 19,
    effectiveTotal: 19,
    naturalDie: 13
  });
  notice.speaker = { alias: "Guard" };
  notice.flavor = "Notice (Wis)<br><small>note</small>";
  game.messages = [notice, sneak];
  const rows = recentResults({ exclude: sneak });
  assert.deepEqual(
    [rows.length, rows[0].name, rows[0].total, rows[0].bonus, rows[0].title],
    [1, "Guard", 19, 6, "Notice (Wis)"]
  );
  // Equal results: Kevin's bonus of 9 beats the guard's 6.
  const result = await compareOpposed(sneak, { otherUuid: notice.uuid });
  assert.equal(result.outcome, "won");
  assert.deepEqual(kevin.confirmed, [{ succeeded: true, difficultyClass: 19 }]);
  assert.deepEqual(guard.confirmed, [{ succeeded: false, difficultyClass: 19 }]);
  assert.equal(sneak.flags.spycraft2.opposed.outcome, "won");
  assert.equal(notice.flags.spycraft2.opposed.outcome, "lost");
  // A typed result works when the other side rolled elsewhere.
  const again = card("s3", {
    actorUuid: kevin.uuid,
    checkKind: "skill",
    rawTotal: 12,
    effectiveTotal: 12,
    naturalDie: 3
  });
  assert.equal((await compareOpposed(again, { total: 15 })).outcome, "lost");
});

test("a hit of 25 or more posts a report whose button rolls the character's Fortitude save", async () => {
  reset();
  const saves = [];
  const guard = character("Boss", {
    vitality: { value: 80, max: 80 },
    wounds: { value: 14, max: 14 },
    abilities: { con: { value: 14 } },
    npcType: "special"
  });
  guard.type = "npc";
  guard.rollSave = async (key, options) => (saves.push([key, options]), { flags: { spycraft2: {} } });
  const damage = card("d3", { actorUuid: "Actor.Kevin", checkKind: "damage", effectiveTotal: 52 });
  await applyDamage(damage, { targetUuid: guard.uuid, damage: 52, kind: "lethal" });
  const report = posted.at(-1);
  assert.match(report.content, /Fortitude save DC 26/);
  assert.deepEqual(
    [report.flags.spycraft2.checkKind, report.flags.spycraft2.pendingSave.kind, report.flags.spycraft2.pendingSave.dc],
    ["note", "massiveDamage", 26]
  );
  // The report is a card of its own: only the save button appears under it.
  const note = card("n1", report.flags.spycraft2);
  const buttons = rollPipeline.chatControls({
    message: note,
    check: note.flags.spycraft2,
    actor: guard,
    user: game.user,
    checkKind: "note"
  });
  assert.deepEqual(
    buttons.map(b => b.label),
    ["Roll the Fortitude save (DC 26)"]
  );
  await rollReportedSave(note);
  assert.equal(saves.length, 1);
  assert.equal(saves[0][0], "fort");
  assert.equal(saves[0][1].askContext, true, "the usual save dialog is offered");
  assert.deepEqual(
    [saves[0][1].hazardSave.kind, saves[0][1].hazardSave.dc, saves[0][1].hazardSave.toMinusNine],
    ["massiveDamage", 26, true]
  );
  assert.equal(note.flags.spycraft2.pendingSave.rolled, true);
  await rollReportedSave(note);
  assert.equal(saves.length, 1, "the save is rolled once");
  // A cancelled save leaves the button for another try.
  const again = card(
    "n2",
    report.flags.spycraft2 && {
      ...report.flags.spycraft2,
      pendingSave: { ...report.flags.spycraft2.pendingSave, rolled: false }
    }
  );
  guard.rollSave = async () => null;
  await rollReportedSave(again);
  assert.equal(again.flags.spycraft2.pendingSave.rolled, false);
});

test("a failed massive-damage save rolls a critical injury and drops wounds to –9 for a hit of 50 or more", async () => {
  reset();
  const boss = character("Boss2", {
    vitality: { value: 28, max: 80 },
    wounds: { value: 14, max: 14 },
    npcType: "special"
  });
  boss.type = "npc";
  const resolve = hazardSaveResolvers.get("massiveDamage");
  await resolve(boss, { id: "s9" }, { damage: 31, toMinusNine: false }, true);
  assert.match(posted.at(-1).content, /no critical injury/);
  await resolve(boss, { id: "s9" }, { damage: 52, toMinusNine: true }, false);
  assert.equal(boss.system.wounds.value, -9);
  assert.equal(boss.statuses.has("dying"), true);
  assert.match(posted.at(-1).content, /Critical injury \(57\)/);
  assert.match(posted.at(-1).content, /wounds drop to -9/);
});

test("a special NPC's stress and subdual damage is totalled and its threshold save offered", async () => {
  reset();
  const boss = character("Boss3", { abilities: { con: { value: 10 }, wis: { value: 12 } }, npcType: "special" });
  boss.type = "npc";
  const damage = card("d4", { actorUuid: "Actor.Kevin", checkKind: "damage", effectiveTotal: 8 });
  await applyDamage(damage, { targetUuid: boss.uuid, damage: 8, kind: "subdual" });
  assert.deepEqual(nonLethalTotals(boss), { stress: 0, subdual: 8 });
  assert.equal(posted.at(-1).flags, undefined, "below the threshold: no save");
  await applyDamage(damage, { targetUuid: boss.uuid, damage: 6, kind: "subdual" });
  assert.equal(nonLethalTotals(boss).subdual, 14);
  const save = posted.at(-1).flags.spycraft2.pendingSave;
  assert.deepEqual([save.kind, save.saveKey, save.dc, save.damageKind], ["thresholdSave", "fort", 12, "subdual"]);
  await hazardSaveResolvers.get("thresholdSave")(boss, {}, save, false, { effectiveTotal: 7 });
  assert.equal(boss.statuses.has("unconscious"), true);
  assert.match(posted.at(-1).content, /unconscious for 2 round/);
});

test("a blast is applied to each character caught, halved by distance", async () => {
  reset();
  const near = character("Near", {
    vitality: { value: 40, max: 40 },
    wounds: { value: 12, max: 12 },
    npcType: "special"
  });
  const far = character("Far", {
    vitality: { value: 40, max: 40 },
    wounds: { value: 12, max: 12 },
    npcType: "special"
  });
  near.type = far.type = "npc";
  const damage = card("d5", {
    actorUuid: "Actor.Kevin",
    checkKind: "damage",
    effectiveTotal: 20,
    weaponQualities: "BLS (5 ft.)"
  });
  await applyBlast(damage, {
    kind: "lethal",
    type: "",
    targets: [
      { uuid: near.uuid, distanceFeet: 0 },
      { uuid: far.uuid, distanceFeet: 10 }
    ]
  });
  assert.deepEqual([near.system.vitality.value, far.system.vitality.value], [20, 35]);
  assert.equal(appliedDamageEntries(damage.flags.spycraft2).length, 2);
});

test("a special damage type is handed to an agent's own rules, with the dialog offered for review", async () => {
  reset();
  const agent = character("Agent", {
    vitality: { value: 40, max: 40 },
    wounds: { value: 12, max: 12 },
    dr: { other: 3 }
  });
  const asked = [];
  agent.rollSave = async (key, options) => (asked.push([key, options.hazardSave]), { flags: {} });
  const damage = card("d6", { actorUuid: "Actor.Kevin", checkKind: "damage", effectiveTotal: 18 });
  await applyDamage(damage, { targetUuid: agent.uuid, damage: 18, kind: "lethal", type: "bang", attackKind: "other" });
  assert.deepEqual(asked, [["fort", { kind: "bang", label: asked[0][1].label, dc: 18 }]]);
  assert.equal(agent.system.vitality.value, 40, "bang damage is a save, not lost vitality");
});

test("grapple benefits the winner takes change conditions on both sides", async () => {
  reset();
  const kevin = character("Grappler", { activeFeatNames: [] });
  const foe = character("Foe", {});
  const remove = who => async () => who.statuses.clear();
  foe.deleteEmbeddedDocuments = remove(foe);
  await settleGrapple(kevin, { opening: true, total: 20, opponentTotal: 12, opponentUuid: foe.uuid, benefits: [] });
  assert.equal(foe.statuses.has("held"), true);
  await settleGrapple(kevin, {
    opening: false,
    total: 22,
    opponentTotal: 12,
    opponentUuid: foe.uuid,
    benefits: ["pin"]
  });
  assert.equal(foe.statuses.has("pinned"), true);
  assert.match(posted.at(-1).content, /Foe is now pinned/);
  await settleGrapple(kevin, {
    opening: false,
    total: 22,
    opponentTotal: 12,
    opponentUuid: foe.uuid,
    benefits: ["sprawl"]
  });
  assert.deepEqual([foe.statuses.has("sprawled"), kevin.statuses.has("prone")], [true, true]);
  assert.match(posted.at(-1).content, /1d4 \+ Strength subdual/);
});

test("rest wears off a special NPC's stress and subdual damage", async () => {
  reset();
  const boss = character("Rester", {
    vitality: { value: 10, max: 40 },
    wounds: { value: 12, max: 12 },
    abilities: { con: { value: 10 }, wis: { value: 12 } },
    effectiveThreatLevel: 4,
    npcType: "special"
  });
  boss.type = "npc";
  boss.flags.spycraft2 = { nonLethal: { stress: 6, subdual: 14 } };
  await restAndRecover(boss, { hours: 1, days: 0 });
  assert.equal(boss.system.vitality.value, 14);
  assert.deepEqual(nonLethalTotals(boss), { stress: 0, subdual: 0 });
  assert.match(posted.at(-1).content, /subdual damage 14 → 0/);
});

test("a recorded target gives one-click Resolve and Apply buttons, and several targets take the damage together", async () => {
  reset();
  const { distinctLabels } = await import("../module/apps/damage-application.mjs");
  assert.deepEqual(distinctLabels(["Thug", "Boss", "Thug", "Thug"]), ["Thug 1", "Boss", "Thug 2", "Thug 3"]);
  const attacker = character("Kevin", { activeFeatNames: [] });
  const guard = character("Guard", {
    defense: { total: 15 },
    vitality: { value: 20, max: 20 },
    wounds: { value: 12, max: 12 },
    dr: {}
  });
  const attack = card("q1", {
    actorUuid: attacker.uuid,
    checkKind: "attack",
    rawTotal: 18,
    effectiveTotal: 18,
    attackContext: { targetActorUuid: guard.uuid }
  });
  const controls = check =>
    rollPipeline.chatControls({
      message: check,
      check: check.flags.spycraft2,
      actor: attacker,
      user: game.user,
      checkKind: check.flags.spycraft2.checkKind
    });
  const resolve = controls(attack).filter(c => c.id === "attackResolutionControl");
  assert.deepEqual(
    resolve.map(c => [c.label, c.emphasis]),
    [
      // The viewer can read this Defense, so the button already says how the roll stands against it.
      ["Resolve vs Defense 15: hit", "primary"],
      ["Other target or Defense…", undefined]
    ]
  );
  // The short face leaves the target's name and the full wording to the tooltip.
  assert.deepEqual(
    resolve.map(c => c.hint),
    [
      "Resolve this attack against Guard, Defense 15: hit",
      "Resolve this attack against another target, or against a Defense you enter"
    ]
  );
  await resolve[0].run();
  assert.equal(attack.flags.spycraft2.attackResolution.hit, true);
  // The damage card names the hit's target: one click applies the rolled damage to it.
  const damage = card("q2", {
    actorUuid: attacker.uuid,
    checkKind: "damage",
    effectiveTotal: 7,
    sourceAttack: { uuid: attack.uuid, targetUuid: guard.uuid }
  });
  const apply = controls(damage).filter(c => c.id === "applyDamageControl");
  assert.equal(apply[0].label, "Apply 7 to Guard (not on the scene)");
  assert.equal(apply[0].emphasis, "primary");
  await apply[0].run();
  assert.equal(guard.system.vitality.value, 13);
  assert.equal(
    controls(damage).some(c => c.label.startsWith("Apply 7 to Guard")),
    false,
    "not offered twice for one target"
  );
  // With several tokens targeted, one button applies the damage to each and posts a summary.
  const second = character("Guard2", { vitality: { value: 20, max: 20 }, wounds: { value: 12, max: 12 }, dr: {} });
  game.user.targets = [{ actor: guard }, { actor: second }];
  const each = controls(damage).find(c => c.label === "Apply 7 to 2 targets");
  await each.run();
  assert.deepEqual([guard.system.vitality.value, second.system.vitality.value], [6, 13]);
  assert.match(posted.at(-1).content, /Damage applied to 2 targets/);
  game.user.targets = [];
});

test("wound loss from applied damage records its end-of-round Initiative change", async () => {
  reset();
  const hurt = character("Hurt", { vitality: { value: 0, max: 20 }, wounds: { value: 12, max: 12 }, dr: {} });
  const combat = { started: true, round: 2 };
  const combatant = document({ actor: hurt, isOwner: true, initiative: 18, parent: combat, flags: {} });
  combat.combatants = [combatant];
  game.combat = combat;
  const damage = card("f1", { actorUuid: "Actor.Guard", checkKind: "damage", effectiveTotal: 4 });
  await applyDamage(damage, { targetUuid: hurt.uuid, damage: 4, kind: "lethal" });
  const modifiers = combatant.flags.spycraft2.fluid.modifiers;
  assert.equal(modifiers.length, 1);
  assert.equal(modifiers[0].amount, -2);
  assert.match(posted.at(-1).content, /Initiative -2 at the end of the round/);
  game.combat = undefined;
});

test("resolving never targets the attacker, uses the one targeted token without asking, and says how a hit stands", async () => {
  reset();
  const { targetChoices, standingAgainst, accumulatedDamageLines } =
    await import("../module/apps/damage-application.mjs");
  const attacker = character("Shooter", { activeFeatNames: [], defense: { total: 11 } });
  const guard = character("Sentry", { defense: { total: 15 } });
  const offScene = character("Faraway", { defense: { total: 10 } });
  const before = { targets: game.user.targets, actors: game.actors, combats: game.combats };
  try {
    game.actors = [attacker, guard, offScene];
    game.combats = [{ turns: [{ actor: attacker }, { actor: guard }] }];
    // The attacker's own token, targeted by mistake: it is neither offered nor preselected.
    game.user.targets = [{ actor: attacker }];
    const mistaken = targetChoices({ exclude: attacker.uuid, offScene: "fallback" });
    assert.deepEqual(
      mistaken.actors.map(actor => actor.name),
      ["Sentry"]
    );
    assert.equal(mistaken.selected, "");
    // Without the options the full list is kept, for the pickers that need it.
    assert.deepEqual(
      targetChoices().actors.map(actor => actor.name),
      ["Shooter", "Sentry", "Faraway"]
    );
    const self = card("s1", { actorUuid: attacker.uuid, checkKind: "attack", rawTotal: 18, effectiveTotal: 18 });
    assert.equal(await resolveAttack(self, { targetUuid: attacker.uuid, defense: "" }), null);
    assert.equal(self.flags.spycraft2.attackResolution, undefined);
    assert.ok(warnings.some(text => /cannot be the target of its own attack/.test(text)));
    // One other token targeted and nothing recorded on the card: settled at once, with no dialog.
    game.user.targets = [{ actor: guard }];
    const quick = card("s2", { actorUuid: attacker.uuid, checkKind: "attack", rawTotal: 18, effectiveTotal: 18 });
    const hit = await resolveAttack(quick);
    assert.deepEqual([hit.hit, hit.targetName, hit.defense], [true, "Sentry", 15]);
    // Asked for explicitly, the dialog still opens (and is cancelled here).
    const asked = card("s3", { actorUuid: attacker.uuid, checkKind: "attack", rawTotal: 18, effectiveTotal: 18 });
    assert.equal(await resolveAttack(asked, { ask: true }), null);
  } finally {
    Object.assign(game.user, { targets: before.targets });
    Object.assign(game, { actors: before.actors, combats: before.combats });
  }
  assert.equal(standingAgainst({ effectiveTotal: 18 }, 15, attacker), ": hit");
  assert.equal(standingAgainst({ effectiveTotal: 9 }, 15, attacker), ": miss");

  // Stress and subdual damage: the report says what got through and that vitality does not move.
  const system = { subdualThreshold: 14 };
  const reduced = accumulatedDamageLines("Vector", "subdual", 6, { newDamage: 2, total: 2, save: null }, system);
  assert.match(reduced[0], /6 subdual damage, 2 after damage reduction and resistance: 2 in all \(threshold 14\)/);
  assert.match(reduced[1], /Vitality and wounds do not change/);
  const stopped = accumulatedDamageLines("Vector", "subdual", 3, { newDamage: 0, total: 2, save: null }, system);
  assert.match(stopped[0], /stop all 3 subdual damage/);
  const save = accumulatedDamageLines("Vector", "stress", 9, { newDamage: 9, total: 15, save: { dc: 12 } }, {});
  assert.match(save[0], /takes 9 stress damage: 15 in all\./);
  assert.match(save[1], /save, DC 12/);
});

test("the player whose agent is attacked gets Defense buttons on the attack card and Apply on its damage card", async () => {
  reset();
  const { targetResponseControls } = await import("../module/apps/target-response.mjs");
  const guard = character("Hostile", { activeFeatNames: [] }, { type: "npc", isOwner: false });
  const mine = character("Latch", {
    defense: { total: 12 },
    vitality: { value: 20, max: 20 },
    wounds: { value: 12, max: 12 },
    dr: {}
  });
  const player = { isGM: false };
  const attack = card("t1", {
    actorUuid: guard.uuid,
    checkKind: "attack",
    rawTotal: 19,
    effectiveTotal: 19,
    attackContext: { targetActorUuid: mine.uuid }
  });
  const ids = (message, user = player) =>
    targetResponseControls({ message, check: message.flags.spycraft2, user }).map(control => control.id);
  assert.deepEqual(ids(attack), ["targetCheckDefense", "targetBoostDefense"]);
  // Once the attack is settled there is nothing left to answer on it.
  attack.flags.spycraft2.attackResolution = { hit: true };
  assert.deepEqual(ids(attack), []);
  // Someone else's agent, or an attack that names itself, offers nothing.
  const other = character("Vector", {}, { isOwner: false });
  const elsewhere = card("t2", {
    actorUuid: guard.uuid,
    checkKind: "attack",
    rawTotal: 19,
    effectiveTotal: 19,
    attackContext: { targetActorUuid: other.uuid }
  });
  assert.deepEqual(ids(elsewhere), []);
  // The damage card: the target's player takes the damage with one press.
  const damage = card("t3", {
    actorUuid: guard.uuid,
    checkKind: "damage",
    effectiveTotal: 6,
    sourceAttack: { uuid: attack.uuid, targetUuid: mine.uuid }
  });
  const [apply] = targetResponseControls({ message: damage, check: damage.flags.spycraft2, user: player });
  assert.equal(apply.id, "targetTakeDamage");
  assert.match(apply.label, /^Apply 6 to Latch/);
  await apply.run();
  assert.equal(mine.system.vitality.value, 14);
  assert.deepEqual(ids(damage), [], "not offered twice");
});
