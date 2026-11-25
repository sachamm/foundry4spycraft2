/**
 * Keeps the system's chat cards short. The header names the speaker by code name (or the short part of the name)
 * and says what was rolled in one line; the rule notes that followed that line move into a closed "Details"
 * disclosure at the foot of the card, with the reminder of what the system does and what the table decides.
 * Nothing is dropped: the full name is the sender's tooltip and every note is one click away.
 */
import { loc } from "../i18n.mjs";
import { resolutionGuide } from "../apps/resolution-guide.mjs";

const CHECK_KINDS = new Set(["attack", "skill", "ability", "save", "knowledge", "damage"]);

/**
 * The name to show on a card: the actor's code name when it has one, otherwise the name without the role or
 * grade a token name adds ("Luka Petrov — Soldier 1 (Close protection)" shows "Luka Petrov").
 */
export function shortSpeakerName(fullName, codename) {
  const code = typeof codename === "string" ? codename.trim() : "";
  if (code) return code;
  const name = typeof fullName === "string" ? fullName.trim() : "";
  const short = name.split(/\s+[—–]\s+|\s+\(/)[0].trim();
  return short || name;
}

function speakerActor(message) {
  const speaker = message.speaker ?? {};
  try {
    const token = speaker.token && speaker.scene ? game.scenes?.get(speaker.scene)?.tokens?.get(speaker.token) : null;
    return token?.actor ?? (speaker.actor ? game.actors?.get(speaker.actor) : null) ?? null;
  } catch {
    return null;
  }
}

function shortenSender(message, html) {
  const sender = html.querySelector?.(".message-header .message-sender");
  if (!sender || sender.dataset.sc2Short) return;
  const full = sender.textContent.trim();
  const short = shortSpeakerName(full, speakerActor(message)?.system?.codename);
  sender.dataset.sc2Short = "true";
  if (!short || short === full) return;
  sender.textContent = short;
  sender.dataset.tooltip = full;
  sender.setAttribute("aria-label", full);
}

/** Move everything after the flavor's first line break into `target`, as one paragraph per line. */
function takeFlavorNotes(flavor, target) {
  const nodes = [...flavor.childNodes];
  const split = nodes.findIndex(node => node.nodeName === "BR");
  if (split < 0) return 0;
  const doc = flavor.ownerDocument;
  let line = doc.createElement("p"),
    count = 0;
  const flush = () => {
    if (line.textContent.trim()) {
      target.append(line);
      count++;
    }
    line = doc.createElement("p");
  };
  for (const node of nodes.slice(split)) {
    if (node.nodeName === "BR") {
      node.remove();
      flush();
    } else line.append(node);
  }
  flush();
  return count;
}

function guideLines(kind, doc) {
  const descriptions = resolutionGuide(kind);
  return [
    [loc`System:`, descriptions.automatic],
    [loc`You / GC:`, descriptions.manual]
  ].map(([label, text]) => {
    const p = doc.createElement("p"),
      strong = doc.createElement("strong");
    strong.textContent = label + " ";
    p.append(strong, doc.createTextNode(text));
    return p;
  });
}

/** Shorten a rendered system card (the `renderChatMessageHTML` hook). Runs after the buttons are added. */
export function compactChatCard(message, html) {
  const check = message.flags?.spycraft2;
  if (!check || !html?.querySelector) return;
  shortenSender(message, html);
  if (!CHECK_KINDS.has(check.checkKind)) return;
  const content = html.querySelector(".message-content");
  if (!content || content.querySelector(":scope > .sc2-card-details")) return;
  const doc = content.ownerDocument;
  const details = doc.createElement("details");
  details.className = "spycraft2 sc2-card-details";
  const summary = doc.createElement("summary");
  summary.textContent = loc`Details`;
  const body = doc.createElement("div");
  body.className = "sc2-card-notes";
  const flavor = html.querySelector(".message-header .flavor-text");
  const notes = flavor ? takeFlavorNotes(flavor, body) : 0;
  details.append(summary, body);
  const guide = doc.createElement("div");
  guide.className = "sc2-card-guide";
  const kind = ["attack", "damage"].includes(check.checkKind) ? check.checkKind : "check";
  guide.append(...guideLines(kind, doc));
  details.append(guide);
  if (!notes) body.remove();
  content.append(details);
}
