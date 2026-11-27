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
  acidSavePlan,
  addExposure,
  bangOutcome,
  breathRounds,
  electricalFailure,
  endExposure,
  explosiveDamageTaken,
  explosiveSavePlan,
  explosiveStunRounds,
  exposureInterval,
  flashOutcome,
  survivalFailure,
  survivalReset,
  survivalSaveMade,
  survivalSavePlan,
  typedStress,
  typedHitContext,
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
  sufferBruise,
  sufferStress,
  writeHazards
} from "./hazards.mjs";
import { applyAccumulatedDamage } from "./damage-ledger.mjs";
import { postNonLethalDamage } from "./nonlethal-damage.mjs";
import { drForAttack, drWithoutWornArmor, reducedDamage } from "../rules/damage-application.mjs";
import { npcDamageSave } from "./gc/npc-damage-save.mjs";
import { npcIsSpecial } from "../rules/gc/npc-state.mjs";
import { evasionSaveContext, reflexDamagePlan } from "../rules/save-avoidance.mjs";
import { damageResistanceSource, damageResistancePlan, subdualTypeSource } from "../rules/resistances.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { loc } from "../i18n.mjs";
import { ignoresSuccessfulHalfSave } from "../rules/campaign-combat.mjs";
import { currentCampaignRules } from "../rules/gc/campaign.mjs";
import {
  acidSourceId,
  acidAttackPlan,
  readAcidSource,
  beginAcidRound,
  settleAcidRound,
  halveAcidSource
} from "../rules/acid-sources.mjs";
import { rollAcidSourceInjury, markAcidSourceInjury, migrateAcidHistory, reviewAcidSource } from "./acid-sources.mjs";
import { queueResources } from "../services/transactions.mjs";
import { same } from "../rules/equal.mjs";
import { snapshot, undoEntry, postUndo } from "./undo.mjs";

const halfSavePolicy = actor => ({
  ignoreSuccessfulHalfSave: ignoresSuccessfulHalfSave(actor, currentCampaignRules().effects)
});
const ignoresHazard = (actor, save, succeeded) => succeeded === true && ignoresSuccessfulHalfSave(actor, save);
const ignoredHazard = actor =>
  post(actor, [loc`Blockbuster: the successful save prevents this damage and its effects.`]);

const now = () => game.time?.worldTime ?? 0;
const owned = actor => actor?.isOwner === true;
const has = (actor, id) => actor.statuses?.has(id) === true;
const equippedArmorIds = actor =>
  [...(actor.items ?? [])]
    .filter(
      item =>
        item.type === "armor" &&
        item.system?.equipped &&
        item.system.carried !== false &&
        !item.system.reserve &&
        !item.system.destroyed
    )
    .map(item => item.uuid ?? item.id)
    .filter(Boolean)
    .sort();
const acidDefenses = (actor, context, ap) => ({
  unarmored: Math.max(0, drWithoutWornArmor(actor.system, context.attackKind, context.weaponProficiency) - ap),
  armored: Math.max(0, drForAttack(actor.system, context.attackKind, context.weaponProficiency) - ap),
  armorIds: equippedArmorIds(actor)
});
const acidCombat = actor =>
  game.combat?.started &&
  Number.isSafeInteger(game.combat.round) &&
  game.combat.round >= 1 &&
  [...(game.combat.combatants ?? [])].some(c => c.actor?.uuid === actor.uuid)
    ? { id: game.combat.id, round: game.combat.round }
    : null;
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
async function sufferSubdual(actor, amount, source, defenses = {}, hitContext = {}, typedDamageType = null) {
  if (!amount) return { line: "", net: 0 };
  const context = typedHitContext(hitContext);
  if (actor.type === "npc" && !npcIsSpecial(actor)) {
    const dr = drForAttack(actor.system, context.attackKind, context.weaponProficiency),
      reduction = defenses.armorPiercingAll ? 0 : 2 * Math.max(0, dr - (defenses.armorPiercing ?? 0)),
      reduced = reducedDamage({ damage: amount, dr: reduction }),
      net = reduced.net + (reduced.stopped ? 1 : 0),
      generic = damageResistancePlan(actor.system, "subdual", net),
      typedSource = subdualTypeSource(actor.system, typedDamageType),
      final = typedSource
        ? damageResistancePlan(actor.system, typedDamageType, generic.net, typedSource).net
        : generic.net;
    if (context.critical && reduced.stopped && final)
      throw Error(loc`The GC must review this critical hit's bruising before applying its subdual save.`);
    const result = net
      ? await npcDamageSave(actor, {
          damage: net,
          kind: "subdual",
          criticalDice: context.criticalDice,
          blast: context.blast,
          typedDamageType
        })
      : null;
    if (net && !result)
      throw Error(
        loc`The standard character's subdual Damage save was not recorded. Review its actual damage before retrying.`
      );
    const applied = result?.damage ?? net;
    return {
      line: applied
        ? loc`${applied} subdual damage after defenses; the standard character's Damage save is recorded separately.`
        : loc`Damage reduction and resistance prevent the subdual damage; no Damage save is required.`,
      net: applied
    };
  }
  if (actor.type === "npc" && Number(actor.system.vitality?.max) > 0) {
    const result = await postNonLethalDamage(actor, "subdual", amount, source, {
      ...defenses,
      ...context,
      typedDamageType
    });
    return {
      line: loc`${result.net} subdual damage recorded; any required Fortitude save is on its damage report.`,
      net: result.net
    };
  }
  const record = await applyAccumulatedDamage(actor, {
    source: `${source} [${foundry.utils.randomID(6)}]`,
    kind: "subdual",
    newDamage: amount,
    damageMode: "subdualBeforeDefenses",
    typedDamageType,
    ...defenses,
    attackKind: context.attackKind,
    weaponProficiency: context.weaponProficiency,
    criticalHit: context.critical,
    confirmed: true
  });
  if (!record) throw Error(loc`The typed subdual event was not recorded. Review the actual damage before continuing.`);
  return {
    line: loc`${record.newDamage} subdual damage recorded; roll any Fortitude save it calls for from the sheet.`,
    net: record.newDamage
  };
}

/** Lethal damage now and the stress its type adds for what was lost. Returns the report lines. */
async function sufferTypedLethal(
  actor,
  type,
  amount,
  label,
  hitContext = {},
  resistanceSource,
  { stopped = false, bruiseResistanceSource } = {}
) {
  const resistance = damageResistancePlan(actor.system, type, amount, resistanceSource);
  const bruise =
    stopped && !resistance.negatesEffects ? await sufferBruise(actor, hitContext, bruiseResistanceSource, label) : "";
  amount = resistance.net;
  const loss = await sufferLethal(actor, amount, hitContext);
  if (!loss)
    throw Error(
      loc`Typed lethal damage was not recorded. Review the character's actual health and ownership before continuing.`
    );
  const lines = [
      loss?.standard
        ? amount
          ? loc`${label}: ${amount} damage; the standard character's Damage save is recorded separately.`
          : loc`${label}: no lethal damage remains; no Damage save is required.`
        : loc`${label}: ${amount} damage, vitality −${loss.vitalityLoss}, wounds −${loss.woundLoss}.`,
      ...(loss?.notes ?? [])
    ],
    lost = loss.standard ? loss.damage : loss.vitalityLoss + loss.woundLoss,
    stress = typedStress(type, lost);
  if (bruise) lines.push(bruise);
  let points = stress.points;
  const rolls = [];
  if (stress.formula && !resistance.negatesEffects) {
    const flat = await rollTotal(stress.formula);
    rolls.push(flat.roll);
    points += flat.total;
  }
  if (resistance.resisted) lines.push(loc`Resistance prevents ${resistance.resisted} ${label} damage.`);
  if (!resistance.negatesEffects) lines.push(await sufferStress(actor, points, label));
  return {
    lines,
    rolls,
    lost,
    damage: amount,
    resistance,
    effectsPrevented: resistance.negatesEffects || (stopped && type !== "explosive")
  };
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
        <label>${loc`Armor worn (acid, heat)`} <select name="armor">${mark(options(ARMORS()), known.armor)}</select></label>
        <label>${loc`Acid: DR remaining without worn armor, after armor-piercing`} <input type="number" name="unarmoredReduction" min="0" step="1" value="${Number.isSafeInteger(known.unarmoredReduction) ? known.unarmoredReduction : ""}" /></label>
        <label>${loc`Acid: original armor-piercing value`} <input type="number" name="armorPiercing" min="1" step="1" value="${Number.isSafeInteger(known.armorPiercing) ? Math.max(1, known.armorPiercing) : 1}" /></label>
        <label>${loc`Acid: half actions given up next Count to shed armor or an item (+1 each)`} <input type="number" name="halfActions" min="0" max="2" step="1" value="0" /></label>
        <label><input type="checkbox" name="removeArmor" /> ${loc`Acid: those actions remove the worn armor`}</label>
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
    amount = Number(input.amount),
    reduction = Number(input.reduction ?? 0),
    source = String(input.source ?? "").trim() || DAMAGE_TYPE_LABELS[type] || type;
  if (!DAMAGE_TYPES[type] || (preset.allowed && !preset.allowed.includes(type)))
    return refuse(loc`Choose a listed damage type.`);
  if (!Number.isSafeInteger(amount) || amount < 0) return refuse(loc`Enter the damage as a whole number.`);
  if (!Number.isSafeInteger(reduction) || reduction < 0)
    return refuse(loc`Enter damage reduction as a nonnegative whole number.`);
  const label = DAMAGE_TYPE_LABELS[type];
  try {
    const hitContext = typedHitContext(preset.hitContext);
    switch (type) {
      case "bang":
        if (has(actor, "deaf")) return post(actor, [loc`Bang: a deafened character is not affected (p.334).`]);
        {
          const plan = damageResistancePlan(actor.system, type, amount);
          if (!plan.net) return post(actor, [loc`Resistance prevents the bang damage and its accompanying effects.`]);
          return actor.rollSave("fort", {
            askContext: true,
            hazardSave: { kind: "bang", label, dc: plan.net, originalDamage: amount, resistanceSource: plan.source }
          });
        }
      case "flash":
        if (has(actor, "blind")) return post(actor, [loc`Flash: a blinded character is not affected (p.338).`]);
        {
          const plan = damageResistancePlan(actor.system, type, amount);
          if (!plan.net) return post(actor, [loc`Resistance prevents the flash damage and its accompanying effects.`]);
          return actor.rollSave("fort", {
            askContext: true,
            hazardSave: { kind: "flash", label, dc: plan.net, originalDamage: amount, resistanceSource: plan.source }
          });
        }
      case "acid":
        if (
          input.armorPiercing != null &&
          (!Number.isSafeInteger(Number(input.armorPiercing)) || Number(input.armorPiercing) < 1)
        )
          return refuse(loc`Acid requires an original AP value of at least 1; enter the DR left after that AP.`);
        if (
          !Number.isSafeInteger(Number(input.halfActions ?? 0)) ||
          Number(input.halfActions ?? 0) < 0 ||
          Number(input.halfActions ?? 0) > 2
        )
          return refuse(loc`Declare zero, one or two half actions for the acid save.`);
        if (!["none", "partial", "moderate", "full"].includes(input.armor ?? "none"))
          return refuse(loc`Choose the armor coverage before applying acid.`);
        if (
          (input.armor ?? "none") !== "none" &&
          (!Number.isSafeInteger(Number(input.unarmoredReduction)) ||
            Number(input.unarmoredReduction) < 0 ||
            input.unarmoredReduction === "" ||
            input.unarmoredReduction == null ||
            Number(input.unarmoredReduction) > reduction)
        )
          return refuse(loc`Enter the remaining non-armor DR after armor-piercing, no greater than the armored DR.`);
        if (input.removeArmor === true && ((input.armor ?? "none") === "none" || Number(input.halfActions ?? 0) < 1))
          return refuse(loc`Removing armor requires worn armor and at least one declared half action.`);
        return startAcid(actor, {
          amount,
          reduction,
          armor: input.armor ?? "none",
          halfActions: input.halfActions,
          unarmoredReduction: (input.armor ?? "none") === "none" ? reduction : Number(input.unarmoredReduction),
          removeArmor: input.removeArmor === true,
          armorPiercing: input.armorPiercing,
          sourceId: input.sourceId,
          sourceLabel: input.sourceLabel ?? input.source,
          armorSaveVerified: input.armorSaveVerified === true,
          armorSaveOutcome: input.armorSaveOutcome,
          hitContext
        });
      case "explosive":
        return startExplosive(actor, { ...input, amount, reduction, hitContext });
      case "vacuum":
        return startVacuum(actor, { amount, firstRound: input.firstRound !== false, source, hitContext });
      case "cold":
      case "heat":
        return sufferSurroundings(actor, type, { ...input, amount, source, hitContext });
      case "electrical":
        return sufferElectrical(actor, { amount, source, hitContext });
      default: {
        const result = await sufferTypedLethal(
          actor,
          type,
          Math.max(0, amount - reduction),
          label,
          hitContext,
          undefined,
          { stopped: amount > 0 && reduction >= amount }
        );
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

async function startAcid(
  actor,
  {
    amount,
    reduction,
    armor,
    halfActions,
    unarmoredReduction,
    removeArmor,
    hitContext,
    armorPiercing,
    sourceId,
    sourceLabel,
    armorSaveVerified,
    armorSaveOutcome
  }
) {
  const lines = [],
    rolls = [],
    resistanceSource = damageResistanceSource(actor.system, "acid");
  if (damageResistancePlan(actor.system, "acid", amount, resistanceSource).negatesEffects)
    return post(actor, [
      loc`Acid resistance prevents this hit and its accompanying effects; earlier acid is unchanged.`
    ]);
  await migrateAcidHistory(actor);
  const armorIds = equippedArmorIds(actor),
    armorUuid = armorIds.length === 1 ? armorIds[0] : "";
  let dr = reduction,
    armorHit = false,
    armorPresent = false,
    armorVerified = false;
  if (removeArmor) {
    dr = unarmoredReduction;
    lines.push(
      loc`The declared next-Count actions remove the armor; other DR remains. Record those actions and unequip the armor.`
    );
  } else if (armor !== "none") {
    const roll = await rollTotal("1d6");
    rolls.push(roll.roll);
    const hit = acidHitsArmor(armor, roll.total);
    armorHit = hit;
    if (hit) {
      lines.push(loc`Acid strikes the armor (1d6: ${roll.total}): resolve its Damage save before applying armor DR.`);
      await post(actor, lines.splice(0), rolls.splice(0));
      let outcome = {
        verified: armorSaveVerified,
        outcome: armorSaveOutcome,
        armorPiercing,
        reduction: dr,
        unarmoredReduction
      };
      if (!outcome.verified || !["passed", "failed"].includes(outcome.outcome))
        outcome = await systemDialog.input({
          window: { title: loc`Acid on armor` },
          rejectClose: false,
          ok: { label: loc`Continue to Reflex save` },
          content: `<p>${loc`Keep the original coverage roll. Resolve the struck armor's actual Damage save against this acid, then declare its result; a failed save removes that armor's DR against this attack.`}</p><p>${amount} ${loc`acid before DR`}</p><label>${loc`Original AP`} <input type="number" name="armorPiercing" min="1" step="1" value="${Number.isSafeInteger(Number(armorPiercing)) ? Number(armorPiercing) : ""}" ${Number.isSafeInteger(Number(armorPiercing)) && Number(armorPiercing) >= 1 ? "readonly" : ""} required /></label><label>${loc`Remaining total DR after AP`} <input type="number" name="reduction" min="0" step="1" value="${dr}" required /></label><label>${loc`Remaining non-armor DR after AP`} <input type="number" name="unarmoredReduction" min="0" step="1" value="${unarmoredReduction}" required /></label><label>${loc`Actual armor save result`} <select name="outcome"><option value="passed">${loc`Armor saved; its DR applies`}</option><option value="failed">${loc`Armor failed; only non-armor DR applies`}</option></select></label><label><input type="checkbox" name="verified" /> ${loc`The GC confirms the armor's actual Damage save is resolved`}</label>`
        });
      if (!outcome) return null;
      if (outcome.verified !== true || !["passed", "failed"].includes(outcome.outcome))
        return refuse(loc`Confirm the armor's actual Damage save before applying this acid.`);
      if (outcome.armorPiercing != null) {
        if (!Number.isSafeInteger(Number(outcome.armorPiercing)) || Number(outcome.armorPiercing) < 1)
          return refuse(loc`Confirm the acid's actual AP before the character's save.`);
        if (
          Number.isSafeInteger(Number(armorPiercing)) &&
          Number(armorPiercing) >= 1 &&
          Number(outcome.armorPiercing) !== Number(armorPiercing)
        )
          return refuse(
            loc`Keep the original attack's AP when resolving its armor and character saves. The GC can review a mistaken attack separately.`
          );
        armorPiercing = Number(outcome.armorPiercing);
      }
      dr = Number(outcome.reduction ?? dr);
      unarmoredReduction = Number(outcome.unarmoredReduction ?? unarmoredReduction);
      if (
        !Number.isSafeInteger(dr) ||
        !Number.isSafeInteger(unarmoredReduction) ||
        unarmoredReduction < 0 ||
        dr < unarmoredReduction
      )
        return refuse(loc`Confirm the actual armored and non-armor DR remaining after AP.`);
      armorVerified = true;
      armorPresent = outcome.outcome === "passed";
      if (!armorPresent) dr = unarmoredReduction;
    } else {
      dr = unarmoredReduction;
      lines.push(loc`Acid strikes the clothes (1d6: ${roll.total}): the armor's damage reduction does not apply.`);
    }
  }
  const plan = acidSavePlan(amount, Math.trunc(Number(halfActions) || 0));
  if (lines.length) await post(actor, lines, rolls);
  return actor.rollSave("ref", {
    askContext: true,
    reflexReducesDamage: true,
    hazardSave: {
      kind: "acid",
      resistanceSource,
      bruiseResistanceSource: damageResistanceSource(actor.system, "subdual"),
      ...halfSavePolicy(actor),
      label: DAMAGE_TYPE_LABELS.acid,
      dc: plan.dc,
      bonus: plan.bonus,
      bonusLabel: loc`Half actions given up`,
      damage: amount,
      reduction: dr,
      acidSourceId: sourceId ?? foundry.utils.randomID(),
      acidSourceLabel: String(sourceLabel || loc`Acid attack`).slice(0, 100),
      acidProtection:
        Number.isSafeInteger(Number(armorPiercing)) && Number(armorPiercing) >= 1
          ? {
              ap: Number(armorPiercing),
              reduction: dr,
              unarmoredReduction,
              armorHit,
              armorPresent,
              armorSaveVerified: armorVerified,
              armorUuid: armorHit ? armorUuid : ""
            }
          : null,
      hitContext
    }
  });
}

async function startExplosive(actor, input) {
  const resistanceSource = damageResistanceSource(actor.system, "explosive");
  if (damageResistancePlan(actor.system, "explosive", input.amount, resistanceSource).negatesEffects)
    return post(actor, [loc`Explosive resistance prevents the damage and its accompanying effects.`]);
  const plan = explosiveSavePlan(input.amount, {
    moved: input.moved ?? "none",
    cannotMove: input.cannotMove === true,
    halfCover: input.halfCover === true
  });
  const save = {
    kind: "explosiveReflex",
    resistanceSource,
    bruiseResistanceSource: damageResistanceSource(actor.system, "subdual"),
    ...halfSavePolicy(actor),
    label: loc`Explosive (Reflex)`,
    dc: plan.dc,
    bonus: plan.bonus,
    bonusLabel: loc`Moved before the blast`,
    damage: plan.dc,
    reduction: input.reduction ?? 0,
    hitContext: input.hitContext
  };
  if (plan.reflexFails) {
    await post(actor, [loc`Explosive: no room to move and less than half cover, so the Reflex save fails (p.336).`]);
    return resolveExplosiveReflex(actor, null, save, false, {
      checkKind: "save",
      checkId: "ref",
      successConfirmed: false,
      evasionContext: evasionSaveContext(actor.system, { reflexReducesDamage: true })
    });
  }
  return actor.rollSave("ref", { askContext: true, reflexReducesDamage: true, hazardSave: save });
}

async function startVacuum(actor, { amount, firstRound, source, hitContext }) {
  const resistanceSource = damageResistanceSource(actor.system, "vacuum");
  if (damageResistancePlan(actor.system, "vacuum", amount, resistanceSource).negatesEffects)
    return post(actor, [loc`Vacuum resistance prevents this damage and its accompanying effects.`]);
  const rolled = amount;
  const rolls = [];
  if (firstRound) {
    if (rolls.length) await post(actor, [loc`Vacuum: ${rolled} damage rolled.`], rolls);
    return actor.rollSave("fort", {
      askContext: true,
      hazardSave: {
        kind: "vacuum",
        resistanceSource,
        ...halfSavePolicy(actor),
        label: DAMAGE_TYPE_LABELS.vacuum,
        dc: VACUUM.saveDC,
        damage: rolled,
        source,
        hitContext
      }
    });
  }
  return applyVacuum(actor, rolled, source, rolls, hitContext);
}

async function applyVacuum(actor, damage, source, rolls = [], hitContext = {}, resistanceSource) {
  const result = await sufferTypedLethal(
    actor,
    "vacuum",
    damage,
    DAMAGE_TYPE_LABELS.vacuum,
    hitContext,
    resistanceSource
  );
  if (result.resistance.negatesEffects) return post(actor, result.lines, [...rolls, ...result.rolls]);
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

async function sufferSurroundings(actor, type, { amount, source, temperature, medium, armor, hitContext }) {
  const applied = await sufferSubdual(
    actor,
    amount,
    DAMAGE_TYPE_LABELS[type],
    { armorPiercingAll: true },
    hitContext,
    type
  );
  if (!applied.net) return post(actor, [applied.line]);
  const lines = [applied.line];
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
  const tracked = addExposure(hazardState(actor.system), {
    type,
    amount: applied.net,
    source,
    worldTime: now(),
    interval
  });
  await writeHazards(actor, tracked.hazards);
  await post(actor, lines);
  for (const injury of tracked.injuries) await injurySave(actor, type, injury, "exposure");
  return true;
}

async function sufferElectrical(actor, { amount, source, hitContext }) {
  const applied = await sufferSubdual(
    actor,
    amount,
    DAMAGE_TYPE_LABELS.electrical,
    { armorPiercing: amount },
    hitContext,
    "electrical"
  );
  if (!applied.net) return post(actor, [applied.line]);
  const lines = [
    applied.line,
    loc`If that Fortitude save fails, use "Failed save" on the sheet: nauseated for 1d6 rounds and Initiative Count −${Math.floor(applied.net / 2)}.`
  ];
  if (actor.type === "npc" && !npcIsSpecial(actor)) {
    const stress = typedStress("electrical", applied.net);
    if (stress.points) lines.push(await sufferStress(actor, stress.points, DAMAGE_TYPE_LABELS.electrical));
  }
  // Electrical injuries count a single attack, so each attack is its own source.
  const tracked = addExposure(hazardState(actor.system), {
    type: "electrical",
    amount: applied.net,
    source: `${source} ${foundry.utils.randomID(4)}`,
    worldTime: now()
  });
  await writeHazards(actor, { ...tracked.hazards, exposure: { ...tracked.hazards.exposure, lastDamage: applied.net } });
  await post(actor, lines);
  for (const injury of tracked.injuries) await injurySave(actor, "electrical", injury, "exposure");
  return true;
}

/* -------------------------------------------- */
/*  Sheet buttons                                */
/* -------------------------------------------- */

/** Acid on a character: start of round, end of round, washing, the injury save. */
export async function acidStep(actor, step, sourceId = "", options = {}) {
  if (!owned(actor)) return null;
  const migrated = await migrateAcidHistory(actor);
  if (migrated)
    return game.user?.isGM
      ? reviewAcidSource(actor, migrated)
      : refuse(loc`The GC must review the older merged acid history before continuing.`);
  const rows = Object.entries(hazardState(actor.system).acidSources ?? {});
  if (!sourceId) {
    const relevant = rows.filter(([, row]) =>
      step === "injury" ? row.suffered >= 25 && !row.injuryChecked : row.damage > 0
    );
    if (!relevant.length) return refuse(loc`No matching acid attack needs this step.`);
    if (relevant.length === 1) sourceId = relevant[0][0];
    else {
      const input = await systemDialog.input({
        window: { title: loc`Choose acid attack` },
        rejectClose: false,
        content: `<label>${loc`Original acid attack`} <select name="sourceId">${relevant.map(([id, row]) => `<option value="${esc(id)}">${esc(row.label)} (${row.damage}; ${row.suffered})</option>`).join("")}</select></label>`
      });
      if (!input) return null;
      sourceId = input.sourceId;
    }
  }
  const original = structuredClone(readAcidSource(hazardState(actor.system), sourceId));
  if (step === "review" || original.needsReview || original.roundAttempt?.state === "applying")
    return game.user?.isGM
      ? reviewAcidSource(actor, sourceId)
      : refuse(loc`The GC must review this acid attack's unknown or interrupted history.`);
  if (step === "injury") return rollAcidSourceInjury(actor, sourceId);
  if (step === "end" || step === "wash") {
    return queueResources([actor], async () => {
      const before = acidStepSnapshot(actor, sourceId),
        state = hazardState(actor.system),
        plan = halveAcidSource(state, sourceId, step);
      await writeHazards(actor, plan.hazards);
      const entry = undoEntry(actor, before, acidStepSnapshot(actor, sourceId));
      if (entry)
        await postUndo(
          step === "wash" ? loc`Full action washing ${original.label}` : loc`End-of-round halving: ${original.label}`,
          [entry]
        );
      const report = await post(actor, [
        loc`${esc(original.label)}: remaining acid ${plan.source.damage}; actual damage suffered ${plan.source.suffered}.`,
        ...(plan.source.suffered >= 25 && !plan.source.injuryChecked
          ? [loc`Its injury save is still owed, even if no acid remains.`]
          : [])
      ]);
      return step === "wash" ? { washed: true, message: report } : report;
    });
  }
  if (step !== "round") return null;
  const context = typedHitContext(original.hitContext),
    ap = original.protection.ap,
    defenses = acidDefenses(actor, context, ap),
    { unarmored, armored } = defenses,
    armorRelevant =
      original.protection.armorHit &&
      original.protection.armorPresent &&
      (!original.protection.armorUuid || defenses.armorIds.includes(original.protection.armorUuid));
  const input =
    options.confirmed === true
      ? options
      : await systemDialog.input({
          window: { title: loc`Next acid round` },
          rejectClose: false,
          ok: { label: loc`Apply round damage` },
          content: `<p>${esc(original.label)}: ${original.damage} ${loc`acid before DR`}; AP ${ap}.</p><p>${loc`Confirm that the next round has started. Use the original attack's AP and struck layer; resolve any affected armor's Damage saves before counting its DR.`}</p><label>${loc`Remaining total DR after AP`} <input type="number" name="reduction" min="0" step="1" value="${armorRelevant ? armored : unarmored}" required /></label><label>${loc`Remaining non-armor DR after AP`} <input type="number" name="unarmoredReduction" min="0" step="1" value="${unarmored}" required /></label>${armorRelevant ? `<label><input type="checkbox" name="armorPresent" checked /> ${loc`The original armor still supplies DR against this attack`}</label><label><input type="checkbox" name="armorSaveVerified" /> ${loc`The GC confirms the affected armor's actual save result or removal`}</label>` : ""}<label><input type="checkbox" name="confirmed" /> ${loc`The GC confirms this is the next acid round and these are its actual defenses`}</label>`
        });
  if (!input) return null;
  if (input.confirmed !== true || (armorRelevant && input.armorSaveVerified !== true))
    return refuse(loc`Confirm the next round and any affected armor's actual outcome before applying acid.`);
  const armorPresent = armorRelevant && input.armorPresent === true;
  const protection = {
      ...original.protection,
      reduction: Number(armorPresent ? input.reduction : input.unarmoredReduction),
      unarmoredReduction: Number(input.unarmoredReduction),
      armorPresent,
      armorSaveVerified: armorRelevant ? input.armorSaveVerified === true : original.protection.armorSaveVerified
    },
    attempt = foundry.utils.randomID();
  let before, plan, priorEvents, resistanceSource, bruiseResistanceSource;
  await queueResources([actor], async () => {
    const state = hazardState(actor.system);
    if (!same(readAcidSource(state, sourceId), original))
      throw Error(loc`The acid attack changed while this round was being prepared. Reopen it.`);
    if (Object.values(state.acidSources ?? {}).some(source => source.roundAttempt?.state === "applying"))
      throw Error(loc`Finish or review the other interrupted acid round before applying more damage.`);
    const currentDefenses = acidDefenses(actor, context, ap);
    if (
      currentDefenses.unarmored !== defenses.unarmored ||
      (armorPresent &&
        (currentDefenses.armored !== defenses.armored || !same(currentDefenses.armorIds, defenses.armorIds)))
    )
      throw Error(
        loc`The character's acid protection changed while the form was open. Reopen the round with its current defenses.`
      );
    if (
      Object.values(actor.flags?.spycraft2?.damageApplications ?? {}).some(row =>
        ["applying", "needsReview", "undoing"].includes(row.state)
      ) ||
      Object.values(actor.flags?.spycraft2?.hazardResolutions ?? {}).some(row => row.state === "started")
    )
      throw Error(loc`Finish or review the character's interrupted damage before another acid round.`);
    priorEvents = structuredClone(actor.flags?.spycraft2?.damageEvents ?? {});
    before = acidStepSnapshot(actor, sourceId, attempt);
    resistanceSource = structuredClone(damageResistanceSource(actor.system, "acid"));
    bruiseResistanceSource = structuredClone(damageResistanceSource(actor.system, "subdual"));
    plan = beginAcidRound(state, sourceId, {
      attempt,
      protection,
      combat: acidCombat(actor),
      resistanceSource,
      bruiseResistanceSource
    });
    await writeHazards(actor, plan.hazards);
  });
  const result = await sufferTypedLethal(
    actor,
    "acid",
    plan.net,
    `${original.label} [${attempt}]`,
    context,
    resistanceSource,
    { stopped: plan.stopped, bruiseResistanceSource }
  );
  await queueResources([actor], async () => {
    const next = settleAcidRound(hazardState(actor.system), sourceId, {
      attempt,
      suffered: result.damage,
      effectsPrevented: result.effectsPrevented
    });
    await writeHazards(actor, next.hazards);
    if (next.injurySaveDue)
      result.lines.push(
        loc`This attack has reached the acid injury threshold; its original save remains available after washing.`
      );
    const events = actor.flags?.spycraft2?.damageEvents ?? {},
      overlaps = [...new Set([...Object.keys(priorEvents), ...Object.keys(events)])].some(
        id => !String(events[id]?.source ?? "").includes(`[${attempt}]`) && !same(priorEvents[id], events[id])
      );
    if (overlaps)
      result.lines.push(
        loc`Other damage events changed during this round. The GC must verify its actual health and ledger before reversing it.`
      );
    else {
      const entry = undoEntry(actor, before, acidStepSnapshot(actor, sourceId, attempt));
      if (entry) await postUndo(loc`Acid round: ${original.label}`, [entry]);
    }
  });
  return post(actor, result.lines, result.rolls);
}

/** Exclude wallets and unrelated ability uses from acid Undo while retaining damage and its own source. */
function acidStepSnapshot(actor, id, attempt = "") {
  const value = snapshot(actor),
    prefixes = [
      "system.vitality",
      "system.wounds",
      "system.accumulatedDamage",
      "system.damageTrack",
      "system.hazards.acid",
      `system.hazards.acidSources.${id}`,
      "flags.spycraft2.damageEvents",
      "flags.spycraft2.nonLethal"
    ];
  value.data = Object.fromEntries(
    Object.entries(value.data).filter(([key]) => {
      if (key.startsWith("flags.spycraft2.damageEvents.")) {
        const event = actor.flags?.spycraft2?.damageEvents?.[key.split(".")[3]];
        return !!attempt && String(event?.source ?? "").includes(`[${attempt}]`);
      }
      return prefixes.some(prefix => key === prefix || key.startsWith(`${prefix}.`));
    })
  );
  // Keep container presence without capturing unrelated children; Undo must not remove their ancestors.
  value.data.flags = {};
  value.data["flags.spycraft2"] = {};
  value.data["flags.spycraft2.damageEvents"] ??= {};
  return value;
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

function typedReflexDamage(save, succeeded, check, normalSuccessDamage) {
  if (!check?.evasionContext)
    throw Error(
      loc`This Reflex result has no recorded Evasion policy. The GC must apply the verified original outcome by hand, then review and keep the actual effects.`
    );
  return reflexDamagePlan(check, { damage: save.damage, normalSuccessDamage, succeeded, confirmed: true });
}

function savedResistance(save) {
  if (!save.resistanceSource)
    throw Error(
      loc`This damage save lacks its original resistance policy. Apply the verified original outcome by hand, then review and keep its actual effects.`
    );
  return save.resistanceSource;
}

async function resolveExplosiveReflex(actor, message, save, succeeded, check) {
  if (ignoresHazard(actor, save, succeeded)) return ignoredHazard(actor);
  const adjustment = typedReflexDamage(save, succeeded, check, explosiveDamageTaken(save.damage, true)),
    taken = Math.max(0, adjustment.total - Math.max(0, save.reduction ?? 0)),
    result = await sufferTypedLethal(
      actor,
      "explosive",
      taken,
      DAMAGE_TYPE_LABELS.explosive,
      save.hitContext,
      savedResistance(save),
      { stopped: adjustment.total > 0 && taken === 0, bruiseResistanceSource: save.bruiseResistanceSource ?? null }
    );
  if (result.resistance.negatesEffects) return post(actor, result.lines, result.rolls);
  result.lines.unshift(
    adjustment.evaded
      ? loc`Evasion prevents the explosive impact damage; successful Reflex movement still applies.`
      : adjustment.halved
        ? loc`Evasion halves the explosive damage despite the failed Reflex save.`
        : succeeded
          ? loc`The Reflex save succeeds: half damage, and the character moves to the next blast increment out.`
          : loc`The Reflex save fails: full damage.`
  );
  // More than 20 points suffered, counted after the Reflex save but before damage reduction (p.302).
  if (adjustment.total > 20)
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
  async acid(actor, message, save, succeeded, check) {
    if (ignoresHazard(actor, save, succeeded)) return ignoredHazard(actor);
    const id = save.acidSourceId ?? message?.id ?? foundry.utils.randomID();
    if (!acidSourceId(id) || Object.hasOwn(hazardState(actor.system).acidSources ?? {}, id))
      throw Error(loc`This acid attack already has damage history or needs GC review. Do not apply it again.`);
    const adjustment = typedReflexDamage(save, succeeded, check, acidFirstDamage(save.damage, true)),
      first = adjustment.total,
      taken = Math.max(0, first - Math.max(0, save.reduction ?? 0));
    if (first > 0) await migrateAcidHistory(actor);
    const result = await sufferTypedLethal(
      actor,
      "acid",
      taken,
      DAMAGE_TYPE_LABELS.acid,
      save.hitContext,
      savedResistance(save),
      { stopped: first > 0 && taken === 0, bruiseResistanceSource: save.bruiseResistanceSource ?? null }
    );
    result.lines.unshift(
      adjustment.evaded
        ? loc`Evasion prevents this acid damage; any earlier acid remains.`
        : adjustment.halved
          ? loc`Evasion halves the acid despite the failed Reflex save.`
          : succeeded
            ? loc`The Reflex save succeeds: the acid is halved.`
            : loc`The Reflex save fails: full acid damage.`
    );
    const state = hazardState(actor.system),
      next =
        result.effectsPrevented || first === 0
          ? state
          : acidAttackPlan(state, {
              id,
              label: (save.acidSourceLabel && save.acidSourceLabel !== loc`Acid attack`
                ? loc`${String(save.acidSourceLabel).slice(0, 80)} — attack ${Object.keys(state.acidSources ?? {}).length + 1}`
                : loc`Acid attack ${Object.keys(state.acidSources ?? {}).length + 1}`
              ).slice(0, 100),
              damage: first,
              suffered: result.damage,
              protection: save.acidProtection ?? null,
              at: now(),
              combat: acidCombat(actor),
              hitContext: typedHitContext(save.hitContext)
            }).hazards;
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
    return applyVacuum(
      actor,
      damage,
      save.source ?? DAMAGE_TYPE_LABELS.vacuum,
      [],
      save.hitContext,
      savedResistance(save)
    );
  },
  async typedInjury(actor, message, save, succeeded) {
    const state = hazardState(actor.system);
    if (save.where === "acid" && save.acidSourceId) await markAcidSourceInjury(actor, save);
    else if (save.where === "acid") {
      await migrateAcidHistory(actor);
      throw Error(
        loc`The older injury card does not identify one acid attack. The GC must keep its original result and review the matching attack.`
      );
    } else if (state.exposure)
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
        loss?.standard
          ? loc`${damage.total} lethal damage; the standard character's Damage save is recorded separately.`
          : loss
            ? loc`${damage.total} lethal damage: vitality −${loss.vitalityLoss}, wounds −${loss.woundLoss}.`
            : loc`${damage.total} lethal damage: the GC applies it.`,
        ...(loss?.notes ?? [])
      );
    }
    if (failure.subdual) {
      const damage = await rollTotal(failure.subdual);
      rolls.push(damage.roll);
      lines.push((await sufferSubdual(actor, damage.total, save.label)).line);
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
