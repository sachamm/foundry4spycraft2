import { loc } from "../i18n.mjs";
import { organizeOptions } from "./dialog-sections.mjs";
import { installResolutionGuide } from "./resolution-guide.mjs";
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// A section belongs to the selected named check. Unmatched sections remain
// available in Advanced options, preserving every existing field and default.
const CHECK_SECTIONS = {
  balanceCircumstances: ["balance"],
  tumbleCircumstances: ["tumble"],
  fallDeclared: ["falling"],
  tripAttackOpponentName: ["trip", "counter-trip"],
  tripOpponentName: ["resist-trip"],
  bullRushAttackOpponentName: ["bull-rush"],
  bullRushOpponentName: ["resist-bull-rush"],
  conveyanceBullRushName: ["conveyance-bull-rush"],
  feintOpponentName: ["feint", "resist-feint"],
  threatenOpponentName: ["threaten", "resist-threaten"],
  tauntOpponentUuid: ["taunt", "resist-taunt"],
  diversionOpponentUuid: ["diversion", "resist-diversion"],
  skillTrick: ["trip", "bull-rush", "feint", "grapple"],
  // The Grapple section holds every grapple control, so it is shown for both checks; the rules ignore the ones that
  // do not apply to the chosen check.
  grappleOpponentSize: ["grapple", "restraint-escape"],
  trackingSurface: ["tracking"],
  nest: ["hide"],
  hideMovement: ["hide"],
  ghostHideTargetKind: ["hide"],
  balanceSurface: ["balance"]
};

/** Called by DialogV2's render event; does not alter check resolution. */
export function enhanceSkillDialog(_event, dialog, checks = []) {
  const root = dialog.element.querySelector(".spycraft2-roll-options");
  if (!root || root.dataset.uxReady) return;
  root.dataset.uxReady = "true";
  const check = root.querySelector('[name="check"]');
  if (!check) return;
  const doc = root.ownerDocument;
  const advanced = doc.createElement("details");
  advanced.className = "sc2-advanced-options";
  const summary = doc.createElement("summary");
  summary.textContent = loc`Advanced options`;
  advanced.append(summary);
  const sections = [...root.children].filter(el => el.tagName === "DETAILS");
  root.insertBefore(advanced, sections[0] ?? null);
  // Choosing Roll / Take 10 / Take 20 is a common action, not an advanced modifier.
  const methodLabel = root.querySelector('[name="method"]')?.closest("label");
  if (methodLabel) root.insertBefore(methodLabel, advanced);
  const quick = doc.createElement("div");
  quick.className = "sc2-skill-quick";
  for (const name of ["check", "ability", "method", "modifier", "secret"]) {
    const control = root.querySelector(`[name="${name}"]`);
    if (control) quick.append(control.closest("label") ?? control);
  }
  root.prepend(quick);
  const submit = dialog.element.querySelector('[data-action="ok"]');
  const ability = root.querySelector('[name="ability"]');
  // One line under the select says what the chosen check uses, so the options themselves stay short names.
  const detail = doc.createElement("p");
  detail.className = "hint sc2-check-detail";
  (check.closest("label") ?? check).after(detail);
  function update() {
    detail.textContent = check.selectedOptions[0]?.dataset.detail ?? "";
    detail.hidden = !detail.textContent;
    const selected = checks.find(row => row.id === check.value);
    if (ability && selected) {
      for (const option of ability.options) option.disabled = !selected.attributes.includes(option.value);
      if (!selected.attributes.includes(ability.value)) ability.value = selected.attributes[0];
    }
    for (const section of sections) {
      const rule = Object.entries(CHECK_SECTIONS).find(([name]) => section.querySelector(`[name="${name}"]`));
      const relevant =
        rule?.[1].includes(check.value) ||
        (section.querySelector('[name="gearStatus"]') && /Gear/.test(selected?.tags ?? ""));
      section.hidden = !!rule && !relevant;
      section.dataset.optionExcluded = String(!!rule && !relevant);
      if (relevant) root.insertBefore(section, advanced);
      else advanced.append(section);
      // Do not silently submit circumstances from a different named check.
      for (const control of section.querySelectorAll("input, select, textarea")) {
        if (rule) control.disabled = !relevant;
      }
      section.classList.toggle("sc2-check-context", !!relevant);
    }
    const name = check.selectedOptions[0]?.textContent.replace(/ · [^·]*$/, "") ?? "check";
    const method = root.querySelector('[name="method"]')?.value ?? "roll";
    if (submit) {
      const label =
        method === "take10" ? loc`Take 10: ${name}` : method === "take20" ? loc`Take 20: ${name}` : loc`Roll ${name}`;
      submit.textContent = label;
      submit.setAttribute("aria-label", label);
      submit.dataset.tooltip = label;
    }
    organizeOptions(advanced);
  }
  check.addEventListener("change", update);
  root.querySelector('[name="method"]')?.addEventListener("change", update);
  update();
  installResolutionGuide(root, "skill", { append: true });
}
