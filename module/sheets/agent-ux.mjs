/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** Group repeated reminders without changing the engine's build validation. */
export function groupBuildTasks(tasks = []) {
  const groups = new Map();
  for (const task of tasks) {
    const key = JSON.stringify([task.tab, task.skillLevel, task.browse, task.text, task.order]);
    const entry = groups.get(key);
    if (entry) entry.count++;
    else groups.set(key, {...task, count: 1});
  }
  return [...groups.values()].map(task => ({...task,
    text: task.count > 1 && task.text.includes('choose a skill for Versatility')
      ? task.text.replace('choose a skill for Versatility', `choose ${task.count} more skills for Versatility`)
      : task.count > 1 ? `${task.text} (${task.count} choices)` : task.text
  }));
}

/** Keep current conditions visible even when the condition tools are collapsed. */
export function activeConditionLabels(system = {}) {
  const labels = new Set();
  for (const [key, value] of Object.entries(system.conditionContext ?? {})) {
    if (value === true) labels.add(key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase()));
  }
  if (system.conditionPenalties?.sickened) labels.add('Sickened');
  if (system.conditionPenalties?.entangled) labels.add('Entangled');
  if (system.conditionPenalties?.bound) labels.add('Bound');
  if (system.mentalLeapState?.exhausted) labels.add('Exhausted');
  else if (system.mentalLeapState?.fatigued) labels.add('Fatigued');
  if (system.mentalLeapState?.unconscious) labels.add('Unconscious');
  if (system.shakenState?.label) labels.add(system.shakenState.label);
  for (const entry of system.attributeCollapse?.entries ?? []) labels.add(`${entry.label}: ${entry.text}`);
  return [...labels];
}

/** Apply view behavior after each complete or partial sheet render. */
export function enhanceAgentSheet(element, context, state, localize = text => text) {
    element.classList.toggle("play-mode", !context.editMode);
    element.classList.toggle("edit-mode", !!context.editMode);
    // Use native buttons for actions so they support Tab, Enter and Space.
    // Tab navigation is managed separately by Foundry.
    for (const link of element.querySelectorAll('a[data-action]:not([data-action="tab"])')) {
      const button = element.ownerDocument.createElement("button");
      for (const attr of link.attributes) button.setAttribute(attr.name, attr.value);
      button.type = "button";
      button.classList.add("sc2-action");
      if (!link.textContent.trim()) {
        const label = link.dataset.tooltip
          ? localize(link.dataset.tooltip)
          : link.dataset.action.replace(/([a-z])([A-Z])/g, "$1 $2");
        button.setAttribute("aria-label", label);
      }
      button.replaceChildren(...link.childNodes);
      link.replaceWith(button);
    }
    for (const control of element.querySelectorAll('.edit-only:is(input, select, textarea), .edit-only input, .edit-only select, .edit-only textarea')) {
      if (!context.editMode && !control.disabled) {
        control.disabled = true;
        control.dataset.modeDisabled = "true";
      } else if (context.editMode && control.dataset.modeDisabled) {
        control.disabled = false;
        delete control.dataset.modeDisabled;
      }
    }
    const search = element.querySelector(".skill-search");
    const trained = element.querySelector(".trained-filter");
    if (search && trained) {
      search.value = state._skillSearch;
      trained.checked = state._trainedOnly;
      const filter = () => {
        state._skillSearch = search.value;
        state._trainedOnly = trained.checked;
        const query = search.value.trim().toLocaleLowerCase();
        const rows = [...element.querySelectorAll(".skills-table tbody tr")];
        for (const row of rows) row.hidden = !row.dataset.skillName.toLocaleLowerCase().includes(query)
          || (trained.checked && row.dataset.trained !== "true");
        element.querySelector(".skill-count").textContent = `${rows.filter(row => !row.hidden).length} of ${rows.length} skills`;
      };
      search.addEventListener("input", filter);
      trained.addEventListener("change", filter);
      filter();
    }
}
