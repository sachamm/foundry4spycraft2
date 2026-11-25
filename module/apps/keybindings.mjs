/**
 * The system's keyboard shortcuts. Each one is listed under Configure Controls, where it can be changed or removed.
 * The actions that move a combat or spend GC action dice are for the GC only.
 */
import { loc, locKey } from "../i18n.mjs";
import { stepBackTurn } from "./gc/combat.mjs";

/** The newest chat card on screen that holds a button matching the selector, and that button. */
export function newestCardButton(root, selector) {
  const cards = [...(root?.querySelectorAll?.("[data-message-id]") ?? [])];
  for (const card of cards.reverse()) {
    const button = [...card.querySelectorAll(selector)].find(candidate => !candidate.disabled);
    if (button) return button;
  }
  return null;
}

/** Press the matching button on the newest chat card that has one. Returns whether a button was pressed. */
export function pressNewestCard(selector) {
  const button = newestCardButton(document.querySelector("#chat") ?? document, selector);
  if (!button) return false;
  button.click();
  return true;
}
const press = selector => () => pressNewestCard(selector);

/**
 * The card a GC boost shortcut acts on: the one under the pointer, else the newest card this user posted that can
 * still be boosted. Another GC's card is never picked unless the pointer is on it.
 * @param {{querySelector: Function, querySelectorAll: Function}} root
 * @param {(id: string) => boolean} mine  Whether this user posted the message with that id.
 */
export function boostCardButton(root, mine, selector = 'button[data-roll-key="gcBoost"]', pointRoot = root) {
  const usable = card => [...(card?.querySelectorAll?.(selector) ?? [])].find(button => !button.disabled) ?? null;
  // The pointer names the card: when that card cannot be boosted, no other card is boosted in its place.
  // The pointer is looked for everywhere a card is drawn: the sidebar, a popped-out chat log, a notification.
  const pointed = pointRoot?.querySelector?.("[data-message-id]:hover");
  if (pointed) return usable(pointed);
  const cards = [...(root?.querySelectorAll?.("[data-message-id]") ?? [])].reverse();
  for (const card of cards) {
    if (!mine(card.dataset?.messageId)) continue;
    const button = usable(card);
    if (button) return button;
  }
  return null;
}

function gcBoostShortcut() {
  const messages = game.messages,
    mine = id => {
      const author = messages?.get(id)?.author;
      return (author?.id ?? author) === game.user.id;
    };
  const button = boostCardButton(document.querySelector("#chat") ?? document, mine, undefined, document);
  if (!button) {
    ui.notifications.info(
      loc`Nothing to boost: the card under the pointer cannot be boosted, or none of your cards can. Point at a card to boost that one.`
    );
    return true;
  }
  const id = button.closest("[data-message-id]")?.dataset.messageId,
    message = messages?.get(id),
    who = message?.speaker?.alias ?? message?.alias ?? loc`the newest result`;
  // Say which card takes the die: the spend cannot be taken back from here.
  ui.notifications.info(loc`GC boost on ${who}.`);
  button.click();
  return true;
}

// A turn change is still on its way to the server when the next key arrives, so the sheet shortcut waits for it.
let turnChange = null;
const changeTurn = step => {
  if (!game.combat?.started) return false;
  turnChange = Promise.resolve(step === "previousTurn" ? stepBackTurn(game.combat) : game.combat[step]()).catch(
    () => null
  );
  return true;
};
let shortcutSheet = null;
function openActingSheet() {
  if (!game.combat?.combatant) return false;
  Promise.resolve(turnChange).then(() => {
    const sheet = game.combat?.combatant?.actor?.sheet;
    if (!sheet) return;
    // One sheet follows the turn: the one this shortcut opened last is closed when the turn has moved on.
    if (shortcutSheet && shortcutSheet !== sheet && shortcutSheet.rendered) shortcutSheet.close();
    // A sheet the GC already had open is theirs: the shortcut does not close it later.
    shortcutSheet = sheet.rendered ? null : sheet;
    sheet.render(true);
  });
  return true;
}

/**
 * Foundry ignores its keyboard shortcuts while a button holds the focus, and a button keeps the focus after a mouse
 * click. Release it after a pointer click on this system's sheets, cards and console, so the next shortcut works.
 * A press from the keyboard keeps its focus.
 */
export function releaseFocusAfterClick(event, active = globalThis.document?.activeElement) {
  if (!event || event.detail === 0) return false;
  const button = event.target?.closest?.("button, a[data-action]");
  if (!button || button !== active) return false;
  if (!button.closest?.(".spycraft2, .chat-message, #chat, #combat, #sidebar")) return false;
  if (button.closest?.("dialog, .dialog, .application.dialog")) return false;
  button.blur?.();
  return true;
}
export function installShortcutFocusRelease() {
  document.addEventListener("click", event => setTimeout(() => releaseFocusAfterClick(event), 0));
}

/** [id, name, hint, default keys, GC only, handler] */
const bindings = ({ openConsole }) => [
  [
    "nextTurn",
    locKey`Next turn`,
    locKey`Ends the current turn in the active combat.`,
    [{ key: "KeyN", modifiers: ["Alt"] }],
    true,
    () => changeTurn("nextTurn")
  ],
  [
    "previousTurn",
    locKey`Previous turn`,
    locKey`Steps the active combat back one turn.`,
    [{ key: "KeyP", modifiers: ["Alt"] }],
    true,
    () => changeTurn("previousTurn")
  ],
  [
    "gcConsole",
    locKey`Open the GC Console`,
    locKey`Opens the GC Console, or brings it to the front.`,
    [{ key: "KeyG", modifiers: ["Alt"] }],
    true,
    () => (openConsole(), true)
  ],
  [
    "activeSheet",
    locKey`Open the acting character's sheet`,
    locKey`Opens the sheet of the combatant whose turn it is.`,
    [{ key: "KeyS", modifiers: ["Alt"] }],
    true,
    openActingSheet
  ],
  [
    "cardPrimary",
    locKey`Press the next step on the newest card`,
    locKey`Presses the main button of the newest chat card that has one.`,
    [{ key: "Enter", modifiers: ["Alt"] }],
    false,
    press("button.sc2-primary-action[data-roll-control]")
  ],
  [
    "gcBoost",
    locKey`GC boost on your newest NPC card`,
    locKey`Spends a GC action die on the card under the pointer, or on the newest result you posted that can still be boosted.`,
    [{ key: "KeyB", modifiers: ["Alt"] }],
    true,
    gcBoostShortcut
  ]
];

export function registerKeybindings(actions) {
  installShortcutFocusRelease();
  for (const [id, name, hint, editable, restricted, onDown] of bindings(actions))
    game.keybindings.register("spycraft2", id, { name, hint, editable, restricted, onDown });
}
