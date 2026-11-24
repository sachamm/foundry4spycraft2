import { loc } from "../i18n.mjs";
import { BUTTON_ICONS } from "./ui-button-catalog.mjs";
import { verbIcon } from "./ui-verb-icons.mjs";

const fields = () => ({
  attackAction: loc`Attack action`,
  distanceFeet: loc`Range (ft)`,
  modifier: loc`Modifier`,
  bonus: loc`Bonus / penalty`,
  dc: loc`DC`,
  targetActorUuid: loc`Target`,
  targetUuid: loc`Target`,
  weaponId: loc`Weapon`,
  aimed: loc`Aim already taken`,
  braced: loc`Brace already taken`,
  stableSurface: loc`Bracing surface`,
  fireMode: loc`Fire mode`,
  rollMode: loc`Roll visibility`,
  checkMethod: loc`Check method`,
  search: loc`Search`,
  qualifiedOnly: loc`Qualified only`,
  name: loc`Name`,
  "system.codename": loc`Codename`,
  "system.biography": loc`Biography`,
  "system.description": loc`Description`,
  "system.quantity": loc`Qty`,
  "system.equipped": loc`Equipped`,
  "system.carried": loc`Carried`,
  "system.reserve": loc`Reserve gear`,
  "system.damage": loc`Damage`,
  "system.shotsLoaded": loc`Loaded ammo`,
  "system.shotsSpare": loc`Spare ammo`,
  "system.vitality.value": loc`Current VP`,
  "system.wounds.value": loc`Current WP`,
  "system.actionDice.value": loc`Action dice`,
  "system.caliber": loc`Caliber`,
  "system.pickCount": loc`Gear picks`,
  "system.weight": loc`Weight`,
  "system.source": loc`Source`,
  "system.qualities": loc`Qualities`,
  "system.error": loc`Error range`,
  "system.threat": loc`Threat range`,
  "system.damageReduction": loc`DR`,
  "flags.spycraft2.nonLethal.stress": loc`Stress`,
  "flags.spycraft2.nonLethal.subdual": loc`Subdual`
});

const actions = () => ({
  editImage: loc`Change image`,
  rollAttack: loc`Attack`,
  rollDamage: loc`Damage`,
  itemDelete: loc`Remove item`,
  toggleEditMode: loc`Edit character`,
  syncGrants: loc`Refresh grants`,
  startMission: loc`Start mission`,
  endMission: loc`End mission`,
  clearMission: loc`Clear mission`,
  healActionDice: loc`Heal with action dice (outside combat)`,
  settlePendingDamageSave: loc`Settle damage save`,
  reviewActorRules: loc`Review rules`,
  finishControl: loc`Resolve`,
  confirmControl: loc`Confirm`,
  boostControl: loc`Boost`,
  rerollControl: loc`Reroll`,
  clockAdvance: loc`Adjust time`,
  advance: loc`Adjust time`,
  clockDate: loc`Set date`,
  setDate: loc`Set date`,
  clockOpen: loc`Clock`,
  quickTimer: loc`Start timer`,
  extendTimer: loc`Extend timer`,
  deleteTimer: loc`Delete timer`,
  sessionDice: loc`Starting action dice`,
  caliberIncrease: loc`+1 Caliber`,
  awardStanding: loc`Award Rep / NW`,
  recordInfraction: loc`Record exposure`,
  gcDice: loc`GC dice`,
  dramaticOn: loc`Dramatic scene`,
  dramaticOff: loc`Standard scene`,
  doubleInitiative: loc`NPC init. ×2`,
  combatReference: loc`Combat ref.`,
  surprise: loc`Surprise rd`,
  fluidEvent: loc`Fluid init.`,
  sceneAdvance: loc`+1 scene`,
  npcEnable: loc`NPC mode`,
  npcPackages: loc`NPC packages`,
  npcPackageBands: loc`Package bands`,
  initializeResources: loc`Starting resources`,
  restoreRules: loc`Restore rules`,
  reviewRules: loc`Review rules`,
  setupTask: loc`Continue setup`,
  spendActionDie: loc`Spend action die`,
  itemEdit: loc`Edit item`,
  itemChat: loc`Share item`,
  manageAnalysisTasks: loc`Analysis tasks`,
  securityDevice: loc`Security device`,
  hazards: loc`Hazards`,
  possessions: loc`Random gear`,
  seasonQualities: loc`Campaign qualities`,
  rollInitiative: loc`Roll init.`
});

const CONTROL =
  '[title], [data-tooltip], button, a[href], a[data-action], a[data-tab], a[data-roll-control], input:not([type="hidden"]), select, textarea, prose-mirror, summary, [role="button"], [role="tab"], [data-edit]';
/** Marks hover help this pass wrote, as opposed to help a template or a rule breakdown supplied. */
const GENERATED = "data-sc2-tip-generated";
const SCOPE = ".spycraft2, .spycraft2-roll-options, [data-sc2-tooltip-scope]";
const clean = text =>
  String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 350);

function textWithoutControls(element) {
  if (!element) return "";
  const copy = element.cloneNode(true);
  copy.querySelectorAll("input, select, textarea, button, prose-mirror, .hint, .notes").forEach(node => node.remove());
  return clean(copy.textContent);
}

function labelFor(control) {
  const explicit = control.getAttribute("aria-label");
  if (explicit) return clean(explicit);
  const labels = Array.from(control.labels ?? [])
    .map(textWithoutControls)
    .filter(Boolean);
  if (labels.length) return labels.join("; ");
  const label = textWithoutControls(control.closest("label"));
  if (label) return label;
  const group = control.closest(".form-group, .form-field, .field");
  const groupLabel = textWithoutControls(group?.querySelector("label"));
  if (groupLabel) return groupLabel;
  if (control.matches("button, a, summary, [role=button], [role=tab]") && clean(control.textContent))
    return clean(control.textContent);
  const cell = control.closest("td");
  if (cell) {
    const heading = cell.closest("table")?.querySelector("thead tr")?.children[cell.cellIndex];
    const column = textWithoutControls(heading);
    // Row headings often contain a roll button; its text still identifies the field's skill or ability.
    const row = clean(cell.parentElement?.querySelector("th, td:first-child")?.textContent);
    if (column) return row ? `${row}: ${column}` : column;
  }
  if (control.matches('input[type="button"], input[type="submit"], input[type="reset"]') && clean(control.value))
    return clean(control.value);
  const placeholder = clean(control.getAttribute("placeholder"));
  if (placeholder) return placeholder;
  // Older compact forms sometimes omit a label; use the field's readable last segment.
  const name =
    control.getAttribute("name") ??
    control.dataset.action ??
    control.dataset.tab ??
    control.dataset.edit ??
    control.id ??
    "";
  const last =
    name
      .split(".")
      .filter(part => part && !/^\d+$/.test(part))
      .at(-1) ?? "";
  return clean(last.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " "));
}

/** Compact wording for Foundry tooltips and accessible field guidance. */
export function compactTooltip(text = "") {
  // Foundry localizes these keys; never abbreviate a key itself.
  if (/^[A-Z][\w-]*(?:\.[\w-]+)+$/.test(text)) return text;
  return clean(text)
    .replace(/^(?:Use|Enter|Choose an option for|Select this option:)\s+/i, "")
    .replace(/^Expand or collapse\s+/i, "")
    .replace(/^Show the (.+) section\.?$/i, "$1")
    .replace(/\s*Follow any prompts to review the details before confirming\.?/gi, "")
    .replace(/\brounds?\b/gi, "rd")
    .replace(/\bminutes?\b/gi, "min")
    .replace(/\bhours?\b/gi, "hr")
    .replace(/\bseconds?\b/gi, "sec")
    .replace(/\binitiative\b/gi, "init.")
    .replace(/\breputation\b/gi, "Rep")
    .replace(/\bnet worth\b/gi, "NW")
    .replace(/\baction dice\b/gi, "AD")
    .replace(/\.{1,3}$/, "")
    .trim();
}

export function tooltipText({ name = "", action = "", label = "", type = "", min, max }) {
  const readable = action.replace(/Controls?$/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
  let text = compactTooltip(fields()[name] ?? actions()[action] ?? label ?? readable);
  if (!text) text = compactTooltip(readable);
  if (
    type === "number" &&
    min !== undefined &&
    min !== null &&
    min !== "" &&
    max !== undefined &&
    max !== null &&
    max !== ""
  )
    text += ` (${min}–${max})`;
  return text;
}

export function buttonIconKind(action = "", label = "", data = {}) {
  if (["clockStep", "step"].includes(action)) {
    const seconds = Number(data.seconds);
    const pair = [6, 60, 600, 3600, 28800, 86400].indexOf(Math.abs(seconds));
    if (pair >= 0) return { sheet: "time", index: pair * 2 + (seconds < 0 ? 1 : 0), grid: 4 };
  }
  const clocks = { clockAdvance: 12, advance: 12, clockDate: 13, setDate: 13, clockOpen: 14, quickTimer: 15 };
  if (Object.hasOwn(clocks, action)) return { sheet: "time", index: clocks[action], grid: 4 };
  const variant =
    action === "entry"
      ? data.change
      : action === "missionReport"
        ? data.planned
        : action === "groupInitiative"
          ? data.single
          : undefined;
  const key = variant !== undefined && BUTTON_ICONS[`${action}:${variant}`] ? `${action}:${variant}` : action;
  const match = BUTTON_ICONS[key] ?? BUTTON_ICONS[label.toLowerCase()];
  if (!match) return null;
  return { sheet: match[0], index: match[1], grid: 8 };
}

/** How a control presents its action: "icon" (pictogram only), "both" (pictogram and label) or "text". */
const DISPLAYS = ["icon", "both", "text"];
// These actions are labelled with a name or a number from the sheet, which must stay readable.
const DATA_ACTIONS = new Set([
  "rollSkill",
  "rollAbility",
  "rollSave",
  "rollKnowledge",
  "rollAttack",
  "rollDamage",
  "itemEdit",
  "openCompanion",
  "skillLevel",
  "setupTask"
]);

export function buttonDisplay(control) {
  const own = control.dataset?.sc2Display;
  if (DISPLAYS.includes(own)) return own;
  if (DATA_ACTIONS.has(control.dataset?.action)) return "text";
  const inherited = control.closest?.("[data-sc2-display]")?.dataset.sc2Display;
  return DISPLAYS.includes(inherited) ? inherited : "both";
}

function enhanceButtonIcon(control, label) {
  if (
    !label ||
    !control.matches('button, a[data-action], a[data-roll-control], [role="button"]') ||
    // Stat blocks and tab navigation carry information beyond their action name.
    control.matches('.stat, [role="tab"], [data-action="tab"], .header-control')
  )
    return;
  // Names and numbers are data; only action words are replaced or joined by a pictogram.
  const mode = buttonDisplay(control);
  if (mode === "text") return;
  const action = control.dataset.action ?? control.dataset.rollControl ?? "";
  // Common verbs use a single-colour glyph. Painted artwork is an illustration a region opts into.
  const glyph = verbIcon(action, control.dataset);
  const wantsArt = !!control.closest("[data-sc2-art]");
  const art = wantsArt || (!glyph && mode === "icon") ? buttonIconKind(action, label, control.dataset) : null;
  if (!glyph && !art) return;
  if (art) {
    const { sheet, index, grid } = art;
    control.dataset.sc2Icon = `${sheet}:${index}`;
    // The stylesheet maps each atlas to its image, so the address resolves beside the stylesheet.
    control.dataset.sc2Sheet = String(sheet);
    control.style.setProperty("--sc2-icon-grid", `${grid * 100}%`);
    control.style.setProperty("--sc2-icon-x", `${((index % grid) * 100) / (grid - 1)}%`);
    control.style.setProperty("--sc2-icon-y", `${(Math.floor(index / grid) * 100) / (grid - 1)}%`);
  } else {
    control.dataset.sc2Icon = glyph;
    control.dataset.sc2Sheet = "glyph";
  }
  control.dataset.sc2Mode = mode;
  if (!control.classList.contains("sc2-icon-button")) {
    const content = control.ownerDocument.createElement("span");
    content.className = "sc2-button-content";
    // The control's accessible name comes from aria-label in every mode.
    content.setAttribute("aria-hidden", "true");
    content.append(...control.childNodes);
    const icon = control.ownerDocument.createElement("span");
    icon.className = "sc2-button-icon";
    icon.setAttribute("aria-hidden", "true");
    control.append(icon, content);
    control.classList.add("sc2-icon-button");
  }
  const icon = control.querySelector(":scope > .sc2-button-icon");
  if (icon) icon.className = art ? "sc2-button-icon" : `sc2-button-icon fa-solid ${glyph}`;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The controls Tab can reach inside an element, in order: enabled and actually shown. */
export function focusableIn(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter(
    element => !element.closest("[hidden], [inert]") && (element.getClientRects?.().length ?? 1) > 0
  );
}

/** Keep Tab inside a dialog: past the last control it wraps to the first, and Shift+Tab the other way. */
export function trapFocus(dialog, event) {
  const controls = focusableIn(dialog);
  if (!controls.length) return;
  const first = controls[0],
    last = controls.at(-1),
    active = dialog.ownerDocument?.activeElement;
  const inside = controls.includes(active);
  if (event.shiftKey && (active === first || !inside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !inside)) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Keyboard support for action links and image pickers, keeping Foundry's delegated handlers. The system's own
 * templates and dialogs author buttons (tools/test-templates.mjs, tools/test-dialog-markup.mjs), so this is a safety
 * net for markup from elsewhere.
 */
export function enhanceActionAccessibility(root) {
  if (!root?.querySelectorAll) return;
  const scope = root.closest?.(".application, [data-sc2-tooltip-scope]") ?? root.closest?.(SCOPE) ?? root;
  const syncTabs = () => {
    for (const nav of scope.querySelectorAll("nav.sheet-tabs")) {
      const tabs = [...nav.querySelectorAll('[data-action="tab"]')];
      if (!tabs.length) continue;
      nav.setAttribute("role", "tablist");
      nav.setAttribute("aria-label", loc`Sheet sections`);
      const selected = tabs.find(tab => tab.classList.contains("active")) ?? tabs[0];
      for (const [index, tab] of tabs.entries()) {
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-selected", String(tab === selected));
        tab.tabIndex = tab === selected ? 0 : -1;
        tab.id ||= `${scope.id || "sc2"}-${tab.dataset.group || "primary"}-tab-${index}`;
        const panel = [...scope.querySelectorAll(".tab[data-tab]")].find(
          entry => entry.dataset.tab === tab.dataset.tab && entry.dataset.group === tab.dataset.group
        );
        if (panel) {
          panel.id ||= `${tab.id}-panel`;
          tab.setAttribute("aria-controls", panel.id);
          panel.setAttribute("role", "tabpanel");
          panel.setAttribute("aria-labelledby", tab.id);
          panel.setAttribute("aria-hidden", String(tab !== selected));
        }
      }
    }
  };
  syncTabs();
  const selector = "a[data-action]:not([href]), a[data-roll-control]:not([href]), img[data-edit]";
  for (const control of [...(root.matches?.(selector) ? [root] : []), ...root.querySelectorAll(selector)]) {
    if (control.dataset.action === "tab") continue;
    control.setAttribute("role", "button");
    control.tabIndex = 0;
    if (control.matches("img[data-edit]") && !control.hasAttribute("aria-label"))
      control.setAttribute("aria-label", loc`Change image`);
  }
  if (scope.dataset.sc2Keyboard) return;
  scope.dataset.sc2Keyboard = "true";
  scope.addEventListener("click", () => queueMicrotask(syncTabs));
  scope.addEventListener("keydown", event => {
    if (event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey) {
      // Foundry binds Tab to cycling views whenever focus is not in a text field, so a focused sheet tab, link or
      // card button would swallow it. Inside the system's own windows Tab moves focus, as in any page.
      event.stopPropagation();
      if (scope.matches?.("dialog, .dialog")) trapFocus(scope, event);
      return;
    }
    const control = event.target.closest?.('[role="tab"], a[role="button"], img[role="button"]');
    if (!control || !scope.contains(control) || event.altKey || event.ctrlKey || event.metaKey) return;
    if (control.getAttribute("aria-disabled") === "true" || control.disabled) return;
    if (control.getAttribute("role") === "tab") {
      const tabs = [...control.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
      const index = tabs.indexOf(control);
      const next = {
        ArrowRight: (index + 1) % tabs.length,
        ArrowLeft: (index + tabs.length - 1) % tabs.length,
        Home: 0,
        End: tabs.length - 1
      }[event.key];
      if (next !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        tabs[next].click();
        tabs[next].focus();
        syncTabs();
        return;
      }
    }
    if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) control.click();
    }
  });
}

export function enhanceTooltips(root) {
  if (!root?.querySelectorAll) return;
  enhanceActionAccessibility(root);
  const controls = [...(root.matches?.(CONTROL) ? [root] : []), ...root.querySelectorAll(CONTROL)];
  for (const control of controls) {
    // Capture the action name while text is still present, before replacing it with an icon.
    // Name controls even when they already have authored tooltips.
    const label = labelFor(control);
    // Tooltips do not name form controls. Preserve real labels; supply a name only where one is missing.
    if (
      control.matches('input:not([type="hidden"]), select, textarea, prose-mirror') &&
      !control.hasAttribute("aria-label") &&
      !control.hasAttribute("aria-labelledby") &&
      ![...(control.labels ?? [])].some(label => textWithoutControls(label)) &&
      label
    )
      control.setAttribute("aria-label", label);
    if (
      control.matches(
        'button, a[data-action], a[data-roll-control], [role="button"], input[type="button"], input[type="submit"], input[type="reset"]'
      ) &&
      !clean(control.getAttribute("aria-label")) &&
      !control.hasAttribute("aria-labelledby") &&
      label
    )
      control.setAttribute("aria-label", label);
    enhanceButtonIcon(control, label);
    // Help written in a template is the source of truth. The catalogue fills in only where none was written, and
    // only text this pass produced is shortened or replaced on a later pass.
    const authored =
      (control.hasAttribute("data-tooltip") || control.hasAttribute("title")) && !control.hasAttribute(GENERATED);
    if (
      !authored &&
      control.matches('button, a[data-action], a[data-roll-control], [role="button"]') &&
      !control.hasAttribute("data-tooltip-html")
    ) {
      const text = tooltipText({ action: control.dataset.action ?? control.dataset.rollControl ?? "", label });
      if (text) {
        control.setAttribute("data-tooltip", text);
        control.setAttribute(GENERATED, "");
        control.removeAttribute("title");
        // The button's accessible name already identifies its action.
        control.removeAttribute("aria-description");
      }
    }
    if (!authored && !control.hasAttribute("data-tooltip-html")) {
      for (const attr of ["title", "data-tooltip", "aria-description"]) {
        if (control.hasAttribute(attr)) control.setAttribute(attr, compactTooltip(control.getAttribute(attr)));
      }
    }
    // Foundry owns hover help; a native title would show a second tooltip.
    if (control.hasAttribute("title")) {
      if (!control.hasAttribute("data-tooltip") && !control.hasAttribute("data-tooltip-html"))
        control.setAttribute("data-tooltip", control.getAttribute("title"));
      control.removeAttribute("title");
    }
    // Preserve authored help and calculated rule breakdowns.
    if (
      control.hasAttribute("title") ||
      control.hasAttribute("data-tooltip") ||
      control.hasAttribute("data-tooltip-html")
    )
      continue;
    const group = control.closest(".form-group, .form-field, .field");
    const hint = clean(group?.querySelector(".hint, .notes, .form-hint")?.textContent);
    const text = tooltipText({
      name: control.getAttribute("name") ?? "",
      action:
        control.dataset.action ??
        control.dataset.rollControl ??
        (control.hasAttribute("data-tab") || control.matches('[role="tab"]')
          ? "tab"
          : control.hasAttribute("data-edit")
            ? "editImage"
            : control.matches("a[href]")
              ? "openLink"
              : ""),
      label,
      tag: control.tagName,
      type: control.getAttribute("type") ?? "",
      hint,
      min: control.getAttribute("min"),
      max: control.getAttribute("max"),
      step: control.getAttribute("step")
    });
    if (!text) continue;
    control.setAttribute("data-tooltip", text);
    control.setAttribute(GENERATED, "");
    // Field guidance remains available to assistive technology without a native hover popup.
    if (!control.hasAttribute("aria-description")) control.setAttribute("aria-description", text);
  }
}

export function installUITooltipHooks() {
  const render = app => {
    const element = app.element;
    if (element?.matches?.(SCOPE) || element?.querySelector?.(SCOPE)) {
      if (element.matches(SCOPE)) enhanceTooltips(element);
      else element.querySelectorAll(SCOPE).forEach(enhanceTooltips);
    }
  };
  // Foundry calls the render hook once for each class in an application's chain, so this one also covers dialogs.
  Hooks.on("renderApplicationV2", render);
  Hooks.on("renderChatMessageHTML", (message, html) => {
    if (!message.flags?.spycraft2) return;
    html.setAttribute("data-sc2-tooltip-scope", "");
    html.classList.add("sc2-card");
    enhanceTooltips(html);
  });
  // Capture newly inserted controls before Foundry's delegated tooltip listener handles hover/focus.
  const prepare = event => {
    const control = event.target?.closest?.(CONTROL);
    if (control?.closest(SCOPE)) enhanceTooltips(control);
  };
  document.addEventListener("pointerover", prepare, true);
  document.addEventListener("focusin", prepare, true);
}
