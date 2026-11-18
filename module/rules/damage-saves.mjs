import { validateDamageLedger, accumulatedDamagePlan } from "./accumulated-damage.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function pendingDamageSave(actor, eventId, { allowSettling = false } = {}) {
  const ledger = validateDamageLedger(actor.system.accumulatedDamage),
    id = ledger.pending[0];
  if (!id) return null;
  if (eventId && eventId !== id) throw new Error("Resolve accumulated-damage saves in their recorded order.");
  const record = actor.flags?.spycraft2?.damageEvents?.[id],
    save = record?.save;
  if (
    record?.id !== id ||
    !(record.state === "pending" || (allowSettling && record.state === "settling")) ||
    !["stress", "subdual"].includes(record.kind) ||
    !save ||
    save.key !== (record.kind === "stress" ? "will" : "fort") ||
    !Number.isSafeInteger(save.dc) ||
    save.dc < 12 ||
    save.dc > 32 ||
    !Number.isFinite(record.at)
  )
    throw new Error("Review the pending damage-save receipt before rolling.");
  const expected = accumulatedDamagePlan(
    { [record.kind + "Threshold"]: save.threshold },
    {
      kind: record.kind,
      currentDamage: record.before,
      newDamage: record.newDamage,
      criticalHit: record.criticalHit,
      confirmed: true
    }
  );
  if (
    !expected.saveRequired ||
    expected.dc !== save.dc ||
    expected.tier !== save.tier ||
    expected.total !== record.total
  )
    throw new Error("The pending save no longer matches its recorded damage calculation.");
  return record;
}
export function damageSaveContext(record, receiptId, at) {
  if (
    typeof receiptId !== "string" ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(receiptId) ||
    !Number.isFinite(at) ||
    at < record.at
  )
    throw new Error("Review the damage-event timing and save receipt.");
  return {
    version: 1,
    eventId: record.id,
    source: record.source,
    kind: record.kind,
    key: record.save.key,
    dc: record.save.dc,
    threshold: record.save.threshold,
    tier: record.save.tier,
    eventAt: record.at,
    receiptId,
    contextAt: at,
    contextConfirmed: true
  };
}
export function damageSaveMessageMatches(message, actor, record) {
  const check = message?.flags?.spycraft2,
    c = check?.damageSave;
  if (!c || check.actorUuid !== actor.uuid || check.checkKind !== "save" || check.checkId !== record.save.key)
    return false;
  try {
    return same(c, damageSaveContext(record, c.receiptId, c.contextAt));
  } catch {
    return false;
  }
}
export function currentDamageSaveMessage(actor, record, messages) {
  if (!record.saveMessageId) return null;
  const list = [...messages],
    find = ref => list.find(m => m.id === ref || m.uuid === ref),
    seen = new Set();
  let message = find(record.saveMessageId);
  while (message) {
    if (
      seen.has(message.id) ||
      !damageSaveMessageMatches(message, actor, record) ||
      message.flags.spycraft2.damageSave.receiptId !== record.saveReceiptId
    )
      throw new Error("Review the recorded damage-save result chain.");
    seen.add(message.id);
    const next = message.flags.spycraft2.superseded;
    if (!next) return message;
    const replacement = find(next);
    if (!replacement || replacement.flags?.spycraft2?.rerollOf !== (message.uuid ?? message.id))
      throw new Error("Review the replacement damage-save result.");
    message = replacement;
  }
  throw new Error("The recorded damage save is unavailable. Review it before rolling again.");
}
export function damageSaveSourceSnapshot(actor, key) {
  return JSON.stringify({
    save: actor.system.saves?.[key],
    abilities: actor.system.abilities,
    classLevels: actor.system.classLevels,
    feats: actor.system.activeFeatNames,
    conditions: actor.system.conditionContext,
    shaken: actor.system.shakenState,
    mentalLeap: actor.system.mentalLeapState,
    time: globalThis.game?.time?.worldTime
  });
}
export function validateDamageSaveRoll(actor, context, kind, key) {
  if (!context) return;
  const record = pendingDamageSave(actor, context.eventId);
  if (
    !record ||
    kind !== "save" ||
    key !== record.save.key ||
    !same(context, damageSaveContext(record, context.receiptId, context.contextAt))
  )
    throw new Error("The check does not match the next pending damage save.");
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "damageSaveRoll",
  order: 1670,
  record: ["damageSave"],
  validate: ({ actor, options, checkKind, checkId }) =>
    validateDamageSaveRoll(actor, options.damageSave, checkKind, checkId)
});
