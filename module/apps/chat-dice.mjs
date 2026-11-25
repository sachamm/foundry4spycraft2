import { loc } from "../i18n.mjs";
/**
 * The dice bar under the chat log: one button that rolls 1d20 at once, die buttons that build a "/r" formula in the
 * chat box, and a modifier stepper. The player still sends the formula themselves, so it can be checked or edited.
 * Foundry moves the one chat input between the sidebar, a popped-out log and the notification area it shows while
 * another sidebar tab is open; the bar follows it everywhere.
 */

export const CHAT_DICE = [4, 6, 8, 10, 12, 20];
const MODIFIER_LIMIT = 99;

/** "/r 2d6+1d8+2" from the dice in the order first clicked and a modifier. Empty when there are no dice. */
export function chatDiceFormula(dice, modifier = 0) {
  const terms = [...dice].filter(([, count]) => count > 0).map(([faces, count]) => `${count}d${faces}`);
  if (!terms.length) return "";
  const mod = Number(modifier) || 0;
  return `/r ${terms.join("+")}${mod > 0 ? `+${mod}` : mod < 0 ? `-${-mod}` : ""}`;
}

/** The modifier as shown on the stepper: a sign on every value and a true minus. */
export const modifierLabel = modifier => (modifier < 0 ? `−${-modifier}` : `+${modifier}`);

export const clampModifier = value => Math.max(-MODIFIER_LIMIT, Math.min(MODIFIER_LIMIT, Math.trunc(value) || 0));

const views = new WeakMap();
// `seen` is the chat box text the bar last knew about: what it wrote, or a draft it has already noticed.
const state = { dice: new Map(), modifier: 0, seen: "" };
let bar;
// The input Foundry last placed in a chat log. It can live in another window's document when the log is detached.
let currentInput;
const hooked = new WeakSet();
let installed = false;

const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const button = (className, text, label, tooltip) => {
  const node = make("button", className, text);
  node.type = "button";
  if (label) node.setAttribute("aria-label", label);
  if (tooltip) node.dataset.tooltip = tooltip;
  return node;
};

const chatInput = () => currentInput;
const inputText = view => view?.state.doc.textContent.trim() ?? "";

/** Start over once the chat box changes under the bar: the formula was sent, cleared or edited. */
function syncWithInput(view) {
  const text = inputText(view);
  if (text === state.seen) return;
  state.seen = text;
  state.dice.clear();
  state.modifier = 0;
  refreshBar();
}

function writeFormula(view) {
  const text = chatDiceFormula(state.dice, state.modifier);
  const { state: editor } = view;
  const paragraph = editor.schema.nodes.paragraph.create(null, text ? editor.schema.text(text) : null);
  state.seen = text;
  let tr = editor.tr.replaceWith(0, editor.doc.content.size, paragraph);
  // Leave the cursor after the formula, ready for Enter.
  const TextSelection = globalThis.foundry?.prosemirror?.TextSelection;
  if (TextSelection && tr.doc) tr = tr.setSelection(TextSelection.atEnd(tr.doc));
  view.dispatch(tr);
}

function change(event, update) {
  const view = views.get(chatInput());
  if (!view) console.warn("Field Agent's Handbook | The chat box is not ready for the dice bar.");
  syncWithInput(view);
  update();
  // Only write when there is a formula, so a modifier chosen before any die does not clear a draft.
  if (view && state.dice.size) writeFormula(view);
  // A mouse click leaves the cursor in the chat box; a key press keeps focus on the bar for keyboard users.
  if (view && event.detail > 0) view.focus();
  refreshBar();
}

/**
 * The buttons that build a roll do not take focus when pressed with the mouse, so the chat box keeps its cursor and
 * does not shrink and grow again between clicks.
 */
const keepChatFocus = node => node.addEventListener("mousedown", event => event.preventDefault());

function refreshBar() {
  if (!bar) return;
  const value = bar.querySelector(".sc2-chat-dice-modifier output");
  value.textContent = modifierLabel(state.modifier);
  bar.querySelector("[data-step='-1']").disabled = state.modifier <= -MODIFIER_LIMIT;
  bar.querySelector("[data-step='1']").disabled = state.modifier >= MODIFIER_LIMIT;
  for (const die of bar.querySelectorAll("[data-faces]")) {
    const count = state.dice.get(Number(die.dataset.faces)) ?? 0;
    die.setAttribute("aria-pressed", String(count > 0));
    die.querySelector(".sc2-chat-dice-count").textContent = count > 1 ? `×${count}` : "";
  }
}

function buildBar() {
  const root = make("section", "sc2-chat-dice");
  root.setAttribute("aria-label", loc`Dice`);
  const top = make("div", "sc2-chat-dice-row");
  const quick = button(
    "sc2-primary-action",
    loc`Roll d20`,
    loc`Roll d20 now`,
    loc`Rolls 1d20 straight away, with no modifier, in the chat mode set by the chat buttons.`
  );
  quick.addEventListener("click", async () => {
    quick.disabled = true;
    try {
      await ui.chat.processMessage("/r 1d20");
    } finally {
      quick.disabled = false;
    }
  });
  const modifier = make("div", "sc2-chat-dice-modifier");
  modifier.setAttribute("role", "group");
  modifier.setAttribute("aria-label", loc`Modifier`);
  const down = button(
    "sc2-action",
    "−",
    loc`Lower the modifier by 1`,
    loc`Takes 1 off the modifier on the roll in the chat box.`
  );
  down.dataset.step = "-1";
  const value = make("output");
  value.setAttribute("aria-live", "polite");
  value.dataset.tooltip = loc`Modifier added to the roll in the chat box`;
  const up = button(
    "sc2-action",
    "+",
    loc`Raise the modifier by 1`,
    loc`Adds 1 to the modifier on the roll in the chat box.`
  );
  up.dataset.step = "1";
  for (const step of [down, up]) keepChatFocus(step);
  for (const step of [down, up])
    step.addEventListener("click", event =>
      change(event, () => (state.modifier = clampModifier(state.modifier + Number(step.dataset.step))))
    );
  modifier.append(down, value, up);
  top.append(quick, modifier);
  const dice = make("div", "sc2-chat-dice-dice");
  for (const faces of CHAT_DICE) {
    const die = button(
      "sc2-action",
      undefined,
      loc`Add a d${faces} to the roll in the chat box`,
      loc`Adds a d${faces} to the /r roll in the chat box. Press Enter in the chat box to roll it.`
    );
    die.dataset.faces = String(faces);
    die.append(make("span", "sc2-chat-dice-face", `d${faces}`), make("span", "sc2-chat-dice-count"));
    keepChatFocus(die);
    die.addEventListener("click", event =>
      change(event, () => state.dice.set(faces, (state.dice.get(faces) ?? 0) + 1))
    );
    dice.append(die);
  }
  root.append(top, dice);
  return root;
}

/**
 * Follow the chat box. In a chat log the bar sits just above the chat controls. While another sidebar tab is open,
 * Foundry shows the chat box in the notification area instead, and the bar sits just above it there.
 */
function placeBar(_app, elements) {
  const input = elements?.["#chat-message"];
  const controls = elements?.["#chat-controls"];
  if (!input || !controls) return;
  currentInput = input;
  // Also listen on the input itself, which reaches it in a detached window's document too.
  if (!hooked.has(input)) {
    hooked.add(input);
    input.addEventListener("plugins", addViewPlugin);
  }
  bar ??= buildBar();
  if (input.closest?.(".chat-form")) controls.before(bar);
  else input.before(bar);
  refreshBar();
}

/** Watch each chat editor through a ProseMirror plugin, which is how the bar reaches the editor to write in it. */
function addViewPlugin(event) {
  const input = event.target;
  if (input?.id !== "chat-message" || !event.plugins) return;
  const { Plugin } = foundry.prosemirror;
  event.plugins.sc2ChatDice = new Plugin({
    view(view) {
      views.set(input, view);
      return {
        update: () => syncWithInput(view),
        destroy: () => {
          if (views.get(input) === view) views.delete(input);
        }
      };
    }
  });
}

export function installChatDiceHooks() {
  if (installed) return;
  installed = true;
  // Capture, so the plugin is added whether or not Foundry's event bubbles.
  document.addEventListener("plugins", addViewPlugin, true);
  Hooks.on("renderChatInput", placeBar);
}
