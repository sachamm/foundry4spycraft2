/** Running NPCs at the table: skill checks, standard-NPC Damage saves and disposition (pp.331–332, 452, 457–458). */
import { withUndo } from "../undo.mjs";
import { esc } from "../../html.mjs";
import { refuse } from "../../error-notices.mjs";
import { messageModeOption } from "../../rolls/message-mode.mjs";
import { TABLES, SKILLS } from "../../rules/tables.mjs";
import { stepLookup } from "../../rules/formula.mjs";
import { currentDamageTrack, resolveDamageSave, healDamageTrack, damageSaveDC } from "../../rules/gc/npc-damage.mjs";
import {
  DISPOSITIONS,
  dispositionGrade,
  dispositionToward,
  shiftDisposition,
  loyaltyDecision,
  joinsCombat,
  dispositionCheckModifier
} from "../../rules/gc/disposition.mjs";
import { npcSpendProfile } from "../../rules/gc/gc-spend.mjs";
import { npcSkillQualityPlan } from "../../rules/npc-qualities.mjs";
import { campaignSkillChecks, moraleSkillPenalty } from "../../rules/campaign-skills.mjs";
import { shakenSkillPenalty } from "../../rules/shaken.mjs";
import { GC_DATA } from "../../rules/gc-tables.mjs";
import { sceneEpoch, getMission, teamActors } from "./state.mjs";
import { loc } from "../../i18n.mjs";
import { breakdownRows } from "../../rules/bonus-breakdown.mjs";
import { formDialog, raw } from "../dialog-kit.mjs";
import { manageCombatPersuasion } from "./combat-persuasion.mjs";
import { campaignSkillDCPolicy } from "../../rules/campaign-skill-dc.mjs";
import { campaignStressPolicy, campaignStressDamage } from "../../rules/campaign-combat.mjs";

const ask = (title, content, ok) => formDialog({ title, ok, fields: [raw(content)] });
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

/** Whether this NPC currently counts as special: by type, or promoted for the current mission (p.398). */
export function npcIsSpecial(actor) {
  const system = actor.system;
  return ["special", "villain"].includes(system.npcType) || isPromoted(actor);
}
export const isPromoted = actor =>
  !!actor.system.promotion &&
  actor.system.promotion.mission === String(actor.system.usagePeriods?.mission ?? "initial");
export const spendProfile = actor =>
  npcSpendProfile({
    type: actor.system.npcType,
    qualities: actor.system.npcProfile?.enabled
      ? (actor.system.npcProfile.qualities ?? [])
      : actor.system.manualRole
        ? [{ id: actor.system.manualRole }]
        : [],
    promoted: isPromoted(actor)
  });

/** p.452: an NPC's skill bonus is the higher of Competence and its skilled bonus; that number is also its ranks for result caps. */
export function npcSkillPlan(actor, key) {
  const system = actor.system,
    listed = system.npcBuild?.skills?.find(skill => skill.key === key);
  const bonus = listed?.bonus ?? system.competence ?? 0;
  return { key, bonus, listed: !!listed, cap: stepLookup(TABLES.skillCap, bonus) };
}

/** The part of the NPC skill check dialog that comes from its qualities. */
export function qualityCheckContent(effects) {
  if (!effects) return "";
  const kinds = [
    ...(effects.moraleModifier
      ? [["morale", loc`Resolve/Morale (${signed(effects.moraleModifier)} from qualities)`]]
      : []),
    ...(effects.resistModifier
      ? [
          ["resist-impress", loc`Resolve/Resist Impress (${signed(effects.resistModifier)})`],
          ["resist-intimidate", loc`Resolve/Resist Intimidate (${signed(effects.resistModifier)})`],
          ["resist-manipulate", loc`Sense Motive/Resist Manipulate (${signed(effects.resistModifier)})`]
        ]
      : [])
  ];
  const boxes = effects.skillOptions
    .map(option => `<label><input type="checkbox" name="quality-${esc(option.id)}" /> ${esc(option.label)}</label>`)
    .join("");
  if (!kinds.length && !boxes) return "";
  return `<fieldset><legend>${loc`Qualities`}</legend>${
    kinds.length
      ? `<label>${loc`This check is`} <select name="qualityCheck">${options([["", loc`another check`], ...kinds], "")}</select></label>`
      : ""
  }${boxes}</fieldset>`;
}

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
      <label>${loc`Skill`} <select name="key">${options(skillRows)}</select></label>
      <label>${loc`Attribute`} <select name="ability">${options([["", loc`First listed for the skill`], ...abilityRows], "")}</select></label>
      ${graded ? "" : `<label>${loc`Skill bonus (manual stat block)`} <input type="number" name="manualBonus" value="0" /></label>`}
      <label>${loc`Situational modifier`} <input type="number" name="modifier" value="0" /></label>
      <label>${loc`Error range`} <input type="number" name="error" min="0" max="19" value="1" /></label>
      ${qualityCheckContent(actor.system.qualityEffects)}
      ${actor.system.campaignEffects?.socialCheckMorale ? `<label><input type="checkbox" name="surprise" /> ${loc`Paranoid: Blend/Stealth or Sneak/Hide to determine surprise`}</label><label><input type="checkbox" name="shiftingDisposition" /> ${loc`Paranoid: this check shifts a target's disposition`}</label><label><input type="checkbox" name="persuadingAction" /> ${loc`Paranoid: this check persuades a target to take an action`}</label>` : ""}
      <label><input type="checkbox" name="secret" /> ${loc`Secret (GC only)`}</label>`,
      loc`Roll`
    );
    if (!input) return null;
  }
  const skill = SKILLS.find(entry => entry.key === input.key);
  if (!skill) return refuse(loc`Choose a skill.`);
  if (context.combatPersuasion && (skill.key !== "impress" || (input.ability && input.ability !== "cha")))
    return refuse(loc`Combat persuasion requires Impress/Persuasion with Charisma.`);
  if (
    actor.system.npcType === "animal" &&
    graded &&
    !actor.system.npcBuild?.skills?.some(entry => entry.key === skill.key)
  )
    ui.notifications.info(loc`Animals have no Competence: only their listed skills carry a bonus (p.445).`);
  const plan = graded
    ? npcSkillPlan(actor, skill.key)
    : { bonus: Number(input.manualBonus) || 0, cap: stepLookup(TABLES.skillCap, Number(input.manualBonus) || 0) };
  const ability = context.combatPersuasion
    ? "cha"
    : skill.abilities.includes(input.ability) || Object.hasOwn(CONFIG.SPYCRAFT.abilities, input.ability)
      ? input.ability
      : skill.abilities[0];
  // Qualities: Fearless, Meek and Strong-Minded by the kind of check, the rest by the boxes ticked.
  const quality = npcSkillQualityPlan(actor.system.qualityEffects ?? { skillOptions: [] }, {
    skillKey: skill.key,
    checkId: input.qualityCheck ?? "",
    chosen: Object.keys(input)
      .filter(key => key.startsWith("quality-") && input[key] === true)
      .map(key => key.slice("quality-".length))
  });
  // Feat items on the NPC that add a plain number to this skill.
  const featBonus = Math.trunc(Number(actor.system.featEffects?.skills?.[skill.key]) || 0);
  if (featBonus) quality.rows.push({ label: loc`Feats`, value: featBonus });
  if (input.surprise === true && !["blend", "sneak"].includes(skill.key))
    throw Error(loc`Choose Blend/Stealth or Sneak/Hide for the confirmed surprise check.`);
  const checkId = context.combatPersuasion
      ? "persuasion"
      : input.surprise === true
        ? skill.key === "blend"
          ? "stealth"
          : "hide"
        : (input.qualityCheck ?? ""),
    campaignChecks = campaignSkillChecks(actor.system, skill.key, { id: checkId }, input),
    shakenPenalty = shakenSkillPenalty(actor.system, ability),
    campaignModifier = campaignChecks.bonuses.filter(row => row.value > 0).reduce((n, row) => n + row.value, 0),
    moralePenalty = moraleSkillPenalty(campaignChecks.bonuses, shakenPenalty);
  quality.rows.push(
    ...campaignChecks.bonuses.filter(row => row.value > 0).map(row => ({ label: row.source, value: row.value }))
  );
  if (moralePenalty) quality.rows.push({ label: loc`Morale penalty (strongest applies)`, value: moralePenalty });
  const total =
    plan.bonus +
    (actor.system.abilities[ability]?.mod ?? 0) +
    (Number(input.modifier) || 0) +
    quality.modifier +
    featBonus +
    campaignModifier +
    moralePenalty;
  return actor.rollCheck(
    "1d20 + @total",
    { total },
    {
      // Players see the card too: the NPC's bonus, cap and modifiers are printed only on a roll kept to the GC.
      flavor:
        (input.secret
          ? loc`${skill.name} (${ability.toUpperCase()}) — NPC bonus ${signed(plan.bonus)}, result cap ${plan.cap}`
          : loc`${skill.name} (${ability.toUpperCase()})`) +
        (input.secret && (quality.rows.length || quality.errorIncrease)
          ? `<br><small>${esc([...quality.rows.map(row => `${row.label} ${signed(row.value)}`), ...(quality.errorIncrease ? [loc`error range +${quality.errorIncrease}`] : [])].join("; "))}</small>`
          : ""),
      ability,
      // The card shows these parts only to someone who may open the NPC (module/rolls/chat-breakdown.mjs).
      breakdown: breakdownRows(
        [
          { label: loc`Skill bonus`, value: plan.bonus, keep: true },
          { label: ability.toUpperCase(), value: actor.system.abilities[ability]?.mod, keep: true },
          { label: loc`Situational modifier`, value: Number(input.modifier) || 0 },
          ...quality.rows
        ],
        total
      ),
      cap: plan.cap,
      error: Math.max(0, Number(input.error) || 0) + quality.errorIncrease,
      npcSkill: skill.key,
      checkKind: "skill",
      skillKey: skill.key,
      ...(checkId ? { checkId } : {}),
      campaignSkillChecks: campaignChecks.evidence,
      validateSkillContext: () => {
        const live = campaignSkillChecks(actor.system, skill.key, { id: checkId }, input);
        if (
          JSON.stringify(live.evidence) !== JSON.stringify(campaignChecks.evidence) ||
          shakenSkillPenalty(actor.system, ability) !== shakenPenalty
        )
          throw Error(loc`The campaign modifiers or Shaken changed before posting this NPC skill check.`);
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
      ...(input.secret ? { rollMode: "gmroll" } : {})
    }
  );
}

const toughGrades = actor => spendProfile(actor).tough;
export function damageSaveState(actor) {
  const system = actor.system,
    track = currentDamageTrack(system.damageTrack, sceneEpoch());
  const bonus =
    (Number.isFinite(system.damageSave) ? system.damageSave : 0) +
    (system.damageSaveAdjust ?? 0) +
    (system.featEffects?.damageSaveHealth?.applied ?? 0);
  return {
    track,
    bonus,
    tough: toughGrades(actor),
    nextDC: damageSaveDC(track.accumulated),
    applies: !npcIsSpecial(actor)
  };
}

/** Roll a standard NPC's Damage save for one injury and record the result. */
export async function npcDamageSave(actor, input = null) {
  if (!actor.isOwner) return null;
  if (npcIsSpecial(actor))
    return refuse(
      loc`Special NPCs lose vitality and wounds like player characters; Damage saves are for standard NPCs and animals (p.452).`
    );
  const state = damageSaveState(actor);
  if (state.track.state !== "active")
    return refuse(
      loc`${actor.name} is already ${state.track.state}. Reset the Damage save track to bring the NPC back.`
    );
  if (!input) {
    input = await ask(
      loc`${actor.name}: Damage save`,
      `
      <p>${loc`DC 10 + half of all damage suffered this scene (now ${state.track.accumulated}). Save bonus ${signed(state.bonus)}${state.tough ? loc`; tough ${state.tough} (ignored so far: ${state.track.ignored})` : ""}. Enter damage after Damage Reduction.`}</p>
      <label>${loc`Damage suffered`} <input type="number" name="damage" min="1" value="1" required /></label>
      <label>${loc`Type`} <select name="kind">${options(
        [
          ["lethal", loc`Lethal`],
          ["subdual", loc`Subdual`],
          ["stress", loc`Stress`]
        ],
        "lethal"
      )}</select></label>
      ${campaignStressPolicy(actor.system.campaignEffects) ? `<label><input type="checkbox" name="campaignStressAdjusted" /> ${loc`Entered stress already includes campaign multipliers (leave unchecked for raw stress)`}</label>` : ""}<label><input type="checkbox" name="blast" /> ${loc`The damage has a blast increment (+1 failed save per 10 the save misses by)`}</label>
      <label>${loc`Action dice spent to activate a critical hit (each is an automatic failed save)`} <input type="number" name="criticalDice" min="0" value="0" /></label>
      <label>${loc`Save bonus`} <input type="number" name="bonus" value="${state.bonus}" /></label>`,
      loc`Roll Damage save`
    );
    if (!input) return null;
  }
  // The card's large number is the save's total, the one compared with the DC; the die is in the formula beside it.
  const stressPolicy = campaignStressPolicy(actor.system.campaignEffects);
  const campaignDamage =
    input.kind === "stress" && input.campaignStressAdjusted !== true
      ? campaignStressDamage(Number(input.damage), stressPolicy)
      : null;
  if (campaignDamage) input = { ...input, damage: campaignDamage.adjustedDamage };
  const saveBonus = Number(input.bonus ?? state.bonus) || 0;
  const roll = await new Roll(`1d20 ${saveBonus < 0 ? "-" : "+"} ${Math.abs(saveBonus)}`).evaluate(),
    natural = roll.dice?.[0]?.total ?? roll.total - saveBonus;
  if (
    input.kind === "stress" &&
    input.campaignStressAdjusted !== true &&
    JSON.stringify(campaignStressPolicy(actor.system.campaignEffects)) !== JSON.stringify(stressPolicy)
  )
    throw Error(loc`The campaign stress modifiers changed during the Damage save. Review this damage again.`);
  let result;
  try {
    result = resolveDamageSave(state.track, {
      damage: Number(input.damage),
      kind: input.kind,
      bonus: saveBonus,
      roll: natural,
      blast: !!input.blast,
      criticalDice: Number(input.criticalDice) || 0,
      tough: state.tough
    });
  } catch (error) {
    return refuse(error.message);
  }
  await actor.update({ "system.damageTrack": result.track });
  const outcome =
    result.state === "dead"
      ? "fails and dies"
      : result.state === "unconscious"
        ? loc`fails and falls unconscious`
        : result.failures
          ? loc`fails ${result.failures} save(s), all ignored by tough`
          : loc`succeeds: no mechanical effect, the damage lingers`;
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flags: {
      spycraft2: {
        actorUuid: actor.uuid,
        npcDamageSave: {
          kind: input.kind,
          damage: Number(input.damage),
          campaignStress: campaignDamage,
          campaignStressAdjusted: input.campaignStressAdjusted === true
        }
      }
    },
    flavor: `${loc`Damage save DC ${result.dc} (${input.damage} ${esc(input.kind)}; ${result.track.accumulated || state.track.accumulated + Number(input.damage)} accumulated): ${signed(result.bonus)} →`} <b>${result.total}</b>. ${esc(actor.name)} ${outcome}.`
  });
  if (result.state !== "active") {
    try {
      await actor.toggleStatusEffect(result.state === "dead" ? "dead" : "unconscious", {
        active: true,
        overlay: result.state === "dead"
      });
    } catch (error) {
      console.warn(loc`Field Agent's Handbook | status not applied`, error);
    }
    for (const combat of game.combats ?? [])
      for (const combatant of combat.combatants)
        if (combatant.actor === actor && !combatant.defeated) await combatant.update({ defeated: true });
  }
  return result;
}

/** The same save, from a sheet or the console, leaving an Undo note for what it changed. */
export const npcDamageSaveWithUndo = (actor, input = null) =>
  withUndo([actor], loc`Damage save: ${actor?.name ?? ""}`, () => npcDamageSave(actor, input));

export async function resetDamageTrack(actor, { heal = null } = {}) {
  if (!actor.isOwner) return null;
  const state = damageSaveState(actor);
  const track = heal === null ? { ...currentDamageTrack(null, sceneEpoch()) } : healDamageTrack(state.track, heal);
  await actor.update({ "system.damageTrack": track });
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
        ["persuade", loc`Persuade the NPC to join combat`]
      ],
      "show"
    )}</select></label>
    <label data-when="action=shift">${loc`Shift (positive is friendlier)`} <input type="number" name="steps" value="1" /></label>
    <label data-when="action=shift"><input type="checkbox" name="automatic" /> ${loc`The shift comes from an ability that shifts disposition automatically (once per mission)`}</label>
    <label data-when="action=set">${loc`Grade to set`} <select name="grade">${options(
      DISPOSITIONS.map(grade => [grade.id, grade.name]),
      "neutral"
    )}</select></label>
    <label data-when="action=loyalty|combat">${loc`Foil decision modifier (−5 to +5)`} <input type="number" name="foil" min="-5" max="5" value="0" /></label>`,
    loc`Apply`
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
