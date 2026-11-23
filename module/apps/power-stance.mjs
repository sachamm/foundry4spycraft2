import { worldMigrating } from "../migrations/index.mjs";
import { primaryWriterFor } from "../writers.mjs";
import {
  stablePower as stable,
  powerStanceBonus,
  powerStanceInitiativeMarker as marker,
  powerStanceInitiativePlan as plan,
  reviewedPowerStanceInitiativePlan as reviewed
} from "../rules/power-stance.mjs";
import { assertShakenInitiativeCountReady, changeInitiativeCountPreservingShaken } from "./shaken-initiative.mjs";
import { queueRuleState } from "./rule-resource-scope.mjs";
import { isResourceLock, periodResourceActors } from "../services/transactions.mjs";
import { loc } from "../i18n.mjs";
import { decline } from "../error-notices.mjs";
const localReviews = new WeakMap(),
  jobs = new Map(),
  combatants = actor =>
    [...(game.combats ?? [])]
      .flatMap(c => [...(c.combatants ?? [])])
      .filter(c => c.actor?.uuid === actor.uuid && c.parent?.id);
function record(c) {
  const local = localReviews.get(c),
    saved = c.flags?.spycraft2?.powerStanceInitiative;
  if (local && saved?.resolvesReviewId === local.id && !saved.needsReview) {
    localReviews.delete(c);
    return saved;
  }
  return local ?? saved;
}
const exits = actor => {
  const rows = actor.flags?.spycraft2?.powerStanceUntrackedExits ?? [];
  if (!Array.isArray(rows)) throw Error(loc`Review the untracked Power Stance exits.`);
  return rows;
};
const untracked = c => !record(c) && exits(c.actor).some(r => r.combatId === c.parent.id && r.combatantId === c.id);
const powerSystem = actor => actor.system;
export const powerStanceInitiativeEvidence = c =>
  stable({
    actor: c.actor?.uuid,
    count: c.initiative,
    record: record(c),
    stance: c.actor?.system.combatStance,
    strength: c.actor?.system.abilities?.str?.value,
    activeFeats: c.actor?.system.activeFeatNames,
    conditions: c.actor?.system.conditionContext,
    group: c.group?.initiative ?? null,
    untrackedExit: untracked(c)
  });
function planFor(c) {
  const p = plan(powerSystem(c.actor), { initiative: c.initiative, record: record(c), untrackedExit: untracked(c) });
  if (p.needsReview) return p;
  if (
    c.group &&
    Number.isFinite(c.group.initiative) &&
    (powerStanceBonus(c.actor.system) || record(c)?.includedBonus || record(c)?.needsReview)
  )
    return {
      needsReview: true,
      reason: loc`Remove this combatant from its shared Initiative group before adjudicating its individual Power Stance Count.`
    };
  return p;
}
export const powerStanceInitiativeReviews = actor =>
  combatants(actor).flatMap(c => {
    const p = planFor(c);
    return p.needsReview
      ? [
          {
            combatId: c.parent.id,
            combatantId: c.id,
            name: c.parent.name ?? "Combat",
            count: c.initiative,
            reason: p.reason
          }
        ]
      : [];
  });
const markerMatches = (saved, next) => saved && Object.entries(next).every(([k, v]) => stable(saved[k]) === stable(v));
function hold(c, reason) {
  const old = record(c),
    held = {
      ...old,
      version: 1,
      id: old?.id ?? foundry.utils.randomID(),
      count: c.initiative,
      includedBonus: old?.includedBonus ?? null,
      stanceId: old?.stanceId ?? null,
      needsReview: true,
      reason
    };
  localReviews.set(c, held);
  return held;
}
async function saveHeld(c, reason) {
  const held = hold(c, reason);
  await queueRuleState(c.actor, async () => {
    if (!markerMatches(c.flags?.spycraft2?.powerStanceInitiative, held))
      await c.update({ "flags.spycraft2.powerStanceInitiative": held });
  });
  return held;
}
async function write(c, p, expected) {
  const previous = record(c),
    next = {
      ...p.record,
      ...(previous?.review ? { review: previous.review } : {}),
      ...(p.record.review ? { review: p.record.review } : {}),
      resolvesReviewId: previous?.id ?? null,
      operationId: foundry.utils.randomID()
    };
  try {
    if (p.initiative === null) {
      await queueRuleState(c.actor, () =>
        c.update(
          { "flags.spycraft2.powerStanceInitiative": next },
          { spycraft2PowerStanceInitiative: { expected, marker: next } }
        )
      );
    } else
      await changeInitiativeCountPreservingShaken(c, p.initiative, {
        updates: { "flags.spycraft2.powerStanceInitiative": next },
        options: { spycraft2PowerStanceInitiative: { expected, marker: next } }
      });
  } catch (error) {
    if (c.initiative === p.initiative && markerMatches(c.flags?.spycraft2?.powerStanceInitiative, next)) return p;
    throw error;
  }
  if (c.initiative !== p.initiative || !markerMatches(c.flags?.spycraft2?.powerStanceInitiative, next))
    throw Error(loc`The Power Stance Count did not settle. Review its included bonus.`);
  return p;
}
/** Local coordination has no base resource dependency; actual shared Count writes use the independent rule lock. */
function serial(actor, work) {
  const old = jobs.get(actor.uuid) ?? Promise.resolve(),
    pending = old
      .catch(() => {})
      .then(() => {
        if (!actor.isOwner) throw Error(loc`Only an owner may change this character’s Power Stance Count.`);
        return work();
      });
  jobs.set(
    actor.uuid,
    pending.catch(() => {})
  );
  return pending;
}
export function reconcilePowerStanceInitiative(actor) {
  return serial(actor, async () => {
    for (const c of combatants(actor)) {
      const expected = powerStanceInitiativeEvidence(c),
        p = planFor(c);
      if (p.needsReview) {
        await saveHeld(c, p.reason);
        continue;
      }
      if (!p.changed) continue;
      try {
        await write(c, p, expected);
      } catch (error) {
        await saveHeld(c, loc`The Power Stance Count update could not be verified: ${error.message}`);
        throw error;
      }
    }
  });
}
export function powerCountEntryNeedsConfirmation(actor) {
  return (
    actor.system.combatStance?.key !== "power" &&
    combatants(actor).some(c => Number.isFinite(c.initiative) && !record(c))
  );
}
/** Called before committing entry, including when an already-paid callback owns the base queue. */
export function preparePowerStanceEntry(actor, input) {
  if (input.stance !== "power") return Promise.resolve();
  return serial(actor, async () => {
    for (const c of combatants(actor)) {
      if (c.initiative === null) continue;
      if (c.group && Number.isFinite(c.group.initiative))
        throw Error(loc`Remove the combatant from its shared Initiative group before entering Power Stance.`);
      assertShakenInitiativeCountReady(c);
      const expected = powerStanceInitiativeEvidence(c);
      if (!record(c)) {
        if (actor.system.combatStance?.key === "power" || untracked(c))
          throw Error(loc`Review the existing Power Stance Count before entering again.`);
        if (input.powerCountConfirmed !== true)
          throw Error(
            loc`The GC must confirm this existing Count does not already include Power Stance before first entry.`
          );
        await write(
          c,
          {
            initiative: c.initiative,
            record: { ...marker(actor.system, c.initiative), includedBonus: 0, stanceId: null }
          },
          expected
        );
        continue;
      }
      const p = planFor(c);
      if (p.needsReview) throw Error(p.reason);
      if (p.changed) await write(c, p, expected);
    }
  });
}
/** Persist an unknown old component atomically with exit so a reload cannot silently forget it. */
export function powerStanceExitPatch(actor) {
  if (actor.system.combatStance?.key !== "power") return {};
  const missing = combatants(actor).filter(
    c => Number.isFinite(c.initiative) && !c.flags?.spycraft2?.powerStanceInitiative
  );
  if (!missing.length) return {};
  const rows = [...exits(actor)];
  for (const c of missing)
    if (!rows.some(r => r.combatId === c.parent.id && r.combatantId === c.id))
      rows.push({ version: 1, combatId: c.parent.id, combatantId: c.id, stanceId: actor.system.combatStance.id });
  return { "flags.spycraft2.powerStanceUntrackedExits": rows };
}
export async function reviewPowerStanceInitiative(actor, combatId, combatantId, input = {}) {
  if (!actor.isOwner || !game.user.isGM)
    throw Error(loc`The owning GC must review the included Power Stance Count bonus.`);
  const c = game.combats.get(combatId)?.combatants.get(combatantId);
  if (c?.actor?.uuid !== actor.uuid) throw Error(loc`Choose this character’s actual combatant.`);
  if (c.group && Number.isFinite(c.group.initiative))
    throw Error(loc`Remove the combatant from its shared Initiative group first.`);
  const expected = powerStanceInitiativeEvidence(c);
  if (!Object.hasOwn(input, "includedBonus")) {
    const esc = foundry.utils.escapeHTML;
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Review Power Stance Initiative Count` },
      rejectClose: false,
      content:
        '<div class="spycraft2-roll-options"><p>' +
        esc(actor.name) +
        loc`: current Count ` +
        Number(c.initiative) +
        ". " +
        esc(planFor(c).reason ?? loc`Confirm the stance component already included.`) +
        `</p><p>${loc`Enter the Power Stance bonus already included in this current Count, using the earlier Strength score if it changed. Use zero only when it contains none. Reconciliation changes only that component and preserves other Count gains/losses.`}</p><label>${loc`Included Power Stance bonus`} <input name="includedBonus" type="number" min="0" step="1" required /></label><label>${loc`Review note`} <input name="resolution" maxlength="500" required /></label></div>`
    });
    if (!input) return null;
  }
  const included =
    typeof input.includedBonus === "string" && input.includedBonus.trim()
      ? Number(input.includedBonus)
      : input.includedBonus;
  if (
    !Number.isSafeInteger(included) ||
    included < 0 ||
    typeof input.resolution !== "string" ||
    !input.resolution.trim() ||
    input.resolution.length > 500
  )
    throw Error(loc`Confirm the included whole nonnegative stance bonus and record a review note.`);
  return serial(actor, async () => {
    if (powerStanceInitiativeEvidence(c) !== expected)
      throw Error(loc`The Count, Strength, stance or inclusion record changed. Review them again.`);
    const p = reviewed(actor.system, { initiative: c.initiative, record: record(c) }, included);
    p.record.review = { by: game.user.id, note: input.resolution.trim(), includedBonus: included };
    return write(c, p, expected);
  });
}
export async function managePowerStanceInitiative(actor, input = {}) {
  if (!game.user.isGM || !actor.isOwner) throw Error(loc`The owning GC reviews Power Stance Counts.`);
  if (!input.combatant) {
    const pending = powerStanceInitiativeReviews(actor),
      esc = foundry.utils.escapeHTML;
    if (!pending.length) return decline(loc`No Power Stance Count needs review.`);
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Review Power Stance Count` },
      rejectClose: false,
      content:
        `<div class="spycraft2-roll-options"><label>${loc`Combatant Count`} <select name="combatant">` +
        pending
          .map(
            p =>
              '<option value="' +
              esc(p.combatId + "|" + p.combatantId) +
              '">' +
              esc(p.name + " — Count " + p.count) +
              "</option>"
          )
          .join("") +
        `</select></label><p>${loc`Confirm the Power Stance component already included in that Count in the next dialog.`}</p></div>`
    });
    if (!input) return null;
  }
  const [combatId, combatantId, ...extra] = String(input.combatant).split("|");
  if (extra.length) throw Error(loc`Choose a listed combatant.`);
  return reviewPowerStanceInitiative(actor, combatId, combatantId, input);
}
export function guardPowerStanceInitiativeUpdate(c, changed, options = {}) {
  if (!c.actor) return;
  const own = options.spycraft2PowerStanceInitiative;
  if (own) {
    if (powerStanceInitiativeEvidence(c) !== own.expected)
      throw Error(loc`The Count, Power Stance or Strength changed before its update.`);
    changed["flags.spycraft2.powerStanceInitiative"] = own.marker;
    return;
  }
  if (["actorId", "tokenId", "sceneId", "group"].some(k => Object.hasOwn(changed, k))) {
    if (
      Object.hasOwn(changed, "group") &&
      !["actorId", "tokenId", "sceneId"].some(k => Object.hasOwn(changed, k)) &&
      !powerStanceBonus(c.actor.system) &&
      !record(c)?.includedBonus &&
      !record(c)?.needsReview &&
      !untracked(c)
    ) {
      changed["flags.spycraft2.powerStanceInitiative"] = marker(
        c.actor.system,
        Object.hasOwn(changed, "initiative") ? changed.initiative : c.initiative
      );
      return;
    }
    changed["flags.spycraft2.powerStanceInitiative"] = {
      version: 1,
      count: changed.initiative ?? c.initiative,
      includedBonus: null,
      stanceId: null,
      needsReview: true,
      reason: loc`The combatant identity or shared Initiative group changed. Review its included Power Stance component.`
    };
    return;
  }
  if (!Object.hasOwn(changed, "initiative")) return;
  const previous = record(c);
  if (options.spycraft2ShakenInitiative) {
    if (previous) {
      changed["flags.spycraft2.powerStanceInitiative"] = { ...previous, count: changed.initiative };
      return;
    }
    if (powerStanceBonus(c.actor.system) || untracked(c)) {
      changed["flags.spycraft2.powerStanceInitiative"] = {
        version: 1,
        count: changed.initiative,
        includedBonus: null,
        stanceId: null,
        needsReview: true,
        reason: loc`Review this Count’s included Power Stance component after the other Count adjustment.`
      };
      return;
    }
  }
  changed["flags.spycraft2.powerStanceInitiative"] = {
    ...marker(c.actor.system, changed.initiative),
    ...(previous?.id ? { resolvesReviewId: previous.id } : {})
  };
}
export function installPowerStanceInitiativeHooks() {
  const pending = new WeakMap();
  const schedule = actor => {
    if (!actor || actor.type !== "agent" || !actor.isOwner || !combatants(actor).length) return;
    if (primaryWriterFor(actor)?.id !== game.user.id) return;
    if (worldMigrating()) return;
    const old = pending.get(actor);
    if (old) {
      old.again = true;
      return;
    }
    const state = { again: true };
    pending.set(actor, state);
    state.promise = Promise.resolve()
      .then(async () => {
        do {
          state.again = false;
          await reconcilePowerStanceInitiative(actor);
        } while (state.again);
      })
      .catch(error => ui.notifications.warn(loc`Power Stance Count needs review: ${error.message}`))
      .finally(() => pending.delete(actor));
  };
  Hooks.on("preCreateCombatant", c => {
    try {
      if (c.actor)
        c.updateSource({ "flags.spycraft2.powerStanceInitiative": marker(c.actor.system, c.initiative ?? null) });
    } catch (error) {
      ui.notifications.warn(error.message);
      return false;
    }
  });
  Hooks.on("preUpdateCombatant", (c, changed, options) => {
    try {
      guardPowerStanceInitiativeUpdate(c, changed, options);
    } catch (error) {
      ui.notifications.warn(error.message);
      return false;
    }
  });
  Hooks.on("createCombatant", c => schedule(c.actor));
  Hooks.on("updateCombatant", c => schedule(c.actor));
  Hooks.on("updateActor", schedule);
  for (const event of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"])
    Hooks.on(event, e => schedule(e.parent?.documentName === "Actor" ? e.parent : e.parent?.parent));
  for (const event of ["createItem", "updateItem", "deleteItem"])
    Hooks.on(event, item => {
      if (!isResourceLock(item)) schedule(item.parent);
    });
  // After the start-up migration: what it changed is reconciled here in one pass, not once per written document.
  Hooks.once("spycraft2.ready", () => {
    for (const actor of periodResourceActors()) schedule(actor);
  });
}
