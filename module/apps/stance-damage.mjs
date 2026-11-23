import { COMBAT_STANCES, stanceDamagePlan } from "../rules/combat-stance.mjs";
import { rollEvidence, rollEvidenceMatches } from "../rules/outcomes.mjs";
import { queueRuleState } from "./rule-resource-scope.mjs";
import { loc } from "../i18n.mjs";
import { decline } from "../error-notices.mjs";
const jobs = new Map(),
  stable = v =>
    JSON.stringify(v, (_k, x) =>
      x && typeof x === "object" && !Array.isArray(x)
        ? Object.fromEntries(
            Object.keys(x)
              .sort()
              .map(k => [k, x[k]])
          )
        : x
    );
const messages = () =>
    typeof game.messages?.values === "function" ? [...game.messages.values()] : [...(game.messages ?? [])],
  message = id => globalThis.fromUuidSync?.(id) ?? messages().find(m => m.uuid === id || m.id === id),
  key = (a, root) => a.uuid + ":" + root;
const visible = m => m && m.visible !== false && m.isContentVisible !== false && (!m.blind || game.user.isGM);
const alias = stance => (stance === "punishing" ? "punishingDamage" : "menacingDamage");
/** No secret die totals belong in Actor flags: only the facts that earn this fixed component. */
function eligibility(c) {
  return stable({
    actorUuid: c.actorUuid,
    checkKind: c.checkKind,
    resolved: c.resolved,
    successConfirmed: c.successConfirmed,
    superseded: c.superseded ?? null,
    weaponUuid: c.weaponUuid ?? null,
    ranged: c.attackContext?.ranged,
    defensive: c.attackContext?.disarm?.role === "defender",
    combatStance: c.attackContext?.combatStance,
    targetUuid: c.attackContext?.targetActorUuid ?? c.attackContext?.characterTarget?.actorUuid ?? null,
    targetName:
      c.attackContext?.characterTarget?.name ??
      c.attackContext?.meleeTradeoff?.manualTargetName ??
      c.attackContext?.meleeTrick?.manualTargetName ??
      null
  });
}
function root(actor, m) {
  const seen = new Set(),
    first = m.flags.spycraft2,
    stance = stable(first.attackContext.combatStance);
  let current = m;
  while (current && !seen.has(current.uuid)) {
    seen.add(current.uuid);
    const c = current.flags?.spycraft2;
    if (
      c?.actorUuid !== actor.uuid ||
      c.checkKind !== "attack" ||
      (c.weaponUuid ?? null) !== (first.weaponUuid ?? null) ||
      c.attackContext?.ranged !== false ||
      stable(c.attackContext?.combatStance) !== stance
    )
      throw Error(loc`The original stance attack or earned stance changed.`);
    if (!c.rerollOf) return current.uuid;
    const previous = message(c.rerollOf);
    if (previous?.flags?.spycraft2?.superseded !== current.uuid)
      throw Error(loc`Use the actually adopted original stance attack replacement.`);
    current = previous;
  }
  throw Error(loc`The original stance attack is missing or cyclic.`);
}
export function stanceDamageUseRows(actor) {
  const rows = actor.flags?.spycraft2?.stanceDamageUses ?? [],
    roots = new Set();
  if (!Array.isArray(rows)) throw Error(loc`Review the recorded stance damage uses.`);
  for (const r of rows) {
    const p = r?.proof;
    if (
      r?.version !== 1 ||
      typeof r.reservationId !== "string" ||
      !r.reservationId ||
      p?.version !== 1 ||
      p.reservationId !== r.reservationId ||
      p.rootAttackUuid !== r.rootAttackUuid ||
      typeof r.rootAttackUuid !== "string" ||
      !r.rootAttackUuid ||
      roots.has(r.rootAttackUuid) ||
      !["punishing", "menacing"].includes(p.stanceKey) ||
      p.amount !== 2 ||
      p.damageType !== (p.stanceKey === "punishing" ? "subdual" : "stress") ||
      p.actorUuid !== actor.uuid ||
      typeof p.sourceEvidence !== "string" ||
      !p.sourceEvidence ||
      (r.receiptUuid != null && (typeof r.receiptUuid !== "string" || !r.receiptUuid))
    )
      throw Error(loc`Review the recorded stance damage references.`);
    roots.add(r.rootAttackUuid);
  }
  return rows;
}
export function stanceDamageSource(actor, reference, { expectedKey = null } = {}) {
  const m = message(typeof reference === "string" ? reference : reference?.uuid),
    c = m?.flags?.spycraft2;
  if (!actor.isOwner || c?.actorUuid !== actor.uuid || !visible(m))
    throw Error(loc`Choose your own readable recorded stance attack; the GC resolves secret results.`);
  const plan = stanceDamagePlan(c, { expectedKey }),
    stanceKey = c.attackContext.combatStance.stance.key,
    whisper = [...(m.whisper ?? [])].map(u => (typeof u === "string" ? u : u.id)).sort();
  return {
    version: 1,
    actorUuid: actor.uuid,
    rootAttackUuid: root(actor, m),
    sourceMessage: m.uuid,
    stanceKey,
    ...plan,
    sourceEvidence: eligibility(c),
    visibility: { blind: m.blind === true, whisper }
  };
}
function sourceForProof(actor, p) {
  const current = stanceDamageSource(actor, p.sourceMessage, { expectedKey: p.stanceKey }),
    { reservationId, ...facts } = p;
  if (typeof reservationId !== "string" || !reservationId || stable(current) !== stable(facts))
    throw Error(loc`The original stance hit or component changed.`);
  return current;
}
async function write(actor, rows) {
  try {
    await actor.update({ "flags.spycraft2.stanceDamageUses": rows });
  } catch (e) {
    if (stable(actor.flags?.spycraft2?.stanceDamageUses) !== stable(rows)) throw e;
  }
  if (stable(actor.flags?.spycraft2?.stanceDamageUses) !== stable(rows))
    throw Error(loc`Review the saved stance damage use before retrying.`);
}
function validAlias(actor, m, facts) {
  const p = m.flags?.spycraft2?.[alias(facts.stanceKey)],
    parent = p && message(p.sourceMessage);
  return (
    m.flags?.spycraft2?.actorUuid === actor.uuid &&
    m.flags.spycraft2.checkKind === "stanceDamage" &&
    m.flags.spycraft2.actionDiceAllowed === false &&
    p?.version === 1 &&
    p.amount === 2 &&
    p.damageType === facts.damageType &&
    p.stanceId === facts.stanceId &&
    p.actionDiceAllowed === false &&
    parent &&
    root(actor, parent) === facts.rootAttackUuid &&
    rollEvidenceMatches(p.sourceEvidence, parent.flags.spycraft2)
  );
}
function recorded(actor, facts) {
  const own = messages().filter(m => m.flags?.spycraft2?.actorUuid === actor.uuid),
    found = own.filter(m => {
      const p = m.flags.spycraft2.stanceDamage,
        old = m.flags.spycraft2.punishingDamage ?? m.flags.spycraft2.menacingDamage;
      if (p?.rootAttackUuid === facts.rootAttackUuid) return true;
      if (!p && old?.sourceMessage) {
        const parent = message(old.sourceMessage);
        try {
          return parent && root(actor, parent) === facts.rootAttackUuid;
        } catch {
          return old.sourceMessage === facts.sourceMessage;
        }
      }
      return false;
    });
  if (found.length > 1) throw Error(loc`Multiple stance damage receipts for this attack require GC review.`);
  const receipt = found[0];
  if (receipt && !validAlias(actor, receipt, facts))
    throw Error(loc`The existing stance component does not match its actual recorded attack.`);
  return receipt ?? null;
}
function validateReceipt(actor, m, p) {
  if (!m || stable(m.flags?.spycraft2?.stanceDamage) !== stable(p) || !validAlias(actor, m, p))
    throw Error(loc`The posted stance component does not match its reserved original attack.`);
}
async function perform(actor, facts, input) {
  const reserved = await queueRuleState(actor, async () => {
    const fresh = stanceDamageSource(actor, facts.sourceMessage, { expectedKey: facts.stanceKey });
    if (stable(fresh) !== stable(facts))
      throw Error(loc`The original stance hit changed before its component was recorded.`);
    const rows = stanceDamageUseRows(actor),
      use = rows.find(r => r.rootAttackUuid === facts.rootAttackUuid),
      existing = recorded(actor, facts);
    if (use) {
      const { reservationId, ...old } = use.proof;
      if (stable(old) !== stable(facts))
        throw Error(loc`This attack already has a different recorded stance component.`);
      if (use.receiptUuid) {
        const m = message(use.receiptUuid);
        validateReceipt(actor, m, use.proof);
        return { existing: m };
      }
      throw Error(loc`An interrupted stance component awaits GC review.`);
    }
    if (existing) return { existing };
    if (input.damageConfirmed !== true)
      throw Error(loc`Confirm this hit and resolve its separate damage component after the target’s defenses.`);
    const reservationId = foundry.utils.randomID(),
      proof = { ...facts, reservationId };
    await write(actor, [
      ...rows,
      { version: 1, rootAttackUuid: facts.rootAttackUuid, reservationId, proof, receiptUuid: null }
    ]);
    return { proof };
  });
  if (reserved.existing) return reserved.existing;
  const p = reserved.proof,
    posted = () => {
      const matches = messages().filter(
        m =>
          m.flags?.spycraft2?.actorUuid === actor.uuid &&
          m.flags.spycraft2.stanceDamage?.reservationId === p.reservationId
      );
      if (matches.length > 1) throw Error(loc`Multiple posted stance components require GC review.`);
      if (matches[0]) validateReceipt(actor, matches[0], p);
      return matches[0] ?? null;
    },
    stamp = receipt =>
      queueRuleState(actor, async () => {
        const rows = stanceDamageUseRows(actor),
          use = rows.find(r => r.rootAttackUuid === p.rootAttackUuid);
        if (use?.reservationId !== p.reservationId) throw Error(loc`The stance component reservation changed.`);
        await write(
          actor,
          receipt
            ? rows.map(r => (r.reservationId === p.reservationId ? { ...r, receiptUuid: receipt.uuid } : r))
            : rows.filter(r => r.reservationId !== p.reservationId)
        );
      });
  try {
    sourceForProof(actor, p);
    const parent = message(p.sourceMessage),
      definition = COMBAT_STANCES[p.stanceKey],
      plan = stanceDamagePlan(parent.flags.spycraft2, { expectedKey: p.stanceKey }),
      receipt = await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        blind: p.visibility.blind,
        whisper: p.visibility.whisper,
        content:
          definition.name +
          ": <strong>2 " +
          p.damageType +
          ` ${loc`damage`}</strong> ${loc`in addition to the melee attack’s other damage (p.`}` +
          definition.page +
          "). " +
          (p.damageType === "stress"
            ? loc`Stress ignores DR; apply stress resistance and other applicable defenses separately. `
            : loc`Apply the target’s applicable defenses and health effect separately. `) +
          loc`This fixed component is separate from the weapon damage roll and cannot be boosted with action dice.`,
        flags: {
          spycraft2: {
            actorUuid: actor.uuid,
            checkKind: "stanceDamage",
            actionDiceAllowed: false,
            stanceDamage: p,
            [alias(p.stanceKey)]: {
              ...plan,
              sourceMessage: p.sourceMessage,
              sourceEvidence: rollEvidence(parent.flags.spycraft2)
            }
          }
        }
      });
    validateReceipt(actor, receipt, p);
    await stamp(receipt);
    return receipt;
  } catch (error) {
    let receipt;
    try {
      receipt = posted();
      await stamp(receipt);
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        loc`The stance component needs GC review; inspect its posted receipt before retrying.`
      );
    }
    if (receipt) return receipt;
    throw error;
  }
}
export async function settleStanceDamage(actor, reference, input = {}, options = {}) {
  const facts = stanceDamageSource(actor, reference, options),
    id = key(actor, facts.rootAttackUuid),
    current = jobs.get(id);
  if (current) {
    if (current.actor !== actor || stable(current.facts) !== stable(facts))
      throw Error(loc`The in-progress stance component source changed.`);
    return current.promise;
  }
  const entry = { actor, facts, promise: null };
  entry.promise = (async () => {
    try {
      return await perform(actor, facts, input);
    } finally {
      if (jobs.get(id) === entry) jobs.delete(id);
    }
  })();
  jobs.set(id, entry);
  return entry.promise;
}
export function settleMenacingDamage(actor, message, input = {}) {
  return settleStanceDamage(actor, message, input, { expectedKey: "menacing" });
}
export async function reviewStanceDamage(actor, { reservationId, confirmed = false } = {}) {
  if (!actor.isOwner || game.user.isGM !== true || confirmed !== true)
    throw Error(
      loc`The owning GC must review the actual stance component and check every client for a posted receipt.`
    );
  return queueRuleState(actor, async () => {
    const rows = stanceDamageUseRows(actor),
      use = rows.find(r => r.reservationId === reservationId && !r.receiptUuid);
    if (!use) throw Error(loc`Choose a pending stance component.`);
    if (jobs.has(key(actor, use.rootAttackUuid))) throw Error(loc`This client is still recording that component.`);
    sourceForProof(actor, use.proof);
    const receipt = recorded(actor, use.proof);
    if (receipt) validateReceipt(actor, receipt, use.proof);
    await write(
      actor,
      receipt
        ? rows.map(r => (r.reservationId === reservationId ? { ...r, receiptUuid: receipt.uuid } : r))
        : rows.filter(r => r.reservationId !== reservationId)
    );
    return { reservationId, receiptUuid: receipt?.uuid ?? null, released: !receipt };
  });
}
export async function manageStanceDamage(actor, input = {}, options = {}) {
  if (!actor.isOwner) return null;
  if (!Object.hasOwn(input, "sourceMessage") && !Object.hasOwn(input, "operation")) {
    const eligible = messages()
        .filter(visible)
        .flatMap(m => {
          try {
            const p = stanceDamageSource(actor, m, options);
            return [{ m, p }];
          } catch {
            return [];
          }
        }),
      pending = stanceDamageUseRows(actor).filter(
        r => !r.receiptUuid && (!options.expectedKey || r.proof.stanceKey === options.expectedKey)
      ),
      esc = foundry.utils.escapeHTML;
    if (!eligible.length && !pending.length)
      return decline(loc`No resolved stance hit or interrupted component is available.`);
    const title = options.expectedKey ? COMBAT_STANCES[options.expectedKey].name + " damage" : loc`Stance damage`;
    input = await foundry.applications.api.DialogV2.input({
      window: { title },
      rejectClose: false,
      content:
        `<div class="spycraft2-roll-options"><p>${loc`Confirm and finish the actual melee hit in chat first. Record its additional fixed 2 damage once. Resolve the component’s defenses and health separately; stress ignores DR but retains applicable stress resistance. No action die can increase this fixed component.`}</p><label>${loc`Operation`} <select name="operation">` +
        eligible
          .map(
            ({ m, p }, i) =>
              '<option value="attack|' +
              esc(m.uuid) +
              '">' +
              esc(
                COMBAT_STANCES[p.stanceKey].name +
                  ": melee hit " +
                  (i + 1) +
                  (m.flags.spycraft2.rollCombat?.round ? " in round " + m.flags.spycraft2.rollCombat.round : "") +
                  " — 2 " +
                  p.damageType
              ) +
              "</option>"
          )
          .join("") +
        (game.user.isGM
          ? pending
              .map(
                r =>
                  '<option value="review|' +
                  esc(r.reservationId) +
                  '">' +
                  esc("GC review interrupted " + COMBAT_STANCES[r.proof.stanceKey].name + " component") +
                  "</option>"
              )
              .join("")
          : "") +
        `</select></label><label><input name="damageConfirmed" type="checkbox" /> ${loc`The GC confirms this hit’s separate component; for review, no client is still recording it and I checked for a posted receipt`}</label></div>`
    });
    if (!input) return null;
  }
  if (Object.hasOwn(input, "sourceMessage")) return settleStanceDamage(actor, input.sourceMessage, input, options);
  if (typeof input.operation !== "string") throw Error(loc`Choose a recorded stance hit or component review.`);
  const [kind, id] = input.operation.split("|");
  if (kind === "attack") return settleStanceDamage(actor, id, input, options);
  if (kind === "review")
    return reviewStanceDamage(actor, { reservationId: id, confirmed: input.damageConfirmed === true });
  throw Error(loc`Choose a listed stance damage operation.`);
}
