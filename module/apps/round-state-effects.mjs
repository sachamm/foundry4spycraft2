/**
 * Shows a character's round-scoped states (stances, Total Defense, action-die boosts and similar) as Active Effects,
 * so they appear on the token and in the effects list with a duration.
 *
 * The effect is a display of the recorded state, not the state itself: the rules still read the record on the
 * character, and this module adds or removes the matching effect whenever that record or the combat clock changes.
 * Only the active GM's client writes, so two clients never create the same effect.
 */
import { isLeadGM } from "../writers.mjs";
import { readSetting } from "../settings.mjs";
import { combatExpertiseState } from "../rules/combat-expertise.mjs";
import { fightDefensivelyState } from "../rules/fight-defensively.mjs";
import { combatStanceState } from "../rules/combat-stance.mjs";
import { dartingStyleState } from "../rules/darting-state.mjs";
import { activeDefenseBoost, activeFortunesOfWar, activeNoFear } from "../rules/health.mjs";
import { superiorCoverState } from "../rules/superior-cover.mjs";
import { totalDefenseState } from "../rules/total-defense.mjs";
import { twoWeaponStyleState } from "../rules/two-weapon-state.mjs";
import { loc } from "../i18n.mjs";
import { renderOpenSheet } from "../services/refresh.mjs";

const ICON = "icons/svg/aura.svg";

/**
 * The states mirrored. `read` returns the rule's own view of the state; `rounds` is how long it normally lasts
 * (null for a state that lasts until the character ends it).
 */
export const ROUND_STATES = Object.freeze([
  {
    key: "combatStance",
    field: "combatStance",
    read: combatStanceState,
    label: state => `Stance: ${state.name}`,
    rounds: null
  },
  {
    key: "totalDefense",
    field: "totalDefense",
    read: totalDefenseState,
    label: state => `Total Defense +${state.bonus}`,
    rounds: 1
  },
  {
    key: "combatExpertise",
    field: "combatExpertise",
    read: combatExpertiseState,
    label: state => `Combat Expertise −${state.penalty}`,
    rounds: 1
  },
  {
    key: "fightDefensively",
    field: "fightDefensively",
    read: fightDefensivelyState,
    label: () => "Fighting Defensively",
    rounds: 1
  },
  { key: "superiorCover", field: "superiorCover", read: superiorCoverState, label: () => "Superior Cover", rounds: 1 },
  { key: "dartingStyle", field: "dartingStyle", read: dartingStyleState, label: () => "Darting Weapon", rounds: 1 },
  {
    key: "twoWeaponStyle",
    field: "twoWeaponStyle",
    read: twoWeaponStyleState,
    label: () => "Two-Weapon Fighting",
    rounds: 1
  },
  {
    key: "defenseBoost",
    field: "defenseBoost",
    read: activeDefenseBoost,
    label: () => loc`Defense boost (action die)`,
    rounds: 1
  },
  {
    key: "fortunesOfWarBoost",
    field: "fortunesOfWarBoost",
    read: activeFortunesOfWar,
    label: () => "Fortunes of War boost",
    rounds: 1
  },
  { key: "noFearBoost", field: "noFearBoost", read: activeNoFear, label: () => "No Fear", rounds: 1 }
]);

const STATE_FIELDS = new Set(ROUND_STATES.map(state => state.field));

/** The rule's answer counts as active when it says so, names a stance, or is simply present. */
const isActive = state => !!state && (state.active ?? (state.key !== undefined ? !!state.key : true));

/** The states currently in force for a character: [{key, label, rounds}]. A state that cannot be read is skipped. */
export function activeRoundStates(system, states = ROUND_STATES) {
  const active = [];
  for (const spec of states) {
    let state;
    try {
      state = spec.read(system);
    } catch {
      continue;
    }
    if (isActive(state)) active.push({ key: spec.key, label: spec.label(state), rounds: spec.rounds });
  }
  return active;
}

/**
 * Compare the effects a character has with the states in force.
 * @param {Array<{id: string, name: string, key: string}>} existing  mirror effects already on the character
 * @returns {{create: object[], remove: string[], rename: Array<{id: string, name: string}>}}
 */
export function planRoundStateEffects(existing, desired) {
  const wanted = new Map(desired.map(state => [state.key, state]));
  const seen = new Set(),
    remove = [],
    rename = [];
  for (const effect of existing) {
    const state = wanted.get(effect.key);
    if (!state || seen.has(effect.key)) remove.push(effect.id);
    else {
      seen.add(effect.key);
      if (effect.name !== state.label) rename.push({ id: effect.id, name: state.label });
    }
  }
  return { create: desired.filter(state => !seen.has(state.key)), remove, rename };
}

const mirrorEffects = actor =>
  [...(actor.effects ?? [])]
    .filter(effect => effect.flags?.spycraft2?.roundState)
    .map(effect => ({ id: effect.id, name: effect.name, key: effect.flags.spycraft2.roundState }));

const pendingSyncs = new WeakMap();
/** Re-read effects and state after the preceding write; overlapping actor/combat hooks must not reuse a plan. */
export function syncRoundStateEffects(actor, options = {}) {
  const pending = (pendingSyncs.get(actor) ?? Promise.resolve())
    .catch(() => {})
    .then(() => applyRoundStateEffects(actor, options));
  pendingSyncs.set(actor, pending);
  const clear = () => {
    if (pendingSyncs.get(actor) === pending) pendingSyncs.delete(actor);
  };
  pending.then(clear, clear);
  return pending;
}

/** Bring one character's mirror effects in line with its states. Returns what was changed. */
async function applyRoundStateEffects(actor, { states = ROUND_STATES } = {}) {
  if (actor.type === "npc") states = states.filter(state => state.key === "defenseBoost");
  const plan = planRoundStateEffects(mirrorEffects(actor), activeRoundStates(actor.system, states));
  if (plan.remove.length) await actor.deleteEmbeddedDocuments("ActiveEffect", plan.remove, { render: false });
  if (plan.rename.length)
    await actor.updateEmbeddedDocuments(
      "ActiveEffect",
      plan.rename.map(r => ({ _id: r.id, name: r.name }))
    );
  if (plan.create.length) {
    await actor.createEmbeddedDocuments(
      "ActiveEffect",
      plan.create.map(state => ({
        name: state.label,
        img: ICON,
        origin: actor.uuid,
        description: `<p>${loc`Shown for reference. The character sheet holds the recorded state and ends it.`}</p>`,
        ...(state.rounds ? { duration: { value: state.rounds, units: "rounds" } } : {}),
        flags: { spycraft2: { roundState: state.key } }
      }))
    );
  }
  return plan;
}

const enabled = () => {
  return readSetting("roundStateEffects", false) !== false;
};
const mine = actor => enabled() && ["agent", "npc"].includes(actor?.type) && isLeadGM();
const report = error => console.error(loc`Field Agent's Handbook | Could not update round-state effects`, error);

/** Register the setting and the hooks. Call during `init`. */
export function installRoundStateEffects() {
  game.settings.register("spycraft2", "roundStateEffects", {
    name: "SPYCRAFT.Settings.RoundStateEffects.Name",
    hint: "SPYCRAFT.Settings.RoundStateEffects.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  Hooks.on("updateActor", (actor, changed) => {
    if (!mine(actor) || !Object.keys(changed.system ?? {}).some(key => STATE_FIELDS.has(key))) return;
    syncRoundStateEffects(actor).catch(report);
  });
  // Round-long states end on the combat clock, without the character's data changing.
  const sweep = combat => {
    const actors = new Set([
      ...(game.actors ?? []),
      ...[...(combat?.combatants ?? [])].map(c => c.actor).filter(Boolean)
    ]);
    for (const actor of actors)
      if (actor.type === "npc" && actor.system.defenseBoost) {
        actor.reset?.();
        renderOpenSheet(actor);
      }
    if (!isLeadGM() || !enabled()) return;
    for (const actor of actors) {
      if (!["agent", "npc"].includes(actor.type)) continue;
      if (mirrorEffects(actor).length || activeRoundStates(actor.system).length)
        syncRoundStateEffects(actor).catch(report);
    }
  };
  Hooks.on("updateCombat", (combat, changed) => {
    if (Object.hasOwn(changed, "round") || Object.hasOwn(changed, "turn") || Object.hasOwn(changed, "active"))
      sweep(combat);
  });
  Hooks.on("deleteCombat", sweep);
}
