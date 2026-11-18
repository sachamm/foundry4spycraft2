import { reconcilePowerStanceInitiative } from "./power-stance.mjs";
import { validateCounterTripReceipt, tripActiveCombatantId } from "./counter-trip.mjs";
import { tripOutcomePlan } from "../rules/trip-outcomes.mjs";
import { queueResources } from "../rules/transactions.mjs";
import { rollEvidence } from "../rules/outcomes.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { endCombatStance } from "./combat-stance.mjs";
import { attackCharacterTargetChoices } from "./character-target.mjs";
const stable = v =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x
  );
const evidence = (a, d) => [a, d].map(m => JSON.parse(rollEvidence(m.flags.spycraft2)));
const visible = m => m && m.visible !== false && m.isContentVisible !== false && (!m.blind || game.user.isGM);
function participants(actor, a, d) {
  const opponent = attackCharacterTargetChoices().find(x => x.uuid === a?.flags?.spycraft2?.tripAttack?.opponentUuid);
  if (
    !actor.isOwner ||
    !opponent?.isOwner ||
    actor.uuid === opponent.uuid ||
    a.flags?.spycraft2?.actorUuid !== actor.uuid ||
    d?.flags?.spycraft2?.actorUuid !== opponent.uuid ||
    ![a, d].every(m => visible(m) && game.messages.get(m.id) === m)
  )
    throw Error("An owner of both actual Trip participants must choose their visible recorded checks.");
  return opponent;
}
function savedOutcome(a, d) {
  const x = a.flags.spycraft2.tripSettlement,
    y = d.flags.spycraft2.tripSettlement;
  if (!x && !y) return null;
  const rows = [x, y].filter(Boolean);
  for (const r of rows)
    if (
      ![1, 2, 3, 4].includes(r.version) ||
      !["prepared", "applied"].includes(r.state) ||
      r.sourceMessage !== a.uuid ||
      r.defenderMessage !== d.uuid ||
      stable(r.sourceEvidence) !== stable(evidence(a, d))
    )
      throw Error("This Trip receipt is already bound to another pair or changed evidence; ask the GC to review.");
  for (const r of rows) {
    const plan = tripOutcomePlan(a.flags.spycraft2, d.flags.spycraft2, {
      attackerUuid: a.flags.spycraft2.actorUuid,
      defenderUuid: d.flags.spycraft2.actorUuid,
      combat: a.flags.spycraft2.tripAttack.combat,
      tieResolvedConfirmed: r.tieResolved,
      allowCriticalAttackerWin: [2, 4].includes(r.version),
      allowCriticalCounter: [3, 4].includes(r.version),
      activeCombatantId: a.flags.spycraft2.tripAttack?.counterTrip?.activeCombatantId
    });
    if (
      Object.entries(plan).some(([k, v]) => stable(r[k]) !== stable(v)) ||
      typeof r.wasCondition !== "boolean" ||
      typeof r.operationId !== "string" ||
      !r.operationId
    )
      throw Error("The saved Trip outcome fields are malformed; ask the GC to review.");
  }
  const core = r => {
    const c = { ...r };
    for (const k of ["state", "effectId", "conditionChanged", "recovered", "gcReviewed", "resolution"]) delete c[k];
    return c;
  };
  if (rows.length === 2 && stable(core(x)) !== stable(core(y)))
    throw Error("The saved Trip pair has conflicting outcome records.");
  return rows.find(r => r.state === "applied") ?? rows[0];
}
async function finishSprawledExit(actor) {
  if (!actor.statuses.has("sprawled")) return;
  if (actor.system.combatStance) await endCombatStance(actor, actor.system.combatStance.id);
  await reconcilePowerStanceInitiative(actor);
}
async function stamp(a, d, prepared, result = {}) {
  if (stable(prepared.sourceEvidence) !== stable(evidence(a, d)))
    throw Error("Trip receipts changed during settlement; retain the condition for GC review.");
  const final = { ...prepared, ...result, state: "applied" };
  for (const m of [a, d]) await m.update({ "flags.spycraft2.tripSettlement": final });
  return final;
}
export async function settleTripOutcome(actor, a, d, input = {}) {
  const opponent = participants(actor, a, d);
  if (a.flags.spycraft2.tripAttack?.version === 2) validateCounterTripReceipt(actor, a);
  if (input.opposedConfirmed !== true) throw Error("Confirm these checks belong to the same ordinary opposed Trip.");
  return queueResources(
    [actor, opponent],
    async () => {
      participants(actor, a, d);
      if (a.flags.spycraft2.tripAttack?.version === 2) validateCounterTripReceipt(actor, a);
      const saved = savedOutcome(a, d),
        target = () => (saved?.conditionActorUuid === actor.uuid ? actor : opponent);
      if (saved) {
        if (saved.state === "applied") return stamp(a, d, saved);
        const t = target(),
          effect = [...t.effects].find(
            e => e.flags?.spycraft2?.conditionOperation === saved.operationId && e.statuses.has(saved.condition)
          );
        if (!saved.wasCondition && !effect)
          throw Error(
            "The interrupted Trip condition needs explicit GC review; it may already have ended. Do not refresh it automatically."
          );
        if (saved.condition === "sprawled") await finishSprawledExit(t);
        return stamp(a, d, saved, { recovered: true });
      }
      const plan = tripOutcomePlan(a.flags.spycraft2, d.flags.spycraft2, {
          attackerUuid: actor.uuid,
          defenderUuid: opponent.uuid,
          combat: actor.mentalLeapCombatContext(),
          tieResolvedConfirmed: input.tieResolvedConfirmed,
          allowCriticalAttackerWin: true,
          allowCriticalCounter: true,
          activeCombatantId: tripActiveCombatantId(actor)
        }),
        t = plan.conditionActorUuid === actor.uuid ? actor : opponent,
        prepared = {
          ...plan,
          sourceMessage: a.uuid,
          defenderMessage: d.uuid,
          sourceEvidence: evidence(a, d),
          operationId: "trip-" + foundry.utils.randomID(),
          wasCondition:
            t.statuses.has(plan.condition) || (plan.condition === "flat-footed" && t.statuses.has("flatFooted")),
          state: "prepared"
        };
      // Persist both reservations before the external effect. An uncertain interrupted effect requires GC review.
      for (const m of [a, d]) await m.update({ "flags.spycraft2.tripSettlement": prepared });
      const effect = await setConditionStatus(t, plan.condition, true, {
        label: plan.condition === "sprawled" ? "Sprawled" : "Flat-footed",
        aliases: plan.condition === "flat-footed" ? ["flatFooted"] : [],
        operationId: prepared.operationId
      });
      if (plan.condition === "sprawled") await finishSprawledExit(t);
      return stamp(a, d, prepared, {
        conditionChanged: effect.changed,
        ...(effect.effectId ? { effectId: effect.effectId } : {})
      });
    },
    { messages: [a, d] }
  );
}
export async function reviewTripOutcome(actor, a, d, { confirmed = false, resolution } = {}) {
  const opponent = participants(actor, a, d);
  if (game.user.isGM !== true || confirmed !== true || !["alreadyApplied", "applyPending"].includes(resolution))
    throw Error(
      "The owning GC must review the interrupted Trip and choose whether its condition already occurred or is still pending."
    );
  return queueResources(
    [actor, opponent],
    async () => {
      participants(actor, a, d);
      if (a.flags.spycraft2.tripAttack?.version === 2) validateCounterTripReceipt(actor, a);
      const saved = savedOutcome(a, d);
      if (!saved || saved.state !== "prepared") throw Error("Choose a matching interrupted prepared Trip pair.");
      const t = saved.conditionActorUuid === actor.uuid ? actor : opponent;
      let effect = { changed: false };
      if (resolution === "applyPending")
        effect = await setConditionStatus(t, saved.condition, true, {
          operationId: saved.operationId,
          aliases: saved.condition === "flat-footed" ? ["flatFooted"] : []
        });
      if (saved.condition === "sprawled") await finishSprawledExit(t);
      return stamp(a, d, saved, {
        gcReviewed: true,
        resolution,
        conditionChanged: effect.changed,
        ...(effect.effectId ? { effectId: effect.effectId } : {})
      });
    },
    { messages: [a, d] }
  );
}
export async function manageTripOutcomes(actor, input = {}) {
  if (!actor.isOwner) return null;
  if (!Object.hasOwn(input, "actingMessage")) {
    const esc = foundry.utils.escapeHTML,
      ms = [...game.messages].filter(visible),
      acting = ms.filter(
        m =>
          m.flags?.spycraft2?.actorUuid === actor.uuid &&
          [1, 2].includes(m.flags.spycraft2.tripAttack?.version) &&
          m.flags.spycraft2.resolved &&
          !m.flags.spycraft2.superseded
      ),
      defending = ms.filter(
        m =>
          m.flags?.spycraft2?.tripDefense?.version === 3 && m.flags.spycraft2.resolved && !m.flags.spycraft2.superseded
      ),
      options = xs =>
        xs
          .map(m => {
            const c = m.flags.spycraft2,
              p = c.tripAttack ?? c.tripDefense;
            return (
              '<option value="' +
              esc(m.uuid) +
              '">' +
              esc(attackCharacterTargetChoices().find(a => a.uuid === c.actorUuid)?.name ?? "Recorded character") +
              " · round " +
              p.combat.round +
              " · result " +
              c.effectiveTotal +
              "</option>"
            );
          })
          .join("");
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "Trip outcome" },
      rejectClose: false,
      content:
        '<div class="spycraft2-roll-options"><p>Finish both opposed checks in chat and mark one winner and one loser. Ordinary settlement applies sprawled to a losing defender or flat-footed to a losing attacker. Select actual reciprocal participant cards. A winning attacker’s critical success or losing defender’s critical failure earns one Trip final attack at−4 after settlement. Use Trip final attack immediately. A critical defensive win earns one free counter-Trip through Main’s Counter-Trip control. The second Trip cannot grant a third; its winning attacking critical may still earn one final attack. Weapon TRP remains separate.</p><label>Attacking Trip <select name="actingMessage">' +
        options(acting) +
        '</select></label><label>Resist Trip <select name="defendingMessage">' +
        options(defending) +
        '</select></label><label><input type="checkbox" name="opposedConfirmed" /> These are the same opposed Trip or earned counter-Trip</label><label><input type="checkbox" name="tieResolvedConfirmed" /> Equal totals and skill bonuses: the GC used the p.91 random 1d20 tie-break</label>' +
        (game.user.isGM
          ? '<label>Interrupted outcome review <select name="reviewResolution"><option value="">Normal settlement / recovery</option><option value="alreadyApplied">Condition already occurred; preserve any later recovery</option><option value="applyPending">Condition still needs to be applied</option></select></label><label><input type="checkbox" name="reviewConfirmed" /> I reviewed the actual condition history and interrupted paired receipts</label>'
          : "") +
        "</div>"
    });
    if (!input) return null;
  }
  const a = await fromUuid(input.actingMessage),
    d = await fromUuid(input.defendingMessage);
  return input.reviewResolution
    ? reviewTripOutcome(actor, a, d, { confirmed: input.reviewConfirmed, resolution: input.reviewResolution })
    : settleTripOutcome(actor, a, d, input);
}

/** Read-only earned source, without copying opposed die totals into another attack receipt. */
export function tripFinalSource(actor, message) {
  const a = message;
  if (a?.flags?.spycraft2?.tripAttack?.version === 2) validateCounterTripReceipt(actor, a);
  const d = globalThis.fromUuidSync?.(a?.flags?.spycraft2?.tripSettlement?.defenderMessage);
  if (
    !actor.isOwner ||
    a?.flags?.spycraft2?.actorUuid !== actor.uuid ||
    ![a, d].every(m => visible(m) && game.messages.get(m.id) === m)
  )
    throw Error("Choose your actual visible critical Trip pair.");
  const saved = savedOutcome(a, d);
  if (
    saved?.state !== "applied" ||
    ![2, 4].includes(saved.version) ||
    saved.criticalOpportunity !== "finalAttack" ||
    saved.attackerUuid !== actor.uuid ||
    saved.finalAttackPenalty !== 4
  )
    throw Error("Settle the actual winning critical Trip before taking its final attack.");
  return { acting: a, defending: d, settlement: saved };
}

export function counterTripSource(actor, defending) {
  const acting = globalThis.fromUuidSync?.(defending?.flags?.spycraft2?.tripSettlement?.sourceMessage);
  if (
    !actor.isOwner ||
    defending?.flags?.spycraft2?.actorUuid !== actor.uuid ||
    ![acting, defending].every(m => visible(m) && game.messages.get(m.id) === m)
  )
    throw Error("Choose your actual visible settled critical Trip defense.");
  const saved = savedOutcome(acting, defending);
  if (
    saved?.state !== "applied" ||
    saved.version !== 3 ||
    saved.criticalOpportunity !== "counterTrip" ||
    saved.counterTripDepth !== 0 ||
    saved.defenderUuid !== actor.uuid
  )
    throw Error(
      "Only the original critical defender win earns a free counter-Trip; the second Trip never grants a third."
    );
  return { acting, defending, settlement: saved };
}
