/**
 * Keeps each agent's current vitality, wounds and action dice in step with their maximums (module/rules/pool-max.mjs),
 * and each NPC's vitality and wounds, so an NPC that becomes a special character starts unhurt.
 * One client writes for each agent (module/writers.mjs), after the change that moved a maximum has been saved. The
 * check follows every preparation, because a maximum can move without the agent itself changing: an item or effect,
 * a combat round ending a rage, or a teammate's Improved Fortune.
 */
import { worldMigrating } from "../migrations/index.mjs";
import { primaryWriterFor } from "../writers.mjs";
import { queueResources } from "../services/transactions.mjs";
import { poolMaxPlan, poolRules, POOL_MAX_FLAG } from "../rules/pool-max.mjs";

const planFor = actor => poolMaxPlan(actor.system, actor.flags?.spycraft2?.[POOL_MAX_FLAG], poolRules(actor.type));
/** Agents, and NPCs: a special NPC's vitality and wounds come from its build and the Threat Level. */
// A compendium entry is never written to: it is followed once it is imported.
const followed = actor => !actor?.pack && (actor?.type === "agent" || actor?.type === "npc");

/** Write the plan for one agent. Returns the update written, or null when nothing changed. */
export function followPoolMax(actor) {
  if (!followed(actor) || !actor.isOwner) return null;
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
  if (!followed(actor) || !actor.isOwner) return;
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

/**
 * An unlinked token reads its base actor's recorded maximums until it writes its own, so two tokens of one NPC could
 * follow a change differently (one wounded, one not). Each such token gets its own record as soon as it exists.
 */
export function ownPoolRecord(token) {
  const actor = token?.actor;
  if (!token || token.actorLink || !followed(actor)) return null;
  const own = token.delta?._source?.flags?.spycraft2?.[POOL_MAX_FLAG] ?? token.delta?.flags?.spycraft2?.[POOL_MAX_FLAG];
  const inherited = actor.flags?.spycraft2?.[POOL_MAX_FLAG];
  if (own || !inherited) return null;
  return { [`flags.spycraft2.${POOL_MAX_FLAG}`]: foundry.utils.deepClone(inherited) };
}
function recordOwnPools(token) {
  const patch = ownPoolRecord(token);
  if (!patch || primaryWriterFor(token.actor)?.id !== game.user?.id) return;
  token.actor.update(patch, { spycraft2PoolMax: true }).catch(() => null);
}

export function installPoolMaxHooks() {
  Hooks.on("createToken", recordOwnPools);
  Hooks.on("spycraft2.agentPrepared", schedulePoolMax);
  // Every preparation after the world is ready schedules a check (actor.mjs prepareData). Agents prepared before
  // then, or while the start-up migration ran, are checked here once; agents made before this was added get their
  // current maximums recorded with their values untouched.
  Hooks.once("spycraft2.ready", () => {
    // Agents first: an Animal Partner's maximums are read from its owner, so the owner is settled before it.
    const all = [...(game.actors ?? [])];
    for (const actor of [...all.filter(a => a.type === "agent"), ...all.filter(a => a.type !== "agent")])
      schedulePoolMax(actor);
    for (const scene of game.scenes ?? []) for (const token of scene.tokens ?? []) recordOwnPools(token);
  });
}
