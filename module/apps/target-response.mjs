/**
 * What the player whose agent is attacked can do from the attack's own chat cards.
 *
 * An attack card and its damage card belong to the attacker, so the usual buttons under them are the attacker's.
 * The target's player sees a second row instead: work out Defense against this attack or boost it with an action
 * die while the attack is open, and take the damage once it has been rolled. Each button opens the same step the
 * agent's sheet offers; nothing is settled here.
 */
import { checkIncomingDefense } from "./incoming-defense.mjs";
import {
  applyDamage,
  damageCardTarget,
  ouchInjuryControls,
  quickApplyInput,
  targetLabel
} from "./damage-application.mjs";
import { loc } from "../i18n.mjs";
import { appliedDamageEntries } from "../rules/damage-application.mjs";

/** Whether a player who owns this agent is connected: the GC then leaves the response to that player. */
const playerPresent = actor =>
  [...(globalThis.game?.users ?? [])].some(
    user => user.active && !user.isGM && actor.testUserPermission?.(user, "OWNER")
  );

/** The agent this viewer answers for on a card, or null. */
function respondent(uuid, check, user) {
  const target = uuid && uuid !== check.actorUuid ? fromUuidSync(uuid) : null;
  if (target?.type !== "agent" || !target.isOwner) return null;
  return user?.isGM && playerPresent(target) ? null : target;
}

/**
 * Buttons for the owner of an attack's target.
 * @returns {{id: string, label: string, run: Function, emphasis?: string}[]}
 */
export function targetResponseControls({ message, check, user }) {
  if (!check || check.superseded) return [];
  if (check.checkKind === "attack") {
    if (check.resolved || check.attackResolution) return [];
    const target = respondent(check.attackContext?.targetActorUuid, check, user);
    if (!target) return [];
    return [
      {
        id: "targetCheckDefense",
        label: loc`Check Defense`,
        hint: loc`${target.name}: work out Defense against this attack`,
        emphasis: "primary",
        run: () => checkIncomingDefense(target)
      },
      {
        id: "targetBoostDefense",
        label: loc`Boost Defense`,
        hint: loc`${target.name}: spend an action die to boost Defense against this attack`,
        run: () => target.boostDefenseWithActionDie()
      }
    ];
  }
  if (check.checkKind === "damage") {
    // The attacker's own row already offers this to someone who owns both characters.
    const attacker = check.actorUuid ? fromUuidSync(check.actorUuid) : null;
    if (attacker?.isOwner) return [];
    // Once the damage is applied, a Table of Ouch injury is rolled from here by the injured agent's player.
    const ouch = ouchInjuryControls(message, check);
    const target = respondent(damageCardTarget(check)?.uuid, check, user);
    const applied = appliedDamageEntries(check);
    if (!target || applied.some(entry => entry.targetUuid === target.uuid)) return ouch;
    const rolled = Number.isFinite(check.effectiveTotal) ? check.effectiveTotal : message.rolls?.[0]?.total;
    const amount = Math.max(0, Math.trunc(Number(rolled) || 0));
    return [
      {
        id: "targetTakeDamage",
        label: loc`Apply ${amount} to ${targetLabel(target)}`,
        emphasis: "primary",
        run: () => applyDamage(message, quickApplyInput(message, target.uuid))
      },
      ...ouch
    ];
  }
  return [];
}
