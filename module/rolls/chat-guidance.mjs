import { loc } from "../i18n.mjs";
import { appliedDamageEntries } from "../rules/damage-application.mjs";
import { installResolutionGuide } from "../apps/resolution-guide.mjs";

/** Only recorded outcomes count: a high die alone never implies a hit or success. */
export function checkGuidance(check) {
  if (!["attack", "skill", "ability", "save", "knowledge", "damage"].includes(check.checkKind)) return null;
  if (check.superseded) return { title: loc`Replaced result`, note: loc`Use the newer roll to continue.` };
  if (!Number.isFinite(check.rawTotal)) return null;
  if (check.checkKind === "damage") {
    const applied = appliedDamageEntries(check).length;
    return applied
      ? {
          title: loc`Damage applied`,
          note: loc`Check who has already taken this damage (listed below) before applying it to anyone else.`
        }
      : {
          title: check.resolved ? loc`Damage finalized` : loc`Damage rolled`,
          note: check.resolved
            ? loc`Review the recorded total and target actions below.`
            : loc`Spend any action die first, then press Apply to take the damage off the target.`
        };
  }
  const title = check.criticalFailure
    ? loc`Critical failure confirmed`
    : check.criticalSuccess
      ? loc`Critical success confirmed`
      : check.successConfirmed === true
        ? loc`Success confirmed`
        : check.successConfirmed === false
          ? loc`Failure confirmed`
          : check.attackResolution
            ? check.attackResolution.hit
              ? loc`Hit recorded`
              : loc`Miss recorded`
            : check.resolved
              ? loc`Outcome closed`
              : loc`Result pending`;
  const note = check.resolved
    ? loc`Outcome closed. Complete any follow-up actions shown below.`
    : check.checkKind === "attack" && check.attackResolution?.hit && check.successConfirmed === true
      ? loc`Press Roll damage, then apply it to the target from the damage card.`
      : typeof check.successConfirmed === "boolean" ||
          check.criticalFailure ||
          check.criticalSuccess ||
          check.attackResolution
        ? loc`Review any remaining options below. Use Outcome resolved when finished.`
        : check.checkKind === "attack"
          ? loc`Spend any action dice first, then press Resolve to compare this attack with the target's Defense.`
          : loc`Apply any optional boosts, then compare with the difficulty or opposing result. Use Outcome resolved when finished.`;
  return { title, note };
}

export function renderCheckGuidance(message, check, html, user) {
  if (message.isContentVisible === false || (message.blind && !user.isGM) || !(message.isAuthor || user.isGM)) return;
  const guidance = checkGuidance(check);
  const content = html.querySelector(".message-content");
  if (!guidance || !content?.prepend || content.querySelector(".sc2-result-guide")) return;
  const box = document.createElement("section");
  box.className = "spycraft2 sc2-result-guide";
  const title = document.createElement("h4");
  title.textContent = guidance.title;
  const note = document.createElement("p");
  note.textContent = guidance.note;
  box.append(title, note);
  installResolutionGuide(box, check.checkKind, { append: true });
  content.prepend(box);
}
