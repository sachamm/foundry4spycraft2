/** Hazards in play: exposing a character to a contagion or a fire, the saves they call for and what follows. */
import { esc } from "../html.mjs";
import { refuse } from "../error-notices.mjs";
import { campaignStressPolicy, campaignStressDamage } from "../rules/campaign-combat.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import {
  FIRE_AP,
  FIRE_REDUCTIONS,
  SCAR_SAVE_DC,
  attributeLoss,
  burningRoundPlan,
  contagionDue,
  contagionLabel,
  contagionSaveOutcome,
  contagionSavePlan,
  cureContagion,
  dosePenalty,
  exposurePlan,
  fireDamagePlan,
  hazardState,
  ignitePlan,
  parseOnset,
  reduceFire,
  rollOnGround,
  scarChecked
} from "../rules/hazards.mjs";
import { attributeDamagePlan } from "../rules/attribute-damage.mjs";
import { notTheFaceCharismaResistance } from "../rules/not-the-face.mjs";
import { DAMAGE_TYPE_LABELS, SURVIVAL_LABELS } from "../rules/damage-types.mjs";
import { coverFireOutcome } from "../rules/combat-actions.mjs";
import { CONTAGIONS } from "../rules/tables.mjs";
import { applyAccumulatedDamage } from "./damage-ledger.mjs";
import { postNonLethalDamage } from "./nonlethal-damage.mjs";
import { markCard } from "./gc-relay.mjs";
import { setCondition, woundConditions } from "./wound-conditions.mjs";
import { lethalHitPlan, lethalHitLines } from "../rules/damage-application.mjs";
import { currentInjuryEffects } from "../rules/gc/campaign.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { loc } from "../i18n.mjs";

const now = () => game.time?.worldTime ?? 0;
const owned = actor => actor?.isOwner === true;

/** Roll a formula from the tables ("3d4", "1"): a plain number is not rolled. */
export async function rollTotal(formula) {
  if (/^\d+$/.test(String(formula))) return { total: Number(formula), roll: null };
  const roll = await new Roll(String(formula)).evaluate();
  return { total: roll.total, roll };
}

export const post = (actor, lines, rolls = []) =>
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: lines
      .filter(Boolean)
      .map(line => `<p>${line}</p>`)
      .join(""),
    rolls: rolls.filter(Boolean)
  });

/** How long until a time, in the largest unit that fits. */
export function timeUntil(seconds) {
  if (seconds <= 0) return loc`now`;
  const units = [
    [31536000, n => loc`${n} year(s)`],
    [604800, n => loc`${n} week(s)`],
    [86400, n => loc`${n} day(s)`],
    [3600, n => loc`${n} hour(s)`],
    [60, n => loc`${n} minute(s)`],
    [6, n => loc`${n} round(s)`]
  ];
  for (const [size, label] of units) if (seconds >= size) return label(Math.ceil(seconds / size));
  return loc`1 round`;
}

/** What a sheet shows for a character's hazards. */
export function hazardsView(actor) {
  const state = hazardState(actor.system),
    time = now();
  return {
    contagions: Object.values(state.contagions).map(entry => {
      const plan = contagionSavePlan(entry);
      return {
        id: entry.id,
        label: entry.label,
        doses: entry.doses,
        phase: entry.phase === "primary" ? loc`primary phase` : loc`secondary phase`,
        dc: plan.dc,
        effect: plan.effect,
        due: contagionDue(entry, time),
        dueIn: timeUntil(entry.dueAt - time)
      };
    }),
    fire: state.fire,
    acid: state.acid,
    exposure: state.exposure
      ? { ...state.exposure, label: DAMAGE_TYPE_LABELS[state.exposure.type] ?? state.exposure.type }
      : null,
    survival: Object.entries(state.survival).map(([kind, entry]) => ({
      kind,
      label: SURVIVAL_LABELS[kind] ?? kind,
      saves: entry.saves
    })),
    any: Object.keys(state.contagions).length > 0 || !!state.fire || !!state.acid || !!state.exposure
  };
}

export async function writeHazards(actor, hazards) {
  // "==" replaces the hazards record whole (so ended contagions drop out) without touching the rest of `system`.
  // A non-recursive update would replace all of `system` and reset the character to defaults.
  await actor.update({ "system.==hazards": hazards });
}

/** Take lethal damage off vitality, then wounds, where the character tracks them. Returns what was lost. */
export async function sufferLethal(actor, amount) {
  if (!Number.isFinite(actor.system.vitality?.max) || !actor.system.vitality.max) return null;
  const system = actor.system,
    plan = lethalHitPlan(
      {
        vitality: system.vitality?.value,
        wounds: system.wounds?.value,
        woundsMax: system.wounds?.max,
        deathThreshold: system.deathThreshold
      },
      { damage: amount },
      currentInjuryEffects()
    );
  await actor.update({ "system.vitality.value": plan.vitality, "system.wounds.value": plan.wounds });
  // The same fatigue and wound conditions as any other lethal hit (p.331); notes report what was set.
  // Only the condition lines: callers already report the vitality and wounds lost.
  const notes = lethalHitLines("", { ...plan, vitalityLoss: 0, woundLoss: 0, critical: false, massive: null }).slice(1);
  if (plan.fatigued) notes.push(await setCondition(actor, "fatigued", loc`Fatigued`));
  if (plan.stateChanged) notes.push(...(await woundConditions(actor, plan.state)));
  return { ...plan, notes: notes.filter(Boolean) };
}

/** Record stress through the damage ledger, so resistances and thresholds apply. Returns a note on failure. */
export async function sufferStress(actor, amount, source, damageMode = "stressBeforeResistance") {
  if (!amount) return "";
  if (actor.type !== "agent") {
    amount = campaignStressDamage(
      amount,
      campaignStressPolicy(actor.system.campaignEffects),
      damageMode === "fireStressBeforeDefenses" && actor.system.activeFeatNames?.includes("Firefighter Training")
        ? [0.5]
        : []
    ).adjustedDamage;
    // An NPC keeps a running total instead of a ledger; a standard NPC takes it through its Damage save.
    if (!(Number(actor.system.vitality?.max) > 0))
      return campaignStressPolicy(actor.system.campaignEffects)
        ? loc`${amount} stress damage after campaign modifiers: roll the Damage save and mark that these modifiers are already included.`
        : loc`${amount} stress damage: roll the Damage save for it.`;
    await postNonLethalDamage(actor, "stress", amount, source, { campaignStressAdjusted: true });
    return loc`${amount} stress damage recorded; any required Will save is on its damage report.`;
  }
  try {
    await applyAccumulatedDamage(actor, {
      source: `${source} [${foundry.utils.randomID(6)}]`,
      kind: "stress",
      newDamage: amount,
      damageMode,
      confirmed: true
    });
    return loc`${amount} stress damage recorded.`;
  } catch (error) {
    return loc`${amount} stress damage could not be recorded (${esc(error.message)}); record it by hand.`;
  }
}

/** Apply a rolled attribute loss. Returns the line that reports it. */
export async function sufferAttributeLoss(actor, effect, rolled, source) {
  const lines = [];
  let total = 0;
  for (const loss of attributeLoss(effect, rolled)) {
    if (actor.type !== "agent") {
      // An NPC's attributes are the numbers on its sheet: lower the score itself.
      const score = Math.max(0, Math.trunc(Number(actor.system.abilities?.[loss.ability]?.value) || 0)),
        resistance = loss.ability === "cha" ? notTheFaceCharismaResistance(actor.system) : 0,
        amount = Math.min(score, Math.max(0, loss.amount - resistance));
      if (resistance) lines.push(loc`Not the Face resists ${Math.min(loss.amount, resistance)} Charisma damage.`);
      if (amount) await actor.update({ [`system.abilities.${loss.ability}.value`]: score - amount });
      total += amount;
      lines.push(
        loss.kind === "permanent"
          ? loc`${amount} permanent ${loss.ability.toUpperCase()} damage: the score is now ${score - amount}.`
          : loc`${amount} ${loss.ability.toUpperCase()} damage: the score is now ${score - amount}. Raise it again by hand as it heals.`
      );
      continue;
    }
    try {
      const plan = attributeDamagePlan(actor.system, {
        id: foundry.utils.randomID(),
        ability: loss.ability,
        kind: loss.kind,
        amount: loss.amount,
        source,
        confirmed: true,
        worldTime: now()
      });
      await actor.update({ "system.attributeDamage": plan.record });
      total += plan.event.amount;
      if (plan.event.resistance)
        lines.push(loc`Not the Face resists ${Math.min(plan.event.requested, plan.event.resistance)} Charisma damage.`);
      lines.push(
        loss.kind === "permanent"
          ? loc`${plan.event.amount} permanent ${loss.ability.toUpperCase()} damage.`
          : loc`${plan.event.amount} ${loss.ability.toUpperCase()} damage.`
      );
    } catch (error) {
      lines.push(
        loc`${loss.amount} ${loss.kind} ${loss.ability.toUpperCase()} damage could not be recorded (${esc(error.message)}); the GC applies it.`
      );
    }
  }
  return { lines, total };
}

/* -------------------------------------------- */
/*  Contagions                                   */
/* -------------------------------------------- */

/** Expose a character to a contagion from Table 4.70. */
export async function exposeToContagion(actor, options = {}) {
  if (!owned(actor)) return null;
  let input = options;
  if (!input.contagion) {
    const groups = { disease: loc`Diseases`, poison: loc`Poisons` };
    const choices = Object.entries(groups)
      .map(
        ([kind, label]) =>
          `<optgroup label="${esc(label)}">${CONTAGIONS.map((contagion, index) => [contagion, index])
            .filter(([contagion]) => contagion.kind === kind)
            .map(
              ([contagion, index]) =>
                `<option value="${index}">${esc(contagionLabel(contagion))} — ${loc`DC ${contagion.primary.saveDC}, onset ${esc(contagion.primary.onset)}`}</option>`
            )
            .join("")}</optgroup>`
      )
      .join("");
    input = await systemDialog.input({
      window: { title: loc`Expose to a contagion` },
      rejectClose: false,
      ok: { label: loc`Expose` },
      content: `<div class="spycraft2-roll-options"><label>${loc`Contagion`} <select name="index">${choices}</select></label><label>${loc`Doses`} <input type="number" name="doses" value="1" min="1" step="1" /></label><p class="hint">${loc`The onset time is rolled now. When it has passed, roll the Fortitude save from the sheet. Extra doses of a contagion already at work lower its saves by 1 each (p.335).`}</p></div>`
    });
    if (!input) return null;
    input = { contagion: CONTAGIONS[Number(input.index)], doses: Number(input.doses) || 1 };
  }
  const contagion = input.contagion,
    onset = parseOnset(contagion.primary.onset),
    rolled = await rollTotal(onset.formula);
  let plan;
  try {
    plan = exposurePlan(hazardState(actor.system), contagion, {
      id: foundry.utils.randomID(),
      worldTime: now(),
      onsetRoll: rolled.total,
      doses: Math.max(1, Math.trunc(input.doses ?? 1))
    });
  } catch (error) {
    return refuse(error.message);
  }
  await writeHazards(actor, plan.hazards);
  await post(
    actor,
    [
      plan.added
        ? loc`Exposed to ${esc(plan.entry.label)}: Fortitude save DC ${plan.entry.primary.saveDC} in ${rolled.total} ${onset.unit}(s).`
        : loc`Another dose of ${esc(plan.entry.label)}: ${plan.entry.doses} doses, saves at ${dosePenalty(plan.entry.doses)}.`
    ],
    plan.added ? [rolled.roll] : []
  );
  return plan.entry;
}

/** Roll the Fortitude save a contagion calls for. The posted save carries a button that applies its result. */
export async function rollContagionSave(actor, id, options = {}) {
  if (!owned(actor)) return null;
  const entry = hazardState(actor.system).contagions[id];
  if (!entry) return refuse(loc`This contagion is no longer being tracked.`);
  let sealedSuit = options.sealedSuit === true;
  if (options.sealedSuit === undefined && entry.phase === "primary" && /radiation/i.test(entry.name)) {
    const input = await systemDialog.input({
      window: { title: entry.label },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><label><input type="checkbox" name="sealedSuit" /> ${loc`Wearing a sealed radiation or space suit (+10 to this save)`}</label></div>`
    });
    if (!input) return null;
    sealedSuit = input.sealedSuit === true;
  }
  const plan = contagionSavePlan(entry, { sealedSuit });
  return actor.rollSave("fort", { askContext: true, hazardSave: { kind: "contagion", ...plan } });
}

/** End a contagion: an antidote, or the GC's word. */
export async function cureHazard(actor, id) {
  if (!owned(actor)) return null;
  const state = hazardState(actor.system),
    entry = state.contagions[id];
  if (!entry) return null;
  await writeHazards(actor, cureContagion(state, id));
  await post(actor, [loc`${esc(entry.label)} ended (antidote or GC ruling).`]);
  return true;
}

async function resolveContagionSave(actor, message, save, succeeded) {
  const state = hazardState(actor.system),
    entry = state.contagions[save.id];
  if (!entry) return refuse(loc`This contagion is no longer being tracked.`);
  if (succeeded) {
    const outcome = contagionSaveOutcome(state, save.id, { succeeded: true });
    await writeHazards(actor, outcome.hazards);
    await post(actor, [loc`${esc(entry.label)}: the save succeeds and the contagion is shaken off.`]);
    return outcome;
  }
  const onset = parseOnset(entry.secondary.onset),
    rolled = await rollTotal(onset.formula);
  const outcome = contagionSaveOutcome(state, save.id, { succeeded: false, worldTime: now(), onsetRoll: rolled.total });
  await writeHazards(actor, outcome.hazards);
  const lines = [loc`${esc(entry.label)}: the save fails (${esc(save.effect)}).`],
    rolls = [rolled.roll];
  let attributePoints = 0;
  const source = loc`Contagion: ${entry.label}`;
  for (const effect of outcome.effects) {
    if (effect.kind === "note") {
      lines.push(loc`The GC applies: ${esc(effect.text)}.`);
      continue;
    }
    const amount = await rollTotal(effect.formula);
    rolls.push(amount.roll);
    if (effect.kind === "attribute") {
      const result = await sufferAttributeLoss(actor, effect, amount.total, source);
      lines.push(...result.lines);
      attributePoints += result.total;
    } else if (effect.kind === "lethal") {
      const loss = await sufferLethal(actor, amount.total);
      lines.push(
        loss
          ? loc`${amount.total} lethal damage: vitality −${loss.vitalityLoss}, wounds −${loss.woundLoss}.`
          : loc`${amount.total} lethal damage: the GC applies it.`,
        ...(loss?.notes ?? [])
      );
    } else if (effect.kind === "condition") {
      const status = CONFIG.statusEffects?.find(s => s.id === effect.condition);
      if (status && actor.toggleStatusEffect) await actor.toggleStatusEffect(effect.condition, { active: true });
      lines.push(
        loc`${esc(effect.condition)} for ${amount.total} ${effect.unit}(s); the GC ends it when the time is up.`
      );
    }
  }
  // Attribute points lost to a contagion are matched by stress damage (p.335).
  lines.push(await sufferStress(actor, attributePoints, source));
  lines.push(
    loc`Next Fortitude save: DC ${outcome.entry.secondary.saveDC} in ${rolled.total} ${onset.unit}(s) (${esc(outcome.entry.secondary.effect)} on a failure).`
  );
  await post(actor, lines, rolls);
  return outcome;
}

/* -------------------------------------------- */
/*  Fire                                         */
/* -------------------------------------------- */

/** Fire damage taken now: vitality and wounds, matching stress, and the running total for this fire. */
async function sufferFire(actor, state, damage, reduction, label) {
  const taken = Math.max(0, damage - Math.max(0, reduction)),
    loss = await sufferLethal(actor, taken),
    plan = fireDamagePlan(state.fire, taken);
  const lines = [
    loss
      ? loc`${label}: ${taken} fire damage, vitality −${loss.vitalityLoss}, wounds −${loss.woundLoss}.`
      : loc`${label}: ${taken} fire damage; the GC applies it (a standard character saves against it).`,
    ...(loss?.notes ?? [])
  ];
  const lost = loss ? loss.vitalityLoss + loss.woundLoss : taken;
  lines.push(await sufferStress(actor, lost, loc`Fire`, "fireStressBeforeDefenses"));
  if (plan.scarSaveDue)
    lines.push(
      loc`This fire has now done ${plan.fire.suffered} damage: make the Fortitude save (DC ${SCAR_SAVE_DC}) against scarring from the sheet.`
    );
  return { lines, fire: plan.fire };
}

/** A fire in the character's square, contact with a fire, or a fire attack: damage now, then a save or catch fire. */
export async function exposeToFire(actor, options = {}) {
  if (!owned(actor)) return null;
  let input = options;
  if (input.damage === undefined) {
    input = await systemDialog.input({
      window: { title: loc`Fire` },
      rejectClose: false,
      ok: { label: loc`Apply` },
      content: `<div class="spycraft2-roll-options"><label>${loc`The fire's current damage`} <input type="number" name="damage" min="1" step="1" required /></label><label>${loc`Temperature (sets the armor-piercing value)`} <select name="band">${FIRE_AP.map(band => `<option value="${band.id}"${band.id === "t1500" ? " selected" : ""}>${Number.isFinite(band.upTo) ? loc`up to ${band.upTo}°F — AP ${band.ap}` : loc`hotter — AP ${band.ap}`}</option>`).join("")}</select></label><label>${loc`Damage reduction left after armor-piercing`} <input type="number" name="reduction" value="0" min="0" step="1" /></label><label><input type="checkbox" name="save" checked /> ${loc`Ten or more points in the square: roll a Reflex save or catch fire`}</label></div>`
    });
    if (!input) return null;
    input = {
      damage: Math.trunc(Number(input.damage)),
      ap: FIRE_AP.find(band => band.id === input.band)?.ap ?? 0,
      reduction: Math.trunc(Number(input.reduction) || 0),
      save: input.save === true
    };
  }
  if (!Number.isSafeInteger(input.damage) || input.damage < 1)
    return refuse(loc`Enter the fire's damage as a whole number.`);
  const state = hazardState(actor.system),
    result = await sufferFire(actor, state, input.damage, input.reduction ?? 0, loc`Fire (AP ${input.ap ?? 0})`);
  if (result.fire) await writeHazards(actor, { ...state, fire: result.fire });
  await post(actor, result.lines);
  if (input.save === false || input.damage < 10) return true;
  return actor.rollSave("ref", {
    askContext: true,
    hazardSave: { kind: "fire", label: loc`Catch fire`, dc: input.damage, damage: input.damage, ap: input.ap ?? 0 }
  });
}

/** The start of a burning character's round. */
export async function burningRound(actor, options = {}) {
  if (!owned(actor)) return null;
  const state = hazardState(actor.system);
  if (!state.fire) return refuse(loc`This character is not on fire.`);
  let reduction = options.reduction;
  if (reduction === undefined) {
    const input = await systemDialog.input({
      window: { title: loc`Burning: start of the round` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`The fire does ${state.fire.damage} damage (AP ${state.fire.ap}).`}</p><label>${loc`Damage reduction left after armor-piercing`} <input type="number" name="reduction" value="0" min="0" step="1" /></label></div>`
    });
    if (!input) return null;
    reduction = Math.trunc(Number(input.reduction) || 0);
  }
  const plan = burningRoundPlan(state),
    result = await sufferFire(actor, state, plan.damage, reduction, loc`Burning (AP ${state.fire.ap})`);
  await writeHazards(actor, { ...state, fire: result.fire });
  result.lines.push(
    loc`To do anything but leave the fire, drop prone and roll, make a Will save against DC ${state.fire.damage} (p.337).`
  );
  await post(actor, result.lines);
  return result.fire;
}

/** Fight the fire on a character: roll on the ground, or take dice off it with water, a blanket or an extinguisher. */
export async function fightFire(actor, method) {
  if (!owned(actor)) return null;
  const state = hazardState(actor.system);
  if (!state.fire) return null;
  let next,
    line,
    roll = null;
  if (method === "roll") {
    next = rollOnGround(state);
    line = loc`Rolls on unburnt ground for a half action: the fire is halved.`;
  } else {
    const reduction = FIRE_REDUCTIONS.find(r => r.id === method);
    if (!reduction) return null;
    const rolled = await rollTotal(reduction.formula);
    roll = rolled.roll;
    next = reduceFire(state, rolled.total);
    line = loc`The fire is fought (${reduction.formula}): −${rolled.total}.`;
  }
  await writeHazards(actor, next);
  await post(
    actor,
    [line, next.fire ? loc`The fire now does ${next.fire.damage} damage.` : loc`The fire is out.`],
    [roll]
  );
  return next.fire;
}

/** The Will save a burning character needs to act freely, or the Fortitude save against scarring. */
export async function rollFireSave(actor, kind) {
  if (!owned(actor)) return null;
  const fire = hazardState(actor.system).fire;
  if (!fire) return null;
  if (kind === "will")
    return actor.rollSave("will", {
      askContext: true,
      hazardSave: { kind: "burningWill", label: loc`Act while burning`, dc: fire.damage, resolved: true }
    });
  return actor.rollSave("fort", {
    askContext: true,
    hazardSave: { kind: "scar", label: loc`Scarring`, dc: SCAR_SAVE_DC }
  });
}

/** Put the fire out by the GC's word. */
export async function extinguish(actor) {
  if (!owned(actor)) return null;
  const state = hazardState(actor.system);
  if (!state.fire) return null;
  await writeHazards(actor, { ...state, fire: null });
  await post(actor, [loc`The fire is out.`]);
  return true;
}

/* -------------------------------------------- */
/*  Applying a hazard save's result              */
/* -------------------------------------------- */

/**
 * Resolvers for hazard save kinds owned by other modules (module/apps/damage-types.mjs, combat-options.mjs):
 * kind → async (actor, message, save, succeeded, check). Each registers from its own module.
 */
export const hazardSaveResolvers = new Map();

/** Freeze a posted save before applying its effects; an interrupted application may retry the frozen result. */
export async function resolveHazardSave(actor, message) {
  let check = message.flags?.spycraft2,
    save = check?.hazardSave;
  if (!save || save.resolved || check.superseded || !owned(actor) || check.actorUuid !== actor.uuid) return null;
  if (message.blind && !game.user?.isGM) return refuse(loc`The GC resolves secret results.`);
  if (!Number.isFinite(save.dc) || !Number.isFinite(check.effectiveTotal)) return null;
  if (!check.resolved) {
    if (typeof check.successConfirmed !== "boolean") {
      const confirmed = await actor.confirmCheckOutcome(message, {
        succeeded: check.effectiveTotal >= save.dc,
        difficultyClass: save.dc
      });
      if (!confirmed) return null;
    }
    if (!(await actor.finishCheck(message))) return null;
    check = message.flags?.spycraft2;
    save = check?.hazardSave;
    if (!check?.resolved || check.superseded || !save || save.resolved) return null;
  }
  const succeeded =
    typeof check.successConfirmed === "boolean" ? check.successConfirmed : check.effectiveTotal >= save.dc;
  if (hazardSaveResolvers.has(save.kind))
    await hazardSaveResolvers.get(save.kind)(actor, message, save, succeeded, check);
  else if (save.kind === "contagion") await resolveContagionSave(actor, message, save, succeeded);
  else if (save.kind === "fire") {
    if (succeeded) await post(actor, [loc`The save succeeds: the character does not catch fire.`]);
    else {
      await writeHazards(
        actor,
        ignitePlan(hazardState(actor.system), { damage: save.damage, ap: save.ap, worldTime: now() })
      );
      await post(actor, [
        loc`The save fails: the character is on fire and takes ${save.damage} fire damage as each round begins.`
      ]);
    }
  } else if (save.kind === "coverFire") {
    const outcome = coverFireOutcome(save.dc, check.effectiveTotal);
    await post(actor, [
      !outcome.failed
        ? loc`Cover Fire: the save succeeds; no penalty.`
        : outcome.finalAttack
          ? loc`Cover Fire: the save fails by 5 or more. –4 to attack and skill checks for a round, and ${esc(save.attackerName ?? loc`the attacker`)} may spend an action die on a final attack.`
          : loc`Cover Fire: the save fails. –4 to attack and skill checks for a round.`
    ]);
  } else if (save.kind === "scar") {
    const state = hazardState(actor.system);
    if (state.fire) await writeHazards(actor, scarChecked(state));
    if (succeeded) await post(actor, [loc`The save succeeds: no scarring.`]);
    else {
      const result = await sufferAttributeLoss(actor, { ability: "cha", permanent: "all" }, 1, loc`Fire scarring`);
      await post(actor, [loc`The save fails: scarring.`, ...result.lines]);
    }
  }
  await markCard(message, "hazardSave.resolved");
  return succeeded;
}

rollPipeline.register({
  id: "hazardSaveControl",
  kinds: ["save"],
  order: 9730,
  chatControls({ message, check, actor }) {
    if (!check.hazardSave || check.hazardSave.resolved || check.superseded) return null;
    return [{ label: loc`Apply this save's result`, run: () => resolveHazardSave(actor, message) }];
  }
});
