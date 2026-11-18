/**
 * Mother Hen, p.197: the character's Possessions (personal gear) gain +4 to Damage saves. When a Possession suffers
 * damage while the character is touching it, a Reflex save (DC = the damage) lets them take half of it (rounded
 * up) themselves; their DR applies unless the item is armor they are wearing.
 */
import { possessionUnavailable } from "./gear.mjs";
import { loc } from "../i18n.mjs";

export const MOTHER_HEN_SAVE = 4;

/** Whether an item is an approved Possession of an owner with Mother Hen. */
export function motherHenItem(item, owner) {
  const gear = item?.system ?? {};
  return (
    ["wealth", "gcGrant", "favoredGear"].includes(gear.possessionSource) &&
    !possessionUnavailable(gear) &&
    owner?.system?.activeFeatNames?.includes("Mother Hen") === true
  );
}

/** How the damage splits after the owner's Reflex save. */
export function motherHenTransfer(damage, reflexTotal) {
  if (!Number.isSafeInteger(damage) || damage < 1) throw new Error(loc`Enter the damage the Possession suffers.`);
  if (!Number.isFinite(reflexTotal)) throw new Error(loc`Roll the owner’s Reflex save.`);
  if (reflexTotal < damage) return { saved: false, toOwner: 0, toItem: damage };
  const toOwner = Math.ceil(damage / 2);
  return { saved: true, toOwner, toItem: damage - toOwner };
}
