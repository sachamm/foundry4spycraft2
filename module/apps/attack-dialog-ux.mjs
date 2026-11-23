import { loc } from "../i18n.mjs";
import { installResolutionGuide } from "./resolution-guide.mjs";
import { briefOption, configuredOptions, organizeOptions } from "./dialog-sections.mjs";

/** Reorganize the existing fields without changing their values or the roll readers. */
export function enhanceAttackDialog(_event, dialog) {
  const root = dialog.element?.querySelector(".spycraft2-roll-options");
  if (!root || root.dataset.attackUx) return;
  root.dataset.attackUx = "true";
  const doc = root.ownerDocument;
  const quick = doc.createElement("div");
  quick.className = "sc2-attack-quick";
  const advanced = doc.createElement("details");
  advanced.className = "sc2-attack-circumstances";
  const summary = doc.createElement("summary");
  advanced.append(summary);
  const keep = new Set();
  for (const name of [
    "targetActorUuid",
    "attackAction",
    "distanceFeet",
    "targetOpponentConfirmed",
    "reachAdjacency",
    "situationalModifier"
  ]) {
    const control = root.querySelector(`[name="${name}"]`);
    if (!control) continue;
    const group =
      control.closest(".spycraft2-character-target") ??
      (name === "reachAdjacency" ? control.closest("fieldset") : control.closest("label"));
    if (group) keep.add(group);
  }
  for (const control of root.querySelectorAll("[required]")) {
    const group = control.closest("label") ?? control;
    if (![...keep].some(parent => parent.contains(group))) keep.add(group);
  }
  for (const group of keep) quick.append(group);
  // Short captions retain the original guidance as a field description.
  for (const [name, caption] of [
    ["targetActorUuid", loc`Target (optional)`],
    ["distanceFeet", loc`Range in feet`]
  ]) {
    const control = quick.querySelector(`[name="${name}"]`);
    if (!control || control.closest(".spycraft2-character-target")) continue;
    const label = control.closest("label");
    control.setAttribute("aria-description", label.textContent.trim());
    for (const node of [...label.childNodes]) if (node.nodeType === 3) node.remove();
    label.prepend(doc.createTextNode(caption + " "));
  }
  const hint = doc.createElement("p");
  hint.className = "hint";
  const distance = quick.querySelector('[name="distanceFeet"]');
  hint.textContent = !distance
    ? loc`Open special circumstances for positioning, tricks and other modifiers.`
    : distance.required
      ? loc`Range is required for this attack. Open special circumstances for Aim, Brace, tricks and other modifiers.`
      : loc`Leave range empty for an unmeasured roll. Open special circumstances for Aim, Brace, tricks and other modifiers.`;
  quick.append(hint);
  advanced.append(...root.childNodes);
  root.append(quick, advanced);
  for (const [name, caption] of [
    ["aimed", loc`Aim already taken`],
    ["braced", loc`Brace already taken`],
    ["stableSurface", loc`Stable bracing surface`],
    ["targetFlanked", loc`Flanking this opponent`],
    ["targetPinnedAdjacent", loc`Adjacent to a pinned target`],
    ["targetAnimal", loc`Animal target`],
    ["firingOutOfMelee", loc`I am engaged in melee`],
    ["firingIntoMelee", loc`Target is engaged in melee`]
  ])
    briefOption(advanced, name, caption);
  organizeOptions(advanced, [
    { label: loc`Position and target`, fields: ["targetFlanked", "targetPinnedAdjacent", "targetAnimal"] },
    { label: loc`Aim and Brace`, fields: ["aimed", "braced", "stableSurface"] },
    { label: loc`Shooting around melee`, fields: ["firingOutOfMelee", "firingIntoMelee"] },
    { label: loc`Attack tricks`, fields: ["bullseye*", "allOut*", "meleeTrick*", "cheapShot*"] }
  ]);
  const count = () => configuredOptions(advanced);
  const update = () => {
    const active = count();
    summary.textContent = active ? loc`Special circumstances (${active} set)` : loc`Special circumstances`;
  };
  advanced.open = count() > 0;
  advanced.addEventListener("input", update);
  advanced.addEventListener("change", update);
  root.addEventListener(
    "invalid",
    event => {
      for (let parent = event.target.parentElement; parent && parent !== root; parent = parent.parentElement)
        if (parent.tagName === "DETAILS") parent.open = true;
    },
    true
  );
  update();
  installResolutionGuide(root, "attack", { append: true });
}
