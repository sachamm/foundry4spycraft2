import { threadNeedleAttackFacts, threadNeedleEndPlan } from "../rules/thread-needle.mjs";
import { queueResources } from "../services/transactions.mjs";
import { rollEvidence, rollEvidenceMatches } from "../rules/outcomes.mjs";
import { attackCharacterTargetChoices } from "./character-target.mjs";
import { loc } from "../i18n.mjs";
import { decline } from "../error-notices.mjs";
const active = new Set();
const stable = v =>
    JSON.stringify(v, (_k, x) =>
      x && typeof x === "object" && !Array.isArray(x)
        ? Object.fromEntries(
            Object.keys(x)
              .sort()
              .map(k => [k, x[k]])
          )
        : x
    ),
  messages = () => [...(game.messages ?? [])],
  message = id => globalThis.fromUuidSync?.(id) ?? messages().find(m => m.uuid === id),
  visible = m =>
    messages().includes(m) && m.visible !== false && m.isContentVisible !== false && (!m.blind || game.user.isGM),
  identity = a => ({ uuid: a.uuid, type: a.type, createdTime: a._stats?.createdTime ?? null });
/** Historical entitlement needs its actual adopted hit, never a current weapon
 * or a recreated feat. A finished hit remains earned after ordinary source loss. */
export function threadNeedleSource(actor, input) {
  const attack = typeof input === "string" ? message(input) : input,
    c = attack?.flags?.spycraft2,
    facts = threadNeedleAttackFacts(c),
    target = attackCharacterTargetChoices().find(a => a.uuid === facts.targetUuid);
  if (
    !actor.isOwner ||
    facts.actorUuid !== actor.uuid ||
    !attackCharacterTargetChoices().includes(actor) ||
    !target?.isOwner ||
    target === actor
  )
    throw Error(loc`An owner of both actual Thread the Needle participants must review this hold.`);
  const chain = [],
    seen = new Set();
  let current = attack;
  while (current && !seen.has(current.uuid)) {
    seen.add(current.uuid);
    const f = current.flags?.spycraft2;
    if (
      !visible(current) ||
      f.actorUuid !== actor.uuid ||
      f.checkKind !== "attack" ||
      f.weaponUuid !== facts.weaponUuid ||
      stable(f.attackContext?.meleeTrick) !== stable(facts.trick) ||
      (f.attackContext?.targetActorUuid || f.attackContext?.characterTarget?.actorUuid) !== target.uuid
    )
      throw Error(loc`The original Thread the Needle source or participants changed.`);
    chain.push({ uuid: current.uuid, evidence: JSON.parse(rollEvidence(f)) });
    if (!f.rerollOf) break;
    const previous = message(f.rerollOf);
    if (previous?.flags?.spycraft2?.superseded !== current.uuid)
      throw Error(loc`Use only the actually adopted original Thread the Needle replacement.`);
    current = previous;
  }
  if (!current || current.flags.spycraft2.rerollOf || chain.length !== seen.size)
    throw Error(loc`The original Thread the Needle attack chain is missing or cyclic.`);
  return {
    actor,
    attack,
    root: current,
    target,
    proof: {
      ...facts,
      attackUuid: attack.uuid,
      rootAttackUuid: current.uuid,
      targetIdentity: identity(target),
      sourceEvidence: chain
    }
  };
}
function saved(src) {
  const r = src.root.flags?.spycraft2?.threadNeedleHold;
  if (!r) return null;
  if (
    r.version !== 1 ||
    !["prepared", "active", "ended"].includes(r.state) ||
    typeof r.operationId !== "string" ||
    !r.operationId ||
    r.operationId.length > 500 ||
    stable(r.proof) !== stable(src.proof) ||
    (r.effectId != null && (typeof r.effectId !== "string" || !r.effectId)) ||
    (r.state === "active" && !r.effectId) ||
    (r.state === "ended" && !["release", "movedBeyond", "escape", "gcAlreadyEnded"].includes(r.end?.reason))
  )
    throw Error(loc`Review the saved Thread the Needle hold and its original hit.`);
  return r;
}
function ownedEffects(src, r) {
  const rows = [...(src.target.effects ?? [])].filter(
    e => e.flags?.spycraft2?.threadNeedleHold?.operationId === r.operationId
  );
  for (const e of rows) {
    const p = e.flags.spycraft2.threadNeedleHold;
    if (
      p.version !== 1 ||
      p.rootAttackUuid !== src.root.uuid ||
      p.actorUuid !== src.proof.actorUuid ||
      e.flags.spycraft2.conditionOperation !== r.operationId ||
      e.statuses?.size !== 1 ||
      !e.statuses.has("held") ||
      (e.changes ?? []).length
    )
      throw Error(loc`Review the modified Thread the Needle effect before changing it.`);
  }
  if (rows.length > 1 || (r.state === "active" && rows.length && rows[0].id !== r.effectId))
    throw Error(loc`Review duplicate or changed Thread the Needle effect sources.`);
  return rows;
}
async function stamp(src, row) {
  const previous = saved(src);
  if (
    (previous &&
      (previous.operationId !== row.operationId || (previous.state === "ended" && stable(previous) !== stable(row)))) ||
    (!previous && row.state !== "prepared")
  )
    throw Error(loc`The original Thread the Needle hold history changed during its outcome.`);
  if (stable(threadNeedleSource(src.actor, src.attack).proof) !== stable(src.proof))
    throw Error(loc`The Thread the Needle source changed during its outcome.`);
  await src.root.update({ "flags.spycraft2.threadNeedleHold": row });
  return row;
}
async function createHold(src, r) {
  const definition = CONFIG.statusEffects.find(s => s.id === "held");
  if (!definition) throw Error(loc`Held is not configured.`);
  const [e] = await src.target.createEmbeddedDocuments("ActiveEffect", [
    {
      name: loc`Thread the Needle — Held`,
      img: definition.img,
      statuses: ["held"],
      origin: src.root.uuid,
      flags: {
        spycraft2: {
          conditionOperation: r.operationId,
          threadNeedleHold: {
            version: 1,
            actorUuid: src.proof.actorUuid,
            rootAttackUuid: src.root.uuid,
            operationId: r.operationId
          }
        }
      }
    }
  ]);
  if (!e || !ownedEffects(src, r).some(x => x.id === e.id) || e.disabled || !src.target.statuses.has("held"))
    throw Error(loc`Review the interrupted Thread the Needle effect; do not apply another hold.`);
  return e;
}
export async function applyThreadNeedle(actor, input, options = {}) {
  const before = threadNeedleSource(actor, input);
  if (options.confirmed !== true)
    throw Error(loc`Confirm the actual Thread the Needle hit and source-specific Held outcome.`);
  return queueResources(
    [actor, before.target],
    async () => {
      const key = actor.uuid + ":" + before.root.uuid;
      active.add(key);
      try {
        const src = threadNeedleSource(actor, input);
        if (stable(src.proof) !== stable(before.proof))
          throw Error(loc`The original hold hit or actual target changed.`);
        const r = saved(src);
        if (r?.state === "ended") return r;
        if (r?.state === "active") {
          ownedEffects(src, r);
          return r;
        }
        if (r) {
          const e = ownedEffects(src, r)[0];
          if (!e || e.disabled)
            throw Error(
              loc`The interrupted hold may have already ended; owning-GC review is required before any reapplication.`
            );
          return await stamp(src, { ...r, state: "active", effectId: e.id, recovered: true });
        }
        const prepared = {
          version: 1,
          state: "prepared",
          operationId: "thread-" + foundry.utils.randomID(),
          proof: src.proof,
          effectId: null
        };
        await stamp(src, prepared);
        const e = await createHold(src, prepared);
        return await stamp(src, { ...prepared, state: "active", effectId: e.id });
      } finally {
        active.delete(key);
      }
    },
    { messages: [before.attack, before.root] }
  );
}
/** The target's ordinary escape owns condition removal and mandatory movement.
 * Closing the attack history only authenticates that completed receipt. */
function completedEscape(src, r, end) {
  const m = message(end.escapeMessage),
    c = m?.flags?.spycraft2,
    receipt = src.target.flags?.spycraft2?.restraintReleases?.[m?.id];
  if (
    !m ||
    !visible(m) ||
    c?.actorUuid !== src.target.uuid ||
    c.checkKind !== "skill" ||
    c.skillKey !== "athletics" ||
    c.checkId !== "restraint-escape" ||
    c.resolved !== true ||
    c.successConfirmed !== true ||
    c.criticalFailure ||
    c.superseded ||
    !receipt ||
    receipt.messageUuid !== m.uuid ||
    receipt.actorUuid !== src.target.uuid ||
    !rollEvidenceMatches(receipt.evidence, c) ||
    stable(receipt.source) !== stable(c.restraintEscape?.sourceSnapshot) ||
    !["applied", "reviewed"].includes(receipt.state) ||
    !["escapeHold", "breakPinAndEscapeHold"].includes(receipt.benefit) ||
    !["completed", "gcResolved"].includes(receipt.movement?.state) ||
    !receipt.source?.sources?.some(
      e =>
        e.id === r.effectId &&
        e.own &&
        e.operation === r.operationId &&
        e.threadNeedleHold?.rootAttackUuid === src.root.uuid &&
        e.threadNeedleHold?.actorUuid === src.actor.uuid
    ) ||
    [...(src.target.effects ?? [])].some(
      e => e.flags?.spycraft2?.threadNeedleHold?.operationId === r.operationId && e.statuses?.has("held")
    )
  )
    throw Error(
      loc`Finish this target’s actual opposed grapple escape and its required move before closing this hold.`
    );
  return { ...end, escapeEvidence: rollEvidence(c) };
}
export async function endThreadNeedle(actor, input, options = {}) {
  const before = threadNeedleSource(actor, input);
  return queueResources(
    [actor, before.target],
    async () => {
      const src = threadNeedleSource(actor, input),
        r = saved(src);
      if (!r) throw Error(loc`Apply or review this actual recorded hold first.`);
      if (r.state === "ended") return r;
      if (r.state !== "active") throw Error(loc`The interrupted hold needs owning-GC review first.`);
      let end = threadNeedleEndPlan(options);
      if (end.reason === "escape") end = completedEscape(src, r, end);
      else {
        const e = ownedEffects(src, r)[0];
        if (e) await src.target.deleteEmbeddedDocuments("ActiveEffect", [e.id]);
      }
      return stamp(src, { ...r, state: "ended", end });
    },
    { messages: [before.attack, before.root] }
  );
}
export async function reviewThreadNeedle(actor, input, { confirmed = false, resolution } = {}) {
  if (game.user.isGM !== true || confirmed !== true || !["applyPending", "alreadyEnded"].includes(resolution))
    throw Error(loc`The owning GC must review whether the interrupted hold is still pending or already ended.`);
  const before = threadNeedleSource(actor, input);
  if (active.has(actor.uuid + ":" + before.root.uuid))
    throw Error(loc`This client is still applying the original Thread the Needle hold.`);
  return queueResources(
    [actor, before.target],
    async () => {
      const src = threadNeedleSource(actor, input),
        r = saved(src);
      if (!r) throw Error(loc`Choose the original recorded hold.`);
      if (r.state === "ended") return r;
      const e = ownedEffects(src, r)[0];
      if (resolution === "alreadyEnded") {
        if (e)
          throw Error(loc`End or separately correct the actual source effect before recording it as already ended.`);
        return stamp(src, { ...r, state: "ended", gcReviewed: true, end: { reason: "gcAlreadyEnded" } });
      }
      if (r.state !== "prepared") throw Error(loc`A previously active hold cannot be refreshed after it ended.`);
      const effect = e ?? (await createHold(src, r));
      if (effect.disabled) throw Error(loc`The old hold effect is inactive; review it separately.`);
      return stamp(src, { ...r, state: "active", effectId: effect.id, gcReviewed: true });
    },
    { messages: [before.attack, before.root] }
  );
}
export async function manageThreadNeedle(actor, input = {}) {
  if (!actor.isOwner) return null;
  if (!Object.hasOwn(input, "sourceMessage")) {
    const esc = foundry.utils.escapeHTML,
      choices = messages().flatMap(m => {
        try {
          const s = threadNeedleSource(actor, m);
          return [{ s, row: saved(s) }];
        } catch {
          return [];
        }
      });
    if (!choices.length) return decline(loc`No visible finished Thread the Needle hit is available.`);
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Thread the Needle — hold outcome` },
      rejectClose: false,
      content:
        `<div class="spycraft2-roll-options"><p>${loc`Standard weapon damage is resolved normally. Apply only this hit’s Held source; release removes only that source and preserves independent holds or pins. The trick does not start a Grapple or make its user vulnerable. Actual geometry and action costs remain with the GC.`}</p><label>${loc`Actual hit or recorded hold`} <select name="sourceMessage">` +
        choices
          .map(
            ({ s, row }) =>
              '<option value="' +
              esc(s.attack.uuid) +
              '">' +
              esc(s.target.name + " · " + (row?.state ?? "finished hit") + " · " + s.attack.id) +
              "</option>"
          )
          .join("") +
        `</select></label><label>${loc`Operation`} <select name="operation"><option value="apply">${loc`Apply / recover original hold`}</option><option value="escape">${loc`Record target’s completed escape and required move`}</option><option value="release">${loc`I released this target`}</option><option value="movedBeyond">${loc`Holder moved farther than5ft from this target`}</option>` +
        (game.user.isGM
          ? `<option value="reviewPending">${loc`GC: interrupted hold still needs application`}</option><option value="reviewEnded">${loc`GC: original hold already ended`}</option>`
          : "") +
        `</select></label><label>${loc`Target’s escape result UUID (for completed escape)`} <input name="escapeMessage" /></label><label>${loc`Resulting separation (ft.; for holder movement beyond5ft)`} <input name="separationFeet" type="number" min="0" step="any" /></label><label><input name="holderMovedConfirmed" type="checkbox" /> ${loc`The holder actually completed the reviewed legal movement; this is resulting separation, not distance traveled`}</label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms this original hit, actual participants and selected outcome; no client is still applying it`}</label><p>${loc`On the target’s Skills tab, use the usual opposed Athletics (STR) grapple escape, apply its earned Escape Hold benefit and confirm the required immediate Standard Move. Then record that completed escape here. This does not impose grapple restrictions on the staff user. A completed or ended original hold never grants another application.`}</p></div>`
    });
    if (!input) return null;
  }
  if (input.operation === "release" || input.operation === "movedBeyond" || input.operation === "escape") {
    const n =
      typeof input.separationFeet === "number"
        ? input.separationFeet
        : typeof input.separationFeet === "string" && input.separationFeet.trim()
          ? Number(input.separationFeet)
          : NaN;
    return endThreadNeedle(actor, input.sourceMessage, {
      reason: input.operation,
      escapeMessage: input.escapeMessage,
      confirmed: input.confirmed,
      holderMovedConfirmed: input.holderMovedConfirmed,
      separationFeet: n
    });
  }
  if (input.operation === "reviewPending" || input.operation === "reviewEnded")
    return reviewThreadNeedle(actor, input.sourceMessage, {
      confirmed: input.confirmed,
      resolution: input.operation === "reviewPending" ? "applyPending" : "alreadyEnded"
    });
  if (input.operation && input.operation !== "apply") throw Error(loc`Choose a listed Thread the Needle operation.`);
  return applyThreadNeedle(actor, input.sourceMessage, { confirmed: input.confirmed });
}
