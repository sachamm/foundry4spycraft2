import { currentDamageTrack, resolveDamageSave, damageSaveDC } from "../../rules/gc/npc-damage.mjs";
import { npcIsSpecial, spendProfile } from "../../rules/gc/npc-state.mjs";
import { campaignStressPolicy, campaignStressDamage } from "../../rules/campaign-combat.mjs";
import { sceneEpoch } from "./state.mjs";
import { formDialog, raw } from "../dialog-kit.mjs";
import { refuse } from "../../error-notices.mjs";
import { esc } from "../../html.mjs";
import { loc } from "../../i18n.mjs";
import { damageResistancePlan, subdualTypeSource } from "../../rules/resistances.mjs";
const ask = (title, content, ok) => formDialog({ title, ok, fields: [raw(content)] });
const options = (rows, selected) =>
  rows
    .map(
      ([value, label]) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`
    )
    .join("");
const signed = value => (value >= 0 ? `+${value}` : `${value}`);

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
      <p>${loc`DC 10 + half of all damage suffered this scene (now ${state.track.accumulated}). Save bonus ${signed(state.bonus)}${state.tough ? loc`; tough ${state.tough} (ignored so far: ${state.track.ignored})` : ""}. Enter damage after Damage Reduction; prepared stress/subdual resistance is applied here.`}</p>
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
  input = { ...input, kind: input.kind ?? "lethal" };
  const damage = Number(input.damage),
    saveBonus = Number(input.bonus ?? state.bonus),
    criticalDice = Number(input.criticalDice ?? 0);
  if (
    !Number.isSafeInteger(damage) ||
    damage < 1 ||
    !["lethal", "subdual", "stress"].includes(input.kind) ||
    !Number.isSafeInteger(saveBonus) ||
    !Number.isSafeInteger(criticalDice) ||
    criticalDice < 0 ||
    (input.blast !== undefined && typeof input.blast !== "boolean") ||
    (input.campaignStressAdjusted !== undefined && typeof input.campaignStressAdjusted !== "boolean")
  )
    return refuse(
      loc`Enter positive whole damage, a whole save bonus and nonnegative whole critical size before rolling.`
    );
  // The card's large number is the save's total, the one compared with the DC; the die is in the formula beside it.
  const stressPolicy = campaignStressPolicy(actor.system.campaignEffects);
  const campaignDamage =
    input.kind === "stress" && input.campaignStressAdjusted !== true
      ? campaignStressDamage(Number(input.damage), stressPolicy)
      : null;
  if (campaignDamage) input = { ...input, damage: campaignDamage.adjustedDamage };
  const typedSource = subdualTypeSource(actor.system, input.typedDamageType);
  if (typedSource && input.kind !== "subdual")
    return refuse(loc`Cold, heat and electrical defenses require subdual damage.`);
  let resistance = null,
    typedResistance = null;
  if (["stress", "subdual"].includes(input.kind)) {
    resistance = damageResistancePlan(actor.system, input.kind, Number(input.damage));
    typedResistance = typedSource
      ? damageResistancePlan(actor.system, input.typedDamageType, resistance.net, typedSource)
      : null;
    input = { ...input, damage: typedResistance?.net ?? resistance.net };
    if (!input.damage) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="spycraft2 chat-note"><p>${loc`${esc(actor.name)}: no ${input.kind} damage remains after campaign modifiers and resistance; no Damage save is needed.`}</p></div>`,
        flags: {
          spycraft2: {
            actorUuid: actor.uuid,
            checkKind: "note",
            npcDamagePrevented: { resistance, ...(typedResistance ? { typedResistance } : {}) }
          }
        }
      });
      return {
        damage: 0,
        prevented: true,
        state: state.track.state,
        track: state.track,
        resistance,
        ...(typedResistance ? { typedResistance } : {})
      };
    }
  }
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
          campaignStressAdjusted: input.campaignStressAdjusted === true,
          ...(resistance ? { resistance } : {}),
          ...(typedResistance ? { typedResistance } : {})
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
  return {
    ...result,
    damage: Number(input.damage),
    ...(resistance ? { resistance } : {}),
    ...(typedResistance ? { typedResistance } : {})
  };
}
