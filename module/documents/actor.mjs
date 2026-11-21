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
    if ((data.type ?? this.type) === "agent") {
      const creation = {
          id: foundry.utils.randomID(),
          session: String(this.usagePeriods.session ?? "initial"),
          at: game.time?.worldTime ?? 0,
          claimed: false
        },
        flags = {
          ...(data.flags ?? this.flags ?? {}),
          spycraft2: { ...(data.flags?.spycraft2 ?? this.flags?.spycraft2 ?? {}), startingDiceCreation: creation }
        };
      data.flags = flags;
      updates.flags = flags;
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
    // Players need their agent's token to see on scenes that use token vision. An explicit choice is kept.
    if ((data.type ?? this.type) === "agent" && data.prototypeToken?.sight?.enabled === undefined) {
      // The update below is not recursive, so it carries the whole prototype token with sight switched on.
      const token = this._source?.prototypeToken ?? data.prototypeToken ?? {};
      updates.prototypeToken = { ...token, sight: { ...(token.sight ?? {}), enabled: true } };
    }
    if (Object.keys(updates).length) this.updateSource(updates, { recursive: false });
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
