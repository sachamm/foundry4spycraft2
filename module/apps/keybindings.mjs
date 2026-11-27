/**
 * The system's keyboard shortcuts. Each one is listed under Configure Controls, where it can be changed or removed.
 * The actions that move a combat or spend GC action dice are for the GC only.
 */
import { loc, locKey } from "../i18n.mjs";
import { stepBackTurn } from "./gc/combat.mjs";

/** The newest chat card on screen that holds a button matching the selector, and that button. */
export function newestCardButton(root, selector, keep = () => true) {
  const cards = [...(root?.querySelectorAll?.("[data-message-id]") ?? [])].filter(keep);
  for (const card of cards.reverse()) {
    const button = [...card.querySelectorAll(selector)].find(candidate => !candidate.disabled);
    if (button) return button;
  }
  return null;
}

/** Every place a chat log is drawn: the sidebar and a popped-out chat window. */
const chatRoots = () => {
  const roots = [document.querySelector("#chat"), globalThis.ui?.chat?.popout?.element].filter(Boolean);
  return roots.length ? roots : [document];
};
/** The button's own words and the card's speaker, for the notice that says what was pressed. */
function describePress(button) {
  const id = button.closest?.("[data-message-id]")?.dataset.messageId,
    message = globalThis.game?.messages?.get?.(id),
    who = message?.speaker?.alias ?? message?.alias ?? loc`the newest card`;
  return { label: button.textContent?.trim() || loc`its next step`, who };
}

/**
 * Press the matching button on the newest chat card that has one, and say which card it was.
 * Returns whether a button was pressed.
 */
export function pressNewestCard(selector, { notify = false, mineOnly = false } = {}) {
  const mine = card => {
    const author = globalThis.game?.messages?.get?.(card.dataset?.messageId)?.author;
    return (author?.id ?? author) === game.user?.id;
  };
  const buttons = chatRoots()
    .map(root => newestCardButton(root, selector, mineOnly ? mine : undefined))
    .filter(Boolean);
  const button = buttons.at(-1) ?? null;
  if (!button) {
    if (notify) ui.notifications.info(loc`No chat card is waiting for a next step.`);
    return false;
  }
  if (notify) {
    const { label, who } = describePress(button);
    ui.notifications.info(loc`${label}: ${who}.`);
  }
  showPressed(button);
  button.click();
  return true;
}

/** Bring the pressed card into view and mark it for a moment, so a GC sees which card a key or button acted on. */
function showPressed(button) {
  const card = button.closest?.("[data-message-id]");
  if (!card) return;
  card.scrollIntoView?.({ block: "nearest" });
  card.classList?.add("sc2-pressed");
  setTimeout(() => card.classList?.remove("sc2-pressed"), 1500);
}

/**
 * Alt+Enter: during a fight, the acting combatant's newest card when it has a next step, else this user's own newest
 * card that has one; outside a fight, the newest card in the log. The console's "Next step on this combatant's card" uses the first half alone.
 */
export function pressNextStep(selector) {
  const acting = globalThis.game?.combat?.started ? game.combat.combatant : null;
  if (acting && pressActorCard(acting, selector, { quiet: true })) return true;
  if (!acting) return pressNewestCard(selector, { notify: true });
  // During a fight the acting combatant has nothing waiting: say so first, so another NPC's card is never pressed by
  // surprise. A second press within three seconds takes this user's own newest card.
  const key = `${game.combat.id}:${acting.id}:${game.combat.round}`;
  if (fallbackArmed?.key !== key || Date.now() - fallbackArmed.at > FALLBACK_CONFIRM_MS) {
    fallbackArmed = { key, at: Date.now() };
    ui.notifications.info(
      loc`No card of ${acting.name} is waiting for a next step. Press again within 3 seconds for your own newest card.`
    );
    return true;
  }
  fallbackArmed = null;
  return pressNewestCard(selector, { notify: true, mineOnly: true });
}
const FALLBACK_CONFIRM_MS = 3000;
let fallbackArmed = null;

/**
 * Press the next step on the newest card about this combatant: its actor posted it, or the card is about its token.
 * Another combatant's card, or a player's card about someone else, is never pressed in its place.
 * @param {Combatant} combatant
 */
export function pressActorCard(combatant, selector, { quiet = false } = {}) {
  const actorId = combatant?.actor?.id,
    tokenId = combatant?.tokenId ?? combatant?.token?.id;
  const about = card => {
    const message = globalThis.game?.messages?.get?.(card.dataset?.messageId);
    const speaker = message?.speaker ?? {};
    return (tokenId && speaker.token === tokenId) || (!speaker.token && actorId && speaker.actor === actorId);
  };
  for (const root of chatRoots()) {
    // Only the newest card about this combatant: an older card's step, still live after its damage card was
    // settled, is never pressed a second time from here.
    const cards = [...(root.querySelectorAll?.("[data-message-id]") ?? [])].filter(about).reverse().slice(0, 1);
    for (const card of cards) {
      const button = [...card.querySelectorAll(selector)].find(candidate => !candidate.disabled);
      if (!button) continue;
      const { label } = describePress(button);
      ui.notifications.info(loc`${label}: ${combatant.name}.`);
      showPressed(button);
      button.click();
      return true;
    }
  }
  if (quiet) return false;
  ui.notifications.info(loc`No card of ${combatant?.name ?? loc`this combatant`} is waiting for a next step.`);
  return false;
}

/** The keys bound to one of this system's shortcuts, as a person reads them ("Alt+N"), or "" when unbound. */
export function shortcutLabel(id) {
  try {
    const bound = globalThis.game?.keybindings?.get?.("spycraft2", id) ?? [];
    const first = bound[0];
    if (!first?.key) return "";
    const key = first.key.replace(/^Key/, "").replace(/^Digit/, "");
    return [...(first.modifiers ?? []), key].join("+");
  } catch {
    return "";
  }
}

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
  // A die spent cannot be taken back from here, so the first press names the card and a second press spends.
  const now = Date.now();
  if (boostArmed?.button !== button || now > boostArmed.until) {
    boostArmed = { button, until: now + BOOST_CONFIRM_MS };
    showPressed(button);
    ui.notifications.info(loc`GC boost on ${who}? Press the key again to spend the die.`);
    return true;
  }
  boostArmed = null;
  ui.notifications.info(loc`GC boost on ${who}.`);
  button.click();
  return true;
}
const BOOST_CONFIRM_MS = 3000;
let boostArmed = null;

// A turn change is still on its way to the server when the next key arrives, so the sheet shortcut waits for it.
let turnChange = null;
const changeTurn = step => {
  if (!game.combat?.started) return false;
  const fight = game.combat;
  // Next turn checks first for damage still waiting on the acting combatant's card, as the console's button does.
  const run =
    step === "previousTurn"
      ? Promise.resolve(stepBackTurn(fight))
      : step === "nextTurn"
        ? import("./gc/console-turn.mjs").then(module => (module.nextTurnAllowed(fight) ? fight.nextTurn() : null))
        : Promise.resolve(fight[step]());
  turnChange = run.catch(() => null);
  return true;
};
let shortcutSheet = null;
/** Attack with one weapon of the acting combatant, by its place on the sheet (0 for the first). */
function actingWeapon(index) {
  const combatant = game.combat?.started ? game.combat.combatant : null,
    actor = combatant?.actor;
  if (!actor) return false;
  // The keys stand for the console's attack buttons, which only a standing NPC has: an agent attacks from its sheet.
  if (actor.type !== "npc" || combatant.isDefeated) {
    ui.notifications.info(
      loc`${combatant.name} is not a standing NPC: Alt+${index + 1} attacks only on an NPC's turn.`
    );
    return true;
  }
  // The same order as the console's buttons, which list the sheet's weapons as the sheet does.
  const weapon = [...(actor.items ?? [])]
    .filter(item => item.type === "weapon")
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))[index];
  if (!weapon) {
    ui.notifications.info(loc`${combatant.name} has no weapon ${index + 1} on its sheet.`);
    return true;
  }
  import("./gc/console-turn.mjs")
    .then(module => module.attackWith(actor, weapon.id, null, combatant))
    .catch(error => ui.notifications.warn(error.message));
  return true;
}

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
    locKey`During a fight, presses the main button of the acting combatant's newest card (a second press within three seconds takes your own newest card when they have none); outside a fight, of the newest card that has one.`,
    [{ key: "Enter", modifiers: ["Alt"] }],
    false,
    () => (pressNextStep("button.sc2-primary-action[data-roll-control]"), true)
  ],
  [
    "spendDice",
    locKey`Spend GC action dice`,
    locKey`Opens Spend dice, with the acting NPC chosen when one is acting.`,
    [{ key: "KeyD", modifiers: ["Alt"] }],
    true,
    () => {
      const actor = game.combat?.started ? game.combat.combatant?.actor : null;
      import("./gc/spend.mjs")
        .then(module => module.spendGCDice({ preferActor: actor?.type === "npc" ? actor : null }))
        .catch(error => ui.notifications.warn(error.message));
      return true;
    }
  ],
  ...[1, 2].map(number => [
    `actingWeapon${number}`,
    number === 1
      ? locKey`Attack with the acting NPC's first weapon`
      : locKey`Attack with the acting NPC's second weapon`,
    locKey`Opens the attack for that weapon of the combatant whose turn it is, as its button in the GC Console does.`,
    [{ key: `Digit${number}`, modifiers: ["Alt"] }],
    true,
    () => actingWeapon(number - 1)
  ]),
  [
    "mobAttack",
    locKey`Mob attack for the acting NPC's group`,
    locKey`Opens the mob attack for the group of standard NPCs the acting combatant belongs to.`,
    [{ key: "KeyM", modifiers: ["Alt"] }],
    true,
    () => {
      const fight = game.combat?.started ? game.combat : null;
      if (!fight?.combatant) return false;
      import("./gc/console-turn.mjs")
        .then(module => {
          const group = module.mobGroups(fight).find(entry => entry.members.some(m => m.id === fight.combatant.id));
          if (!group) {
            ui.notifications.info(loc`${fight.combatant.name} is not part of a mob in this fight.`);
            return null;
          }
          return module.mobAttackDialog(fight, group.key);
        })
        .catch(error => ui.notifications.warn(error.message));
      return true;
    }
  ],
  [
    "gcBoost",
    locKey`GC boost on your newest NPC card`,
    locKey`Spends a GC action die on the card under the pointer, or on the newest result you posted that can still be boosted. Press twice: the first press names the card.`,
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
