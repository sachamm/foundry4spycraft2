import { tripActiveCombatantId } from "./counter-trip.mjs";
import { queueResources } from "../services/transactions.mjs";
import { tripFinalSource } from "./trip-outcomes.mjs";
import { validOwnCountClock } from "../rules/own-count-duration.mjs";
import {
  attackCharacterTargetChoices,
  completeCharacterTarget,
  knownCharacterTargetInput
} from "./character-target.mjs";
import { standardAttackContextContent } from "./standard-attack-context.mjs";
import { finalAttackOptions, postFinalAttack, finalWeaponReady } from "./final-attack.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
const leases = new WeakMap(),
  active = new Set(),
  stable = v =>
    JSON.stringify(v, (_k, x) =>
      x && typeof x === "object" && !Array.isArray(x)
        ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
        : x
    ),
  message = uuid => globalThis.fromUuidSync?.(uuid);
function source(actor, proof) {
  const row = tripFinalSource(actor, message(proof.triggerMessageUuid)),
    s = row.settlement;
  if (
    proof.source !== "trip" ||
    typeof proof.id !== "string" ||
    !proof.id ||
    s.operationId !== proof.operationId ||
    s.defenderMessage !== proof.defenderMessageUuid ||
    s.defenderUuid !== proof.opponentUuid ||
    proof.version !== 1 ||
    proof.penalty !== 4 ||
    proof.attackAction !== "standard" ||
    (proof.activeCombatantId ?? null) !==
      (row.acting.flags.spycraft2.tripAttack.counterTrip?.activeCombatantId ?? null) ||
    stable(proof.combat) !==
      stable({
        id: s.combatId,
        round: s.round,
        turn: s.turn,
        combatantId: row.acting.flags.spycraft2.tripAttack.combat.combatantId,
        ownTurnIndex: row.acting.flags.spycraft2.tripAttack.combat.ownTurnIndex,
        started: true
      })
  )
    throw Error(loc`The actual critical Trip opportunity changed.`);
  const use = row.acting.flags.spycraft2.tripFinalUse;
  if (!["reserved", "posted"].includes(use?.state) || use?.id !== proof.id || stable(use.proof) !== stable(proof))
    throw Error(loc`This critical Trip final attack is not reserved for that actual source.`);
  return { ...row, use };
}
function currentTiming(actor, proof) {
  const c = actor.mentalLeapCombatContext();
  if (
    !validOwnCountClock(c) ||
    c.id !== proof.combat.id ||
    c.round !== proof.combat.round ||
    c.combatantId !== proof.combat.combatantId ||
    (proof.activeCombatantId ? tripActiveCombatantId(actor) !== proof.activeCombatantId : c.turn !== c.ownTurnIndex)
  )
    throw Error(loc`Take the earned Trip final attack immediately during its original Initiative Count.`);
}
export function validateTripFinalAttackProof(
  actor,
  proof,
  { checkKind, weaponUuid, attackContext, lease, rerollOf } = {}
) {
  if (proof?.source !== "trip") return;
  const row = source(actor, proof);
  if (
    checkKind !== "attack" ||
    proof.weaponUuid !== weaponUuid ||
    attackContext?.attackAction !== "standard" ||
    attackContext?.disarm?.active ||
    (attackContext?.targetActorUuid || attackContext?.characterTarget?.actorUuid) !== proof.opponentUuid
  )
    throw Error(loc`The Trip final attack must use its actual weapon and recorded opponent as a Standard Attack.`);
  if (rerollOf) {
    const roots = [...game.messages].filter(
      m =>
        m.flags?.spycraft2?.actorUuid === actor.uuid &&
        m.flags.spycraft2.checkKind === "attack" &&
        !m.flags.spycraft2.rerollOf &&
        stable(m.flags.spycraft2.finalAttack) === stable(proof)
    );
    if (roots.length !== 1 || (row.use.messageUuid && row.use.messageUuid !== roots[0].uuid))
      throw Error(loc`The original reserved Trip attack root needs GC review.`);
    let m = message(rerollOf),
      c = m?.flags?.spycraft2;
    const seen = new Set();
    if (
      c?.actorUuid !== actor.uuid ||
      c.checkKind !== "attack" ||
      c.resolved ||
      c.superseded ||
      stable(c.finalAttack) !== stable(proof)
    )
      throw Error(loc`Replace the actual owned unresolved Trip final attack.`);
    while (m && !seen.has(m.uuid)) {
      seen.add(m.uuid);
      c = m.flags?.spycraft2;
      if (c?.actorUuid !== actor.uuid || stable(c.finalAttack) !== stable(proof)) break;
      if (!c.rerollOf) {
        if (m.uuid !== roots[0].uuid) break;
        return;
      }
      m = message(c.rerollOf);
    }
    throw Error(loc`This replacement does not descend from the reserved Trip final attack.`);
  }
  if (!lease || leases.get(lease)?.actor !== actor || leases.get(lease)?.id !== proof.id)
    throw Error(loc`Use the earned Trip final-attack control to reserve its opportunity.`);
  currentTiming(actor, proof);
  if (!finalWeaponReady([...actor.items].find(w => w.uuid === proof.weaponUuid)))
    throw Error(loc`The actual Trip final-attack weapon is no longer readied.`);
  if (!attackCharacterTargetChoices().some(a => a.uuid === proof.opponentUuid))
    throw Error(loc`The actual Trip opponent is no longer observed.`);
}
export async function takeTripFinalAttack(actor, input = {}) {
  if (!actor.isOwner || actor.type !== "agent") return null;
  finalAttackOptions(input);
  if (!Object.hasOwn(input, "immediateConfirmed")) {
    const esc = foundry.utils.escapeHTML,
      ms = [...game.messages].filter(
        m =>
          m.visible !== false &&
          m.isContentVisible !== false &&
          (!m.blind || game.user.isGM) &&
          m.flags?.spycraft2?.actorUuid === actor.uuid &&
          [1, 2].includes(m.flags.spycraft2.tripAttack?.version) &&
          m.flags.spycraft2.tripSettlement?.attackerUuid === actor.uuid &&
          m.flags.spycraft2.tripSettlement?.criticalOpportunity === "finalAttack" &&
          m.flags.spycraft2.tripSettlement.state === "applied"
      ),
      weapons = [...actor.items].filter(finalWeaponReady);
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Critical Trip final attack` },
      rejectClose: false,
      content:
        `<div class="spycraft2-roll-options"><p>${loc`Use one earned winning Trip opportunity immediately against its original opponent. This final Standard Attack suffers−4 and uses the shared final-attack allowance, including Nauseated. Choose an actual owned readied weapon and confirm current range, line of sight and action legality.`}</p><label>${loc`Settled critical Trip`} <select name="sourceMessage">` +
        ms
          .map(
            m =>
              '<option value="' +
              esc(m.uuid) +
              '">' +
              esc(
                attackCharacterTargetChoices().find(a => a.uuid === m.flags.spycraft2.tripSettlement.defenderUuid)
                  ?.name ?? "Recorded opponent"
              ) +
              " · round " +
              m.flags.spycraft2.tripSettlement.round +
              "</option>"
          )
          .join("") +
        `</select></label><label>${loc`Actual weapon`} <select name="weaponId">` +
        weapons.map(w => '<option value="' + esc(w.id) + '">' + esc(w.name) + "</option>").join("") +
        "</select></label>" +
        standardAttackContextContent(actor, { includeCharacterTarget: false }) +
        `<label><input name="immediateConfirmed" type="checkbox" /> ${loc`This immediately follows that Trip with no intervening action`}</label><label><input name="attackLegalConfirmed" type="checkbox" /> ${loc`This Standard Attack against the original opponent is legal now`}</label></div>`
    });
    if (!input) return null;
  }
  if (input.immediateConfirmed !== true || input.attackLegalConfirmed !== true)
    throw Error(loc`Confirm the immediate legal final attack against the original Trip opponent.`);
  const row = tripFinalSource(actor, message(input.sourceMessage)),
    s = row.settlement,
    used = row.acting.flags.spycraft2.tripFinalUse;
  if (used) {
    if (used.state === "closed")
      throw Error(loc`This Trip final attack is reserved or interrupted; the GC closed its unused opportunity.`);
    source(actor, used.proof);
    const posted = [...game.messages].find(
      m =>
        m.flags?.spycraft2?.actorUuid === actor.uuid &&
        m.flags.spycraft2.finalAttack?.source === "trip" &&
        m.flags.spycraft2.finalAttack.id === used.id &&
        m.flags.spycraft2.finalAttack.triggerMessageUuid === row.acting.uuid
    );
    if (posted) {
      if (stable(posted.flags.spycraft2.finalAttack) !== stable(used.proof))
        throw Error(loc`The posted Trip attack proof changed; ask the GC to review it.`);
      return posted;
    }
    throw Error(
      loc`This Trip final attack is reserved or interrupted; the GC must review its existing receipts before another roll.`
    );
  }
  const weapon = actor.items.get(input.weaponId);
  if (!finalWeaponReady(weapon)) throw Error(loc`Choose an actual owned readied weapon.`);
  const target = attackCharacterTargetChoices().find(a => a.uuid === s.defenderUuid);
  if (!target) throw Error(loc`The original Trip opponent is no longer observed.`);
  const clock = row.acting.flags.spycraft2.tripAttack.combat,
    proof = {
      version: 1,
      source: "trip",
      id: foundry.utils.randomID(),
      triggerMessageUuid: row.acting.uuid,
      defenderMessageUuid: row.defending.uuid,
      operationId: s.operationId,
      opponentUuid: s.defenderUuid,
      weaponUuid: weapon.uuid,
      penalty: 4,
      attackAction: "standard",
      combat: structuredClone(clock),
      ...(row.acting.flags.spycraft2.tripAttack.version === 2
        ? { activeCombatantId: row.acting.flags.spycraft2.tripAttack.counterTrip.activeCombatantId }
        : {})
    };
  currentTiming(actor, proof);
  const options = await completeCharacterTarget(
    actor,
    weapon.system,
    {
      ...knownCharacterTargetInput(target.uuid, finalAttackOptions(input)),
      attackAction: "standard",
      freeFinalAttack: true
    },
    { fixedTargetUuid: target.uuid, fixedTargetName: target.name }
  );
  if (!options) return null;
  return actor.useLimitedAbility(
    "tripFinalAttack",
    async () => {
      if (row.acting.flags.spycraft2.tripFinalUse)
        throw Error(loc`This critical Trip opportunity was already reserved.`);
      tripFinalSource(actor, row.acting);
      currentTiming(actor, proof);
      const lease = {};
      leases.set(lease, { actor, id: proof.id });
      active.add(proof.id);
      const posted = () =>
        [...game.messages].find(
          m => m.flags?.spycraft2?.actorUuid === actor.uuid && m.flags.spycraft2.finalAttack?.id === proof.id
        );
      try {
        await row.acting.update({ "flags.spycraft2.tripFinalUse": { id: proof.id, state: "reserved", proof } });
        const validate = () =>
          validateTripFinalAttackProof(actor, proof, {
            checkKind: "attack",
            weaponUuid: weapon.uuid,
            attackContext: { attackAction: "standard", targetActorUuid: target.uuid },
            lease
          });
        const result = await postFinalAttack(actor, weapon.id, { ...options, tripFinalLease: lease }, proof, validate);
        try {
          await row.acting.update({
            "flags.spycraft2.tripFinalUse": { id: proof.id, state: "posted", proof, messageUuid: result.uuid }
          });
        } catch {
          ui.notifications.warn(loc`Trip final attack posted; its source stamp needs GC review.`);
        }
        return result;
      } catch (error) {
        const found = posted();
        if (found) return found;
        try {
          if (row.acting.flags.spycraft2.tripFinalUse?.id === proof.id)
            await row.acting.unsetFlag("spycraft2", "tripFinalUse");
        } catch (cleanup) {
          throw new AggregateError([error, cleanup], loc`The unused Trip final attack needs GC review.`);
        }
        throw error;
      } finally {
        leases.delete(lease);
        active.delete(proof.id);
      }
    },
    { workflow: "tripFinalAttack", messages: [row.acting, row.defending] }
  );
}
export async function reviewTripFinalAttack(actor, input = {}) {
  if (!actor.isOwner || game.user.isGM !== true)
    throw Error(loc`The owning GC reviews interrupted Trip final attacks.`);
  if (!Object.hasOwn(input, "sourceMessage")) {
    const esc = foundry.utils.escapeHTML,
      ms = [...game.messages].filter(
        m =>
          m.flags?.spycraft2?.actorUuid === actor.uuid &&
          m.flags.spycraft2.tripFinalUse &&
          m.visible !== false &&
          m.isContentVisible !== false
      );
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Review interrupted Trip final attack` },
      rejectClose: false,
      content:
        `<div class="spycraft2-roll-options"><p>${loc`Recover any interrupted resource lock first. A posted attack retains its spent opportunity and shared final-attack count. If no attack exists, closing the unused opportunity preserves its current resource history and authorizes no new roll.`}</p><label>${loc`Critical Trip`} <select name="sourceMessage">` +
        ms
          .map(
            m =>
              '<option value="' +
              esc(m.uuid) +
              '">' +
              esc(
                attackCharacterTargetChoices().find(a => a.uuid === m.flags.spycraft2.tripSettlement?.defenderUuid)
                  ?.name ?? "Recorded opponent"
              ) +
              " · round " +
              m.flags.spycraft2.tripSettlement.round +
              "</option>"
          )
          .join("") +
        `</select></label><label><input name="confirmed" type="checkbox" /> ${loc`No client is executing this attempt; I reviewed its actual receipts and resource history`}</label><label><input name="closeUnused" type="checkbox" /> ${loc`If no attack exists, close the unused opportunity without releasing a new roll`}</label></div>`
    });
    if (!input) return null;
  }
  if (input.confirmed !== true)
    throw Error(loc`The owning GC must confirm that no client is still executing this interrupted Trip final attack.`);
  const row = tripFinalSource(actor, message(input.sourceMessage)),
    use = row.acting.flags.spycraft2.tripFinalUse;
  if (!use || active.has(use.id)) throw Error(loc`Choose an interrupted, inactive Trip final attack.`);
  return queueResources(
    [actor],
    async () => {
      const current = tripFinalSource(actor, row.acting).acting.flags.spycraft2.tripFinalUse;
      if (current?.id !== use.id || active.has(use.id)) throw Error(loc`The interrupted Trip attempt changed.`);
      const posted = [...game.messages].filter(
        m =>
          m.flags?.spycraft2?.actorUuid === actor.uuid &&
          m.flags.spycraft2.finalAttack?.source === "trip" &&
          m.flags.spycraft2.finalAttack.id === use.id &&
          !m.flags.spycraft2.rerollOf
      );
      if (posted.length > 1) throw Error(loc`Multiple Trip attack receipts require GC review.`);
      if (posted[0]) {
        if (stable(posted[0].flags.spycraft2.finalAttack) !== stable(use.proof))
          throw Error(loc`The posted Trip final attack does not match its reserved proof.`);
        await row.acting.update({
          "flags.spycraft2.tripFinalUse": { ...use, state: "posted", messageUuid: posted[0].uuid }
        });
        return { messageUuid: posted[0].uuid };
      }
      if (input.closeUnused !== true)
        throw Error(
          loc`No posted attack is proven. Explicitly close this unused opportunity after reviewing its resource history; no new roll was authorized.`
        );
      await row.acting.update({ "flags.spycraft2.tripFinalUse": { ...use, state: "closed", gcReviewed: true } });
      return { closed: true, newRollAuthorized: false };
    },
    { messages: [row.acting, row.defending] }
  );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "tripFinalAttack",
  order: 1060,
  record: ["finalAttack"],
  validate: ({ actor, options, checkKind, weaponUuid }) =>
    validateTripFinalAttackProof(actor, options.finalAttack, {
      checkKind,
      weaponUuid,
      attackContext: options.attackContext,
      lease: options.tripFinalLease,
      rerollOf: options.rerollOf
    })
});
