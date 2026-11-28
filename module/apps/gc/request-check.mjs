/**
 * Ask players for a skill check from the GC side (B-125). The GC picks the agents and the skill; the chat card that
 * follows carries a roll button for each agent, shown to whoever owns that agent, which opens the agent's ordinary
 * skill roll. The DC stays with the GC: the card asks for the roll and the GC reads the totals.
 */
import { refuse } from "../../error-notices.mjs";
import { systemDialog } from "../dialog-theme.mjs";
import { esc } from "../../html.mjs";
import { loc } from "../../i18n.mjs";
import { teamActors } from "./state.mjs";

const skills = () =>
  Object.values(globalThis.CONFIG?.SPYCRAFT?.skills ?? {}).sort((a, b) => a.name.localeCompare(b.name));

/** The card's text: who is asked for which check, with the GC's note if any. */
export function requestText({ skillName, names, note = "" }) {
  const who = names.join(", ");
  return note
    ? loc`The GC asks ${who} for a ${skillName} check: ${note}`
    : loc`The GC asks ${who} for a ${skillName} check.`;
}

/** The roll buttons this user may press on a request card: one per requested agent they own. */
export function requestButtons(request, actorFor) {
  return (request?.actorUuids ?? [])
    .map(uuid => actorFor(uuid))
    .filter(actor => actor?.isOwner && actor.type === "agent")
    .map(actor => ({ actor, label: loc`Roll ${request.skillName}: ${actor.name}` }));
}

export async function requestSkillCheck() {
  if (!game.user?.isGM) return refuse(loc`Only the GC asks for checks.`);
  const agents = teamActors();
  if (!agents.length) return refuse(loc`There is no agent to ask. Add the team on the mission screen first.`);
  const input = await systemDialog.input({
    window: { title: loc`Ask for a skill check` },
    rejectClose: false,
    ok: { label: loc`Ask` },
    content: `<div class="spycraft2-roll-options"><fieldset><legend>${loc`Agents`}</legend>${agents
      .map(actor => `<label><input type="checkbox" name="agent-${esc(actor.id)}" checked /> ${esc(actor.name)}</label>`)
      .join("")}</fieldset><label>${loc`Skill`} <select name="skill">${skills()
      .map(skill => `<option value="${esc(skill.key)}">${esc(skill.name)}</option>`)
      .join(
        ""
      )}</select></label><label>${loc`Note for the players (optional)`} <input name="note" maxlength="200" /></label><p class="hint">${loc`Each agent's owner gets a button on the card that opens the usual roll. Keep the DC to yourself and read the totals.`}</p></div>`
  });
  if (!input) return null;
  const chosen = agents.filter(actor => input[`agent-${actor.id}`]);
  if (!chosen.length) return refuse(loc`Tick at least one agent.`);
  const skill = globalThis.CONFIG?.SPYCRAFT?.skills?.[input.skill];
  if (!skill) return refuse(loc`Choose a skill from the list.`);
  const note = String(input.note ?? "").trim(),
    names = chosen.map(actor => actor.name);
  return ChatMessage.create({
    content: `<p>${esc(requestText({ skillName: skill.name, names, note }))}</p>`,
    flags: {
      spycraft2: {
        checkRequest: { skill: skill.key, skillName: skill.name, actorUuids: chosen.map(actor => actor.uuid) }
      }
    }
  });
}

/** The roll buttons under a request card (the `renderChatMessageHTML` hook). */
export function renderCheckRequest(message, html) {
  const request = message.flags?.spycraft2?.checkRequest;
  if (!request) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const content = root?.querySelector(".message-content");
  if (!content || content.querySelector("[data-spycraft2-check-request]")) return;
  const buttons = requestButtons(request, uuid => globalThis.fromUuidSync?.(uuid));
  if (!buttons.length) return;
  const holder = document.createElement("div");
  holder.className = "spycraft2 chat-note";
  holder.dataset.spycraft2CheckRequest = "";
  for (const { actor, label } of buttons) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", async event => {
      event.preventDefault();
      button.disabled = true;
      try {
        await actor.rollSkill(request.skill);
      } catch (error) {
        refuse(error.message);
      } finally {
        button.disabled = false;
      }
    });
    holder.append(button);
  }
  content.append(holder);
}

export function installCheckRequests() {
  Hooks.on("renderChatMessageHTML", renderCheckRequest);
}
