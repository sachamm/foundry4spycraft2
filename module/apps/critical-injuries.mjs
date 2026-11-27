import {
  criticalInjuryRollPlan,
  criticalInjuryResult,
  validateCriticalInjuryRecord,
  recoveredInjuryRollJSON,
  CRITICAL_INJURY_HEALING_NOTE
} from "../rules/critical-injuries.mjs";
import { queueResources } from "../services/transactions.mjs";
import { loc } from "../i18n.mjs";
import { formDialog } from "./dialog-kit.mjs";
import { withUndo } from "./undo.mjs";
const history = a => a.flags?.spycraft2?.criticalInjuryRolls ?? {};
const saved = (a, id) => history(a)[id];
const proof = (a, r) => {
  try {
    const current = saved(a, r.id);
    validateCriticalInjuryRecord(current);
    return (
      current.id === r.id &&
      current.state === r.state &&
      current.rollJSON === r.rollJSON &&
      current.formula === r.formula &&
      current.source === r.source &&
      current.damage === r.damage
    );
  } catch {
    return false;
  }
};
async function store(a, r) {
  try {
    await a.update({ [`flags.spycraft2.criticalInjuryRolls.${r.id}`]: r });
  } catch (error) {
    if (!proof(a, r)) throw error;
  }
  if (!proof(a, r))
    throw new Error(loc`The critical injury record did not settle. The GC must review its original roll.`);
}
function existingMessage(a, r) {
  const matches = [...(game.messages?.values?.() ?? game.messages ?? [])].filter(
    m => m.flags?.spycraft2?.actorUuid === a.uuid && m.flags.spycraft2.criticalInjuryRoll?.id === r.id
  );
  for (const m of matches) {
    const saved = m.flags.spycraft2.criticalInjuryRoll;
    validateCriticalInjuryRecord(saved);
    if (["id", "source", "die", "damage", "formula", "rollJSON"].some(k => saved[k] !== r[k]))
      throw new Error(loc`The injury receipt and saved original result disagree. The GC must review them.`);
  }
  return matches[0];
}
async function deliver(a, r) {
  const { result } = validateCriticalInjuryRecord(r);
  if (!result) throw new Error(loc`The GC must recover the original injury die; this event cannot be rolled again.`);
  const existing = existingMessage(a, r);
  if (existing) return existing;
  const esc = foundry.utils.escapeHTML,
    roll = Roll.fromData(JSON.parse(r.rollJSON));
  const data = {
    speaker: ChatMessage.getSpeaker({ actor: a }),
    flavor: `${loc`Table of Ouch — ${esc(result.name)}`}<br><small>${loc`${esc(r.source)}; damage suffered ${r.damage}; ${r.die === 10 ? loc`Guts: d10` : loc`standard d20`}. ${result.listed ? loc`Surgery DC ${result.surgeryDC}; healing ${esc(result.healingTime)}. ` : ""}${esc(result.notes)} ${esc(CRITICAL_INJURY_HEALING_NOTE)} Apply injury effects and any stress/healing rolls at the table.`}</small>`,
    flags: {
      spycraft2: { actorUuid: a.uuid, checkKind: "criticalInjury", actionDiceAllowed: false, criticalInjuryRoll: r }
    }
  };
  try {
    return await roll.toMessage(data);
  } catch (error) {
    const posted = existingMessage(a, r);
    if (posted) return posted;
    throw error;
  }
}
/** What has been done for each rolled injury: successful Surgery checks and whether it has healed. */
const careOf = (actor, id) => actor.flags?.spycraft2?.criticalInjuryCare?.[id] ?? {};

/**
 * One sheet row per rolled Table of Ouch injury (pp.329, 332): its name, effect, healing time and Surgery DC, and
 * what Surgery (p.142) has taken off. A record that still needs the GC is left to `criticalInjuryReviews`.
 */
export function criticalInjuryRows(actor) {
  return Object.entries(history(actor)).flatMap(([id, record]) => {
    let result;
    try {
      ({ result } = validateCriticalInjuryRecord(record));
    } catch {
      return [];
    }
    if (!result) return [];
    const care = careOf(actor, id),
      surgeries = Math.max(0, Math.trunc(Number(care.surgeries) || 0));
    return [
      {
        id,
        name: result.name,
        effect: result.notes,
        source: record.source,
        facts: result.listed
          ? loc`Total ${result.total} · Surgery DC ${result.surgeryDC} · healing ${result.healingTime}`
          : loc`Total ${result.total}`,
        surgery: surgeries ? loc`Surgery has taken ${surgeries * 2} off the healing time.` : "",
        canSurgery: result.listed && care.healed !== true,
        healed: care.healed === true
      }
    ];
  });
}

const careUpdate = (actor, id, change) => actor.update({ [`flags.spycraft2.criticalInjuryCare.${id}`]: change });
const rolledInjury = (actor, id) => criticalInjuryRows(actor).find(row => row.id === id) ?? null;

/** A successful Surgery check at the injury's DC: its healing time drops by 2 (p.142). */
export async function recordInjurySurgery(actor, id) {
  const row = actor?.isOwner ? rolledInjury(actor, id) : null;
  if (!row?.canSurgery) return null;
  const care = careOf(actor, id);
  return withUndo([actor], loc`Surgery on ${row.name}: ${actor.name}`, async () => {
    await careUpdate(actor, id, { ...care, surgeries: Math.max(0, Math.trunc(Number(care.surgeries) || 0)) + 1 });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="spycraft2 chat-note"><p>${loc`Surgery on ${foundry.utils.escapeHTML(row.name)}: the healing time drops by 2. At 0 it has healed (p.142).`}</p></div>`
    });
    return true;
  });
}

/** The injury's healing time has run out, by time or by Surgery: it no longer shows as open. */
export async function markInjuryHealed(actor, id) {
  const row = actor?.isOwner ? rolledInjury(actor, id) : null;
  if (!row || row.healed) return null;
  return withUndo([actor], loc`Injury healed: ${row.name}`, async () => {
    await careUpdate(actor, id, { ...careOf(actor, id), healed: true });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="spycraft2 chat-note"><p>${loc`${foundry.utils.escapeHTML(actor.name)}'s ${foundry.utils.escapeHTML(row.name)} has healed. Remove any effect it left by hand.`}</p></div>`
    });
    return true;
  });
}

/** Saved injury records that still need the GC: an interrupted roll or a record that no longer checks out. */
export const criticalInjuryReviews = actor =>
  Object.entries(history(actor)).map(([id, r]) => ({
    id,
    state: r?.state ?? "needs review",
    label:
      r?.state === "rolled"
        ? loc`Original roll saved`
        : r?.state === "awaitingRoll"
          ? loc`GC must recover original roll`
          : loc`Saved record needs review`,
    source: r?.source ?? loc`Malformed saved injury record`
  }));
export async function rollCriticalInjury(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  let input = options;
  if (!Object.hasOwn(input, "id")) {
    input = await formDialog({
      title: loc`Roll critical injury — Table of Ouch`,
      intro: loc`Use only after the GC resolves the actual injury trigger, critical activation or failed Fortitude save. This rolls the injury; it does not apply damage, injury effects or healing.`,
      fields: [
        { text: "id", label: loc`Unique injury event reference` },
        { text: "source", label: loc`Source / confirmed trigger` },
        { number: "damage", label: loc`Damage actually suffered after defenses`, min: "0", step: "1" },
        { check: "confirmed", label: loc`The GC confirms this event directs the character to the Table of Ouch` }
      ]
    });
    if (!input) return null;
  }
  const damage = typeof input.damage === "string" && input.damage.trim() ? Number(input.damage) : input.damage;
  return queueResources([actor], async () => {
    if (!actor.isOwner) throw new Error(loc`You must own the injured character.`);
    const plan = criticalInjuryRollPlan(actor.system, { ...input, damage }),
      previous = saved(actor, plan.id);
    if (previous) {
      const old = validateCriticalInjuryRecord(previous).plan;
      if (old.id !== plan.id || old.damage !== plan.damage || old.source !== plan.source)
        throw new Error(loc`This event reference already belongs to a different injury.`);
      return deliver(actor, previous);
    }
    const pending = { ...plan, state: "awaitingRoll" };
    await store(actor, pending);
    const roll = await new Roll(plan.formula).evaluate(),
      result = criticalInjuryResult(plan, roll.total - plan.damage),
      record = {
        ...pending,
        state: "rolled",
        dieResult: result.dieResult,
        result,
        rollJSON: JSON.stringify(roll.toJSON())
      };
    await store(actor, record);
    return deliver(actor, record);
  });
}
export async function reviewCriticalInjury(actor, id, options = {}) {
  if (!game.user.isGM || !actor.isOwner)
    throw new Error(loc`Only an owning GC can review an original critical injury roll.`);
  const before = saved(actor, id),
    snapshot = JSON.stringify(before),
    { plan } = validateCriticalInjuryRecord(before);
  if (plan.id !== id) throw new Error(loc`The saved injury reference disagrees with its history entry.`);
  let input = options;
  if (before.state === "rolled")
    return queueResources([actor], () => {
      if (!game.user.isGM || !actor.isOwner) throw new Error(loc`Only an owning GC can show the original injury.`);
      if (JSON.stringify(saved(actor, id)) !== snapshot)
        throw new Error(loc`The saved injury changed. Review it again.`);
      return deliver(actor, saved(actor, id));
    });
  if (!Object.hasOwn(input, "dieResult")) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Recover original critical injury roll` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Recover the actual original d${plan.die} result for ${foundry.utils.escapeHTML(id)}. Do not roll this event again. Review its original chat/log result or resolve it explicitly at the table.`}</p><label>${loc`Verified original die`} <input name="dieResult" type="number" min="1" max="${plan.die}" step="1" /></label><label>${loc`Recovery evidence / GC adjudication`} <input name="resolution" /></label><label><input name="confirmed" type="checkbox" /> ${loc`I confirm this recovered original result`}</label></div>`
    });
    if (!input) return null;
  }
  const dieResult =
    typeof input.dieResult === "string" && input.dieResult.trim() ? Number(input.dieResult) : input.dieResult;
  return queueResources([actor], async () => {
    if (!game.user.isGM || !actor.isOwner) throw new Error(loc`Only an owning GC can recover this result.`);
    if (JSON.stringify(saved(actor, id)) !== snapshot) throw new Error(loc`The saved injury changed. Review it again.`);
    if (
      input.confirmed !== true ||
      typeof input.resolution !== "string" ||
      !input.resolution.trim() ||
      input.resolution.length > 500
    )
      throw new Error(loc`Confirm the original result and recovery evidence.`);
    const result = criticalInjuryResult(plan, dieResult),
      record = {
        ...before,
        state: "rolled",
        dieResult,
        result,
        rollJSON: recoveredInjuryRollJSON(plan, dieResult),
        recovery: { resolution: input.resolution.trim(), userId: game.user.id }
      };
    await store(actor, record);
    return deliver(actor, record);
  });
}
