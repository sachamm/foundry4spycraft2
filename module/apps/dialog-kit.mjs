/**
 * The shared kit for dialogs and chat cards built in code: escaping, refusals, the lead-GC check, and a small
 * builder for option dialogs. One import instead of a local copy of each helper in every file.
 *
 * A dialog is described as a list of fields, not typed out as one long string of HTML:
 *
 *   const input = await formDialog({
 *     title: loc`Opportunist final attack`,
 *     intro: loc`Once per round, …`,
 *     fields: [
 *       { text: "triggerDescription", label: loc`What happened`, maxlength: 300 },
 *       weaponField(actor, loc`Your readied weapon`),
 *       raw(standardAttackContextContent(actor)),
 *       { check: "triggerConfirmed", label: loc`The GC confirms …` }
 *     ]
 *   });
 *
 * Every label and option is escaped. The result is what DialogV2.input returns: the form's values by field name,
 * or null when the dialog is closed.
 */
import { esc, markup, markupFragment, raw, RawHTML } from "../html.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { loc } from "../i18n.mjs";

export { esc, markup, markupFragment, raw, RawHTML };
export { refuse } from "../error-notices.mjs";
export { isLeadGM, primaryWriterFor } from "../writers.mjs";

const attribute = (name, value) =>
  value === undefined || value === null || value === false ? "" : markupFragment` ${raw(name)}="${value}"`;

/**
 * One field as markup. A field is an object whose first key names its kind and holds the form field's name:
 *
 *   { text: name, label, maxlength?, value?, placeholder? }
 *   { number: name, label, min?, max?, step?, value?, required? }
 *   { check: name, label, checked? }     A tick box. Name a GC attestation "…Confirmed": with "Trust the table"
 *                                        on, those are ticked when the dialog opens; other boxes never are.
 *   { select: name, label, options?, selected?, blank?, optionsHtml? }   options: [[value, label], …]; blank:
 *                                        label of an empty first choice; optionsHtml: raw(…) option elements
 *                                        built elsewhere, placed after the others
 *   { note: text }                       A paragraph
 *
 * Markup built elsewhere goes in as raw(…) or a markupFragment.
 */
export function fieldMarkup(field) {
  if (field instanceof RawHTML) return field;
  if (!field) return raw("");
  if ("text" in field)
    return markupFragment`<label>${field.label} <input name="${field.text}"${attribute("value", field.value)}${attribute("placeholder", field.placeholder)}${attribute("maxlength", field.maxlength)} /></label>`;
  if ("number" in field)
    return markupFragment`<label>${field.label} <input name="${field.number}" type="number"${attribute("min", field.min)}${attribute("max", field.max)}${attribute("step", field.step)}${attribute("value", field.value)}${raw(field.required ? " required" : "")} /></label>`;
  if ("check" in field)
    return markupFragment`<label><input name="${field.check}" type="checkbox"${raw(field.checked ? " checked" : "")} /> ${field.label}</label>`;
  if ("select" in field) {
    const options = (field.options ?? []).map(
      ([value, label]) =>
        markupFragment`<option value="${value}"${raw(field.selected !== undefined && String(field.selected) === String(value) ? " selected" : "")}>${label}</option>`
    );
    const blank = field.blank === undefined ? "" : markupFragment`<option value="">${field.blank}</option>`;
    return markupFragment`<label>${field.label} <select name="${field.select}">${blank}${options}${field.optionsHtml ?? ""}</select></label>`;
  }
  if ("note" in field) return markupFragment`<p>${field.note}</p>`;
  throw new Error(`Unknown dialog field: ${Object.keys(field).join(", ")}`);
}

/** The body of an option dialog: an optional purpose line, then the fields in the order they are decided. */
export function optionsMarkup({ intro, fields = [] }) {
  return markup`<div class="spycraft2-roll-options">${intro ? markupFragment`<p>${intro}</p>` : ""}${fields.map(fieldMarkup)}</div>`;
}

/** Put the keyboard in the first field a person fills in, so the submit button is not what Enter lands on first. */
export function focusFirstField(content) {
  let done = false;
  return String(content).replace(/<(input|select|textarea)\b([^>]*)>/g, (tag, name, rest) => {
    if (
      done ||
      /\bautofocus\b/.test(rest) ||
      /type="(?:checkbox|radio|hidden)"/.test(rest) ||
      /\bdisabled\b/.test(rest)
    )
      return tag;
    done = true;
    return `<${name} autofocus${rest}>`;
  });
}

/**
 * Whether a field marked data-when="name=a|b" (or "name!=a|b") is wanted for the form's current choices.
 * @param {string} rule
 * @param {(name: string) => string} valueOf  Current value of the named control
 */
export function whenMatches(rule, valueOf) {
  const match = /^([\w-]+)(!?=)(.*)$/.exec(String(rule ?? ""));
  if (!match) return true;
  const listed = match[3].split("|").includes(String(valueOf(match[1]) ?? ""));
  return match[2] === "=" ? listed : !listed;
}

/**
 * Show only the fields that go with the option chosen: every element carrying data-when is hidden until the control
 * it names holds one of the listed values. Hidden fields keep their values, so what was typed survives a change of
 * mind, and the code reading the form sees the same names as before.
 */
export function wireConditionalFields(root) {
  const fields = [...(root?.querySelectorAll?.("[data-when]") ?? [])];
  if (!fields.length) return;
  const form = fields[0].closest("form") ?? root;
  const valueOf = name => form.querySelector(`[name="${name}"]`)?.value ?? "";
  const apply = () => {
    for (const field of fields) {
      field.hidden = !whenMatches(field.dataset.when, valueOf);
      relaxHiddenRules(field);
    }
  };
  form.addEventListener("change", apply);
  apply();
}

const RULES = ["required", "min", "max", "step", "pattern", "minlength", "maxlength"];
/**
 * A hidden field must not stop the dialog: the browser checks hidden controls too and cannot show its message on
 * them. Their limits are set aside while hidden and put back when the field shows again.
 */
export function relaxHiddenRules(field) {
  const controls = [
    ...(field.matches?.("input, select, textarea") ? [field] : []),
    ...(field.querySelectorAll?.("input, select, textarea") ?? [])
  ];
  for (const control of controls) {
    if (field.hidden) {
      const kept = {};
      for (const rule of RULES)
        if (control.hasAttribute(rule)) {
          kept[rule] = control.getAttribute(rule);
          control.removeAttribute(rule);
        }
      if (Object.keys(kept).length) control.dataset.heldRules = JSON.stringify(kept);
    } else if (control.dataset.heldRules) {
      for (const [rule, value] of Object.entries(JSON.parse(control.dataset.heldRules)))
        control.setAttribute(rule, value);
      delete control.dataset.heldRules;
    }
  }
}

/** Cancel always closes: it skips the browser's field checks, which would otherwise hold the dialog open. */
export function freeCancel(root) {
  for (const button of root?.querySelectorAll?.('button[data-action="cancel"]') ?? []) button.formNoValidate = true;
}

/**
 * Open a themed option dialog built from fields and resolve to its values by field name, or null if it is closed.
 * The dialog has a Cancel button, its main button names the action, and the keyboard starts in the first field.
 * @param {object} spec
 * @param {string} spec.title
 * @param {string} [spec.intro]    One purpose line, shown first
 * @param {Array} spec.fields      See fieldMarkup()
 * @param {string} [spec.ok]       Label of the main button: the action it takes ("Add objective"), not "Confirm"
 * @param {object} [spec.dialog]   Further DialogV2 options
 */
export function formDialog({ title, intro, fields, ok, dialog = {} }) {
  return cancellable(systemDialog.input, {
    window: { title },
    rejectClose: false,
    content: focusFirstField(optionsMarkup({ intro, fields })),
    ok: { label: ok ?? loc`Confirm` },
    buttons: [cancelButton()],
    ...dialog,
    render: (event, app) => {
      wireConditionalFields(app?.element ?? event?.target);
      freeCancel(app?.element ?? event?.target);
      return dialog.render?.(event, app);
    }
  });
}

/** The Cancel button every option dialog carries. */
export const cancelButton = () => ({ action: "cancel", label: loc`Cancel` });

/**
 * Open a dialog whose Cancel button answers like closing it. Foundry answers a button that has no result of its
 * own with the button's name, so "cancel" is turned into null here, the answer callers already treat as "closed".
 */
export async function cancellable(open, options) {
  const result = await open(options);
  return result === "cancel" ? null : result;
}

/** A weapon picker listing the actor's items that pass `ready`, by name. */
export const weaponField = (actor, label, { name = "weaponId", ready = () => true } = {}) => ({
  select: name,
  label,
  options: actor.items.filter(ready).map(item => [item.id, item.name])
});
