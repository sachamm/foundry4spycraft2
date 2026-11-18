/**
 * Feat reminders: the "declare and remind" tier of feat automation.
 *
 * A feat the rules do not carry out can still say which rolls it bears on. The roll dialog then lists the
 * character's matching feats; the ones the player ticks are noted on the posted check for the GC to adjudicate.
 * Nothing is added to the roll.
 *
 * A feat item stores `system.reminder = { rolls, text }`:
 *   rolls  comma-separated roll kinds: attack, damage, knowledge, skill, skill:<key>, save, save:<key> (fort, ref,
 *          will). "skill" and "save" on their own match every skill or save. Only rolls that open a dialog can
 *          remind, so initiative and plain attribute checks are not kinds.
 *   text   the line shown beside the feat's name.
 */
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const REMINDER_KINDS = ["attack", "damage", "knowledge", "skill", "save"];
const SAVES = ["fort", "ref", "will"];

/** The tokens of a `rolls` value that mean something, in order, without repeats. */
export function reminderTokens(rolls, skillKeys = null) {
  const list = Array.isArray(rolls) ? rolls : String(rolls ?? "").split(/[,;\s]+/);
  const tokens = [];
  for (const raw of list) {
    const [kind, key = ""] = String(raw).trim().split(":");
    const lower = kind.toLowerCase();
    if (!REMINDER_KINDS.includes(lower)) continue;
    if (key && !["skill", "save"].includes(lower)) continue;
    if (lower === "save" && key && !SAVES.includes(key)) continue;
    if (lower === "skill" && key && skillKeys && !skillKeys.includes(key)) continue;
    const token = key ? `${lower}:${key}` : lower;
    if (!tokens.includes(token)) tokens.push(token);
  }
  return tokens;
}

/** Whether a feat's tokens cover a roll: { kind, skillKey?, saveKey? }. */
export function reminderApplies(tokens, { kind, skillKey = "", saveKey = "" } = {}) {
  for (const token of tokens) {
    const [tokenKind, key = ""] = token.split(":");
    if (tokenKind !== kind) continue;
    if (!key) return true;
    if (kind === "skill" && key === skillKey) return true;
    if (kind === "save" && key === saveKey) return true;
  }
  return false;
}

/**
 * The reminders a character's feats offer for a roll.
 * @param {Iterable<object>} items  the character's items ({ id, name, type, system })
 * @param {object} roll             { kind, skillKey?, saveKey? }
 * @returns {{id: string, name: string, text: string}[]} one per feat name, in name order
 */
export function featReminders(items, roll) {
  const seen = new Set(),
    list = [];
  for (const item of items ?? []) {
    if (item?.type !== "feat") continue;
    const reminder = item.system?.reminder;
    if (!reminder || seen.has(item.name)) continue;
    if (!reminderApplies(reminderTokens(reminder.rolls), roll)) continue;
    seen.add(item.name);
    list.push({ id: String(item.id ?? item._id ?? item.name), name: item.name, text: String(reminder.text ?? "") });
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

const FIELD = "featReminder-";

/** The reminders ticked in a submitted roll dialog, matched against the ones that were offered. */
export function chosenReminders(offered, entered = {}) {
  return offered.filter(reminder => entered[FIELD + reminder.id] === true).map(({ name, text }) => ({ name, text }));
}

/** The line a posted check shows for the feats its player noted. */
export function reminderNote(reminders) {
  if (!Array.isArray(reminders) || !reminders.length) return "";
  const list = reminders.map(reminder => (reminder.text ? `${reminder.name} (${reminder.text})` : reminder.name));
  return loc`Feats noted for the GC to apply: ${list.join("; ")}`;
}

/** The roll a dialog is for, from the context the dialog was drawn with. */
export function dialogRoll(dialog, context = {}) {
  if (dialog === "skill") return { kind: "skill", skillKey: context.key ?? "" };
  if (dialog === "save") return { kind: "save", saveKey: context.key ?? "" };
  if (dialog === "knowledge") return { kind: "knowledge" };
  if (dialog === "damage") return { kind: "damage" };
  if (dialog === "attack" || dialog === "rangedAttack") return { kind: "attack" };
  return null;
}

const DIALOGS = ["skill", "save", "knowledge", "attack", "rangedAttack", "damage"];
const escape = value =>
  String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** The dialog section listing a character's reminders for a roll; empty when there are none. */
export function reminderSection(reminders) {
  if (!reminders.length) return "";
  return `<fieldset class="spycraft2-feat-reminders"><legend>${loc`Feats to keep in mind`}</legend><p class="hint">${loc`These feats are not worked out for you. Tick the ones that apply to this roll; they are noted on it for the GC.`}</p>${reminders
    .map(
      reminder =>
        `<label><input type="checkbox" name="${FIELD}${escape(reminder.id)}" /> <strong>${escape(reminder.name)}</strong>${reminder.text ? ` — ${escape(reminder.text)}` : ""}</label>`
    )
    .join("")}</fieldset>`;
}

rollPipeline.register({
  id: "featReminders",
  order: 9900,
  dialogs: DIALOGS,
  // After everything else in the form, so each roll dialog ends with the same section.
  dialog(context) {
    const roll = dialogRoll(context.dialog, context);
    return roll ? [{ at: 1_000_000, html: reminderSection(featReminders(context.actor?.items, roll)) }] : null;
  },
  read(context, input) {
    const roll = dialogRoll(context.dialog, context);
    if (!roll) return null;
    // A caller that already decided (a scripted roll, a reroll) keeps its own list.
    if (Array.isArray(input?.featReminders)) return null;
    // Nothing offered, nothing to add: what was entered is passed on untouched.
    const offered = featReminders(context.actor?.items, roll);
    return offered.length ? { featReminders: chosenReminders(offered, context.entered ?? input) } : null;
  },
  record: ["featReminders"]
});
