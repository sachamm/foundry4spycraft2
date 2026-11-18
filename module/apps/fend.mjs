import { validRecordedMeleeTrick } from "../rules/melee-tricks.mjs";
import { fendTiming, fendMovementPlan, validFendTiming, sameFendTiming, stableFend as stable } from "../rules/fend.mjs";
import { stanceMovementState } from "../rules/stance-movement.mjs";
import { queueRuleState } from "./rule-resource-scope.mjs";
const messages = () => [...(game.messages ?? [])],
  message = uuid => globalThis.fromUuidSync?.(uuid) ?? messages().find(m => m.uuid === uuid),
  visible = m => m && m.visible !== false && m.isContentVisible !== false && (!m.blind || game.user.isGM);
function declaration(c) {
  return {
    actorUuid: c.actorUuid,
    checkKind: c.checkKind,
    weaponUuid: c.weaponUuid,
    attackAction: c.attackContext?.attackAction,
    ranged: c.attackContext?.ranged,
    meleeFeatTrick: c.attackContext?.meleeFeatTrick,
    meleeTrick: c.attackContext?.meleeTrick,
    rollCombat: c.rollCombat ?? null
  };
}
export function fendSource(actor, reference) {
  const m = message(typeof reference === "string" ? reference : reference?.uuid),
    c = m?.flags?.spycraft2,
    p = c?.attackContext?.meleeTrick;
  if (
    !actor.isOwner ||
    !visible(m) ||
    !messages().includes(m) ||
    c?.actorUuid !== actor.uuid ||
    c.checkKind !== "attack" ||
    c.resolved !== true ||
    typeof c.successConfirmed !== "boolean" ||
    c.superseded ||
    p?.key !== "fend" ||
    !validRecordedMeleeTrick(p, c.attackContext) ||
    c.attackContext.disarm?.active === true
  )
    throw Error("Choose your actual readable, finished Standard Attack declared with Fend, hit or miss.");
  const initial = stable(declaration(c)),
    seen = new Set();
  let root = m;
  while (root && !seen.has(root.uuid)) {
    seen.add(root.uuid);
    const x = root.flags?.spycraft2;
    if (
      !messages().includes(root) ||
      !visible(root) ||
      x?.actorUuid !== actor.uuid ||
      stable(declaration(x)) !== initial
    )
      throw Error("The original Fend attack or its declaration changed.");
    if (!x.rerollOf) break;
    const previous = message(x.rerollOf);
    if (previous?.flags?.spycraft2?.superseded !== root.uuid)
      throw Error("Use the actually adopted original Fend attack replacement.");
    root = previous;
  }
  if (!root || root.flags.spycraft2.rerollOf) throw Error("The original Fend attack is missing or cyclic.");
  if (
    p.timing.combat
      ? c.rollCombat?.id !== p.timing.combat.id ||
        c.rollCombat?.round !== p.timing.combat.round ||
        c.rollCombat?.combatantId !== p.timing.combat.combatantId
      : c.rollCombat != null
  )
    throw Error("The Fend declaration and actual attack combat source disagree.");
  return {
    message: m,
    facts: {
      version: 1,
      actorUuid: actor.uuid,
      sourceMessage: m.uuid,
      rootAttackUuid: root.uuid,
      sourceEvidence: initial,
      originalTiming: structuredClone(p.timing),
      visibility: {
        blind: m.blind === true,
        whisper: [...(m.whisper ?? [])].map(u => (typeof u === "string" ? u : u.id)).sort()
      }
    }
  };
}
export function fendRows(actor) {
  const rows = actor.flags?.spycraft2?.fendMovements ?? [],
    roots = new Set();
  if (!Array.isArray(rows)) throw Error("Review the completed Fend movement history.");
  for (const r of rows) {
    const p = r?.proof,
      m = p?.movement,
      t = p?.originalTiming,
      key = t?.combat ? t.combat.id + ":" + t.combat.round : "world:" + Math.floor(t?.worldTime / 6);
    if (
      r?.version !== 1 ||
      typeof r.id !== "string" ||
      !r.id ||
      p?.version !== 1 ||
      p.actorUuid !== actor.uuid ||
      typeof p.rootAttackUuid !== "string" ||
      !p.rootAttackUuid ||
      roots.has(p.rootAttackUuid) ||
      typeof p.sourceMessage !== "string" ||
      !p.sourceMessage ||
      typeof p.sourceEvidence !== "string" ||
      !p.sourceEvidence ||
      !validFendTiming(t) ||
      m?.version !== 1 ||
      m.distanceFeet !== 5 ||
      !sameFendTiming(t, m.timing) ||
      !Number.isFinite(m.priorFeet) ||
      m.priorFeet < 0 ||
      m.roundMovement?.version !== 1 ||
      m.roundMovement.key !== key ||
      m.roundMovement.feet !== m.priorFeet + 5 ||
      !Number.isFinite(m.roundMovement.feet) ||
      m.immediateConfirmed !== true ||
      m.routeConfirmed !== true ||
      m.movementCompleted !== true ||
      (r.receiptUuid != null && (typeof r.receiptUuid !== "string" || !r.receiptUuid))
    )
      throw Error("Review the saved Fend source,5ft movement and completed round total.");
    roots.add(p.rootAttackUuid);
  }
  return rows;
}
function posted(actor, row) {
  const all = messages().filter(
    m =>
      m.flags?.spycraft2?.actorUuid === actor.uuid &&
      m.flags.spycraft2.checkKind === "fendMovement" &&
      m.flags.spycraft2.fendMovement?.id === row.id
  );
  if (all.length > 1) throw Error("Review duplicate Fend movement receipts.");
  const m = all[0];
  if (
    m &&
    ((m.blind === true) !== row.proof.visibility.blind ||
      stable([...(m.whisper ?? [])].map(u => (typeof u === "string" ? u : u.id)).sort()) !==
        stable(row.proof.visibility.whisper) ||
      m.flags.spycraft2.actionDiceAllowed !== false ||
      m.flags.spycraft2.rerollOf ||
      stable(m.flags.spycraft2.fendMovement) !== stable({ id: row.id, ...row.proof }) ||
      (row.receiptUuid && row.receiptUuid !== m.uuid))
  )
    throw Error("The original Fend movement receipt changed.");
  return m ?? null;
}
async function recordReceipt(actor, row) {
  let m = posted(actor, row);
  if (!m && row.receiptUuid) throw Error("Review the missing original Fend movement receipt; do not move again.");
  if (!m)
    try {
      m = await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        blind: row.proof.visibility.blind,
        whisper: row.proof.visibility.whisper,
        content:
          "Fend (p.179): confirmed completed5ft movement immediately after the recorded Standard Attack. The completed round movement total is recorded once. This receipt does not move a token or grant another action.",
        flags: {
          spycraft2: {
            actorUuid: actor.uuid,
            checkKind: "fendMovement",
            actionDiceAllowed: false,
            fendMovement: { id: row.id, ...row.proof }
          }
        }
      });
    } catch (e) {
      m = posted(actor, row);
      if (!m) throw e;
    }
  if (!m || posted(actor, row)?.uuid !== m.uuid)
    throw Error("The completed Fend movement needs its original receipt reviewed.");
  if (row.receiptUuid !== m.uuid) {
    const rows = fendRows(actor);
    await actor.update({
      "flags.spycraft2.fendMovements": rows.map(r => (r.id === row.id ? { ...r, receiptUuid: m.uuid } : r))
    });
  }
  return m;
}
export async function recordFendMovement(actor, input = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  if (!Object.hasOwn(input, "sourceMessage")) {
    const esc = foundry.utils.escapeHTML,
      history = fendRows(actor),
      choices = messages().flatMap(m => {
        try {
          const s = fendSource(actor, m);
          return [{ m, s }];
        } catch {
          return [];
        }
      });
    if (!choices.length) {
      ui.notifications.info?.("No finished attack declared with Fend is available.");
      return null;
    }
    const timing = fendTiming(actor),
      state = stanceMovementState({ ...actor.system, worldTime: timing.worldTime }, timing.combat);
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "Record Fend movement" },
      rejectClose: false,
      content:
        '<div class="spycraft2-roll-options"><p>Finish the actual Standard Attack declared with Fend, hit or miss. Confirm its legal5ft move completed immediately afterward. First use Record round movement for all earlier movement this round. Resolve the route and move the token at the table first; this control records completed movement and does not grant an action or move again. Respect all current conditions and stance round limits. A Recorded source is review only: do not move again.</p><label>Recorded Fend attack <select name="sourceMessage">' +
        choices
          .map(({ m, s }, i) => {
            const old = history.find(r => r.proof.rootAttackUuid === s.facts.rootAttackUuid),
              label = old
                ? old.receiptUuid
                  ? "Recorded — review only"
                  : "Recorded — recover receipt"
                : "New completed Fend move",
              weapon =
                actor.items?.get?.(m.flags.spycraft2.attackContext.meleeTrick.weaponId)?.name ?? "Recorded polearm",
              when = s.facts.originalTiming.combat ? "round " + s.facts.originalTiming.combat.round : "outside combat";
            return (
              '<option value="' +
              esc(m.uuid) +
              '">' +
              esc(label + " · " + weapon + " · " + when + " · attack " + (i + 1)) +
              "</option>"
            );
          })
          .join("") +
        "</select></label><p>Current recorded round movement " +
        state.feet +
        'ft.</p><label>New total completed movement this round, including Fend (ft.) <input name="totalFeet" type="number" min="0" step="any" value="' +
        (state.feet + 5) +
        '" /></label><label><input name="routeConfirmed" type="checkbox" /> The GC confirms this legal5ft route and its actual destination, terrain and posture</label><label><input name="movementCompleted" type="checkbox" /> This5ft move was completed exactly once as part of Fend</label><label><input name="immediateConfirmed" type="checkbox" /> It immediately followed that Standard Attack with no intervening action; a previously recorded move is only being reviewed</label></div>'
    });
    if (!input) return null;
  }
  const source = fendSource(actor, input.sourceMessage),
    expected = stable(source.facts),
    totalFeet =
      typeof input.totalFeet === "number"
        ? input.totalFeet
        : typeof input.totalFeet === "string" && input.totalFeet.trim()
          ? Number(input.totalFeet)
          : NaN;
  return queueRuleState(
    actor,
    async () => {
      const fresh = fendSource(actor, source.message);
      if (stable(fresh.facts) !== expected) throw Error("The Fend attack changed while recording its movement.");
      const rows = fendRows(actor),
        prior = rows.find(r => r.proof.rootAttackUuid === fresh.facts.rootAttackUuid);
      if (prior) {
        const { movement, ...facts } = prior.proof;
        if (stable(facts) !== expected)
          throw Error("This original attack already has a different completed Fend source.");
        return recordReceipt(actor, prior);
      }
      const movement = fendMovementPlan(actor.system, {
          ...input,
          totalFeet,
          timing: fendTiming(actor),
          originalTiming: fresh.facts.originalTiming
        }),
        row = { version: 1, id: foundry.utils.randomID(), proof: { ...fresh.facts, movement }, receiptUuid: null };
      await actor.update({
        "flags.spycraft2.fendMovements": [...rows, row],
        "system.stanceRoundMovement": movement.roundMovement
      });
      return recordReceipt(actor, row);
    },
    { messages: [source.message] }
  );
}
