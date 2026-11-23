import { loc } from "../i18n.mjs";

/** Describe the existing workflow; this guide never executes or broadens rules automation. */
export function resolutionGuide(kind) {
  switch (kind) {
    case "attack":
      return {
        automatic: loc`Rolls the attack, totals supported modifiers and records supported ammunition use. Resolve against Defense compares the recorded total with the chosen Defense.`,
        manual: loc`Declare range and circumstances. Review Defense, cover and table rulings; resolve the attack before rolling damage.`
      };
    case "damage":
      return {
        automatic: loc`After Apply, uses the selected target's damage reduction and supported damage rules, updates owned targets and records a receipt.`,
        manual: loc`Review target, damage type and critical settings. A target you do not own is sent to the GC; wait for the application receipt.`
      };
    case "vehicle":
      return {
        automatic: loc`After confirmation, records fuel use and runs the selected supported vehicle check or damage action.`,
        manual: loc`Assign the driver and crew, select hazards and declare travel or combat circumstances. Review any follow-up prompts.`
      };
    case "gc":
      return {
        automatic: loc`Each confirmed tool performs its supported calculation or record update. Search only changes this view.`,
        manual: loc`The GC chooses mission and scene changes, approves requests and resolves circumstances not covered by the selected tool.`
      };
    case "play":
      return {
        automatic: loc`Roll buttons calculate supported totals. Confirmed resource and damage actions update their recorded values.`,
        manual: loc`Declare circumstances, review prompts and use the result's follow-up controls. Rolling alone does not apply damage or decide every outcome.`
      };
    default:
      return {
        automatic: loc`Calculates the selected check method and includes supported modifiers from the sheet and selected options.`,
        manual: loc`Choose the check and circumstances. Compare with the difficulty or opposing result; use Confirm result when offered, then press Finish. Resolve unlisted effects at the table.`
      };
  }
}

export function installResolutionGuide(root, kind, { collapsed = true, append = false } = {}) {
  if (!root?.querySelector || root.querySelector(":scope > .sc2-resolution-guide")) return;
  const doc = root.ownerDocument;
  const guide = doc.createElement(collapsed ? "details" : "aside");
  guide.className = "sc2-resolution-guide";
  if (collapsed) {
    const summary = doc.createElement("summary");
    summary.textContent = loc`What the system does for you`;
    guide.append(summary);
  } else guide.setAttribute("aria-label", loc`What the system does for you`);
  const descriptions = resolutionGuide(kind);
  for (const [label, text] of [
    [loc`System:`, descriptions.automatic],
    [loc`You / GC:`, descriptions.manual]
  ]) {
    const p = doc.createElement("p"),
      strong = doc.createElement("strong");
    strong.textContent = label + " ";
    p.append(strong, doc.createTextNode(text));
    guide.append(p);
  }
  if (append) root.append(guide);
  else root.prepend(guide);
}
