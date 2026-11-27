/**
 * Favored Gear, Signature Gear and Trademark Gear, p.197.
 *
 * - Favored Gear: one extra Possession, the item with `possessionSource: "favoredGear"`. It is not charged to the
 *   Wealth allowance, and its Caliber may not exceed one third of career level (rounded up). Session receipts
 *   track its actual dice, item restrictions, mission access and confirmed new-level replacements.
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
    trademark = [],
    invalid = {},
    pending = [];
  const favored = items.filter(
    i => ["weapon", "armor", "gear"].includes(i.type) && i.system?.possessionSource === "favoredGear"
  );
  const allowed = count(system, "Favored Gear"),
    cap = Math.ceil((system.level ?? 0) / 3);
  if (favored.length > allowed)
    warnings.push(loc`Favored Gear: ${favored.length} favored items, but the feat allows ${allowed}.`);
  if (favored.length < allowed)
    pending.push(loc`Favored Gear: choose favored Possessions (${allowed - favored.length} remaining).`);
  for (const item of favored) {
    let reason = "";
    if (favored.length > allowed) reason = loc`Each favored item needs its own active Favored Gear feat.`;
    else if (!Number.isSafeInteger(item.system.caliber) || item.system.caliber < 1 || item.system.caliber > 5)
      reason = loc`${item.name}: record the favored item's actual Caliber from I to V.`;
    else if (item.system.caliber > cap)
      reason = loc`${item.name}: a favored item’s Caliber may not exceed ${cap} (one third of career level).`;
    else if (item.system.possessionApproved !== true || item.system.pick || item.system.reserveAcquisition)
      reason = loc`${item.name}: review its approved favored Possession and conflicting acquisition records.`;
    if (reason) {
      invalid[item.id ?? item._id] = reason;
      if (!warnings.includes(reason)) warnings.push(reason);
    }
  }
  const marked = items.filter(i => (i.system?.signatureGear ?? 0) !== 0),
    signatures = count(system, "Signature Gear"),
    trademarks = count(system, "Trademark Gear");
  if (marked.length > signatures)
    warnings.push(loc`Signature Gear: ${marked.length} signature items, but the feat is held ${signatures} times.`);
  if (marked.length < signatures)
    pending.push(loc`Signature Gear: choose favored items (${signatures - marked.length} remaining).`);
  const doubled = marked.filter(i => i.system.signatureGear >= 2);
  if (doubled.length > Math.min(trademarks, 1)) warnings.push(loc`Trademark Gear applies to one signature item.`);
  if (!doubled.length && trademarks) pending.push(loc`Trademark Gear: choose one Signature Gear item.`);
  const valid = marked.length <= signatures && doubled.length <= Math.min(trademarks, 1);
  for (const item of marked) {
    if (![1, 2].includes(item.system.signatureGear) || !["weapon", "armor", "gear"].includes(item.type)) {
      warnings.push(loc`${item.name}: choose a valid Signature or Trademark Gear assignment.`);
      continue;
    }
    if (item.system.possessionSource !== "favoredGear") {
      warnings.push(loc`${item.name}: Signature Gear applies only to an item gained from Favored Gear.`);
      continue;
    }
    if (!valid || invalid[item.id ?? item._id]) continue;
    const id = item.id ?? item._id;
    bonus[id] = Math.min(2, item.system.signatureGear);
    if (bonus[id] === 2 && item.uuid) trademark.push(item.uuid);
  }
  return {
    version: 1,
    bonus,
    trademark,
    warnings,
    cap,
    ...(Object.keys(invalid).length ? { invalid } : {}),
    ...(pending.length ? { pending } : {})
  };
}

/**
 * Feats that grant one Possession of a set kind, not charged to Wealth (pp.207–210): Bug Basics (a bug), Disease
 * Basics (a disease sample), Poison Basics (an item with the injector quality) and Superior Documentation (a cover
 * identity). All but the disease sample have a Caliber cap of one third of career level, rounded up.
 */
export const FEAT_POSSESSIONS = Object.freeze({
  bugBasics: { feat: "Bug Basics", label: "bug", capped: true },
  diseaseBasics: { feat: "Disease Basics", label: "disease sample", capped: false },
  poisonBasics: { feat: "Poison Basics", label: "injector item", capped: true },
  superiorDocumentation: { feat: "Superior Documentation", label: "cover identity", capped: true }
});

export function featPossessionWarnings(system, items = []) {
  const warnings = [],
    cap = Math.ceil((system.level ?? 0) / 3);
  for (const [source, d] of Object.entries(FEAT_POSSESSIONS)) {
    const granted = items.filter(
      i => ["weapon", "armor", "gear"].includes(i.type) && i.system?.possessionSource === source
    );
    if (!granted.length) continue;
    if (!system.activeFeatNames?.includes(d.feat))
      warnings.push(loc`${granted[0].name}: a ${d.label} Possession needs ${d.feat}.`);
    if (granted.length > 1) warnings.push(loc`${d.feat}: ${granted.length} items marked, but the feat grants 1.`);
    if (d.capped)
      for (const item of granted)
        if ((item.system.caliber ?? 0) > cap)
          warnings.push(
            loc`${item.name}: this Possession’s Caliber may not exceed ${cap} (one third of career level).`
          );
  }
  return warnings;
}

/** The morale bonus for a skill check or damage roll made with this item. */
export const signatureBonus = (system, itemId) => system.favoredGear?.bonus?.[itemId] ?? 0;

/** Trademark Gear doubles boost dice on the item's skill checks and damage rolls. */
export const trademarkBoost = (system, check) =>
  ["skill", "damage"].includes(check?.checkKind) &&
  (system.favoredGear?.trademark ?? []).some(uuid => uuid && (uuid === check.gearUuid || uuid === check.weaponUuid));
