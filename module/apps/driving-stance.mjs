import {
  stableDriving as stable,
  drivingPenalty,
  drivingMessages,
  drivingHit,
  drivingFacts,
  drivingRows,
  validateDrivingSource,
  currentDrivingReceipt
} from "../rules/driving-stance.mjs";
import { queueRuleState } from "./rule-resource-scope.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
const leases = new WeakMap(),
  active = new Map(),
  key = (a, id) => a.uuid + ":" + id;
async function write(actor, rows) {
  try {
    await actor.update({ "flags.spycraft2.drivingStanceUses": rows });
  } catch (e) {
    if (stable(actor.flags?.spycraft2?.drivingStanceUses) !== stable(rows)) throw e;
  }
  if (stable(actor.flags?.spycraft2?.drivingStanceUses) !== stable(rows))
    throw Error("Review the saved Driving Stance outcome before retrying.");
}
const find = (actor, p) => {
  const r = drivingRows(actor).find(r => r.id === p?.outcomeId);
  if (!r || stable(r.proof) !== stable(p)) throw Error("The Driving Stance outcome reservation changed.");
  return r;
};
export function validateDrivingDamageProof(
  actor,
  proof,
  { checkKind, checkId, checkMethod, formula, data, weaponUuid, lease, rerollOf } = {}
) {
  if (!proof) return;
  const row = find(actor, proof);
  validateDrivingSource(actor, proof);
  if (
    proof.outcome !== "blocked" ||
    checkKind !== "damage" ||
    checkId !== "drivingStance" ||
    checkMethod !== "roll" ||
    formula !== proof.damageFormula ||
    Object.keys(data ?? {}).length ||
    weaponUuid
  )
    throw Error("Roll only the reserved Driving Stance 1d4 subdual component, without weapon bonuses.");
  if (rerollOf) {
    const m = currentDrivingReceipt(actor, row),
      c = m?.flags?.spycraft2;
    if (!row.receiptUuid || m?.uuid !== rerollOf || c.resolved || c.superseded)
      throw Error("Use the current owned unresolved Driving Stance damage for its replacement.");
    return;
  }
  if (drivingPenalty(actor) !== proof.damagePenalty)
    throw Error("The damage condition changed before the Driving Stance roll posted.");
  const held = lease && leases.get(lease);
  if (row.receiptUuid || held?.actor !== actor || held.id !== row.id)
    throw Error("Reserve the blocked Driving Stance outcome through its actual hit.");
}
function factsFor(actor, reference, input) {
  const facts = drivingFacts(actor, reference, input),
    prior = drivingRows(actor).find(r => r.proof.rootAttackUuid === facts.rootAttackUuid);
  if (prior) {
    validateDrivingSource(actor, prior.proof);
    if (facts.outcome === "blocked") {
      facts.damagePenalty = prior.proof.damagePenalty;
      facts.damageFormula = prior.proof.damageFormula;
    }
  }
  return facts;
}
export async function settleDrivingStance(actor, reference, input = {}) {
  const facts = factsFor(actor, reference, input),
    reserved = await queueRuleState(actor, async () => {
      if (stable(factsFor(actor, reference, input)) !== stable(facts))
        throw Error("The Driving Stance outcome changed before reservation.");
      const rows = drivingRows(actor),
        prior = rows.find(r => r.proof.rootAttackUuid === facts.rootAttackUuid);
      if (prior) {
        const { outcomeId, ...old } = prior.proof;
        if (stable(old) !== stable(facts)) throw Error("This hit already has a different Driving Stance outcome.");
        if (prior.receiptUuid) {
          const m = currentDrivingReceipt(actor, prior);
          if (!m) throw Error("Review the missing original Driving Stance receipt.");
          return { existing: m };
        }
        throw Error("This hit has an interrupted Driving Stance outcome awaiting GC review.");
      }
      const id = foundry.utils.randomID(),
        row = { version: 1, id, proof: { ...facts, outcomeId: id }, receiptUuid: null };
      await write(actor, [...rows, row]);
      return { row };
    });
  if (reserved.existing) return reserved.existing;
  const r = reserved.row,
    p = r.proof,
    lease = {};
  leases.set(lease, { actor, id: r.id });
  active.set(key(actor, r.id), lease);
  const stamp = receipt =>
    queueRuleState(actor, async () => {
      const rows = drivingRows(actor),
        current = find(actor, p);
      if (current.receiptUuid && current.receiptUuid !== receipt?.uuid)
        throw Error("The original Driving Stance receipt changed.");
      await write(
        actor,
        receipt
          ? rows.map(x => (x.id === r.id ? { ...x, receiptUuid: receipt.uuid } : x))
          : rows.filter(x => x.id !== r.id)
      );
    });
  try {
    validateDrivingSource(actor, p);
    let receipt;
    if (p.outcome === "blocked")
      receipt = await actor.rollCheck(
        p.damageFormula,
        {},
        {
          conditionDamageIncluded: true,
          checkKind: "damage",
          checkId: "drivingStance",
          threat: 0,
          error: 0,
          drivingStance: p,
          drivingStanceLease: lease,
          rollMode: p.visibility.blind ? "blindroll" : p.visibility.whisper.length ? "gmroll" : "publicroll",
          flavor:
            "Driving Stance: occupied or blocked destination — 1d4 subdual, without weapon damage bonuses (p.179). Resolve defenses and health separately."
        }
      );
    else
      receipt = await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        blind: p.visibility.blind,
        whisper: p.visibility.whisper,
        content:
          "Driving Stance (p.179): push the recorded opponent 5 ft. away." +
          (p.followFeet ? " Follow 5 ft. toward that opponent." : " Declined the optional 5 ft. follow.") +
          " The GC resolves these reviewed positions at the table; this receipt does not move tokens.",
        flags: {
          spycraft2: { actorUuid: actor.uuid, checkKind: "drivingStance", actionDiceAllowed: false, drivingStance: p }
        }
      });
    const posted = currentDrivingReceipt(actor, find(actor, p));
    if (receipt && !posted) throw Error("The actual Driving Stance outcome posted no matching receipt.");
    await stamp(posted);
    return posted ?? receipt;
  } catch (error) {
    let receipt;
    try {
      receipt = currentDrivingReceipt(actor, find(actor, p));
      await stamp(receipt);
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        "Driving Stance needs GC review; inspect the existing result before retrying."
      );
    }
    if (receipt) return receipt;
    throw error;
  } finally {
    leases.delete(lease);
    active.delete(key(actor, r.id));
  }
}
export async function reviewDrivingStance(actor, { outcomeId, confirmed = false } = {}) {
  if (!actor.isOwner || game.user.isGM !== true || confirmed !== true)
    throw Error("The owning GC must inspect all clients and posted Driving Stance receipts.");
  if (active.has(key(actor, outcomeId))) throw Error("This client is still recording that Driving Stance outcome.");
  return queueRuleState(actor, async () => {
    const rows = drivingRows(actor),
      row = rows.find(r => r.id === outcomeId && !r.receiptUuid);
    if (!row) throw Error("Choose an interrupted Driving Stance outcome.");
    validateDrivingSource(actor, row.proof);
    const receipt = currentDrivingReceipt(actor, row);
    await write(
      actor,
      receipt
        ? rows.map(r => (r.id === row.id ? { ...r, receiptUuid: receipt.uuid } : r))
        : rows.filter(r => r.id !== row.id)
    );
    return { outcomeId, receiptUuid: receipt?.uuid ?? null, released: !receipt };
  });
}
export async function manageDrivingStance(actor, input = {}) {
  if (!actor.isOwner) return null;
  if (!Object.hasOwn(input, "sourceMessage") && !Object.hasOwn(input, "operation")) {
    const hits = drivingMessages().flatMap(m => {
        try {
          return [{ m, p: drivingHit(actor, m) }];
        } catch {
          return [];
        }
      }),
      rows = drivingRows(actor).filter(r => !r.receiptUuid);
    if (!hits.length && !rows.length)
      return ui.notifications.info("No finished Driving Stance hit or interrupted outcome is available.");
    const esc = foundry.utils.escapeHTML;
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "Driving Stance outcome" },
      rejectClose: false,
      content:
        '<div class="spycraft2-roll-options"><p>Finish and confirm the actual melee hit first. Review the opponent’s square 5 ft. directly away: push if free, or roll 1d4 subdual if occupied or blocked. Only a push permits the optional 5 ft. move toward that opponent. Resolve positions and damage defenses/health at the table. One outcome is recorded per original hit.</p><label>Recorded hit or review <select name="operation">' +
        hits
          .map(
            ({ m, p }, i) =>
              '<option value="hit|' +
              esc(m.uuid) +
              '">' +
              esc(
                "Melee hit " +
                  (i + 1) +
                  " against " +
                  (globalThis.fromUuidSync?.(p.targetUuid)?.name ?? "recorded opponent") +
                  (m.flags.spycraft2.rollCombat?.round ? " · round " + m.flags.spycraft2.rollCombat.round : "")
              ) +
              "</option>"
          )
          .join("") +
        (game.user.isGM
          ? rows
              .map(
                r =>
                  '<option value="review|' +
                  esc(r.id) +
                  '">' +
                  esc("GC review interrupted " + (r.proof.outcome === "blocked" ? "blocked damage" : "push")) +
                  "</option>"
              )
              .join("")
          : "") +
        '</select></label><label>Outcome <select name="outcome"><option value="push">Free destination: push opponent 5 ft.</option><option value="blocked">Occupied or blocked: 1d4 subdual</option></select></label><label><input name="follow" type="checkbox" /> After the push, move 5 ft. toward that opponent</label><label><input name="routeConfirmed" type="checkbox" /> The GC confirms the actual destination and legal push/follow route</label><label><input name="outcomeConfirmed" type="checkbox" /> The GC confirms this actual hit’s outcome; for recovery, all clients are idle and existing receipts were checked</label></div>'
    });
    if (!input) return null;
  }
  if (input.operation) {
    const [k, id] = input.operation.split("|");
    if (k === "review") return reviewDrivingStance(actor, { outcomeId: id, confirmed: input.outcomeConfirmed });
    if (k !== "hit") throw Error("Choose a listed Driving Stance hit.");
    input = { ...input, sourceMessage: id };
  }
  return settleDrivingStance(actor, input.sourceMessage, { ...input, follow: input.follow === true });
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "drivingDamage",
  order: 1030,
  record: ["drivingStance"],
  validate: ({ actor, options, checkKind, checkId, checkMethod, formula, data, weaponUuid }) =>
    validateDrivingDamageProof(actor, options.drivingStance, {
      checkKind,
      checkId,
      checkMethod,
      formula,
      data,
      weaponUuid,
      lease: options.drivingStanceLease,
      rerollOf: options.rerollOf
    })
});
