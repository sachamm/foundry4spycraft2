import { actor as baseActor, controls, opts } from "./side-stance.mjs";
import { makeFatigueActor } from "./fatigue-actor.mjs";
import { prep } from "./feint.mjs";
export { controls };
ui.notifications.info = () => undefined;
export function actor() {
  const a = baseActor();
  Object.assign(a.items[0].system, {
    proficiency: "exoticBlunt",
    meleeFamily: "staff",
    sizeHands: "M/2h",
    useHands: 2,
    qualities: "",
    damage: "1d8"
  });
  Object.assign(a.system, { activeFeatNames: ["Staff Basics", "All-out Attack"], combatStance: null });
  a.system.proficiencyTotals.exoticBlunt = { proficient: true };
  a.system = prep(a.system, a.items);
  for (const e of ["held", "pinned"])
    if (!CONFIG.statusEffects.some(s => s.id === e)) CONFIG.statusEffects.push({ id: e, name: e });
  const target = makeFatigueActor();
  target.uuid = "Actor.target";
  target.id = "target";
  target.name = "Actual held target";
  target.isOwner = true;
  target.documentName = "Actor";
  const derive = target.derive;
  target.derive = () => {
    derive();
    Object.assign(target.system.conditionContext, {
      held: target.statuses.has("held"),
      pinned: target.statuses.has("pinned")
    });
  };
  target.derive();
  game.actors[1] = target;
  game.messages.get = id => game.messages.find(m => m.id === id);
  return a;
}
export const input = patch => ({ ...opts(), meleeTrick: "threadNeedle", meleeTrickOnlyConfirmed: true, ...patch });
export async function attack(a = actor(), patch = {}) {
  const m = await a.rollAttack(a.items[0], input(patch));
  if (m)
    m.update = async p => {
      for (const [k, v] of Object.entries(p)) {
        const path = k.split(".");
        let o = m;
        for (const key of path.slice(0, -1)) o = o[key] ??= {};
        o[path.at(-1)] = structuredClone(v);
      }
      return m;
    };
  return m;
}
export async function hit(a = actor(), patch = {}) {
  const m = await attack(a, patch);
  Object.assign(m.flags.spycraft2, { resolved: true, successConfirmed: true });
  return { a, m, target: game.actors[1] };
}
