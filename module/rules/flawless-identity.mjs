/**
 * Flawless Identity, p.209.
 *
 * - The character keeps named identities, as many as their starting action dice, each documented like a cover
 *   identity of Power Rating 6, with 1 Profession focus and 2 Interests. They are defined when the feat is gained and
 *   may be replaced only during an Intel Phase.
 * - Getting into character takes 1 minute and 1 action die; returning to the character's own identity is a free action.
 * - While in character, that identity's Profession focus and Interests are usable; the character keeps their feats
 *   and skills, though the player may hold some back to suit the role.
 * `system.identities` lists them and `system.activeIdentity` names the one in use.
 */
import { loc } from "../i18n.mjs";

export const FLAWLESS_IDENTITY = "Flawless Identity";
export const IDENTITY_POWER_RATING = 6;

const has = system => system?.activeFeatNames?.includes(FLAWLESS_IDENTITY) === true;
const rows = system => (Array.isArray(system?.identities) ? system.identities : []);

/** How many identities the character may keep: their starting action dice. */
export const identityLimit = system => (has(system) ? Math.max(0, Number(system.actionDice?.max) || 0) : 0);

/** The identity in use, or null. */
export function activeIdentity(system) {
  if (!has(system) || !system.activeIdentity) return null;
  return rows(system).find(r => r?.id === system.activeIdentity) ?? null;
}

export function identityReview(system) {
  const warnings = [];
  if (!rows(system).length) return warnings;
  if (!has(system)) {
    warnings.push(loc`Flawless Identity: identities are recorded but the feat is not active.`);
    return warnings;
  }
  const limit = identityLimit(system);
  if (rows(system).length > limit)
    warnings.push(
      loc`Flawless Identity: ${rows(system).length} identities, but your starting action dice allow ${limit}.`
    );
  for (const r of rows(system)) {
    if (!String(r?.name ?? "").trim()) warnings.push(loc`Flawless Identity: every identity needs a name.`);
    else if (!String(r.professionFocus ?? "").trim() || (r.interests ?? []).filter(i => String(i).trim()).length !== 2)
      warnings.push(loc`${r.name}: choose 1 Profession focus and 2 Interests.`);
  }
  return warnings;
}

export function enterIdentityPlan(system, id) {
  if (!has(system)) throw new Error(loc`Flawless Identity has not been earned.`);
  const identity = rows(system).find(r => r?.id === id);
  if (!identity) throw new Error(loc`Choose one of your recorded identities.`);
  if (system.activeIdentity === id) throw new Error(loc`You are already in that identity.`);
  return { identity, cost: 1, minutes: 1 };
}

/** The Profession focuses with the active identity's added, for the duration. */
export function professionFocusesWithIdentity(system, focuses = []) {
  const identity = activeIdentity(system),
    focus = String(identity?.professionFocus ?? "").trim();
  if (!focus || focuses.some(f => String(f).trim().toLowerCase() === focus.toLowerCase())) return focuses;
  return [...focuses, focus];
}
