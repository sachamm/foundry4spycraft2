/**
 * Healing that is not bought with action dice (pp.141–143, 333, 341): rest, First Aid, Stabilize and a dying
 * character's roll each round. The rules are in module/rules/damage-application.mjs and module/rules/health.mjs.
 */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { recoveryRatePlan } from "../rules/health.mjs";
import {
  dyingPlan,
  firstAidPlan,
  firstAidStandard,
  restPlan,
  wearOffPlan,
  woundState
} from "../rules/damage-application.mjs";
import { validateDamageLedger } from "../rules/accumulated-damage.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { damageSaveState, npcIsSpecial, resetDamageTrack } from "./gc/npc-play.mjs";
import { sceneEpoch } from "./gc/state.mjs";
import { nonLethalTotals, targetChoices } from "./damage-application.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { askGC, gcAvailable, markCard, registerRelay, requesterConcern } from "./gc-relay.mjs";
import { loc } from "../i18n.mjs";
import { refuse } from "../error-notices.mjs";

const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
const isSpecial = actor => actor.type === "agent" || (actor.type === "npc" && npcIsSpecial(actor));
const healthOf = actor => ({
  vitality: actor.system.vitality?.value ?? 0,
  vitalityMax: actor.system.vitality?.max ?? 0,
  wounds: actor.system.wounds?.value ?? 0,
  woundsMax: actor.system.wounds?.max ?? 0
});
const post = (actor, lines, rolls = []) =>
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="spycraft2 chat-note">${lines
      .filter(Boolean)
      .map(line => `<p>${line}</p>`)
      .join("")}</div>`,
    ...(rolls.length ? { rolls } : {})
  });

async function clear(actor, id, label, aliases = []) {
  if (!actor.statuses?.has(id)) return "";
  try {
    await setConditionStatus(actor, id, false, { label, aliases });
    return loc`No longer ${label.toLowerCase()}.`;
  } catch {
    return loc`${label} comes from another source: clear it by hand.`;
  }
}

/** Lift Unconscious, unless it is a knockout whose time has yet to run out. */
async function wake(actor) {
  const timed = [...(actor.effects ?? [])].some(
    effect =>
      effect.statuses?.has("unconscious") &&
      effect.flags?.spycraft2?.timed === true &&
      Number.isFinite(effect.duration?.value) &&
      effect.duration.expired !== true
  );
  return timed ? "" : clear(actor, "unconscious", loc`Unconscious`);
}

/* -------------------------------------------- */
/*  Rest                                         */
/* -------------------------------------------- */

/** Rest for some hours and days: vitality and wounds come back at the character's natural rates. */
export async function restAndRecover(actor, options = {}) {
  if (!actor?.isOwner || !isSpecial(actor)) return null;
  let input = options;
  if (input.hours === undefined && input.days === undefined) {
    input = await systemDialog.input({
      window: { title: loc`${actor.name}: rest` },
      rejectClose: false,
      ok: { label: loc`Rest` },
      content: `<div class="spycraft2-roll-options"><label>${loc`Hours of rest (vitality)`} <input type="number" name="hours" min="0" step="1" value="8" /></label><label>${loc`Days of rest (wounds)`} <input type="number" name="days" min="0" step="1" value="0" /></label><label>${loc`Medicine/Treatment for these days`} <select name="treatment"><option value="none">${loc`None`}</option><option value="success">${loc`Success (×2)`}</option><option value="threat">${loc`Threat (×3)`}</option><option value="criticalSuccess">${loc`Activated critical success (×5)`}</option><option value="error">${loc`An error: no natural healing`}</option></select></label><label><input type="checkbox" name="poorForaging" /> ${loc`Failed Survival/Foraging (half rate)`}</label><label><input type="checkbox" name="interest" /> ${loc`An hour or more spent on Interests (stress wears off faster)`}</label><p class="hint">${loc`Rest means light activity and no combat. Stress and subdual damage wear off over the same time, at the rate their totals set.`}</p></div>`
    });
    if (!input) return null;
  }
  const hours = Number(input.hours) || 0,
    days = Number(input.days) || 0;
  let rates, plan;
  try {
    // An NPC has no career level; its Threat Level stands in for it.
    const system =
      actor.type === "agent"
        ? actor.system
        : { ...actor.system, level: actor.system.level ?? actor.system.effectiveThreatLevel ?? 1 };
    rates = recoveryRatePlan(system, {
      treatment: input.treatment ?? "none",
      interest: input.interest === true,
      poorForaging: input.poorForaging === true
    });
    plan = restPlan(healthOf(actor), {
      hours,
      days,
      vitalityPerHour: rates.vitalityPerHour,
      woundsPerDay: rates.woundsPerDay
    });
  } catch (error) {
    return refuse(error.message);
  }
  if (plan.vitalityGain || plan.woundGain)
    await actor.update({ "system.vitality.value": plan.vitality, "system.wounds.value": plan.wounds });
  const lines = [
    loc`${esc(actor.name)} rests ${hours} hour(s) and ${days} day(s): vitality +${plan.vitalityGain} (now ${plan.vitality}), wounds +${plan.woundGain} (now ${plan.wounds}).`
  ];
  lines.push(...(await wearOff(actor, rates, hours * 3600 + days * 86400)));
  // Fatigue from lost vitality or wounds lifts after 8 hours of rest (p.341).
  if (hours + days * 24 >= 8) lines.push(await clear(actor, "fatigued", loc`Fatigued`));
  if (plan.wounds > 0) {
    lines.push(await clear(actor, "dying", loc`Dying`));
    // Back above 0 wounds a character wakes, unless a knockout still has time to run.
    if (plan.wounds - plan.woundGain <= 0) lines.push(await wake(actor));
  }
  await post(actor, lines);
  return plan;
}

/**
 * Stress and subdual damage wearing off over a rest (Tables 5.8 and 5.9). An agent's totals are in the ledger; a
 * special NPC's are two running numbers.
 */
async function wearOff(actor, rates, seconds) {
  const agent = actor.type === "agent",
    ledger = agent ? actor.system.accumulatedDamage : null;
  if (agent) {
    try {
      validateDamageLedger(ledger);
    } catch {
      return [];
    }
    if (ledger.pending.length)
      return [loc`Stress and subdual damage are left as they are: a damage save is still waiting on the sheet.`];
  }
  const before = agent ? { stress: ledger.stress, subdual: ledger.subdual } : nonLethalTotals(actor);
  const stress = wearOffPlan(before.stress, rates.stress, seconds),
    subdual = wearOffPlan(before.subdual, rates.subdual, seconds);
  if (!stress.recovered && !subdual.recovered) return [];
  if (agent)
    await actor.update({
      "system.accumulatedDamage": {
        ...ledger,
        revision: ledger.revision + 1,
        stress: stress.total,
        subdual: subdual.total
      }
    });
  else await actor.update({ "flags.spycraft2.nonLethal": { stress: stress.total, subdual: subdual.total } });
  return [
    loc`Stress damage ${before.stress} → ${stress.total}; subdual damage ${before.subdual} → ${subdual.total}.`,
    stress.recovered ? loc`A Shaken condition ends when stress damage drops below its threshold: review it.` : ""
  ];
}

/* -------------------------------------------- */
/*  Dying                                        */
/* -------------------------------------------- */

/** A dying character's d% at the end of the round. */
export async function rollDying(actor) {
  if (!actor?.isOwner || !isSpecial(actor)) return null;
  const wounds = actor.system.wounds?.value ?? 0;
  const death = actor.system.deathThreshold;
  if (woundState(wounds, death) !== "dying")
    return refuse(loc`${actor.name} is not dying (below 0 wounds, above the death threshold).`);
  const roll = await new Roll("1d100").evaluate();
  let plan;
  try {
    plan = dyingPlan({ wounds, constitution: actor.system.abilities?.con?.value, deathThreshold: death }, roll.total);
  } catch (error) {
    return refuse(error.message);
  }
  await actor.update({ "system.wounds.value": plan.wounds });
  const lines = [
    plan.stabilized
      ? loc`${esc(actor.name)} rolls ${roll.total} against Constitution ${actor.system.abilities?.con?.value}: stabilized at 0 wounds, still unconscious.`
      : loc`${esc(actor.name)} rolls ${roll.total} against Constitution ${actor.system.abilities?.con?.value}: loses 1 wound, now ${plan.wounds}.`
  ];
  if (plan.stabilized) lines.push(await clear(actor, "dying", loc`Dying`));
  if (plan.state === "dead") {
    lines.push(await clear(actor, "dying", loc`Dying`));
    try {
      await setConditionStatus(actor, "dead", true, { label: loc`Dead` });
      lines.push(loc`At –10 wounds: dead.`);
    } catch {
      lines.push(loc`At –10 wounds: dead. Set the condition by hand.`);
    }
  }
  await post(actor, lines, [roll]);
  return plan;
}

/* -------------------------------------------- */
/*  First Aid and Stabilize                      */
/* -------------------------------------------- */

async function choosePatient(title, hint) {
  const choices = targetChoices(),
    patients = choices.actors.filter(actor => (actor.isOwner || gcAvailable()) && actor.type !== "vehicle");
  if (!patients.length) {
    ui.notifications.warn(
      loc`There is no patient to treat: no GC is connected to apply healing to another player's character.`
    );
    return null;
  }
  const input = await systemDialog.input({
    window: { title },
    rejectClose: false,
    ok: { label: loc`Apply` },
    content: `<div class="spycraft2-roll-options"><label>${loc`Patient`} <select name="patientUuid" required>${patients
      .map(
        actor =>
          `<option value="${esc(actor.uuid)}"${actor.uuid === choices.selected ? " selected" : ""}>${esc(actor.isOwner ? actor.name : loc`${actor.name} (sent to the GC)`)}</option>`
      )
      .join("")}</select></label><p class="hint">${hint}</p></div>`
  });
  return input ? fromUuid(input.patientUuid) : null;
}

/** Subdual damage healed on a character who keeps a ledger. Returns the amount actually healed, or null. */
async function healSubdual(patient, amount) {
  const ledger = patient.system.accumulatedDamage;
  try {
    validateDamageLedger(ledger);
  } catch {
    return null;
  }
  if (ledger.pending.length) return null;
  const healed = Math.min(ledger.subdual, amount);
  if (healed)
    await patient.update({
      "system.accumulatedDamage": { ...ledger, revision: ledger.revision + 1, subdual: ledger.subdual - healed }
    });
  return healed;
}

async function healNpcSubdual(patient, amount) {
  const totals = nonLethalTotals(patient),
    healed = Math.min(totals.subdual, amount);
  if (healed) await patient.update({ "flags.spycraft2.nonLethal": { ...totals, subdual: totals.subdual - healed } });
  return healed;
}

/** Another player's character: the GC's client applies the treatment. */
async function relayHealing(kind, message, patient) {
  try {
    ui.notifications.info(loc`Sent to the GC: treatment for ${patient.name}.`);
    return await askGC("applyHealing", { messageId: message.id, kind, patientUuid: patient.uuid });
  } catch (error) {
    return refuse(error.message);
  }
}

registerRelay("applyHealing", {
  concerns: ({ messageId }, user) => [requesterConcern(game.messages.get(messageId), user)],
  async describe({ kind, patientUuid }, user) {
    const patient = patientUuid ? await fromUuid(patientUuid) : null;
    if (!patient) throw new Error(loc`The patient is no longer there.`);
    return kind === "stabilize"
      ? loc`${esc(user.name)} stabilizes ${esc(patient.name)}. Allow it?`
      : loc`${esc(user.name)} applies First Aid to ${esc(patient.name)}. Allow it?`;
  },
  async run({ messageId, kind, patientUuid }) {
    const message = game.messages.get(messageId),
      patient = patientUuid ? await fromUuid(patientUuid) : null;
    if (!message || !patient) throw new Error(loc`The check or its patient is no longer there.`);
    const done =
      kind === "stabilize" ? await applyStabilize(message, { patient }) : await applyFirstAid(message, { patient });
    if (done !== true) throw new Error(loc`The GC’s client did not apply the healing; the GC sees why.`);
    return true;
  }
});

/** Apply a successful First Aid check to a patient, once per patient per scene. */
export async function applyFirstAid(message, options = {}) {
  const check = message.flags?.spycraft2;
  if (check?.successConfirmed !== true || check.firstAid) return null;
  const patient =
    options.patient ??
    (await choosePatient(
      loc`First Aid: patient`,
      loc`A special character regains 1d4+1 wounds, 1d4+1 subdual damage and vitality equal to career level. A standard character loses half the damage accumulated. Once per patient per scene.`
    ));
  if (!patient) return null;
  if (!patient.isOwner) return relayHealing("firstAid", message, patient);
  const scene = String(sceneEpoch());
  if (patient.flags?.spycraft2?.firstAidScene === scene)
    return refuse(loc`${patient.name} has already had First Aid this scene.`);
  const lines = [],
    rolls = [];
  if (isSpecial(patient)) {
    const woundRoll = await new Roll("1d4 + 1").evaluate(),
      subdualRoll = await new Roll("1d4 + 1").evaluate();
    rolls.push(woundRoll, subdualRoll);
    const ledger = patient.system.accumulatedDamage;
    const plan = firstAidPlan(
      {
        ...healthOf(patient),
        subdual: patient.type === "agent" ? (ledger?.subdual ?? 0) : nonLethalTotals(patient).subdual,
        level: patient.system.level ?? patient.system.effectiveThreatLevel ?? 0
      },
      { wounds: woundRoll.total, subdual: subdualRoll.total }
    );
    await patient.update({ "system.vitality.value": plan.vitality, "system.wounds.value": plan.wounds });
    lines.push(
      loc`First Aid on ${esc(patient.name)}: wounds +${plan.woundGain} (now ${plan.wounds}), vitality +${plan.vitalityGain} (now ${plan.vitality}).`
    );
    const healed =
      patient.type === "agent"
        ? await healSubdual(patient, subdualRoll.total)
        : await healNpcSubdual(patient, subdualRoll.total);
    lines.push(
      healed === null
        ? loc`Subdual damage healed: ${subdualRoll.total}. Take it off the recorded total by hand.`
        : loc`Subdual damage healed: ${healed}.`
    );
    if (plan.wounds > 0) {
      lines.push(await clear(patient, "dying", loc`Dying`));
      if (plan.wounds - plan.woundGain <= 0) lines.push(await wake(patient));
    }
  } else {
    const state = damageSaveState(patient),
      plan = firstAidStandard(state.track.accumulated);
    await resetDamageTrack(patient, { heal: plan.healed });
    lines.push(
      loc`First Aid on ${esc(patient.name)}: accumulated damage ${state.track.accumulated} → ${plan.accumulated}.`
    );
  }
  // The same check at DC 20 also stops bleeding (p.340).
  if (Number(check.effectiveTotal) >= 20) lines.push(await clear(patient, "bleeding", loc`Bleeding`));
  await patient.update({ "flags.spycraft2.firstAidScene": scene });
  await post(patient, lines, rolls);
  await markCard(message, "firstAid", { patientUuid: patient.uuid, name: patient.name });
  return true;
}

/** Apply a successful Stabilize check: a dying patient stops at 0 wounds, still unconscious (p.341). */
export async function applyStabilize(message, options = {}) {
  const check = message.flags?.spycraft2;
  if (check?.successConfirmed !== true || check.stabilized) return null;
  const patient =
    options.patient ??
    (await choosePatient(loc`Stabilize: patient`, loc`A dying character stops losing wounds and stays unconscious.`));
  if (!patient) return null;
  if (!patient.isOwner) return relayHealing("stabilize", message, patient);
  if (woundState(patient.system.wounds?.value ?? 0, patient.system.deathThreshold) !== "dying")
    return refuse(loc`${patient.name} is not dying (below 0 wounds, above the death threshold).`);
  await patient.update({ "system.wounds.value": 0 });
  await post(patient, [
    loc`${esc(patient.name)} is stabilized at 0 wounds and stays unconscious.`,
    await clear(patient, "dying", loc`Dying`)
  ]);
  await markCard(message, "stabilized", { patientUuid: patient.uuid, name: patient.name });
  return true;
}

rollPipeline.register({
  id: "medicalAidControl",
  kinds: ["skill"],
  order: 9773,
  chatControls({ message, check }) {
    if (check.skillKey !== "medicine" || check.successConfirmed !== true || check.superseded) return null;
    if (check.checkId === "first-aid" && !check.firstAid)
      return [{ label: loc`Apply First Aid to the patient`, run: () => applyFirstAid(message) }];
    if (check.checkId === "stabilize" && !check.stabilized)
      return [{ label: loc`Stabilize the patient`, run: () => applyStabilize(message) }];
    return null;
  }
});
