import { loc } from "../i18n.mjs";
import { BUTTON_ICONS } from "./ui-button-catalog.mjs";

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
  initializeStartingDice: loc`Starting dice`,
  startMission: loc`Start mission`,
  endMission: loc`End mission`,
  clearMission: loc`Clear mission`,
  healActionDice: loc`Heal with AD (outside combat)`,
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
  sessionDice: loc`Starting AD`,
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
  spendActionDie: loc`Spend AD`,
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
    if (column) return column;
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

/** Compact wording shared by native hover text and Foundry tooltips. */
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

function enhanceButtonIcon(control, label) {
  if (
    !label ||
    !control.matches('button, a[data-action], a[data-roll-control], [role="button"]') ||
    // Stat blocks and tab navigation carry information beyond their action name.
    control.matches('.stat, [role="tab"], [data-action="tab"], .header-control')
  )
    return;
  const iconSpec = buttonIconKind(control.dataset.action ?? control.dataset.rollControl ?? "", label, control.dataset);
  if (!iconSpec) return;
  const { sheet, index, grid } = iconSpec;
  control.dataset.sc2Icon = `${sheet}:${index}`;
  control.style.setProperty(
    "--sc2-icon-image",
    `url("systems/spycraft2/assets/ui/functions/${sheet === "time" ? "time" : `functions-${sheet}`}.png")`
  );
  control.style.setProperty("--sc2-icon-grid", `${grid * 100}%`);
  control.style.setProperty("--sc2-icon-x", `${((index % grid) * 100) / (grid - 1)}%`);
  control.style.setProperty("--sc2-icon-y", `${(Math.floor(index / grid) * 100) / (grid - 1)}%`);
  if (!control.classList.contains("sc2-icon-button")) {
    const content = control.ownerDocument.createElement("span");
    content.className = "sc2-button-content";
    content.setAttribute("aria-hidden", "true");
    content.append(...control.childNodes);
    const icon = control.ownerDocument.createElement("span");
    icon.className = "sc2-button-icon";
    icon.setAttribute("aria-hidden", "true");
    control.append(content, icon);
    control.classList.add("sc2-icon-button");
  }
}

export function enhanceTooltips(root) {
  if (!root?.querySelectorAll) return;
  const controls = [...(root.matches?.(CONTROL) ? [root] : []), ...root.querySelectorAll(CONTROL)];
  for (const control of controls) {
    // Capture the action name while text is still present, before replacing it with an icon.
    // Name controls even when they already have authored tooltips.
    const label = labelFor(control);
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
    if (
      control.matches('button, a[data-action], a[data-roll-control], [role="button"]') &&
      !control.hasAttribute("data-tooltip-html")
    ) {
      const text = tooltipText({ action: control.dataset.action ?? control.dataset.rollControl ?? "", label });
      if (text) {
        control.setAttribute("data-tooltip", text);
        control.setAttribute("title", text);
        control.setAttribute("aria-description", text);
      }
    }
    if (!control.hasAttribute("data-tooltip-html")) {
      for (const attr of ["title", "data-tooltip", "aria-description"]) {
        if (control.hasAttribute(attr)) control.setAttribute(attr, compactTooltip(control.getAttribute(attr)));
      }
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
    // Retain a native hover fallback; aria-description exposes the same help to assistive technology.
    control.setAttribute("title", text);
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
  Hooks.on("renderApplicationV2", render);
  Hooks.on("renderDialogV2", render);
  Hooks.on("renderChatMessageHTML", (message, html) => {
    if (!message.flags?.spycraft2) return;
    html.setAttribute("data-sc2-tooltip-scope", "");
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
