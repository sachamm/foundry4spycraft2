import { ghostCoverPlan, validateGhostCoverProof } from "../rules/ghost-cover.mjs";
import { loc } from "../i18n.mjs";
const actors = () => game.actors?.contents ?? [...(game.actors ?? [])];
const readable = a =>
  game.user?.isGM === true || a?.isOwner === true || a?.testUserPermission?.(game.user, "OBSERVER") === true;
const eligible = a =>
  a?.type === "agent" &&
  readable(a) &&
  a.system?.activeFeatNames?.some(n => n === "Ghost Mastery" || n === "Ghost Supremacy");
export function ghostCoverContent(opponent) {
  const esc = foundry.utils.escapeHTML;
  return `<details><summary>${loc`Ghost attacker’s scenery cover (optional)`}</summary><p>${loc`This checks whether a hidden Ghost attacker is invisible to this character. Its scenery cover is separate from this character’s defensive cover above. Confirm the current grade after other adjudicated scenery improvements; do not substitute personal cover or apply an attack’s cover Defense reductions.`}</p><label><input name="ghostCoverDeclared" type="checkbox" /> ${loc`Check this Ghost attacker’s current invisibility`}</label><label>${loc`Actual Ghost attacker`} <select name="ghostActorUuid"><option value="">${loc`Choose a character`}</option>${actors()
    .filter(a => a !== opponent && eligible(a))
    .map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`)
    .join(
      ""
    )}</select></label><label><input name="ghostHidden" type="checkbox" /> ${loc`The attacker is currently hidden from this character`}</label><label>${loc`Attacker’s scenery cover against this character`} <select name="ghostSceneryCover">${["None", "One-quarter", "Half", "Three-quarter", "Total"].map((n, i) => `<option value="${i}">${n}</option>`).join("")}</select></label><label>${loc`Attacker covered by visible material (%)`} <input name="ghostVisibleMaterial" type="number" value="0" min="0" max="100" step="any" /></label><label>${loc`Feet moved through a disturbing environment during the current uninterrupted use`} <input name="ghostDisturbingMovement" type="number" value="0" min="0" step="any" /></label><label><input name="ghostCoverConfirmed" type="checkbox" /> ${loc`The GC confirms these current circumstances, including any required reestablishment after invisibility was lost`}</label><p>${loc`This preview does not change hidden state, resolve the attack or automatically hide at round end. Hidden-attacker flanking, enemy unawareness and other targeting effects still need their normal declarations.`}</p></details>`;
}
const numeric = v => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN);
export function ghostCoverPreview(opponent, input = {}) {
  if (input.ghostCoverDeclared === false || input.ghostCoverDeclared === undefined) return null;
  if (input.ghostCoverDeclared !== true) throw Error(loc`Declare whether to check the Ghost attacker’s cover.`);
  const source = actors().find(a => a.uuid === input.ghostActorUuid);
  if (source === opponent || !eligible(source))
    throw Error(loc`Choose a current readable, qualified Ghost attacker distinct from this character.`);
  const context = {
    declared: true,
    actorUuid: source.uuid,
    actorName: source.name,
    opponentActorUuid: opponent.uuid,
    opponentName: opponent.name,
    hiddenFromOpponent: input.ghostHidden ?? false,
    sceneryCover: numeric(input.ghostSceneryCover),
    visibleMaterialPercent: numeric(input.ghostVisibleMaterial),
    disturbingMovementFeet: numeric(input.ghostDisturbingMovement),
    confirmed: input.ghostCoverConfirmed ?? false
  };
  return ghostCoverPlan(source.system, context);
}
export function validateGhostCoverPreview(opponent, input, proof) {
  const current = ghostCoverPreview(opponent, input);
  if (!proof && !current) return;
  if (!proof || !current) throw Error(loc`The Ghost declaration changed. Open the preview again.`);
  const source = actors().find(a => a.uuid === current.context.actorUuid);
  validateGhostCoverProof(source.system, proof, current.context);
}
