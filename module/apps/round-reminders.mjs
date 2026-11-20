/**
 * Round reminders on the combat tracker (module/rules/round-reminders.mjs): when a round ends the GC's client posts
 * a card for each dying character, and when a burning character's turn begins a card for it. The card's button
 * makes the same roll as the sheet's, for whoever owns the character. World setting "Round reminders".
 */
import { roundReminders } from "../rules/round-reminders.mjs";
import { hazardState } from "../rules/hazards.mjs";
import { npcIsSpecial } from "./gc/npc-play.mjs";
import { rollDying } from "./healing.mjs";
import { burningRound } from "./hazards.mjs";
import { fluidRoundSettled } from "./gc/combat.mjs";
import { loc } from "../i18n.mjs";

const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
const enabled = () => {
  try {
    return game.settings.get("spycraft2", "roundReminders") !== false;
  } catch {
    return true;
  }
};
const isLeadGM = () => game.users?.activeGM?.id === game.user?.id;
const special = actor => actor?.type === "agent" || (actor?.type === "npc" && npcIsSpecial(actor));

const TEXT = {
  dying: name => loc`${name} is dying: roll to stabilize at the end of the round.`,
  burning: name => loc`${name} is on fire: take the fire's damage at the start of the turn.`
};
const BUTTON = {
  dying: () => loc`Roll to stabilize`,
  burning: () => loc`Burning: start of the round`
};

/** The combatants as the rules read them. */
function combatantsOf(combat) {
  return [...(combat?.combatants ?? [])].map(combatant => {
    const actor = combatant.actor;
    return {
      actorUuid: actor?.uuid ?? null,
      name: combatant.name ?? actor?.name ?? "",
      special: special(actor),
      wounds: actor?.system?.wounds?.value,
      burning: actor?.type === "agent" && !!hazardState(actor.system).fire,
      defeated: combatant.isDefeated === true
    };
  });
}

async function post(reminder) {
  const actor = await fromUuid(reminder.actorUuid);
  if (!actor) return;
  const owners = game.users.filter(user => user.isGM || actor.testUserPermission(user, "OWNER")).map(user => user.id);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: owners,
    content: `<p>${esc(TEXT[reminder.kind](actor.name))}</p>`,
    flags: { spycraft2: { roundReminder: { kind: reminder.kind, actorUuid: reminder.actorUuid } } }
  });
}

/** Add the card's button for whoever owns the character. */
async function renderButton(message, html) {
  const reminder = message.flags?.spycraft2?.roundReminder;
  if (!reminder || !Object.hasOwn(BUTTON, reminder.kind)) return;
  const actor = globalThis.fromUuidSync?.(reminder.actorUuid);
  if (!actor?.isOwner) return;
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
      else await burningRound(actor);
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
    if (Object.hasOwn(changed, "round")) await fluidRoundSettled();
    const reminders = roundReminders({
      combatants: combatantsOf(combat),
      roundEnded,
      turnActorUuid: combat.combatant?.actor?.uuid ?? null
    });
    for (const reminder of reminders) {
      // A reorder at the start of a round updates the turn again; remind each character once per turn.
      const key = `${combat.id}:${combat.round}:${reminder.kind}:${reminder.actorUuid}`;
      if (posted.has(key)) continue;
      posted.add(key);
      if (posted.size > 200) posted.delete(posted.values().next().value);
      await post(reminder).catch(error => console.warn(loc`Spycraft 2.0 | round reminder not posted`, error));
    }
  });
  Hooks.on("renderChatMessageHTML", renderButton);
}
