/**
 * Roll dialogs that remember what was chosen last time, and the Shift-click fast path that skips them.
 *
 *  - `rememberChoices(key, input)` keeps a dialog's entered values for this session on this client.
 *  - `restoreChoices(key, root)` puts them back into the next dialog with the same key and says how many were
 *    carried over, with a button to clear them. Targets, distances and anything the GC confirms are never carried
 *    over, nor Aim and Brace, which take an action of their own each time: they belong to one roll.
 *  - `skipDialog(event)` is true for a Shift-click, or for a plain click when the player's setting swaps the two.
 *
 * Nothing here is stored on the actor: a remembered choice is a convenience for the person rolling.
 */
import { loc } from "../i18n.mjs";
import { measureAttack, mapAvailable } from "./map.mjs";

const memory = new Map();

/** Fields that describe one particular roll and are never carried over to the next. */
export const NEVER_REMEMBERED =
  /^(characterTarget|distanceFeet|reachAdjacency|reachAdjacent|aimed|braced|secret|modifier)$|^target|Confirmed$|Uuid$|Name$/;

/** The key a weapon's or skill's choices are kept under. */
export const choiceKey = (kind, actor, id) => `${kind}:${actor?.uuid ?? ""}:${id ?? ""}`;

/** Keep what was entered in a dialog, without the fields that belong to one roll only. */
export function rememberChoices(key, input) {
  if (!key || !input || typeof input !== "object") return;
  const kept = Object.entries(input).filter(
    ([name, value]) =>
      !NEVER_REMEMBERED.test(name) && ["string", "number", "boolean"].includes(typeof value) && value !== ""
  );
  if (kept.length) memory.set(key, Object.fromEntries(kept));
  else memory.delete(key);
}

export const rememberedChoices = key => memory.get(key) ?? null;
export const forgetChoices = key => memory.delete(key);

/**
 * Put remembered values back into an open dialog. Values that differ from the dialog's defaults are counted and a
 * note offers to clear them. Returns the number carried over.
 */
export function restoreChoices(key, root) {
  const saved = memory.get(key),
    form = root?.querySelector?.("form") ?? root;
  if (!saved || !form?.querySelector) return 0;
  const changed = [];
  for (const [name, value] of Object.entries(saved)) {
    const field = form.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!field || field.disabled) continue;
    if (field.type === "checkbox") {
      if (field.checked === (value === true)) continue;
      changed.push([field, field.checked]);
      field.checked = value === true;
    } else {
      if (String(field.value) === String(value)) continue;
      if (field.tagName === "SELECT" && ![...field.options].some(option => option.value === String(value))) continue;
      changed.push([field, field.value]);
      field.value = String(value);
    }
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (!changed.length) return 0;
  const holder = form.querySelector(".spycraft2-roll-options") ?? form;
  const note = document.createElement("p");
  note.className = "hint sc2-remembered";
  note.textContent = loc`${changed.length} choice(s) carried over from your last roll. `;
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "sc2-quiet-action";
  reset.textContent = loc`Reset`;
  reset.addEventListener("click", () => {
    for (const [field, before] of changed) {
      if (field.type === "checkbox") field.checked = before;
      else field.value = before;
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
    memory.delete(key);
    note.remove();
  });
  note.append(reset);
  holder.prepend(note);
  return changed.length;
}

/* -------------------------------------------- */
/*  Fast path                                    */
/* -------------------------------------------- */

/** Register the player's setting. Call during `init`. */
export function registerFastPathSetting() {
  game.settings.register("spycraft2", "skipRollDialogs", {
    name: loc`Roll without the dialog by default`,
    hint: loc`Off: a click opens the roll dialog and Shift-click rolls straight away with your last choices. On: the other way round.`,
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
}

/** Whether this click should roll straight away. */
export function skipDialog(event) {
  let swapped = false;
  try {
    swapped = game.settings.get("spycraft2", "skipRollDialogs") === true;
  } catch {
    /* not registered (tests) */
  }
  return (event?.shiftKey === true) !== swapped;
}

/**
 * Options for an attack rolled without its dialog: the remembered choices for this weapon, plus the targeted token
 * and what the map shows (distance, flanking, adjacency). Anything still missing is asked for by the attack itself.
 */
export function quickAttackOptions(actor, item) {
  const entered = { attackAction: "standard", ...(rememberedChoices(choiceKey("attack", actor, item?.id)) ?? {}) };
  const targeted = [...(game.user?.targets ?? [])];
  if (targeted.length === 1 && targeted[0].actor) entered.targetActorUuid = targeted[0].actor.uuid;
  if (mapAvailable())
    try {
      const measured = measureAttack(actor);
      if (measured) {
        entered.distanceFeet = measured.distanceFeet;
        entered.targetFlanked = measured.flanked;
        entered.reachAdjacency = measured.adjacent ? "adjacent" : "nonadjacent";
        if (measured.targetActorUuid) entered.targetActorUuid = measured.targetActorUuid;
      }
    } catch {
      /* the map could not be read: the roll goes ahead without it */
    }
  // The attack reads these as if they had been entered in its dialog.
  return { quickEntered: entered };
}
