/**
 * Requests a player's client hands to the GC's.
 *
 * A player cannot change a character he does not own or a chat card he did not post. Rather than leave those steps
 * for the GC to repeat by hand, the player's client asks the active GC's client to do them (Foundry's user queries,
 * CONFIG.queries). The GC is asked to allow each request, on a card in the GC's chat, unless the world setting says
 * otherwise; marking a card as dealt with needs no question.
 *
 * A module registers what it can do for a player with `registerRelay(action, { describe, run, concerns })` and calls
 * `askGC(action, data)`. For the GC himself `askGC` runs the action directly.
 *
 * Trust: the requesting user's id travels in the request, so it is a claim, not proof. A GC never sends a relay
 * request (askGC runs locally for any GC), so a request claiming to come from a GC is refused. `concerns` lists what
 * does not fit the card (the requester did not roll it, the amount was raised); any concern puts the request on an
 * Allow card even when the world applies requests without asking.
 */
import { readSetting } from "../settings.mjs";
import { esc } from "../html.mjs";
import { loc, locKey } from "../i18n.mjs";
import { validBlastExposureReview } from "../rules/blast-exposure.mjs";
import { markDamageApplicationStart } from "../documents/actor/damage-hits.mjs";
import { appliedDamageEntries, validReport } from "../rules/damage-application.mjs";

export const RELAY_QUERY = "spycraft2.relay";
const actions = new Map();

/**
 * @param {string} action
 * @param {object} handler { run: async (data, user) => result, describe?: (data, user) => string|null,
 *                         concerns?: (data, user) => string[] }
 *                         describe returns the question put to the GC, or null to run without asking; concerns are
 *                         reasons to ask even when requests are applied without asking
 */
export function registerRelay(action, handler) {
  actions.set(action, handler);
}

const autoApprove = () => {
  return readSetting("relayAutoApprove", false) === true;
};

/** The GC's side: check the request, ask if needed, do it. Always answers with { value } or { error }. */
export async function handleRelay({ action, data, userId } = {}) {
  let card = null;
  try {
    const handler = actions.get(action),
      user = game.users.get(userId);
    if (!handler || !user) throw new Error(loc`The GC's client does not know this request.`);
    // A GC's own client never relays, so this claim is false.
    if (user.isGM) throw new Error(loc`A relayed request cannot come from a GC.`);
    const question = handler.describe ? await handler.describe(data ?? {}, user) : null;
    const concerns = handler.concerns ? ((await handler.concerns(data ?? {}, user)) ?? []).filter(Boolean) : [];
    if (question && (!autoApprove() || concerns.length)) {
      const asked = await askInChat(
        [question, ...concerns.map(concern => `<span class="bad">${esc(concern)}</span>`)].join("<br>"),
        user,
        { concern: concerns.length > 0 }
      );
      if (!asked.allowed) throw new Error(loc`The GC declined the request.`);
      card = asked.message;
    }
    const value = (await handler.run(data ?? {}, user)) ?? null;
    // The card's last word is what happened, not only what the GC chose.
    if (card) await recordAnswer(card, loc`Allowed and applied.`);
    return { value };
  } catch (error) {
    const reason = error?.message || loc`The request failed on the GC's client.`;
    if (card) await recordAnswer(card, loc`Allowed, but it failed: ${reason}`);
    return { error: reason };
  }
}

/* -------------------------------------------- */
/*  Asking the GC without stopping play          */
/* -------------------------------------------- */

/** Requests waiting for the GC's answer on this client: id → resolve(boolean). */
const waiting = new Map();
/** How long the GC has to answer, in seconds (world setting); the player's client waits a little longer. */
export const askTimeoutSeconds = () => {
  const seconds = Number(readSetting("relayTimeout", 110));
  return Number.isFinite(seconds) && seconds >= 15 ? Math.min(seconds, 900) : 110;
};

/** How many requests wait for this GC's answer: shown in the console's status strip. */
export const pendingRequests = () => waiting.size;
const pendingChanged = () => {
  try {
    globalThis.Hooks?.callAll?.("spycraft2.relayPending", waiting.size);
  } catch {
    /* nothing listens */
  }
};

/**
 * Put a request to the GC as a card in the GC's own chat, with Allow and Decline, rather than a dialog that blocks
 * the screen. Requests made during a busy round line up in the chat log and are answered in any order. The card is
 * kept as a record: its flags say whether it is still waiting, and a GC reload marks the ones it loses.
 * @returns {Promise<{allowed: boolean, message: object|null}>}
 */
export async function askInChat(question, user, { concern = false } = {}) {
  const id = foundry.utils.randomID(12),
    seconds = askTimeoutSeconds(),
    by = new Date(Date.now() + seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const answer = new Promise(resolve => waiting.set(id, resolve));
  pendingChanged();
  const message = await ChatMessage.create({
    whisper: [game.user.id],
    speaker: { alias: loc`${user.name} asks` },
    content: `<div class="spycraft2 chat-note relay-ask"><p>${question}</p><p class="hint">${loc`Answer by ${by}, or it is declined. The name is the one the player's client sent.`}</p></div>`,
    flags: { spycraft2: { relayAsk: id, relayConcern: concern, relayState: "waiting" } }
  });
  const timer = setTimeout(() => settleAsk(id, false, message, loc`No answer in time: declined.`), seconds * 1000);
  const allowed = await answer;
  clearTimeout(timer);
  return { allowed, message };
}

async function recordAnswer(message, note, state = "done") {
  try {
    await message?.update({
      content: `${message.content}<p class="relay-answer" role="status"><b>${esc(note)}</b></p>`,
      "flags.spycraft2.relayAnswered": true,
      "flags.spycraft2.relayState": state
    });
  } catch {
    /* the card is only a record */
  }
}

async function settleAsk(id, allowed, message, note) {
  const resolve = waiting.get(id);
  if (!resolve) return;
  waiting.delete(id);
  pendingChanged();
  resolve(allowed);
  // An allowed request is recorded once it has run (handleRelay); a declined one ends here.
  if (!allowed) await recordAnswer(message, note, "declined");
}

/** Allow and Decline on a waiting request card (the `renderChatMessageHTML` hook). */
export function renderRelayAsk(message, html) {
  const id = message.flags?.spycraft2?.relayAsk;
  if (!id || !game.user?.isGM || message.flags.spycraft2.relayAnswered) return;
  const row = document.createElement("div");
  row.className = "spycraft2 roll-controls";
  if (!waiting.has(id)) {
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = loc`This request is no longer waiting.`;
    row.append(note);
  } else {
    // A request the system flagged is not Allow-by-default: neither button leads.
    const concern = message.flags.spycraft2.relayConcern === true;
    for (const [label, allowed, className] of [
      [loc`Allow`, true, concern ? "" : "sc2-primary-action"],
      [loc`Decline`, false, ""]
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      if (className) button.className = className;
      button.addEventListener("click", () => settleAsk(id, allowed, message, allowed ? loc`Allowed.` : loc`Declined.`));
      row.append(button);
    }
  }
  html.append(row);
}

/** A GC's reload drops the requests it was holding: their cards say so, and the players ask again. */
export async function markLostRequests(messages = globalThis.game?.messages ?? []) {
  const lost = [...messages].filter(
    message =>
      message.flags?.spycraft2?.relayAsk &&
      !message.flags.spycraft2.relayAnswered &&
      !waiting.has(message.flags.spycraft2.relayAsk) &&
      message.isAuthor !== false
  );
  for (const message of lost)
    await recordAnswer(message, loc`Lost when this GC's client reloaded: the player asks again.`, "lost");
  return lost.length;
}

/**
 * The concern when a requester neither posted a card nor owns the character it is about. Not a refusal: the GC is
 * asked, since a player sometimes applies a result for a friend at the table.
 */
export function requesterConcern(message, user) {
  const check = message?.flags?.spycraft2 ?? {},
    actor = check.actorUuid ? fromUuidSync(check.actorUuid) : null;
  if (message?.author?.id === user?.id || actor?.testUserPermission?.(user, "OWNER")) return null;
  return loc`${user?.name ?? "?"} did not post this card and does not own its character.`;
}

/** Whether a GC is connected to take a request. */
export const gcAvailable = () => game.user?.isGM === true || !!game.users?.activeGM;

/**
 * Have the GC's client do something this user may not.
 * @returns {Promise<*>} the action's result; throws with the reason when it is refused or cannot be sent
 */
export async function askGC(action, data = {}, { timeout = askTimeoutSeconds() * 1000 + 10000 } = {}) {
  const handler = actions.get(action);
  if (!handler) throw new Error(loc`The GC's client does not know this request.`);
  if (game.user.isGM) return handler.run(data, game.user);
  const gm = game.users.activeGM;
  if (!gm) throw new Error(loc`No GC is connected to do this. Ask again when the GC is here.`);
  // Foundry lets a player send a request to another user only with the "Query users" permission.
  if (globalThis.CONST?.USER_PERMISSIONS?.QUERY_USER && game.user.can?.("QUERY_USER") === false)
    throw new Error(
      loc`Your user role cannot send requests to the GC. The GC can allow "Query users" for players in Foundry's permission settings.`
    );
  let answer;
  try {
    answer = await gm.query(RELAY_QUERY, { action, data, userId: game.user.id }, { timeout });
  } catch (error) {
    throw new Error(loc`The request did not reach the GC (${error.message}).`);
  }
  if (answer?.error) throw new Error(answer.error);
  return answer?.value ?? null;
}

/* -------------------------------------------- */
/*  Marking a chat card                          */
/* -------------------------------------------- */

/** Flags a player may set on a card that reports on his own character, with the values each may take. */
const MARKS = {
  blastExposureReview: validBlastExposureReview,
  damageApplicationStarted: value => typeof value?.targetUuid === "string",
  "pendingSave.rolled": value => value === true,
  "hazardSave.resolved": value => value === true,
  firstAid: value => typeof value?.patientUuid === "string" && typeof value?.name === "string",
  stabilized: value => typeof value?.patientUuid === "string" && typeof value?.name === "string",
  criticalShotApplied: value => typeof value?.damageMessageId === "string",
  damageAppliedEntry: value =>
    typeof value?.targetUuid === "string" &&
    typeof value?.name === "string" &&
    Number.isFinite(value?.damage) &&
    typeof value?.kind === "string" &&
    validReport(value?.report)
};

// Each damage record gets its own key, so two applies close together both survive: rewriting one array from a stale
// copy could drop the first (read them with appliedDamageEntries).
const ENTRY_ID = /^[A-Za-z0-9]{8,32}$/;
const markUpdate = (message, key, value, entryId = null) =>
  ["damageAppliedEntry", "blastExposureReview"].includes(key)
    ? {
        [`flags.spycraft2.${key === "damageAppliedEntry" ? "damageAppliedBy" : "blastExposureReviewsBy"}.${key === "damageAppliedEntry" && entryId && ENTRY_ID.test(entryId) ? entryId : foundry.utils.randomID()}`]:
          value
      }
    : { [`flags.spycraft2.${key}`]: value };

registerRelay("markCard", {
  async run({ messageId, key, value, entryId = null }, user) {
    const message = game.messages.get(messageId),
      check = message?.flags?.spycraft2,
      actor = check?.actorUuid ? await fromUuid(check.actorUuid) : null;
    if (!message || !Object.hasOwn(MARKS, key) || !MARKS[key](value))
      throw new Error(loc`That card cannot be marked this way.`);
    // The player whose own character took the damage may record that on the attacker's card: the damage itself, and
    // that the attack's critical shot is used up (the damage card must come from this attack and name that character).
    let damaged =
      ["damageAppliedEntry", "damageApplicationStarted"].includes(key) && value?.targetUuid
        ? await fromUuid(value.targetUuid)
        : null;
    if (key === "criticalShotApplied") {
      const damage = game.messages.get(value.damageMessageId)?.flags?.spycraft2;
      if (damage?.sourceAttack?.uuid === message.uuid)
        for (const entry of appliedDamageEntries(damage)) {
          const target = typeof entry.targetUuid === "string" ? await fromUuid(entry.targetUuid) : null;
          if (target?.testUserPermission?.(user, "OWNER")) {
            damaged = target;
            break;
          }
        }
    }
    if (!user.isGM && !actor?.testUserPermission(user, "OWNER") && !damaged?.testUserPermission?.(user, "OWNER"))
      throw new Error(loc`Only the character's own player can mark that card.`);
    if (key === "damageApplicationStarted") return markDamageApplicationStart(message, value);
    await message.update(markUpdate(message, key, value, entryId));
    return true;
  }
});

// Undo of applied damage takes its own mark off the card: the player who owns the damaged character may do that
// through the GC, as they may set it.
registerRelay("unmarkDamage", {
  async run({ messageId, entryId }, user) {
    const message = game.messages.get(messageId),
      entry = message?.flags?.spycraft2?.damageAppliedBy?.[entryId];
    if (!entry || typeof entryId !== "string" || !ENTRY_ID.test(entryId))
      throw new Error(loc`That card has no such damage mark.`);
    const target = typeof entry.targetUuid === "string" ? await fromUuid(entry.targetUuid) : null;
    if (!user.isGM && !target?.testUserPermission?.(user, "OWNER"))
      throw new Error(loc`Only the character's own player can clear that mark.`);
    await message.update({ [`flags.spycraft2.damageAppliedBy.-=${entryId}`]: null });
    return true;
  }
});

/** Take one applied-damage mark off a card, through the GC when the card is someone else's. */
export async function unmarkDamage(message, entryId) {
  if (message.isAuthor || game.user.isGM)
    return message.update({ [`flags.spycraft2.damageAppliedBy.-=${entryId}`]: null });
  return askGC("unmarkDamage", { messageId: message.id, entryId });
}

/**
 * Record on a chat card that one of its steps is done, through the GC when the card is someone else's.
 * Returns false, with a warning unless `quiet`, when it could not be recorded.
 */
export async function markCard(message, key, value = true, { quiet = false, entryId = null } = {}) {
  try {
    if (message.isAuthor || game.user.isGM) {
      if (key === "damageApplicationStarted") return await markDamageApplicationStart(message, value);
      await message.update(markUpdate(message, key, value, entryId));
    } else await askGC("markCard", { messageId: message.id, key, value, entryId });
    return true;
  } catch (error) {
    if (quiet) return false;
    ui.notifications.warn(
      loc`This step is done, but the card could not be marked: ${esc(error.message)} Do not repeat it.`
    );
    return false;
  }
}

/** Register the query and the setting. Call during `init`. */
export function installGCRelay() {
  game.settings.register("spycraft2", "relayAutoApprove", {
    name: locKey`Apply players' requests without asking`,
    hint: locKey`A player who hits a character they do not own, or treats another player's agent, sends the result to the GC's client to apply. When off, each one waits for Allow on a card in the GC's chat. When on, a request that does not fit its card (damage raised above the roll, or a card the player did not post) still waits for Allow.`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register("spycraft2", "showDefenseToPlayers", {
    name: locKey`Show opponents' Defense to players`,
    hint: locKey`Players see a target's Defense when resolving an attack and can resolve against a recorded target in one click. Turn off to keep NPC Defense hidden; players then pick the target in the resolve dialog and the result still says hit or miss.`,
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register("spycraft2", "relayTimeout", {
    name: locKey`Time to answer a player's request (seconds)`,
    hint: locKey`How long a request card waits for Allow before it is declined. The player's client waits ten seconds longer.`,
    scope: "world",
    config: true,
    type: Number,
    range: { min: 15, max: 900, step: 5 },
    default: 110
  });
  CONFIG.queries[RELAY_QUERY] = handleRelay;
  Hooks.on("renderChatMessageHTML", renderRelayAsk);
  Hooks.once("ready", () => {
    if (game.users?.activeGM?.id === game.user?.id) markLostRequests().catch(() => 0);
  });
}
