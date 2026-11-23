/**
 * The system's keyboard shortcuts. Each one is listed under Configure Controls, where it can be changed or removed.
 * The actions that move a combat or spend GC action dice are for the GC only.
 */
import { locKey } from "../i18n.mjs";

/** The newest chat card on screen that holds a button matching the selector, and that button. */
export function newestCardButton(root, selector) {
  const cards = [...(root?.querySelectorAll?.("[data-message-id]") ?? [])];
  for (const card of cards.reverse()) {
    const button = [...card.querySelectorAll(selector)].find(candidate => !candidate.disabled);
    if (button) return button;
  }
  return null;
}

const press = selector => () => {
  const button = newestCardButton(document.querySelector("#chat") ?? document, selector);
  if (!button) return false;
  button.focus();
  button.click();
  return true;
};

/** [id, name, hint, default keys, GC only, handler] */
const bindings = ({ openConsole }) => [
  [
    "nextTurn",
    locKey`Next turn`,
    locKey`Ends the current turn in the active combat.`,
    [{ key: "KeyN", modifiers: ["Alt"] }],
    true,
    () => (game.combat?.started ? (game.combat.nextTurn(), true) : false)
  ],
  [
    "previousTurn",
    locKey`Previous turn`,
    locKey`Steps the active combat back one turn.`,
    [{ key: "KeyP", modifiers: ["Alt"] }],
    true,
    () => (game.combat?.started ? (game.combat.previousTurn(), true) : false)
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
    () => {
      const sheet = game.combat?.combatant?.actor?.sheet;
      if (!sheet) return false;
      sheet.render(true);
      return true;
    }
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
    locKey`GC boost on the newest NPC card`,
    locKey`Spends a GC action die on the newest NPC result that can still be boosted.`,
    [{ key: "KeyB", modifiers: ["Alt"] }],
    true,
    press('button[data-roll-key="gcBoost"]')
  ]
];

export function registerKeybindings(actions) {
  for (const [id, name, hint, editable, restricted, onDown] of bindings(actions))
    game.keybindings.register("spycraft2", id, { name, hint, editable, restricted, onDown });
}
