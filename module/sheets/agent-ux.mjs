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

/** A guide to outstanding work, not an invented character-completion percentage. */
export function buildSetupGuide(tasks = []) {
  const labels = {main: 'Attributes & origins', classes: 'Classes', skills: 'Skills',
    feats: 'Feats', training: 'Training', gear: 'Gear', bio: 'Biography'};
  const ordered = groupBuildTasks(tasks).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const steps = new Map();
  for (const task of ordered) {
    const tab = Object.hasOwn(labels, task.tab) ? task.tab : 'main';
    if (!steps.has(tab)) steps.set(tab, {tab, label: labels[tab], count: 0, tasks: []});
    const step = steps.get(tab);
    step.count += task.count;
    step.tasks.push({...task, tab});
  }
  const first = steps.values().next().value;
  return {next: first ? {...first.tasks[0], label: first.label} : null,
    count: ordered.reduce((sum, task) => sum + task.count, 0), steps: [...steps.values()]};
}

/** These flags choose shortcuts only. The action controllers still decide legality. */
export function combatToolVisibility(system = {}, stances = {}) {
  const feats = new Set(system.activeFeatNames ?? []);
  const earnedStances = Object.values(stances).filter(stance => feats.has(stance.feat));
  const tools = {
    stance: earnedStances.length > 0 || !!system.combatStance,
    movement: earnedStances.some(stance => stance.movementLimitFeet) || !!system.stanceRoundMovement,
    striking: feats.has('Polearm Basics') || system.combatStance?.key === 'striking',
    missTrick: feats.has('Flail Basics') || feats.has('Fencing Basics'),
    darting: feats.has('Darting Weapon') || !!system.dartingStyle,
    twoWeapon: feats.has('Two-Weapon Basics') || !!system.twoWeaponStyle,
    expertise: feats.has('Combat Expertise') || !!system.combatExpertise,
    cover: feats.has('Superior Cover') || !!system.superiorCover
  };
  return {...tools, styles: tools.stance || tools.movement || tools.darting || tools.twoWeapon};
}

/** Reveal the actual build field, including any collapsed ancestors, after navigation. */
export function focusSetupTask(element, {tab, order} = {}) {
  const section = element.querySelector(`section[data-tab="${tab}"]`);
  if (!section) return;
  const selectors = {
    main: [4, 51].includes(Number(order)) ? '[name^="originChoice."]'
      : Number(order) === 11 ? '[name^="system.abilityIncreases."]'
      : '[name^="system.abilities."][name$=".base"]',
    classes: Number(order) === 15 ? '[data-action="rollVitality"]'
      : '[name^="choice."], [name^="classSkillChoice."], [name^="inheritedChoice."], [name^="specialistChoice."], [name^="classField."]',
    skills: '[name^="skillpts."]',
    feats: Number(order) === 42 ? '[data-action="itemEdit"]' : '[data-action="browse"][data-type="feat"]',
    training: ({50: '[name^="system.proficiencies."]',
      51: '[data-action="toggleFocus"], [name="professionText"], [name="fortesText"]',
      52: '[name="system.interests"]',
      53: '[name^="contacts."][name$=".name"], [data-action="addRow"][data-list="contacts"]',
      54: '[name^="subplots."][name$=".name"], [data-action="addRow"][data-list="subplots"]'})[Number(order)]
      ?? 'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    gear: Number(order) === 60 ? '[name^="system.wealthAllocation."]' : '[data-action="itemEdit"]'
  };
  const candidates = [...section.querySelectorAll(selectors[tab] ?? 'input, select, textarea, button')]
    .filter(control => !control.disabled);
  const field = candidates.find(control => control.tagName === 'SELECT' && !control.value) ?? candidates[0];
  if (!field) return;
  for (let parent = field.parentElement; parent && parent !== section; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') parent.open = true;
  }
  field.scrollIntoView({block: 'nearest'});
  field.focus({preventScroll: true});
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

function sheetActionLabel(link, context, localize) {
  const itemId = link.closest('[data-item-id]')?.dataset.itemId;
  const item = context.actor?.items?.get?.(itemId)
    ?? context.actor?.items?.contents?.find(entry => entry.id === itemId);
  const itemName = item?.name ?? 'item';
  const types = {weapon:'weapons',armor:'armor',gear:'gear',vehicle:'vehicles',feat:'feats',class:'classes',origin:'origins'};
  const rows = {contacts:'contact',subplots:'subplot',skillFortes:'skill forte'};
  const label = {
    browse: `Browse ${types[link.dataset.type] ?? 'options'}`,
    createItem: `Add ${link.dataset.type ?? 'item'}`,
    itemEquip: `${item?.system?.equipped ? 'Unequip' : 'Equip'} ${itemName}`,
    itemDelete: `Remove ${itemName}`,
    itemChat: `Share ${itemName} in chat`,
    syncGrants: 'Refresh granted feats',
    addRow: `Add ${rows[link.dataset.list] ?? 'entry'}`,
    removeRow: `Remove ${rows[link.dataset.list] ?? 'entry'}`
  }[link.dataset.action];
  const tooltip = link.dataset.tooltip ? localize(link.dataset.tooltip) : '';
  return label ?? (tooltip && tooltip !== link.dataset.tooltip ? tooltip
    : link.dataset.action.replace(/([a-z])([A-Z])/g, '$1 $2'));
}

/** Apply view behavior after each complete or partial sheet render. */
export function enhanceAgentSheet(element, context, state, localize = text => text) {
    element.classList.toggle("play-mode", !context.editMode);
    element.classList.toggle("edit-mode", !!context.editMode);
    state._open ??= {};
    for (const details of element.querySelectorAll('details[data-key]')) {
      if (Object.hasOwn(state._open, details.dataset.key)) details.open = state._open[details.dataset.key];
      if (!details.dataset.sc2Remembered) {
        details.dataset.sc2Remembered = 'true';
        details.addEventListener('toggle', () => { state._open[details.dataset.key] = details.open; });
      }
    }
    // Use native buttons for actions so they support Tab, Enter and Space.
    // Tab navigation is managed separately by Foundry.
    for (const link of element.querySelectorAll('a[data-action]:not([data-action="tab"])')) {
      const button = element.ownerDocument.createElement("button");
      for (const attr of link.attributes) button.setAttribute(attr.name, attr.value);
      button.type = "button";
      button.classList.add("sc2-action");
      if (!link.textContent.trim()) {
        const label = link.getAttribute('aria-label') ?? sheetActionLabel(link, context, localize);
        button.setAttribute('aria-label', label);
        button.dataset.tooltip = label;
        button.title = label;
        // Toolbar labels are visible; compact origin controls retain their explicit labels.
        if (link.closest('.controls')) {
          const text = element.ownerDocument.createElement('span');
          text.textContent = ({itemChat:'Share',itemDelete:'Remove',itemEquip:'Equip / unequip',
            syncGrants:'Refresh grants',removeRow:'Remove'})[link.dataset.action] ?? label;
          button.append(text);
        }
      }
      button.prepend(...link.childNodes);
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
