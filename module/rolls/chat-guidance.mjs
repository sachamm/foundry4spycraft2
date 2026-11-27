import { loc } from "../i18n.mjs";
import { appliedDamageEntries } from "../rules/damage-application.mjs";
import { outcomeLabel } from "../rules/outcome-labels.mjs";

/** Only recorded outcomes count: a high die alone never implies a hit or success. */
export function checkGuidance(check) {
  if (!["attack", "skill", "ability", "save", "knowledge", "damage"].includes(check.checkKind)) return null;
  if (check.superseded)
    return { title: loc`Replaced result`, note: loc`Use the newer roll to continue.`, tone: "neutral" };
  if (!Number.isFinite(check.rawTotal)) return null;
  if (check.checkKind === "damage") {
    const applied = appliedDamageEntries(check).length;
    return applied
      ? {
          tone: "neutral",
          title: loc`Damage applied`,
          note: loc`Check who has already taken this damage (listed below) before applying it to anyone else.`
        }
      : {
          tone: check.resolved ? "neutral" : "pending",
          title: check.resolved ? loc`Finished` : loc`Damage rolled`,
          note: check.resolved
            ? loc`Review the total and the target actions below.`
            : loc`Spend any action die first, then press Apply to take the damage off the target.`
        };
  }
  const hit = check.attackResolution ? check.attackResolution.hit : undefined;
  const [title, tone] = check.criticalFailure
    ? [outcomeLabel(check, "criticalFailure"), "bad"]
    : check.criticalSuccess
      ? [outcomeLabel(check, "criticalSuccess"), "good"]
      : check.successConfirmed === true
        ? [outcomeLabel(check, "success"), "good"]
        : check.successConfirmed === false
          ? [outcomeLabel(check, "failure"), "bad"]
          : hit !== undefined
            ? [hit ? loc`Hit` : loc`Miss`, hit ? "good" : "bad"]
            : check.resolved
              ? [loc`Finished`, "neutral"]
              : [loc`Pending`, "pending"];
  const note = check.resolved
    ? loc`Finished. Complete any follow-up actions shown below.`
    : check.checkKind === "attack" && check.attackResolution?.hit && check.successConfirmed === true
      ? loc`Press Roll damage, then apply it to the target from the damage card.`
      : typeof check.successConfirmed === "boolean" ||
          check.criticalFailure ||
          check.criticalSuccess ||
          check.attackResolution
        ? loc`Review any remaining options below. Press Finish when you are done.`
        : check.checkKind === "attack"
          ? loc`Spend any action dice first, then press Resolve to compare this attack with the target's Defense.`
          : loc`Apply any optional boosts, then compare with the difficulty or opposing result. Press Finish when you are done.`;
  // "16 → 25" when action dice or a cap changed the total after the roll.
  const change =
    Number.isFinite(check.effectiveTotal) && check.effectiveTotal !== check.rawTotal
      ? `${check.rawTotal} → ${check.effectiveTotal}`
      : "";
  // A cap is named, so the change it made is not taken for an action die's (p.88).
  const cap = Object.hasOwn(check, "boostCap") ? check.boostCap : check.cap,
    capped = check.capped && Number.isFinite(cap) ? loc`Result capped at ${cap} (p.88).` : "";
  return { title, note, tone, change, capped };
}

const TONE_ICONS = { good: "fa-check", bad: "fa-xmark", pending: "fa-hourglass-half", neutral: "fa-flag-checkered" };

export function renderCheckGuidance(message, check, html, user) {
  if (message.isContentVisible === false || (message.blind && !user.isGM) || !(message.isAuthor || user.isGM)) return;
  const guidance = checkGuidance(check);
  const content = html.querySelector(".message-content");
  if (!guidance || !content?.prepend || content.querySelector(".sc2-result-guide")) return;
  const box = document.createElement("section");
  box.className = `spycraft2 sc2-result-guide sc2-outcome-${guidance.tone ?? "neutral"}`;
  // A styled paragraph, not a heading: a card has no heading above it for an h4 to sit under.
  const title = document.createElement("p");
  title.className = "sc2-guide-title";
  const icon = document.createElement("i");
  icon.className = `fa-solid ${TONE_ICONS[guidance.tone] ?? TONE_ICONS.neutral}`;
  icon.setAttribute("aria-hidden", "true");
  title.append(icon, document.createTextNode(` ${guidance.title}`));
  if (guidance.change) {
    const change = document.createElement("span");
    change.className = "sc2-guide-change";
    change.textContent = guidance.change;
    title.append(" ", change);
  }
  // The next-step sentence is a hint on the title, not a paragraph: the buttons already say what to do.
  const hint = document.createElement("i");
  hint.className = "fa-solid fa-circle-info sc2-guide-hint";
  hint.tabIndex = 0;
  hint.setAttribute("role", "img");
  hint.setAttribute("aria-label", guidance.note);
  hint.dataset.tooltip = guidance.note;
  title.append(" ", hint);
  box.append(title);
  if (guidance.capped) {
    const cap = document.createElement("p");
    cap.className = "hint sc2-guide-cap";
    cap.textContent = guidance.capped;
    box.append(cap);
  }
  content.prepend(box);
}
