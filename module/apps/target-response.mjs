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
import { coverBetween } from "./map.mjs";
import { appliedDamageEntries, attackResolutionNote } from "../rules/damage-application.mjs";

/** Whether a player who owns this agent is connected: the GC then leaves the response to that player. */
const playerPresent = actor =>
  [...(globalThis.game?.users ?? [])].some(
    user => user.active && !user.isGM && actor.testUserPermission?.(user, "OWNER")
  );

/** What an attack card already records about the attack, to start the target's Defense check from. */
export function incomingFacts(check = {}) {
  const context = check.attackContext ?? {};
  const distance = Number(context.distanceFeet);
  return {
    ...(check.weaponProficiency ? { weaponProficiency: check.weaponProficiency } : {}),
    ...(context.damageType ? { damageType: context.damageType } : {}),
    ranged: context.ranged === true,
    ...(context.laser === true ? { laser: true } : {}),
    ...(check.weaponProficiency ? { attackerProficiency: String(check.weaponProficiency) } : {}),
    adjacent: context.reachAdjacent === true,
    distanceFeet: context.distanceFeet !== null && Number.isFinite(distance) && distance >= 0 ? distance : null
  };
}

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
    const target = respondent(check.attackContext?.targetActorUuid, check, user);
    if (!target) return [];
    // Once settled, the target's row stays and says how it went, rather than vanishing from the card.
    if (check.resolved || check.attackResolution)
      return [
        {
          id: "targetResolved",
          label: loc`Attack on ${target.name}: resolved`,
          disabled: attackResolutionNote(check) || loc`The attacker has settled this attack.`,
          run: () => null
        }
      ];
    // Whoever also owns the attacker has Resolve as the card's main step; Check Defense then stays a plain button,
    // so the card keeps one filled button.
    const ownsAttacker = !!(check.actorUuid && fromUuidSync(check.actorUuid)?.isOwner);
    // An action-die Defense boost is declared at the start of a round (p.62), never against one attack already
    // made, so it is not offered here; the sheet keeps it for the round start.
    return [
      {
        id: "targetCheckDefense",
        label: loc`Check Defense for ${target.name}`,
        hint: loc`${target.name} is the target: work out Defense against this attack`,
        ...(ownsAttacker ? {} : { emphasis: "primary" }),
        run: () => {
          // The walls the map shows between the two tokens start as the scenery cover (p.345).
          let sceneryCover = null;
          try {
            const attacker = check.actorUuid ? fromUuidSync(check.actorUuid) : null;
            sceneryCover = coverBetween(attacker, target, { tokenId: message.speaker?.token });
          } catch {
            sceneryCover = null;
          }
          return checkIncomingDefense(target, {
            ...incomingFacts(check),
            ...(Number.isSafeInteger(sceneryCover) ? { sceneryCover } : {})
          });
        }
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

/**
 * Tell a player at once when an attack names their agent, so they look at the card (the createChatMessage hook).
 * The GM is not told: the GM sees every card anyway.
 */
export function notifyAttackTarget(message, user = globalThis.game?.user) {
  const check = message?.flags?.spycraft2;
  if (!check || check.checkKind !== "attack" || user?.isGM) return null;
  // A blind or whispered attack the player cannot see stays secret: the notice would name the attacker.
  const whisper = [...(message.whisper ?? [])];
  if (message.blind || message.visible === false || (whisper.length && !whisper.includes(user?.id))) return null;
  const target = respondent(check.attackContext?.targetActorUuid, check, user);
  if (!target) return null;
  const attacker = check.actorUuid ? fromUuidSync(check.actorUuid) : null;
  const text = attacker?.name
    ? loc`${attacker.name} is attacking ${target.name}: Check Defense on the card.`
    : loc`${target.name} is under attack: Check Defense on the card.`;
  globalThis.ui?.notifications?.info(text);
  return text;
}

export function installTargetNotices() {
  Hooks.on("createChatMessage", message => notifyAttackTarget(message));
}
