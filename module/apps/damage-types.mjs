import { classFeatureLevels } from "../rules/class-features.mjs";
/**
 * Other damage types and survival saves in play (pp.333–340, 349). The rules are in module/rules/damage-types.mjs;
 * saves go through the hazard save hook (module/apps/hazards.mjs), stress and subdual through the damage ledger.
 */
import { esc } from "../html.mjs";
import { refuse } from "../error-notices.mjs";
import {
  DAMAGE_TYPES,
  DAMAGE_TYPE_LABELS,
  HEAT_ARMOR_PENALTY,
  INJURY_SAVE_DC,
  SURVIVAL_LABELS,
  SURVIVAL_SAVES,
  VACUUM,
  acidFirstDamage,
  acidHitsArmor,
  acidInjuryChecked,
  acidRoundPlan,
  acidSavePlan,
  addExposure,
  applyAcid,
  bangOutcome,
  breathRounds,
  electricalFailure,
  endExposure,
  explosiveDamageTaken,
  explosiveSavePlan,
  explosiveStunRounds,
  exposureInterval,
  flashOutcome,
  halveAcid,
  survivalFailure,
  survivalReset,
  survivalSaveMade,
  survivalSavePlan,
  typedStress,
  vacuumDamage
} from "../rules/damage-types.mjs";
import { hazardState } from "../rules/hazards.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import {
  hazardSaveResolvers,
  post,
  rollTotal,
  sufferAttributeLoss,
  sufferLethal,
  sufferStress,
  writeHazards
} from "./hazards.mjs";
import { applyAccumulatedDamage } from "./damage-ledger.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { loc } from "../i18n.mjs";
import { ignoresSuccessfulHalfSave } from "../rules/campaign-combat.mjs";
import { currentCampaignRules } from "../rules/gc/campaign.mjs";

const halfSavePolicy = actor => ({
  ignoreSuccessfulHalfSave: ignoresSuccessfulHalfSave(actor, currentCampaignRules().effects)
});
const ignoresHazard = (actor, save, succeeded) => succeeded === true && ignoresSuccessfulHalfSave(actor, save);
const ignoredHazard = actor =>
  post(actor, [loc`Blockbuster: the successful save prevents this damage and its effects.`]);

const now = () => game.time?.worldTime ?? 0;
const owned = actor => actor?.isOwner === true;
const has = (actor, id) => actor.statuses?.has(id) === true;
const ARMORS = () => [
  ["none", loc`None`],
  ["partial", loc`Partial`],
  ["moderate", loc`Moderate`],
  ["full", loc`Full`]
];
const options = rows => rows.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join("");

/** Turn on a condition for a number of rounds; the GC ends it when the time is up. */
async function condition(actor, id, rounds, label) {
  try {
    await setConditionStatus(actor, id, true, { label });
    return rounds ? loc`${label} for ${rounds} round(s); end it when the time is up.` : loc`${label}.`;
  } catch (error) {
    return loc`${label} could not be applied (${esc(error.message)}); apply it by hand.`;
  }
}

/** Record subdual damage through the ledger, so thresholds and the Fortitude save follow. */
async function sufferSubdual(actor, amount, source) {
  if (!amount) return "";
  try {
    await applyAccumulatedDamage(actor, {
      source: `${source} [${foundry.utils.randomID(6)}]`,
      kind: "subdual",
      newDamage: amount,
      damageMode: "subdualBeforeDefenses",
      confirmed: true
    });
    return loc`${amount} subdual damage recorded; roll any Fortitude save it calls for from the sheet.`;
  } catch (error) {
    return loc`${amount} subdual damage could not be recorded (${esc(error.message)}); record it by hand.`;
  }
}

/** Lethal damage now and the stress its type adds for what was lost. Returns the report lines. */
async function sufferTypedLethal(actor, type, amount, label) {
  const loss = await sufferLethal(actor, amount),
    lines = [
      loss
        ? loc`${label}: ${amount} damage, vitality −${loss.vitalityLoss}, wounds −${loss.woundLoss}.`
        : loc`${label}: ${amount} damage; the GC applies it (a standard character makes a Damage save).`,
      ...(loss?.notes ?? [])
    ],
    lost = loss ? loss.vitalityLoss + loss.woundLoss : amount,
    stress = typedStress(type, lost);
  let points = stress.points;
  const rolls = [];
  if (stress.formula) {
    const flat = await rollTotal(stress.formula);
    rolls.push(flat.roll);
    points += flat.total;
  }
  lines.push(await sufferStress(actor, points, label));
  return { lines, rolls, lost };
}

/** Ask for an injury save that a running total of one type has earned. */
function injurySave(actor, type, injury, where) {
  return actor.rollSave("fort", {
    askContext: true,
    hazardSave: {
      kind: "typedInjury",
      label: loc`${DAMAGE_TYPE_LABELS[type]} injury`,
      dc: INJURY_SAVE_DC,
      type,
      at: injury.at,
      ability: injury.ability ?? null,
      condition: injury.condition ?? null,
      duration: injury.duration ?? null,
      where
    }
  });
}

/* -------------------------------------------- */
/*  Taking a damage type                         */
/* -------------------------------------------- */

/** Dialog: suffer one of the other damage types. */
export async function sufferTypedDamage(actor, preset = {}) {
  if (!owned(actor)) return null;
  let input = preset;
  // `review` opens the dialog with what is already known filled in, for the circumstances only the table knows.
  const known = preset.review === true ? preset : {},
    mark = (html, value) => (value ? html.replace(`value="${esc(value)}"`, `value="${esc(value)}" selected`) : html);
  if (!input.type || preset.review === true) {
    input = await systemDialog.input({
      window: { title: loc`Other damage types` },
      rejectClose: false,
      ok: { label: loc`Apply` },
      content: `<div class="spycraft2-roll-options">
        <label>${loc`Damage type`} <select name="type">${mark(
          options(
            Object.keys(DAMAGE_TYPES)
              .filter(type => !preset.allowed || preset.allowed.includes(type))
              .map(type => [type, `${DAMAGE_TYPE_LABELS[type]} (p.${DAMAGE_TYPES[type].page})`])
          ),
          known.type
        )}</select></label>
        <label>${loc`Damage rolled (bang and flash: the damage in the character's square, which is the DC)`} <input type="number" name="amount" min="0" step="1" value="${Number.isFinite(known.amount) ? known.amount : ""}" required /></label>
        <label>${loc`Damage reduction left after armor-piercing (acid, collision, explosive, laser)`} <input type="number" name="reduction" min="0" step="1" value="${Number.isFinite(known.reduction) ? known.reduction : 0}" /></label>
        <label>${loc`Armor worn (acid, heat)`} <select name="armor">${options(ARMORS())}</select></label>
        <label>${loc`Acid: half actions given up next Count to shed armor or an item (+1 each)`} <input type="number" name="halfActions" min="0" max="2" step="1" value="0" /></label>
        <label>${loc`Explosive: moved during the last Count`} <select name="moved">${options([
          ["none", loc`No`],
          ["half", loc`Half action move (+4)`],
          ["full", loc`Full action move (+8)`]
        ])}</select></label>
        <label><input type="checkbox" name="cannotMove" /> ${loc`Explosive: cannot move out of the increment`}</label>
        <label><input type="checkbox" name="halfCover" /> ${loc`Explosive: at least half cover from the blast`}</label>
        <label><input type="checkbox" name="firstRound" checked /> ${loc`Vacuum: first round (a Fortitude save halves it)`}</label>
        <label>${loc`Cold or heat: temperature (°F)`} <input type="number" name="temperature" step="1" /></label>
        <label>${loc`Cold or heat: in`} <select name="medium">${options([
          ["air", loc`Air`],
          ["liquid", loc`Liquid`]
        ])}</select></label>
        <label>${loc`Source (a running total is kept per source)`} <input type="text" name="source" value="${esc(known.source ?? "")}" /></label>
        <p class="hint">${loc`Bang, flash, acid, explosive and first-round vacuum call for a save; its card applies the result. Cold, heat and electrical damage are subdual.`}</p>
      </div>`
    });
    if (!input) return null;
  }
  const type = String(input.type),
    amount = Math.trunc(Number(input.amount)),
    reduction = Math.max(0, Math.trunc(Number(input.reduction) || 0)),
    source = String(input.source ?? "").trim() || DAMAGE_TYPE_LABELS[type] || type;
  if (!DAMAGE_TYPES[type] || (preset.allowed && !preset.allowed.includes(type)))
    return refuse(loc`Choose a listed damage type.`);
  if (!Number.isSafeInteger(amount) || amount < 0) return refuse(loc`Enter the damage as a whole number.`);
  const label = DAMAGE_TYPE_LABELS[type];
  try {
    switch (type) {
      case "bang":
        if (has(actor, "deaf")) return post(actor, [loc`Bang: a deafened character is not affected (p.334).`]);
        return actor.rollSave("fort", { askContext: true, hazardSave: { kind: "bang", label, dc: amount } });
      case "flash":
        if (has(actor, "blind")) return post(actor, [loc`Flash: a blinded character is not affected (p.338).`]);
        return actor.rollSave("fort", { askContext: true, hazardSave: { kind: "flash", label, dc: amount } });
      case "acid":
        return startAcid(actor, { amount, reduction, armor: input.armor ?? "none", halfActions: input.halfActions });
      case "explosive":
        return startExplosive(actor, { ...input, amount, reduction });
      case "vacuum":
        return startVacuum(actor, { amount, firstRound: input.firstRound !== false, source });
      case "cold":
      case "heat":
        return sufferSurroundings(actor, type, { ...input, amount, source });
      case "electrical":
        return sufferElectrical(actor, { amount, source });
      default: {
        const result = await sufferTypedLethal(actor, type, Math.max(0, amount - reduction), label);
        if (type === "collision" && (classFeatureLevels(actor.system)?.stuntman ?? 0) >= 4)
          result.lines.push(
            loc`Fall Guy: each collision damage die is 2 lower (minimum 1 per die); lower the damage entered if that was not done.`
          );
        if (type === "laser")
          result.lines.push(
            loc`Laser: one damage die fewer per range increment past the first; it ignores dodge bonuses (p.338).`
          );
        return post(actor, result.lines, result.rolls);
      }
    }
  } catch (error) {
    return refuse(error.message);
  }
}

async function startAcid(actor, { amount, reduction, armor, halfActions }) {
  const lines = [],
    rolls = [];
  let dr = reduction;
  if (armor !== "none") {
    const roll = await rollTotal("1d6");
    rolls.push(roll.roll);
    const hit = acidHitsArmor(armor, roll.total);
    if (hit) lines.push(loc`Acid strikes the armor (1d6: ${roll.total}): the armor makes a Damage save against it.`);
    else {
      dr = 0;
      lines.push(loc`Acid strikes the clothes (1d6: ${roll.total}): the armor's damage reduction does not apply.`);
    }
  }
  const plan = acidSavePlan(amount, Math.trunc(Number(halfActions) || 0));
  if (lines.length) await post(actor, lines, rolls);
  return actor.rollSave("ref", {
    askContext: true,
    hazardSave: {
      kind: "acid",
      ...halfSavePolicy(actor),
      label: DAMAGE_TYPE_LABELS.acid,
      dc: plan.dc,
      bonus: plan.bonus,
      bonusLabel: loc`Half actions given up`,
      damage: amount,
      reduction: dr
    }
  });
}

async function startExplosive(actor, input) {
  const plan = explosiveSavePlan(input.amount, {
    moved: input.moved ?? "none",
    cannotMove: input.cannotMove === true,
    halfCover: input.halfCover === true
  });
  const save = {
    kind: "explosiveReflex",
    ...halfSavePolicy(actor),
    label: loc`Explosive (Reflex)`,
    dc: plan.dc,
    bonus: plan.bonus,
    bonusLabel: loc`Moved before the blast`,
    damage: plan.dc,
    reduction: input.reduction ?? 0
  };
  if (plan.reflexFails) {
    await post(actor, [loc`Explosive: no room to move and less than half cover, so the Reflex save fails (p.336).`]);
    return resolveExplosiveReflex(actor, null, save, false);
  }
  return actor.rollSave("ref", { askContext: true, hazardSave: save });
}

async function startVacuum(actor, { amount, firstRound, source }) {
  let rolled = amount;
  const rolls = [];
  if (!rolled) {
    const roll = await rollTotal(VACUUM.formula);
    rolls.push(roll.roll);
    rolled = roll.total;
  }
  if (firstRound) {
    if (rolls.length) await post(actor, [loc`Vacuum: ${rolled} damage rolled.`], rolls);
    return actor.rollSave("fort", {
      askContext: true,
      hazardSave: {
        kind: "vacuum",
        ...halfSavePolicy(actor),
        label: DAMAGE_TYPE_LABELS.vacuum,
        dc: VACUUM.saveDC,
        damage: rolled,
        source
      }
    });
  }
  return applyVacuum(actor, rolled, source, rolls);
}

async function applyVacuum(actor, damage, source, rolls = []) {
  const result = await sufferTypedLethal(actor, "vacuum", damage, DAMAGE_TYPE_LABELS.vacuum);
  result.lines.push(loc`A character in vacuum is also suffocating (p.349).`);
  const tracked = addExposure(hazardState(actor.system), {
    type: "vacuum",
    amount: result.lost,
    source,
    worldTime: now(),
    interval: 6
  });
  await writeHazards(actor, tracked.hazards);
  await post(actor, result.lines, [...rolls, ...result.rolls]);
  for (const injury of tracked.injuries) await injurySave(actor, "vacuum", injury, "exposure");
  return true;
}

async function sufferSurroundings(actor, type, { amount, source, temperature, medium, armor }) {
  const lines = [await sufferSubdual(actor, amount, DAMAGE_TYPE_LABELS[type])];
  let interval = null;
  if (temperature !== undefined && temperature !== null && String(temperature).trim() !== "") {
    interval = exposureInterval(type, Number(temperature), medium ?? "air");
    lines.push(
      interval
        ? loc`At this temperature it strikes again every ${interval >= 3600 ? loc`${interval / 3600} hour(s)` : interval >= 60 ? loc`${interval / 60} minute(s)` : loc`round`}. While not fatigued, a Survival (Wis) check (DC 20) doubles the time once per increment.`
        : loc`This temperature deals no ${DAMAGE_TYPE_LABELS[type]} damage.`
    );
  }
  if (type === "heat" && HEAT_ARMOR_PENALTY[armor])
    lines.push(loc`Armor worn: ${HEAT_ARMOR_PENALTY[armor]} to the Fortitude save against this subdual damage.`);
  lines.push(
    loc`If that Fortitude save fails, use "Failed save" on the sheet: fatigued and 1 point of temporary ${type === "cold" ? "Con" : "Str"} damage, neither recovered until the character leaves the source.`
  );
  const tracked = addExposure(hazardState(actor.system), { type, amount, source, worldTime: now(), interval });
  await writeHazards(actor, tracked.hazards);
  await post(actor, lines);
  for (const injury of tracked.injuries) await injurySave(actor, type, injury, "exposure");
  return true;
}

async function sufferElectrical(actor, { amount, source }) {
  const lines = [
    await sufferSubdual(actor, amount, DAMAGE_TYPE_LABELS.electrical),
    loc`If that Fortitude save fails, use "Failed save" on the sheet: nauseated for 1d6 rounds and Initiative Count −${Math.floor(amount / 2)}.`
  ];
  // Electrical injuries count a single attack, so each attack is its own source.
  const tracked = addExposure(hazardState(actor.system), {
    type: "electrical",
    amount,
    source: `${source} ${foundry.utils.randomID(4)}`,
    worldTime: now()
  });
  await writeHazards(actor, { ...tracked.hazards, exposure: { ...tracked.hazards.exposure, lastDamage: amount } });
  await post(actor, lines);
  for (const injury of tracked.injuries) await injurySave(actor, "electrical", injury, "exposure");
  return true;
}

/* -------------------------------------------- */
/*  Sheet buttons                                */
/* -------------------------------------------- */

/** Acid on a character: start of round, end of round, washing, the injury save. */
export async function acidStep(actor, step) {
  if (!owned(actor)) return null;
  const state = hazardState(actor.system);
  if (!state.acid) return refuse(loc`No acid is on this character.`);
  if (step === "round") {
    const plan = acidRoundPlan(state),
      result = await sufferTypedLethal(actor, "acid", plan.damage, loc`Acid (lingering)`);
    await writeHazards(actor, plan.hazards);
    if (plan.injurySaveDue) result.lines.push(loc`This acid has now done 25 or more damage: roll the injury save.`);
    return post(actor, result.lines, result.rolls);
  }
  if (step === "end" || step === "wash") {
    const next = halveAcid(state);
    await writeHazards(actor, next);
    return post(actor, [
      step === "wash" ? loc`A full action washing the acid: it is halved.` : loc`End of the round: the acid is halved.`,
      next.acid ? loc`The acid now does ${next.acid.damage} damage.` : loc`The acid is gone.`
    ]);
  }
  if (step === "injury") return injurySave(actor, "acid", DAMAGE_TYPES.acid.injuries[0], "acid");
  return null;
}

/** Cold, heat or electrical: the Fortitude save against its subdual damage failed. */
export async function exposureFailedSave(actor) {
  if (!owned(actor)) return null;
  const exposure = hazardState(actor.system).exposure;
  if (!exposure) return null;
  const lines = [];
  if (exposure.type === "electrical") {
    const combatant = game.combat?.started
        ? [...game.combat.combatants].find(c => c.actor?.uuid === actor.uuid && Number.isFinite(c.initiative))
        : null,
      failure = electricalFailure(exposure.lastDamage ?? exposure.suffered, combatant?.initiative ?? null),
      nauseated = await rollTotal(failure.nauseated);
    lines.push(await condition(actor, "nauseated", nauseated.total, loc`Nauseated`));
    if (failure.unconsciousMinutes !== null) {
      lines.push(await condition(actor, "unconscious", 0, loc`Unconscious`));
      lines.push(
        loc`Instead of reeling, the character is unconscious for ${failure.unconsciousMinutes} minute(s) (p.335).`
      );
    } else if (failure.countLoss) {
      lines.push(loc`Initiative Count −${failure.countLoss}; record it as a fluid initiative event (Electrical).`);
    }
    return post(actor, lines, [nauseated.roll]);
  }
  const rule = DAMAGE_TYPES[exposure.type]?.failedSave;
  if (!rule) return null;
  lines.push(await condition(actor, "fatigued", 0, loc`Fatigued`));
  const result = await sufferAttributeLoss(
    actor,
    { ability: rule.ability, permanent: "none" },
    1,
    DAMAGE_TYPE_LABELS[exposure.type]
  );
  lines.push(...result.lines);
  lines.push(loc`Neither recovers until the character escapes the ${DAMAGE_TYPE_LABELS[exposure.type]} (p.334).`);
  return post(actor, lines);
}

/** The character leaves the source of cold, heat, vacuum or the shock. */
export async function endTypedExposure(actor) {
  if (!owned(actor)) return null;
  await writeHazards(actor, endExposure(hazardState(actor.system)));
  return post(actor, [loc`The character is clear of the source; its running total ends.`]);
}

/** Dialog: a save against a survival hazard whose DC rises each time (p.349). */
export async function survivalSave(actor, preset = {}) {
  if (!owned(actor)) return null;
  let input = preset;
  const state = hazardState(actor.system);
  if (!input.kind) {
    input = await systemDialog.input({
      window: { title: loc`Survival save` },
      rejectClose: false,
      ok: { label: loc`Roll` },
      content: `<div class="spycraft2-roll-options">
        <label>${loc`Hazard`} <select name="kind">${options(Object.keys(SURVIVAL_SAVES).map(kind => [kind, `${SURVIVAL_LABELS[kind]} — DC ${survivalSavePlan(state, kind).dc}`]))}</select></label>
        <label>${loc`Days without food or water`} <input type="number" name="days" min="1" step="1" value="1" /></label>
        <label>${loc`Depth (feet)`} <input type="number" name="depth" min="100" step="1" value="100" /></label>
        <p class="hint">${loc`Breath can be held for ${breathRounds(actor.system)} rounds (twice Constitution) before suffocation saves begin. Staying awake 24 hours leaves the character fatigued.`}</p>
      </div>`
    });
    if (!input) return null;
  }
  const plan = survivalSavePlan(state, input.kind);
  return actor.rollSave("fort", {
    askContext: true,
    hazardSave: {
      kind: "survival",
      label: SURVIVAL_LABELS[plan.kind],
      dc: plan.dc,
      survival: plan.kind,
      days: Math.max(1, Math.trunc(Number(input.days) || 1)),
      depth: Math.max(0, Math.trunc(Number(input.depth) || 0))
    }
  });
}

/** The survival hazard has ended: the next save starts at its base DC. */
export async function endSurvivalHazard(actor, kind) {
  if (!owned(actor)) return null;
  await writeHazards(actor, survivalReset(hazardState(actor.system), kind));
  return post(actor, [loc`${SURVIVAL_LABELS[kind]}: over; the next save starts again at its base DC.`]);
}

/* -------------------------------------------- */
/*  Resolving the saves                          */
/* -------------------------------------------- */

const total = check => Number(check?.effectiveTotal);

async function resolveExplosiveReflex(actor, message, save, succeeded) {
  if (ignoresHazard(actor, save, succeeded)) return ignoredHazard(actor);
  const taken = Math.max(0, explosiveDamageTaken(save.damage, succeeded) - Math.max(0, save.reduction ?? 0)),
    result = await sufferTypedLethal(actor, "explosive", taken, DAMAGE_TYPE_LABELS.explosive);
  result.lines.unshift(
    succeeded
      ? loc`The Reflex save succeeds: half damage, and the character moves to the next blast increment out.`
      : loc`The Reflex save fails: full damage.`
  );
  // More than 20 points suffered, counted after the Reflex save but before damage reduction (p.302).
  if (explosiveDamageTaken(save.damage, succeeded) > 20)
    result.lines.push(loc`More than 20 explosive damage: the takedown effect applies (p.302).`);
  await post(actor, result.lines, result.rolls);
  return actor.rollSave("fort", {
    askContext: true,
    hazardSave: {
      kind: "explosiveFort",
      label: loc`Explosive (Fortitude)`,
      dc: save.dc,
      bonus: save.bonus ?? 0,
      bonusLabel: save.bonusLabel ?? loc`Moved before the blast`
    }
  });
}

const resolvers = {
  async bang(actor, message, save, succeeded, check) {
    const outcome = bangOutcome(save.dc, total(check), { deafened: has(actor, "deaf") });
    const lines = [];
    if (succeeded || !outcome.stunned) lines.push(loc`Bang: the save succeeds.`);
    else {
      lines.push(await condition(actor, "stun", outcome.stunned, loc`Stunned`));
      lines.push(await condition(actor, "deaf", outcome.deafened, loc`Deafened`));
      const stress = await rollTotal(outcome.stress);
      lines.push(await sufferStress(actor, stress.total, DAMAGE_TYPE_LABELS.bang));
      await post(actor, lines, [stress.roll]);
      lines.length = 0;
    }
    if (outcome.takedown) lines.push(loc`More than 20 bang damage: the takedown effect applies (p.302).`);
    if (lines.length) await post(actor, lines);
  },
  async flash(actor, message, save, succeeded, check) {
    const outcome = flashOutcome(save.dc, total(check), { blinded: has(actor, "blind") });
    if (succeeded || !outcome.blinded) return post(actor, [loc`Flash: the save succeeds.`]);
    const stress = await rollTotal(outcome.stress);
    return post(
      actor,
      [
        await condition(actor, "blind", outcome.blinded, loc`Blinded`),
        await sufferStress(actor, stress.total, DAMAGE_TYPE_LABELS.flash)
      ],
      [stress.roll]
    );
  },
  async acid(actor, message, save, succeeded) {
    if (ignoresHazard(actor, save, succeeded)) return ignoredHazard(actor);
    const first = acidFirstDamage(save.damage, succeeded),
      taken = Math.max(0, first - Math.max(0, save.reduction ?? 0)),
      result = await sufferTypedLethal(actor, "acid", taken, DAMAGE_TYPE_LABELS.acid);
    result.lines.unshift(
      succeeded ? loc`The Reflex save succeeds: the acid is halved.` : loc`The Reflex save fails: full acid damage.`
    );
    const next = applyAcid(hazardState(actor.system), { damage: first, suffered: taken, worldTime: now() });
    await writeHazards(actor, next);
    if (next.acid)
      result.lines.push(
        loc`The acid lingers: ${next.acid.damage} damage as each round starts, halved as each round ends or with each full action washing it.`
      );
    await post(actor, result.lines, result.rolls);
  },
  explosiveReflex: resolveExplosiveReflex,
  async explosiveFort(actor, message, save, succeeded, check) {
    if (succeeded) return post(actor, [loc`Explosive: the Fortitude save succeeds.`]);
    const rounds = explosiveStunRounds(save.dc, total(check));
    return post(actor, [rounds ? await condition(actor, "stun", rounds, loc`Stunned`) : loc`Explosive: no stun.`]);
  },
  async vacuum(actor, message, save, succeeded) {
    if (ignoresHazard(actor, save, succeeded)) return ignoredHazard(actor);
    const damage = vacuumDamage(save.damage, { firstRound: true, saved: succeeded });
    return applyVacuum(actor, damage, save.source ?? DAMAGE_TYPE_LABELS.vacuum);
  },
  async typedInjury(actor, message, save, succeeded) {
    const state = hazardState(actor.system);
    if (save.where === "acid") await writeHazards(actor, acidInjuryChecked(state));
    else if (state.exposure)
      await writeHazards(actor, {
        ...state,
        exposure: {
          ...state.exposure,
          injuriesChecked: [...new Set([...(state.exposure.injuriesChecked ?? []), save.at])]
        }
      });
    if (succeeded) return post(actor, [loc`${esc(save.label)}: the save succeeds.`]);
    if (save.ability) {
      const result = await sufferAttributeLoss(actor, { ability: save.ability, permanent: "all" }, 1, save.label);
      return post(actor, [loc`${esc(save.label)}: the save fails.`, ...result.lines]);
    }
    const rounds = await rollTotal(save.duration ?? "1");
    return post(
      actor,
      [loc`${esc(save.label)}: the save fails.`, await condition(actor, save.condition, rounds.total, loc`Paralyzed`)],
      [rounds.roll]
    );
  },
  async survival(actor, message, save, succeeded) {
    await writeHazards(actor, survivalSaveMade(hazardState(actor.system), save.survival, { worldTime: now() }));
    const next = survivalSavePlan(hazardState(actor.system), save.survival).dc;
    if (succeeded) return post(actor, [loc`${esc(save.label)}: the save succeeds. The next one is DC ${next}.`]);
    const failure = survivalFailure(save.survival, {
        standard: actor.type !== "agent",
        days: save.days,
        depth: save.depth
      }),
      lines = [loc`${esc(save.label)}: the save fails. The next one is DC ${next}.`],
      rolls = [];
    if (failure.vitalityToZero && Number.isFinite(actor.system.vitality?.max)) {
      await actor.update({ "system.vitality.value": 0 });
      lines.push(loc`Vitality drops to 0.`);
    }
    if (failure.lethal) {
      const damage = await rollTotal(failure.lethal);
      rolls.push(damage.roll);
      const loss = await sufferLethal(actor, damage.total);
      lines.push(
        loss
          ? loc`${damage.total} lethal damage: vitality −${loss.vitalityLoss}, wounds −${loss.woundLoss}.`
          : loc`${damage.total} lethal damage: the GC applies it.`,
        ...(loss?.notes ?? [])
      );
    }
    if (failure.subdual) {
      const damage = await rollTotal(failure.subdual);
      rolls.push(damage.roll);
      lines.push(await sufferSubdual(actor, damage.total, save.label));
    }
    for (const entry of failure.conditions) {
      const id = entry.id;
      lines.push(await condition(actor, id, 0, id === "fatigued" ? loc`Fatigued` : loc`Unconscious`));
      if (entry.duration) {
        const time = await rollTotal(entry.duration);
        rolls.push(time.roll);
        lines.push(loc`For ${time.total} ${entry.unit}(s).`);
      }
    }
    lines.push(...failure.notes);
    return post(actor, lines, rolls);
  }
};
for (const [kind, resolve] of Object.entries(resolvers)) hazardSaveResolvers.set(kind, resolve);
