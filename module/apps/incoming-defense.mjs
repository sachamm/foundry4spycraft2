import {
  whirlingDefenseContent,
  whirlingDefensePreview,
  validateWhirlingDefensePreview,
  validateWhirlingIncomingIdentity
} from "./whirling-stance.mjs";
import { validateGuardDefenseProof } from "../rules/guard.mjs";
import { validateGreatSwordDefenseProof } from "../rules/great-sword-defense.mjs";
import { ghostCoverContent, ghostCoverPreview, validateGhostCoverPreview } from "./ghost-cover.mjs";
import { terrainCoverContent } from "./terrain-cover.mjs";
import { COVER_GRADES, precisionTakedownGrade } from "../rules/cover.mjs";
import { cqbRangedWeapon } from "../rules/cqb.mjs";
import { weaponUnavailable } from "../rules/gear.mjs";
import { incomingDefensePlan } from "../rules/defense.mjs";
import { combatStanceState } from "../rules/combat-stance.mjs";
import { hordeCoverFloor } from "../rules/team-feats.mjs";
import { loc } from "../i18n.mjs";
const rangedSourceFacts = ({ attacker, weapon }) =>
  JSON.stringify({
    feats: attacker.system.activeFeatNames ?? [],
    cqbRange: attacker.system.cqbRange ?? 30,
    classes: attacker.system.classLevels ?? {},
    weapon: weapon.system
  });
const canReadSource = actor =>
  actor?.isOwner === true || game.user.isGM === true || actor?.testUserPermission?.(game.user, "OBSERVER") === true;
export async function checkIncomingDefense(actor) {
  if (actor?.type !== "agent" || !actor.isOwner) return null;
  const fields = {
    coupDeGraceException: loc`The GC confirms an actual character option permits Coup de Grace without helplessness`,
    ranged: loc`This is a ranged attack`,
    flatFooted: loc`The character is flat-footed against this attack`,
    invisibleAttacker: loc`The attacker is invisible to the character`,
    flanked: loc`The attackers otherwise meet the flanking requirements`,
    securityDevice: loc`The attack is made by a security device`,
    adjacent: loc`The attacker is adjacent`,
    withinMeleeRange: loc`The attacker is within Melee Range`
  };
  const esc = foundry.utils.escapeHTML,
    sources = new Map(),
    precisionSources = new Map();
  for (const attacker of game.actors ?? [])
    if (canReadSource(attacker))
      if (["CQB Supremacy", "Sharpshooter Basics"].some(name => attacker.system?.activeFeatNames?.includes(name)))
        for (const weapon of attacker.items ?? [])
          if (weapon.type === "weapon" && cqbRangedWeapon(weapon.system) && !weaponUnavailable(weapon.system))
            sources.set(attacker.id + ":" + weapon.id, {
              attacker,
              weapon,
              facts: rangedSourceFacts({ attacker, weapon })
            });
  for (const attacker of game.actors ?? [])
    if (canReadSource(attacker))
      if (precisionTakedownGrade(attacker.system)) precisionSources.set(attacker.id, attacker);
  const circlingSources = new Map();
  for (const attacker of game.actors ?? [])
    if (
      attacker !== actor &&
      canReadSource(attacker) &&
      ["circling", "shifting"].includes(combatStanceState(attacker.system ?? {})?.key)
    )
      circlingSources.set(attacker.id, attacker);
  const circlingInput = circlingSources.size
    ? `<fieldset><legend>${loc`Circling or Shifting Stance attacker`}</legend><label>${loc`Attacker in Circling Stance (Knife Basics) or Shifting Stance (Kicking Basics; optional)`} <select name="circlingAttacker"><option value="">${loc`No such attacker`}</option>${[...circlingSources].map(([id, a]) => `<option value="${esc(id)}">${esc(a.name)}</option>`).join("")}</select></label><label><input name="circlingUnoccupiedAdjacent" type="checkbox" /> ${loc`The GC confirms at least 1 square adjacent to that attacker is unoccupied`}</label><label><input name="shiftingUnarmed" type="checkbox" /> ${loc`Shifting Stance: this is an unarmed attack`}</label></fieldset>`
    : "";
  const coverInput = `<fieldset><legend>${loc`Cover from this attacker`}</legend><p>${loc`Choose the best personal source and best scenery source on the attacker's side of the cover. Enter grades after any other separately adjudicated grade adjustments. Do not preapply the automatically selected Precision Takedown, CQB Supremacy or Sharpshooter Basics reductions. Other options modifying the cover Defense bonus itself remain separate, except Safe Attack below.`}</p>${["personal", "scenery"].map(kind => `<label>${loc`${kind === "personal" ? "Personal" : "Scenery"} cover`} <select name="${kind}Cover">${COVER_GRADES.map((label, i) => `<option value="${i}">${esc(label)}</option>`).join("")}</select></label>`).join("")}${terrainCoverContent(actor.system)}${[...(game.actors ?? [])].some(a => a.system?.activeFeatNames?.includes("Horde Basics")) ? `<label>${loc`Horde Basics: this side’s advantage (raises personal cover)`} <select name="hordeAdvantage"><option value="">${loc`None or no Horde Basics on this side`}</option><option value="2">${loc`2-to-1: at least 1/4 personal cover`}</option><option value="3">${loc`3-to-1 or more: at least 1/2 personal cover`}</option></select></label>` : ""}<label>${loc`Ranged attacker and actual weapon (CQB Supremacy / Sharpshooter Basics; optional)`} <select name="coverAttacker"><option value="">${loc`No automatic ranged-feat reduction`}</option>${[...sources].map(([id, { attacker, weapon }]) => `<option value="${esc(id)}">${esc(attacker.name)} — ${esc(weapon.name)}</option>`).join("")}</select></label><label>${loc`Counter-Terrorist attacker (optional; automatic for the CQB attacker selected above)`} <select name="precisionAttacker"><option value="">${loc`No additional attacker selection`}</option>${[...precisionSources].map(([id, a]) => `<option value="${esc(id)}">${loc`${esc(a.name)} — Precision Takedown ${precisionTakedownGrade(a.system) === 2 ? "II" : "I"}`}</option>`).join("")}</select></label><label>${loc`Target distance in feet for CQB Supremacy`} <input name="coverDistance" type="number" min="0" step="any" /></label><label><input name="coverOpponent" type="checkbox" /> ${loc`This character is an opponent of the selected attacker`}</label><label>${loc`Remaining human-shield Defense bonus after cover-grade reductions`} <input name="humanShieldDefense" type="number" value="0" min="0" max="8" step="1" /></label><label><input name="humanShieldConfirmed" type="checkbox" /> ${loc`The GC confirmed this remaining component; it is supplied by a human shield`}</label><p>${loc`Use0 without a human shield. The GC determines which component remains after grade reductions. An actual Counter-Terrorist level4+ halves only this component with Safe Attack; other cover and penetration remain separate.`}</p></fieldset>`;
  const input = await foundry.applications.api.DialogV2.input({
    window: { title: loc`Incoming attack — Defense` },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p>${loc`Check Defense for one incoming attack. Current conditions and class benefits apply.`}</p>${coverInput}${circlingInput}${ghostCoverContent(actor)}${actor.system.duelingBasics?.opponentUuid && actor.system.activeFeatNames?.includes("Dueling Basics") ? `<label><input name="fromDuelingOpponent" type="checkbox" /> ${loc`Dueling Basics: this attack comes from ${esc(actor.system.duelingBasics.opponentName || "the chosen opponent")} (+2 dodge)`}</label>` : ""}${whirlingDefenseContent(actor)}${Object.entries(
      fields
    )
      .map(([key, label]) => `<label><input name="${key}" type="checkbox" /> ${label}</label>`)
      .join(
        ""
      )}<label>${loc`Source of the Coup de Grace exception (if declared)`} <input name="coupDeGraceExceptionSource" /></label></div>`
  });
  if (!input) return null;
  let plan,
    ghostCover,
    whirling,
    rangedSource = null,
    targetSize = null,
    circlingSource = null;
  try {
    circlingSource = input.circlingAttacker ? circlingSources.get(input.circlingAttacker) : null;
    if (
      input.circlingAttacker &&
      (!circlingSource || !canReadSource(circlingSource) || game.actors.get(circlingSource.id) !== circlingSource)
    )
      throw new Error(loc`Choose a listed Circling Stance attacker.`);
    ghostCover = ghostCoverPreview(actor, input);
    whirling = whirlingDefensePreview(actor, input);
    const source = input.coverAttacker ? sources.get(input.coverAttacker) : null;
    if (input.coverAttacker && !source) throw new Error(loc`Choose a listed ranged-feat attacker and weapon.`);
    if (
      source &&
      (!canReadSource(source.attacker) ||
        game.actors.get(source.attacker.id) !== source.attacker ||
        source.facts !== rangedSourceFacts(source) ||
        source.attacker.items.get(source.weapon.id) !== source.weapon ||
        weaponUnavailable(source.weapon.system))
    )
      throw new Error(loc`The selected attacker or weapon changed. Open the preview again.`);
    rangedSource = source;
    targetSize = actor.system.sizeModifier;
    const precision = input.precisionAttacker ? precisionSources.get(input.precisionAttacker) : null;
    if (
      input.precisionAttacker &&
      (!precision ||
        !canReadSource(precision) ||
        game.actors.get(precision.id) !== precision ||
        !precisionTakedownGrade(precision.system))
    )
      throw new Error(loc`The selected Precision Takedown source changed. Open the preview again.`);
    if (source && precision && source.attacker !== precision)
      throw new Error(loc`Both cover reductions must belong to the same actual attacker.`);
    if (ghostCover && [source?.attacker, precision].some(a => a && a.uuid !== ghostCover.context.actorUuid))
      throw new Error(loc`The Ghost and cover-reduction declarations must name the same actual attacker.`);
    validateWhirlingIncomingIdentity(whirling, [source?.attacker.uuid, precision?.uuid, ghostCover?.context.actorUuid]);
    const grade = value => {
      if (value === undefined) return 0;
      if (!/^[0-4]$/.test(String(value))) throw new Error(loc`Choose a listed cover grade.`);
      return Number(value);
    };
    const distance =
      source && typeof input.coverDistance === "string" && input.coverDistance.trim()
        ? Number(input.coverDistance)
        : source && typeof input.coverDistance === "number"
          ? input.coverDistance
          : undefined;
    const shield =
      input.humanShieldDefense === undefined || input.humanShieldDefense === ""
        ? 0
        : typeof input.humanShieldDefense === "number"
          ? input.humanShieldDefense
          : typeof input.humanShieldDefense === "string" && /^[0-8]$/.test(input.humanShieldDefense)
            ? Number(input.humanShieldDefense)
            : NaN;
    const cover = {
      homeTurfCover: input.homeTurfCover ?? false,
      homeTurfCoverSource: input.homeTurfCoverSource ?? "scenery",
      partialSubmersionCover: input.partialSubmersionCover ?? false,
      terrainCoverConfirmed: input.terrainCoverConfirmed ?? false,
      humanShieldDefense: shield,
      humanShieldConfirmed: input.humanShieldConfirmed ?? false,
      personalCover: Math.max(grade(input.personalCover), hordeCoverFloor(input.hordeAdvantage)),
      sceneryCover: grade(input.sceneryCover),
      attackerSystem: source?.attacker.system,
      attackerWeapon: source?.weapon.system,
      precisionAttackerSystem: precision?.system,
      distanceFeet: distance,
      opponentConfirmed: input.coverOpponent === true
    };
    if (circlingSource && [source?.attacker, precision].some(a => a && a !== circlingSource))
      throw new Error(loc`The Circling Stance and cover-reduction declarations must name the same actual attacker.`);
    plan = incomingDefensePlan(actor.system, {
      fromDuelingOpponent: input.fromDuelingOpponent === true,
      cover,
      circling: circlingSource
        ? {
            attackerSystem: circlingSource.system,
            unoccupiedAdjacentConfirmed: input.circlingUnoccupiedAdjacent === true,
            unarmedConfirmed: input.shiftingUnarmed === true
          }
        : undefined,
      whirlingAttackerLevel: whirling.plan.attackerLevel,
      ...Object.fromEntries(Object.keys(fields).map(k => [k, input[k] === true])),
      invisibleAttacker: input.invisibleAttacker === true || ghostCover?.invisible === true,
      coupDeGraceExceptionSource: input.coupDeGraceExceptionSource ?? ""
    });
    if (ghostCover) plan.ghostCover = ghostCover;
  } catch (error) {
    return ui.notifications.warn(error.message);
  }
  await foundry.applications.api.DialogV2.input({
    window: { title: loc`Incoming attack — result` },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p><b>${loc`Defense ${plan.total}`}</b></p>${ghostCover ? `<p>${loc`Ghost attacker: ${esc(ghostCover.context.actorName)}; invisible to ${esc(ghostCover.context.opponentName)}: ${ghostCover.invisible ? "yes" : "no"}.`}</p>${ghostCover.notes.map(n => `<p>${esc(n)}</p>`).join("")}` : ""}<p>${loc`Cover: ${esc(plan.cover.label)}, Defense +${plan.cover.defenseBonus}; ordinary Reflex bonus +${plan.cover.reflexBonus} against effects beyond the cover (apply separately to the save).${plan.cover.precisionReduction ? loc` Precision Takedown reduced attack cover by ${plan.cover.precisionReduction} grade(s).` : ""}${plan.cover.supremacyReduction ? loc` CQB Supremacy reduced the attack cover by one quarter.` : ""}`}</p>${plan.cover.notes.map(n => `<p>${esc(n)}</p>`).join("")}<p>${loc`DEX ${plan.dexterity}; dodge bonuses removed ${plan.dodgeLost + plan.circling.dodgeReduction}; security-device bonus +${plan.securityBonus}; adjacent Eye of the Storm bonus +${plan.eyeOfStorm}.`}</p><p>${loc`Uncanny Dodge grade ${plan.uncanny.grade}; vulnerable ${plan.vulnerable ? "yes" : "no"}; flat-footed ${plan.flatFooted ? "yes" : "no"}; flanked ${plan.flanked ? "yes" : "no"}; helpless ${plan.helpless ? "yes" : "no"}.`}</p><p>${loc`Attacker modifier ${plan.attackerBonus >= 0 ? "+" : ""}${plan.attackerBonus} (pinned target, adjacent melee/unarmed +${plan.pinnedAttackerBonus}; prone target ${plan.proneAttackerPenalty}; crouched target ${plan.crouchedAttackerPenalty}; blinded target +${plan.blindedAttackerBonus}; helpless target within Melee Range +${plan.helplessAttackerBonus}). Coup de Grace target eligible: ${plan.coupDeGraceEligible ? loc`yes, subject to normal action requirements` : "no"}.`}</p><p>${loc`Known sneak attack immunity: ${plan.sneakAttackImmune ? "yes" : "no"}. ${plan.armorMasteryRequiresHelpless ? loc`Armor Mastery requires helplessness even when another option permits Coup de Grace.` : ""}`}</p>${plan.listedDR ? `<p>${loc`Listed DR before armor piercing/type exceptions: melee weapons ${plan.listedDR.meleeWeapon}, unarmed ${plan.listedDR.unarmed}, non-grenade hurled weapons ${plan.listedDR.hurledWeapon}, other ranged weapons ${plan.listedDR.rangedWeapon}, other ${plan.listedDR.other}.`}</p>` : ""}${plan.coupDeGraceException ? `<p>${loc`Declared exception: ${esc(plan.coupDeGraceExceptionSource)}.`}</p>` : ""}${plan.notes.map(n => `<p>${esc(n)}</p>`).join("")}</div>`
  });
  try {
    if (
      rangedSource &&
      (!canReadSource(rangedSource.attacker) ||
        game.actors.get(rangedSource.attacker.id) !== rangedSource.attacker ||
        rangedSource.attacker.items.get(rangedSource.weapon.id) !== rangedSource.weapon ||
        weaponUnavailable(rangedSource.weapon.system) ||
        rangedSource.facts !== rangedSourceFacts(rangedSource) ||
        actor.system.sizeModifier !== targetSize)
    )
      throw Error(
        loc`The actual ranged attacker, weapon, qualified feats or target Size changed. Reopen the incoming attack preview.`
      );
    if (
      circlingSource &&
      (!canReadSource(circlingSource) ||
        game.actors.get(circlingSource.id) !== circlingSource ||
        !["circling", "shifting"].includes(combatStanceState(circlingSource.system)?.key))
    )
      throw Error(loc`The Circling Stance attacker changed or left the stance. Reopen the incoming attack preview.`);
    validateWhirlingDefensePreview(actor, input, whirling);
    validateGuardDefenseProof(actor.system, plan.guard, { ranged: input.ranged === true });
    validateGreatSwordDefenseProof(actor.system, plan.greatSword, { ranged: input.ranged === true });
    validateGhostCoverPreview(actor, input, ghostCover);
  } catch (error) {
    return ui.notifications.warn(error.message);
  }
  return plan;
}
