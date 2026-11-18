import test from "node:test";
import assert from "node:assert/strict";
import { actor, opts } from "./fixtures/side-stance.mjs";
import { prep } from "./fixtures/feint.mjs";
import { COMBAT_STANCES, combatStanceDeclaration } from "../module/rules/combat-stance.mjs";
import { MELEE_ATTACK_TRICKS, validRecordedMeleeTrick } from "../module/rules/melee-tricks.mjs";
import { readiedMeleeFeatSource } from "../module/rules/readied-weapons.mjs";
import { swordBasicsPlan, impaleDamageBonus, unbeatableStancePlan } from "../module/rules/sword-basics.mjs";
import { meleeTrickContent } from "../module/apps/standard-attack-context.mjs";
import { combatStanceContent } from "../module/apps/combat-stance.mjs";
import { rollPipeline } from "../module/rules/roll-pipeline.mjs";
import { weaponDamage } from "../module/rules/gear.mjs";

const make = (feats = ["Sword Basics"], system = {}, stance = null) => {
    const a = actor(),
      w = a.items[0];
    Object.assign(w.system, {
      proficiency: "edged",
      meleeFamily: "oneHandedSword",
      sizeHands: "S/1h",
      useHands: 1,
      qualities: "",
      damage: "1d8",
      ...system
    });
    a.system.combatStance = stance ? { version: 1, id: "s1", key: stance } : null;
    a.system.activeFeatNames.push(...feats);
    a.system = prep(a.system, a.items);
    a.system.swordBasics = swordBasicsPlan(a.system, a.items); // the engine prepares this
    return a;
  },
  impale = () => ({ ...opts(), meleeTrick: "impale", meleeTrickOnlyConfirmed: true }),
  hit = async (extra = {}, feats) => {
    const a = make(feats),
      m = await a.rollAttack(a.items[0], { ...impale(), ...extra });
    Object.assign(m.flags.spycraft2, { resolved: true, successConfirmed: true });
    return { a, m };
  },
  damage = (a, m, extra = {}) =>
    a.rollDamage(a.items[0], {
      includeSneakAttack: false,
      attackDamageSourceUuid: m.uuid,
      targetActorUuid: "Actor.target",
      ...extra
    });

test("Sword Basics applies only while no wielded weapon has the finesse quality", () => {
  const item = (name, system) => ({
    id: name,
    name,
    type: "weapon",
    system: { equipped: true, carried: true, quantity: 1, sizeHands: "S/1h", ...system }
  });
  const sys = { activeFeatNames: ["Sword Basics"] };
  assert.deepEqual(swordBasicsPlan(sys, [item("Sabre", { qualities: "" })]), {
    version: 1,
    earned: true,
    active: true,
    finesseWeapons: []
  });
  const off = swordBasicsPlan(sys, [item("Sabre", { qualities: "" }), item("Rapier", { qualities: "FIN" })]);
  assert.equal(off.active, false);
  assert.deepEqual(off.finesseWeapons, ["Rapier"]);
  assert.equal(
    swordBasicsPlan(sys, [item("Rapier", { qualities: "FIN", equipped: false })]).active,
    true,
    "a stowed finesse weapon is not wielded"
  );
  assert.equal(swordBasicsPlan({ activeFeatNames: [] }, []).active, false);
  assert.equal(make().system.swordBasics.active, true);
  assert.equal(make(["Sword Basics"], { qualities: "FIN" }).system.swordBasics.active, false);
});

test("a non-finesse sword source is opt-in: Fencing's finesse rule for one-handed swords is unchanged", () => {
  const sword = finesse => ({
    id: "w" + finesse,
    name: "Sword",
    family: "oneHandedSword",
    proficiency: "edged",
    hands: 1,
    requiredHands: 1,
    finesse
  });
  const sys = weapons => ({ activeFeatNames: ["Sword Basics", "Fencing Basics"], readiedMeleeWeapons: weapons });
  const plain = readiedMeleeFeatSource(sys([sword(false), sword(true)]), {
    name: "Sword Basics",
    family: "oneHandedSword",
    bonus: 0,
    finesse: false
  });
  assert.deepEqual(
    plain.weapons.map(w => w.id),
    ["wfalse"]
  );
  assert.throws(() =>
    readiedMeleeFeatSource(sys([sword(false)]), { name: "Fencing Basics", family: "oneHandedSword", bonus: 2 })
  );
  assert.equal(
    readiedMeleeFeatSource(sys([sword(true)]), { name: "Fencing Basics", family: "oneHandedSword", bonus: 2 })
      .weapons[0].id,
    "wtrue"
  );
});

test("Impale is a Standard Attack trick with a plain one-handed sword and no fixed bonus", async () => {
  const d = MELEE_ATTACK_TRICKS.impale;
  assert.equal(d.feat, "Sword Basics");
  assert.equal(d.fullAction, false);
  assert.deepEqual([d.attackBonus, d.damageBonus, d.threatIncrease], [0, 0, 0]);
  assert.match(meleeTrickContent(make()), /Impale/);
  const a = make(),
    w = a.items[0],
    normal = a.weaponAttack(w, opts()),
    planned = a.weaponAttack(w, impale());
  assert.equal(planned.blocked, false);
  assert.equal(planned.total, normal.total);
  assert.equal(planned.threat, normal.threat);
  assert.match(planned.notes, /Impale: on a hit, \+1 damage for every 2 points/);
  const m = await a.rollAttack(w, impale()),
    c = m.flags.spycraft2;
  assert.equal(c.attackContext.meleeTrick.key, "impale");
  assert.ok(validRecordedMeleeTrick(c.attackContext.meleeTrick, c.attackContext));
});

test("Impale needs the earned and active feat and a held one-handed sword without finesse", () => {
  const blocked = a => a.weaponAttack(a.items[0], impale()).blocked;
  assert.ok(blocked(make([])));
  assert.ok(blocked(make(["Sword Basics"], { qualities: "FIN" })), "a finesse sword switches the feat off");
  assert.ok(blocked(make(["Sword Basics"], { meleeFamily: "twoHandedSword", sizeHands: "M/2h" })));
  assert.ok(blocked(make(["Sword Basics"], { equipped: false })));
  assert.ok(blocked(make(["Sword Basics"], {})) === false);
  assert.match(
    make(["Sword Basics"], { qualities: "FIN" }).weaponAttack(
      make(["Sword Basics"], { qualities: "FIN" }).items[0],
      impale()
    ).reason,
    /finesse quality/
  );
});

test("Impale damage adds 1 per 2 points by which the attack beat the confirmed Defense", () => {
  assert.equal(impaleDamageBonus(25, 15), 5);
  assert.equal(impaleDamageBonus(25, 16), 4);
  assert.equal(impaleDamageBonus(20, 20), 0);
  assert.throws(() => impaleDamageBonus(20, 21), /not a hit/);
  assert.throws(() => impaleDamageBonus(20, 1.5), /whole-number Defense/);
  assert.throws(() => impaleDamageBonus(20, -1), /whole-number Defense/);
  assert.throws(() => impaleDamageBonus(undefined, 10), /recorded attack result/);
});

test("rolling damage from an Impale hit needs the Defense, records it, and adds the bonus once", async () => {
  const { a, m } = await hit(),
    result = m.flags.spycraft2.effectiveTotal;
  await assert.rejects(damage(a, m), /Defense against the Impale attack/);
  await assert.rejects(damage(a, m, { impaleDefense: result + 1 }), /not a hit/);
  const d = await damage(a, m, { impaleDefense: result - 7 }),
    p = d.flags.spycraft2.attackDamageBenefit;
  assert.deepEqual(p.impale, { defense: result - 7, attackResult: result, bonus: 3 });
  assert.equal(p.bonus, 3);
  assert.equal(p.source, "Impale");
  assert.equal(d.flags.spycraft2.finesseDamage.bonus, weaponDamage(a.system, a.items[0].system).bonus + 3);
  await assert.rejects(damage(a, m, { impaleDefense: result - 7 }), /already has damage/);
});

test("the damage dialog asks for the Defense only when an Impale hit is offered, and reads a whole number", async () => {
  const { a, m } = await hit(),
    html = hits =>
      rollPipeline.dialog({
        dialog: "damage",
        actor: a,
        attackBonusHits: hits,
        automaticAttackBonus: null,
        sideHits: [],
        targetChoices: { actors: [], selected: "" },
        trickSneakHit: null
      });
  assert.match(html([{ message: m, proof: { targetUuid: "Actor.target", bonus: 0 } }]), /name="impaleDefense"/);
  assert.doesNotMatch(html([]), /name="impaleDefense"/);
  const read = v => rollPipeline.read({ dialog: "damage", actor: a, item: a.items[0] }, { impaleDefense: v });
  assert.equal(read("14").impaleDefense, 14);
  assert.equal(read(14).impaleDefense, 14);
  assert.equal(read("").impaleDefense, "");
});

test("Unbeatable Stance gives +1 morale against an opponent already damaged, only while the feat is active", () => {
  assert.deepEqual(COMBAT_STANCES.unbeatable, { name: "Unbeatable Stance", feat: "Sword Basics", page: 180 });
  assert.deepEqual(
    combatStanceDeclaration({ activeFeatNames: ["Sword Basics"], conditionContext: {} }, "unbeatable", {
      halfActionConfirmed: true,
      legalConfirmed: true
    }),
    { version: 1, key: "unbeatable" }
  );
  const a = make(["Sword Basics"], {}, "unbeatable"),
    w = a.items[0],
    base = a.weaponAttack(w, opts()).total,
    damaged = a.weaponAttack(w, { ...opts(), unbeatableTargetDamaged: true });
  assert.equal(damaged.total, base + 1);
  assert.match(damaged.notes, /Unbeatable Stance: \+1 morale/);
  const off = make(["Sword Basics"], { qualities: "FIN" }, "unbeatable");
  assert.equal(
    off.weaponAttack(off.items[0], { ...opts(), unbeatableTargetDamaged: true }).total,
    off.weaponAttack(off.items[0], opts()).total
  );
  assert.equal(unbeatableStancePlan(a.system, { ranged: true, targetDamaged: true }), null);
  assert.match(
    rollPipeline.dialog({ dialog: "attack", actor: a, item: w, options: {} }),
    /name="unbeatableTargetDamaged"/
  );
  assert.doesNotMatch(
    rollPipeline.dialog({ dialog: "attack", actor: make(), item: w, options: {} }),
    /name="unbeatableTargetDamaged"/
  );
  assert.match(combatStanceContent(make()), /Unbeatable Stance/);
});

test("a melee attack with a plain one-handed sword carries the opposite-side move reminder", () => {
  const note = a => a.weaponAttack(a.items[0], opts()).notes;
  assert.match(note(make()), /opposite side of this opponent, if it is unoccupied \(p\.180\)/);
  assert.doesNotMatch(note(make([])), /opposite side/);
  assert.doesNotMatch(note(make(["Sword Basics"], { qualities: "FIN" })), /opposite side/);
  assert.doesNotMatch(note(make(["Sword Basics"], { meleeFamily: "" })), /opposite side/);
});
