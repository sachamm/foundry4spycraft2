/**
 * Chance feats that answer a resolved attack (pp.189–191).
 *
 * - Lucky Break: once per scene, an attack or skill check against the character that hits or succeeds by 1 or less
 *   fails instead. The GC confirms the margin.
 * - Peculiar Dodge: when hit, before any threat is activated, the character may spend and roll 1 action die without
 *   exploding; on an odd result the attack misses. Uses per session: Chance feats; once per hit.
 * - Misfortune: when the character scores a threat on an attack against a player or special character and does not
 *   activate it, they may spend 1 action die to make the target discard 1 (the GC discards for an NPC). Uses per
 *   session: Chance feats.
 * - Fortune’s Fool: when the character’s error is activated by an opponent’s action die, they may trade 1 of their own
 *   action dice for 1 the opponent spent. The character keeps their count; the opponent gets 1 die back.
 *
 * Changing the attacker’s card or another character’s dice is the GC’s; these are GC controls on the attack card.
 */
import { chanceFeatCount } from "./fortunate.mjs";
import { loc } from "../i18n.mjs";

const has = (system, name) => system?.activeFeatNames?.includes(name) === true;

export function chanceReactionSpecs(system) {
  const out = [];
  if (has(system, "Lucky Break"))
    out.push({ id: "luckyBreak", name: loc`Lucky Break`, period: "scene", limit: 1, workflow: "chanceReaction" });
  for (const [id, feat] of [
    ["peculiarDodge", "Peculiar Dodge"],
    ["misfortune", "Misfortune"]
  ])
    if (has(system, feat))
      out.push({ id, name: feat, period: "session", limit: chanceFeatCount(system), workflow: "chanceReaction" });
  return out;
}

/** A resolved hit not already turned or contested. */
export const reactableHit = check =>
  check?.checkKind === "attack" &&
  check.resolved === true &&
  check.successConfirmed === true &&
  !check.superseded &&
  !check.criticalSuccess &&
  !check.luckyBreak &&
  !check.peculiarDodge;

/** Peculiar Dodge’s die: odd turns the hit into a miss. */
export const peculiarDodgeMisses = face => Number.isSafeInteger(face) && face % 2 === 1;

/** Misfortune applies to an unactivated threat scored against a character. */
export const misfortuneEligible = check =>
  check?.checkKind === "attack" &&
  check.resolved === true &&
  check.threatConfirmed === true &&
  !check.criticalSuccess &&
  !check.superseded &&
  !check.misfortune &&
  !!check.attackContext?.targetActorUuid;

/** Fortune’s Fool applies to an activated critical failure paid for by an opponent. */
export const fortunesFoolEligible = check =>
  check?.criticalFailure === true &&
  check.criticalActivation?.kind === "failure" &&
  !!check.criticalActivation.payerUuid &&
  !check.fortunesFool;
