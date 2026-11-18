import { actor as attackActor, controls } from "./side-stance.mjs";
import { makeFatigueActor } from "./fatigue-actor.mjs";
import { prep } from "./feint.mjs";
export { controls };
export function setPath(object, path, value) {
  const keys = path.split(".");
  let current = object;
  for (const k of keys.slice(0, -1)) current = current[k] ??= {};
  current[keys.at(-1)] = structuredClone(value);
}
export function attach(m) {
  m.update = async patch => {
    for (const [k, v] of Object.entries(patch)) setPath(m, k, v);
    return m;
  };
  return m;
}
const BaseRoll = globalThis.Roll;
globalThis.Roll = class extends BaseRoll {
  async toMessage(...args) {
    try {
      return attach(await super.toMessage(...args));
    } catch (error) {
      for (const m of game.messages) attach(m);
      throw error;
    }
  }
};
export async function fixture({ manual = false, attackReplacement = false, damageReplacement = false } = {}) {
  const source = attackActor(),
    weapon = source.items[0];
  source.system.combatStance = null;
  source.system.activeFeatNames.push("Axe Basics");
  Object.assign(weapon.system, {
    proficiency: "edged",
    meleeFamily: "axe",
    sizeHands: "S/1h",
    useHands: 1,
    qualities: "",
    damage: "1d8"
  });
  source.system = prep(source.system, source.items);
  const target = makeFatigueActor();
  target.uuid = "Actor.target";
  target.documentName = "Actor";
  target.name = "Target";
  target.flags = {};
  target.getRollData = () => ({});
  target.mentalLeapCombatContext = () => null;
  target.fault = { before: null, after: null };
  target.update = async patch => {
    await target.fault.before?.(patch);
    for (const [k, v] of Object.entries(patch))
      if (k.startsWith("flags.")) setPath(target, k, v);
      else if (k.startsWith("system.")) setPath(target.raw, k.slice(7), v);
    target.derive();
    await target.fault.after?.(patch);
    return target;
  };
  game.actors = [source, target];
  game.messages.get = id => game.messages.find(m => m.id === id);
  game.user.id = "GC";
  ui.notifications.info = () => null;
  if (!CONFIG.statusEffects.some(e => e.id === "sprawled"))
    CONFIG.statusEffects.push({ id: "sprawled", name: "Sprawled" });
  let attack = await source.rollAttack(weapon, {
    attackAction: "standard",
    targetActorUuid: manual ? "" : target.uuid,
    meleeTrick: "chop",
    meleeTrickFullActionConfirmed: true,
    meleeTrickOnlyConfirmed: true,
    ...(manual ? { meleeTrickTargetName: target.name, meleeTrickTargetConfirmed: true } : {})
  });
  if (attackReplacement) {
    const old = attack,
      c = old.flags.spycraft2;
    attack = await source.rollCheck(c.formula, c.rollData, { ...c, rerollOf: old.uuid });
    Object.assign(c, { resolved: true, superseded: attack.uuid });
  }
  Object.assign(attack.flags.spycraft2, { resolved: true, successConfirmed: true });
  let damage = await source.rollDamage(weapon, {
    includeSneakAttack: false,
    attackDamageSourceUuid: attack.uuid,
    targetActorUuid: manual ? "" : target.uuid
  });
  if (damageReplacement) {
    const old = damage,
      c = old.flags.spycraft2;
    damage = await source.rollCheck(c.formula, c.rollData, { ...c, rerollOf: old.uuid });
    Object.assign(c, { resolved: true, superseded: damage.uuid });
  }
  damage.flags.spycraft2.resolved = true;
  const input = {
    attackUuid: attack.uuid,
    damageUuid: damage.uuid,
    preDRDamage: 6,
    netDamage: 6,
    woundsLost: true,
    confirmed: true,
    targetConfirmed: true,
    askContext: false
  };
  return { source, target, weapon, attack, damage, input };
}
export async function finish(target, m, succeeded = m.flags.spycraft2.effectiveTotal >= m.flags.spycraft2.takedown.dc) {
  await target.confirmCheckOutcome(m, { succeeded });
  await target.finishCheck(m);
  return m;
}
export async function standing(target) {
  const { readFileSync } = await import("node:fs"),
    def = JSON.parse(readFileSync(new URL("../../src/data/classes.json", import.meta.url))).find(
      c => c.key === "brawler"
    );
  target.items = [
    {
      id: "brawler",
      type: "class",
      name: def.name,
      system: { ...def, identifier: "brawler", vitalityDie: def.vitality, choices: { 0: 6 } }
    }
  ];
  target.raw.progression = Array.from({ length: 3 }, () => ({ classId: "brawler", vitality: 6, skills: {} }));
  target.derive();
  if (
    !target.system.classOptionSelections.some(
      s => s.classId === "brawler" && s.name === "Still Standing" && s.level === 3
    )
  )
    throw Error("Canonical Brawler Ploy fixture failed");
}
