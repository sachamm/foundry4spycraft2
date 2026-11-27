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
  persuadeJoinPlan,
  dispositionCheckModifier
} from "../../rules/gc/disposition.mjs";
import { npcSpendProfile } from "../../rules/gc/gc-spend.mjs";
import { npcSkillQualityPlan } from "../../rules/npc-qualities.mjs";
import { GC_DATA } from "../../rules/gc-tables.mjs";
import { sceneEpoch, getMission, teamActors } from "./state.mjs";
import { loc } from "../../i18n.mjs";
import { campaignRules, campaignSkillPlan, omniPenalty } from "../../rules/campaign-rules.mjs";
import { skillConditionCheckPenalty } from "../../rules/skill-conditions.mjs";
import { isHideCheck } from "../../rules/check-identity.mjs";
import { formatRange } from "../../rules/outcome-labels.mjs";
import { breakdownRows } from "../../rules/bonus-breakdown.mjs";
import { formDialog, raw } from "../dialog-kit.mjs";

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
const sizeStealthCheck = (skillKey, check) =>
  (skillKey === "blend" && check?.id === "stealth") || isHideCheck(skillKey, check);

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
  for (const bonus of campaign.bonuses) rows.push({ label: bonus.source, value: bonus.value });
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

export async function rollNpcSkill(actor, input = null) {
  if (!actor.isOwner) return null;
  const graded = actor.system.npcProfile?.enabled === true;
  if (!input) {
    // One picker for the skill and the named check, so the check's own error range and rules apply.
    const groups = SKILLS.map(skill => {
      const label = `${skill.name}${graded ? ` ${signed(npcSkillPlan(actor, skill.key).bonus)}` : ""}`,
        checks = CONFIG.SPYCRAFT.skills?.[skill.key]?.checks ?? [];
      return `<optgroup label="${esc(label)}">${checks
        .map(
          check =>
            `<option value="${esc(`${skill.key}:${check.id}`)}" data-detail="${esc(loc`${check.attributes.join("/").toUpperCase()} · error range ${formatRange("error", check.error)}`)}">${esc(`${skill.name}/${check.name.replace(/ Check$/, "")}`)}</option>`
        )
        .join("")}</optgroup>`;
    }).join("");
    const abilityRows = Object.entries(CONFIG.SPYCRAFT.abilities).map(([key, label]) => [
      key,
      game.i18n.localize(label)
    ]);
    const rules = campaignRules();
    input = await formDialog({
      title: loc`${actor.name}: skill check`,
      ok: loc`Roll`,
      fields: [
        raw(`
      <p>${loc`An NPC uses the higher of Competence and its skilled bonus, which also sets the result cap (p.452). The key attribute modifier is added.`}</p>
      <label>${loc`Check`} <select name="skillCheck">${groups}</select></label>
      <p class="hint sc2-check-detail"></p>
      <label>${loc`Attribute`} <select name="ability">${options([["", loc`First listed for the check`], ...abilityRows], "")}</select></label>
      ${graded ? "" : `<label>${loc`Skill bonus (manual stat block)`} <input type="number" name="manualBonus" value="0" /></label>`}
      <label>${loc`Situational modifier`} <input type="number" name="modifier" value="0" /></label>
      <label>${loc`Error range`} <input type="number" name="error" min="0" max="19" placeholder="${esc(loc`the check's own`)}" /></label>
      ${rules.surpriseHideBonus ? `<label data-when="skillCheck=blend:stealth|sneak:hide"><input type="checkbox" name="surprise" /> ${loc`This check determines surprise`}</label>` : ""}
      ${rules.dispositionCheckModifier ? `<label><input type="checkbox" name="paranoidPersuasion" /> ${loc`This check shifts a disposition or talks someone into acting (Paranoid −4)`}</label>` : ""}
      ${qualityCheckContent(actor.system.qualityEffects)}
      <label><input type="checkbox" name="secret" /> ${loc`Secret (GC only)`}</label>`)
      ],
      dialog: { render: (event, app) => showCheckDetail(app?.element ?? event?.target) }
    });
    if (!input) return null;
  }
  const [pickedKey, pickedCheck] = String(input.skillCheck ?? "").split(":");
  const skill = SKILLS.find(entry => entry.key === (pickedKey || input.key));
  if (!skill) return refuse(loc`Choose a skill.`);
  // A macro may name the check as `check` or, as before, `qualityCheck`; without one the skill's first is made.
  const check = npcSkillCheck(skill.key, pickedCheck || input.check || input.qualityCheck || "");
  const animal = actor.system.npcType === "animal";
  if (animal && check && !animalMayMake(skill.key, check.id))
    ui.notifications.warn(loc`Animals may not normally make the ${check.name} (p.445). Rolled as asked.`);
  else if (animal && graded && !actor.system.npcBuild?.skills?.some(entry => entry.key === skill.key))
    ui.notifications.info(loc`Animals have no Competence: only their listed skills carry a bonus (p.445).`);
  const plan = graded
    ? npcSkillPlan(actor, skill.key)
    : { bonus: Number(input.manualBonus) || 0, cap: stepLookup(TABLES.skillCap, Number(input.manualBonus) || 0) };
  const attributes = check?.attributes ?? skill.abilities;
  const ability =
    attributes.includes(input.ability) || Object.hasOwn(CONFIG.SPYCRAFT.abilities, input.ability)
      ? input.ability
      : attributes[0];
  // Qualities: Fearless, Meek, Strong-Minded and an animal's training by the check, the rest by the boxes ticked.
  const quality = npcSkillQualityPlan(actor.system.qualityEffects ?? { skillOptions: [] }, {
    skillKey: skill.key,
    checkId: check?.id ?? "",
    riderCharisma: Number(input.riderCharisma) || 0,
    chosen: Object.keys(input)
      .filter(key => key.startsWith("quality-") && input[key] === true)
      .map(key => key.slice("quality-".length))
  });
  // Feat items on the NPC that add a plain number to this skill.
  const featBonus = Math.trunc(Number(actor.system.featEffects?.skills?.[skill.key]) || 0);
  if (featBonus) quality.rows.push({ label: loc`Feats`, value: featBonus });
  // Conditions, Size and the campaign: Comedy of Errors widens the error range of a check made with the NPC's
  // lowest attribute (p.406), Paranoid adds its surprise bonus (p.408). Counted here once.
  const situation = npcSkillCheckRows(actor.system, skill.key, check, {
    ability,
    modifier: input.modifier,
    surprise: input.surprise === true,
    paranoidPersuasion: input.paranoidPersuasion === true
  });
  // Omni-Competent halves every penalty, the NPC qualities' too; npcSkillCheckRows has halved its own rows.
  const halve = omniPenalty();
  const rows = [...situation.rows, ...quality.rows.map(row => ({ ...row, value: halve(row.value) }))],
    errorIncrease = quality.errorIncrease + situation.errorIncrease;
  const total =
    plan.bonus + (actor.system.abilities[ability]?.mod ?? 0) + rows.reduce((sum, row) => sum + row.value, 0);
  const typedError =
    input.error === undefined || input.error === null || input.error === "" || !Number.isFinite(Number(input.error))
      ? null
      : Math.max(0, Number(input.error));
  const cap = plan.cap + (quality.capBonus ?? 0);
  return actor.rollCheck(
    "1d20 + @total",
    { total },
    {
      // Players see the card too: the NPC's bonus, cap and modifiers are printed only on a roll kept to the GC.
      flavor:
        (input.secret
          ? loc`${skill.name} (${ability.toUpperCase()}) — NPC bonus ${signed(plan.bonus)}, result cap ${cap}`
          : loc`${skill.name} (${ability.toUpperCase()})`) +
        (input.secret && (rows.length || errorIncrease)
          ? `<br><small>${esc([...rows.map(row => `${row.label} ${signed(row.value)}`), ...(errorIncrease ? [loc`error range ${signed(errorIncrease)}`] : [])].join("; "))}</small>`
          : ""),
      ability,
      // The card shows these parts only to someone who may open the NPC (module/rolls/chat-breakdown.mjs).
      breakdown: breakdownRows(
        [
          { label: loc`Skill bonus`, value: plan.bonus, keep: true },
          { label: ability.toUpperCase(), value: actor.system.abilities[ability]?.mod, keep: true },
          ...rows
        ],
        total
      ),
      cap,
      // The check's own error range unless one is typed (p.88), then the qualities' and campaign's changes.
      error: Math.max(0, (typedError ?? check?.error ?? 1) + errorIncrease),
      // Posted as a skill check, so the card's skill rules (and Comedy of Errors' activation cap) apply.
      checkKind: "skill",
      skillKey: skill.key,
      checkId: check?.id ?? "",
      npcSkill: skill.key,
      ...(input.secret ? { rollMode: "gmroll" } : {})
    }
  );
}

/** One line under the check picker saying what the chosen check uses (style guide 7.4). */
function showCheckDetail(root) {
  const select = root?.querySelector?.('[name="skillCheck"]'),
    detail = root?.querySelector?.(".sc2-check-detail");
  if (!select || !detail) return;
  const update = () => {
    detail.textContent = select.selectedOptions?.[0]?.dataset.detail ?? "";
  };
  select.addEventListener("change", update);
  update();
}

const toughGrades = actor => spendProfile(actor).tough;
export function damageSaveState(actor) {
  const system = actor.system,
    track = currentDamageTrack(system.damageTrack, sceneEpoch());
  const bonus = (Number.isFinite(system.damageSave) ? system.damageSave : 0) + (system.damageSaveAdjust ?? 0);
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
      <label><input type="checkbox" name="blast" /> ${loc`The damage has a blast increment (+1 failed save per 10 the save misses by)`}</label>
      <label>${loc`Action dice spent to activate a critical hit (each is an automatic failed save)`} <input type="number" name="criticalDice" min="0" value="0" /></label>
      <label>${loc`Save bonus`} <input type="number" name="bonus" value="${state.bonus}" /></label>`,
      loc`Roll Damage save`
    );
    if (!input) return null;
  }
  // The card's large number is the save's total, the one compared with the DC; the die is in the formula beside it.
  const saveBonus = Number(input.bonus ?? state.bonus) || 0;
  const roll = await new Roll(`1d20 ${saveBonus < 0 ? "-" : "+"} ${Math.abs(saveBonus)}`).evaluate(),
    natural = roll.dice?.[0]?.total ?? roll.total - saveBonus;
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
    ${villain ? `<p class="bad">${loc`Villains are immune to disposition effects (p.457); this record is for reference only.`}</p>` : ""}
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
    loc`Apply`
  );
  if (!input) return null;
  const targetId = input.target || "",
    gradeNow = targetId ? dispositionToward(record, targetId) : record.base,
    name = targetId ? (game.actors.get(targetId)?.name ?? targetId) : "everyone else";
  try {
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
