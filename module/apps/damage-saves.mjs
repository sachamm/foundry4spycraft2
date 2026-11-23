import { damageLedgerSnapshot } from "../rules/accumulated-damage.mjs";
import {
  pendingDamageSave,
  damageSaveContext,
  damageSaveMessageMatches,
  currentDamageSaveMessage,
  damageSaveSourceSnapshot
} from "../rules/damage-saves.mjs";
import { queueResources } from "../services/transactions.mjs";
import { loc } from "../i18n.mjs";
import { same } from "../rules/equal.mjs";
export async function rollPendingDamageSave(actor, options = {}) {
  if (actor?.type !== "agent" || !actor.isOwner) return null;
  const expected = damageLedgerSnapshot(actor),
    record = pendingDamageSave(actor, options.eventId);
  if (!record) return null;
  const existing = currentDamageSaveMessage(actor, record, game.messages ?? []);
  if (existing) {
    if (existing.blind && !game.user.isGM) throw new Error(loc`The GC resolves this secret save.`);
    if (options.confirmed !== true) {
      const esc = foundry.utils.escapeHTML,
        c = existing.flags.spycraft2;
      await foundry.applications.api.DialogV2.input({
        window: { title: loc`Pending damage save` },
        rejectClose: false,
        content: `<div class="spycraft2-roll-options"><p>${loc`${esc(record.source)}: ${record.kind === "stress" ? loc`Will` : loc`Fortitude`} DC ${record.save.dc}.`}</p><p>${loc`Current recorded result ${esc(c.effectiveTotal ?? c.rawTotal ?? "unavailable")}. Outcome: ${typeof c.successConfirmed === "boolean" ? (c.successConfirmed ? "success" : "failure") : loc`not confirmed`}.`}</p><p>${loc`This event already has a save. Use its chat result for eligible boosts, rerolls and outcome confirmation. Damage settlement remains separate.`}</p></div>`
      });
    }
    return existing;
  }
  let input = options;
  if (input.confirmed !== true) {
    const esc = foundry.utils.escapeHTML;
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Resolve next damage save` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`${esc(record.source)}: ${record.kind === "stress" ? loc`Will` : loc`Fortitude`} DC ${record.save.dc}.`}</p><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms this save is being resolved in its correct damage-event context, including earlier pending results; the current save modifiers and conditions apply`}</label><p>${loc`The recorded DC remains fixed. The actual save keeps its normal eligible options. This rolls the save without settling its outcome or applying conditions.`}</p></div>`
    });
    if (!input) return null;
  }
  if (input.confirmed !== true) return null;
  return queueResources([actor], async () => {
    if (!actor.isOwner) throw new Error(loc`Ownership changed before the damage save.`);
    const current = pendingDamageSave(actor, options.eventId);
    if (!current || current.id !== record.id) throw new Error(loc`The pending damage save changed.`);
    const already = currentDamageSaveMessage(actor, current, game.messages ?? []);
    if (already) {
      if (already.blind && !game.user.isGM) throw new Error(loc`The GC resolves this secret save.`);
      return already;
    }
    if (!same(damageLedgerSnapshot(actor), expected))
      throw new Error(loc`The damage ledger changed while the save was prepared.`);
    const source = damageSaveSourceSnapshot(actor, record.save.key),
      validate = () => {
        if (
          !actor.isOwner ||
          !same(damageLedgerSnapshot(actor), expected) ||
          damageSaveSourceSnapshot(actor, record.save.key) !== source
        )
          throw new Error(loc`The pending event or current save context changed. Review it before rolling.`);
      };
    const roots = () =>
      [...(game.messages ?? [])].filter(m => damageSaveMessageMatches(m, actor, record) && !m.flags.spycraft2.rerollOf);
    let root;
    const prior = roots();
    if (prior.length > 1) throw new Error(loc`Multiple original damage saves require GC review.`);
    root = prior[0];
    if (!root) {
      const context = damageSaveContext(record, foundry.utils.randomID(), game.time.worldTime);
      try {
        root = await actor.rollSave(record.save.key, {
          askContext: true,
          damageSave: context,
          validateDamageSave: validate
        });
      } catch (error) {
        const posted = roots().filter(m => m.flags.spycraft2.damageSave.receiptId === context.receiptId);
        if (posted.length !== 1) throw error;
        root = posted[0];
      }
      if (!root) return null;
    }
    if (!damageSaveMessageMatches(root, actor, record))
      throw new Error(loc`The actual save has no matching damage-event receipt.`);
    if (!actor.isOwner || !same(damageLedgerSnapshot(actor), expected))
      throw new Error(loc`The damage event changed after the save was posted. Preserve that result for review.`);
    if (root.blind && !game.user.isGM) throw new Error(loc`The GC resolves this secret save.`);
    const updated = { ...record, saveMessageId: root.id, saveReceiptId: root.flags.spycraft2.damageSave.receiptId };
    try {
      await actor.update({ ["flags.spycraft2.damageEvents." + record.id]: updated });
    } catch (error) {
      if (!same(actor.flags?.spycraft2?.damageEvents?.[record.id], updated)) throw error;
    }
    if (!same(actor.flags?.spycraft2?.damageEvents?.[record.id], updated))
      throw new Error(loc`Review the posted save and its event binding before retrying.`);
    return currentDamageSaveMessage(actor, updated, game.messages ?? []);
  });
}
