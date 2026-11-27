import test from "node:test";
import assert from "node:assert/strict";

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
    system,
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
    await applyBlast(damage, { targets: [{ uuid: target.uuid, distanceFeet: 15 }], kind: "lethal", type: "" });
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
