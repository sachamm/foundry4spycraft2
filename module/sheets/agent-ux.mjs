import { loc } from "../i18n.mjs";
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
    else groups.set(key, { ...task, count: 1 });
  }
  return [...groups.values()].map(task => ({
    ...task,
    // A reminder that knows how to speak for several at once does so; the rest are counted.
    text:
      task.count > 1 && typeof task.plural === "function"
        ? task.plural(task.count)
        : task.count > 1
          ? loc`${task.text} (${task.count} choices)`
          : task.text
  }));
}

/** A guide to outstanding work, not an invented character-completion percentage. */
export function buildSetupGuide(tasks = []) {
  const labels = {
    main: "Attributes & origins",
    classes: loc`Classes`,
    skills: loc`Skills`,
    feats: loc`Feats`,
    training: "Training",
    gear: loc`Gear`,
    bio: loc`Biography`
  };
  const ordered = groupBuildTasks(tasks).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const steps = new Map();
  for (const task of ordered) {
    const tab = Object.hasOwn(labels, task.tab) ? task.tab : "main";
    if (!steps.has(tab)) steps.set(tab, { tab, label: labels[tab], count: 0, tasks: [] });
    const step = steps.get(tab);
    step.count += task.count;
    step.tasks.push({ ...task, tab });
  }
  // The next step is the first reminder of the earliest creation step with something waiting: the same step the
  // creation track marks as the place to start, so the two never point at different things.
  const next = ordered
    .map((task, index) => ({ task, index, step: TRACK_STEPS.findIndex(step => step.key === trackStepOf(task)) }))
    .sort((a, b) => a.step - b.step || a.index - b.index)[0]?.task;
  const nextTab = next ? (Object.hasOwn(labels, next.tab) ? next.tab : "main") : null;
  return {
    next: next ? { ...next, tab: nextTab, label: labels[nextTab] } : null,
    count: ordered.reduce((sum, task) => sum + task.count, 0),
    steps: [...steps.values()]
  };
}

// The order a character is built in (p.13). Each step names the pane that resolves it and where to land there.
const TRACK_STEPS = [
  { key: "attributes", tab: "main" },
  { key: "origin", tab: "main", order: 4 },
  { key: "class", tab: "classes" },
  { key: "skills", tab: "skills" },
  { key: "feats", tab: "feats" },
  { key: "interests", tab: "training", order: 52 },
  { key: "subplot", tab: "training", order: 54 },
  { key: "derived" },
  { key: "describe", tab: "bio" },
  { key: "gear", tab: "gear" }
];

function trackStepOf(task) {
  const order = Number(task.order);
  if (task.tab === "classes") return "class";
  if (task.tab === "skills") return "skills";
  if (task.tab === "feats") return "feats";
  if (task.tab === "training") return order === 54 ? "subplot" : "interests";
  if (task.tab === "gear") return "gear";
  if (task.tab === "bio") return "describe";
  return [4, 51].includes(order) ? "origin" : "attributes";
}

/**
 * The creation steps with the reminders still open at each. A step without reminders is not claimed to be
 * finished; it simply has nothing waiting. The first step with something waiting is where to start.
 */
export function buildCreationTrack(tasks = []) {
  const waiting = new Map();
  for (const task of groupBuildTasks(tasks).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    const key = trackStepOf(task);
    if (!waiting.has(key)) waiting.set(key, { count: 0, first: task });
    waiting.get(key).count += task.count;
  }
  let started = false;
  const steps = TRACK_STEPS.map((step, index) => {
    const open = waiting.get(step.key);
    const target = open?.first ?? step;
    const start = !!open && !started;
    if (start) started = true;
    return {
      key: step.key,
      number: index + 1,
      label: `SPYCRAFT.Track.${step.key}`,
      automatic: !step.tab,
      count: open?.count ?? 0,
      start,
      tab: target.tab ?? step.tab,
      order: target.order ?? step.order,
      skillLevel: target.skillLevel,
      browse: target.browse
    };
  });
  return { steps, waiting: steps.reduce((sum, step) => sum + step.count, 0) };
}

/** These flags choose shortcuts only. The action controllers still decide legality. */
export function combatToolVisibility(system = {}, stances = {}, { showAll = false } = {}) {
  const feats = new Set(system.activeFeatNames ?? []);
  const stanceKey = system.combatStance?.key;
  const earnedStances = Object.values(stances).filter(stance => feats.has(stance.feat));
  const tools = {
    stance: earnedStances.length > 0 || !!system.combatStance,
    movement: earnedStances.some(stance => stance.movementLimitFeet) || !!system.stanceRoundMovement,
    striking: feats.has("Polearm Basics") || system.combatStance?.key === "striking",
    missTrick: feats.has("Flail Basics") || feats.has("Fencing Basics"),
    darting: feats.has("Darting Weapon") || !!system.dartingStyle,
    followUp: feats.has("Follow-Up Shot"),
    twoHit: feats.has("Two-Hit Combo"),
    duelingBasics: feats.has("Dueling Basics"),
    intense: feats.has("Whip Basics"),
    snakeStrike: feats.has("Snake Strike"),
    twoWeapon: feats.has("Two-Weapon Basics") || !!system.twoWeaponStyle,
    expertise: feats.has("Combat Expertise") || !!system.combatExpertise,
    cover: feats.has("Superior Cover") || !!system.superiorCover,
    fend: feats.has("Polearm Basics"),
    threadNeedle: feats.has("Staff Basics"),
    stanceDamage: feats.has("Flail Basics") || feats.has("Axe Basics") || ["punishing", "menacing"].includes(stanceKey),
    drivingStance: feats.has("Hammer Basics") || stanceKey === "driving",
    powerStance: feats.has("Great Sword Basics") || stanceKey === "power"
  };
  // The GC can reveal every shortcut, for example to settle a record left by a feat the character has lost.
  if (showAll) for (const key of Object.keys(tools)) tools[key] = true;
  return { ...tools, styles: tools.stance || tools.movement || tools.darting || tools.twoWeapon };
}

/** Reveal the actual build field, including any collapsed ancestors, after navigation. */
export function focusSetupTask(element, { tab, order } = {}) {
  // A pane is the part of a tab that one build step works in; a tab without panes is its own pane.
  const section = element.querySelector(`[data-pane="${tab}"]`) ?? element.querySelector(`section[data-tab="${tab}"]`);
  if (!section) return;
  const selectors = {
    main: [4, 51].includes(Number(order))
      ? '[name^="originChoice."]'
      : Number(order) === 11
        ? '[name^="system.abilityIncreases."]'
        : loc`[name^="system.abilities."][name$=".base"]`,
    classes:
      Number(order) === 15
        ? '[data-action="rollVitality"]'
        : loc`[name^="choice."], [name^="classSkillChoice."], [name^="inheritedChoice."], [name^="specialistChoice."], [name^="classField."]`,
    skills: '[name^="skillpts."]',
    feats: Number(order) === 42 ? '[data-action="itemEdit"]' : loc`[data-action="browse"][data-type="feat"]`,
    training:
      {
        50: '[name^="system.proficiencies."]',
        51: loc`[data-action="toggleFocus"], [name="professionText"], [name="fortesText"]`,
        52: '[name="system.interests"]',
        53: loc`[name^="contacts."][name$=".name"], [data-action="addRow"][data-list="contacts"]`,
        54: loc`[name^="subplots."][name$=".name"], [data-action="addRow"][data-list="subplots"]`
      }[Number(order)] ?? loc`input:not([disabled]), select:not([disabled]), textarea:not([disabled])`,
    gear: Number(order) === 60 ? '[name^="system.wealthAllocation."]' : '[data-action="itemEdit"]'
  };
  const candidates = [...section.querySelectorAll(selectors[tab] ?? loc`input, select, textarea, button`)].filter(
    control => !control.disabled
  );
  const field = candidates.find(control => control.tagName === "SELECT" && !control.value) ?? candidates[0];
  if (!field) return;
  for (let parent = field.parentElement; parent && parent !== section; parent = parent.parentElement) {
    if (parent.tagName === "DETAILS") parent.open = true;
  }
  field.scrollIntoView({ block: "nearest" });
  field.focus({ preventScroll: true });
}

/** Keep current conditions visible even when the condition tools are collapsed. */
export function activeConditionLabels(system = {}) {
  const labels = new Set();
  for (const [key, value] of Object.entries(system.conditionContext ?? {})) {
    if (value === true) labels.add(key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase()));
  }
  if (system.conditionPenalties?.sickened) labels.add("Sickened");
  if (system.conditionPenalties?.entangled) labels.add("Entangled");
  if (system.conditionPenalties?.bound) labels.add("Bound");
  if (system.mentalLeapState?.exhausted) labels.add("Exhausted");
  else if (system.mentalLeapState?.fatigued) labels.add("Fatigued");
  if (system.mentalLeapState?.unconscious) labels.add("Unconscious");
  if (system.shakenState?.label) labels.add(system.shakenState.label);
  for (const entry of system.attributeCollapse?.entries ?? []) labels.add(`${entry.label}: ${entry.text}`);
  return [...labels];
}

function itemOf(link, context) {
  const itemId = link.closest("[data-item-id]")?.dataset.itemId;
  return context.actor?.items?.get?.(itemId) ?? context.actor?.items?.contents?.find(entry => entry.id === itemId);
}
const equippedItem = (link, context) => itemOf(link, context)?.system?.equipped === true;

function sheetActionLabel(link, context, localize) {
  const item = itemOf(link, context);
  const itemName = item?.name ?? "item";
  const types = {
    weapon: "weapons",
    armor: "armor",
    gear: "gear",
    vehicle: "vehicles",
    feat: "feats",
    class: "classes",
    origin: "origins"
  };
  const rows = { contacts: "contact", subplots: "subplot", skillFortes: "skill forte" };
  const label = {
    browse: `Browse ${types[link.dataset.type] ?? "options"}`,
    createItem: `Add ${link.dataset.type ?? "item"}`,
    itemEquip: `${item?.system?.equipped ? "Unequip" : "Equip"} ${itemName}`,
    itemDelete: `Remove ${itemName}`,
    itemChat: `Share ${itemName} in chat`,
    syncGrants: loc`Refresh granted feats`,
    addRow: `Add ${rows[link.dataset.list] ?? "entry"}`,
    removeRow: `Remove ${rows[link.dataset.list] ?? "entry"}`
  }[link.dataset.action];
  const tooltip = link.dataset.tooltip ? localize(link.dataset.tooltip) : "";
  return (
    label ??
    (tooltip && tooltip !== link.dataset.tooltip ? tooltip : link.dataset.action.replace(/([a-z])([A-Z])/g, "$1 $2"))
  );
}

/**
 * Turn any `<a data-action>` left in the sheet into a native button, so it takes Tab, Enter and Space. The agent
 * templates author buttons themselves; this is the fallback for markup that still uses links. Foundry's own tab
 * links are left alone.
 */
export function upgradeActionLinks(element, context, localize = text => text) {
  for (const link of element.querySelectorAll('a[data-action]:not([data-action="tab"])')) {
    const button = element.ownerDocument.createElement("button");
    for (const attr of link.attributes) button.setAttribute(attr.name, attr.value);
    button.type = "button";
    button.classList.add("sc2-action");
    if (!link.textContent.trim()) {
      const label = link.getAttribute("aria-label") ?? sheetActionLabel(link, context, localize);
      button.setAttribute("aria-label", label);
      // Foundry's tooltip only: a title as well would show a second, native tooltip.
      button.dataset.tooltip = label;
      // Toolbar labels are visible; compact origin controls retain their explicit labels.
      if (link.closest(".controls")) {
        const text = element.ownerDocument.createElement("span");
        text.textContent =
          {
            itemChat: loc`Share`,
            itemDelete: loc`Remove`,
            // Says what a press will do, like the sheet's own Equip button.
            itemEquip: equippedItem(link, context) ? loc`Unequip` : loc`Equip`,
            syncGrants: loc`Refresh grants`,
            removeRow: loc`Remove`
          }[link.dataset.action] ?? label;
        button.append(text);
      }
    }
    button.prepend(...link.childNodes);
    link.replaceWith(button);
  }
}

/** Apply view behavior after each complete or partial sheet render. */
export function enhanceAgentSheet(element, context, state, localize = text => text) {
  element.classList.toggle("play-mode", !context.editMode);
  element.classList.toggle("edit-mode", !!context.editMode);
  state._open ??= {};
  for (const details of element.querySelectorAll("details[data-key]")) {
    if (Object.hasOwn(state._open, details.dataset.key)) details.open = state._open[details.dataset.key];
    if (!details.dataset.sc2Remembered) {
      details.dataset.sc2Remembered = "true";
      details.addEventListener("toggle", () => {
        state._open[details.dataset.key] = details.open;
      });
    }
  }
  upgradeActionLinks(element, context, localize);
  for (const control of element.querySelectorAll(
    ".edit-only:is(input, select, textarea), .edit-only input, .edit-only select, .edit-only textarea"
  )) {
    if (!context.editMode && !control.disabled) {
      control.disabled = true;
      control.dataset.modeDisabled = "true";
    } else if (context.editMode && control.dataset.modeDisabled) {
      control.disabled = false;
      delete control.dataset.modeDisabled;
    }
  }
  pinCombatTools(element, context, state);
  filterCombatTools(element, state);
  const search = element.querySelector(".skill-search");
  const trained = element.querySelector(".trained-filter");
  // A partial render can leave these elements in place; bind them once so listeners don't pile up.
  if (search && trained && !search.dataset.sc2Filter) {
    search.dataset.sc2Filter = "true";
    search.value = state._skillSearch;
    trained.checked = state._trainedOnly;
    const filter = () => {
      state._skillSearch = search.value;
      state._trainedOnly = trained.checked;
      const query = search.value.trim().toLocaleLowerCase();
      const rows = [...element.querySelectorAll(".skills-table tbody tr")];
      for (const row of rows)
        row.hidden =
          !row.dataset.skillName.toLocaleLowerCase().includes(query) ||
          (trained.checked && row.dataset.trained !== "true");
      element.querySelector(".skill-count").textContent =
        loc`${rows.filter(row => !row.hidden).length} of ${rows.length} skills`;
    };
    search.addEventListener("input", filter);
    trained.addEventListener("change", filter);
    filter();
  }
}

/** Narrow the combat toolbox to the tools whose text matches the search, opening the groups that hold them. */
export function filterCombatTools(element, state = {}) {
  const box = element.querySelector(".combat-toolbox");
  const search = box?.querySelector(".combat-tool-search");
  // Rendering only another part keeps this element, and its listener, in place.
  if (!search || search.dataset.sc2Filter) return;
  search.dataset.sc2Filter = "true";
  search.value = state._toolSearch ?? "";
  const allDetails = [...box.querySelectorAll(".combat-tool-groups details")];
  // Open states from before a search began, restored when the search is cleared.
  let remembered = null;
  const apply = () => {
    state._toolSearch = search.value;
    const query = search.value.trim().toLocaleLowerCase();
    if (query && !remembered) remembered = new Map(allDetails.map(details => [details, details.open]));
    const entries = box.querySelectorAll(".tool-actions > *, .combat-tool-group p:not(.tool-hint, .hint)");
    for (const entry of entries) entry.hidden = !!query && !entry.textContent.toLocaleLowerCase().includes(query);
    let matches = 0;
    for (const details of allDetails) {
      const visible = [...details.querySelectorAll(".tool-actions > *, p:not(.tool-hint, .hint)")].some(
        entry => !entry.hidden
      );
      if (details.classList.contains("combat-tool-group") && visible) matches++;
      details.hidden = !!query && !visible;
      if (query) details.open = visible;
      else if (remembered) details.open = remembered.get(details);
    }
    if (!query) remembered = null;
    box.querySelector(".combat-tool-empty").hidden = !query || matches > 0;
  };
  search.addEventListener("input", apply);
  if (search.value) apply();
}

/** Mark each combat tool with its time where the rules give one, and copy pinned tools to the top of Play. */
export function pinCombatTools(element, context = {}, state = {}) {
  const box = element.querySelector(".combat-toolbox");
  const costs = context.actionCosts ?? {};
  for (const control of element.querySelectorAll("button[data-action]")) {
    const cost = costs[control.dataset.action];
    if (cost) control.dataset.sc2Cost = cost;
  }
  const slot = element.querySelector(".pinned-tools");
  if (!box || !slot) return;
  const pinned = new Set(context.pinnedTools ?? []);
  const shown = new Set();
  slot.replaceChildren();
  for (const control of box.querySelectorAll("button[data-action]:not(.gc-review, .pin-mode)")) {
    const tool = [control.dataset.action, control.dataset.condition, control.dataset.resource]
      .filter(Boolean)
      .join(":");
    control.dataset.tool = tool;
    control.classList.toggle("pinned", pinned.has(tool));
    control.setAttribute("aria-pressed", pinned.has(tool) && context.pinMode ? "true" : "false");
    if (!context.pinMode) control.removeAttribute("aria-pressed");
    if (!pinned.has(tool) || shown.has(tool)) continue;
    shown.add(tool);
    slot.append(control.cloneNode(true));
  }
  slot.hidden = !shown.size;
  box.classList.toggle("pinning", !!context.pinMode);
  if (box.dataset.sc2Pinning) return;
  box.dataset.sc2Pinning = "true";
  // In pin mode a tool is chosen for pinning, so the choice must not also run it.
  box.addEventListener(
    "click",
    event => {
      if (!box.classList.contains("pinning")) return;
      const control = event.target.closest?.("button[data-tool]");
      if (!control) return;
      event.preventDefault();
      event.stopPropagation();
      state.togglePin?.(control.dataset.tool);
    },
    true
  );
}
