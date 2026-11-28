/** Running NPCs at the table: skill checks, standard-NPC Damage saves and disposition (pp.331–332, 452, 457–458). */
import { withUndo } from "../undo.mjs";
import { esc } from "../../html.mjs";
import { refuse } from "../../error-notices.mjs";
import { messageModeOption } from "../../rolls/message-mode.mjs";
import { TABLES, SKILLS } from "../../rules/tables.mjs";
import { stepLookup } from "../../rules/formula.mjs";
import { currentDamageTrack, healDamageTrack } from "../../rules/gc/npc-damage.mjs";
import {
  DISPOSITIONS,
  dispositionGrade,
  dispositionToward,
  shiftDisposition,
  loyaltyDecision,
  joinsCombat,
  persuadeJoinPlan,
  dispositionCheckModifier
} from "../../rules/gc/disposition.mjs";
import { npcIsSpecial, spendProfile } from "../../rules/gc/npc-state.mjs";
export { npcIsSpecial, isPromoted, spendProfile } from "../../rules/gc/npc-state.mjs";
import { damageSaveState, npcDamageSave, askNpcDamageSaveInput } from "./npc-damage-save.mjs";
export { damageSaveState, npcDamageSave } from "./npc-damage-save.mjs";
import { npcSkillQualityPlan } from "../../rules/npc-qualities.mjs";
import { campaignSkillChecks, campaignSkillPolicy, moraleSkillPenalty } from "../../rules/campaign-skills.mjs";
import { skillPenaltyValue, skillPenaltyEntries, skillPenaltyNotes } from "../../rules/skill-penalties.mjs";
import { shakenSkillPenalty } from "../../rules/shaken.mjs";
import { dispositionSkillContext, dispositionTargetContent } from "../target-skill-effects.mjs";
import { dispositionSkillPlan } from "../../rules/disposition-skills.mjs";
import { GC_DATA } from "../../rules/gc-tables.mjs";
import { sceneEpoch, getMission, teamActors } from "./state.mjs";
import { loc } from "../../i18n.mjs";
import { readSetting } from "../../settings.mjs";
import { campaignRules, campaignSkillPlan, omniPenalty } from "../../rules/campaign-rules.mjs";
import { skillConditionCheckPenalty } from "../../rules/skill-conditions.mjs";
import { sizeStealthCheck } from "../../rules/check-identity.mjs";

import { breakdownRows } from "../../rules/bonus-breakdown.mjs";
import { manageSceneDisposition } from "../scene-disposition.mjs";
import { formDialog, raw } from "../dialog-kit.mjs";
import { manageCombatPersuasion } from "./combat-persuasion.mjs";
import { campaignSkillDCPolicy } from "../../rules/campaign-skill-dc.mjs";
import { drainedRecoveryCheck, drainedNpcCheckOptions } from "../../rules/drained.mjs";
import { grappleSkillChecks, grappleCheckPlan, grappleCircumstancesContent } from "../../rules/grapple-check.mjs";
import { cooperativeContent, cooperativeInput } from "../cooperative.mjs";
import { restraintSkillChecks, restraintSourceSnapshot } from "../../rules/restraints.mjs";
import { npcSkillActionPlan } from "../../rules/npc-skill-checks.mjs";

const ask = (title, content, ok, validate = null) => formDialog({ title, ok, validate, fields: [raw(content)] });
const options = (rows, selected) =>
  rows
    .map(
      ([value, label]) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`
    )
    .join("");
const say = (actor, content, { whisper = false } = {}) =>
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    ...(whisper ? { whisper: ChatMessage.getWhisperRecipients("GM").map(user => user.id) } : {})
  });
const signed = value => (value >= 0 ? `+${value}` : `${value}`);

/** p.452: an NPC's skill bonus is the higher of Competence and its skilled bonus; that number is also its ranks for result caps. */
export function npcSkillPlan(actor, key) {
  const system = actor.system,
    listed = system.npcBuild?.skills?.find(skill => skill.key === key);
  const bonus = listed?.bonus ?? system.competence ?? 0;
  return {
    key,
    bonus,
    listed: !!listed,
    cap: campaignSkillPolicy(system)?.uncapped ? null : stepLookup(TABLES.skillCap, bonus)
  };
}
const npcNamedChecks = (skill, system = {}) =>
  restraintSkillChecks(system, skill.key, grappleSkillChecks(skill.key, skill.checks)).filter(
    check => !check.optionalRule || (check.optionalRule === "linguistics" && readSetting("linguistics", false) === true)
  );

/** The part of the NPC skill check dialog that comes from its qualities: the boxes for situational ones. */
export function qualityCheckContent(effects) {
  if (!effects) return "";
  const boxes = effects.skillOptions
    .map(option => `<label><input type="checkbox" name="quality-${esc(option.id)}" /> ${esc(option.label)}</label>`)
    .join("");
  const rider =
    effects.trainedQualities >= 2
      ? `<label data-when="skillCheck=resolve:morale">${loc`Rider's Charisma modifier`} <input type="number" name="riderCharisma" value="0" /></label>`
      : "";
  if (!boxes && !rider) return "";
  return `<fieldset><legend>${loc`Qualities`}</legend>${rider}${boxes}</fieldset>`;
}

/** The named check of a skill an NPC makes: the one asked for, or else the skill's first. */
export function npcSkillCheck(skillKey, checkId = "") {
  const checks = CONFIG.SPYCRAFT?.skills?.[skillKey]?.checks ?? [];
  return checks.find(check => check.id === checkId) ?? checks[0] ?? null;
}

/** Whether a check's result takes the Size table's Stealth/Hide modifier (p.349). */
/**
 * The parts of an NPC skill check that come from its conditions, its Size and the campaign's qualities: labelled rows
 * and an error range change (pp.340–342, 349, 406–408). Omni-Competent halves the penalties.
 */
export function npcSkillCheckRows(system, skillKey, check, { ability, modifier = 0, ...input } = {}) {
  const halve = omniPenalty(),
    rows = [];
  const conditions = skillConditionCheckPenalty(system, ability);
  if (conditions) rows.push({ label: loc`Conditions`, value: halve(conditions) });
  if (sizeStealthCheck(skillKey, check) && system.sizeHideModifier)
    rows.push({ label: loc`Size`, value: halve(system.sizeHideModifier) });
  if (Number(modifier)) rows.push({ label: loc`Situational modifier`, value: halve(Number(modifier)) });
  const campaign = campaignSkillPlan(system, skillKey, check ?? {}, { ...input, ability });
  for (const bonus of campaign.bonuses) rows.push({ label: bonus.source, value: halve(bonus.value) });
  return { rows, errorIncrease: campaign.errorIncrease };
}

/** Whether an animal may make this check (p.445). */
export const animalMayMake = (skillKey, checkId) => ANIMAL_CHECKS.includes(`${skillKey}:${checkId}`);
const ANIMAL_CHECKS = [
  "tactics:ambush",
  "notice:awareness",
  "acrobatics:balance",
  "athletics:climb",
  "intimidate:coercion",
  "athletics:escape",
  "acrobatics:falling",
  "survival:foraging",
  "athletics:forced-march",
  "acrobatics:jump",
  "sneak:hide",
  "athletics:maneuver",
  "resolve:morale",
  "athletics:power-lifting",
  "resolve:resist-impress",
  "resolve:resist-intimidate",
  "senseMotive:resist-manipulate",
  "search:perception",
  "athletics:smash",
  "athletics:speed-push",
  "sneak:stash-item",
  "blend:stealth",
  "athletics:swim",
  "acrobatics:tumble",
  "survival:tracking"
];

/** Ask the characters who meet this NPC for the save one of its qualities forces. */
export async function callQualitySave(actor, id) {
  const call = actor.system.qualityEffects?.saveCalls?.find(entry => entry.id === id);
  if (!call) return null;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><b>${esc(call.name)}</b> — ${esc(call.text)} (p.${call.page})</p>`
  });
}

export async function rollNpcSkill(actor, input = null, context = {}) {
  if (!actor.isOwner) return null;
  const graded = actor.system.npcProfile?.enabled === true;
  if (!input && context.drainedRecovery) {
    const result = await formDialog({
      title: loc`${actor.name}: Drained recovery`,
      ok: loc`Make original recovery check`,
      intro: loc`Resolve (Wis), DC ${context.drainedRecovery.dc}. Include only eligible modifiers. The original attempt keeps its category and one saved result.`,
      fields: [
        ...(!graded ? [{ number: "manualBonus", label: loc`Actual Resolve skill bonus before Wisdom`, value: 0 }] : []),
        { number: "modifier", label: loc`Eligible situational or synergy modifier`, value: 0 },
        { number: "error", label: loc`Actual error range before qualities`, value: 1, min: 0 },
        ...(context.drainedRecovery.mode === "Active"
          ? [
              {
                select: "method",
                label: loc`Method`,
                options: [
                  ["roll", loc`Roll`],
                  ["take10", loc`Take 10`],
                  ["take20", loc`Take 20`]
                ]
              },
              { check: "safeToTake", label: loc`Neither distracted nor endangered; required for taking 10/20` }
            ]
          : []),
        raw(qualityCheckContent(actor.system.qualityEffects)),
        ...(actor.system.conditionContext?.paralyzed
          ? [{ check: "purelyMentalConfirmed", label: loc`The GC confirms this recovery is a purely mental action` }]
          : []),
        { check: "secret", label: loc`Secret (GC only)` }
      ]
    });
    if (!result) {
      await context.onDrainedRecoveryContextCancelled?.();
      return null;
    }
    input = { ...result, key: "resolve", ability: "wis" };
  }
  if (!input) {
    const skillRows = SKILLS.filter(skill => !context.combatPersuasion || skill.key === "impress").map(skill => [
      skill.key,
      `${skill.name}${graded ? ` ${signed(npcSkillPlan(actor, skill.key).bonus)}` : ""}`
    ]);
    const abilityRows = Object.entries(CONFIG.SPYCRAFT.abilities)
      .filter(([key]) => !context.combatPersuasion || key === "cha")
      .map(([key, label]) => [key, game.i18n.localize(label)]);
    input = await ask(
      loc`${actor.name}: skill check`,
      `
      <p>${loc`An NPC uses the higher of Competence and its skilled bonus, which also sets the result cap (p.452). The key attribute modifier is added.`}</p>
      ${context.combatPersuasion ? `<p>${loc`This is the side's reserved Impress/Persuasion attempt. Its target and attitude were confirmed before this roll.`}</p>` : ""}
      <label>${loc`Skill`} <select name="key">${
        context.combatPersuasion
          ? options(skillRows)
          : SKILLS.map(
              skill =>
                `<optgroup label="${esc(skillRows.find(row => row[0] === skill.key)[1])}"><option value="${skill.key}">${esc(skill.name)} — ${loc`General skill check`}</option>${npcNamedChecks(
                  skill,
                  actor.system
                )
                  .map(
                    check =>
                      `<option value="${skill.key}/${check.id}"${context.initialSkill === `${skill.key}/${check.id}` ? " selected" : ""}>${esc(check.name)}</option>`
                  )
                  .join("")}</optgroup>`
            ).join("")
      }</select></label>
      <label>${loc`Attribute`} <select name="ability">${options([["", loc`First listed for the skill`], ...abilityRows], "")}</select></label>
      ${graded ? "" : `<label>${loc`Skill bonus (manual stat block)`} <input type="number" name="manualBonus" value="0" /></label>`}
      <label>${loc`Situational modifier`} <input type="number" name="modifier" value="0" /></label>
      <label>${loc`Error range (blank uses the named check's range)`} <input type="number" name="error" min="0" max="19" value="" /></label>
      ${qualityCheckContent(actor.system.qualityEffects)}
      <details><summary>${loc`Grapple circumstances`}</summary>${grappleCircumstancesContent(actor)}</details>
      ${cooperativeContent(null, actor)}
      <details><summary>${loc`Skill tags and senses`}</summary><p>${loc`Current actor conditions apply automatically. Declare only additional circumstances of this named check.`}</p><label><input name="oneHanded" type="checkbox" /> ${loc`This Hands-On check uses one hand`}</label><label><input name="noSharedLanguage" type="checkbox" /> ${loc`No shared language or relevant local tongue`}</label><label><input name="conveyingMessage" type="checkbox" /> ${loc`I am transmitting Innuendo`}</label><label><input name="blinded" type="checkbox" /> ${loc`Additionally blinded for this check`}</label><label><input name="deafened" type="checkbox" /> ${loc`Additionally deafened for this check`}</label><label><input name="requiresEyesight" type="checkbox" /> ${loc`This task requires eyesight or eye-hand coordination`}</label><label><input name="requiresHearing" type="checkbox" /> ${loc`This task requires hearing`}</label><label><input name="targetDeafened" type="checkbox" /> ${loc`The actual target is deafened`}</label><label><input name="targetCharacter" type="checkbox" /> ${loc`The target is a character`}</label><label>${loc`Actual distance to that character (ft.)`} <input name="distanceFeet" type="number" min="0" step="any" /></label></details>
      <details><summary>${loc`Grapple proficiency and Size`}</summary><fieldset><legend>${loc`Opposed Athletics (pp.347,357)`}</legend><label>${loc`Applicable proficiency`} <select name="grappleProficient"><option value="">${loc`Confirm for this escape`}</option><option value="true">${loc`Proficient`}</option><option value="false">${loc`Not proficient: two full actions, error +2`}</option></select></label><label>${loc`My Size categories minus opponent Size categories`} <input name="grappleSizeDifference" type="number" value="0" step="1" min="-20" max="20" /></label><label><input name="grappleContextConfirmed" type="checkbox" /> ${loc`The GC confirms the actual participants, proficiency and Size difference`}</label><label><input name="grappleAllSourcesConfirmed" type="checkbox" /> ${loc`All current Held/Pinned sources belong to this same grapple; otherwise review them separately`}</label></fieldset></details>
      ${actor.system.conditionContext?.paralyzed ? `<label><input name="purelyMentalConfirmed" type="checkbox" /> ${loc`The GC confirms this is a purely mental action`}</label>` : ""}
      ${actor.system.campaignEffects?.socialCheckMorale ? `<label><input type="checkbox" name="surprise" /> ${loc`Paranoid: Blend/Stealth or Sneak/Hide to determine surprise`}</label><label><input type="checkbox" name="shiftingDisposition" /> ${loc`Paranoid: this check shifts a target's disposition`}</label><label><input type="checkbox" name="persuadingAction" /> ${loc`Paranoid: this check persuades a target to take an action`}</label>` : ""}
      ${context.combatPersuasion ? "" : dispositionTargetContent("impress")}
      <label><input type="checkbox" name="secret" /> ${loc`Secret (GC only)`}</label>`,
      loc`Roll`
    );
    if (!input) return null;
  }
  if (input.skillCheck) input = { ...input, key: String(input.skillCheck).replace(":", "/") };
  if (input.paranoidPersuasion === true) input = { ...input, persuadingAction: true };
  if (input.qualityCheck && !input.check) input = { ...input, check: input.qualityCheck };
  if (input.check && typeof input.key === "string" && !input.key.includes("/"))
    input = { ...input, key: input.key + "/" + input.check };
  input = {
    ...input,
    grappleProficient:
      input.grappleProficient === "true" ? true : input.grappleProficient === "false" ? false : input.grappleProficient,
    grappleSizeDifference:
      typeof input.grappleSizeDifference === "string" && input.grappleSizeDifference.trim()
        ? Number(input.grappleSizeDifference)
        : input.grappleSizeDifference,
    distanceFeet:
      typeof input.distanceFeet === "string"
        ? input.distanceFeet.trim()
          ? Number(input.distanceFeet)
          : null
        : input.distanceFeet
  };
  const [skillKey, chosenCheck] = typeof input.key === "string" ? input.key.split("/") : [],
    skill = SKILLS.find(entry => entry.key === skillKey);
  if (!skill) return refuse(loc`Choose a skill.`);
  if (input.key.split("/").length > 2) throw Error(loc`Choose one listed skill and named check.`);
  const namedCheck = context.drainedRecovery
    ? drainedRecoveryCheck(context.drainedRecovery)
    : context.combatPersuasion
      ? skill.checks.find(c => c.id === "persuasion")
      : chosenCheck
        ? npcNamedChecks(skill, actor.system).find(c => c.id === chosenCheck)
        : input.dispositionTargetUuid
          ? null
          : (npcNamedChecks(skill, actor.system)[0] ?? null);
  if ((chosenCheck && !namedCheck) || (context.combatPersuasion && chosenCheck && chosenCheck !== "persuasion"))
    throw Error(loc`Choose a valid named check for this skill and combat attempt.`);
  if (context.combatPersuasion && (skill.key !== "impress" || (input.ability && input.ability !== "cha")))
    return refuse(loc`Combat persuasion requires Impress/Persuasion with Charisma.`);
  if (context.drainedRecovery && (skill.key !== "resolve" || input.ability !== "wis"))
    throw Error(loc`Use the reserved Resolve (Wis) recovery check.`);
  if (
    actor.system.npcType === "animal" &&
    graded &&
    !actor.system.npcBuild?.skills?.some(entry => entry.key === skill.key)
  )
    ui.notifications.info(loc`Animals have no Competence: only their listed skills carry a bonus (p.445).`);
  if (actor.system.npcType === "animal" && namedCheck && !animalMayMake(skill.key, namedCheck.id))
    ui.notifications.warn(loc`Review this animal’s training before using the selected check (p.445).`);
  const plan = graded
    ? npcSkillPlan(actor, skill.key)
    : { bonus: Number(input.manualBonus) || 0, cap: stepLookup(TABLES.skillCap, Number(input.manualBonus) || 0) };
  if (campaignSkillPolicy(actor.system)?.uncapped) plan.cap = null;
  const ability = context.combatPersuasion
    ? "cha"
    : skill.abilities.includes(input.ability) || Object.hasOwn(CONFIG.SPYCRAFT.abilities, input.ability)
      ? input.ability
      : (namedCheck?.attributes[0] ?? skill.abilities[0]);
  const actionPlan = () =>
      npcSkillActionPlan(actor.system, skill.key, namedCheck, ability, input, {
        preserveMode: !!context.drainedRecovery
      }),
    action = actionPlan(),
    sourceSnapshot = action.restraint.escape ? restraintSourceSnapshot(actor) : null,
    originalSkill = graded ? npcSkillPlan(actor, skill.key) : null;
  if (action.blockedReason) throw Error(action.blockedReason);
  const cooperative =
    input.cooperative ??
    cooperativeInput({ ...input, check: namedCheck?.id ?? "" }, { actor, key: skill.key })?.cooperative ??
    null;
  if (plan.cap !== null) plan.cap = Math.max(0, plan.cap + action.capAdjustment);
  if (action.rollMode === "blindroll" && !game.user.isGM)
    throw Error(loc`The GC rolls this passive or secret NPC check.`);
  if (sourceSnapshot?.sources.length > 1 && input.grappleAllSourcesConfirmed !== true)
    throw Error(loc`Confirm that all current restraint sources belong to this same grapple before rolling.`);
  // Qualities: Fearless, Meek and Strong-Minded by the kind of check, the rest by the boxes ticked.
  const quality = npcSkillQualityPlan(actor.system.qualityEffects ?? { skillOptions: [] }, {
    riderCharisma: Number(input.riderCharisma) || 0,
    skillKey: skill.key,
    checkId: namedCheck?.id ?? input.qualityCheck ?? "",
    chosen: Object.keys(input)
      .filter(key => key.startsWith("quality-") && input[key] === true)
      .map(key => key.slice("quality-".length))
  });
  // Feat items on the NPC that add a plain number to this skill.
  const featBonus = skillPenaltyValue(
    actor.system,
    Math.trunc(Number(actor.system.featEffects?.skills?.[skill.key]) || 0)
  );
  if (plan.cap !== null) plan.cap += quality.capBonus ?? 0;
  const rawQualityRows = quality.rows;
  quality.rows = skillPenaltyEntries(actor.system, rawQualityRows);
  quality.modifier = quality.rows.reduce((n, row) => n + row.value, 0);
  if (featBonus) quality.rows.push({ label: loc`Feats`, value: featBonus });
  if (input.surprise === true && !["blend", "sneak"].includes(skill.key))
    throw Error(loc`Choose Blend/Stealth or Sneak/Hide for the confirmed surprise check.`);
  if (
    input.surprise === true &&
    namedCheck &&
    !((skill.key === "blend" && namedCheck.id === "stealth") || (skill.key === "sneak" && namedCheck.id === "hide"))
  )
    throw Error(loc`The selected named check does not determine surprise with Blend/Stealth or Sneak/Hide.`);
  const checkId =
      namedCheck?.id ??
      (context.combatPersuasion
        ? "persuasion"
        : input.surprise === true
          ? skill.key === "blend"
            ? "stealth"
            : "hide"
          : (input.qualityCheck ?? "")),
    targetContext = () =>
      dispositionSkillContext({ ...input, combatPersuasion: context.combatPersuasion }, skill.key, actor)
        .dispositionTarget,
    disposition = dispositionSkillPlan(actor.system, skill.key, namedCheck ?? { id: checkId }, targetContext()),
    campaignChecks = campaignSkillChecks(actor.system, skill.key, { id: checkId }, input),
    shakenPenalty = shakenSkillPenalty(actor.system, ability),
    campaignModifier = campaignChecks.bonuses.filter(row => row.value > 0).reduce((n, row) => n + row.value, 0),
    moralePenalty = skillPenaltyValue(actor.system, moraleSkillPenalty(campaignChecks.bonuses, shakenPenalty));
  if (disposition.blockedReason) throw Error(disposition.blockedReason);
  quality.rows.push(
    ...campaignChecks.bonuses.filter(row => row.value > 0).map(row => ({ label: row.source, value: row.value }))
  );
  if (moralePenalty) quality.rows.push({ label: loc`Morale penalty (strongest applies)`, value: moralePenalty });
  if (disposition.bonus || disposition.penalty)
    quality.rows.push({
      label: loc`Target disposition`,
      value: disposition.bonus + skillPenaltyValue(actor.system, disposition.penalty)
    });
  const abilityModifier = skillPenaltyValue(actor.system, actor.system.abilities[ability]?.mod ?? 0),
    situationalModifier = skillPenaltyValue(actor.system, Number(input.modifier) || 0);
  const namedPenaltyRows = () => [
      ...((namedCheck?.tags ?? "").includes("Armor Check Penalty")
        ? [
            {
              label: loc`Armor/encumbrance check penalty`,
              value: Math.min(0, actor.system.armor?.check ?? 0, actor.system.encumbrance?.check ?? 0)
            }
          ]
        : []),
      ...((namedCheck?.tags ?? "").includes("Vision")
        ? [{ label: loc`Armor vision penalty`, value: actor.system.armor?.visionCheck ?? 0 }]
        : [])
    ],
    namedPenalties = namedPenaltyRows(),
    adjustedNamedPenalties = skillPenaltyEntries(actor.system, namedPenalties),
    namedPenalty = adjustedNamedPenalties.reduce((n, row) => n + row.value, 0);
  const grapplePlan = () =>
      grappleCheckPlan(actor.system, skill.key, action.restraint.check, {
        ...input,
        grappleConversionWeapon: actor.items?.get?.(input.grappleConversionWeaponId)
      }),
    grapple = grapplePlan(),
    grappleRows = skillPenaltyEntries(
      actor.system,
      grapple.bonuses.map(row => ({ label: row.source, value: row.value }))
    ),
    grappleModifier = grappleRows.reduce((n, row) => n + row.value, 0);
  if (grapple.blockedReason) throw Error(grapple.blockedReason);
  const conditionRows = skillPenaltyEntries(actor.system, action.penalties).filter(row => row.value),
    conditionModifier = conditionRows.reduce((n, row) => n + row.value, 0);
  quality.rows.push(...grappleRows, ...adjustedNamedPenalties, ...conditionRows);
  if (action.restraint.sizeBonus) quality.rows.push({ label: loc`Size (Grapple)`, value: action.restraint.sizeBonus });
  plan.bonus = skillPenaltyValue(actor.system, plan.bonus);
  const penaltyNote = skillPenaltyNotes(actor.system, [
    ...rawQualityRows,
    { label: loc`Attribute modifier`, value: actor.system.abilities[ability]?.mod ?? 0 },
    { label: loc`Situational modifier`, value: Number(input.modifier) || 0 },
    { label: loc`Morale penalty`, value: moraleSkillPenalty(campaignChecks.bonuses, shakenPenalty) },
    { label: loc`Target disposition`, value: disposition.penalty },
    ...namedPenalties,
    ...action.penalties
  ]);
  const total =
    plan.bonus +
    abilityModifier +
    situationalModifier +
    quality.modifier +
    featBonus +
    campaignModifier +
    moralePenalty +
    disposition.bonus +
    skillPenaltyValue(actor.system, disposition.penalty) +
    grappleModifier +
    namedPenalty +
    conditionModifier +
    action.restraint.sizeBonus;
  const campaignError = campaignSkillPlan(
    actor.system,
    skill.key,
    namedCheck ?? { attributes: [ability] },
    { ability },
    actor.system.campaignEffects ?? campaignRules()
  ).errorIncrease;
  const checkError =
      (input.error == null || input.error === "" ? (namedCheck?.error ?? 1) : Math.max(0, Number(input.error) || 0)) +
      quality.errorIncrease +
      disposition.errorIncrease +
      action.restraint.errorIncrease +
      campaignError,
    recoveryPlan = context.drainedRecovery
      ? drainedNpcCheckOptions(actor.system, context.drainedRecovery, input, checkError)
      : null;
  return actor.rollCheck(
    recoveryPlan?.fixedDie ? `${recoveryPlan.fixedDie} + @total` : "1d20 + @total",
    { total },
    {
      // Players see the card too: the NPC's bonus, cap and modifiers are printed only on a roll kept to the GC.
      flavor:
        (input.secret
          ? loc`${skill.name} (${ability.toUpperCase()}) — NPC bonus ${signed(plan.bonus)}, result cap ${plan.cap ?? loc`No cap`}`
          : loc`${skill.name} (${ability.toUpperCase()})`) +
        (namedCheck ? ` / ${esc(namedCheck.name)}` : "") +
        (action.restraint.escape || action.restraint.grapple
          ? ` — ${action.restraint.timeLocked ? 2 : 1} ${loc`full action(s)`}`
          : "") +
        (input.secret && disposition.evidence ? `<br><small>${esc(disposition.notes.join(" "))}</small>` : "") +
        (input.secret && (quality.rows.length || quality.errorIncrease)
          ? `<br><small>${esc([...quality.rows.map(row => `${row.label} ${signed(row.value)}`), ...(quality.errorIncrease ? [loc`error range +${quality.errorIncrease}`] : [])].join("; "))}</small>`
          : "") +
        (input.secret && penaltyNote ? `<br><small>${esc(penaltyNote)}</small>` : ""),
      ability,
      // The card shows these parts only to someone who may open the NPC (module/rolls/chat-breakdown.mjs).
      breakdown: breakdownRows(
        [
          { label: loc`Skill bonus`, value: plan.bonus, keep: true },
          { label: ability.toUpperCase(), value: abilityModifier, keep: true },
          { label: loc`Situational modifier`, value: situationalModifier },
          ...quality.rows
        ],
        total
      ),
      cap: plan.cap,
      checkMethod: "roll",
      actionDiceAllowed: action.actionDiceAllowed,
      ...(action.skillTiming ? { skillTiming: action.skillTiming } : {}),
      error: checkError,
      ...(recoveryPlan
        ? { ...recoveryPlan, difficultyClass: context.difficultyClass, drainedRecovery: context.drainedRecovery }
        : {}),
      ...(disposition.threatIncrease || grapple.threatIncrease
        ? { threat: Math.max(1, 20 - disposition.threatIncrease - grapple.threatIncrease) }
        : {}),
      npcSkill: skill.key,
      checkKind: "skill",
      skillKey: skill.key,
      ...(checkId ? { checkId } : {}),
      campaignSkillChecks: campaignChecks.evidence,
      dispositionSkill: disposition.evidence,
      grappleFeats: grapple.evidence,
      cooperative,
      npcSkillContext: action.evidence,
      skillTags: action.tags,
      sensoryConditions: action.senses,
      restraintEscape: action.restraint.escape
        ? {
            condition: action.restraint.state,
            kind: "opposedGrapple",
            fullActions: action.restraint.timeLocked ? 2 : 1,
            armorCheckPenalty: true,
            grasp: true,
            proficient: action.restraint.proficient,
            sizeDifference: action.restraint.sizeDifference,
            sizeBonus: action.restraint.sizeBonus,
            timeLocked: action.restraint.timeLocked,
            sourceSnapshot,
            sourceScopeConfirmed: sourceSnapshot.sources.length === 1 || input.grappleAllSourcesConfirmed === true
          }
        : null,
      validateSkillContext: () => {
        if (
          JSON.stringify(actionPlan()) !== JSON.stringify(action) ||
          (sourceSnapshot && JSON.stringify(restraintSourceSnapshot(actor)) !== JSON.stringify(sourceSnapshot)) ||
          (graded && JSON.stringify(npcSkillPlan(actor, skill.key)) !== JSON.stringify(originalSkill))
        )
          throw Error(
            loc`The NPC's check category, conditions, skill bonus or grapple sources changed before posting.`
          );
        if (JSON.stringify(namedPenaltyRows()) !== JSON.stringify(namedPenalties))
          throw Error(loc`The NPC's armor or encumbrance changed before posting this named skill check.`);
        if (JSON.stringify(grapplePlan()) !== JSON.stringify(grapple))
          throw Error(loc`Grapple benefits or the actual conversion weapon changed before posting this NPC check.`);
        if (
          context.drainedRecovery &&
          JSON.stringify(drainedNpcCheckOptions(actor.system, context.drainedRecovery, input, checkError)) !==
            JSON.stringify(recoveryPlan)
        )
          throw Error(loc`The recovery method, conditions or campaign rules changed. Review the original attempt.`);
        const live = campaignSkillChecks(actor.system, skill.key, { id: checkId }, input);
        if (
          JSON.stringify(live.evidence) !== JSON.stringify(campaignChecks.evidence) ||
          shakenSkillPenalty(actor.system, ability) !== shakenPenalty ||
          (namedCheck?.optionalRule && !npcNamedChecks(skill, actor.system).some(c => c.id === namedCheck.id)) ||
          JSON.stringify(
            dispositionSkillPlan(actor.system, skill.key, namedCheck ?? { id: checkId }, targetContext()).evidence
          ) !== JSON.stringify(disposition.evidence)
        )
          throw Error(
            loc`The named check, campaign modifiers, Shaken or target disposition changed before posting this NPC skill check.`
          );
      },
      ...(context.combatPersuasion
        ? {
            checkKind: "skill",
            skillKey: "impress",
            checkId: "persuasion",
            combatPersuasion: context.combatPersuasion,
            campaignSkillDCPolicy: campaignSkillDCPolicy(actor.system.campaignEffects)
          }
        : {}),
      ...(action.rollMode ? { rollMode: action.rollMode } : input.secret ? { rollMode: "gmroll" } : {})
    }
  );
}

/** The same save, from a sheet or the console, leaving an Undo note for what it changed. */
export async function npcDamageSaveWithUndo(actor, input = null) {
  // The dialog is answered before the "before" picture is taken, so Undo does not also take back whatever else
  // changed while it was open (an Initiative roll, a new condition).
  if (
    !input &&
    actor?.isOwner &&
    game.user?.isGM &&
    !npcIsSpecial(actor) &&
    damageSaveState(actor).track.state === "active"
  ) {
    input = await askNpcDamageSaveInput(actor);
    if (!input) return null;
  }
  return withUndo([actor], loc`Damage save: ${actor?.name ?? ""}`, () => npcDamageSave(actor, input));
}

export async function resetDamageTrack(actor, { heal = null } = {}) {
  if (!actor.isOwner) return null;
  const state = damageSaveState(actor);
  const track = heal === null ? { ...currentDamageTrack(null, sceneEpoch()) } : healDamageTrack(state.track, heal);
  await actor.update({ "system.damageTrack": track });
  if (track.state === "active")
    // Clear only the defeat a failed Damage save set; a defeat the GC marked by hand stays.
    for (const combat of game.combats ?? [])
      for (const combatant of combat.combatants ?? [])
        if (combatant.actor === actor && combatant.defeated && combatant.flags?.spycraft2?.defeatedByDamageSave)
          await combatant.update({ defeated: false, "flags.spycraft2.-=defeatedByDamageSave": null });
  if (heal === null)
    for (const id of ["dead", "unconscious"])
      if (actor.statuses?.has(id)) {
        try {
          await actor.toggleStatusEffect(id, { active: false });
        } catch {
          /* supplied by another source */
        }
      }
  return track;
}

const dispositionRecord = actor => actor.system.disposition ?? { base: "neutral", toward: {} };
const isVillain = actor => {
  const profile = spendProfile(actor);
  return actor.system.npcType === "villain" || ["minion", "henchman", "mastermind"].includes(profile.role);
};

export function dispositionRows(actor) {
  const record = dispositionRecord(actor);
  return Object.entries(record.toward ?? {}).map(([id, entry]) => ({
    id,
    name: game.actors.get(id)?.name ?? id,
    grade: dispositionGrade(entry.grade).name
  }));
}

/** Set, shift or roll against an NPC's disposition toward a character (or its general attitude). */
export async function manageDisposition(actor) {
  if (!game.user.isGM) return refuse(loc`The GC manages NPC dispositions.`);
  if (isVillain(actor)) return manageSceneDisposition(actor);
  const record = dispositionRecord(actor),
    villain = isVillain(actor),
    mission = String(actor.system.usagePeriods?.mission ?? "initial");
  const targets = [
    ["", `Everyone not listed (${dispositionGrade(record.base).name})`],
    ...teamActors(getMission()).map(agent => [
      agent.id,
      `${agent.name} (${dispositionGrade(dispositionToward(record, agent.id)).name})`
    ])
  ];
  const D = GC_DATA.core.disposition;
  const input = await ask(
    loc`${actor.name}: disposition`,
    `
    ${villain ? `<p class="hint">${loc`Villains use temporary skill-check effects for disposition shifts (p.458). This grade record does not apply those scene effects.`}</p>` : ""}
    <p>${loc`No NPC shifts more than ${D.maxShiftPerMission} grades either way in one mission. Intimacy checks: ${esc(D.intimacyChecks.join(", "))}. Fondness checks: ${esc(D.fondnessChecks.join(", "))}.`}</p>
    <label>${loc`Toward`} <select name="target">${options(targets, "")}</select></label>
    <label>${loc`Action`} <select name="action">${options(
      [
        ["show", loc`Show check modifiers`],
        ["shift", loc`Shift by grades`],
        ["set", loc`Set a grade (GC ruling)`],
        ["loyalty", loc`Roll a Loyalty decision`],
        ["combat", loc`Roll whether the NPC joins a fight`],
        ["persuade", loc`A side tries to talk the NPC into the fight (once per combat)`]
      ],
      "show"
    )}</select></label>
    <label data-when="action=shift">${loc`Shift (positive is friendlier)`} <input type="number" name="steps" value="1" /></label>
    <label data-when="action=shift"><input type="checkbox" name="automatic" /> ${loc`The shift comes from an ability that shifts disposition automatically (once per mission)`}</label>
    <label data-when="action=set">${loc`Grade to set`} <select name="grade">${options(
      DISPOSITIONS.map(grade => [grade.id, grade.name]),
      "neutral"
    )}</select></label>
    <label data-when="action=persuade">${loc`That side's Impress/Persuasion result (standard or cooperative)`} <input type="number" name="persuasion" min="0" /></label>
    <label data-when="action=persuade"><input type="checkbox" name="triumph" /> ${loc`The check was a Triumph (an Adversarial NPC needs one)`}</label>
    <label data-when="action=loyalty|combat">${loc`Foil decision modifier (−5 to +5)`} <input type="number" name="foil" min="-5" max="5" value="0" /></label>`,
    loc`Apply`,
    // Refused inside the dialog, so the target and the figures typed stay.
    values => {
      if (values.action === "shift" && !(Number.isInteger(Number(values.steps)) && Number(values.steps) !== 0))
        return loc`Enter a whole number of grades to shift, other than 0.`;
      if (["loyalty", "combat"].includes(values.action)) {
        const foil = Number(values.foil);
        if (!Number.isInteger(foil) || foil < -5 || foil > 5) return loc`The Foil modifier runs from −5 to +5.`;
      }
      if (values.action === "persuade") {
        const side = values.target || "",
          plan = persuadeJoinPlan(actor.flags?.spycraft2?.persuadedJoin ?? null, {
            combatId: game.combat?.started ? game.combat.id : "",
            side,
            gradeId: side ? dispositionToward(record, side) : record.base,
            result: values.persuasion === "" || values.persuasion === null ? NaN : Number(values.persuasion),
            triumph: values.triumph === true
          });
        if (!plan.allowed) return plan.reason;
      }
      return null;
    }
  );
  if (!input) return null;
  const targetId = input.target || "",
    gradeNow = targetId ? dispositionToward(record, targetId) : record.base,
    name = targetId ? (game.actors.get(targetId)?.name ?? targetId) : "everyone else";
  try {
    if (input.action === "persuade") {
      if (villain) return refuse(loc`Villains ignore combat disposition effects.`);
      return await manageCombatPersuasion(actor, {
        targetId,
        roll: (persuader, combatPersuasion) =>
          persuader.type === "npc"
            ? rollNpcSkill(persuader, null, { combatPersuasion })
            : persuader.rollSkill("impress", "cha", { initialCheck: "persuasion", combatPersuasion })
      });
    }
    if (input.action === "set" || input.action === "shift") {
      let next;
      if (input.action === "set") next = { grade: input.grade, entry: { grade: input.grade, mission, shifted: 0 } };
      else
        next = shiftDisposition(
          targetId ? record : { base: record.base, toward: { "": record.baseEntry ?? { grade: record.base } } },
          targetId,
          Number(input.steps),
          { mission, automatic: !!input.automatic, villain }
        );
      const update = targetId
        ? { [`system.disposition.toward.${targetId}`]: next.entry, "system.disposition.base": record.base }
        : { "system.disposition.base": next.grade, "system.disposition.baseEntry": next.entry };
      await actor.update(update);
      return say(
        actor,
        `${loc`${esc(actor.name)} is now`} <b>${esc(dispositionGrade(next.grade).name)}</b> ${loc`toward ${esc(name)}${next.limited ? loc` (limited to 2 grades per mission)` : ""}.`}`,
        { whisper: true }
      );
    }
    if (input.action === "loyalty") {
      const roll = await new Roll("1d20").evaluate(),
        result = loyaltyDecision([{ id: targetId || "them", grade: gradeNow }], [roll.total], {
          foil: Number(input.foil) || 0
        });
      const step = result.steps[0];
      return roll.toMessage(
        {
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: loc`Loyalty (${esc(dispositionGrade(gradeNow).name)} toward ${esc(name)}): ${step.total} against ${step.target} — ${step.success ? loc`sides with them` : loc`sides against them`}.`
        },
        messageModeOption("gmroll")
      );
    }
    if (input.action === "persuade") {
      const combatId = game.combat?.started ? game.combat.id : "";
      const plan = persuadeJoinPlan(actor.flags?.spycraft2?.persuadedJoin ?? null, {
        combatId,
        side: targetId,
        gradeId: gradeNow,
        result: input.persuasion === "" || input.persuasion === null ? NaN : Number(input.persuasion),
        triumph: input.triumph === true
      });
      if (!plan.allowed) return refuse(plan.reason);
      // An Undo note gives the attempt back if the GC recorded the wrong result or side.
      await withUndo([actor], loc`Persuade to join: ${actor.name}`, () =>
        actor.setFlag("spycraft2", "persuadedJoin", plan.record)
      );
      const against = plan.needsTriumph ? loc`a Triumph` : loc`DC ${plan.dc}`;
      return say(
        actor,
        plan.success
          ? loc`${esc(actor.name)} (${esc(dispositionGrade(gradeNow).name)} toward ${esc(name)}) is won over against ${against} and joins ${esc(name)}'s side for this fight. No other side may try (p.458).`
          : loc`${esc(actor.name)} (${esc(dispositionGrade(gradeNow).name)} toward ${esc(name)}) is not won over against ${against}. That side cannot try again this fight (p.458).`,
        { whisper: true }
      );
    }
    if (input.action === "combat") {
      const roll = await new Roll("1d20").evaluate(),
        result = joinsCombat(gradeNow, roll.total, { foil: Number(input.foil) || 0 });
      return roll.toMessage(
        {
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: loc`Joins the fight? (${esc(dispositionGrade(gradeNow).name)} toward ${esc(name)}): ${result.total} against ${result.target} — ${result.joins ? (result.hostile ? loc`enters the fight against them` : loc`enters the fight on their side`) : loc`stays out`}. A side may instead try Impress/Persuasion once per combat (DC ${dispositionGrade(gradeNow).joinDC ?? loc`Triumph only`}).`
        },
        messageModeOption("gmroll")
      );
    }
    const intimacy = dispositionCheckModifier(gradeNow, D.intimacyChecks[0], { villain }),
      fondness = dispositionCheckModifier(gradeNow, D.fondnessChecks[0], { villain }),
      grade = dispositionGrade(gradeNow);
    return say(
      actor,
      `<b>${esc(actor.name)}</b> ${loc`is ${esc(grade.name)} toward ${esc(name)}.`}<br>${loc`Intimacy checks ${signed(intimacy.modifier)}${intimacy.error ? `, error range +${intimacy.error}` : ""}.`}<br>${loc`Fondness checks ${signed(fondness.modifier)}${fondness.threat ? `, threat range +${fondness.threat}` : ""}${fondness.error ? `, error range +${fondness.error}` : ""}.`}<br>${loc`Loyalty ${grade.loyalty}; joins combat on ${grade.joinRoll} or less; time for Disposition-tagged checks ×${grade.priority}.`}`,
      { whisper: true }
    );
  } catch (error) {
    return refuse(error.message);
  }
}
