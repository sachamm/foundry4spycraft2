/** Taunt in play: the skill dialog's section and the GC's outcome control on the Taunt card (p.361; Undermine p.205). */
import { tauntOutcome, underminePlan } from "../rules/taunt.mjs";
import { attackCharacterTargetChoices } from "./character-target.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
const say = (actor, text) => ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: esc(text) });

export function tauntContent(key, actor) {
  if (!["manipulate", "senseMotive"].includes(key)) return "";
  const acting = key === "manipulate",
    options = attackCharacterTargetChoices()
      .filter(a => a.uuid !== actor?.uuid)
      .map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`)
      .join("");
  return `<details><summary>${acting ? loc`Taunt action (p.361)` : loc`Resist Taunt (p.361)`}</summary><p>${acting ? loc`Choose Taunt Action above. A half action on your Initiative Count; the opponent answers with Sense Motive (Wis).` : loc`Choose Resist Taunt above to answer an opponent’s Taunt.`}</p><label>${acting ? loc`Opponent` : loc`The taunting opponent`} <select name="tauntOpponentUuid"><option value="">${loc`Choose`}</option>${options}</select></label>${acting ? `<label><input name="tauntInRangeConfirmed" type="checkbox" /> ${loc`The GC confirms the opponent is within my CQB Range and can hear me`}</label>` : `<label><input name="tauntIncomingLegalConfirmed" type="checkbox" /> ${loc`The GC confirms this answers a legal incoming Taunt`}</label>`}</details>`;
}

export function tauntInput(input = {}, actor = null) {
  const uuid = input.tauntOpponentUuid ?? "";
  if (!uuid) return {};
  const target = attackCharacterTargetChoices().find(a => a.uuid === uuid && a.uuid !== actor?.uuid);
  if (!target) throw new Error(loc`Choose a currently observed opposing character for the Taunt.`);
  return { tauntOpponentUuid: target.uuid, tauntOpponentName: target.name };
}

rollPipeline.register({
  id: "tauntContent:skill",
  dialogs: ["skill"],
  dialog: ({ key, actor }) => [{ at: 205, html: tauntContent(key, actor) }],
  read: ({ actor }, input) => tauntInput(input, actor)
});

/** The opponent's resolved Resist Taunt answering this Taunt, if one was rolled. */
function pairedResponse(message, check) {
  const c = check.taunt.combat;
  return (
    [...(game.messages ?? [])]
      .filter(m => m.id !== message.id)
      .map(m => ({ m, f: m.flags?.spycraft2 }))
      .filter(
        ({ f }) =>
          f?.taunt?.role === "defender" &&
          f.actorUuid === check.taunt.opponentUuid &&
          f.taunt.opponentUuid === check.actorUuid &&
          f.taunt.combat?.id === c.id &&
          f.taunt.combat?.round === c.round &&
          f.resolved === true &&
          !f.superseded
      )
      .at(-1) ?? null
  );
}

export async function settleTaunt(message) {
  const check = message.flags.spycraft2,
    actor = fromUuidSync(check.actorUuid),
    target = fromUuidSync(check.taunt.opponentUuid);
  if (!actor || !target) return ui.notifications.warn(loc`Both Taunt participants must still exist.`);
  const paired = pairedResponse(message, check),
    venomous = actor.system.activeFeatNames?.includes("Venomous Dialogue");
  const input = await foundry.applications.api.DialogV2.input({
    window: { title: loc`Settle the Taunt` },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options">${
      paired
        ? `<p>${loc`Paired with ${esc(target.name)}’s Resist Taunt: ${check.effectiveTotal} against ${paired.f.effectiveTotal}.`}</p><label>${loc`On a tie, the winner`} <select name="tieWinner"><option value="">—</option><option value="attacker">${esc(actor.name)}</option><option value="defender">${esc(target.name)}</option></select></label>`
        : `<p>${loc`No resolved Resist Taunt from ${esc(target.name)} was found; enter the outcome.`}</p><label>${loc`Outcome`} <select name="declared"><option value="won">${loc`${esc(actor.name)} wins`}</option><option value="wonCritical">${loc`${esc(actor.name)} wins with a critical (or the opponent’s critical failure)`}</option><option value="lost">${loc`${esc(target.name)} wins`}</option><option value="lostCritical">${loc`${esc(target.name)} wins with a critical (or the taunter’s critical failure)`}</option></select></label>`
    }${venomous ? `<label><input name="venomous" type="checkbox" /> ${loc`On a win, use Venomous Dialogue instead of the standard result (once per scene)`}</label>` : ""}</div>`
  });
  if (!input) return null;
  let outcome;
  try {
    outcome = tauntOutcome(check, paired?.f ?? null, { declared: input.declared, tieWinner: input.tieWinner });
  } catch (error) {
    return ui.notifications.warn(error.message);
  }
  await message.update({ "flags.spycraft2.tauntOutcome": { ...outcome, responseUuid: paired?.m.uuid ?? null } });
  if (!outcome.attackerWon) {
    const rows = [...(target.system.tauntBonuses ?? [])];
    if (!rows.some(r => r.sourceMessage === message.uuid))
      rows.push({
        version: 1,
        sourceMessage: message.uuid,
        targetUuid: actor.uuid,
        combatId: check.taunt.combat.id,
        bonus: outcome.bonus
      });
    await target.update({ "system.tauntBonuses": rows });
    return say(
      target,
      loc`Taunt fails: ${target.name} gains +${outcome.bonus} on their next attack check against ${actor.name}, until used or the combat ends (p.361).`
    );
  }
  if (input.venomous === true && venomous)
    await actor.useLimitedAbility("venomousDialogue", () =>
      say(
        actor,
        loc`Venomous Dialogue: instead of the Taunt’s usual result, ${target.name} makes no attacks until attacked or until the scene ends (p.205).`
      )
    );
  else {
    await say(
      actor,
      loc`Taunt succeeds: ${target.name} must attack ${actor.name} with their next available action, unless physically unable (p.361).`
    );
    if (outcome.critical) {
      const roll = await new Roll("2d4").evaluate();
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: esc(loc`Critical Taunt: ${target.name} is enraged for ${roll.total} rounds (p.361).`)
      });
    }
  }
  const undermine = underminePlan(actor.system, { ...check, messageUuid: message.uuid });
  if (undermine) {
    await target.update({ "system.undermined": undermine });
    await say(
      actor,
      loc`Undermine: ${target.name} cannot spend action dice and takes −${undermine.penalty} morale on Initiative and skill checks for ${undermine.rounds} round(s) (p.205).`
    );
  }
  return outcome;
}

rollPipeline.register({
  id: "tauntControl",
  kinds: ["skill"],
  order: 9721,
  chatControls({ message, check, user }) {
    if (!user?.isGM || check.taunt?.role !== "attacker" || check.resolved !== true || check.superseded) return null;
    if (check.tauntOutcome) return null;
    return [{ label: loc`Settle the Taunt`, run: () => settleTaunt(message) }];
  }
});
