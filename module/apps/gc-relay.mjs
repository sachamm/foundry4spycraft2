/**
 * Requests a player's client hands to the GC's.
 *
 * A player cannot change a character he does not own or a chat card he did not post. Rather than leave those steps
 * for the GC to repeat by hand, the player's client asks the active GC's client to do them (Foundry's user queries,
 * CONFIG.queries). The GC is asked to allow each request unless the world setting says otherwise; marking a card as
 * dealt with needs no question.
 *
 * A module registers what it can do for a player with `registerRelay(action, { describe, run })` and calls
 * `askGC(action, data)`. For the GC himself `askGC` runs the action directly.
 */
import { systemDialog } from "./dialog-theme.mjs";
import { loc } from "../i18n.mjs";

export const RELAY_QUERY = "spycraft2.relay";
const actions = new Map();
const esc = value => foundry.utils.escapeHTML(String(value ?? ""));

/**
 * @param {string} action
 * @param {object} handler { run: async (data, user) => result, describe?: (data, user) => string|null }
 *                         describe returns the question put to the GC, or null to run without asking
 */
export function registerRelay(action, handler) {
  actions.set(action, handler);
}

const autoApprove = () => {
  try {
    return game.settings.get("spycraft2", "relayAutoApprove") === true;
  } catch {
    return false;
  }
};

/** The GC's side: check the request, ask if needed, do it. Always answers with { value } or { error }. */
export async function handleRelay({ action, data, userId } = {}) {
  try {
    const handler = actions.get(action),
      user = game.users.get(userId);
    if (!handler || !user) throw new Error(loc`The GC's client does not know this request.`);
    const question = handler.describe ? await handler.describe(data ?? {}, user) : null;
    if (question && !autoApprove()) {
      const allowed = await systemDialog.confirm({
        window: { title: loc`${user.name} asks` },
        content: `<p>${question}</p>`,
        rejectClose: false
      });
      if (!allowed) throw new Error(loc`The GC declined the request.`);
    }
    return { value: (await handler.run(data ?? {}, user)) ?? null };
  } catch (error) {
    return { error: error?.message || loc`The request failed on the GC's client.` };
  }
}

/** Whether a GC is connected to take a request. */
export const gcAvailable = () => game.user?.isGM === true || !!game.users?.activeGM;

/**
 * Have the GC's client do something this user may not.
 * @returns {Promise<*>} the action's result; throws with the reason when it is refused or cannot be sent
 */
export async function askGC(action, data = {}, { timeout = 120000 } = {}) {
  const handler = actions.get(action);
  if (!handler) throw new Error(loc`The GC's client does not know this request.`);
  if (game.user.isGM) return handler.run(data, game.user);
  const gm = game.users.activeGM;
  if (!gm) throw new Error(loc`No GC is connected to do this. Ask again when the GC is here.`);
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
  "pendingSave.rolled": value => value === true,
  "hazardSave.resolved": value => value === true,
  firstAid: value => typeof value?.patientUuid === "string" && typeof value?.name === "string",
  stabilized: value => typeof value?.patientUuid === "string" && typeof value?.name === "string",
  damageAppliedEntry: value =>
    typeof value?.targetUuid === "string" &&
    typeof value?.name === "string" &&
    Number.isFinite(value?.damage) &&
    typeof value?.kind === "string"
};

const markUpdate = (message, key, value) => {
  if (key !== "damageAppliedEntry") return { [`flags.spycraft2.${key}`]: value };
  const now = message.flags?.spycraft2?.damageApplied;
  return { "flags.spycraft2.damageApplied": [...(Array.isArray(now) ? now : []), value] };
};

registerRelay("markCard", {
  async run({ messageId, key, value }, user) {
    const message = game.messages.get(messageId),
      check = message?.flags?.spycraft2,
      actor = check?.actorUuid ? await fromUuid(check.actorUuid) : null;
    if (!message || !Object.hasOwn(MARKS, key) || !MARKS[key](value))
      throw new Error(loc`That card cannot be marked this way.`);
    if (!user.isGM && !actor?.testUserPermission(user, "OWNER"))
      throw new Error(loc`Only the character's own player can mark that card.`);
    await message.update(markUpdate(message, key, value));
    return true;
  }
});

/**
 * Record on a chat card that one of its steps is done, through the GC when the card is someone else's.
 * Returns false, with a warning unless `quiet`, when it could not be recorded.
 */
export async function markCard(message, key, value = true, { quiet = false } = {}) {
  try {
    if (message.isAuthor || game.user.isGM) await message.update(markUpdate(message, key, value));
    else await askGC("markCard", { messageId: message.id, key, value });
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
    name: loc`Apply players' requests without asking`,
    hint: loc`A player who hits a character he does not own, or treats another player's agent, sends the result to the GC's client to apply. When off, the GC is asked to allow each one.`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
  CONFIG.queries[RELAY_QUERY] = handleRelay;
}
