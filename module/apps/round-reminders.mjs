/**
 * Round reminders on the combat tracker (module/rules/round-reminders.mjs): when a round ends the GC's client posts
 * a card for each dying character, and when a burning character's turn begins a card for it. The card's button
 * makes the same roll as the sheet's, for whoever owns the character. World setting "Round reminders".
 */
import { readSetting } from "../settings.mjs";
import { esc } from "../html.mjs";
import { roundReminders } from "../rules/round-reminders.mjs";
import { stratagemCountGain } from "../rules/class-combat.mjs";
import { hazardState } from "../rules/hazards.mjs";
import { npcIsSpecial } from "./gc/npc-play.mjs";
import { rollDying } from "./healing.mjs";
import { burningRound } from "./hazards.mjs";
import { fluidRoundSettled } from "./gc/combat.mjs";
import { loc } from "../i18n.mjs";

const enabled = () => {
  return readSetting("roundReminders", true) !== false;
};
const isLeadGM = () => game.users?.activeGM?.id === game.user?.id;
const special = actor => actor?.type === "agent" || (actor?.type === "npc" && npcIsSpecial(actor));

const TEXT = {
  dying: name => loc`${name} is dying: roll to stabilize at the end of the round.`,
  burning: name => loc`${name} is on fire: take the fire's damage at the start of the turn.`,
  stratagem: name =>
    loc`Stratagem: ${name} and the teammates who can hear or see ${name} gain Initiative Count this round. The button raises the Count of ${name} and of every combatant on the same side; lower it again for anyone out of sight and hearing.`
};
const BUTTON = {
  dying: () => loc`Roll to stabilize`,
  burning: () => loc`Burning: start of the round`,
  stratagem: () => loc`Apply Stratagem`
};

/** Raise the Count of a tactician and of the combatants on the tactician's side (GC only). */
export async function applyStratagem(actor) {
  if (!game.user?.isGM) return null;
  const gain = stratagemCountGain(actor?.system);
  const combat = [...(game.combats ?? [])].find(
    c => c.started && [...c.combatants].some(combatant => combatant.actor?.uuid === actor?.uuid)
  );
  if (!gain || !combat) return null;
  const own = [...combat.combatants].find(combatant => combatant.actor?.uuid === actor.uuid),
    side = own?.token?.disposition;
  const moved = [],
    updates = [];
  for (const combatant of combat.combatants) {
    if (!Number.isFinite(combatant.initiative) || combatant.isDefeated) continue;
    if (combatant.id !== own.id && (side === undefined || combatant.token?.disposition !== side)) continue;
    updates.push({ _id: combatant.id, initiative: combatant.initiative + gain });
    moved.push(combatant.name);
  }
  // One write for the whole side, so the tracker and the sheets refresh once.
  if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates);
  if (moved.length)
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>${esc(loc`Stratagem: Initiative Count +${gain} for ${moved.join(", ")}.`)}</p>`
    });
  return moved;
}

/** The combatants as the rules read them. */
function combatantsOf(combat) {
  return [...(combat?.combatants ?? [])].map(combatant => {
    const actor = combatant.actor;
    return {
      actorUuid: actor?.uuid ?? null,
      name: combatant.name ?? actor?.name ?? "",
      special: special(actor),
      wounds: actor?.system?.wounds?.value,
      deathThreshold: actor?.system?.deathThreshold,
      burning: actor?.type === "agent" && !!hazardState(actor.system).fire,
      stratagem: actor?.type === "agent" ? stratagemCountGain(actor.system) : 0,
      defeated: combatant.isDefeated === true
    };
  });
}

async function post(reminder, combat) {
  const actor = await fromUuid(reminder.actorUuid);
  if (!actor) return;
  const owners = game.users.filter(user => user.isGM || actor.testUserPermission(user, "OWNER")).map(user => user.id);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: owners,
    content: `<p>${esc(TEXT[reminder.kind](actor.name))}</p>`,
    flags: {
      spycraft2: {
        roundReminder: {
          kind: reminder.kind,
          actorUuid: reminder.actorUuid,
          combatId: combat?.id ?? null,
          round: combat?.round ?? null
        }
      }
    }
  });
}

/** Add the card's button for whoever owns the character. */
async function renderButton(message, html) {
  const reminder = message.flags?.spycraft2?.roundReminder;
  if (!reminder || reminder.done || !Object.hasOwn(BUTTON, reminder.kind)) return;
  const actor = globalThis.fromUuidSync?.(reminder.actorUuid);
  if (!actor?.isOwner || (reminder.kind === "stratagem" && !game.user?.isGM)) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const content = root?.querySelector(".message-content");
  if (!content || content.querySelector("[data-spycraft2-round-reminder]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.spycraft2RoundReminder = reminder.kind;
  button.textContent = BUTTON[reminder.kind]();
  button.addEventListener("click", async event => {
    event.preventDefault();
    button.disabled = true;
    try {
      if (reminder.kind === "dying") await rollDying(actor);
      else if (reminder.kind === "stratagem") {
        // Once per card: the Count is raised a single time each round.
        // A card left over from an earlier round or another fight no longer applies.
        const combat = game.combats?.get?.(reminder.combatId);
        if (reminder.combatId && (!combat?.started || combat.round !== reminder.round)) {
          ui.notifications.warn(loc`That Stratagem card is from an earlier round.`);
          return;
        }
        if (await applyStratagem(actor)) await message.update({ "flags.spycraft2.roundReminder.done": true });
      } else await burningRound(actor);
    } finally {
      button.disabled = false;
    }
  });
  content.append(button);
}

const posted = new Set();

export function installRoundReminders() {
  Hooks.on("updateCombat", async (combat, changed, options) => {
    if (!isLeadGM() || !enabled() || !combat?.started) return;
    const forward = options?.direction === undefined ? true : options.direction > 0;
    if (!forward || (!Object.hasOwn(changed, "round") && !Object.hasOwn(changed, "turn"))) return;
    const previousRound = combat.previous?.round ?? (Number(changed.round) || 1) - 1;
    const roundEnded = Object.hasOwn(changed, "round") && previousRound >= 1 && combat.round > previousRound;
    // Fluid initiative may reorder the fight for the new round; read whose turn it is only once that is done.
    // Yield once first: Foundry calls every updateCombat handler before any of them resumes, so by then the fluid
    // initiative handler has started its pass whichever was registered first.
    if (Object.hasOwn(changed, "round")) {
      await null;
      await fluidRoundSettled();
    }
    const reminders = roundReminders({
      combatants: combatantsOf(combat),
      roundEnded,
      roundStarted: Object.hasOwn(changed, "round") && combat.round >= 1 && combat.round > previousRound,
      turnActorUuid: combat.combatant?.actor?.uuid ?? null
    });
    for (const reminder of reminders) {
      // A reorder at the start of a round updates the turn again; remind each character once per turn.
      const key = `${combat.id}:${combat.round}:${reminder.kind}:${reminder.actorUuid}`;
      if (posted.has(key)) continue;
      posted.add(key);
      if (posted.size > 200) posted.delete(posted.values().next().value);
      await post(reminder, combat).catch(error =>
        console.warn(loc`Field Agent's Handbook | round reminder not posted`, error)
      );
    }
  });
  Hooks.on("renderChatMessageHTML", renderButton);
}
