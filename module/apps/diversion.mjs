/** Diversion in play: the skill dialog's section and the GC's outcome control (see module/rules/diversion.mjs). */
import { esc } from "../html.mjs";
import { refuse } from "../error-notices.mjs";
import { diversionOutcome } from "../rules/diversion.mjs";
import { attackCharacterTargetChoices } from "./character-target.mjs";
import { shiftCount } from "./dueling.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

const say = (actor, text) => ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: esc(text) });

export function diversionContent(key, actor) {
  const fan = key === "impress" && actor?.system?.activeFeatNames?.includes("Fan Service");
  if (!["bluff", "senseMotive"].includes(key) && !fan) return "";
  const acting = key !== "senseMotive",
    options = attackCharacterTargetChoices()
      .filter(a => a.uuid !== actor?.uuid)
      .map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`)
      .join("");
  return `<details><summary>${acting ? loc`Diversion action (p.357)` : loc`Resist Diversion (p.357)`}</summary><label>${acting ? loc`Opponent` : loc`The diverting opponent`} <select name="diversionOpponentUuid"><option value="">${loc`Choose`}</option>${options}</select></label>${acting ? `<label><input name="diversionSightConfirmed" type="checkbox" /> ${loc`The GC confirms we can see each other`}</label>` : `<label><input name="diversionIncomingLegalConfirmed" type="checkbox" /> ${loc`The GC confirms this answers a legal incoming Diversion`}</label>`}</details>`;
}

rollPipeline.register({
  id: "diversionContent:skill",
  dialogs: ["skill"],
  dialog: ({ key, actor }) => [{ at: 209, html: diversionContent(key, actor) }],
  read: ({ actor }, input) => {
    const uuid = input.diversionOpponentUuid ?? "";
    if (!uuid) return {};
    const target = attackCharacterTargetChoices().find(a => a.uuid === uuid && a.uuid !== actor?.uuid);
    if (!target) throw new Error(loc`Choose a currently observed opposing character for the Diversion.`);
    return { diversionOpponentUuid: target.uuid, diversionOpponentName: target.name };
  }
});

function pairedResponse(message, check) {
  const c = check.diversion.combat;
  return (
    [...(game.messages ?? [])]
      .filter(m => m.id !== message.id)
      .map(m => ({ m, f: m.flags?.spycraft2 }))
      .filter(
        ({ f }) =>
          f?.diversion?.role === "defender" &&
          f.actorUuid === check.diversion.opponentUuid &&
          f.diversion.opponentUuid === check.actorUuid &&
          f.diversion.combat?.id === c.id &&
          f.diversion.combat?.round === c.round &&
          f.resolved === true &&
          !f.superseded
      )
      .at(-1) ?? null
  );
}

export async function settleDiversion(message) {
  const check = message.flags.spycraft2,
    actor = fromUuidSync(check.actorUuid),
    target = fromUuidSync(check.diversion.opponentUuid);
  if (!actor || !target) return refuse(loc`Both Diversion participants must still exist.`);
  const paired = pairedResponse(message, check);
  const input = await foundry.applications.api.DialogV2.input({
    window: { title: loc`Settle the Diversion` },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options">${
      paired
        ? `<p>${loc`Paired with ${esc(target.name)}’s Resist Diversion: ${check.effectiveTotal} against ${paired.f.effectiveTotal}.`}</p><label>${loc`On a tie, the winner`} <select name="tieWinner"><option value="">—</option><option value="attacker">${esc(actor.name)}</option><option value="defender">${esc(target.name)}</option></select></label>`
        : `<label>${loc`Outcome`} <select name="declared"><option value="won">${loc`${esc(actor.name)} wins`}</option><option value="wonCritical">${loc`${esc(actor.name)} wins with a critical`}</option><option value="lost">${loc`${esc(target.name)} wins`}</option><option value="lostCritical">${loc`${esc(target.name)} wins with a critical`}</option></select></label>`
    }</div>`
  });
  if (!input) return null;
  let outcome;
  try {
    outcome = diversionOutcome(check, paired?.f ?? null, { declared: input.declared, tieWinner: input.tieWinner });
  } catch (error) {
    return refuse(error.message);
  }
  await message.update({ "flags.spycraft2.diversionOutcome": outcome });
  if (outcome.attackerWon) {
    const roll = await new Roll(outcome.countLoss).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: esc(loc`Diversion: ${target.name}’s Initiative Count drops by ${roll.total} (p.357).`)
    });
    try {
      await shiftCount(message, target, -roll.total, "diversionCount", "Diversion");
    } catch (error) {
      ui.notifications.warn(error.message);
    }
    return outcome;
  }
  await setConditionStatus(actor, "flat-footed", true, { label: loc`Flat-footed`, aliases: ["flatFooted"] });
  if (outcome.critical) {
    const rows = [...(target.system.tauntBonuses ?? [])];
    if (!rows.some(r => r.sourceMessage === message.uuid))
      rows.push({
        version: 1,
        sourceMessage: message.uuid,
        targetUuid: actor.uuid,
        combatId: check.diversion.combat.id,
        untilRound: check.diversion.combat.round + 1,
        bonus: 2
      });
    await target.update({ "system.tauntBonuses": rows });
  }
  return say(
    actor,
    outcome.critical
      ? loc`Diversion fails: ${actor.name} is flat-footed, and ${target.name} gains +2 on their next attack against ${actor.name} until the end of the following round (p.357).`
      : loc`Diversion fails: ${actor.name} is flat-footed (p.357).`
  );
}

rollPipeline.register({
  id: "diversionControl",
  kinds: ["skill"],
  order: 9722,
  chatControls({ message, check, user }) {
    if (!user?.isGM || check.diversion?.role !== "attacker" || check.resolved !== true || check.superseded) return null;
    if (check.diversionOutcome) return null;
    return [{ label: loc`Settle the Diversion`, run: () => settleDiversion(message) }];
  }
});
