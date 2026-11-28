import {
  declaredDCRecord,
  declaredDCResult,
  declaredDCScope,
  declaredDCProof,
  declaredDCOutcome
} from "../../rules/gc/declared-skill-dc.mjs";
import { campaignSkillDCPolicy } from "../../rules/campaign-skill-dc.mjs";
import { actionDieTotal } from "../../rules/gc/gc-spend.mjs";
import { sameValues } from "../../rules/equal.mjs";
import { readSetting } from "../../settings.mjs";
import { queueResources } from "../../services/transactions.mjs";
import { gcDiceStatus, spendGCDice as payGC, reviewGCDiceSettlement } from "../../services/gc-dice.mjs";
import { systemDialog } from "../dialog-theme.mjs";
import { isDramaticScene } from "./state.mjs";
import { postUndo } from "../undo.mjs";
import { esc } from "../../html.mjs";
import { loc } from "../../i18n.mjs";

const recordOf = message => message?.flags?.spycraft2?.declaredDC;
const markers = actor => actor?.flags?.spycraft2?.declaredDCs ?? {};
const requireGC = () => {
  if (!game.user?.isGM) throw Error(loc`The GC declares and pays for a skill DC.`);
};
const periods = () => {
  const p = readSetting("usagePeriods", {});
  return { scene: String(p?.scene ?? "initial"), session: String(p?.session ?? "initial") };
};
const scopeOf = ctx => ({
  actorUuid: ctx.actor.uuid,
  checkKind: ctx.checkKind,
  skillKey: ctx.skillKey,
  checkId: ctx.checkId ?? ""
});
const markerScope = (marker, scope) => declaredDCScope({ ...marker, actorUuid: scope.actorUuid }, scope);
const liveMarkers = (actor, scope) =>
  Object.entries(markers(actor)).filter(
    ([, m]) => ["available", "claimed", "needsReview"].includes(m.state) && markerScope(m, scope)
  );

async function writeRecord(message, record, extra = {}) {
  try {
    await message.update({ "flags.spycraft2.declaredDC": record, ...extra });
  } catch (error) {
    if (!sameValues(recordOf(message), record)) throw error;
  }
}
async function writeMarker(actor, id, marker) {
  const next = { ...structuredClone(markers(actor)), [id]: structuredClone(marker) };
  try {
    await actor.update({ "flags.spycraft2.==declaredDCs": next });
  } catch (error) {
    if (!sameValues(markers(actor), next)) throw error;
  }
}
const sourceContent = r =>
  r.state === "ready"
    ? `<p>${loc`Declared DC ${r.campaignDC} + ${declaredDCResult(r).total} = ${declaredDCResult(r).dc}. ${r.count} GC d12 spent for the next matching check.`}</p>`
    : `<p>${loc`GC skill DC declaration: ${r.state === "cancelled" ? loc`cancelled` : loc`waiting for its recorded dice`}.`}</p>`;
const receiptExists = message =>
  [...(game.messages ?? [])].some(m => m.flags?.spycraft2?.undo?.declaredDCUndo?.sourceUuid === message.uuid);
async function receipt(actor, message) {
  const r = recordOf(message);
  if (receiptExists(message)) return null;
  return postUndo(loc`Declare skill DC`, [], {
    gcDice: r.count,
    gcDiceSession: r.session,
    declaredDCUndo: { actorUuid: actor.uuid, sourceUuid: message.uuid, id: r.id }
  });
}
async function ready(actor, message, dice, note = "") {
  const r = recordOf(message),
    next = {
      ...r,
      dice: structuredClone(dice),
      state: "ready",
      ...(note ? { recovery: { note, reviewerId: game.user.id } } : {})
    };
  declaredDCResult(next);
  if (markers(actor)[r.id]?.state !== "available")
    throw Error(loc`The DC declaration was already claimed or cancelled.`);
  await writeRecord(message, next, { content: sourceContent(next) });
  return next;
}

/** The GC reserves a particular actor/check before payment; incomplete declarations block that check. */
export async function declareSkillDC(input = {}) {
  requireGC();
  if (!input.actor || input.baseDC === undefined || !input.skillKey) {
    const candidates = [...(globalThis.canvas?.tokens?.placeables ?? []).map(t => t.actor), ...(game.actors ?? [])];
    const actors = [
      ...new Map(candidates.filter(a => a?.isOwner && ["agent", "npc"].includes(a.type)).map(a => [a.uuid, a])).values()
    ];
    const skills = Object.entries(CONFIG.SPYCRAFT.skills ?? {});
    const form = await systemDialog.input({
      window: { title: loc`Declare a skill DC before rolling` },
      rejectClose: false,
      ok: { label: loc`Declare DC and spend dice` },
      content: `<p>${loc`Choose one character and the exact forthcoming check. The DC is fixed before that check rolls. A private declaration requires the GC to roll the check.`}</p><label>${loc`Character`} <select name="actorUuid">${actors.map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`).join("")}</select></label><label>${loc`Check`} <select name="identity">${skills.map(([key, s]) => `<optgroup label="${esc(s.name ?? key)}"><option value="${key}/skill/">${loc`General ${esc(s.name ?? key)} check (NPC)`}</option>${(s.checks ?? []).map(c => `<option value="${key}/skill/${c.id}">${esc(c.name)}</option>`).join("")}<option value="${key}/knowledge/">${loc`${esc(s.name ?? key)} Knowledge`}</option></optgroup>`).join("")}</select></label><label>${loc`Source DC before campaign modifiers`} <input name="baseDC" type="number" min="0" step="1" required /></label><label>${loc`GC dice (d12)`} <input name="count" type="number" min="1" max="${isDramaticScene() ? 3 : 1}" value="1" /></label><label><input name="public" type="checkbox" checked /> ${loc`Share this DC with the players`}</label>`
    });
    if (!form) return null;
    const [skillKey, kind, checkId] = String(form.identity ?? "").split("/");
    input = {
      ...input,
      ...form,
      actor: await fromUuid(form.actorUuid),
      skillKey,
      kind,
      checkId,
      baseDC: String(form.baseDC ?? "").trim() === "" ? NaN : Number(form.baseDC),
      count: Number(form.count),
      public: form.public === true
    };
  }
  const actor = input.actor;
  if (!actor?.isOwner || !["agent", "npc"].includes(actor.type))
    throw Error(loc`Choose an actual character owned by the GC.`);
  const skill = CONFIG.SPYCRAFT.skills?.[input.skillKey],
    kind = input.kind ?? "skill",
    checkId = input.checkId ?? "";
  if (
    !skill ||
    (kind === "skill" && checkId && !(skill.checks ?? []).some(c => c.id === checkId)) ||
    (kind === "knowledge" && checkId)
  )
    throw Error(loc`Choose an actual skill or named check for this declaration.`);
  return queueResources([actor], async () => {
    requireGC();
    const scope = { actorUuid: actor.uuid, checkKind: kind, skillKey: input.skillKey, checkId };
    if (liveMarkers(actor, scope).length)
      throw Error(loc`Finish or undo the existing DC declaration for this character and check.`);
    const p = periods(),
      pool = gcDiceStatus(),
      r = declaredDCRecord({
        ...input,
        id: foundry.utils.randomID(),
        actorUuid: actor.uuid,
        kind,
        checkId,
        count: input.count ?? 1,
        dramatic: isDramaticScene(),
        policy: campaignSkillDCPolicy(actor.system.campaignEffects),
        ...p
      });
    if (!pool.current || pool.value < r.count) throw Error(loc`Initialize enough GC dice for this declaration first.`);
    const message = await ChatMessage.create({
      speaker: { alias: loc`Declared skill DC` },
      content: sourceContent(r),
      whisper: input.public === false ? ChatMessage.getWhisperRecipients("GM").map(u => u.id) : [],
      flags: {
        spycraft2: { actorUuid: actor.uuid, checkKind: "gcDeclaredDC", declaredDC: r, actionDiceAllowed: false }
      }
    });
    const marker = {
      sourceUuid: message.uuid,
      kind,
      skillKey: r.skillKey,
      checkId,
      state: "available",
      private: input.public === false,
      ...p
    };
    await writeMarker(actor, r.id, marker);
    let started = false;
    try {
      const result = await payGC(
        r.count,
        async () => {
          try {
            const payment = gcDiceStatus().settlementReview;
            if (
              payment?.session !== r.session ||
              !sameValues(periods(), p) ||
              isDramaticScene() !== r.explodeLow ||
              !sameValues(campaignSkillDCPolicy(actor.system.campaignEffects), r.policy)
            )
              throw Error(loc`The session, scene or campaign DC changed before these dice could roll.`);
            await writeRecord(message, { ...r, state: "rolling", paymentId: payment.id });
            const dice = [],
              objects = [];
            for (let index = 0; index < r.count; index++) {
              const rolls = [];
              dice.push(rolls);
              let complete = false;
              for (let explosion = 0; explosion < 100; explosion++) {
                started = true;
                const die = await new Roll("1d12").evaluate();
                if (!Number.isSafeInteger(die.total) || die.total < 1 || die.total > 12)
                  throw Error(loc`The actual d12 result is unavailable. Review this interrupted DC delivery.`);
                rolls.push(die.total);
                objects.push(die);
                await writeRecord(message, { ...recordOf(message), dice: structuredClone(dice) }, { rolls: objects });
                if (actionDieTotal(12, rolls, { explodeLow: r.explodeLow }).complete) {
                  complete = true;
                  break;
                }
              }
              if (!complete) throw Error(loc`Recover the interrupted DC explosion sequence before continuing.`);
            }
            await writeRecord(message, { ...recordOf(message), state: "rolled" });
            return await ready(actor, message, dice);
          } catch (cause) {
            const error = cause instanceof Error ? cause : Error(String(cause));
            if (started) error.actionDiceSettlementReview = true;
            throw error;
          }
        },
        { purpose: loc`Declared skill DC ${r.id}`, messageUuid: message.uuid }
      );
      await receipt(actor, message);
      return result;
    } catch (cause) {
      const error = cause instanceof Error ? cause : Error(String(cause));
      if (!started) {
        await writeRecord(
          message,
          { ...recordOf(message), state: "cancelled" },
          { content: sourceContent({ state: "cancelled" }) }
        );
        await writeMarker(actor, r.id, { ...marker, state: "cancelled" });
      }
      throw error;
    }
  });
}

/** Recovery records actual dice only, retaining every natural already saved. */
export async function recoverDeclaredDC(actor, message, input = {}) {
  requireGC();
  const initial = recordOf(message);
  if (!actor?.isOwner || initial?.actorUuid !== actor.uuid || initial.state === "cancelled")
    throw Error(loc`Choose the character and interrupted DC declaration.`);
  if (input.confirmed !== true) {
    input = await systemDialog.input({
      window: { title: loc`Recover declared DC dice` },
      rejectClose: false,
      ok: { label: initial.state === "reserved" ? loc`Release unrolled reservation` : loc`Complete recorded DC` },
      content: `<p>${loc`Enter actual natural results, one d12 and all its explosions per line, with commas between naturals. Keep every saved result in order. No die is rolled and no new payment is made. An unrolled reservation can be released instead.`}</p><label>${loc`Actual dice`} <textarea name="dice">${esc((initial.dice ?? []).map(row => row.join(", ")).join("\n"))}</textarea></label><label>${loc`GC review note`} <input name="note" required /></label><label><input type="checkbox" name="confirmed" /> ${loc`The GC confirms the actual results and original payment`}</label>`
    });
  }
  if (!input) return null;
  return queueResources(
    [actor],
    async () => {
      const r = recordOf(message),
        pool = gcDiceStatus(),
        payment = pool.settlementReview;
      if (!sameValues(initial, r) || input.confirmed !== true || !String(input.note ?? "").trim())
        throw Error(loc`Review the unchanged declaration, actual dice and recovery note.`);
      if (r.state === "ready" && !payment?.needsReview) {
        await receipt(actor, message);
        return r;
      }
      if (
        !pool.current ||
        pool.session !== r.session ||
        (payment?.needsReview && (payment.messageUuid !== message.uuid || (r.paymentId && payment.id !== r.paymentId)))
      )
        throw Error(loc`Review the original session and held payment before recovering this DC.`);
      if (r.state === "reserved") {
        if (payment?.needsReview && payment.messageUuid === message.uuid)
          await reviewGCDiceSettlement({ value: payment.before, resolution: input.note, confirmed: true });
        await writeRecord(
          message,
          { ...r, state: "cancelled", recovery: { note: input.note, reviewerId: game.user.id } },
          { content: sourceContent({ state: "cancelled" }) }
        );
        await writeMarker(actor, r.id, { ...markers(actor)[r.id], state: "cancelled" });
        return null;
      }
      if (!payment?.needsReview)
        throw Error(loc`The interrupted DC payment is missing or already changed; review the GC's action dice first.`);
      const dice = Array.isArray(input.dice)
        ? input.dice
        : String(input.dice ?? "")
            .trim()
            .split(/\r?\n/)
            .map(line => line.split(",").map(n => Number(n.trim())));
      for (const [index, saved] of r.dice.entries())
        if (!Array.isArray(dice[index]) || saved.some((value, at) => dice[index][at] !== value))
          throw Error(loc`Recovery must retain every saved DC die result in its original order.`);
      const result = await ready(actor, message, dice, String(input.note).trim());
      await reviewGCDiceSettlement({ value: pool.value, resolution: input.note, confirmed: true });
      await receipt(actor, message);
      return result;
    },
    { messages: [message] }
  );
}

const leases = new WeakMap();
const postedClaim = (actor, id) =>
  [...(game.messages ?? [])].find(
    m => m.flags?.spycraft2?.actorUuid === actor.uuid && m.flags.spycraft2.declaredSkillDC?.claimId === id
  );
export function acquireDeclaredDC(ctx) {
  if (ctx.options.rerollOf || ctx.options.declaredSkillDC) return null;
  const rows = liveMarkers(ctx.actor, scopeOf(ctx));
  if (!rows.length) return null;
  return next => withDeclaredDC(ctx, next);
}
async function withDeclaredDC(ctx, next) {
  const { actor } = ctx,
    scope = scopeOf(ctx),
    lease = {};
  let proof;
  await queueResources([actor], async () => {
    const rows = liveMarkers(actor, scope);
    if (rows.length !== 1 || rows[0][1].state !== "available")
      throw Error(loc`The pending DC declaration needs GC review before another check.`);
    const [id, marker] = rows[0];
    if (marker.private && !game.user?.isGM)
      throw Error(loc`The GC must roll this check against its private declared DC.`);
    const source = await fromUuid(marker.sourceUuid),
      r = recordOf(source);
    if (
      !r ||
      r.id !== id ||
      !declaredDCScope(r, scope) ||
      !sameValues(periods(), { scene: r.scene, session: r.session })
    )
      throw Error(loc`The declared DC is missing or belongs to another scene or session. Ask the GC to review it.`);
    if (r.state !== "ready") throw Error(loc`Finish the GC's declared DC dice before rolling this check.`);
    const held = gcDiceStatus().settlementReview;
    if (held?.needsReview && held.messageUuid === source.uuid)
      throw Error(loc`Recover this declared DC's held GC payment before rolling its check.`);
    proof = declaredDCProof(r, { sourceUuid: source.uuid, claimId: foundry.utils.randomID() });
    await writeMarker(actor, id, { ...marker, state: "claimed", claimId: proof.claimId });
    leases.set(lease, { actor, proof, started: false });
  });
  if (!proof) return null;
  const settle = async message =>
    queueResources([actor], async () => {
      const marker = markers(actor)[proof.id];
      if (marker?.claimId !== proof.claimId)
        throw Error(loc`The declared DC claim changed; ask the GC to review its check.`);
      await writeMarker(actor, proof.id, {
        ...marker,
        state: message ? "used" : leases.get(lease)?.started ? "needsReview" : "available",
        ...(message ? { messageUuid: message.uuid } : {})
      });
    });
  try {
    const result = await next({
      declaredSkillDC: proof,
      declaredDCLease: lease,
      ...(markers(actor)[proof.id]?.private ? { rollMode: "gmroll" } : {})
    });
    await settle(
      result?.flags?.spycraft2?.declaredSkillDC?.claimId === proof.claimId ? result : postedClaim(actor, proof.claimId)
    );
    return result;
  } catch (error) {
    await settle(postedClaim(actor, proof.claimId));
    throw error;
  } finally {
    leases.delete(lease);
  }
}

export async function validateDeclaredDC(ctx) {
  const proof = ctx.options.declaredSkillDC;
  if (!proof) return;
  declaredDCOutcome({ ...scopeOf(ctx), effectiveTotal: 0, declaredSkillDC: proof });
  const marker = markers(ctx.actor)[proof.id];
  if (marker?.claimId !== proof.claimId || !["claimed", "used"].includes(marker.state))
    throw Error(loc`This declared DC was not reserved for this check.`);
  if (ctx.options.rerollOf) {
    const original = await fromUuid(ctx.options.rerollOf);
    if (
      original?.flags?.spycraft2?.actorUuid !== ctx.actor.uuid ||
      !sameValues(original.flags.spycraft2.declaredSkillDC, proof)
    )
      throw Error(loc`A reroll must retain its original check's declared DC.`);
    return;
  }
  const lease = leases.get(ctx.options.declaredDCLease);
  if (lease?.actor !== ctx.actor || !sameValues(lease.proof, proof))
    throw Error(loc`Reserve the declared DC through the original check workflow.`);
  const source = await fromUuid(proof.sourceUuid);
  const held = gcDiceStatus().settlementReview;
  if (held?.needsReview && held.messageUuid === source?.uuid)
    throw Error(loc`Recover this declared DC's held GC payment before rolling its check.`);
  if (!sameValues(declaredDCProof(recordOf(source), proof), proof))
    throw Error(loc`The declared DC changed before this check could post.`);
  lease.started = true;
}

export async function resolveDeclaredDC(actor, message) {
  if (!actor?.isOwner || message.flags?.spycraft2?.actorUuid !== actor.uuid || (message.blind && !game.user?.isGM))
    return null;
  const result = declaredDCOutcome(message.flags.spycraft2);
  return actor.confirmCheckOutcome(message, {
    succeeded: result.succeeded,
    difficultyClass: result.dc,
    declaredDC: result
  });
}
export async function reviewDeclaredDCClaim(actor, message, input = {}) {
  requireGC();
  const r = recordOf(message),
    initial = structuredClone(markers(actor)[r?.id]);
  if (!actor?.isOwner || r?.actorUuid !== actor.uuid || !["claimed", "needsReview"].includes(initial?.state))
    throw Error(loc`Choose this character's interrupted declared-DC check.`);
  if (input.confirmed !== true) {
    input = await systemDialog.input({
      window: { title: loc`Review declared-DC check` },
      rejectClose: false,
      ok: { label: loc`Record GC review` },
      content: `<p>${loc`Stop the original client's action and check its actual roll before continuing. A posted check is retained. Release the declaration only if no check was rolled; otherwise consume it without allowing a reroll.`}</p><label>${loc`Review result`} <select name="outcome"><option value="posted">${loc`Reconcile an existing posted check`}</option><option value="unrolled">${loc`No check was rolled; release the declaration`}</option><option value="consumed">${loc`A check rolled but could not be posted; retain consumption`}</option></select></label><label>${loc`GC review note`} <input name="note" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`The original action has stopped and the GC reviewed the actual result`}</label>`
    });
  }
  if (!input) return null;
  return queueResources(
    [actor],
    async () => {
      const marker = markers(actor)[r.id],
        posted = postedClaim(actor, marker?.claimId);
      if (
        !sameValues(marker, initial) ||
        input.confirmed !== true ||
        !String(input.note ?? "").trim() ||
        !["posted", "unrolled", "consumed"].includes(input.outcome)
      )
        throw Error(loc`Review the unchanged DC claim and record the actual outcome.`);
      if (input.outcome === "posted" && !posted)
        throw Error(loc`No matching posted check was found; review the actual result.`);
      if (input.outcome === "unrolled" && posted)
        throw Error(loc`This check already posted; its DC cannot be released for another roll.`);
      await writeMarker(actor, r.id, {
        ...marker,
        state: input.outcome === "unrolled" ? "available" : "used",
        ...(posted ? { messageUuid: posted.uuid } : {}),
        review: { outcome: input.outcome, note: String(input.note).trim(), reviewerId: game.user.id }
      });
      return posted ?? null;
    },
    { messages: [message] }
  );
}
export function declaredDCControls({ message, check, actor, user }) {
  if (
    check.declaredSkillDC &&
    !check.superseded &&
    !check.criticalFailure &&
    !check.resolved &&
    actor?.isOwner &&
    (message.isAuthor || user?.isGM)
  )
    return [
      {
        label: loc`Resolve against declared DC ${check.declaredSkillDC.dc}`,
        placement: "card",
        emphasis: typeof check.successConfirmed === "boolean" ? "quiet" : "primary",
        run: () => resolveDeclaredDC(actor, message)
      }
    ];
  const r = recordOf(message);
  if (!r || !user?.isGM || !actor?.isOwner || r.state === "cancelled") return [];
  if (["claimed", "needsReview"].includes(markers(actor)[r.id]?.state))
    return [
      { label: loc`Review declared-DC check`, placement: "card", run: () => reviewDeclaredDCClaim(actor, message) }
    ];
  const held = gcDiceStatus().settlementReview;
  return r.state !== "ready" || !receiptExists(message) || (held?.needsReview && held.messageUuid === message.uuid)
    ? [{ label: loc`Recover declared DC dice`, placement: "card", run: () => recoverDeclaredDC(actor, message) }]
    : [];
}
