/** Running NPCs at the table: skill checks, standard-NPC Damage saves and disposition (pp.331–332, 452, 457–458). */
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
import { GC_DATA } from "../../rules/gc-tables.mjs";
import { sceneEpoch, getMission, teamActors } from "./state.mjs";

const esc = text => foundry.utils.escapeHTML(String(text ?? ""));
const ask = (title, content) =>
  foundry.applications.api.DialogV2.input({
    window: { title },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options">${content}</div>`
  });
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

export async function rollNpcSkill(actor, input = null) {
  if (!actor.isOwner) return null;
  const graded = actor.system.npcProfile?.enabled === true;
  if (!input) {
    const skillRows = SKILLS.map(skill => [
      skill.key,
      `${skill.name}${graded ? ` ${signed(npcSkillPlan(actor, skill.key).bonus)}` : ""}`
    ]);
    const abilityRows = Object.entries(CONFIG.SPYCRAFT.abilities).map(([key, label]) => [
      key,
      game.i18n.localize(label)
    ]);
    input = await ask(
      `${actor.name}: skill check`,
      `
      <p>An NPC uses the higher of Competence and its skilled bonus, which also sets the result cap (p.452). The key attribute modifier is added.</p>
      <label>Skill <select name="key">${options(skillRows)}</select></label>
      <label>Attribute <select name="ability">${options([["", "First listed for the skill"], ...abilityRows], "")}</select></label>
      ${graded ? "" : '<label>Skill bonus (manual stat block) <input type="number" name="manualBonus" value="0" /></label>'}
      <label>Situational modifier <input type="number" name="modifier" value="0" /></label>
      <label>Error range <input type="number" name="error" min="0" max="19" value="1" /></label>
      <label><input type="checkbox" name="secret" /> Secret (GC only)</label>`
    );
    if (!input) return null;
  }
  const skill = SKILLS.find(entry => entry.key === input.key);
  if (!skill) return ui.notifications.warn("Choose a skill.");
  if (
    actor.system.npcType === "animal" &&
    graded &&
    !actor.system.npcBuild?.skills?.some(entry => entry.key === skill.key)
  )
    ui.notifications.info("Animals have no Competence: only their listed skills carry a bonus (p.445).");
  const plan = graded
    ? npcSkillPlan(actor, skill.key)
    : { bonus: Number(input.manualBonus) || 0, cap: stepLookup(TABLES.skillCap, Number(input.manualBonus) || 0) };
  const ability =
    skill.abilities.includes(input.ability) || Object.hasOwn(CONFIG.SPYCRAFT.abilities, input.ability)
      ? input.ability
      : skill.abilities[0];
  const total = plan.bonus + (actor.system.abilities[ability]?.mod ?? 0) + (Number(input.modifier) || 0);
  return actor.rollCheck(
    "1d20 + @total",
    { total },
    {
      flavor: `${skill.name} (${ability.toUpperCase()}) — NPC bonus ${signed(plan.bonus)}, result cap ${plan.cap}`,
      ability,
      cap: plan.cap,
      error: Math.max(0, Number(input.error) || 0),
      npcSkill: skill.key,
      ...(input.secret ? { rollMode: "gmroll" } : {})
    }
  );
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
    return ui.notifications.warn(
      "Special NPCs lose vitality and wounds like player characters; Damage saves are for standard NPCs and animals (p.452)."
    );
  const state = damageSaveState(actor);
  if (state.track.state !== "active")
    return ui.notifications.warn(
      `${actor.name} is already ${state.track.state}. Reset the Damage save track to bring the NPC back.`
    );
  if (!input) {
    input = await ask(
      `${actor.name}: Damage save`,
      `
      <p>DC 10 + half of all damage suffered this scene (now ${state.track.accumulated}). Save bonus ${signed(state.bonus)}${state.tough ? `; tough ${state.tough} (ignored so far: ${state.track.ignored})` : ""}. Enter damage after Damage Reduction.</p>
      <label>Damage suffered <input type="number" name="damage" min="1" value="1" required /></label>
      <label>Type <select name="kind">${options(
        [
          ["lethal", "Lethal"],
          ["subdual", "Subdual"],
          ["stress", "Stress"]
        ],
        "lethal"
      )}</select></label>
      <label><input type="checkbox" name="blast" /> The damage has a blast increment (+1 failed save per 10 the save misses by)</label>
      <label>Action dice spent to activate a critical hit (each is an automatic failed save) <input type="number" name="criticalDice" min="0" value="0" /></label>
      <label>Save bonus <input type="number" name="bonus" value="${state.bonus}" /></label>`
    );
    if (!input) return null;
  }
  const roll = await new Roll("1d20").evaluate();
  let result;
  try {
    result = resolveDamageSave(state.track, {
      damage: Number(input.damage),
      kind: input.kind,
      bonus: Number(input.bonus ?? state.bonus),
      roll: roll.total,
      blast: !!input.blast,
      criticalDice: Number(input.criticalDice) || 0,
      tough: state.tough
    });
  } catch (error) {
    return ui.notifications.warn(error.message);
  }
  await actor.update({ "system.damageTrack": result.track });
  const outcome =
    result.state === "dead"
      ? "fails and dies"
      : result.state === "unconscious"
        ? "fails and falls unconscious"
        : result.failures
          ? `fails ${result.failures} save(s), all ignored by tough`
          : "succeeds: no mechanical effect, the damage lingers";
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `Damage save DC ${result.dc} (${input.damage} ${esc(input.kind)}; ${result.track.accumulated || state.track.accumulated + Number(input.damage)} accumulated): ${signed(result.bonus)} → <b>${result.total}</b>. ${esc(actor.name)} ${outcome}.`
  });
  if (result.state !== "active") {
    try {
      await actor.toggleStatusEffect(result.state === "dead" ? "dead" : "unconscious", {
        active: true,
        overlay: result.state === "dead"
      });
    } catch (error) {
      console.warn("Spycraft 2.0 | status not applied", error);
    }
    for (const combat of game.combats ?? [])
      for (const combatant of combat.combatants)
        if (combatant.actor === actor && !combatant.defeated) await combatant.update({ defeated: true });
  }
  return result;
}

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
  if (!game.user.isGM) return ui.notifications.warn("The GC manages NPC dispositions.");
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
    `${actor.name}: disposition`,
    `
    ${villain ? '<p class="bad">Villains are immune to disposition effects (p.457); this record is for reference only.</p>' : ""}
    <p>No NPC shifts more than ${D.maxShiftPerMission} grades either way in one mission. Intimacy checks: ${esc(D.intimacyChecks.join(", "))}. Fondness checks: ${esc(D.fondnessChecks.join(", "))}.</p>
    <label>Toward <select name="target">${options(targets, "")}</select></label>
    <label>Action <select name="action">${options(
      [
        ["show", "Show check modifiers"],
        ["shift", "Shift by grades"],
        ["set", "Set a grade (GC ruling)"],
        ["loyalty", "Roll a Loyalty decision"],
        ["combat", "Roll whether the NPC joins a fight"]
      ],
      "show"
    )}</select></label>
    <label>Shift (positive is friendlier) <input type="number" name="steps" value="1" /></label>
    <label><input type="checkbox" name="automatic" /> The shift comes from an ability that shifts disposition automatically (once per mission)</label>
    <label>Grade to set <select name="grade">${options(
      DISPOSITIONS.map(grade => [grade.id, grade.name]),
      "neutral"
    )}</select></label>
    <label>Foil decision modifier (−5 to +5) <input type="number" name="foil" min="-5" max="5" value="0" /></label>`
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
        `${esc(actor.name)} is now <b>${esc(dispositionGrade(next.grade).name)}</b> toward ${esc(name)}${next.limited ? " (limited to 2 grades per mission)" : ""}.`,
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
          flavor: `Loyalty (${esc(dispositionGrade(gradeNow).name)} toward ${esc(name)}): ${step.total} against ${step.target} — ${step.success ? "sides with them" : "sides against them"}.`
        },
        { rollMode: "gmroll" }
      );
    }
    if (input.action === "combat") {
      const roll = await new Roll("1d20").evaluate(),
        result = joinsCombat(gradeNow, roll.total, { foil: Number(input.foil) || 0 });
      return roll.toMessage(
        {
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: `Joins the fight? (${esc(dispositionGrade(gradeNow).name)} toward ${esc(name)}): ${result.total} against ${result.target} — ${result.joins ? (result.hostile ? "enters the fight against them" : "enters the fight on their side") : "stays out"}. A side may instead try Impress/Persuasion once per combat (DC ${dispositionGrade(gradeNow).joinDC ?? "Triumph only"}).`
        },
        { rollMode: "gmroll" }
      );
    }
    const intimacy = dispositionCheckModifier(gradeNow, D.intimacyChecks[0], { villain }),
      fondness = dispositionCheckModifier(gradeNow, D.fondnessChecks[0], { villain }),
      grade = dispositionGrade(gradeNow);
    return say(
      actor,
      `<b>${esc(actor.name)}</b> is ${esc(grade.name)} toward ${esc(name)}.<br>Intimacy checks ${signed(intimacy.modifier)}${intimacy.error ? `, error range +${intimacy.error}` : ""}.<br>Fondness checks ${signed(fondness.modifier)}${fondness.threat ? `, threat range +${fondness.threat}` : ""}${fondness.error ? `, error range +${fondness.error}` : ""}.<br>Loyalty ${grade.loyalty}; joins combat on ${grade.joinRoll} or less; time for Disposition-tagged checks ×${grade.priority}.`,
      { whisper: true }
    );
  } catch (error) {
    return ui.notifications.warn(error.message);
  }
}
