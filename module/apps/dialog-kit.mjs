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

/**
 * Open a themed option dialog built from fields and resolve to its values by field name, or null if it is closed.
 * @param {object} spec
 * @param {string} spec.title
 * @param {string} [spec.intro]    One purpose line, shown first
 * @param {Array} spec.fields      See fieldMarkup()
 * @param {object} [spec.dialog]   Further DialogV2 options
 */
export function formDialog({ title, intro, fields, dialog = {} }) {
  return systemDialog.input({
    window: { title },
    rejectClose: false,
    content: optionsMarkup({ intro, fields }),
    ...dialog
  });
}

/** A weapon picker listing the actor's items that pass `ready`, by name. */
export const weaponField = (actor, label, { name = "weaponId", ready = () => true } = {}) => ({
  select: name,
  label,
  options: actor.items.filter(ready).map(item => [item.id, item.name])
});
