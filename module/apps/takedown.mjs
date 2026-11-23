import {
  stableTakedown as stable,
  takedownMessages,
  takedownMessage,
  takedownSource,
  takedownRows,
  validateTakedownSource,
  currentTakedownSave
} from "../rules/takedown.mjs";
import { queueRuleState } from "./rule-resource-scope.mjs";
import { queueResources } from "../services/transactions.mjs";
import { rollEvidence } from "../rules/outcomes.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
import { decline } from "../error-notices.mjs";
const leases = new WeakMap(),
  active = new Map(),
  key = (a, id) => a.uuid + ":" + id;
const row = (actor, proof) => {
  const r = takedownRows(actor).find(r => r.id === proof?.eventId);
  if (!r || stable(r.proof) !== stable(proof)) throw Error(loc`The recorded takedown save reservation changed.`);
  return r;
};
async function write(actor, rows) {
  try {
    await actor.update({ "flags.spycraft2.takedownEvents": rows });
  } catch (e) {
    if (stable(actor.flags?.spycraft2?.takedownEvents) !== stable(rows)) throw e;
  }
  if (stable(actor.flags?.spycraft2?.takedownEvents) !== stable(rows))
    throw Error(loc`Review the saved takedown event before retrying.`);
}
async function change(actor, id, perform) {
  return queueRuleState(actor, async () => {
    const rows = takedownRows(actor),
      r = rows.find(r => r.id === id);
    if (!r) throw Error(loc`This takedown event is no longer recorded.`);
    const next = perform(structuredClone(r));
    await write(actor, next ? rows.map(r => (r.id === id ? next : r)) : rows.filter(r => r.id !== id));
    return next;
  });
}
export function validateTakedownSaveProof(
  actor,
  proof,
  { checkKind, checkId, checkMethod = "roll", lease, rerollOf } = {}
) {
  if (!proof) return;
  if (!actor.isOwner || checkKind !== "save" || checkId !== "fort" || checkMethod !== "roll")
    throw Error(loc`Use this character’s actual rolled Fortitude save for the recorded takedown.`);
  const r = row(actor, proof);
  validateTakedownSource(actor, proof);
  if (r.settlement) throw Error(loc`This takedown save already has an outcome awaiting completion or already settled.`);
  if (rerollOf) {
    const original = takedownMessage(rerollOf),
      c = original?.flags?.spycraft2,
      current = currentTakedownSave(actor, r);
    if (
      !r.saveUuid ||
      current?.uuid !== rerollOf ||
      c?.actorUuid !== actor.uuid ||
      c.checkKind !== "save" ||
      c.checkId !== "fort" ||
      c.resolved ||
      c.superseded ||
      stable(c.takedown) !== stable(proof)
    )
      throw Error(loc`Use the current owned unresolved original takedown save for its replacement.`);
    return;
  }
  const held = lease && leases.get(lease);
  if (r.saveUuid || held?.actor !== actor || held.eventId !== proof.eventId || held.receiptId !== proof.receiptId)
    throw Error(loc`Reserve the original takedown save through its recorded damage event.`);
}
/** Reserve once under the short rule lock, then roll outside it so ordinary save options can use their base queue. */
export async function rollTakedown(actor, input = {}) {
  const facts = takedownSource(actor, input),
    reserved = await queueRuleState(actor, async () => {
      const current = takedownSource(actor, input);
      if (stable(current) !== stable(facts)) throw Error(loc`The takedown source changed before reserving its save.`);
      const rows = takedownRows(actor),
        prior = rows.find(r => r.proof.damageRootUuid === facts.damageRootUuid);
      if (
        rows.some(
          r => r.proof.attackRootUuid === facts.attackRootUuid && r.proof.damageRootUuid !== facts.damageRootUuid
        )
      )
        throw Error(
          loc`This attack already has another reviewed damage event. The GC must review its damage components together before another takedown save is recorded.`
        );
      if (prior) {
        const { eventId, receiptId, ...old } = prior.proof;
        if (stable(old) !== stable(facts))
          throw Error(loc`This original damage already has different reviewed takedown facts.`);
        if (prior.saveUuid) {
          const save = currentTakedownSave(actor, prior);
          if (!save) throw Error(loc`Review the missing original takedown save receipt.`);
          return { existing: save };
        }
        throw Error(loc`This damage has an interrupted takedown save awaiting GC review.`);
      }
      const id = foundry.utils.randomID(),
        proof = { ...facts, eventId: id, receiptId: foundry.utils.randomID() },
        entry = { version: 1, id, proof, saveUuid: null, settlement: null };
      await write(actor, [...rows, entry]);
      return { entry };
    });
  if (reserved.existing) return reserved.existing;
  const proof = reserved.entry.proof,
    lease = {};
  leases.set(lease, { actor, eventId: proof.eventId, receiptId: proof.receiptId });
  active.set(key(actor, proof.eventId), lease);
  const posted = () => currentTakedownSave(actor, row(actor, proof)),
    stamp = save =>
      change(actor, proof.eventId, r => {
        if (stable(r.proof) !== stable(proof) || (r.saveUuid && r.saveUuid !== save?.uuid))
          throw Error(loc`Review the changed original takedown save receipt.`);
        return save ? { ...r, saveUuid: save.uuid } : null;
      });
  try {
    const result = await actor.rollSave("fort", {
        askContext: input.askContext !== false,
        takedown: proof,
        takedownLease: lease,
        resistingTakedown: true,
        takedownAttackConfirmed: true
      }),
      save = posted();
    if (result && !save) throw Error(loc`The actual takedown save posted no matching receipt.`);
    await stamp(save);
    return save ?? result;
  } catch (error) {
    let save;
    try {
      save = posted();
      await stamp(save);
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        loc`The takedown save needs GC review; preserve any posted result before retrying.`
      );
    }
    if (save) return save;
    throw error;
  } finally {
    leases.delete(lease);
    active.delete(key(actor, proof.eventId));
  }
}
export async function reviewTakedownSave(actor, { eventId, confirmed = false } = {}) {
  if (!actor.isOwner || game.user.isGM !== true || confirmed !== true)
    throw Error(
      loc`The owning GC must review the interrupted takedown save and check every client for a posted result.`
    );
  if (active.has(key(actor, eventId))) throw Error(loc`This client is still executing the takedown save.`);
  return queueRuleState(actor, async () => {
    const rows = takedownRows(actor),
      r = rows.find(r => r.id === eventId);
    if (!r || r.saveUuid || r.settlement) throw Error(loc`Choose an interrupted original takedown save.`);
    validateTakedownSource(actor, r.proof);
    const save = currentTakedownSave(actor, r);
    await write(
      actor,
      save ? rows.map(x => (x.id === eventId ? { ...x, saveUuid: save.uuid } : x)) : rows.filter(x => x.id !== eventId)
    );
    return { eventId, saveUuid: save?.uuid ?? null, released: !save };
  });
}
function resolvedSave(actor, message) {
  const c = message?.flags?.spycraft2,
    p = c?.takedown,
    r = row(actor, p),
    current = currentTakedownSave(actor, r);
  if (
    c?.actorUuid !== actor.uuid ||
    c.checkKind !== "save" ||
    c.checkId !== "fort" ||
    c.superseded ||
    c.resolved !== true ||
    typeof c.successConfirmed !== "boolean" ||
    !Number.isFinite(c.effectiveTotal) ||
    current?.uuid !== message.uuid ||
    !r.saveUuid ||
    c.successConfirmed !== c.effectiveTotal >= p.dc ||
    stable(c.takedown) !== stable(r.proof)
  )
    throw Error(
      loc`Confirm and finish the actual adopted Fortitude save against its recorded takedown DC before settling it.`
    );
  if (
    c.criticalFailure ||
    (c.criticalSuccess && !(c.oneInAMillion === true && c.naturalDie === 20 && c.forcedThreat === true))
  )
    throw Error(loc`The GC must review this unsupported critical saving-throw outcome separately.`);
  validateTakedownSource(actor, p);
  return { r, c, p };
}
const operationEffect = (actor, operationId) =>
  [...(actor.effects ?? [])].find(
    e => e.flags?.spycraft2?.conditionOperation === operationId && e.statuses?.has("sprawled")
  );
async function stampOutcome(actor, message, prepared, result = {}) {
  const final = { ...prepared, ...result, state: "applied" },
    saved = await change(actor, prepared.eventId, r => {
      if (r.settlement?.state === "applied") return r;
      if (stable(r.settlement) !== stable(prepared)) throw Error(loc`Review the changed prepared takedown outcome.`);
      if (rollEvidence(message.flags.spycraft2) !== prepared.evidence)
        throw Error(loc`The actual takedown save changed during its outcome.`);
      return { ...r, settlement: final };
    });
  await message.update({ "flags.spycraft2.takedownSettlement": saved.settlement });
  return saved.settlement;
}
export async function settleTakedown(actor, message) {
  if (!actor.isOwner || message?.flags?.spycraft2?.actorUuid !== actor.uuid || (message.blind && !game.user.isGM))
    throw Error(loc`Only an owner or the GC may settle this actual takedown save.`);
  return queueResources(
    [actor],
    async () => {
      let { r, c, p } = resolvedSave(actor, message);
      if (r.settlement?.state === "applied") {
        await message.update({ "flags.spycraft2.takedownSettlement": r.settlement });
        return r.settlement;
      }
      if (r.settlement) {
        const prepared = r.settlement;
        if (prepared.saveUuid !== message.uuid || prepared.evidence !== rollEvidence(c))
          throw Error(loc`Review the changed prepared takedown save.`);
        if (!prepared.succeeded && !prepared.wasSprawled && !operationEffect(actor, prepared.operationId))
          throw Error(
            loc`The interrupted takedown condition needs explicit GC review; do not refresh a condition that may already have ended.`
          );
        return stampOutcome(actor, message, prepared, { recovered: true });
      }
      const prepared = {
        version: 1,
        eventId: r.id,
        saveUuid: message.uuid,
        evidence: rollEvidence(c),
        succeeded: c.successConfirmed,
        wasSprawled: actor.statuses?.has("sprawled") === true,
        operationId: "takedown-" + r.id,
        at: game.time.worldTime,
        state: "prepared"
      };
      await change(actor, r.id, current => {
        if (current.settlement) throw Error(loc`The takedown outcome changed before preparation.`);
        return { ...current, settlement: prepared };
      });
      let effect = { changed: false };
      if (!prepared.succeeded && !prepared.wasSprawled)
        effect = await setConditionStatus(actor, "sprawled", true, {
          label: loc`Sprawled`,
          operationId: prepared.operationId
        });
      return stampOutcome(actor, message, prepared, {
        conditionApplied: !prepared.succeeded,
        changed: effect.changed,
        ...(effect.effectId ? { effectId: effect.effectId } : {})
      });
    },
    { messages: [message] }
  );
}
export async function reviewTakedownOutcome(actor, message, { confirmed = false, resolution } = {}) {
  if (
    !actor.isOwner ||
    game.user.isGM !== true ||
    confirmed !== true ||
    !["alreadyApplied", "applyPending"].includes(resolution)
  )
    throw Error(
      loc`The owning GC must review the interrupted outcome and choose whether it was already applied or still needs its condition.`
    );
  return queueResources(
    [actor],
    async () => {
      const { r, c } = resolvedSave(actor, message),
        prepared = r.settlement;
      if (
        !prepared ||
        prepared.state !== "prepared" ||
        prepared.saveUuid !== message.uuid ||
        prepared.evidence !== rollEvidence(c)
      )
        throw Error(loc`Choose the matching prepared takedown outcome.`);
      let effect = { changed: false };
      if (resolution === "applyPending" && !prepared.succeeded)
        effect = await setConditionStatus(actor, "sprawled", true, {
          label: loc`Sprawled`,
          operationId: prepared.operationId
        });
      return stampOutcome(actor, message, prepared, {
        conditionApplied: !prepared.succeeded,
        changed: effect.changed,
        gcReviewed: true,
        resolution,
        ...(effect.effectId ? { effectId: effect.effectId } : {})
      });
    },
    { messages: [message] }
  );
}
const visible = m => m.visible !== false && m.isContentVisible !== false && (!m.blind || game.user.isGM);
const whole = value =>
  typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : typeof value === "string" && /^(0|[1-9]\d*)$/.test(value.trim())
      ? Number(value)
      : NaN;
function label(m, index) {
  const c = m.flags.spycraft2,
    a = globalThis.fromUuidSync?.(c.actorUuid),
    round = c.rollCombat?.round;
  return (
    (a?.name ?? "Recorded attacker") +
    ": " +
    (c.checkKind === "attack" ? "attack" : "damage") +
    " " +
    (index + 1) +
    (round ? " in round " + round : "") +
    " — total " +
    c.effectiveTotal
  );
}
export async function manageTakedown(actor, input = {}) {
  if (!actor.isOwner) return null;
  if (!Object.hasOwn(input, "operation")) {
    const messages = takedownMessages().filter(visible),
      attacks = messages.filter(m => {
        const c = m.flags?.spycraft2;
        return (
          c?.checkKind === "attack" &&
          c.resolved === true &&
          c.successConfirmed === true &&
          !c.superseded &&
          c.attackContext?.disarm?.active !== true &&
          /\bTKD\b/.test(c.weaponQualities ?? "")
        );
      }),
      damages = messages.filter(m => {
        const c = m.flags?.spycraft2;
        return (
          c?.checkKind === "damage" &&
          c.resolved === true &&
          !c.superseded &&
          c.effectiveTotal > 0 &&
          /\bTKD\b/.test(c.weaponQualities ?? "")
        );
      }),
      entries = [];
    for (const r of takedownRows(actor)) {
      const save = currentTakedownSave(actor, r);
      if (!r.saveUuid && !r.settlement && game.user.isGM)
        entries.push({ value: "recover|" + r.id, label: loc`GC review interrupted takedown save DC${r.proof.dc}` });
      if (r.saveUuid && !r.settlement)
        entries.push({
          value: (save?.flags.spycraft2.resolved ? "settle|" : "existing|") + (save?.uuid ?? ""),
          label:
            (save?.flags.spycraft2.resolved ? loc`Apply resolved` : loc`Review existing`) +
            loc` Fortitude DC` +
            r.proof.dc
        });
      if (r.settlement?.state === "prepared" && game.user.isGM)
        entries.push({
          value: "outcome|" + r.settlement.saveUuid,
          label: loc`GC review interrupted takedown outcome DC${r.proof.dc}`
        });
    }
    if (!attacks.length && !entries.length)
      return decline(loc`No finished takedown attack or pending takedown save is available.`);
    const esc = foundry.utils.escapeHTML,
      options = rows =>
        rows.map((m, i) => '<option value="' + esc(m.uuid) + '">' + esc(label(m, i)) + "</option>").join("");
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Takedown saves and outcomes` },
      rejectClose: false,
      content:
        `<div class="spycraft2-roll-options"><p>${loc`Finish the actual attack and damage results in chat first. Apply health damage separately, then confirm what this character actually suffered. Takedown uses pre-DR damage as its Fortitude DC, plus10 if this attack lost at least one wound point. Failure causes sprawled.`}</p><label>${loc`Operation`} <select name="operation">` +
        (attacks.length && damages.length
          ? `<option value="new">${loc`New save for a reviewed damage event`}</option>`
          : "") +
        entries.map(e => '<option value="' + esc(e.value) + '">' + esc(e.label) + "</option>").join("") +
        "</select></label><details" +
        (attacks.length && damages.length ? " open" : "") +
        `><summary>${loc`Only for a new takedown save`}</summary><label>${loc`Finished successful attack`} <select name="attackUuid"><option value="">${loc`Choose actual attack`}</option>` +
        options(attacks) +
        `</select></label><label>${loc`Its finished damage result`} <select name="damageUuid"><option value="">${loc`Choose actual damage`}</option>` +
        options(damages) +
        `</select></label><label>${loc`Damage sustained before DR`} <input name="preDRDamage" type="number" min="1" step="1" /></label><label>${loc`Net damage actually suffered after defenses`} <input name="netDamage" type="number" min="1" step="1" /></label><label><input name="woundsLost" type="checkbox" /> ${loc`This attack lost at least one wound point (+10 DC)`}</label><label><input name="targetConfirmed" type="checkbox" /> ${loc`The GC confirms this actual character was the target and this damage belongs to the selected attack`}</label></details>` +
        (game.user.isGM
          ? `<label>${loc`For an interrupted condition outcome`} <select name="resolution"><option value="alreadyApplied">${loc`It was already applied; complete its record without refreshing the condition`}</option><option value="applyPending">${loc`It was not applied; apply the pending failed-save condition now`}</option></select></label>`
          : "") +
        `<label><input name="confirmed" type="checkbox" /> ${loc`The GC reviewed the actual event and outcome; new-save amounts already include separately resolved modifiers and any wounds lost. For recovery, no client is still executing the save and posted results were checked.`}</label><p>${loc`An existing save uses its chat result for eligible boosts and replacements. Finish and confirm that result before applying its outcome. This control does not apply damage or spend an action.`}</p></div>`
    });
    if (!input) return null;
  }
  if (typeof input.operation !== "string" || input.confirmed !== true)
    throw Error(loc`Confirm the actual takedown event or interrupted outcome with the GC.`);
  if (input.operation === "new")
    return rollTakedown(actor, { ...input, preDRDamage: whole(input.preDRDamage), netDamage: whole(input.netDamage) });
  const [kind, id] = input.operation.split("|");
  if (!id) throw Error(loc`Choose a listed actual takedown operation.`);
  if (kind === "recover") return reviewTakedownSave(actor, { eventId: id, confirmed: true });
  if (kind === "settle") return settleTakedown(actor, takedownMessage(id));
  if (kind === "outcome")
    return reviewTakedownOutcome(actor, takedownMessage(id), { confirmed: true, resolution: input.resolution });
  if (kind === "existing") {
    const save = takedownMessage(id),
      r = takedownRows(actor).find(r => r.proof.eventId === save?.flags?.spycraft2?.takedown?.eventId);
    if (!r || currentTakedownSave(actor, r)?.uuid !== id) throw Error(loc`Choose the current original takedown save.`);
    ui.notifications.info(
      loc`Finish and confirm this existing Fortitude result in chat; no additional save was rolled.`
    );
    return save;
  }
  throw Error(loc`Choose a listed takedown operation.`);
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "takedownSave",
  order: 1040,
  record: ["takedown"],
  validate: ({ actor, options, checkKind, checkId, checkMethod }) =>
    validateTakedownSaveProof(actor, options.takedown, {
      checkKind,
      checkId,
      checkMethod,
      lease: options.takedownLease,
      rerollOf: options.rerollOf
    })
});
