import { loc } from "../i18n.mjs";
import { installResolutionGuide } from "./resolution-guide.mjs";

let helpId = 0;
const searches = new WeakMap();

export function configuredOptions(root) {
  return [...root.querySelectorAll("input[name], select[name], textarea[name]")].filter(control => {
    if (control.disabled) return false;
    if (["checkbox", "radio"].includes(control.type)) return control.checked;
    if (control.type === "number") return control.value !== "" && Number(control.value) !== 0;
    if (control.tagName === "SELECT") return control.selectedIndex > 0;
    return control.type !== "hidden" && !!control.value.trim();
  }).length;
}

/** A short, scannable caption with the original declaration kept beside its control. */
export function briefOption(root, name, caption) {
  const control = root.querySelector(`[name="${name}"]`);
  const label = control?.closest("label");
  if (!label || label.dataset.briefOption) return;
  label.dataset.briefOption = "true";
  const original = [...label.childNodes]
    .filter(node => node.nodeType === 3)
    .map(node => node.textContent)
    .join(" ")
    .trim();
  for (const node of [...label.childNodes]) if (node.nodeType === 3) node.remove();
  const text = root.ownerDocument.createTextNode(caption + " ");
  if (["checkbox", "radio"].includes(control.type)) label.append(text);
  else label.prepend(text);
  if (original && original !== caption) {
    const hint = root.ownerDocument.createElement("p");
    hint.className = "sc2-option-hint";
    hint.id = `sc2-option-help-${++helpId}`;
    hint.textContent = original;
    label.after(hint);
    control.setAttribute(
      "aria-describedby",
      [control.getAttribute("aria-describedby"), hint.id].filter(Boolean).join(" ")
    );
  }
}

/** Group existing controls without replacing, resetting or disabling them. */
export function organizeOptions(root, definitions = []) {
  const doc = root.ownerDocument;
  const grouped = new Map();
  let previous = null;
  const makeGroup = (definition, before) => {
    if (grouped.has(definition)) return grouped.get(definition);
    const group = doc.createElement("details");
    group.className = "sc2-option-group";
    const summary = doc.createElement("summary");
    summary.textContent = definition.label;
    group.append(summary);
    grouped.set(definition, group);
    root.insertBefore(group, before);
    return group;
  };
  const other = { label: loc`Other modifiers`, fields: [] };
  for (const child of [...root.children]) {
    if (child.matches("summary, .sc2-option-search, .sc2-option-empty, .sc2-option-group")) continue;
    if (child.tagName === "DETAILS") {
      child.classList.add("sc2-option-group");
      previous = null;
      continue;
    }
    const names = [...child.querySelectorAll("[name]")].map(control => control.name);
    const definition = definitions.find(group =>
      group.fields.some(field =>
        names.some(name => (field.endsWith("*") ? name.startsWith(field.slice(0, -1)) : name === field))
      )
    );
    if (names.length) previous = makeGroup(definition ?? other, child);
    if (previous) previous.append(child);
  }
  const groups = () => [...root.children].filter(child => child.matches("details.sc2-option-group"));
  for (const group of groups()) {
    const summary = group.querySelector(":scope > summary");
    if (!summary) continue;
    summary.dataset.optionTitle ??= summary.textContent.trim();
    if (!group.dataset.optionReady) {
      group.dataset.optionReady = "true";
      if (configuredOptions(group)) group.open = true;
    }
  }
  if (!searches.has(root)) {
    const toolbar = doc.createElement("div");
    toolbar.className = "sc2-option-search";
    const label = doc.createElement("label");
    label.textContent = loc`Find an option`;
    const input = doc.createElement("input");
    input.type = "search";
    input.placeholder = loc`Try Aim, cover, gear…`;
    label.append(input);
    const clear = doc.createElement("button");
    clear.type = "button";
    clear.textContent = loc`Clear search`;
    const result = doc.createElement("span");
    result.className = "sc2-option-results";
    result.setAttribute("role", "status");
    toolbar.append(label, clear, result);
    const empty = doc.createElement("p");
    empty.className = "sc2-option-empty";
    empty.textContent = loc`No matching options. Try a shorter search.`;
    root.querySelector(":scope > summary")?.after(toolbar);
    root.append(empty);
    const state = { input, clear, result, empty, remembered: null, fields: null };
    searches.set(root, state);
    input.addEventListener("input", () => refreshOptions(root));
    clear.addEventListener("click", () => {
      input.value = "";
      refreshOptions(root);
      input.focus();
    });
    root.addEventListener("change", () => refreshOptions(root));
    root.addEventListener("input", event => {
      if (event.target !== input) refreshOptions(root);
    });
    root.addEventListener(
      "invalid",
      event => {
        input.value = "";
        refreshOptions(root);
        for (let parent = event.target.parentElement; parent; parent = parent.parentElement) {
          if (parent.tagName === "DETAILS") parent.open = true;
          if (parent === root) break;
        }
      },
      true
    );
  }
  refreshOptions(root);
}

function refreshOptions(root) {
  const state = searches.get(root);
  const query = state.input.value.trim().toLocaleLowerCase();
  const groups = [...root.children].filter(child => child.matches("details.sc2-option-group"));
  if (query && !state.remembered)
    state.remembered = new Map(
      groups.flatMap(group => [group, ...group.querySelectorAll("details")]).map(group => [group, group.open])
    );
  if (query && !state.fields) state.fields = new Map();
  let visible = 0;
  for (const group of groups) {
    const summary = group.querySelector(":scope > summary");
    const count = configuredOptions(group);
    summary.textContent = count ? loc`${summary.dataset.optionTitle} (${count} set)` : summary.dataset.optionTitle;
    const hasContent = [...group.children].some(
      child =>
        child.tagName !== "SUMMARY" &&
        (child.textContent.trim() ||
          child.matches("input, select, textarea") ||
          child.querySelector("input, select, textarea"))
    );
    const match =
      hasContent &&
      group.dataset.optionExcluded !== "true" &&
      (!query || query.split(/\s+/).every(word => group.textContent.toLocaleLowerCase().includes(word)));
    group.hidden = !match;
    const titleMatch =
      query && query.split(/\s+/).every(word => summary.dataset.optionTitle.toLocaleLowerCase().includes(word));
    for (const label of group.querySelectorAll("label")) {
      if (query && !state.fields.has(label)) state.fields.set(label, label.hidden);
      const hints = [...label.querySelectorAll("[aria-describedby]")].flatMap(control =>
        control
          .getAttribute("aria-describedby")
          .split(/\s+/)
          .map(id => label.ownerDocument.getElementById(id))
          .filter(hint => hint?.classList.contains("sc2-option-hint"))
      );
      const text = [label.textContent, ...hints.map(hint => hint.textContent)].join(" ").toLocaleLowerCase();
      if (query)
        label.hidden =
          state.fields.get(label) || (!titleMatch && !query.split(/\s+/).every(word => text.includes(word)));
      else if (state.fields?.has(label)) label.hidden = state.fields.get(label);
      for (const hint of hints) {
        if (query && !state.fields.has(hint)) state.fields.set(hint, hint.hidden);
        if (query) hint.hidden = state.fields.get(hint) || label.hidden;
        else if (state.fields?.has(hint)) hint.hidden = state.fields.get(hint);
      }
    }
    if (match) visible++;
    if (query && match) {
      group.open = true;
      group.querySelectorAll("details").forEach(details => {
        details.open = true;
      });
    } else if (!query && state.remembered) {
      for (const details of [group, ...group.querySelectorAll("details")])
        if (state.remembered.has(details)) details.open = state.remembered.get(details);
    }
  }
  if (!query) {
    state.remembered = null;
    state.fields = null;
  }
  state.clear.disabled = !query;
  state.result.textContent = visible === 1 ? loc`1 option group` : loc`${visible} option groups`;
  state.empty.hidden = visible > 0;
}

/** Routine damage application keeps target, amount and reduction source above the exceptional cases. */
export function enhanceDamageDialog(_event, dialog) {
  const root = dialog.element?.querySelector(".spycraft2-roll-options");
  if (!root || root.dataset.damageUx || !root.querySelector('[name="damage"]')) return;
  root.dataset.damageUx = "true";
  const details = root.ownerDocument.createElement("details");
  details.className = "sc2-damage-options";
  const summary = root.ownerDocument.createElement("summary");
  summary.textContent = loc`Armor, critical hits and special damage`;
  details.append(summary);
  for (const name of ["type", "armorPiercing", "armorPiercingAll", "critical", "criticalDice", "blast"]) {
    const label = root.querySelector(`[name="${name}"]`)?.closest("label");
    if (label) details.append(label);
  }
  root.append(details);
  briefOption(details, "critical", loc`Activated critical hit`);
  briefOption(details, "criticalDice", loc`Critical action dice spent`);
  briefOption(details, "armorPiercingAll", loc`Ignore all damage reduction`);
  organizeOptions(details, [
    { label: loc`Armor penetration`, fields: ["armorPiercing", "armorPiercingAll"] },
    { label: loc`Critical hit`, fields: ["critical", "criticalDice"] },
    { label: loc`Special damage and blasts`, fields: ["type", "blast"] }
  ]);
  const update = () => {
    const count = configuredOptions(details);
    summary.textContent = count
      ? loc`Armor, critical hits and special damage (${count} set)`
      : loc`Armor, critical hits and special damage`;
  };
  details.open = configuredOptions(details) > 0;
  details.addEventListener("input", update);
  installResolutionGuide(root, "damage", { append: true });
  details.addEventListener("change", update);
  update();
}
