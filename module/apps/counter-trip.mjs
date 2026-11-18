import { counterTripSource } from "./trip-outcomes.mjs";
import { queueRuleState } from "./rule-resource-scope.mjs";
import { validOwnCountClock } from "../rules/own-count-duration.mjs";
import { responseOwnSize, tripSizeIndex } from "../rules/trip.mjs";
import { attackCharacterTargetChoices } from "./character-target.mjs";
const leases = new WeakMap(),
  active = new Set(),
  stable = v =>
    JSON.stringify(v, (_k, x) =>
      x && typeof x === "object" && !Array.isArray(x)
        ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
        : x
    ),
  message = uuid => globalThis.fromUuidSync?.(uuid);
const change = (actor, row, work) => queueRuleState(actor, work, { messages: [row.acting, row.defending] });
export function tripActiveCombatantId(actor) {
  const c = actor.participatingCombat,
    clock = actor.mentalLeapCombatContext();
  return c?.started && c.id === clock?.id ? (c.turns?.[clock.turn]?.id ?? null) : null;
}
function source(actor, facts) {
  const row = counterTripSource(actor, message(facts?.defenderMessage)),
    s = row.settlement,
    expected = {
      version: 1,
      id: facts?.id,
      sourceMessage: row.acting.uuid,
      defenderMessage: row.defending.uuid,
      operationId: s.operationId,
      actorUuid: actor.uuid,
      targetUuid: s.attackerUuid,
      activeCombatantId: row.acting.flags.spycraft2.tripAttack.combat.combatantId,
      depth: 1
    };
  if (typeof facts?.id !== "string" || !facts.id || stable(facts) !== stable(expected))
    throw Error("The earned counter-Trip source or reciprocal participants changed.");
  const use = row.defending.flags.spycraft2.tripCounterUse;
  if (
    !use ||
    use.id !== facts.id ||
    stable(use.counter) !== stable(facts) ||
    !["reserved", "posted"].includes(use.state)
  )
    throw Error("Reserve this actual earned counter-Trip through its control.");
  return { ...row, use };
}
function timing(actor, row) {
  const c = actor.mentalLeapCombatContext(),
    p = row.acting.flags.spycraft2.tripAttack.combat,
    q = row.defending.flags.spycraft2.tripDefense.combat;
  if (
    !validOwnCountClock(c) ||
    c.id !== p.id ||
    c.round !== p.round ||
    c.combatantId !== q.combatantId ||
    tripActiveCombatantId(actor) !== p.combatantId
  )
    throw Error("Take the free counter-Trip immediately during its original active participant’s Count.");
}
export function validateTripCounterIntent(actor, facts, lease) {
  const row = source(actor, facts);
  if (!lease || leases.get(lease)?.actor !== actor || leases.get(lease)?.id !== facts.id)
    throw Error("Use the earned counter-Trip control; a free-action declaration cannot create its source.");
  timing(actor, row);
  return row;
}
export function validateCounterTripReceipt(actor, m) {
  const c = m?.flags?.spycraft2,
    p = c?.tripAttack;
  if (
    c?.actorUuid !== actor.uuid ||
    c.checkKind !== "skill" ||
    c.checkId !== "counter-trip" ||
    p?.version !== 2 ||
    game.messages.get(m.id) !== m
  )
    throw Error("Use the actual recorded counter-Trip receipt.");
  const row = source(actor, p.counterTrip),
    roots = [...game.messages].filter(
      m =>
        m.flags?.spycraft2?.actorUuid === actor.uuid &&
        m.flags.spycraft2.checkId === "counter-trip" &&
        !m.flags.spycraft2.rerollOf &&
        stable(m.flags.spycraft2.tripAttack?.counterTrip) === stable(p.counterTrip)
    );
  if (roots.length !== 1 || (row.use.messageUuid && row.use.messageUuid !== roots[0].uuid))
    throw Error("The reserved counter-Trip original root needs GC review.");
  let current = m;
  const seen = new Set();
  while (current && !seen.has(current.uuid)) {
    seen.add(current.uuid);
    const x = current.flags?.spycraft2;
    if (x?.actorUuid !== actor.uuid || stable(x.tripAttack) !== stable(p)) break;
    if (current.uuid === roots[0].uuid) return row;
    current = message(x.rerollOf);
  }
  throw Error("This check does not descend from the actual reserved counter-Trip.");
}
export function validateTripCounterProof(actor, proof, { checkKind, skillKey, checkId, lease, rerollOf } = {}) {
  if (proof?.version !== 2) return;
  if (
    checkKind !== "skill" ||
    skillKey !== "acrobatics" ||
    checkId !== "counter-trip" ||
    proof.opponentUuid !== proof.counterTrip?.targetUuid
  )
    throw Error("The earned counter-Trip must use its actual opposed Acrobatics role and original opponent.");
  if (rerollOf) {
    const m = message(rerollOf),
      c = m?.flags?.spycraft2;
    if (c?.resolved || c?.superseded || stable(c?.tripAttack) !== stable(proof))
      throw Error("Replace the actual owned unresolved counter-Trip.");
    validateCounterTripReceipt(actor, m);
    return;
  }
  validateTripCounterIntent(actor, proof.counterTrip, lease);
}
const posted = (actor, id) =>
  [...game.messages].filter(
    m =>
      m.flags?.spycraft2?.actorUuid === actor.uuid &&
      m.flags.spycraft2.checkId === "counter-trip" &&
      m.flags.spycraft2.tripAttack?.counterTrip?.id === id &&
      !m.flags.spycraft2.rerollOf
  );
export async function takeCounterTrip(actor, input = {}) {
  if (!actor.isOwner || actor.type !== "agent") return null;
  if (!Object.hasOwn(input, "immediateConfirmed")) {
    const esc = foundry.utils.escapeHTML,
      ms = [...game.messages].filter(
        m =>
          m.flags?.spycraft2?.actorUuid === actor.uuid &&
          m.flags.spycraft2.tripDefense?.version === 3 &&
          m.flags.spycraft2.tripSettlement?.defenderUuid === actor.uuid &&
          m.flags.spycraft2.tripSettlement?.version === 3 &&
          m.flags.spycraft2.tripSettlement.criticalOpportunity === "counterTrip" &&
          m.flags.spycraft2.tripSettlement.state === "applied" &&
          m.visible !== false &&
          m.isContentVisible !== false &&
          (!m.blind || game.user.isGM)
      );
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "Earned free counter-Trip" },
      rejectClose: false,
      content:
        '<div class="spycraft2-roll-options"><p>Use the free Trip earned by a critical defensive win against the original attacker. This is a free action during the original participant’s Count, not a new half action. Ordinary adjacency, Size, Acrobatics/DEX, Armor Check Penalty and action error+1 still apply. The second Trip cannot grant a third Trip.</p><label>Settled critical defense <select name="sourceMessage">' +
        ms
          .map(
            m =>
              '<option value="' +
              esc(m.uuid) +
              '">' +
              esc(
                attackCharacterTargetChoices().find(a => a.uuid === m.flags.spycraft2.tripSettlement.attackerUuid)
                  ?.name ?? "Original attacker"
              ) +
              " · round " +
              m.flags.spycraft2.tripSettlement.round +
              "</option>"
          )
          .join("") +
        '</select></label><label>My Size categories minus the original attacker’s <input name="tripAttackSizeDifference" type="number" min="-1" max="11" step="1" required /></label><label><input name="tripAttackAdjacent" type="checkbox" /> The original attacker is still adjacent</label><label><input name="tripAttackParticipantsConfirmed" type="checkbox" /> The GC confirms both actual Sizes and a legal free counter-Trip</label><label><input name="immediateConfirmed" type="checkbox" /> This immediately follows that Trip with no intervening action</label></div>'
    });
    if (!input) return null;
  }
  if (input.immediateConfirmed !== true) throw Error("Confirm the immediate earned counter-Trip.");
  const row = counterTripSource(actor, message(input.sourceMessage)),
    expectedSource = stable(row.settlement),
    prepared = await change(actor, row, async () => {
      const fresh = counterTripSource(actor, row.defending),
        prior = fresh.defending.flags.spycraft2.tripCounterUse;
      if (prior) return { existing: prior };
      if (stable(fresh.settlement) !== expectedSource)
        throw Error(
          "The critical Trip source changed while preparing its free counter; confirm the current result again."
        );
      timing(actor, fresh);
      const target = attackCharacterTargetChoices().find(a => a.uuid === fresh.settlement.attackerUuid);
      if (!target) throw Error("The original attacker is no longer an observed opposing character.");
      const own = tripSizeIndex(responseOwnSize(actor.system)),
        other = tripSizeIndex(responseOwnSize(target.system)),
        difference = input.tripAttackSizeDifference ?? (own >= 0 && other >= 0 ? own - other : null),
        facts = {
          version: 1,
          id: foundry.utils.randomID(),
          sourceMessage: fresh.acting.uuid,
          defenderMessage: fresh.defending.uuid,
          operationId: fresh.settlement.operationId,
          actorUuid: actor.uuid,
          targetUuid: target.uuid,
          activeCombatantId: fresh.acting.flags.spycraft2.tripAttack.combat.combatantId,
          depth: 1
        };
      await fresh.defending.update({
        "flags.spycraft2.tripCounterUse": { id: facts.id, state: "reserved", counter: facts }
      });
      return { facts, difference, targetUuid: target.uuid, targetName: target.name };
    });
  if (!prepared) return null;
  if (prepared.existing) {
    const found = posted(actor, prepared.existing.id);
    if (found.length === 1) {
      validateCounterTripReceipt(actor, found[0]);
      return found[0];
    }
    throw Error("This counter-Trip is already reserved or needs GC review; do not roll it again.");
  }
  const { facts, difference } = prepared,
    target = { uuid: prepared.targetUuid, name: prepared.targetName },
    lease = {};
  leases.set(lease, { actor, id: facts.id });
  active.add(facts.id);
  try {
    const result = await actor.rollSkill("acrobatics", "dex", {
      ...input,
      check: "counter-trip",
      gearStatus: "available",
      synergySkill: input.synergySkill ?? "none",
      tripAttackOpponentUuid: target.uuid,
      tripAttackOpponentName: target.name,
      tripAttackSizeDifference: difference,
      tripAttackHalfActionConfirmed: false,
      tripCounter: facts,
      tripCounterLease: lease
    });
    const roots = posted(actor, facts.id),
      m = roots.length === 1 ? roots[0] : null;
    if (!result || !m) throw Error("The earned counter-Trip was cancelled or did not post a unique original result.");
    try {
      await change(actor, row, async () => {
        source(actor, facts);
        await row.defending.update({
          "flags.spycraft2.tripCounterUse": { id: facts.id, state: "posted", counter: facts, messageUuid: m.uuid }
        });
      });
    } catch {
      ui.notifications.warn("Counter-Trip posted; its source stamp needs GC review.");
    }
    return m;
  } catch (error) {
    const roots = posted(actor, facts.id);
    if (roots.length === 1) return roots[0];
    try {
      await change(actor, row, async () => {
        if (row.defending.flags.spycraft2.tripCounterUse?.id === facts.id)
          await row.defending.unsetFlag("spycraft2", "tripCounterUse");
      });
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], "The unused counter-Trip needs GC review.");
    }
    throw error;
  } finally {
    leases.delete(lease);
    active.delete(facts.id);
  }
}
export async function reviewCounterTrip(actor, input = {}) {
  if (!actor.isOwner || game.user.isGM !== true) throw Error("The owning GC reviews an interrupted counter-Trip.");
  if (!Object.hasOwn(input, "sourceMessage")) {
    const esc = foundry.utils.escapeHTML,
      ms = [...game.messages].filter(
        m =>
          m.flags?.spycraft2?.actorUuid === actor.uuid &&
          m.flags.spycraft2.tripCounterUse &&
          m.visible !== false &&
          m.isContentVisible !== false
      );
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "Review interrupted counter-Trip" },
      rejectClose: false,
      content:
        '<div class="spycraft2-roll-options"><p>Recover any interrupted resource lock first. Reattach a unique posted counter-Trip without rolling again. If no result exists, review its original skill-payment transaction. You may close the unused opportunity while preserving resource history and authorizing no new roll.</p><label>Original critical defense <select name="sourceMessage">' +
        ms
          .map(
            m =>
              '<option value="' +
              esc(m.uuid) +
              '">' +
              esc(
                attackCharacterTargetChoices().find(a => a.uuid === m.flags.spycraft2.tripSettlement.attackerUuid)
                  ?.name ?? "Original attacker"
              ) +
              " · round " +
              m.flags.spycraft2.tripSettlement.round +
              "</option>"
          )
          .join("") +
        '</select></label><label><input name="confirmed" type="checkbox" /> No client is executing the attempt; I reviewed the original skill receipts and payments</label><label><input name="closeUnused" type="checkbox" /> If no result exists, close the unused opportunity without granting a new roll</label></div>'
    });
    if (!input) return null;
  }
  if (input.confirmed !== true)
    throw Error("The owning GC must review this inactive interrupted counter-Trip and its actual receipts.");
  const row = counterTripSource(actor, message(input.sourceMessage)),
    use = row.defending.flags.spycraft2.tripCounterUse;
  if (!use || active.has(use.id)) throw Error("Choose an interrupted counter-Trip no client is executing.");
  return change(actor, row, async () => {
    const current = counterTripSource(actor, row.defending).defending.flags.spycraft2.tripCounterUse;
    if (current?.id !== use.id || active.has(use.id)) throw Error("The interrupted counter-Trip changed.");
    const roots = posted(actor, use.id);
    if (!roots.length && input.closeUnused === true) {
      await row.defending.update({ "flags.spycraft2.tripCounterUse": { ...use, state: "closed", gcReviewed: true } });
      return { closed: true, newRollAuthorized: false };
    }
    if (roots.length !== 1)
      throw Error(
        "No unique posted counter-Trip is proven; review its skill-payment transaction or explicitly close the unused opportunity before any new roll."
      );
    validateCounterTripReceipt(actor, roots[0]);
    await row.defending.update({
      "flags.spycraft2.tripCounterUse": { ...use, state: "posted", messageUuid: roots[0].uuid }
    });
    return { messageUuid: roots[0].uuid };
  });
}
