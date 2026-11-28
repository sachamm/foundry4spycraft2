import test from "node:test";
import assert from "node:assert/strict";
import { evasionSaveContext } from "../module/rules/save-avoidance.mjs";
import { damageResistanceSource } from "../module/rules/resistances.mjs";
import { acidAttackPlan, halveAcidSource } from "../module/rules/acid-sources.mjs";

/* Foundry stand-ins: enough for the attack, damage, ammunition and opposed-check workflows to run. */
const registry = new Map();
const posted = [],
  undoNotes = [];
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
  toMessage(data) {
    return ChatMessage.create({ ...data, rolls: [this] });
  }
};
globalThis.ChatMessage = {
  getSpeaker: ({ actor }) => ({ alias: actor?.name }),
  // Undo notes are whispered to the person who applied the damage; they are kept apart from the reports.
  create: async data => ((data.flags?.spycraft2?.undo ? undoNotes : posted).push(data), data)
};
globalThis.game = {
  user: { id: "gc", isGM: true, targets: [] },
  time: { worldTime: 0 },
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

const {
  resolveAttack,
  applyDamage,
  applyBlast,
  applyDamageToEach,
  defenseOf,
  rollReportedSave,
  nonLethalTotals,
  standardReduction
} = await import("../module/apps/damage-application.mjs");
const { appliedDamageEntries } = await import("../module/rules/damage-application.mjs");
const { hazardSaveResolvers, resolveHazardSave } = await import("../module/apps/hazards.mjs");
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
  else if (last.startsWith("==")) at[last.slice(2)] = value;
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
    system: { survivalStats: { resistances: {}, resistanceSources: [] }, ...system },
    flags: {},
    statuses: new Set(),
    effects: [],
    async toggleStatusEffect(id, { active }) {
      if (active) this.statuses.add(id);
      else this.statuses.delete(id);
    },
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
  actor.system.survivalStats ??= { resistances: {}, resistanceSources: [] };
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

test("Blockbuster hazard saves snapshot PC protection and ignore secondary effects after policy ends", async () => {
  const { sufferTypedDamage } = await import("../module/apps/damage-types.mjs");
  const settings = game.settings;
  let active = true;
  game.settings = { get: (_id, key) => (key === "campaign" ? { qualities: active ? ["blockbuster"] : [] } : {}) };
  try {
    for (const type of ["acid", "explosive", "vacuum"]) {
      active = true;
      reset();
      const saves = [];
      const target = character(
        `Blockbuster-${type}`,
        { vitality: { value: 100, max: 100 }, wounds: { value: 12, max: 12 } },
        {
          async rollSave(key, options) {
            saves.push(options.hazardSave);
            return {};
          },
          async update() {
            throw Error("Protected save must not change health, hazards, stress or conditions");
          }
        }
      );
      await sufferTypedDamage(target, { type, amount: 30, armor: "none", firstRound: true });
      assert.equal(saves.length, 1);
      assert.equal(saves[0].ignoreSuccessfulHalfSave, true);
      active = false;
      await hazardSaveResolvers.get(saves[0].kind)(target, {}, saves[0], true);
      assert.equal(saves.length, 1, "No follow-up explosive stun save");
      assert.match(posted.at(-1).content, /Blockbuster/);
      assert.equal(target.system.vitality.value, 100);
    }
    active = true;
    for (const extra of [{ type: "npc" }, { system: { companionOf: { ownerUuid: "Actor.owner" } } }]) {
      let save;
      const target = character(
        "NotPC",
        {},
        {
          ...extra,
          async rollSave(_key, options) {
            save = options.hazardSave;
          }
        }
      );
      await sufferTypedDamage(target, { type: "explosive", amount: 30 });
      assert.equal(save.ignoreSuccessfulHalfSave, false);
    }
  } finally {
    game.settings = settings;
  }
});

test("Blockbuster's tripled blast distance reaches actual multi-target health application", async () => {
  reset();
  const before = game.settings;
  game.settings = { get: (_id, key) => (key === "campaign" ? { qualities: ["blockbuster"] } : {}) };
  try {
    const target = character("BlockbusterTarget", {
      vitality: { value: 100, max: 100 },
      wounds: { value: 12, max: 12 }
    });
    const damage = card("blockbuster-blast", {
      checkKind: "damage",
      effectiveTotal: 40,
      weaponQualities: "BLS (5 ft.)"
    });
    await applyBlast(damage, {
      routeConfirmed: true,
      targets: [{ uuid: target.uuid, distanceFeet: 15 }],
      kind: "lethal",
      type: ""
    });
    assert.equal(target.system.vitality.value, 80);
  } finally {
    game.settings = before;
  }
});

test("laser attack cards ignore prepared dodge but retain a GC override", async () => {
  reset();
  const attacker = character("LaserAttacker", {});
  const target = character("LaserDefender", {
    defense: { total: 18, dodgeBonuses: 3, dodgeLost: 0 },
    weaponSpecialist: { abilities: ["Foibles"], proficiencies: ["rifle"] }
  });
  const attack = id =>
    card(id, {
      actorUuid: attacker.uuid,
      checkKind: "attack",
      effectiveTotal: 16,
      weaponProficiency: "rifle",
      attackContext: { damageType: "laser" }
    });
  const result = await resolveAttack(attack("laser-target"), { targetUuid: target.uuid });
  assert.equal(result.defense, 15);
  assert.equal(result.hit, true);
  assert.equal(result.specialistDodge, 0);
  assert.equal((await resolveAttack(attack("laser-override"), { targetUuid: target.uuid, defense: 18 })).hit, false);
});

test("campaign injury thresholds reach damage cards and remain fixed when the campaign changes before the save", async () => {
  reset();
  const settings = game.settings;
  let quality = "bulletproof";
  game.settings = { get: (_id, key) => (key === "campaign" ? { qualities: [quality] } : {}) };
  try {
    const target = character(
      "CampaignInjuryTarget",
      { vitality: { value: 100, max: 100 }, wounds: { value: 12, max: 12 } },
      { type: "npc" }
    );
    // A special NPC has health pools and is recognised by the normal NPC helper.
    target.system.npcType = "special";
    const damage = card("campaign-injury", { checkKind: "damage", effectiveTotal: 61 });
    await applyDamage(damage, { targetUuid: target.uuid, damage: 61, kind: "lethal" });
    const save = posted.at(-1).flags.spycraft2.pendingSave;
    assert.equal(save.thresholds.criticalInjuryMin, 36);
    assert.equal(save.thresholds.massiveDamage, 61);
    quality = "gritty";
    await hazardSaveResolvers.get("massiveDamage")(target, { id: "campaign-save" }, save, false);
    assert.match(posted.at(-1).content, /hit of 61 or more/);
    assert.equal(target.system.wounds.value, -9);
  } finally {
    game.settings = settings;
  }
});

test("Foibles changes the posted attack outcome only for covered weapons and respects a GC Defense override", async () => {
  reset();
  const attacker = character("FoiblesAttacker", {});
  const target = character("FoiblesTarget", {
    defense: { total: 15 },
    weaponSpecialist: { abilities: ["Foibles"], proficiencies: ["rifle"] }
  });
  const attack = id =>
    card(id, { actorUuid: attacker.uuid, checkKind: "attack", effectiveTotal: 15, weaponProficiency: "rifle" });
  const result = await resolveAttack(attack("foibles-hit"), { targetUuid: target.uuid });
  assert.equal(result.defense, 16);
  assert.equal(result.hit, false);
  assert.equal(result.specialistDodge, 1);
  const override = await resolveAttack(attack("foibles-override"), { targetUuid: target.uuid, defense: 15 });
  assert.equal(override.hit, true);
  assert.equal(override.specialistDodge, 0);
  target.system.defense.vulnerable = true;
  assert.equal((await resolveAttack(attack("foibles-vulnerable"), { targetUuid: target.uuid })).defense, 15);
});

test("damage cards apply Foibles from the saved attack proficiency even without a surviving weapon item", async () => {
  reset();
  const target = character("FoiblesDamageTarget", {
    vitality: { value: 20, max: 20 },
    wounds: { value: 12, max: 12 },
    dr: { melee: 0, other: 2 },
    weaponSpecialist: { abilities: ["Foibles"], proficiencies: ["rifle"] }
  });
  const damage = card("foibles-damage", { checkKind: "damage", effectiveTotal: 10, weaponProficiency: "rifle" });
  await applyDamage(damage, { targetUuid: target.uuid, damage: 10, kind: "lethal", attackKind: "rangedWeapon" });
  assert.equal(target.system.vitality.value, 13);
  assert.match(posted.at(-1).content, /Foibles/);
});

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
  const note = undoNotes.at(-1).flags.spycraft2.undo;
  assert.equal(note.label, "11 lethal damage applied to Kevin");
  assert.ok(note.entries[0].restore.some(([path]) => path.startsWith("system.vitality")));
  assert.equal(note.damageCard.targetUuid, note.entries[0].uuid);
  assert.deepEqual(appliedDamageEntries(damage.flags.spycraft2), [
    { targetUuid: kevin.uuid, name: "Kevin", damage: 11, kind: "lethal" }
  ]);
  // A critical hit while vitality remains goes to wounds; armor-piercing lowers the DR.
  await assert.rejects(applyDamage(damage, { targetUuid: kevin.uuid, damage: 11, kind: "lethal" }), /already reached/);
  kevin.system.vitality.value = 10;
  const criticalCard = card("d1-critical", { actorUuid: "Actor.Guard", checkKind: "damage", effectiveTotal: 10 });
  await applyDamage(criticalCard, {
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

test("a Table of Ouch critical on a special NPC rolls the injury at once, and uses up a Burst's first shot", async () => {
  reset();
  const boss = character("Boss4", {
    vitality: { value: 30, max: 30 },
    wounds: { value: 14, max: 14 },
    npcType: "special"
  });
  boss.type = "npc";
  const shooter = character("Shooter4", { activeFeatNames: [] });
  const attack = card("o1", {
    actorUuid: shooter.uuid,
    checkKind: "attack",
    rawTotal: 22,
    effectiveTotal: 22,
    criticalSuccess: true,
    criticalActivation: { cost: 2, baseCost: 2, preset: "hit.ouch" },
    attackResolution: { hit: true, hits: 3 }
  });
  const first = card("o2", {
    actorUuid: shooter.uuid,
    checkKind: "damage",
    effectiveTotal: 12,
    sourceAttack: { uuid: attack.uuid }
  });
  await applyDamage(first, { targetUuid: boss.uuid, damage: 12, kind: "lethal" });
  assert.equal(boss.system.vitality.value, 18, "an ordinary hit: the Ouch effect replaces going to wounds");
  // The injury roll is 1d20 + 12 net damage, every die showing 5 here.
  assert.match(posted.at(-1).content, /Table of Ouch critical on Boss4 \(17\)/);
  assert.equal(posted.at(-1).rolls.length, 1);
  // The NPC has no injury record to roll from, so the card offers no Ouch button for it.
  assert.equal(appliedDamageEntries(first.flags.spycraft2).at(-1).ouch, undefined);
  // The first shot is used, so the attack's next damage card is a normal hit.
  assert.deepEqual(attack.flags.spycraft2.criticalShotApplied, { damageMessageId: "o2" });
  const second = card("o3", {
    actorUuid: shooter.uuid,
    checkKind: "damage",
    effectiveTotal: 9,
    sourceAttack: { uuid: attack.uuid }
  });
  const before = posted.length;
  await applyDamage(second, { targetUuid: boss.uuid, damage: 9, kind: "lethal" });
  assert.ok(posted.slice(before).every(message => !/Table of Ouch/.test(message.content)));
});

test("a special NPC's stress and subdual damage is totalled and its threshold save offered", async () => {
  reset();
  const boss = character("Boss3", { abilities: { con: { value: 10 }, wis: { value: 12 } }, npcType: "special" });
  boss.type = "npc";
  const damage = card("d4", { actorUuid: "Actor.Kevin", checkKind: "damage", effectiveTotal: 8 });
  await applyDamage(damage, { targetUuid: boss.uuid, damage: 8, kind: "subdual" });
  assert.deepEqual(nonLethalTotals(boss), { stress: 0, subdual: 8 });
  assert.equal(posted.at(-1).flags, undefined, "below the threshold: no save");
  const nextDamage = card("d4-next", { actorUuid: "Actor.Kevin", checkKind: "damage", effectiveTotal: 6 });
  await applyDamage(nextDamage, { targetUuid: boss.uuid, damage: 6, kind: "subdual" });
  assert.equal(nonLethalTotals(boss).subdual, 14);
  const save = posted.at(-1).flags.spycraft2.pendingSave;
  assert.deepEqual([save.kind, save.saveKey, save.dc, save.damageKind], ["thresholdSave", "fort", 12, "subdual"]);
  await hazardSaveResolvers.get("thresholdSave")(boss, {}, save, false, { effectiveTotal: 7 });
  assert.equal(boss.statuses.has("unconscious"), true);
  assert.match(posted.at(-1).content, /unconscious for 2 round/);
  const stressCard = card("npc-stress", { actorUuid: "Actor.Kevin", checkKind: "damage", effectiveTotal: 14 });
  await applyDamage(stressCard, { targetUuid: boss.uuid, damage: 14, kind: "stress" });
  const stressSave = posted.at(-1).flags.spycraft2.pendingSave;
  assert.equal(stressSave.stressGrade, 1);
  assert.equal(stressSave.failureOutcome, "Shaken I");
  assert.equal(typeof stressSave.eventId, "string");
});

test("special NPC weapon hazards keep typed damage, exposure and executable threshold saves", async () => {
  for (const type of ["cold", "heat", "electrical"]) {
    reset();
    const boss = character(`Typed-${type}`, {
      vitality: { value: 30, max: 30 },
      wounds: { value: 10, max: 10 },
      abilities: { con: { value: 10 }, wis: { value: 10 } },
      npcType: "special",
      dr: 5
    });
    boss.type = "npc";
    const damage = card(`typed-${type}`, { actorUuid: "Actor.Kevin", checkKind: "damage", effectiveTotal: 14 });
    await applyDamage(damage, { targetUuid: boss.uuid, damage: 14, kind: "lethal", type });
    assert.equal(boss.system.vitality.value, 30, `${type} is subdual`);
    assert.equal(nonLethalTotals(boss).subdual, 14, `${type} applies its own AP before doubled subdual DR`);
    assert.equal(boss.system.hazards.exposure.type, type);
    const report = posted.find(m => m.flags?.spycraft2?.pendingSave);
    assert.equal(report.flags.spycraft2.pendingSave.saveKey, "fort");
    assert.equal(report.flags.spycraft2.pendingSave.dc, 12);
    const before = posted.length;
    await assert.rejects(
      applyDamage(damage, { targetUuid: boss.uuid, damage: 14, kind: "lethal", type }),
      /already reached/
    );
    assert.equal(posted.length, before, "the delivered typed hit cannot repeat");
    assert.equal(nonLethalTotals(boss).subdual, 14);
  }
});

test("special NPC lethal hazards also produce stress threshold save reports", async () => {
  reset();
  const boss = character("Typed-laser", {
    vitality: { value: 60, max: 60 },
    wounds: { value: 10, max: 10 },
    abilities: { con: { value: 10 }, wis: { value: 2 } },
    npcType: "special"
  });
  boss.type = "npc";
  const damage = card("typed-laser", { actorUuid: "Actor.Kevin", checkKind: "damage", effectiveTotal: 14 });
  await applyDamage(damage, { targetUuid: boss.uuid, damage: 14, kind: "lethal", type: "laser" });
  assert.equal(boss.system.vitality.value, 46);
  assert.equal(nonLethalTotals(boss).stress, 3);
  assert.equal(posted.find(m => m.flags?.spycraft2?.pendingSave)?.flags.spycraft2.pendingSave.saveKey, "will");
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
    routeConfirmed: true,
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

test("original cover damage cannot reach the protected target before its cover-save review is complete", async () => {
  reset();
  const target = character("CoverPendingTarget", { vitality: { value: 40, max: 40 }, wounds: { value: 12, max: 12 } });
  const attack = card("cover-awaiting", { checkKind: "attack", coverAwaiting: { version: 1, id: "original-cover" } });
  const damage = card("cover-original-damage", {
    checkKind: "damage",
    effectiveTotal: 10,
    sourceAttack: { uuid: attack.uuid }
  });
  assert.equal(await applyDamage(damage, { targetUuid: target.uuid, damage: 10, kind: "lethal" }), false);
  assert.equal(target.system.vitality.value, 40);
  assert.equal(appliedDamageEntries(damage.flags.spycraft2).length, 0);
  assert.ok(warnings.some(note => note.includes("cover-save review")));
  assert.equal(posted.length, 0);
});

test("the connected cover review freezes original burst damage, keeps direct shots and caps penetrating delivery", async () => {
  reset();
  const { prepareCoverAttack, reviewCoverSaves } = await import("../module/apps/cover-interception.mjs");
  const { attackDamageBasis, newDamageHitLedger, reserveDamageHit } =
    await import("../module/rules/attack-damage-hits.mjs");
  const shooter = character(
    "CoverWorkflowShooter",
    { activeFeatNames: [] },
    {
      async confirmCheckOutcome(message, opts) {
        await message.update({ "flags.spycraft2.successConfirmed": opts.succeeded });
        return message.flags.spycraft2;
      }
    }
  );
  const target = character("CoverWorkflowTarget", {
    defense: { total: 12 },
    vitality: { value: 40, max: 40 },
    wounds: { value: 12, max: 12 }
  });
  const source = card("cover-workflow-source", {
    checkKind: "attack",
    actorUuid: shooter.uuid,
    weaponUuid: shooter.uuid + ".Item.weapon",
    rawTotal: 23,
    effectiveTotal: 23,
    naturalDie: 10,
    threat: 20,
    error: 1,
    damageHitsVersion: 1,
    attackContext: { fireAction: { action: "burst" }, ranged: true }
  });
  const pending = await prepareCoverAttack(source, shooter, {
    targetUuid: target.uuid,
    targetName: target.name,
    total: 23,
    defense: 18,
    cover: { grade: 3, bonus: 6 },
    hit: true,
    hits: 2
  });
  assert.equal(pending.basis.potentialHits, 3);
  assert.equal(source.flags.spycraft2.successConfirmed, true);
  const basis = attackDamageBasis(source.flags.spycraft2, {
    actorUuid: shooter.uuid,
    weaponUuid: source.flags.spycraft2.weaponUuid
  });
  let ledger = newDamageHitLedger(basis);
  const damage = [];
  for (let i = 1; i <= 3; i++) {
    ledger = reserveDamageHit(ledger, basis, "coverShot" + i);
    const slot = ledger.slots.at(-1);
    const message = card("cover-workflow-damage" + i, {
      checkKind: "damage",
      actorUuid: shooter.uuid,
      effectiveTotal: 10 + i,
      sourceAttack: { uuid: source.uuid, targetUuid: target.uuid, claimId: slot.claimId, hitIndex: i },
      damageProfile: { kind: "lethal" }
    });
    slot.state = "posted";
    slot.messageUuid = message.uuid;
    slot.actualCheck = structuredClone(message.flags.spycraft2);
    slot.actualRolls = [];
    damage.push(message);
  }
  shooter.flags.spycraft2 = { attackDamageHits: { [source.id]: ledger } };
  await assert.rejects(
    () =>
      reviewCoverSaves(source, shooter, {
        input: { confirmed: true, result3: "penetrated", remaining3: 99, note3: "Actual save failed" }
      }),
    /Review each/
  );
  assert.equal(target.system.vitality.value, 40);
  assert.equal(source.flags.spycraft2.coverInterception, undefined);
  await reviewCoverSaves(source, shooter, {
    input: {
      confirmed: true,
      result3: "penetrated",
      remaining3: 4,
      note3: "Scenery failed its actual Damage save; GC confirmed four remaining damage"
    }
  });
  const result = await resolveAttack(source);
  assert.equal(result.hits, 3);
  assert.equal(source.flags.spycraft2.coverInterception.state, "complete");
  assert.equal(damage[2].flags.spycraft2.effectiveTotal, 13, "original dice retained");
  assert.equal(await applyDamage(damage[2], { targetUuid: target.uuid, damage: 13, kind: "lethal" }), false);
  assert.equal(target.system.vitality.value, 40);
  await applyDamage(damage[2], { targetUuid: target.uuid, damage: 4, kind: "lethal" });
  assert.equal(target.system.vitality.value, 36);
  await assert.rejects(
    () => applyDamage(damage[2], { targetUuid: target.uuid, damage: 4, kind: "lethal" }),
    /already reached/
  );
  assert.equal(target.system.vitality.value, 36, "original hit receipt prevents repeated delivery");
  assert.deepEqual(
    damage.map(m => m.flags.spycraft2.effectiveTotal),
    [11, 12, 13]
  );
});

test("total cover identifies actual first contact before threat confirmation and a stopped shot leaves target untouched", async () => {
  reset();
  const { prepareCoverAttack, reviewCoverSaves } = await import("../module/apps/cover-interception.mjs");
  const { adjudicateCheck } = await import("../module/rules/outcomes.mjs");
  const { attackDamageBasis, newDamageHitLedger, reserveDamageHit } =
    await import("../module/rules/attack-damage-hits.mjs");
  const shooter = character(
    "TotalCoverShooter",
    { activeFeatNames: [] },
    {
      async confirmCheckOutcome(message, opts) {
        Object.assign(message.flags.spycraft2, adjudicateCheck(message.flags.spycraft2, opts.succeeded));
        return message.flags.spycraft2;
      }
    }
  );
  const target = character("TotalCoverTarget", {
    defense: { total: 12 },
    vitality: { value: 40, max: 40 },
    wounds: { value: 12, max: 12 }
  });
  const source = card("total-cover-workflow", {
    checkKind: "attack",
    actorUuid: shooter.uuid,
    weaponUuid: shooter.uuid + ".Item.weapon",
    rawTotal: 20,
    effectiveTotal: 20,
    naturalDie: 19,
    threat: 21,
    error: 1,
    successConfirmed: true,
    threatConfirmed: false,
    damageHitsVersion: 1,
    attackContext: { targetRole: { threatRangeReduction: 2 }, ranged: true }
  });
  await prepareCoverAttack(
    source,
    shooter,
    {
      targetUuid: target.uuid,
      targetName: target.name,
      defense: 20,
      cover: { grade: 4, bonus: 8 },
      total: 20,
      hit: false,
      hits: 0
    },
    { input: { name: "Concrete barrier", characterType: "object" } }
  );
  assert.equal(source.flags.spycraft2.threat, 19);
  assert.equal(
    source.flags.spycraft2.threatConfirmed,
    true,
    "the cover contact is confirmed even when a prior target outcome existed"
  );
  const basis = attackDamageBasis(source.flags.spycraft2, {
    actorUuid: shooter.uuid,
    weaponUuid: source.flags.spycraft2.weaponUuid
  });
  const ledger = reserveDamageHit(newDamageHitLedger(basis), basis, "totalCoverShot");
  const damage = card("total-cover-damage", {
    checkKind: "damage",
    actorUuid: shooter.uuid,
    effectiveTotal: 9,
    sourceAttack: { uuid: source.uuid, targetUuid: target.uuid, claimId: "totalCoverShot", hitIndex: 1 }
  });
  Object.assign(ledger.slots[0], { state: "posted", messageUuid: damage.uuid });
  shooter.flags.spycraft2 = { attackDamageHits: { [source.id]: ledger } };
  await reviewCoverSaves(source, shooter, {
    input: { confirmed: true, result1: "held", remaining1: 0, note1: "Concrete save succeeded; shot stopped" }
  });
  const result = await resolveAttack(source);
  assert.equal(result.hit, false);
  assert.equal(source.flags.spycraft2.successConfirmed, true);
  assert.equal(await applyDamage(damage, { targetUuid: target.uuid, damage: 0, kind: "lethal" }), false);
  assert.equal(target.system.vitality.value, 40);
});

test("blast cover decisions preserve full ring damage after a failed cover save and exclude intact cover", async () => {
  reset();
  const open = character("BlastOpen", { vitality: { value: 40, max: 40 }, wounds: { value: 12, max: 12 } });
  const blocked = character("BlastCovered", { vitality: { value: 40, max: 40 }, wounds: { value: 12, max: 12 } });
  const breached = character("BlastBreached", { vitality: { value: 40, max: 40 }, wounds: { value: 12, max: 12 } });
  const source = card("reviewed-blast", { checkKind: "damage", effectiveTotal: 20, weaponQualities: "BLS (5 ft.)" });
  await applyBlast(source, {
    routeConfirmed: true,
    shape: "cone",
    kind: "lethal",
    type: "",
    targets: [
      { uuid: open.uuid, distanceFeet: 0 },
      { uuid: blocked.uuid, distanceFeet: 5, route: "blocked", coverNote: "GC confirmed intact scenery cover" },
      {
        uuid: breached.uuid,
        distanceFeet: 5,
        route: "breached",
        coverNote: "GC confirmed scenery cover failed its original Damage save"
      }
    ]
  });
  assert.deepEqual(
    [open.system.vitality.value, blocked.system.vitality.value, breached.system.vitality.value],
    [20, 40, 30]
  );
  assert.equal(appliedDamageEntries(source.flags.spycraft2).length, 2);
  const reviews = Object.values(source.flags.spycraft2.blastExposureReviewsBy);
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].shape, "cone");
  assert.equal(reviews[0].targets[2].damage, 10);
  assert.ok(posted.some(row => row.content?.includes("Cover stopped the blast")));
});

test("all blast declarations are validated before any selected target loses health or consumes damage dice", async () => {
  for (const extra of [
    { distanceFeet: "" },
    { distanceFeet: undefined },
    { distanceFeet: NaN },
    { distanceFeet: -1 },
    { route: "breached", coverNote: "" },
    { uuid: "Actor.missing" }
  ]) {
    reset();
    const first = character("BlastFirst", { vitality: { value: 40, max: 40 }, wounds: { value: 12, max: 12 } });
    const second = character("BlastSecond", { vitality: { value: 40, max: 40 }, wounds: { value: 12, max: 12 } });
    const source = card("invalid-blast", { checkKind: "damage", effectiveTotal: 20, weaponQualities: "BLS (5 ft.)" });
    await assert.rejects(() =>
      applyBlast(source, {
        routeConfirmed: true,
        targets: [
          { uuid: first.uuid, distanceFeet: 0 },
          { uuid: second.uuid, distanceFeet: 5, ...extra }
        ]
      })
    );
    assert.deepEqual([first.system.vitality.value, second.system.vitality.value], [40, 40]);
    assert.equal(appliedDamageEntries(source.flags.spycraft2).length, 0);
    assert.equal(source.flags.spycraft2.blastExposureReviewsBy, undefined);
  }
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
  assert.deepEqual(asked, [
    [
      "fort",
      {
        kind: "bang",
        label: asked[0][1].label,
        dc: 18,
        originalDamage: 18,
        resistanceSource: damageResistanceSource(agent.system, "bang")
      }
    ]
  ]);
  assert.equal(agent.system.vitality.value, 40, "bang damage is a save, not lost vitality");
});

test("standard NPC bang and flash hits call for Fortitude saves instead of lethal Damage saves", async () => {
  for (const type of ["bang", "flash"]) {
    reset();
    const actor = character(`Standard-${type}`, { npcType: "standard", damageSave: 0, vitality: { value: 0, max: 0 } });
    actor.type = "npc";
    const asked = [];
    actor.rollSave = async (key, options) => (asked.push([key, options.hazardSave]), { flags: {} });
    const damage = card(`standard-${type}`, { actorUuid: "Actor.Kevin", checkKind: "damage", effectiveTotal: 18 });
    await applyDamage(damage, { targetUuid: actor.uuid, damage: 18, kind: "lethal", type });
    assert.equal(asked[0][0], "fort");
    assert.equal(asked[0][1].kind, type);
    assert.equal(asked[0][1].dc, 18);
    assert.equal(actor.system.damageTrack, undefined, "the sensory hit itself is no lethal damage");
  }
});

test("flash/bang delivers separate full-DC saves for agents and both NPC health models", async () => {
  for (const npcType of [null, "standard", "special"]) {
    reset();
    const actor = character(`Compound-${npcType}`, {
      npcType,
      vitality: { value: 40, max: npcType === "standard" ? 0 : 40 },
      wounds: { value: 12, max: 12 },
      survivalStats: { resistances: { FL: 4, BN: 2 }, resistanceSources: [] }
    });
    if (npcType) actor.type = "npc";
    const asked = [];
    actor.rollSave = async (key, options) => {
      asked.push([key, options.hazardSave]);
      return { uuid: `ChatMessage.${options.hazardSave.kind}`, flags: {} };
    };
    const damage = card(`compound-${npcType}`, {
      checkKind: "damage",
      effectiveTotal: 18,
      damageProfile: { kind: "lethal", type: "flashBang", armorPiercing: 0, blast: true }
    });
    assert.ok(await applyDamage(damage, { targetUuid: actor.uuid, damage: 18 }));
    assert.deepEqual(
      asked.map(([key, save]) => [key, save.kind, save.dc]),
      [
        ["fort", "flash", 14],
        ["fort", "bang", 16]
      ]
    );
    const row = Object.values(actor.flags.spycraft2.damageApplications)[0];
    assert.equal(row.state, "complete");
    assert.deepEqual(row.components, {
      flash: { state: "posted", messageUuid: "ChatMessage.flash" },
      bang: { state: "posted", messageUuid: "ChatMessage.bang" }
    });
    assert.equal(actor.system.vitality.value, 40);
    await assert.rejects(applyDamage(damage, { targetUuid: actor.uuid, damage: 18 }), /already reached/);
    assert.equal(asked.length, 2, "a second Apply cannot roll either component again");
  }
});

test("an interrupted second sensory save preserves first delivery and blocks replacement dice", async () => {
  reset();
  const actor = character("Interrupted-compound", { vitality: { value: 40, max: 40 } });
  let rolls = 0;
  actor.rollSave = async () => (++rolls === 1 ? { uuid: "ChatMessage.first" } : null);
  const damage = card("interrupted-compound", {
    checkKind: "damage",
    effectiveTotal: 18,
    damageProfile: { kind: "lethal", type: "flashBang", armorPiercing: 0, blast: true }
  });
  assert.equal(await applyDamage(damage, { targetUuid: actor.uuid, damage: 18 }), null);
  const row = Object.values(actor.flags.spycraft2.damageApplications)[0];
  assert.equal(row.state, "needsReview");
  assert.equal(row.components.flash.messageUuid, "ChatMessage.first");
  assert.equal(row.components.bang.state, "started");
  await assert.rejects(applyDamage(damage, { targetUuid: actor.uuid, damage: 18 }), /pending damage/);
  assert.equal(rolls, 2);
});

test("standard NPC hazard stress rolls its actual Damage save with campaign factors once", async () => {
  reset();
  const actor = character("Standard-stress", {
    npcType: "standard",
    damageSave: 0,
    vitality: { value: 0, max: 0 },
    campaignEffects: { stressDamageMultipliers: [2] }
  });
  actor.type = "npc";
  const { sufferStress } = await import("../module/apps/hazards.mjs");
  await sufferStress(actor, 6, "Sensory hazard");
  const report = posted.find(m => m.flags?.spycraft2?.npcDamageSave);
  assert.ok(report, "actual Damage save posted rather than a reminder");
  assert.equal(report.flags.spycraft2.npcDamageSave.campaignStressAdjusted, true);
  assert.equal(report.flags.spycraft2.npcDamageSave.damage, 12);
  assert.equal(actor.system.damageTrack.state, "unconscious");
});

test("standard NPC cold, heat and electrical hits use subdual Damage saves and their own armor piercing", async () => {
  for (const type of ["cold", "heat", "electrical"]) {
    reset();
    const actor = character(`Standard-kind-${type}`, {
      npcType: "standard",
      damageSave: 30,
      vitality: { value: 0, max: 0 },
      dr: { other: type === "electrical" ? 10 : 50 }
    });
    actor.type = "npc";
    const damage = card(`kind-${type}`, { actorUuid: "Actor.Kevin", checkKind: "damage", effectiveTotal: 14 });
    await applyDamage(damage, { targetUuid: actor.uuid, damage: 14, kind: "lethal", type });
    const reports = posted.filter(m => m.flags?.spycraft2?.npcDamageSave).map(m => m.flags.spycraft2.npcDamageSave);
    assert.equal(reports[0].kind, "subdual");
    assert.equal(reports[0].damage, 14);
    assert.equal(reports.length, type === "electrical" ? 2 : 1);
    if (type === "electrical") {
      assert.equal(reports[1].kind, "stress");
      assert.equal(reports[1].damage, 3);
    }
  }
});

test("standard NPC laser and collision stress uses damage after actual armor piercing and DR", async () => {
  for (const [type, dr, ap, net, stress] of [
    ["laser", 20, 0, 8, 2],
    ["collision", 4, 3, 13, 3]
  ]) {
    reset();
    const actor = character(`Standard-secondary-${type}`, {
      npcType: "standard",
      damageSave: 30,
      vitality: { value: 0, max: 0 },
      dr: { other: dr }
    });
    actor.type = "npc";
    const damage = card(`secondary-${type}`, { actorUuid: "Actor.Kevin", checkKind: "damage", effectiveTotal: 14 });
    await applyDamage(damage, { targetUuid: actor.uuid, damage: 14, kind: "lethal", type, armorPiercing: ap });
    const reports = posted.filter(m => m.flags?.spycraft2?.npcDamageSave).map(m => m.flags.spycraft2.npcDamageSave);
    assert.deepEqual(
      reports.map(r => [r.kind, r.damage]),
      [
        ["lethal", net],
        ["stress", stress]
      ]
    );
    assert.equal(actor.system.damageTrack.accumulated, net + stress);
  }
});

test("standard NPC stress does not reroll an NPC already eliminated by its primary damage", async () => {
  reset();
  const actor = character("Standard-eliminated", {
    npcType: "standard",
    damageSave: 0,
    vitality: { value: 0, max: 0 }
  });
  actor.type = "npc";
  const damage = card("eliminated-electrical", { actorUuid: "Actor.Kevin", checkKind: "damage", effectiveTotal: 14 });
  await applyDamage(damage, { targetUuid: actor.uuid, damage: 14, kind: "lethal", type: "electrical" });
  assert.equal(actor.system.damageTrack.state, "unconscious");
  assert.equal(posted.filter(m => m.flags?.spycraft2?.npcDamageSave).length, 1);
});

test("acid and laser conversion is refused before source or target mutation", async () => {
  for (const type of ["acid", "laser"]) {
    reset();
    const actor = character(`Cannot-convert-${type}`, { npcType: "standard", damageSave: 30 });
    actor.type = "npc";
    const damage = card(`convert-${type}`, { actorUuid: "Actor.Kevin", checkKind: "damage", effectiveTotal: 14 });
    assert.equal(await applyDamage(damage, { targetUuid: actor.uuid, damage: 14, kind: "subdual", type }), false);
    assert.match(warnings[0], /cannot be converted/);
    assert.equal(actor.system.damageTrack, undefined);
    assert.equal(damage.flags.spycraft2.damageApplicationStarted, undefined);
  }
});

test("standard NPC acid, explosive, vacuum and fire use actual Damage saves and tracked hazard state", async () => {
  for (const type of ["acid", "explosive", "vacuum", "fire"]) {
    reset();
    const actor = character(`Standard-full-${type}`, {
      npcType: "standard",
      damageSave: 30,
      vitality: { value: 0, max: 0 },
      dr: { other: 3 }
    });
    actor.type = "npc";
    const asked = [];
    actor.rollSave = async (key, options) => (asked.push([key, structuredClone(options.hazardSave)]), { flags: {} });
    const damage = card(`full-${type}`, { actorUuid: "Actor.Kevin", checkKind: "damage", effectiveTotal: 14 });
    await applyDamage(damage, { targetUuid: actor.uuid, damage: 14, kind: "lethal", type });
    assert.equal(asked[0][0], type === "vacuum" ? "fort" : "ref");
    if (type !== "fire") {
      assert.equal(actor.system.damageTrack, undefined, "damage waits for its actual first save");
      const save = card(`delayed-${type}`, {
        actorUuid: actor.uuid,
        checkKind: "save",
        checkId: type === "vacuum" ? "fort" : "ref",
        evasionContext: evasionSaveContext(actor.system, { reflexReducesDamage: true }),
        rawTotal: 5,
        effectiveTotal: 5,
        resolved: true,
        successConfirmed: false,
        hazardSave: asked[0][1]
      });
      await resolveHazardSave(actor, save);
      assert.equal(actor.flags.spycraft2.hazardResolutions[save.id].state, "complete");
      const before = posted.length;
      await resolveHazardSave(actor, save);
      assert.equal(posted.length, before);
    }
    const reports = posted.filter(m => m.flags?.spycraft2?.npcDamageSave).map(m => m.flags.spycraft2.npcDamageSave);
    const net = type === "vacuum" ? 14 : type === "acid" ? 12 : 11;
    assert.deepEqual([reports[0].kind, reports[0].damage], ["lethal", net]);
    assert.equal(reports[1].kind, "stress");
    if (type === "acid") {
      assert.equal(reports[1].damage, 6, "acid AP 1 leaves DR 2: 14 - 2 = 12, then half as stress");
      assert.equal(actor.system.hazards.acid.damage, 14);
    }
    if (type === "vacuum") {
      assert.equal(reports[1].damage, 7);
      assert.equal(actor.system.hazards.exposure.type, "vacuum");
    }
    if (type === "fire") {
      assert.equal(reports[1].damage, 11);
      assert.equal(actor.system.hazards?.fire ?? null, null);
    }
    if (type === "explosive") {
      const flat = posted.flatMap(m => m.rolls ?? []).find(r => r.formula === "1d4");
      assert.equal(reports[1].damage, Math.floor(net / 4) + flat.total);
      assert.equal(asked[1][1].kind, "explosiveFort");
    }
  }
});

test("a delayed typed hit retains its activated critical size for standard and special NPCs", async () => {
  for (const special of [false, true]) {
    reset();
    const actor = character(`Critical-acid-${special}`, {
      npcType: special ? "special" : "standard",
      damageSave: 30,
      vitality: { value: 40, max: special ? 40 : 0 },
      wounds: { value: 20, max: 20 },
      abilities: { con: { value: 10 }, wis: { value: 10 } },
      dr: { other: 3 }
    });
    actor.type = "npc";
    let retained;
    actor.rollSave = async (key, options) => ((retained = structuredClone(options.hazardSave)), { flags: {} });
    const damage = card(`critical-acid-${special}`, {
      actorUuid: "Actor.Kevin",
      checkKind: "damage",
      effectiveTotal: 14
    });
    await applyDamage(damage, {
      targetUuid: actor.uuid,
      damage: 14,
      kind: "lethal",
      type: "acid",
      critical: true,
      criticalDice: 2,
      blast: true
    });
    assert.equal(retained.hitContext.critical, true);
    assert.equal(retained.hitContext.criticalDice, 2);
    assert.equal(retained.hitContext.blast, true);
    const save = card(`critical-acid-save-${special}`, {
      actorUuid: actor.uuid,
      checkKind: "save",
      checkId: "ref",
      evasionContext: evasionSaveContext(actor.system, { reflexReducesDamage: true }),
      rawTotal: 5,
      effectiveTotal: 5,
      resolved: true,
      successConfirmed: false,
      hazardSave: retained
    });
    await resolveHazardSave(actor, save);
    if (special) {
      assert.equal(actor.system.vitality.value, 40);
      assert.equal(actor.system.wounds.value, 8, "the delayed acid hit retains its critical routing and minimum AP 1");
    } else {
      assert.equal(actor.system.damageTrack.last.failures, 2);
      assert.equal(actor.system.damageTrack.state, "dead");
    }
  }
});

test("typed Reflex damage uses recorded Evasion, retains earlier acid and preserves explosive secondary saves", async () => {
  for (const [kind, grade, flatFooted, succeeded, impact] of [
    ["acid", 1, false, true, 0],
    ["acid", 1, true, true, 7],
    ["acid", 2, false, false, 7],
    ["explosiveReflex", 1, false, true, 0],
    ["explosiveReflex", 2, false, false, 7]
  ]) {
    reset();
    const actor = character(`Evasion-${kind}-${grade}-${flatFooted}`, {
      vitality: { value: 100, max: 100 },
      wounds: { value: 20, max: 20 },
      hazards: { acid: { damage: 3, suffered: 2, startedAt: 0 } }
    });
    const saves = [];
    actor.rollSave = async (id, options) => saves.push([id, options]);
    const check = {
      checkKind: "save",
      checkId: "ref",
      successConfirmed: succeeded,
      evasionContext: { version: 1, grade, flatFooted, reflexReducesDamage: true }
    };
    await hazardSaveResolvers.get(kind)(
      actor,
      null,
      {
        damage: 14,
        reduction: 0,
        dc: 14,
        resistanceSource: damageResistanceSource(actor.system, kind === "acid" ? "acid" : "explosive")
      },
      succeeded,
      check
    );
    assert.equal(actor.system.vitality.value, 100 - impact);
    if (kind === "acid") {
      assert.equal(
        actor.system.hazards.acid.damage,
        impact ? impact + 3 : 3,
        "an older attack stays separate from the new exposure"
      );
      if (impact)
        assert.deepEqual(
          Object.values(actor.system.hazards.acidSources)
            .map(row => row.damage)
            .sort((a, b) => a - b),
          [3, impact].sort((a, b) => a - b)
        );
    } else {
      assert.equal(saves[0][0], "fort", "Evasion does not remove the separate stun save");
      assert.ok(posted.flatMap(m => m.rolls ?? []).some(r => r.formula === "1d4"));
    }
  }
});

test("an acid weapon rolls actual coverage and preserves non-armor DR after its original AP", async () => {
  reset();
  const actor = character("Acid-armor", {
    vitality: { value: 100, max: 100 },
    wounds: { value: 20, max: 20 },
    armor: { armorType: "P" },
    dr: { other: 13 },
    damageReductionComponents: { natural: 6, class: 3, armorMelee: 8, armorOther: 8, feat: 2 }
  });
  let retained;
  actor.rollSave = async (_key, options) => ((retained = options.hazardSave), { flags: {} });
  const hit = card("acid-armor-hit", { actorUuid: "Actor.Kevin", checkKind: "damage", effectiveTotal: 14 });
  await applyDamage(hit, { targetUuid: actor.uuid, damage: 14, kind: "lethal", type: "acid", armorPiercing: 4 });
  assert.equal(retained.reduction, 4, "5 on coverage hits clothing; natural DR 6 + independent 2 - AP 4 remain");
  assert.ok(posted.flatMap(m => m.rolls ?? []).some(r => r.formula === "1d6"));
  const save = card("acid-armor-save", {
    actorUuid: actor.uuid,
    checkKind: "save",
    checkId: "ref",
    rawTotal: 5,
    effectiveTotal: 5,
    resolved: true,
    successConfirmed: false,
    evasionContext: evasionSaveContext(actor.system, { reflexReducesDamage: true }),
    hazardSave: retained
  });
  await resolveHazardSave(actor, save);
  assert.equal(actor.system.vitality.value, 90);
});

test("acid armor removal and unknown protection are declared before dice", async () => {
  const { sufferTypedDamage } = await import("../module/apps/damage-types.mjs");
  const actor = character("Acid-removal", {});
  let saves = [];
  actor.rollSave = async (_key, options) => (saves.push(options.hazardSave), { flags: {} });
  for (const input of [
    { unarmoredReduction: undefined },
    { unarmoredReduction: "" },
    { unarmoredReduction: 10 },
    { halfActions: 0.5 },
    { removeArmor: true },
    { removeArmor: true, halfActions: 0 }
  ]) {
    reset();
    saves = [];
    await sufferTypedDamage(actor, {
      type: "acid",
      amount: 14,
      armor: "partial",
      reduction: 9,
      unarmoredReduction: 4,
      ...input
    });
    assert.equal(saves.length, 0);
    assert.equal(posted.length, 0, "invalid declarations cannot roll coverage or post a result");
  }
  reset();
  await sufferTypedDamage(actor, {
    type: "acid",
    amount: 14,
    armor: "partial",
    reduction: 9,
    unarmoredReduction: 4,
    removeArmor: true,
    halfActions: 1
  });
  assert.equal(saves[0].reduction, 4);
  assert.equal(posted.flatMap(m => m.rolls ?? []).length, 0, "removed armor needs no random coverage check");
});

test("typed resistance prevents primary damage and accompanying effects for agents and both NPC health models", async () => {
  for (const role of ["agent", "special", "standard"])
    for (const type of ["acid", "explosive", "vacuum", "collision", "laser", "fire", "bang", "flash"]) {
      reset();
      const codes = {
        acid: "AD",
        explosive: "EX",
        vacuum: "VC",
        collision: "collision",
        laser: "LA",
        fire: "FR",
        bang: "BN",
        flash: "FL"
      };
      const actor = character(`Resistance-${role}-${type}`, {
        npcType: role,
        damageSave: 30,
        vitality: { value: 100, max: role === "standard" ? 0 : 100 },
        wounds: { value: 20, max: 20 },
        survivalStats: { resistances: { [codes[type]]: 8 }, resistanceSources: [] }
      });
      actor.type = role === "agent" ? "agent" : "npc";
      const pending = [];
      actor.rollSave = async (key, options) => (
        pending.push({ key, save: structuredClone(options.hazardSave) }),
        { flags: {} }
      );
      const hit = card(`resistance-hit-${role}-${type}`, {
        actorUuid: "Actor.Kevin",
        checkKind: "damage",
        effectiveTotal: 6
      });
      await applyDamage(hit, { targetUuid: actor.uuid, damage: 6, kind: "lethal", type });
      if (["acid", "explosive", "vacuum"].includes(type) && pending.length) {
        const first = pending.shift();
        assert.ok(first);
        const result = card(`resistance-save-${role}-${type}`, {
          actorUuid: actor.uuid,
          checkKind: "save",
          checkId: first.key,
          rawTotal: 1,
          effectiveTotal: 1,
          resolved: true,
          successConfirmed: false,
          evasionContext: evasionSaveContext(actor.system, { reflexReducesDamage: true }),
          hazardSave: first.save
        });
        await resolveHazardSave(actor, result);
      }
      assert.equal(pending.length, 0, `${role} ${type}: resistance prevents the accompanying save`);
      assert.equal(actor.system.vitality.value, 100);
      assert.equal(actor.system.wounds.value, 20);
      assert.equal(actor.system.damageTrack, undefined);
      assert.equal(actor.system.hazards?.acid ?? null, null);
      assert.equal(actor.system.hazards?.exposure ?? null, null);
      assert.equal(posted.flatMap(m => m.rolls ?? []).length, 0, "no secondary dice after resistance stops the damage");
    }
});

test("pending acid and explosive damage retain resistance from the original hit after current gear changes", async () => {
  for (const role of ["agent", "special", "standard"])
    for (const type of ["acid", "explosive"]) {
      reset();
      const code = type === "acid" ? "AD" : "EX";
      const actor = character(`Frozen-resistance-${role}-${type}`, {
        stressThreshold: 10,
        subdualThreshold: 10,
        npcType: role,
        damageSave: 30,
        dr: { other: 3 },
        vitality: { value: 100, max: role === "standard" ? 0 : 100 },
        wounds: { value: 20, max: 20 },
        survivalStats: { resistances: { [code]: 8 }, resistanceSources: [] }
      });
      actor.type = role === "agent" ? "agent" : "npc";
      const pending = [];
      actor.rollSave = async (key, options) => (
        pending.push({ key, save: structuredClone(options.hazardSave) }),
        { flags: {} }
      );
      const hit = card(`frozen-resistance-hit-${role}-${type}`, {
        actorUuid: "Actor.Kevin",
        checkKind: "damage",
        effectiveTotal: 14
      });
      await applyDamage(hit, { targetUuid: actor.uuid, damage: 14, kind: "lethal", type, armorPiercing: 0 });
      if (type === "acid")
        assert.equal(
          JSON.parse(Object.values(actor.flags.spycraft2.damageApplications)[0].signature)[10],
          1,
          "an explicit legacy AP 0 is normalized before the damage receipt"
        );
      const first = pending.shift();
      actor.system.survivalStats.resistances[code] = 0;
      const result = card(`frozen-resistance-save-${role}-${type}`, {
        actorUuid: actor.uuid,
        checkKind: "save",
        checkId: first.key,
        rawTotal: 1,
        effectiveTotal: 1,
        resolved: true,
        successConfirmed: false,
        evasionContext: evasionSaveContext(actor.system, { reflexReducesDamage: true }),
        hazardSave: first.save
      });
      await resolveHazardSave(actor, result);
      const net = type === "acid" ? 4 : 3; // Acid AP 1 leaves DR 2; the original resistance remains 8.
      if (role === "standard")
        assert.equal(posted.find(m => m.flags?.spycraft2?.npcDamageSave)?.flags.spycraft2.npcDamageSave.damage, net);
      else
        assert.equal(
          actor.system.vitality.value,
          100 - net,
          "apply type-specific AP before DR and the original resistance"
        );
      if (type === "acid") assert.equal(actor.system.hazards.acid.suffered, net);
    }
});

test("typed lethal DR-stopped hits bruise across all health models, with explosive stress kept separate", async () => {
  const { sufferTypedDamage } = await import("../module/apps/damage-types.mjs");
  const { exposeToFire } = await import("../module/apps/hazards.mjs");
  const oldTime = game.time;
  game.time = { worldTime: 0 };
  try {
    for (const role of ["agent", "standard", "special"])
      for (const type of ["acid", "collision", "explosive", "fire", "laser"]) {
        reset();
        const actor = character(`Typed-bruise-${role}-${type}`, {
          npcType: role,
          damageSave: 30,
          level: 1,
          vitality: { value: 100, max: role === "standard" ? 0 : 100 },
          wounds: { value: 20, max: 20 },
          dr: { melee: 20, other: 20 },
          armorDRByAttack: { unarmed: 20, meleeWeapon: 20, hurledWeapon: 20, rangedWeapon: 20, other: 20 },
          damageReductionComponents: { natural: 20, class: 0, armorMelee: 0, armorOther: 0, feat: 0 },
          stressThreshold: 100,
          subdualThreshold: 100,
          abilities: { con: { value: 20 } },
          accumulatedDamage: { version: 1, revision: 1, stress: 0, subdual: 0, pending: [] }
        });
        if (role !== "agent") actor.type = "npc";
        const saves = [];
        actor.rollSave = async (key, options) => (saves.push(options.hazardSave), { flags: {} });
        if (type === "fire") await exposeToFire(actor, { damage: 12, reduction: 20 });
        else {
          await sufferTypedDamage(actor, { type, amount: 12, reduction: 20 });
          if (["acid", "explosive"].includes(type)) {
            const save = saves.shift();
            await hazardSaveResolvers.get(save.kind)(actor, {}, save, false, {
              checkKind: "save",
              checkId: "ref",
              successConfirmed: false,
              effectiveTotal: 0,
              evasionContext: evasionSaveContext(actor.system, { reflexReducesDamage: true })
            });
          }
        }
        assert.equal(actor.system.vitality.value, 100, `${role} ${type}: no lethal loss`);
        assert.equal(actor.system.hazards?.acid ?? null, null, "DR-stopped acid adds no lingering exposure");
        if (role === "agent") {
          assert.equal(actor.system.accumulatedDamage.subdual, 1, type);
          assert.equal(actor.system.accumulatedDamage.stress, type === "explosive" ? 5 : 0, type);
        } else if (role === "special") {
          assert.equal(actor.flags.spycraft2.nonLethal.subdual, 1, type);
          assert.equal(actor.flags.spycraft2.nonLethal.stress ?? 0, type === "explosive" ? 5 : 0, type);
        } else {
          const reports = posted
            .filter(m => m.flags?.spycraft2?.npcDamageSave)
            .map(m => m.flags.spycraft2.npcDamageSave);
          assert.deepEqual(
            reports.map(r => [r.kind, r.damage]),
            type === "explosive"
              ? [
                  ["subdual", 1],
                  ["stress", 5]
                ]
              : [["subdual", 1]],
            type
          );
        }
        assert.equal(saves.length, type === "explosive" ? 1 : 0, "only the explosive follow-up remains");
      }
  } finally {
    game.time = oldTime;
  }
});

test("typed bruising resistance prevents replacement dice, while a penetrating critical bruise requires GC review", async () => {
  const { sufferTypedDamage } = await import("../module/apps/damage-types.mjs");
  for (const resistance of [0, 1]) {
    reset();
    const actor = character(`Critical-bruise-${resistance}`, {
      npcType: "special",
      vitality: { value: 100, max: 100 },
      wounds: { value: 20, max: 20 },
      survivalStats: { resistances: { subdual: resistance }, resistanceSources: [] }
    });
    actor.type = "npc";
    const result = await sufferTypedDamage(actor, {
      type: "collision",
      amount: 2,
      reduction: 8,
      hitContext: { critical: true, criticalDice: 2 }
    });
    assert.equal(Boolean(result), resistance === 1);
    if (!resistance) assert.ok(warnings.some(w => /critical hit's bruising/.test(w)));
    assert.equal(actor.system.vitality.value, 100);
    assert.equal(actor.flags.spycraft2?.nonLethal, undefined);
    assert.equal(posted.flatMap(m => m.rolls ?? []).length, 0);
  }
});

test("pending typed bruising refuses changed or unknown original resistance before effects", async () => {
  reset();
  const { sufferTypedDamage } = await import("../module/apps/damage-types.mjs");
  const actor = character("Changed-bruise", {
    npcType: "special",
    vitality: { value: 100, max: 100 },
    wounds: { value: 20, max: 20 }
  });
  actor.type = "npc";
  let save;
  actor.rollSave = async (key, options) => ((save = options.hazardSave), { flags: {} });
  await sufferTypedDamage(actor, { type: "acid", amount: 12, reduction: 20 });
  actor.system.survivalStats.resistances.subdual = 2;
  const check = {
    checkKind: "save",
    checkId: "ref",
    successConfirmed: false,
    effectiveTotal: 0,
    evasionContext: evasionSaveContext(actor.system, { reflexReducesDamage: true })
  };
  await assert.rejects(hazardSaveResolvers.get("acid")(actor, {}, save, false, check), /Bruising resistance changed/);
  delete save.bruiseResistanceSource;
  await assert.rejects(
    hazardSaveResolvers.get("acid")(actor, {}, save, false, check),
    /original damage and prepared resistance/
  );
  assert.equal(actor.system.vitality.value, 100);
  assert.equal(actor.flags.spycraft2?.nonLethal, undefined);
});

test("fire conversion is refused before reserving an application or changing health", async () => {
  reset();
  const actor = character("Fire-conversion", { vitality: { value: 100, max: 100 } });
  const message = card("fire-conversion", { checkKind: "damage", effectiveTotal: 20 });
  assert.equal(
    await applyDamage(message, { targetUuid: actor.uuid, damage: 20, type: "fire", kind: "subdual" }),
    false
  );
  assert.equal(actor.system.vitality.value, 100);
  assert.equal(message.flags.spycraft2.damageApplicationStarted, undefined);
  assert.ok(warnings.some(w => /Fire damage must remain lethal/.test(w)));
});

test("initial fire damage remains owed for scarring even after a successful catch-fire save", async () => {
  reset();
  const { exposeToFire, rollFireSave } = await import("../module/apps/hazards.mjs");
  const actor = character("Initial-fire", {
    npcType: "special",
    vitality: { value: 500, max: 500 },
    wounds: { value: 30, max: 30 },
    stressThreshold: 1000,
    survivalStats: { resistances: { FR: 5 }, resistanceSources: [] }
  });
  actor.type = "npc";
  const saves = [];
  actor.rollSave = async (key, options) => {
    const save = options.hazardSave;
    if (save.kind === "scar")
      assert.equal(actor.system.hazards.fireSources.room.scarRoll.state, "started", "intent saved before dice");
    const message = card(`initial-fire-${saves.length}`, {
      actorUuid: actor.uuid,
      checkKind: "save",
      checkId: key,
      hazardSave: save,
      effectiveTotal: save.dc + 1,
      successConfirmed: true,
      resolved: true
    });
    saves.push(message);
    game.messages.push(message);
    return message;
  };
  await exposeToFire(actor, { damage: 30, reduction: 0, sourceId: "room", sourceLabel: "Room fire" });
  await resolveHazardSave(actor, saves[0]);
  assert.equal(actor.system.hazards.fire, null);
  assert.equal(actor.system.hazards.fireSources.room.suffered, 25);
  const scar = await rollFireSave(actor, "scar", "room");
  assert.equal(scar.flags.spycraft2.hazardSave.dc, 15);
  assert.equal(await rollFireSave(actor, "scar", "room"), scar);
  assert.equal(saves.length, 2, "repeat scarring clicks reuse the original card");
  await resolveHazardSave(actor, scar);
  assert.equal(actor.system.hazards.fireSources.room.scarChecked, true);
  await resolveHazardSave(actor, scar);
  assert.equal(saves.length, 2);
});

test("catching fire preserves its initial damage and later ticks without merging separate fires", async () => {
  reset();
  const { exposeToFire, burningRound, extinguish } = await import("../module/apps/hazards.mjs");
  const actor = character("Cumulative-fire", {
    npcType: "special",
    vitality: { value: 500, max: 500 },
    wounds: { value: 30, max: 30 },
    stressThreshold: 1000
  });
  actor.type = "npc";
  let save;
  actor.rollSave = async (key, options) =>
    (save = card("cumulative-ref", {
      actorUuid: actor.uuid,
      checkKind: "save",
      checkId: key,
      hazardSave: options.hazardSave,
      effectiveTotal: 0,
      successConfirmed: false,
      resolved: true
    }));
  await exposeToFire(actor, { damage: 12, reduction: 0, sourceId: "room", sourceLabel: "Room" });
  await resolveHazardSave(actor, save);
  assert.equal(actor.system.hazards.fire.suffered, 12);
  await burningRound(actor, { reduction: 2 });
  await burningRound(actor, { reduction: 2 });
  assert.equal(actor.system.hazards.fire.suffered, 32);
  assert.equal(actor.system.hazards.fireSources.room.suffered, 32);
  await exposeToFire(actor, { damage: 8, reduction: 0, save: false, sourceId: "other", sourceLabel: "Other" });
  assert.equal(actor.system.hazards.fireSources.room.suffered, 32);
  assert.equal(actor.system.hazards.fireSources.other.suffered, 8);
  assert.equal(actor.system.hazards.fire.suffered, 32);
  await extinguish(actor);
  assert.equal(actor.system.hazards.fire, null);
  assert.equal(actor.system.hazards.fireSources.room.suffered, 32);
});

test("scarring claims retain posted rolls after lost responses and block uncertain replacement dice", async () => {
  const { rollFireSourceSave } = await import("../module/apps/fire-sources.mjs");
  for (const postedFirst of [true, false]) {
    reset();
    const actor = character(`Lost-scar-${postedFirst}`, {
      hazards: {
        fireSources: { fire: { label: "Fire", suffered: 25, scarChecked: false, needsReview: false, startedAt: 0 } }
      }
    });
    let rolls = 0,
      original;
    actor.rollSave = async (key, options) => {
      rolls++;
      if (postedFirst) {
        original = card(`scar-${postedFirst}`, {
          actorUuid: actor.uuid,
          checkKind: "save",
          checkId: key,
          hazardSave: options.hazardSave
        });
        game.messages.push(original);
      }
      throw Error("Connection lost after dice");
    };
    if (postedFirst) {
      assert.equal(await rollFireSourceSave(actor, "fire"), original);
      assert.equal(await rollFireSourceSave(actor, "fire"), original);
    } else {
      await assert.rejects(rollFireSourceSave(actor, "fire"), /Connection lost/);
      await assert.rejects(rollFireSourceSave(actor, "fire"), /needs GC review/);
    }
    assert.equal(rolls, 1);
  }
});

test("a cancelled scarring dialog releases its unused claim, while concurrent clicks cannot roll twice", async () => {
  const { rollFireSourceSave } = await import("../module/apps/fire-sources.mjs");
  const actor = character("Concurrent-scar", {
    hazards: {
      fireSources: { fire: { label: "Fire", suffered: 25, scarChecked: false, needsReview: false, startedAt: 0 } }
    }
  });
  actor.rollSave = async () => null;
  assert.equal(await rollFireSourceSave(actor, "fire"), null);
  assert.equal(actor.system.hazards.fireSources.fire.scarRoll, undefined);
  let resolve, started;
  const ready = new Promise(r => (started = r));
  actor.rollSave = async (key, options) => {
    started();
    await new Promise(r => (resolve = r));
    return card("concurrent-scar-original", {
      actorUuid: actor.uuid,
      checkKind: "save",
      checkId: key,
      hazardSave: options.hazardSave
    });
  };
  const first = rollFireSourceSave(actor, "fire");
  await ready;
  await assert.rejects(rollFireSourceSave(actor, "fire"), /needs GC review/);
  resolve();
  assert.ok(await first);
});

test("a fire review cannot overwrite damage that changed while its dialog was open", async () => {
  const { reviewFireSource } = await import("../module/apps/fire-sources.mjs");
  const oldInput = foundry.applications.api.DialogV2.input,
    oldUser = game.user,
    oldTime = game.time;
  game.user = { id: "gc", isGM: true };
  game.time = { worldTime: 0 };
  const actor = character("Stale-fire-review", {
    hazards: { fireSources: { fire: { label: "Fire", suffered: 25, scarChecked: false, needsReview: false } } }
  });
  let finish, opened;
  const ready = new Promise(r => (opened = r));
  foundry.applications.api.DialogV2.input = async () => {
    opened();
    return new Promise(r => (finish = r));
  };
  try {
    const review = reviewFireSource(actor, "fire");
    await ready;
    actor.system.hazards.fireSources.fire.suffered = 30;
    finish({ label: "Fire", suffered: "25", scarChecked: false, note: "Verified the earlier total" });
    await assert.rejects(review, /changed while this review was open/);
    assert.equal(actor.system.hazards.fireSources.fire.suffered, 30);
  } finally {
    foundry.applications.api.DialogV2.input = oldInput;
    game.user = oldUser;
    game.time = oldTime;
  }
});

test("invalid fire source evidence is refused before even DR-stopped bruising", async () => {
  const { exposeToFire } = await import("../module/apps/hazards.mjs");
  const actor = character("Invalid-fire-evidence", { npcType: "special", vitality: { value: 100, max: 100 } });
  actor.type = "npc";
  await assert.rejects(
    exposeToFire(actor, { damage: 2, reduction: 5, sourceId: "__proto__", sourceLabel: "Invalid" }),
    /Choose a named fire/
  );
  assert.equal(actor.system.vitality.value, 100);
  assert.equal(actor.flags.spycraft2?.nonLethal, undefined);
});

test("a delayed catch-fire save cannot recreate a removed source", async () => {
  const { exposeToFire } = await import("../module/apps/hazards.mjs");
  const actor = character("Removed-fire-source", {
    npcType: "special",
    vitality: { value: 100, max: 100 },
    wounds: { value: 20, max: 20 },
    stressThreshold: 1000
  });
  actor.type = "npc";
  let save;
  actor.rollSave = async (key, options) =>
    (save = card("removed-fire-ref", {
      actorUuid: actor.uuid,
      checkKind: "save",
      checkId: key,
      hazardSave: options.hazardSave,
      effectiveTotal: 0,
      successConfirmed: false,
      resolved: true
    }));
  await exposeToFire(actor, { damage: 12, reduction: 0, sourceId: "removed", sourceLabel: "Removed fire" });
  delete actor.system.hazards.fireSources.removed;
  await assert.rejects(resolveHazardSave(actor, save), /Review this fire's name/);
  assert.equal(actor.system.hazards.fire, null);
});

test("ongoing acid and fire use current resistance and count only damage that gets through", async () => {
  reset();
  const { acidStep, sufferTypedDamage } = await import("../module/apps/damage-types.mjs");
  const { burningRound } = await import("../module/apps/hazards.mjs");
  const actor = character("Ongoing-resistance", {
    npcType: "special",
    vitality: { value: 100, max: 100 },
    wounds: { value: 20, max: 20 },
    stressThreshold: 10,
    subdualThreshold: 10,
    survivalStats: { resistances: { AD: 4, FR: 4 }, resistanceSources: [] },
    hazards: halveAcidSource(
      acidAttackPlan(
        {},
        {
          id: "existing",
          label: "Original acid attack",
          damage: 14,
          suffered: 10,
          at: 0,
          protection: {
            ap: 1,
            reduction: 0,
            unarmoredReduction: 0,
            armorHit: false,
            armorPresent: false,
            armorSaveVerified: false
          }
        }
      ).hazards,
      "existing",
      "end"
    ).hazards
  });
  actor.type = "npc";
  await acidStep(actor, "round", "existing", { confirmed: true, reduction: 0, unarmoredReduction: 0 });
  assert.equal(actor.system.vitality.value, 97);
  assert.equal(actor.system.hazards.acid.suffered, 13);
  actor.system.survivalStats.resistances.AD = 8;
  await sufferTypedDamage(actor, { type: "acid", amount: 6, armor: "none" });
  assert.equal(actor.system.hazards.acid.damage, 7, "a separate fully resisted hit leaves earlier acid alone");
  await acidStep(actor, "end", "existing");
  await acidStep(actor, "round", "existing", { confirmed: true, reduction: 0, unarmoredReduction: 0 });
  assert.equal(actor.system.hazards.acid, null);
  actor.system.hazards.fire = { damage: 7, ap: 0, suffered: 10, scarChecked: false, startedAt: 0 };
  await burningRound(actor, { reduction: 0 });
  assert.equal(actor.system.vitality.value, 94);
  assert.equal(actor.system.hazards.fire.suffered, 13);
  actor.system.survivalStats.resistances.FR = 8;
  await burningRound(actor, { reduction: 0 });
  assert.equal(actor.system.hazards.fire, null);
  assert.equal(actor.system.vitality.value, 94);
});

test("NPC stress and subdual resistance reaches ordinary hits without dice or totals for fully resisted damage", async () => {
  for (const role of ["standard", "special"])
    for (const kind of ["stress", "subdual"]) {
      reset();
      const actor = character(`Generic-resistance-${role}-${kind}`, {
        npcType: role,
        damageSave: 30,
        stressThreshold: 10,
        subdualThreshold: 10,
        vitality: { value: 100, max: role === "standard" ? 0 : 100 },
        wounds: { value: 20, max: 20 },
        survivalStats: { resistances: { [kind]: 8 }, resistanceSources: [] }
      });
      actor.type = "npc";
      const hit = card(`generic-resistance-${role}-${kind}`, {
        actorUuid: "Actor.Kevin",
        checkKind: "damage",
        effectiveTotal: 6
      });
      await applyDamage(hit, { targetUuid: actor.uuid, damage: 6, kind });
      assert.equal(actor.system.damageTrack, undefined);
      assert.equal(actor.flags.spycraft2?.nonLethal?.[kind] ?? 0, 0);
      assert.equal(posted.flatMap(m => m.rolls ?? []).length, 0);
      assert.equal(actor.system.vitality.value, 100);
    }
});

function acidRoundCharacter(name, { damage = 8, suffered = 8, ready = true } = {}) {
  let hazards = acidAttackPlan(
    {},
    {
      id: "attack",
      label: name,
      damage,
      suffered,
      at: 0,
      protection: {
        ap: 1,
        reduction: 2,
        unarmoredReduction: 2,
        armorHit: false,
        armorPresent: false,
        armorSaveVerified: false
      }
    }
  ).hazards;
  if (ready) hazards = halveAcidSource(hazards, "attack", "end").hazards;
  const actor = character(name, {
    npcType: "special",
    dr: { other: 3 },
    vitality: { value: 50, max: 50 },
    wounds: { value: 20, max: 20 },
    stressThreshold: 10,
    subdualThreshold: 10,
    actionDice: { value: 2 },
    hazards
  });
  actor.type = "npc";
  return actor;
}

test("acid round Undo restores its damage and source without refunding an unrelated action-die spend", async () => {
  const { acidStep } = await import("../module/apps/damage-types.mjs"),
    { applyUndo } = await import("../module/apps/undo.mjs");
  const actor = acidRoundCharacter("Acid-round-Undo"),
    update = actor.update;
  let spent = false;
  actor.update = async function (change) {
    if (!spent && Object.hasOwn(change, "system.vitality.value")) {
      spent = true;
      this.system.actionDice.value = 1;
      this.flags.spycraft2 ??= {};
      this.flags.spycraft2.abilityUse = "unrelated";
    }
    return update.call(this, change);
  };
  await acidStep(actor, "round", "attack", { confirmed: true, reduction: 2, unarmoredReduction: 2 });
  assert.equal(actor.system.vitality.value, 48);
  assert.equal(actor.system.hazards.acidSources.attack.suffered, 10);
  const raw = undoNotes.at(-1),
    note = document({ ...raw, uuid: "ChatMessage.acid-round-undo", isOwner: true });
  await applyUndo(note);
  assert.equal(actor.system.vitality.value, 50);
  assert.equal(actor.system.hazards.acidSources.attack.suffered, 8);
  assert.equal(actor.system.hazards.acidSources.attack.phase, "round");
  assert.equal(actor.system.actionDice.value, 1);
  assert.equal(actor.flags.spycraft2.abilityUse, "unrelated");
});

test("an interrupted acid round blocks other hits and requires a verified GC correction before retrying", async () => {
  const { acidStep } = await import("../module/apps/damage-types.mjs"),
    { reviewAcidSource } = await import("../module/apps/acid-sources.mjs");
  const actor = acidRoundCharacter("Interrupted-acid-round"),
    update = actor.update;
  actor.update = async function (change) {
    if (Object.hasOwn(change, "system.vitality.value")) throw Error("Injected acid health delivery failure");
    return update.call(this, change);
  };
  await assert.rejects(
    acidStep(actor, "round", "attack", { confirmed: true, reduction: 2, unarmoredReduction: 2 }),
    /delivery failure/
  );
  actor.update = update;
  assert.equal(actor.system.hazards.acidSources.attack.roundAttempt.state, "applying");
  assert.equal(actor.system.vitality.value, 50);
  const incoming = card("hit-during-acid-review", { actorUuid: "Actor.Kevin", checkKind: "damage", effectiveTotal: 6 });
  await assert.rejects(
    applyDamage(incoming, { targetUuid: actor.uuid, damage: 6, kind: "lethal" }),
    /interrupted acid round/
  );
  const oldInput = foundry.applications.api.DialogV2.input;
  try {
    foundry.applications.api.DialogV2.input = async () => ({
      label: actor.name,
      damage: 4,
      suffered: 8,
      phase: "round",
      injuryChecked: false,
      ap: 1,
      reduction: 2,
      unarmoredReduction: 2,
      armorHit: false,
      armorPresent: false,
      armorSaveVerified: false,
      note: "Confirmed the original round delivered no health changes"
    });
    await reviewAcidSource(actor, "attack");
    assert.equal(actor.system.hazards.acidSources.attack.roundAttempt.state, "reviewed");
  } finally {
    foundry.applications.api.DialogV2.input = oldInput;
  }
  await acidStep(actor, "round", "attack", { confirmed: true, reduction: 2, unarmoredReduction: 2 });
  assert.equal(actor.system.vitality.value, 48);
});

test("the actual acid injury workflow rolls once after washing and binds its outcome to that attack", async () => {
  const { acidStep } = await import("../module/apps/damage-types.mjs"),
    { rollAcidSourceInjury } = await import("../module/apps/acid-sources.mjs");
  const actor = acidRoundCharacter("Washed-acid-injury", { damage: 30, suffered: 25, ready: false });
  while (actor.system.hazards.acidSources.attack.damage) await acidStep(actor, "wash", "attack");
  let rolls = 0;
  actor.rollSave = async (key, options) => {
    rolls++;
    return card("original-acid-injury", {
      actorUuid: actor.uuid,
      checkKind: "save",
      checkId: key,
      effectiveTotal: 20,
      rawTotal: 20,
      resolved: true,
      successConfirmed: true,
      hazardSave: options.hazardSave
    });
  };
  const original = await rollAcidSourceInjury(actor, "attack");
  assert.equal(await rollAcidSourceInjury(actor, "attack"), original);
  assert.equal(rolls, 1);
  await resolveHazardSave(actor, original);
  assert.equal(actor.system.hazards.acid, null);
  assert.equal(actor.system.hazards.acidSources.attack.injuryChecked, true);
  await assert.rejects(rollAcidSourceInjury(actor, "attack"), /actual acid total/);
  assert.equal(rolls, 1);
});

test("a lost acid injury response reuses its posted card and never rolls a replacement", async () => {
  const { rollAcidSourceInjury } = await import("../module/apps/acid-sources.mjs");
  const actor = acidRoundCharacter("Lost-acid-injury-response", { damage: 30, suffered: 25, ready: false }),
    oldMessages = game.messages;
  game.messages = [];
  let rolls = 0;
  try {
    actor.rollSave = async (key, options) => {
      rolls++;
      const message = card("posted-acid-injury", {
        actorUuid: actor.uuid,
        checkKind: "save",
        checkId: key,
        hazardSave: options.hazardSave
      });
      game.messages.push(message);
      throw Error("Posted injury response lost");
    };
    const message = await rollAcidSourceInjury(actor, "attack");
    assert.equal(message.uuid, "ChatMessage.posted-acid-injury");
    assert.equal(await rollAcidSourceInjury(actor, "attack"), message);
    assert.equal(rolls, 1);
  } finally {
    game.messages = oldMessages;
  }
});

test("only a proven pre-roll acid cancellation releases its injury claim; uncertain dice require GC review", async () => {
  const { rollAcidSourceInjury } = await import("../module/apps/acid-sources.mjs");
  const actor = acidRoundCharacter("Cancelled-acid-injury", { damage: 30, suffered: 25, ready: false });
  actor.rollSave = async () => null;
  assert.equal(await rollAcidSourceInjury(actor, "attack"), null);
  assert.equal(actor.system.hazards.acidSources.attack.injuryRoll, undefined);
  let calls = 0;
  actor.rollSave = async () => {
    calls++;
    throw Error("Unknown original dice result");
  };
  await assert.rejects(rollAcidSourceInjury(actor, "attack"), /Unknown original/);
  assert.equal(actor.system.hazards.acidSources.attack.injuryRoll.state, "needsReview");
  await assert.rejects(rollAcidSourceInjury(actor, "attack"), /original dice/);
  assert.equal(calls, 1);
});

test("a stale GC acid review cannot overwrite a changed attack", async () => {
  const { reviewAcidSource } = await import("../module/apps/acid-sources.mjs");
  const actor = acidRoundCharacter("Stale-acid-review"),
    oldInput = foundry.applications.api.DialogV2.input;
  try {
    foundry.applications.api.DialogV2.input = async () => {
      actor.system.hazards.acidSources.attack.suffered = 9;
      return {
        label: actor.name,
        damage: 4,
        suffered: 8,
        phase: "round",
        injuryChecked: false,
        ap: 1,
        reduction: 2,
        unarmoredReduction: 2,
        note: "Stale original form"
      };
    };
    await assert.rejects(reviewAcidSource(actor, "attack"), /attack changed/);
    assert.equal(actor.system.hazards.acidSources.attack.suffered, 9);
    assert.equal(actor.system.vitality.value, 50);
  } finally {
    foundry.applications.api.DialogV2.input = oldInput;
  }
});

test("a changed DR source invalidates the prepared acid round before health or its intent changes", async () => {
  const { acidStep } = await import("../module/apps/damage-types.mjs"),
    actor = acidRoundCharacter("Changed-acid-protection"),
    oldInput = foundry.applications.api.DialogV2.input;
  try {
    foundry.applications.api.DialogV2.input = async () => {
      actor.system.dr.other = 4;
      return { confirmed: true, reduction: 2, unarmoredReduction: 2 };
    };
    await assert.rejects(acidStep(actor, "round", "attack"), /protection changed/);
    assert.equal(actor.system.vitality.value, 50);
    assert.equal(actor.system.hazards.acidSources.attack.roundAttempt, undefined);
  } finally {
    foundry.applications.api.DialogV2.input = oldInput;
  }
});

test("an acid round retains resistance from its own intent if the current protection changes during delivery", async () => {
  const { acidStep } = await import("../module/apps/damage-types.mjs"),
    { checkRecord } = await import("../module/rules/record-check.mjs"),
    { RECORD_SHAPES } = await import("../module/data/record-shapes.mjs");
  const actor = acidRoundCharacter("Retained-round-resistance"),
    update = actor.update;
  actor.system.survivalStats.resistances.AD = 1;
  const original = damageResistanceSource(actor.system, "acid");
  actor.update = async function (change) {
    const result = await update.call(this, change);
    if (change["system.==hazards"]?.acidSources?.attack?.roundAttempt?.state === "applying")
      this.system.survivalStats.resistances.AD = 0;
    return result;
  };
  await acidStep(actor, "round", "attack", { confirmed: true, reduction: 2, unarmoredReduction: 2 });
  assert.equal(actor.system.vitality.value, 49, "4 remaining acid - 2 DR - original resistance 1");
  assert.equal(actor.system.hazards.acidSources.attack.suffered, 9);
  assert.deepEqual(actor.system.hazards.acidSources.attack.roundAttempt.resistanceSource, original);
  assert.deepEqual(checkRecord(RECORD_SHAPES.hazards, actor.system.hazards), []);
});

test("NPC partial resistance follows DR for subdual and bypasses DR for stress", async () => {
  for (const role of ["standard", "special"])
    for (const kind of ["stress", "subdual"]) {
      reset();
      const actor = character(`Partial-resistance-${role}-${kind}`, {
        npcType: role,
        damageSave: 30,
        stressThreshold: 100,
        subdualThreshold: 100,
        dr: { other: 3 },
        vitality: { value: 100, max: role === "standard" ? 0 : 100 },
        wounds: { value: 20, max: 20 },
        survivalStats: { resistances: { [kind]: 4 }, resistanceSources: [] }
      });
      actor.type = "npc";
      const hit = card(`partial-resistance-${role}-${kind}`, {
        actorUuid: "Actor.Kevin",
        checkKind: "damage",
        effectiveTotal: 14
      });
      await applyDamage(hit, { targetUuid: actor.uuid, damage: 14, kind });
      const expected = kind === "subdual" ? 4 : 10;
      if (role === "standard")
        assert.equal(
          posted.find(m => m.flags?.spycraft2?.npcDamageSave)?.flags.spycraft2.npcDamageSave.damage,
          expected
        );
      else assert.equal(actor.flags.spycraft2.nonLethal[kind], expected);
    }
});

test("generic NPC subdual resistance prevents cold, heat and electrical exposure without a follow-up save", async () => {
  for (const role of ["standard", "special"])
    for (const type of ["cold", "heat", "electrical"]) {
      reset();
      const actor = character(`Subdual-resistance-${role}-${type}`, {
        npcType: role,
        damageSave: 30,
        stressThreshold: 10,
        subdualThreshold: 10,
        vitality: { value: 100, max: role === "standard" ? 0 : 100 },
        wounds: { value: 20, max: 20 },
        survivalStats: { resistances: { subdual: 8 }, resistanceSources: [] }
      });
      actor.type = "npc";
      actor.rollSave = async () => {
        throw Error("Fully resisted damage must not ask for a save");
      };
      const hit = card(`subdual-resistance-${role}-${type}`, {
        actorUuid: "Actor.Kevin",
        checkKind: "damage",
        effectiveTotal: 6
      });
      await applyDamage(hit, { targetUuid: actor.uuid, damage: 6, kind: "lethal", type });
      assert.equal(actor.system.hazards?.exposure ?? null, null);
      assert.equal(actor.system.damageTrack, undefined);
      assert.equal(posted.flatMap(m => m.rolls ?? []).length, 0);
    }
});

test("NPC type-specific cold, heat and electrical resistance combines with subdual resistance after AP/DR", async () => {
  for (const role of ["standard", "special"])
    for (const type of ["cold", "heat", "electrical"])
      for (const full of [true, false]) {
        reset();
        const code = { cold: "CD", heat: "HT", electrical: "EL" }[type];
        const actor = character(`Typed-resistance-${role}-${type}-${full}`, {
          npcType: role,
          damageSave: 30,
          stressThreshold: 100,
          subdualThreshold: 100,
          dr: { other: 3 },
          vitality: { value: 100, max: role === "standard" ? 0 : 100 },
          wounds: { value: 20, max: 20 },
          survivalStats: { resistances: { subdual: 2, [code]: full ? 8 : 4 }, resistanceSources: [] }
        });
        actor.type = "npc";
        const hit = card(`typed-subdual-${role}-${type}-${full}`, {
          actorUuid: "Actor.Kevin",
          checkKind: "damage",
          effectiveTotal: full ? 6 : 14
        });
        await applyDamage(hit, { targetUuid: actor.uuid, damage: full ? 6 : 14, kind: "lethal", type });
        const expected = full ? 0 : 8;
        if (role === "standard")
          assert.equal(
            posted.find(m => m.flags?.spycraft2?.npcDamageSave)?.flags.spycraft2.npcDamageSave.damage ?? 0,
            expected
          );
        else assert.equal(actor.flags.spycraft2?.nonLethal?.subdual ?? 0, expected);
        assert.equal(actor.system.hazards?.exposure?.suffered ?? 0, expected);
        if (full) assert.equal(posted.flatMap(m => m.rolls ?? []).length, 0);
      }
});

test("standard characters receive bruising when DR stops an ordinary hit, with resistance afterward", async () => {
  for (const kind of ["lethal", "subdual"])
    for (const resistance of [0, 1]) {
      reset();
      const actor = character(`Standard-bruise-${kind}-${resistance}`, {
        npcType: "standard",
        damageSave: 30,
        dr: { other: 4 },
        survivalStats: { resistances: { subdual: resistance }, resistanceSources: [] }
      });
      actor.type = "npc";
      const hit = card(`standard-bruise-${kind}-${resistance}`, {
        actorUuid: "Actor.Kevin",
        checkKind: "damage",
        effectiveTotal: 3
      });
      await applyDamage(hit, { targetUuid: actor.uuid, damage: 3, kind });
      const reports = posted.filter(m => m.flags?.spycraft2?.npcDamageSave);
      assert.equal(reports.length, resistance ? 0 : 1);
      if (!resistance)
        assert.deepEqual(
          [reports[0].flags.spycraft2.npcDamageSave.kind, reports[0].flags.spycraft2.npcDamageSave.damage],
          ["subdual", 1]
        );
    }
});

test("typed electrical subdual retains its original melee DR column and tracks only net exposure", async () => {
  for (const special of [false, true]) {
    reset();
    const actor = character(`Electrical-DR-${special}`, {
      npcType: special ? "special" : "standard",
      damageSave: 30,
      vitality: { value: 40, max: special ? 40 : 0 },
      abilities: { con: { value: 10 }, wis: { value: 10 } },
      dr: { melee: 20, other: 3 }
    });
    actor.type = "npc";
    const damage = card(`electrical-dr-${special}`, {
      actorUuid: "Actor.Kevin",
      checkKind: "damage",
      effectiveTotal: 14,
      weaponProficiency: "blunt"
    });
    await applyDamage(damage, {
      targetUuid: actor.uuid,
      damage: 14,
      kind: "lethal",
      type: "electrical",
      attackKind: "meleeWeapon"
    });
    assert.equal(special ? actor.flags.spycraft2.nonLethal.subdual : actor.system.damageTrack.last.damage, 2);
    assert.equal(actor.system.hazards.exposure.suffered, 2);
    assert.equal(actor.system.hazards.exposure.lastDamage, 2);
  }
});

test("typed damage rejects fractional inputs and zero vacuum impact never creates replacement damage dice", async () => {
  reset();
  const actor = character("Zero-vacuum", { npcType: "standard", damageSave: 30, vitality: { value: 0, max: 0 } });
  actor.type = "npc";
  let save;
  actor.rollSave = async (key, options) => ((save = options.hazardSave), { flags: {} });
  const { sufferTypedDamage } = await import("../module/apps/damage-types.mjs"),
    evaluate = Roll.prototype.evaluate;
  let dice = 0;
  Roll.prototype.evaluate = async function (...args) {
    dice++;
    return evaluate.apply(this, args);
  };
  try {
    for (const input of [{ amount: 1.5 }, { amount: 1, reduction: 0.5 }])
      assert.equal(await sufferTypedDamage(actor, { type: "vacuum", ...input }), false);
    await sufferTypedDamage(actor, { type: "vacuum", amount: 0 });
    assert.equal(save.damage, 0);
    assert.equal(dice, 0);
    assert.equal(actor.system.damageTrack, undefined);
  } finally {
    Roll.prototype.evaluate = evaluate;
  }
});

test("Animal Partner weapon and typed hits consume vitality instead of standard NPC Damage saves", async () => {
  for (const type of ["", "laser"]) {
    reset();
    const actor = character(`Partner-health-${type}`, {
      npcType: "animal",
      animalPartner: true,
      vitality: { value: 40, max: 40 },
      wounds: { value: 10, max: 10 },
      abilities: { con: { value: 10 }, wis: { value: 10 } }
    });
    actor.type = "npc";
    const damage = card(`partner-health-${type}`, {
      actorUuid: "Actor.Kevin",
      checkKind: "damage",
      effectiveTotal: 14
    });
    await applyDamage(damage, { targetUuid: actor.uuid, damage: 14, kind: "lethal", type });
    assert.equal(actor.system.vitality.value, 26);
    assert.equal(actor.system.wounds.value, 10);
    assert.equal(
      posted.some(m => m.flags?.spycraft2?.npcDamageSave),
      false
    );
    const { damageSaveState, npcDamageSave } = await import("../module/apps/gc/npc-play.mjs");
    assert.equal(damageSaveState(actor).applies, false);
    assert.equal(await npcDamageSave(actor, { damage: 14, kind: "lethal" }), false);
  }
});

test("grapple benefits the winner takes change conditions on both sides", async () => {
  reset();
  const kevin = character("Grappler", { activeFeatNames: [] });
  const foe = character("Foe", {});
  const remove = who => async () => who.statuses.clear();
  foe.deleteEmbeddedDocuments = remove(foe);
  await settleGrapple(kevin, {
    opening: true,
    total: 20,
    opponentTotal: 12,
    opponentUuid: foe.uuid,
    benefits: [],
    sizeDifference: 0,
    grappleContextConfirmed: true
  });
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

test("actual opening grapple settlement rejects oversized, missing, self or unconfirmed participants before writing conditions or chat", async () => {
  reset();
  const grappler = character("Small grappler", { size: "Small" });
  const foe = character("Large foe", { size: "Large (1×1)" });
  const input = {
    opening: true,
    total: 30,
    opponentTotal: 1,
    opponentUuid: foe.uuid,
    benefits: [],
    sizeDifference: 0,
    grappleContextConfirmed: true
  };
  for (const patch of [
    {},
    { opponentUuid: grappler.uuid },
    { opponentUuid: "Actor.deleted" },
    { grappleContextConfirmed: false }
  ]) {
    assert.equal(await settleGrapple(grappler, { ...input, ...patch }), false);
    assert.equal(foe.statuses.size, 0);
    assert.equal(grappler.statuses.size, 0);
    assert.equal(posted.length, 0);
  }
  grappler.system.size = "Medium";
  assert.equal((await settleGrapple(grappler, input)).winner, "actor");
  assert.equal(foe.statuses.has("held"), true);
});

test("actual opening crowd overflow and unearned benefits refuse before any grapple condition or report", async () => {
  reset();
  const grappler = character("Crowd grappler", { size: "Large" }),
    foe = character("Crowd target", { size: "Medium" }),
    input = {
      opening: true,
      total: 30,
      opponentTotal: 1,
      opponentUuid: foe.uuid,
      grappleContextConfirmed: true,
      benefits: [],
      otherGrapplers: 2
    };
  assert.equal(await settleGrapple(grappler, input), false);
  assert.equal(posted.length, 0);
  assert.equal(foe.statuses.size, 0);
  assert.equal(await settleGrapple(grappler, { ...input, otherGrapplers: 0, benefits: ["pin"] }), false);
  assert.equal(posted.length, 0);
  assert.equal(foe.statuses.size, 0);
  const result = await settleGrapple(grappler, { ...input, otherGrapplers: 1 });
  assert.equal(result.winner, "actor");
  assert.match(posted.at(-1).content, /2 grappler\(s\).*limit of 2/);
});

test("Throw's actual benefit report adds at least one extra damage even when Strength is negative", async () => {
  reset();
  const grappler = character("Thrower", { abilities: { str: { mod: -2 } } }),
    foe = character("Thrown", {});
  foe.statuses.add("held");
  foe.effects.push({
    id: "held-source",
    statuses: new Set(["held"]),
    toObject: () => ({ _id: "held-source", statuses: ["held"] })
  });
  foe.deleteEmbeddedDocuments = async () => {
    foe.statuses.delete("held");
    foe.effects.length = 0;
  };
  await settleGrapple(grappler, { total: 30, opponentTotal: 1, opponentUuid: foe.uuid, benefits: ["throw"] });
  assert.match(posted.at(-1).content, /standard unarmed damage \+ 1 additional/);
  assert.equal(foe.statuses.has("held"), false);
  assert.equal(foe.statuses.has("sprawled"), true);
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
      ["Cover, other target or Defense…", undefined]
    ]
  );
  // The short face leaves the target's name and the full wording to the tooltip.
  assert.deepEqual(
    resolve.map(c => c.hint),
    [
      "Resolve this attack against Guard, Defense 15: hit",
      "Resolve this attack with cover, against another target, or against a Defense you enter"
    ]
  );
  await resolve[0].run();
  assert.equal(attack.flags.spycraft2.attackResolution.hit, true);
  // One primary: rolling damage is the next step, resolving again is a quiet correction.
  const emphasis = () =>
    Object.fromEntries(
      controls(attack)
        .filter(c => c.id === "attackResolutionControl")
        .map(c => [c.label, c.emphasis])
    );
  const weapon = document({ uuid: "Item.Tonfa", name: "Tonfa", type: "weapon", system: {} });
  registry.set(weapon.uuid, weapon);
  attack.flags.spycraft2.weaponUuid = weapon.uuid;
  assert.equal(attack.flags.spycraft2.successConfirmed, true);
  assert.equal(emphasis()["Roll damage"], "primary");
  // The damage card names the hit's target: one click applies the rolled damage to it.
  const damage = card("q2", {
    actorUuid: attacker.uuid,
    checkKind: "damage",
    effectiveTotal: 7,
    sourceAttack: { uuid: attack.uuid, targetUuid: guard.uuid }
  });
  const { damageCardsFor } = await import("../module/apps/damage-application.mjs");
  assert.equal(damageCardsFor(attack, [damage]), 1);
  assert.equal(damageCardsFor(attack, []), 0);
  game.messages.push(damage);
  assert.equal(emphasis()["Roll damage"], undefined, "no longer primary once damage is rolled");
  game.messages.pop();
  delete attack.flags.spycraft2.weaponUuid;
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
  assert.deepEqual([guard.system.vitality.value, second.system.vitality.value], [13, 13]);
  assert.match(posted.at(-1).content, /Damage applied to Guard2/);
  assert.match(posted.at(-1).content, /Not applied to: Guard/);
  game.user.targets = [];
  // A target the damage cannot reach is named as not applied, never counted as done.
  const crate = document({ uuid: "Actor.Crate", name: "Crate", type: "loot", isOwner: true, system: {}, flags: {} });
  registry.set(crate.uuid, crate);
  const done = await applyDamageToEach(damage, [second, crate]);
  assert.deepEqual(done, []);
  assert.match(posted.at(-1).content, /Not applied to: Guard2.*Crate/);
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
    assert.equal(await resolveAttack(self, { targetUuid: attacker.uuid, defense: "" }), false);
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
  // Only Check Defense: an action-die boost is declared at the start of a round, not against one attack.
  assert.deepEqual(ids(attack), ["targetCheckDefense"]);
  const { notifyAttackTarget, incomingFacts } = await import("../module/apps/target-response.mjs");
  assert.match(notifyAttackTarget(attack, player), /Hostile is attacking Latch/);
  assert.equal(notifyAttackTarget(attack, { isGM: true }), null);
  // A blind or whispered attack the player cannot see is not announced to them.
  assert.equal(notifyAttackTarget({ ...attack, blind: true }, player), null);
  assert.equal(notifyAttackTarget({ ...attack, whisper: ["gm"] }, { ...player, id: "u1" }), null);
  assert.deepEqual(incomingFacts({ attackContext: { ranged: true, distanceFeet: 40 } }), {
    ranged: true,
    adjacent: false,
    distanceFeet: 40
  });
  assert.equal(incomingFacts({ attackContext: { distanceFeet: null } }).distanceFeet, null);
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
  // A Table of Ouch critical on that agent: its player rolls the injury from the same row, not the attacker's.
  damage.flags.spycraft2.damageAppliedBy = {
    ouch: { targetUuid: mine.uuid, name: "Latch", damage: 6, kind: "lethal", ouch: true, net: 6 }
  };
  assert.deepEqual(ids(damage), ["ouchInjury"]);
});
