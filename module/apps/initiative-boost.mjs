/**
 * An action die on Initiative (B-105). Initiative is a check, so an agent may spend action dice on it like any other
 * (p.61). Foundry posts the Initiative roll itself; this adds a "Spend 1 action die" button under it for whoever owns
 * the agent, while the combatant's Count is still the one that roll (and any earlier boost on it) produced. The die
 * raises the Count, and the combatant records the new Count so a second press builds on it.
 */
import { loc } from "../i18n.mjs";
import { refuse } from "../error-notices.mjs";
import { actionDieBoostPlan } from "../rules/action-dice.mjs";

/** Whether a chat message is Foundry's Initiative roll. */
export const isInitiativeMessage = message =>
  !!(message?.flags?.core?.initiativeRoll || message?.flags?.["core.initiativeRoll"]);

const combatantsOf = combat => [...(combat?.combatants?.contents ?? combat?.combatants ?? [])];

/**
 * The combatant an Initiative message still speaks for, and the Count it left: the roll's total, or the Count the
 * last boost on this message recorded. Null once the Count has moved on (rolled again, changed by hand or lost).
 */
export function boostableInitiative(message, combats = []) {
  if (!isInitiativeMessage(message)) return null;
  const rolled = Number(message.rolls?.[0]?.total);
  if (!Number.isFinite(rolled)) return null;
  const { token, actor } = message.speaker ?? {};
  for (const combat of combats) {
    for (const combatant of combatantsOf(combat)) {
      const same = token ? combatant.tokenId === token : actor && combatant.actorId === actor;
      if (!same || combatant.defeated) continue;
      const boost = combatant.flags?.spycraft2?.initiativeBoost;
      const count = boost?.messageId === message.id ? Number(boost.count) : rolled;
      if (combatant.initiative === count)
        return { combat, combatant, count, spent: boost?.messageId === message.id ? Number(boost.spent) || 0 : 0 };
    }
  }
  return null;
}

/** The boost's plan, or the reason none can be spent. */
export function initiativeBoostPlan(actor) {
  if (actor?.type !== "agent") return { blocked: true, reason: loc`Only agents spend action dice.` };
  return actionDieBoostPlan(actor.actionDiceFundingSystem ?? actor.system ?? {}, { checkKind: "initiative" }, {});
}

async function boost(message) {
  const target = boostableInitiative(message, globalThis.game?.combats?.contents ?? []);
  if (!target) return refuse(loc`That Initiative Count has changed since this roll.`);
  const { combatant, count, spent } = target,
    actor = combatant.actor;
  if (!actor?.isOwner) return refuse(loc`Only the agent's owner can spend its action dice.`);
  const plan = initiativeBoostPlan(actor);
  if (plan.blocked) return refuse(plan.reason);
  return actor.spendActionDice(1, async () => {
    const roll = await new Roll(plan.formula).evaluate();
    const added = roll.total + plan.bonusEach * plan.rolls,
      after = count + added;
    if (combatant.initiative !== count) throw new Error(loc`That Initiative Count has changed since this roll.`);
    await combatant.update({
      initiative: after,
      "flags.spycraft2.initiativeBoost": { messageId: message.id, count: after, spent: spent + 1 }
    });
    await roll.toMessage({
      speaker: message.speaker,
      flavor: loc`Action die on Initiative: +${added}, Count ${count} → ${after}`
    });
    return after;
  });
}

/** The button under an Initiative roll (the `renderChatMessageHTML` hook). */
export function renderInitiativeBoost(message, html) {
  if (!isInitiativeMessage(message)) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const content = root?.querySelector(".message-content");
  if (!content || content.querySelector("[data-spycraft2-initiative-boost]")) return;
  const target = boostableInitiative(message, globalThis.game?.combats?.contents ?? []);
  const actor = target?.combatant.actor;
  if (!actor?.isOwner || actor.type !== "agent" || (actor.system?.actionDice?.value ?? 0) < 1) return;
  const plan = initiativeBoostPlan(actor);
  if (plan.blocked) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.spycraft2InitiativeBoost = "";
  button.textContent = loc`Spend 1 action die (+${plan.rolls}d${plan.die})`;
  button.title = loc`Raise this Initiative Count with an action die (p.61)`;
  button.addEventListener("click", async event => {
    event.preventDefault();
    button.disabled = true;
    try {
      await boost(message);
    } catch (error) {
      refuse(error.message);
    } finally {
      button.disabled = false;
    }
  });
  const holder = document.createElement("div");
  holder.className = "spycraft2 chat-note";
  holder.append(button);
  content.append(holder);
}

export function installInitiativeBoost() {
  Hooks.on("renderChatMessageHTML", renderInitiativeBoost);
  // The button's offer follows the Count: redraw the Initiative cards when a combatant's Count changes.
  Hooks.on("updateCombatant", (combatant, changed) => {
    if (!Object.hasOwn(changed, "initiative")) return;
    for (const message of globalThis.game?.messages?.contents?.slice(-30) ?? [])
      if (isInitiativeMessage(message)) globalThis.ui?.chat?.updateMessage?.(message);
  });
}
