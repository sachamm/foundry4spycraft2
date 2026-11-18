import {
  criticalInjuryRollPlan,
  criticalInjuryResult,
  validateCriticalInjuryRecord,
  recoveredInjuryRollJSON,
  CRITICAL_INJURY_HEALING_NOTE
} from "../rules/critical-injuries.mjs";
import { queueResources } from "../rules/transactions.mjs";
import { loc } from "../i18n.mjs";
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
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Roll critical injury — Table of Ouch` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Use only after the GC resolves the actual injury trigger, critical activation or failed Fortitude save. This rolls the injury; it does not apply damage, injury effects or healing.`}</p><label>${loc`Unique injury event reference`} <input name="id" /></label><label>${loc`Source / confirmed trigger`} <input name="source" /></label><label>${loc`Damage actually suffered after defenses`} <input name="damage" type="number" min="0" step="1" /></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms this event directs the character to the Table of Ouch`}</label></div>`
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
