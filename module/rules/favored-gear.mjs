/**
 * Favored Gear, Signature Gear and Trademark Gear, p.197.
 *
 * - Favored Gear: one extra Possession, the item with `possessionSource: "favoredGear"`. It is not charged to the
 *   Wealth allowance, and its Caliber may not exceed one third of career level (rounded up). The per-session action
 *   dice it gains or costs against the mission Caliber are left to the GC: they need a die pool restricted to one
 *   item, which the system does not have.
 * - Signature Gear (repeatable): a favored item marked `signatureGear: 1` gives +1 morale to skill checks and damage
 *   rolls made with it. Critical failures never destroy it; the system only destroys improvised weapons that way.
 * - Trademark Gear: a signature item marked `signatureGear: 2` gives +2 morale in all, and each action die spent to
 *   boost those rolls rolls 2 dice.
 */
import { loc } from "../i18n.mjs";

const count = (system, name) => (system.activeFeatSelections ?? []).filter(f => f.name === name).length;

/** Which items carry which bonus, with warnings for anything the character's feats do not support. */
export function favoredGearState(system, items = []) {
  const warnings = [],
    bonus = {},
    trademark = [];
  const favored = items.filter(
    i => ["weapon", "armor", "gear"].includes(i.type) && i.system?.possessionSource === "favoredGear"
  );
  const allowed = count(system, "Favored Gear"),
    cap = Math.ceil((system.level ?? 0) / 3);
  if (favored.length > allowed)
    warnings.push(loc`Favored Gear: ${favored.length} favored items, but the feat allows ${allowed}.`);
  for (const item of favored)
    if ((item.system.caliber ?? 0) > cap)
      warnings.push(loc`${item.name}: a favored item’s Caliber may not exceed ${cap} (one third of career level).`);
  const marked = items.filter(i => (i.system?.signatureGear ?? 0) > 0),
    signatures = count(system, "Signature Gear"),
    trademarks = count(system, "Trademark Gear");
  if (marked.length > signatures)
    warnings.push(loc`Signature Gear: ${marked.length} signature items, but the feat is held ${signatures} times.`);
  const doubled = marked.filter(i => i.system.signatureGear >= 2);
  if (doubled.length > Math.min(trademarks, 1)) warnings.push(loc`Trademark Gear applies to one signature item.`);
  const valid = marked.length <= signatures && doubled.length <= Math.min(trademarks, 1);
  for (const item of marked) {
    if (item.system.possessionSource !== "favoredGear") {
      warnings.push(loc`${item.name}: Signature Gear applies only to an item gained from Favored Gear.`);
      continue;
    }
    if (!valid) continue;
    const id = item.id ?? item._id;
    bonus[id] = Math.min(2, item.system.signatureGear);
    if (bonus[id] === 2 && item.uuid) trademark.push(item.uuid);
  }
  return { version: 1, bonus, trademark, warnings, cap };
}

/** The morale bonus for a skill check or damage roll made with this item. */
export const signatureBonus = (system, itemId) => system.favoredGear?.bonus?.[itemId] ?? 0;

/** Trademark Gear doubles boost dice on the item's skill checks and damage rolls. */
export const trademarkBoost = (system, check) =>
  ["skill", "damage"].includes(check?.checkKind) &&
  (system.favoredGear?.trademark ?? []).some(uuid => uuid && (uuid === check.gearUuid || uuid === check.weaponUuid));
