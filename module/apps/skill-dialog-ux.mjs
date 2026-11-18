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
  summary.textContent = "Advanced options";
  advanced.append(summary);
  const sections = [...root.children].filter(el => el.tagName === "DETAILS");
  root.insertBefore(advanced, sections[0] ?? null);
  // Choosing Roll / Take 10 / Take 20 is a common action, not an advanced modifier.
  const methodLabel = root.querySelector('[name="method"]')?.closest("label");
  if (methodLabel) root.insertBefore(methodLabel, advanced);
  const submit = dialog.element.querySelector('[data-action="ok"]');
  const ability = root.querySelector('[name="ability"]');
  function update() {
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
      if (relevant) root.insertBefore(section, advanced);
      else advanced.append(section);
      // Do not silently submit circumstances from a different named check.
      for (const control of section.querySelectorAll("input, select, textarea")) {
        if (rule) control.disabled = !relevant;
      }
      section.classList.toggle("sc2-check-context", !!relevant);
    }
    const name = check.selectedOptions[0]?.textContent.replace(/ \([^)]*\)$/, "") ?? "check";
    const method = root.querySelector('[name="method"]')?.value ?? "roll";
    if (submit)
      submit.textContent =
        method === "take10" ? `Take 10: ${name}` : method === "take20" ? `Take 20: ${name}` : `Roll ${name}`;
  }
  check.addEventListener("change", update);
  root.querySelector('[name="method"]')?.addEventListener("change", update);
  update();
}
