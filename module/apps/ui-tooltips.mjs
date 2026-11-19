import { loc } from "../i18n.mjs";

// Original UI guidance, evaluated in the current language when a control is rendered.
const fields = () => ({
  attackAction: loc`Choose the action being performed. Standard Attack is the usual attack; choose another action when its rules apply.`,
  distanceFeet: loc`Enter the distance to the target in feet. Ranged attacks use this to determine range penalties and eligibility.`,
  modifier: loc`Enter an additional modifier for this check. Use a negative number for a penalty.`,
  bonus: loc`Enter an additional bonus or penalty. Do not include a benefit already counted in the displayed total.`,
  dc: loc`Enter the difficulty to beat, as determined by the task or the GC.`,
  targetActorUuid: loc`Choose the actual target so the result can be linked to the correct character.`,
  targetUuid: loc`Choose the actual target for this action. Review the target before confirming.`,
  weaponId: loc`Choose the weapon used for this attack. Its statistics and current state determine available options.`,
  aimed: loc`Confirm that Aim was already taken and remains valid for this target. Checking this does not take the Aim action.`,
  braced: loc`Confirm that Brace was already taken and remains valid. Checking this does not take the Brace action.`,
  stableSurface: loc`Declare whether a suitable bracing surface is available for this attack.`,
  fireMode: loc`Choose a firing mode supported by this weapon. The mode affects the attack and ammunition use.`,
  rollMode: loc`Choose who can see this roll in chat.`,
  checkMethod: loc`Choose how to resolve the check, using the available roll or fixed-result options.`,
  search: loc`Type part of a name or phrase to narrow the displayed results.`,
  qualifiedOnly: loc`Show only entries whose checked prerequisites are met. Review any prerequisites the system cannot check.`,
  name: loc`Enter the name displayed for this entry.`,
  "system.codename": loc`Enter the agent's operational name, as it should appear on the character sheet.`,
  "system.biography": loc`Record the character's background and personal notes.`,
  "system.description": loc`Describe this entry and record any notes needed at the table.`,
  "system.quantity": loc`Enter how many units of this item the character has.`,
  "system.equipped": loc`Mark this item as equipped for use. This can affect the character's calculated statistics.`,
  "system.carried": loc`Mark whether the character is carrying this item for load calculations.`,
  "system.reserve": loc`Mark this item as reserve gear rather than current mission gear.`,
  "system.damage": loc`Enter the weapon's damage expression, including its damage type where applicable.`,
  "system.shotsLoaded": loc`Enter the shots currently loaded in the weapon. Attacks spend these shots when ammunition tracking is enabled.`,
  "system.shotsSpare": loc`Enter the weapon's spare ammunition. Reloading draws from this reserve.`,
  "system.vitality.value": loc`Enter current vitality, after damage or recovery. This is not the maximum vitality.`,
  "system.wounds.value": loc`Enter current wounds, after damage or recovery. Review any resulting conditions.`,
  "system.actionDice.value": loc`Enter the character's current action dice pool. Spending a die uses this resource.`,
  "system.caliber": loc`Choose the item's Caliber for gear selection and mission availability.`,
  "system.pickCount": loc`Enter the number of gear picks allocated to this entry.`,
  "system.weight": loc`Enter the item's weight in the units used by the equipment list.`,
  "system.source": loc`Record the reference used to check this entry at the table.`,
  "system.qualities": loc`Record the weapon's quality labels. Recognized qualities can affect its calculations.`,
  "system.error": loc`Enter the weapon's error range value. This is not an attack penalty.`,
  "system.threat": loc`Enter the lowest natural roll in the weapon's threat range.`,
  "system.damageReduction": loc`Enter damage reduction for this entry. Damage type and other rules can affect how it applies.`,
  "flags.spycraft2.nonLethal.stress": loc`Record accumulated stress damage, separate from vitality and wounds.`,
  "flags.spycraft2.nonLethal.subdual": loc`Record accumulated subdual damage, separate from vitality and wounds.`
});

const actions = () => ({
  rollAttack: loc`Open the attack circumstances for this weapon, then roll the attack with the selected options.`,
  rollDamage: loc`Roll this weapon's damage. Use the recorded attack result when resolving a hit.`,
  rollSave: loc`Open the saving throw options and roll the selected save.`,
  rollSkill: loc`Open the check options for this skill and roll using the character's current bonuses.`,
  rollAbility: loc`Roll a check using the selected attribute and the chosen circumstances.`,
  rollInitiative: loc`Roll this character's initiative for combat.`,
  itemEdit: loc`Open this item's sheet to review or change its details.`,
  itemDelete: loc`Remove this item from the character. Check that you have selected the intended entry.`,
  itemEquip: loc`Switch this item between equipped and unequipped. Recheck any statistics affected by the change.`,
  itemChat: loc`Share this item's details in chat using its chat card.`,
  toChat: loc`Share this entry in chat for the table to review.`,
  createItem: loc`Create a new item entry on this character.`,
  addRow: loc`Add a new entry to this list.`,
  removeRow: loc`Remove this entry from the list.`,
  toggleEditMode: loc`Switch between the play view and the fields used to edit this character.`,
  editImage: loc`Choose a different image for this entry.`,
  browse: loc`Open the system browser to find character options and equipment.`,
  syncGrants: loc`Refresh granted feats from the character's recorded choices. Review the resulting entries.`,
  reload: loc`Reload the weapon using its spare ammunition. Review its loaded and reserve counts afterward.`,
  reloadWeapon: loc`Reload this weapon from its spare ammunition.`,
  spendActionDie: loc`Choose an available action die to spend and follow the prompts for its benefit.`,
  initializeStartingDice: loc`Set up the character's starting action dice using the current character data.`,
  startMission: loc`Begin a mission using the selected mission setup. Review the setup before confirming.`,
  endMission: loc`Finish the current mission and review its outstanding rewards and resources.`,
  clearMission: loc`Clear the recorded mission setup. Review the current mission before confirming.`,
  rest: loc`Open recovery options for rest and treatment. Review the elapsed time and applicable recovery rates.`,
  healActionDice: loc`Review action dice available for healing before spending them.`,
  settlePendingDamageSave: loc`Review the pending damage save and settle its recorded outcome.`,
  reviewActorRules: loc`Review this character's recorded rules and choices against the system's current data.`,
  search: loc`Search using the entered text and the selected filters.`,
  finishControl: loc`Mark this check's outcome as resolved after all required decisions and adjustments are complete.`,
  confirmControl: loc`Review and confirm this check's outcome, including any pending critical results.`,
  boostControl: loc`Review available action dice and choose whether to spend one to boost this check.`,
  rerollControl: loc`Review an eligible ability before rerolling this check.`,
  submit: loc`Use the entered values to continue. Review the target and any resource costs before confirming.`,
  cancel: loc`Close this dialog without submitting its current choices.`,
  close: loc`Close this window.`
});

const CONTROL =
  'button, a[href], a[data-action], a[data-tab], a[data-roll-control], input:not([type="hidden"]), select, textarea, prose-mirror, summary, [role="button"], [role="tab"], [data-edit]';
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

/** Plain text only: never insert field values, player-authored HTML, or new rule claims. */
export function tooltipText({ name = "", action = "", label = "", tag = "", type = "", hint = "", min, max, step }) {
  const specific = fields()[name] ?? actions()[action];
  let text = specific;
  if (!text && hint) text = hint;
  if (!text && label) {
    if (tag === "SELECT") text = loc`Choose an option for ${label}.`;
    else if (type === "checkbox") text = loc`Turn this on when the following applies: ${label}.`;
    else if (type === "radio") text = loc`Select this option: ${label}.`;
    else if (type === "range") text = loc`Adjust ${label}.`;
    else if (type === "file") text = loc`Choose a file for ${label}.`;
    else if (["submit", "reset", "button"].includes(type)) text = loc`Use ${label}.`;
    else if (["INPUT", "TEXTAREA", "PROSE-MIRROR"].includes(tag)) text = loc`Enter ${label}.`;
    else if (tag === "SUMMARY") text = loc`Expand or collapse ${label}.`;
    else if (action === "openLink") text = loc`Open ${label}.`;
    else if (action === "tab") text = loc`Show the ${label} section.`;
    else text = loc`Use ${label}. Follow any prompts to review the details before confirming.`;
  }
  if (!text) return "";
  if (hint && text !== hint) text += ` ${hint}`;
  if (type === "number") {
    if (min !== null && min !== undefined && min !== "") text += ` ${loc`Minimum: ${min}.`}`;
    if (max !== null && max !== undefined && max !== "") text += ` ${loc`Maximum: ${max}.`}`;
    if (step === "1") text += ` ${loc`Use whole numbers.`}`;
  }
  return text;
}

export function enhanceTooltips(root) {
  if (!root?.querySelectorAll) return;
  const controls = [...(root.matches?.(CONTROL) ? [root] : []), ...root.querySelectorAll(CONTROL)];
  for (const control of controls) {
    // Preserve existing authored help and calculated rule breakdowns.
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
      label: labelFor(control),
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
