/**
 * The Actor document. Its behaviour is split by workflow into module/documents/actor/*.mjs; each file adds its
 * methods through a mixin, so everything is still called as actor.method().
 */
import { isResourceLock } from "../services/transactions.mjs";
import { ActorRolls } from "./actor/rolls.mjs";
import { ActorSkillRolls } from "./actor/skill-rolls.mjs";
import { ActorAttackRolls } from "./actor/attack-rolls.mjs";
import { ActorOutcomes } from "./actor/outcomes.mjs";
import { ActorConditions } from "./actor/conditions.mjs";
import { ActorActionDice } from "./actor/action-dice.mjs";
import { ActorAbilities } from "./actor/abilities.mjs";
import { agentTokenDefaults, renamedTokenName } from "../rules/creation-defaults.mjs";
import { newAgentPoolMax, poolRules, POOL_MAX_FLAG } from "../rules/pool-max.mjs";
import { ActorGear } from "./actor/gear.mjs";
import { ActorProgression } from "./actor/progression.mjs";

export class SpycraftActor extends ActorRolls(
  ActorSkillRolls(
    ActorAttackRolls(
      ActorOutcomes(ActorConditions(ActorActionDice(ActorAbilities(ActorGear(ActorProgression(Actor))))))
    )
  )
) {
  /** @override */
  prepareData() {
    super.prepareData();
    // Current vitality, wounds and action dice follow their maximums, and any preparation can move one (an item, an
    // effect, a combat round, a teammate). module/apps/pool-max.mjs listens, checks after this preparation and
    // writes only on a change.
    if ((this.type === "agent" || this.type === "npc") && globalThis.game?.ready)
      Hooks.callAll("spycraft2.agentPrepared", this);
  }

  /** @override */
  getRollData() {
    return this.system.getRollData?.() ?? { ...super.getRollData() };
  }

  /** Runtime resource mutexes must never become copied inventory or exported character data. */
  async _preCreate(data, options, user) {
    if ((await super._preCreate(data, options, user)) === false) return false;
    const updates = {};
    if (Array.isArray(data.items)) {
      const items = data.items.filter(item => !isResourceLock(item));
      if (items.length !== data.items.length) {
        data.items = items;
        updates.items = items;
      }
    }
    const type = data.type ?? this.type;
    if (type === "agent" || type === "npc") {
      // A new agent starts with full vitality, wounds and action dice, and a new NPC with full vitality and wounds
      // once it is a special character: empty maximums are recorded here, and the pool-max hooks
      // (module/apps/pool-max.mjs) then raise each empty pool to its maximum.
      const flags = {
        ...(data.flags ?? this.flags ?? {}),
        spycraft2: {
          ...(data.flags?.spycraft2 ?? this.flags?.spycraft2 ?? {}),
          [POOL_MAX_FLAG]: newAgentPoolMax(this._source?.system ?? data.system, poolRules(type).pools)
        }
      };
      data.flags = flags;
      updates.flags = flags;
    }
    if (type === "agent") {
      // A character entering the world (new, or imported from a compendium) has taken no stress or subdual
      // damage yet, so its ledger starts at zero instead of waiting for a GC review.
      if (!(data.system?.accumulatedDamage ?? this.system?.accumulatedDamage)) {
        // The update below is not recursive, so it carries the whole system source with the ledger set.
        updates.system = {
          ...(this._source?.system ?? {}),
          accumulatedDamage: { version: 1, revision: 1, stress: 0, subdual: 0, pending: [], lastReview: null }
        };
      }
    }
    // An agent is one particular person: players need its token to see on scenes that use token vision, the token
    // and the sheet must be the same character, and it stands on the players' side. An explicit choice is kept.
    if ((data.type ?? this.type) === "agent") {
      const given = data.prototypeToken ?? {};
      const defaults = agentTokenDefaults(given);
      if (defaults) {
        // The update below is not recursive, so it carries the whole prototype token.
        const token = this._source?.prototypeToken ?? given;
        updates.prototypeToken = {
          ...token,
          ...defaults,
          sight: { ...(token.sight ?? {}), ...(defaults.sight ?? {}) }
        };
      }
    }
    if (Object.keys(updates).length) this.updateSource(updates, { recursive: false });
  }

  /** An NPC's prototype token follows a rename while it still carries the old name. */
  async _preUpdate(changed, options, user) {
    if ((await super._preUpdate(changed, options, user)) === false) return false;
    if (this.type !== "npc" || typeof changed.name !== "string" || changed.name === this.name) return;
    options.spycraft2RenamedFrom = this.name;
    if (changed.prototypeToken?.name !== undefined) return;
    const next = renamedTokenName(this.prototypeToken?.name, this.name, changed.name);
    if (next) changed.prototypeToken = { ...(changed.prototypeToken ?? {}), name: next };
  }

  /** Placed tokens still called by the old name (with or without a number) follow too, on the renaming client. */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    const old = options?.spycraft2RenamedFrom;
    if (!old || this.type !== "npc" || userId !== game.user?.id || typeof changed.name !== "string") return;
    for (const scene of game.scenes ?? []) {
      const updates = [...scene.tokens]
        .filter(token => token.actorId === this.id)
        .map(token => ({ _id: token.id, name: renamedTokenName(token.name, old, changed.name) }))
        .filter(update => update.name);
      if (updates.length && scene.isOwner !== false)
        scene
          .updateEmbeddedDocuments("Token", updates)
          .catch(error => console.warn("Field Agent's Handbook | Tokens kept their old name.", error));
    }
  }

  toCompendium(pack, options = {}) {
    const data = super.toCompendium(pack, options);
    if (Array.isArray(data.items)) data.items = data.items.filter(item => !isResourceLock(item));
    return data;
  }

  /* -------------------------------------------- */
  /*  Rolls                                        */
  /* -------------------------------------------- */

  get participatingCombat() {
    const participates = combat => combat?.started && combat.combatants?.some(c => c.actor?.uuid === this.uuid);
    if (participates(globalThis.game?.combat)) return game.combat;
    return [...(globalThis.game?.combats ?? [])].find(participates) ?? null;
  }
}
