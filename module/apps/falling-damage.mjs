import { fallingDamagePlan } from "../rules/falling-damage.mjs";
import { campaignFallingDamageDivisor } from "../rules/campaign-combat.mjs";
import { currentCampaignRules } from "../rules/gc/campaign.mjs";
import { fallDistancePlan } from "../rules/fall-distance.mjs";
import { rollEvidence } from "../rules/outcomes.mjs";
import { sameValues } from "../rules/equal.mjs";
import { recordReplacementPatch } from "../rules/record-patch.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { postedReceipt } from "../services/message-lookup.mjs";
import { queueResources } from "../services/transactions.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { esc } from "../html.mjs";
import { loc } from "../i18n.mjs";

const resultKey = message => encodeURIComponent(message.uuid).replaceAll(".", "%2E");
const currentResult = (actor, message) => actor.flags?.spycraft2?.fallingResults?.[resultKey(message)];
const eligibleFall = check =>
  check &&
  ((check.checkKind === "skill" && check.skillKey === "acrobatics" && check.checkId === "falling") ||
    (check.checkKind === "fallEvent" &&
      check.uncontrolledFall === true &&
      check.resolved === true &&
      check.successConfirmed === false &&
      check.effectiveTotal === 0));

/** Record an actual landing when no Acrobatics check was made or available. No check roll or action is invented. */
export async function recordUncontrolledFall(actor, options = {}) {
  if (!actor?.isOwner || !["agent", "npc"].includes(actor.type)) return null;
  let input = options;
  if (input.distanceFeet === undefined) {
    input = await systemDialog.input({
      window: { title: loc`Fall without an Acrobatics check` },
      rejectClose: false,
      ok: { label: loc`Record fall` },
      content: `<div class="spycraft2-roll-options"><p>${loc`Record a landing when no Acrobatics/Falling check was made. The character takes the ordinary impact and becomes Sprawled; qualified distance and per-die benefits still apply.`}</p><label>${loc`Actual fall distance (feet)`} <input name="distanceFeet" type="number" min="0" step="any" required /></label><label>${loc`Landing surface`} <select name="surface"><option value="solid">${loc`Solid: lethal damage`}</option><option value="fluid">${loc`Fluid: subdual damage`}</option></select></label><label><input name="softSurface" type="checkbox" /> ${loc`The landing surface is soft or yielding`}</label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms this landing and that no Acrobatics check was made`}</label></div>`
    });
    if (!input) return null;
    input.distanceFeet = String(input.distanceFeet ?? "").trim() ? Number(input.distanceFeet) : NaN;
  }
  if (input.confirmed !== true || !["solid", "fluid"].includes(input.surface))
    throw Error(loc`Confirm the actual landing surface and absence of an Acrobatics check.`);
  const proof = fallDistancePlan(actor.system, {
    fallDeclared: true,
    fallConfirmed: true,
    fallDistanceFeet: input.distanceFeet,
    fallSoftSurface: input.softSurface === true
  });
  fallingDamagePlan(proof, { result: 0, succeeded: false, surface: input.surface });
  const id = foundry.utils.randomID();
  let message;
  try {
    message = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="spycraft2 chat-note"><p>${esc(loc`Uncontrolled fall: ${input.distanceFeet} feet, ${input.surface === "solid" ? loc`solid landing` : loc`fluid landing`}. No Acrobatics check was made.`)}</p></div>`,
      flags: {
        spycraft2: {
          actorUuid: actor.uuid,
          checkKind: "fallEvent",
          uncontrolledFall: true,
          resolved: true,
          successConfirmed: false,
          rawTotal: 0,
          effectiveTotal: 0,
          actionDiceAllowed: false,
          fallDistance: proof,
          fallingEvent: { id }
        }
      }
    });
  } catch (error) {
    message = postedReceipt(actor, "fallingEvent", id);
    if (!message) throw error;
  }
  return { message, result: await resolveFallingDamage(actor, message, { surface: input.surface, confirmed: true }) };
}
async function save(actor, message, record) {
  try {
    await actor.update(
      recordReplacementPatch(
        `flags.spycraft2.fallingResults.${resultKey(message)}`,
        record,
        currentResult(actor, message)
      )
    );
  } catch (error) {
    if (!sameValues(currentResult(actor, message), record)) throw error;
  }
  if (!sameValues(currentResult(actor, message), record))
    throw Error(loc`The falling result was not recorded. Ask the GC to review it before retrying.`);
}

/** The result lives on the actor before any chat cards post. Retrying a post never rolls the impact again. */
export async function resolveFallingDamage(actor, message, options = {}) {
  let check = message?.flags?.spycraft2;
  if (
    !actor?.isOwner ||
    check?.actorUuid !== actor.uuid ||
    check.superseded ||
    !eligibleFall(check) ||
    !check.fallDistance ||
    !message.uuid
  )
    return null;
  if (message.blind && !game.user.isGM) return null;
  const original = rollEvidence(check);
  const previous = currentResult(actor, message);
  if (previous?.state === "complete") return previous;
  let input = options;
  if (!previous && !input.surface) {
    input = await systemDialog.input({
      window: { title: loc`Resolve falling damage` },
      rejectClose: false,
      ok: { label: loc`Resolve fall` },
      content: `<div class="spycraft2-roll-options"><p>${loc`Use the distances saved with this Acrobatics result. Impact and stress are posted as separate damage cards, ready to apply to this character.`}</p><label>${loc`Landing surface`} <select name="surface"><option value="solid">${loc`Solid: lethal damage`}</option><option value="fluid">${loc`Fluid: subdual damage`}</option></select></label><label><input name="diving" type="checkbox" /> ${loc`This check is a dive into sufficiently deep water`}</label><label>${loc`Water depth (feet)`} <input name="waterDepthFeet" type="number" min="0" step="any" value="0" /></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms this surface and any diving conditions`}</label></div>`
    });
    if (!input) return null;
    input.waterDepthFeet = Number(input.waterDepthFeet);
  }
  if (!previous && input.confirmed !== true)
    throw Error(loc`Confirm the actual landing surface and diving conditions.`);
  check = message.flags.spycraft2;
  if (original !== rollEvidence(check)) throw Error(loc`The Falling roll changed while its landing was reviewed.`);
  const context = previous?.context ?? {
    surface: input.surface,
    diving: input.diving === true,
    waterDepthFeet: input.waterDepthFeet ?? 0,
    ...(campaignFallingDamageDivisor(actor, currentCampaignRules().effects) === 2 ? { damageDivisor: 2 } : {})
  };
  const plan = () =>
    fallingDamagePlan(check.fallDistance, {
      ...context,
      result: check.effectiveTotal,
      succeeded: check.successConfirmed
    });
  const initial = plan();
  if (
    typeof check.successConfirmed === "boolean" &&
    check.successConfirmed !== check.effectiveTotal >= initial.dc &&
    !check.criticalSuccess &&
    !check.criticalFailure
  )
    throw Error(loc`The confirmed Falling outcome does not match this landing's DC. The GC must review it.`);
  if (!check.resolved) {
    if (
      typeof check.successConfirmed !== "boolean" &&
      !(await actor.confirmCheckOutcome(message, {
        succeeded: initial.succeeded,
        difficultyClass: initial.dc
      }))
    )
      return null;
    check = message.flags.spycraft2;
    const expected = rollEvidence({ ...check, resolved: true });
    if (!(await actor.finishCheck(message))) return null;
    check = message.flags.spycraft2;
    if (expected !== rollEvidence(check)) return null;
  }
  if (!check.resolved || check.superseded) return null;
  const frozen = rollEvidence(check);
  return queueResources(
    [actor],
    async () => {
      check = message.flags.spycraft2;
      if (!actor.isOwner || !check.resolved || check.superseded || frozen !== rollEvidence(check))
        throw Error(loc`The Falling result changed before settlement. Review it again.`);
      let record = currentResult(actor, message);
      if (
        !record &&
        campaignFallingDamageDivisor(actor, currentCampaignRules().effects) !== (context.damageDivisor ?? 1)
      )
        throw Error(loc`The campaign falling rules changed before settlement. Review the current landing again.`);
      if (record?.state === "complete") return record;
      if (record && (record.actorUuid !== actor.uuid || record.evidence !== frozen))
        throw Error(loc`The saved falling result no longer matches this character and check. The GC must review it.`);
      if (!record) {
        record = {
          version: 1,
          id: foundry.utils.randomID(),
          actorUuid: actor.uuid,
          evidence: frozen,
          state: "reserved",
          context,
          cards: {}
        };
        await save(actor, message, record);
        const count = plan().diceCount;
        const roll = count ? await new Roll(`${count}d6`).evaluate() : null;
        const dice = roll ? roll.dice.flatMap(d => d.results.filter(r => r.active !== false).map(r => r.result)) : [];
        record = {
          ...record,
          state: "rolled",
          plan: fallingDamagePlan(check.fallDistance, {
            ...context,
            result: check.effectiveTotal,
            succeeded: check.successConfirmed,
            dice
          })
        };
        await save(actor, message, record);
      } else if (record.state === "reserved") {
        if (!game.user.isGM) throw Error(loc`The interrupted falling roll needs GC review; do not roll it again.`);
        let review = options;
        if (!Array.isArray(review.actualDice)) {
          review = await systemDialog.input({
            window: { title: loc`Review interrupted falling roll` },
            rejectClose: false,
            ok: { label: loc`Record actual dice` },
            content: `<div class="spycraft2-roll-options"><p>${loc`Recover the actual d6 results for this fall. Do not reroll a result that already occurred. The GC must adjudicate an unknown result separately.`}</p><label>${loc`Actual d6 results (comma separated)`} <input name="actualDice" required /></label><label>${loc`GC review note`} <input name="note" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`I reviewed the actual result and these dice`}</label></div>`
          });
          if (!review) return null;
          review.actualDice = review.actualDice
            .split(",")
            .filter(s => s.trim())
            .map(Number);
        }
        if (review.confirmed !== true || !String(review.note ?? "").trim())
          throw Error(loc`Confirm the actual dice and add a GC review note.`);
        record = {
          ...record,
          state: "rolled",
          review: { note: review.note.trim(), userId: game.user.id },
          plan: fallingDamagePlan(check.fallDistance, {
            ...record.context,
            result: check.effectiveTotal,
            succeeded: check.successConfirmed,
            dice: review.actualDice
          })
        };
        await save(actor, message, record);
      }
      const result = record.plan;
      if (!result || record.state !== "rolled") throw Error(loc`The saved falling result needs GC review.`);
      for (const component of ["impact", "stress"]) {
        const amount = result[component];
        if (!amount || record.cards[component]) continue;
        const id = `${record.id}-${component}`;
        let card = postedReceipt(actor, "fallingDamage", id);
        if (!card) {
          try {
            card = await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              ...(message.whisper?.length ? { whisper: [...message.whisper], blind: message.blind === true } : {}),
              content: `<div class="spycraft2 chat-note"><p>${esc(component === "impact" ? loc`Falling impact: ${amount} ${result.kind} damage; AP ${result.armorPiercing}.` : loc`Falling stress: ${amount} damage.`)}</p><p>${esc(loc`Actual fall ${result.actualDistanceFeet} ft.; damage distance ${result.damageDistanceFeet} ft.; ${result.diceCount}d6. Dice: ${result.dice.join(", ") || "—"}; check reduction ${result.checkReduction}.`)}</p>${result.damageDivisor === 2 ? `<p>${esc(loc`Wire Fu: halve impact and stress after other falling reductions, rounding down.`)}</p>` : ""}</div>`,
              flags: {
                spycraft2: {
                  actorUuid: actor.uuid,
                  checkKind: "damage",
                  resolved: true,
                  rawTotal: amount,
                  effectiveTotal: amount,
                  sourceAttack: { targetUuid: actor.uuid },
                  fallingDamage: {
                    id,
                    component,
                    kind: component === "stress" ? "stress" : result.kind,
                    armorPiercing: component === "stress" ? 0 : result.armorPiercing,
                    triggerUuid: message.uuid
                  }
                }
              }
            });
          } catch (error) {
            card = postedReceipt(actor, "fallingDamage", id);
            if (!card) throw error;
          }
        }
        record = { ...record, cards: { ...record.cards, [component]: card.uuid } };
        await save(actor, message, record);
      }
      if (result.sprawled)
        await setConditionStatus(actor, "sprawled", true, { label: loc`Sprawled`, operationId: record.id });
      record = { ...record, state: "complete" };
      await save(actor, message, record);
      return record;
    },
    { messages: [message] }
  );
}

export function fallingDamageControls({ actor, message, check }) {
  if (
    !actor?.isOwner ||
    check.superseded ||
    !check.fallDistance ||
    !eligibleFall(check) ||
    currentResult(actor, message)?.state === "complete"
  )
    return null;
  return [{ label: loc`Resolve falling damage`, run: () => resolveFallingDamage(actor, message) }];
}
