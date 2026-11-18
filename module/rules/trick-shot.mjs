/**
 * Trick Shot, p.183: a hit with a non-grenade hurled weapon that deals lethal damage may leave the target held
 * instead of damaged. They escape with a half-action Athletics (Str) check against the attack's damage; several Trick
 * Shots on one character in a round are escaped together, against their combined damage.
 */
import { loc } from "../i18n.mjs";

export const trickShotEligible = (system, check) =>
  system?.activeFeatNames?.includes("Trick Shot") === true &&
  check?.checkKind === "attack" &&
  check.successConfirmed === true &&
  !check.superseded &&
  !check.trickShot &&
  ["hurled", "exoticHurled"].includes(check.weaponProficiency) &&
  !/\bBLS\b/.test(check.weaponQualities ?? "");

export const trickShotNote = (targetName, damage) =>
  loc`Trick Shot: ${targetName} takes no damage and is held instead. Escaping is a half-action Athletics (Str) check, DC ${damage}; with more Trick Shots on them this round, one check against the combined damage (p.183).`;
