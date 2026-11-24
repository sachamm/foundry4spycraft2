/**
 * Keeps each agent's current vitality, wounds and action dice in step with their maximums (module/rules/pool-max.mjs).
 * One client writes for each agent (module/writers.mjs), after the change that moved a maximum has been saved. The
 * check follows every preparation, because a maximum can move without the agent itself changing: an item or effect,
 * a combat round ending a rage, or a teammate's Improved Fortune.
 */
import { worldMigrating } from "../migrations/index.mjs";
import { primaryWriterFor } from "../writers.mjs";
import { queueResources } from "../services/transactions.mjs";
import { poolMaxPlan, POOL_MAX_FLAG } from "../rules/pool-max.mjs";

const planFor = actor => poolMaxPlan(actor.system, actor.flags?.spycraft2?.[POOL_MAX_FLAG]);

/** Write the plan for one agent. Returns the update written, or null when nothing changed. */
export function followPoolMax(actor) {
  if (actor?.type !== "agent" || !actor.isOwner) return null;
  // Most updates move no maximum, so they are checked here without taking the character's resource lock.
  if (!Object.keys(planFor(actor)).length) return null;
  return queueResources(
    [actor],
    async () => {
      const patch = planFor(actor);
      if (!Object.keys(patch).length) return null;
      await actor.update(patch, { spycraft2PoolMax: true });
      return patch;
    },
    { background: true }
  );
}

const pending = new WeakMap();
/** Follow an agent's maximums soon, once for any number of calls in a row. */
export function schedulePoolMax(actor) {
  if (!actor || actor.type !== "agent" || !actor.isOwner) return;
  if (primaryWriterFor(actor)?.id !== game.user.id) return;
  if (worldMigrating()) return;
  const old = pending.get(actor);
  if (old) {
    old.again = true;
    return;
  }
  const state = { again: true };
  pending.set(actor, state);
  Promise.resolve()
    .then(async () => {
      do {
        state.again = false;
        await followPoolMax(actor);
      } while (state.again);
    })
    // Nothing is lost: the recorded maximums were not updated, so the next change catches up.
    .catch(error => console.debug("Field Agent's Handbook | Vitality, wounds and dice will catch up later.", error))
    .finally(() => pending.delete(actor));
}

export function installPoolMaxHooks() {
  Hooks.on("spycraft2.agentPrepared", schedulePoolMax);
  // Every preparation after the world is ready schedules a check (actor.mjs prepareData). Agents prepared before
  // then, or while the start-up migration ran, are checked here once; agents made before this was added get their
  // current maximums recorded with their values untouched.
  Hooks.once("spycraft2.ready", () => {
    for (const actor of game.actors ?? []) schedulePoolMax(actor);
  });
}
