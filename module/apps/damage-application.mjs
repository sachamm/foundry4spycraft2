/**
 * The join between an attack, its target and the target's health.
 *
 *  - "Resolve against Defense" on an attack card reads the target's Defense, settles hit or miss (and the shots of a
 *    Burst or Autofire that land) and confirms the check's outcome.
 *  - "Roll damage" on a hit carries the target and the attack on to the damage roll.
 *  - "Apply damage to a target" on a damage card takes the damage off a special character's vitality and wounds,
 *    records stress and subdual damage, hands a special damage type to its own rules, or rolls a standard NPC's or
 *    a vehicle's Damage save. "Apply the blast to everyone caught" does it for each character in a blast.
 *  - A report that calls for a save (a hit of 25 or more, a stress or subdual threshold) carries a button that makes
 *    the character's save through the usual save roll; the save's card then applies the result.
 *
 * The rules are in module/rules/damage-application.mjs. Whoever applies damage must own the target: the GC, or the
 * target's own player.
 */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { enhanceDamageDialog } from "./dialog-sections.mjs";
import {
  attackKindOf,
  attackOutcome,
  damageProfile,
  drForAttack,
  blastDamageAt,
  knockoutDuration,
  lethalHitLines,
  lethalHitPlan,
  nonLethalHitPlan,
  reducedDamage,
  woundState
} from "../rules/damage-application.mjs";
import { blastIncrementFeet } from "../rules/combat-actions.mjs";
import { DAMAGE_TYPES, DAMAGE_TYPE_LABELS } from "../rules/damage-types.mjs";
import { criticalInjuryResult, criticalInjuryRollPlan } from "../rules/critical-injuries.mjs";
import { SUBDUAL_ATTACK_KINDS } from "../rules/subdual-defense.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { conditionDuration, setCondition as condition, woundConditions } from "./wound-conditions.mjs";
import { applyAccumulatedDamage } from "./damage-ledger.mjs";
import { npcDamageSave, npcIsSpecial } from "./gc/npc-play.mjs";
import { exposeToFire, hazardSaveResolvers } from "./hazards.mjs";
import { sufferTypedDamage } from "./damage-types.mjs";
import { rollCriticalInjury } from "./critical-injuries.mjs";
import { blastCaught } from "./map.mjs";
import { rollObjectDamageSave } from "./vehicle-play.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { gunplayCountGain, juggernautConversion } from "../rules/class-combat.mjs";
import { shiftCount } from "./dueling.mjs";
import { askGC, gcAvailable, markCard, registerRelay } from "./gc-relay.mjs";
import { loc } from "../i18n.mjs";

const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
const values = c => (typeof c?.values === "function" ? [...c.values()] : Array.isArray(c) ? c : []);
const TARGET_TYPES = ["agent", "npc", "vehicle"];
const canSee = actor => actor?.isOwner === true || game.user?.isGM === true || actor?.visible === true;
/** Post a report. `pendingSave` makes it a card with a button that rolls the save it calls for. */
const post = (actor, lines, { pendingSave = null, rolls = [] } = {}) =>
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="spycraft2 chat-note">${lines
      .filter(Boolean)
      .map(line => `<p>${line}</p>`)
      .join("")}</div>`,
    ...(rolls.length ? { rolls } : {}),
    ...(pendingSave ? { flags: { spycraft2: { actorUuid: actor.uuid, checkKind: "note", pendingSave } } } : {})
  });

/** Characters and vehicles an attack or its damage can be settled against: targeted tokens first. */
export function targetChoices() {
  const actors = new Map();
  const targeted = values(game.user?.targets).filter(token => TARGET_TYPES.includes(token.actor?.type));
  for (const token of targeted) actors.set(token.actor.uuid, token.actor);
  for (const combat of values(game.combats))
    for (const turn of combat.turns ?? [])
      if (TARGET_TYPES.includes(turn.actor?.type) && canSee(turn.actor)) actors.set(turn.actor.uuid, turn.actor);
  for (const actor of values(game.actors))
    if (TARGET_TYPES.includes(actor.type) && canSee(actor)) actors.set(actor.uuid, actor);
  return { actors: [...actors.values()], selected: targeted.length === 1 ? targeted[0].actor.uuid : "" };
}

/** The Defense a target's sheet shows now, or null when it has none. */
export function defenseOf(target) {
  const system = target?.system ?? {};
  const value = target?.type === "vehicle" ? (system.defenseNow?.total ?? system.defense) : system.defense?.total;
  return Number.isSafeInteger(value) ? value : null;
}

const targetOptions = (actors, selected, label) =>
  actors
    .map(
      actor =>
        `<option value="${esc(actor.uuid)}"${actor.uuid === selected ? " selected" : ""}>${esc(label(actor))}</option>`
    )
    .join("");

/* -------------------------------------------- */
/*  Hit or miss                                  */
/* -------------------------------------------- */

/**
 * Settle a posted attack against a target's Defense and confirm its outcome.
 * @param {ChatMessage} message  the attack card
 * @param {object} [options]     { targetUuid, defense } to skip the dialog
 */
export async function resolveAttack(message, options = {}) {
  const check = message.flags?.spycraft2,
    attacker = check?.actorUuid ? fromUuidSync(check.actorUuid) : null;
  if (!attacker?.isOwner || check.checkKind !== "attack" || !Number.isFinite(check.effectiveTotal)) return null;
  if (check.resolved || check.superseded)
    return ui.notifications.warn(loc`This attack has already been resolved or replaced.`);
  let input = options;
  if (input.defense === undefined && input.targetUuid === undefined) {
    const choices = targetChoices(),
      selected = check.attackContext?.targetActorUuid || choices.selected;
    input = await systemDialog.input({
      window: { title: loc`Attack result ${check.effectiveTotal}: against Defense` },
      rejectClose: false,
      ok: { label: loc`Resolve` },
      content: `<div class="spycraft2-roll-options"><label>${loc`Target`} <select name="targetUuid"><option value="">${loc`Not listed (enter the Defense)`}</option>${targetOptions(
        choices.actors,
        selected,
        actor => {
          const defense = defenseOf(actor);
          return defense === null ? actor.name : loc`${actor.name} — Defense ${defense}`;
        }
      )}</select></label><label>${loc`Defense, if different from the target's sheet`} <input type="number" name="defense" min="0" step="1" /></label><p class="hint">${loc`Leave the Defense empty to use the listed value. Enter it when cover, a declared defense or another circumstance changes it; an agent's "Incoming attack — Defense" check works that out. Spend action dice on the attack before resolving it.`}</p></div>`
    });
    if (!input) return null;
  }
  const target = input.targetUuid ? await fromUuid(input.targetUuid) : null;
  const entered = input.defense === "" || input.defense === null || input.defense === undefined;
  const defense = entered ? defenseOf(target) : Number(input.defense);
  if (!Number.isSafeInteger(defense) || defense < 0)
    return ui.notifications.warn(loc`Choose a target with a Defense, or enter the Defense.`);
  let outcome;
  try {
    outcome = attackOutcome({
      total: check.effectiveTotal,
      defense,
      fireAction: check.attackContext?.fireAction ?? null,
      feats: attacker.system?.activeFeatNames ?? []
    });
  } catch (error) {
    return ui.notifications.warn(error.message);
  }
  const before = check.attackResolution ?? null;
  const resolution = {
    targetUuid: target?.uuid ?? "",
    targetName: target?.name ?? "",
    defense,
    total: check.effectiveTotal,
    ...outcome
  };
  await message.update({ "flags.spycraft2.attackResolution": resolution });
  try {
    await attacker.confirmCheckOutcome(message, { succeeded: outcome.hit, difficultyClass: defense });
  } catch (error) {
    await message.update(
      before ? { "flags.spycraft2.attackResolution": before } : { "flags.spycraft2.-=attackResolution": null }
    );
    return ui.notifications.warn(error.message);
  }
  // Gunplay: each handgun hit moves the triggerman up the order, once per attack card.
  const gunplay = gunplayCountGain(attacker.system, check.weaponProficiency, outcome.hits);
  if (gunplay && !check.gunplayCount)
    try {
      await shiftCount(message, attacker, gunplay, "gunplayCount", loc`Gunplay`);
    } catch {
      /* not in a started combat with a rolled Count: nothing to move */
    }
  // A successful attack ends its target's flat-footedness (p.342).
  if (outcome.hit && target?.isOwner && target.statuses?.has("flat-footed"))
    try {
      await setConditionStatus(target, "flat-footed", false, { label: loc`Flat-footed`, aliases: ["flatFooted"] });
    } catch {
      /* supplied by another source: left for the GC */
    }
  return resolution;
}

rollPipeline.register({ id: "sourceAttackRecord", order: 9598, record: ["sourceAttack"] });

rollPipeline.register({
  id: "attackResolutionControl",
  kinds: ["attack"],
  order: 9165,
  chatControls({ message, check, actor, user }) {
    if (!Number.isFinite(check.rawTotal) || check.superseded || !(message.isAuthor || user.isGM)) return null;
    const controls = [];
    if (!check.resolved && check.attackContext?.fireAction?.action !== "strafe")
      controls.push({
        label: check.attackResolution ? loc`Resolve against Defense again` : loc`Resolve against Defense`,
        placement: "card",
        run: () => resolveAttack(message)
      });
    const resolution = check.attackResolution,
      weapon = check.weaponUuid ? fromUuidSync(check.weaponUuid) : null;
    if (resolution?.hit && check.successConfirmed === true && weapon && !check.attackContext?.pummel) {
      const target = resolution.targetUuid ? fromUuidSync(resolution.targetUuid) : null;
      controls.push({
        label: resolution.hits > 1 ? loc`Roll damage (one of ${resolution.hits} hits)` : loc`Roll damage`,
        placement: "card",
        run: () =>
          actor.rollDamage(weapon, {
            // Vehicles are not character targets of a damage roll; they are picked again when the damage is applied.
            ...(target && ["agent", "npc"].includes(target.type) ? { targetActorUuid: target.uuid } : {}),
            sourceAttack: {
              uuid: message.uuid,
              targetUuid: resolution.targetUuid,
              ranged: check.attackContext?.ranged === true
            }
          })
      });
    }
    return controls.length ? controls : null;
  }
});

/* -------------------------------------------- */
/*  Damage onto a target                         */
/* -------------------------------------------- */

const isSpecial = target => target.type === "agent" || (target.type === "npc" && npcIsSpecial(target));
/** A special NPC's running stress and subdual totals; agents keep a ledger instead. */
export const nonLethalTotals = actor => ({
  stress: Math.max(0, Math.trunc(Number(actor.flags?.spycraft2?.nonLethal?.stress) || 0)),
  subdual: Math.max(0, Math.trunc(Number(actor.flags?.spycraft2?.nonLethal?.subdual) || 0))
});
/** Damage types with rules of their own that an agent's hazards track; fire is kept with the other hazards. */
const TYPED = [...Object.keys(DAMAGE_TYPES), "fire"];
/** Types a special NPC can take through the same saves: nothing is kept on the character between rounds. */
const NPC_TYPED = ["bang", "flash", "explosive"];
const typeLabel = type => (type === "fire" ? loc`Fire` : (DAMAGE_TYPE_LABELS[type] ?? type));

/**
 * Stress or subdual damage. An agent's goes to the ledger, which works out its own save. A special NPC keeps two
 * running totals; when a threshold or a critical hit calls for a save, the report carries the button for it.
 * @returns {{lines: string[], pendingSave: object|null}}
 */
async function nonLethalDamage(target, kind, amount, facts) {
  const { source, attackKind, armorPiercing = 0, armorPiercingAll = false, critical = false } = facts;
  if (target.type === "agent") {
    try {
      await applyAccumulatedDamage(target, {
        source: `${source} [${foundry.utils.randomID(6)}]`,
        kind,
        newDamage: amount,
        criticalHit: critical === true,
        confirmed: true,
        ...(kind === "subdual"
          ? { damageMode: "subdualBeforeDefenses", attackKind, armorPiercing, armorPiercingAll }
          : { damageMode: "stressBeforeResistance" })
      });
      return {
        lines: [
          loc`${esc(target.name)}: ${amount} ${kind} damage recorded before defenses. Any save it calls for is waiting on the sheet.`
        ],
        pendingSave: null
      };
    } catch (error) {
      return {
        lines: [
          loc`${esc(target.name)}: ${amount} ${kind} damage could not be recorded (${esc(error.message)}); record it by hand.`
        ],
        pendingSave: null
      };
    }
  }
  const plan = nonLethalHitPlan(target.system, nonLethalTotals(target), {
    kind,
    damage: amount,
    dr: drForAttack(target.system, attackKind),
    armorPiercing,
    armorPiercingAll,
    critical
  });
  if (plan.net) await target.update({ "flags.spycraft2.nonLethal": plan.totals });
  const lines = [
    plan.stopped
      ? loc`${esc(target.name)}: damage reduction stops all ${amount} ${kind} damage (it counts twice against subdual damage).`
      : loc`${esc(target.name)} takes ${plan.net} ${kind} damage: ${plan.total} in all, against a threshold of ${plan.threshold}.`
  ];
  if (!plan.saveRequired) return { lines, pendingSave: null };
  const saveName = plan.saveKey === "will" ? loc`Will` : loc`Fortitude`;
  lines.push(loc`This calls for a ${saveName} save, DC ${plan.dc}.`);
  return {
    lines,
    pendingSave: {
      kind: "thresholdSave",
      saveKey: plan.saveKey,
      dc: plan.dc,
      label: kind === "stress" ? loc`Stress damage` : loc`Subdual damage`,
      damageKind: kind,
      failureOutcome: plan.failureOutcome,
      knockoutBase: plan.knockoutBase
    }
  };
}

/** Take a lethal hit off a special character's vitality and wounds and set the conditions that follow. */
async function lethalOnSpecial(target, hit, source) {
  const system = target.system,
    plan = lethalHitPlan(
      { vitality: system.vitality?.value, wounds: system.wounds?.value, woundsMax: system.wounds?.max },
      hit
    );
  if (plan.net) await target.update({ "system.vitality.value": plan.vitality, "system.wounds.value": plan.wounds });
  const lines = lethalHitLines(esc(target.name), plan);
  if (plan.fatigued) lines.push(await condition(target, "fatigued", loc`Fatigued`));
  if (plan.stateChanged) lines.push(...(await woundConditions(target, plan.state)));
  if (plan.bruise)
    lines.push(
      ...(
        await nonLethalDamage(target, "subdual", plan.bruise, { source: loc`Bruising: ${source}`, attackKind: "other" })
      ).lines
    );
  const pendingSave = plan.massive
    ? {
        kind: "massiveDamage",
        saveKey: "fort",
        dc: plan.massive.dc,
        label: loc`Massive damage`,
        damage: plan.net,
        toMinusNine: plan.massive.toMinusNine,
        source
      }
    : null;
  return { plan, lines, pendingSave };
}

/* -------------------------------------------- */
/*  Saves a report calls for                     */
/* -------------------------------------------- */

/** Roll the save a report asks for, through the character's usual save roll. */
export async function rollReportedSave(message) {
  const check = message.flags?.spycraft2,
    save = check?.pendingSave,
    actor = check?.actorUuid ? fromUuidSync(check.actorUuid) : null;
  if (!save || save.rolled || !actor?.isOwner) return null;
  const { saveKey, ...hazardSave } = save;
  const card = await actor.rollSave(saveKey, { askContext: true, hazardSave });
  // A cancelled dialog or a refused roll leaves the button in place.
  if (card?.flags) await markCard(message, "pendingSave.rolled");
  return card ?? null;
}

rollPipeline.register({
  id: "reportedSaveControl",
  kinds: ["note"],
  order: 9774,
  chatControls({ message, check }) {
    const save = check.pendingSave;
    if (!save || save.rolled) return null;
    return [
      {
        label:
          save.saveKey === "will"
            ? loc`Roll the Will save (DC ${save.dc})`
            : loc`Roll the Fortitude save (DC ${save.dc})`,
        run: () => rollReportedSave(message)
      }
    ];
  }
});

/** A hit of 25 or more (p.331): a failed save means a critical injury, and –9 wounds for a hit of 50 or more. */
hazardSaveResolvers.set("massiveDamage", async (actor, message, save, succeeded) => {
  if (succeeded)
    return post(actor, [loc`${esc(actor.name)} makes the save against massive damage: no critical injury.`]);
  const lines = [loc`${esc(actor.name)} fails the save against massive damage.`],
    rolls = [];
  const reference = `massive-${message?.id ?? foundry.utils.randomID(8)}`,
    source = loc`Massive damage: ${save.damage} in one hit`;
  if (actor.type === "agent") {
    await rollCriticalInjury(actor, { id: reference, damage: save.damage, source, confirmed: true });
    lines.push(loc`The critical injury is rolled on its own card.`);
  } else {
    const plan = criticalInjuryRollPlan(actor.system, { id: reference, damage: save.damage, source, confirmed: true }),
      roll = await new Roll(plan.formula).evaluate(),
      result = criticalInjuryResult(plan, roll.total - plan.damage);
    rolls.push(roll);
    lines.push(
      result.listed
        ? loc`Critical injury (${result.total}): ${esc(result.name)}. Surgery DC ${result.surgeryDC}.`
        : loc`Critical injury (${result.total}): ${esc(result.name)}.`
    );
  }
  if (save.toMinusNine) {
    const wounds = Math.min(-9, Math.trunc(Number(actor.system.wounds?.value) || 0));
    await actor.update({ "system.wounds.value": wounds });
    lines.push(
      loc`A hit of 50 or more: wounds drop to ${wounds}.`,
      ...(await woundConditions(actor, woundState(wounds)))
    );
  }
  return post(actor, lines, { rolls });
});

/** A stress or subdual threshold on a character without a ledger (pp.339–340). */
hazardSaveResolvers.set("thresholdSave", async (actor, message, save, succeeded, check) => {
  if (succeeded) return post(actor, [loc`${esc(actor.name)} makes the save: no further effect.`]);
  if (save.damageKind === "stress")
    return post(actor, [
      save.failureOutcome
        ? loc`${esc(actor.name)} fails the save: ${esc(save.failureOutcome)}. Use "Apply Shaken" on the sheet to record it.`
        : loc`${esc(actor.name)} fails the save from a critical hit below every threshold: the GC decides the effect.`
    ]);
  const time = knockoutDuration(save.knockoutBase, save.dc, Number(check?.effectiveTotal));
  return post(actor, [
    time
      ? loc`${esc(actor.name)} fails the save and is unconscious for ${time.count} ${time.unit}(s). The game clock ends it.`
      : loc`${esc(actor.name)} fails the save and is unconscious; the GC sets how long.`,
    await condition(actor, "unconscious", loc`Unconscious`, conditionDuration(time))
  ]);
});

/* -------------------------------------------- */
/*  Applying a damage roll                       */
/* -------------------------------------------- */

const damageFacts = message => {
  const check = message.flags?.spycraft2 ?? {};
  const weapon = check.weaponUuid ? fromUuidSync(check.weaponUuid) : null,
    attack = check.sourceAttack?.uuid ? fromUuidSync(check.sourceAttack.uuid)?.flags?.spycraft2 : null,
    profile = damageProfile(weapon?.system?.damage, check.weaponQualities ?? weapon?.system?.qualities);
  return {
    check,
    weapon,
    attack,
    rolled: Number.isFinite(check.effectiveTotal) ? check.effectiveTotal : message.rolls?.[0]?.total,
    profile,
    attackKind: attackKindOf({
      proficiency: weapon?.system?.proficiency ?? check.weaponProficiency,
      ranged: check.sourceAttack?.ranged === true,
      unarmed: check.unarmed === true,
      blast: profile.blast === true
    }),
    applied: Array.isArray(check.damageApplied) ? check.damageApplied : []
  };
};
const option = (value, label, chosen) =>
  `<option value="${value}"${value === chosen ? " selected" : ""}>${esc(label)}</option>`;
/** The fields every way of applying damage shares: kind, special type, DR column and armor-piercing. */
const sharedFields = (profile, attackKind) =>
  `<label>${loc`Kind`} <select name="kind">${option("lethal", loc`Lethal`, profile.kind)}${option("subdual", loc`Subdual`, profile.kind)}${option("stress", loc`Stress`, profile.kind)}</select></label><label>${loc`Special damage type (an agent's own saves and effects)`} <select name="type">${option("", loc`None`, profile.type)}${TYPED.map(
    type => option(type, typeLabel(type), profile.type)
  ).join("")}</select></label><label>${loc`Damage reduction against`} <select name="attackKind">${Object.entries(
    SUBDUAL_ATTACK_KINDS
  )
    .map(([id, label]) => option(id, label, attackKind))
    .join(
      ""
    )}</select></label><label>${loc`Armor-piercing`} <input type="number" name="armorPiercing" min="0" step="1" value="${profile.armorPiercing}" /></label><label><input type="checkbox" name="armorPiercingAll" /> ${loc`Armor-piercing (all): ignore damage reduction`}</label>`;

/** Damage reduction for a standard character: as listed against lethal, doubled against subdual, none against stress. */
export function standardReduction(kind, hit) {
  if (kind === "lethal") return reducedDamage(hit);
  if (kind === "subdual")
    return reducedDamage({
      damage: hit.damage,
      dr: hit.armorPiercingAll ? 0 : 2 * Math.max(0, hit.dr - hit.armorPiercing),
      armorPiercing: 0
    });
  return reducedDamage({ damage: hit.damage });
}

/**
 * Apply rolled damage to one target.
 * @param {ChatMessage} message  the damage card
 * @param {object} [options]     the dialog's fields, to skip it: { targetUuid, damage, kind, type, attackKind,
 *                               armorPiercing, armorPiercingAll, critical, criticalDice, blast, reviewType }
 */
export async function applyDamage(message, options = {}) {
  const { check, weapon, attack, rolled, profile, attackKind: kindOfAttack, applied } = damageFacts(message);
  if (!message.flags?.spycraft2 || !Number.isFinite(rolled)) return null;
  let input = options;
  if (input.targetUuid === undefined) {
    const choices = targetChoices(),
      selected =
        check.sourceAttack?.targetUuid ||
        check.sneakAttackTarget?.actorUuid ||
        check.attackDamageBenefit?.targetUuid ||
        choices.selected;
    input = await systemDialog.input({
      window: { title: loc`Apply ${Math.max(0, rolled)} damage` },
      position: { width: 560 },
      rejectClose: false,
      render: enhanceDamageDialog,
      ok: { label: loc`Apply` },
      content: `<div class="spycraft2-roll-options">${applied.length ? `<p class="inventory-warning">${loc`Already applied to: ${esc(applied.map(a => a.name).join(", "))}.`}</p>` : ""}<label>${loc`Target`} <select name="targetUuid" required>${targetOptions(
        choices.actors.filter(actor => actor.isOwner || gcAvailable()),
        selected,
        actor => (actor.isOwner ? actor.name : loc`${actor.name} (sent to the GC)`)
      )}</select></label><label>${loc`Damage`} <input type="number" name="damage" min="0" step="1" value="${Math.max(0, Math.trunc(rolled))}" required /></label>${sharedFields(profile, kindOfAttack)}<label><input type="checkbox" name="critical"${attack?.criticalSuccess ? " checked" : ""} /> ${loc`An activated critical hit (a special character with vitality left takes it on wounds)`}</label><label>${loc`Action dice spent on the critical hit (a standard NPC fails that many more Damage saves)`} <input type="number" name="criticalDice" min="0" step="1" value="${attack?.criticalSuccess ? Math.max(1, Number(attack.criticalActivation?.cost) || 1) : 0}" /></label><label><input type="checkbox" name="blast"${profile.blast ? " checked" : ""} /> ${loc`The damage has a blast increment`}</label><label>${loc`Lethal damage taken as subdual instead (Juggernaut, Brawler 10th: up to half of what gets past damage reduction)`} <input type="number" name="juggernaut" min="0" step="1" value="0" /></label><p class="hint">${loc`Damage to a character you own is applied here; damage to anyone else is sent to the GC to apply. Enter the damage before damage reduction; the target's is read from its sheet. A special damage type opens its own dialog for an agent, and bang, flash and explosive damage for a special NPC.`}</p></div>`
    });
    if (!input) return null;
    input = { ...input, reviewType: true };
  }
  const target = input.targetUuid ? await fromUuid(input.targetUuid) : null;
  if (!target || !TARGET_TYPES.includes(target.type)) return ui.notifications.warn(loc`Choose a target.`);
  if (!target.isOwner) {
    // Someone else's character: the GC's client applies it.
    const { reviewType: _review, ...fields } = input;
    try {
      ui.notifications.info(loc`Sent to the GC: damage to ${target.name}.`);
      return await askGC("applyDamage", { messageId: message.id, input: fields });
    } catch (error) {
      return ui.notifications.warn(error.message);
    }
  }
  const damage = Number(input.damage),
    kind = input.kind ?? "lethal",
    type = TYPED.includes(input.type) ? input.type : "",
    attackKind = Object.hasOwn(SUBDUAL_ATTACK_KINDS, input.attackKind) ? input.attackKind : kindOfAttack,
    armorPiercing = Math.max(0, Math.trunc(Number(input.armorPiercing) || 0)),
    armorPiercingAll = input.armorPiercingAll === true,
    critical = input.critical === true,
    criticalDice = critical ? Math.max(1, Math.trunc(Number(input.criticalDice) || 0)) : 0;
  if (!Number.isSafeInteger(damage) || damage < 0)
    return ui.notifications.warn(loc`Enter the damage as a whole number, 0 or more.`);
  if (!["lethal", "subdual", "stress"].includes(kind))
    return ui.notifications.warn(loc`Choose lethal, subdual or stress damage.`);
  const source = loc`${weapon?.name ?? loc`Damage`} (${message.id ?? "roll"})`;
  const hit = { damage, dr: drForAttack(target.system, attackKind), armorPiercing, armorPiercingAll, critical };
  let lines = [],
    pendingSave = null,
    result = null;
  try {
    if (target.type === "vehicle") {
      if (damage < 1) return ui.notifications.warn(loc`A Damage save needs at least 1 point of damage.`);
      result = await rollObjectDamageSave(target, {
        damage,
        armorPiercing,
        blast: input.blast === true,
        critical,
        fire: type === "fire" || profile.type === "fire"
      });
    } else if (type && (target.type === "agent" || (isSpecial(target) && NPC_TYPED.includes(type)))) {
      // A special damage type has its own saves and effects, kept with the agent's other hazards. A special NPC
      // takes the types that are settled by a save alone; the ones that keep a running total stay with the GC.
      const reduction = armorPiercingAll ? 0 : Math.max(0, hit.dr - armorPiercing);
      result =
        type === "fire"
          ? await exposeToFire(target, { damage, ap: armorPiercing, reduction, save: true })
          : await sufferTypedDamage(target, {
              type,
              amount: damage,
              reduction,
              source: weapon?.name ?? "",
              review: input.reviewType === true,
              allowed: target.type === "agent" ? undefined : NPC_TYPED
            });
      if (!result) return null;
    } else if (!isSpecial(target)) {
      // Standard NPCs and animals: damage reduction, then a Damage save on what is left.
      const reduced = standardReduction(kind, hit);
      if (reduced.stopped)
        lines.push(loc`${esc(target.name)}: damage reduction ${reduced.dr} stops all ${damage} damage.`);
      else if (reduced.net < 1) lines.push(loc`${esc(target.name)} takes no damage.`);
      else {
        if (reduced.dr) lines.push(loc`${esc(target.name)}: ${damage} less damage reduction ${reduced.dr}.`);
        result = await npcDamageSave(target, {
          damage: reduced.net,
          kind,
          blast: input.blast === true,
          criticalDice
        });
        if (!result) return null;
      }
    } else if (kind === "lethal") {
      // Juggernaut: the brawler may take up to half of the hit as subdual damage instead.
      const converted = Math.min(
        Math.max(0, Math.trunc(Number(input.juggernaut) || 0)),
        // Only what gets past damage reduction can be converted.
        juggernautConversion(
          target.system,
          armorPiercingAll ? damage : Math.max(0, damage - Math.max(0, (hit.dr ?? 0) - armorPiercing))
        )
      );
      if (converted) hit.damage = damage - converted;
      ({ plan: result, lines, pendingSave } = await lethalOnSpecial(target, hit, source));
      if (converted) {
        // The converted points are already past damage reduction, so it is not taken off again.
        const subdual = await nonLethalDamage(target, "subdual", converted, {
          source,
          attackKind,
          armorPiercing,
          armorPiercingAll: true
        });
        lines.push(
          loc`Juggernaut: ${converted} of the ${damage} lethal damage is taken as subdual damage.`,
          ...subdual.lines
        );
        pendingSave ??= subdual.pendingSave;
      }
      if (type)
        lines.push(loc`${typeLabel(type)} damage: its other effects on ${esc(target.name)} are worked out by hand.`);
    } else if (damage > 0) {
      ({ lines, pendingSave } = await nonLethalDamage(target, kind, damage, {
        source,
        attackKind,
        armorPiercing,
        armorPiercingAll,
        critical
      }));
    } else lines.push(loc`${esc(target.name)} takes no damage.`);
  } catch (error) {
    return ui.notifications.warn(error.message);
  }
  if (lines.filter(Boolean).length) await post(target, lines, { pendingSave });
  // When the card cannot be marked the report above is the record.
  await markCard(
    message,
    "damageAppliedEntry",
    { targetUuid: target.uuid, name: target.name, damage, kind },
    { quiet: true }
  );
  return result ?? true;
}

registerRelay("applyDamage", {
  async describe({ messageId, input = {} }, user) {
    const message = game.messages.get(messageId),
      target = input.targetUuid ? await fromUuid(input.targetUuid) : null;
    if (!message || !target) throw new Error(loc`The damage card or its target is no longer there.`);
    return loc`${esc(user.name)} applies ${esc(Number(input.damage) || 0)} ${esc(input.kind ?? "lethal")} damage to ${esc(target.name)}${input.critical === true ? loc` (a critical hit)` : ""}. Allow it?`;
  },
  async run({ messageId, input = {} }) {
    const message = game.messages.get(messageId);
    if (!message) throw new Error(loc`The damage card is no longer there.`);
    return (await applyDamage(message, { ...input, targetUuid: input.targetUuid ?? "" })) ? true : null;
  }
});

/* -------------------------------------------- */
/*  A blast                                      */
/* -------------------------------------------- */

/**
 * Apply a blast to each character caught in it: the damage halves for every increment out from Ground Zero.
 * With one token targeted on a scene the distances come from the map; otherwise they are entered.
 * @param {ChatMessage} message  the damage card
 * @param {object} [options]     { targets: [{ uuid, distanceFeet }], kind, type, attackKind, armorPiercing,
 *                               armorPiercingAll } to skip the dialog
 */
export async function applyBlast(message, options = {}) {
  const { check, rolled, profile, attackKind } = damageFacts(message);
  if (!message.flags?.spycraft2 || !Number.isFinite(rolled)) return null;
  const increment = blastIncrementFeet(check.weaponQualities);
  let input = options;
  if (!Array.isArray(input.targets)) {
    const caught = blastCaught(rolled, increment),
      measured = new Map((caught ?? []).filter(row => row.actor).map(row => [row.actor.uuid, row]));
    const actors = [
      ...[...measured.values()].map(row => row.actor),
      ...targetChoices().actors.filter(actor => !measured.has(actor.uuid))
    ].filter(actor => actor.isOwner || gcAvailable());
    if (!actors.length) return ui.notifications.warn(loc`There is no character to apply the blast to.`);
    const rows = actors
      .map((actor, index) => {
        const row = measured.get(actor.uuid);
        return `<tr><td><label><input type="checkbox" name="hit${index}"${row && !row.behindWall ? " checked" : ""} /> ${esc(actor.isOwner ? actor.name : loc`${actor.name} (sent to the GC)`)}${row?.behindWall ? ` <i>${loc`(behind a wall)`}</i>` : ""}</label></td><td><input type="number" name="feet${index}" min="0" step="5" value="${row ? row.ring * increment : ""}" class="w-2" /></td><td>${row ? row.damage : ""}</td></tr>`;
      })
      .join("");
    const entered = await systemDialog.input({
      window: { title: loc`Blast of ${Math.max(0, rolled)}: who is caught` },
      rejectClose: false,
      ok: { label: loc`Apply to those ticked` },
      content: `<div class="spycraft2-roll-options"><p>${caught ? loc`Distances are measured from the targeted token at Ground Zero. Blast increment ${increment} ft.` : loc`Target the one token at Ground Zero to measure from the scene, or tick each character caught and enter its distance. Blast increment ${increment} ft.`}</p><table><thead><tr><th>${loc`Character`}</th><th>${loc`Feet from Ground Zero`}</th><th>${loc`Damage`}</th></tr></thead><tbody>${rows}</tbody></table>${sharedFields(profile, attackKind)}<p class="hint">${loc`Anyone behind a wall is listed but not ticked: tick them if the wall failed its Damage save. Other cover is not taken into account. Each character is settled in turn, with its own save where one is called for.`}</p></div>`
    });
    if (!entered) return null;
    input = {
      ...entered,
      targets: actors
        .map((actor, index) => ({
          uuid: actor.uuid,
          ticked: entered[`hit${index}`] === true,
          feet: entered[`feet${index}`]
        }))
        .filter(row => row.ticked)
        .map(row => ({ uuid: row.uuid, distanceFeet: Number(row.feet) || 0 }))
    };
  }
  if (!input.targets.length) return ui.notifications.warn(loc`Tick at least one character caught in the blast.`);
  const results = [];
  for (const row of input.targets) {
    const at = blastDamageAt(rolled, row.distanceFeet, increment);
    if (at.damage < 1) continue;
    results.push(
      await applyDamage(message, {
        targetUuid: row.uuid,
        damage: at.damage,
        kind: input.kind ?? profile.kind,
        type: input.type ?? profile.type,
        attackKind: input.attackKind ?? attackKind,
        armorPiercing: input.armorPiercing ?? profile.armorPiercing,
        armorPiercingAll: input.armorPiercingAll === true,
        blast: true
      })
    );
  }
  return results;
}

rollPipeline.register({
  id: "applyDamageControl",
  kinds: ["damage"],
  order: 9772,
  chatControls({ message, check }) {
    if (check.superseded) return null;
    const applied = Array.isArray(check.damageApplied) ? check.damageApplied.length : 0;
    const controls = [
      {
        label: applied ? loc`Apply damage to another target` : loc`Apply damage to a target`,
        run: () => applyDamage(message)
      }
    ];
    if (/\bBLS\b/.test(check.weaponQualities ?? ""))
      controls.push({ label: loc`Apply the blast to everyone caught`, run: () => applyBlast(message) });
    return controls;
  }
});
