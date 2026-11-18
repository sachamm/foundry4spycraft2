/**
 * The join between an attack, its target and the target's health.
 *
 *  - "Resolve against Defense" on an attack card reads the target's Defense, settles hit or miss (and the shots of a
 *    Burst or Autofire that land) and confirms the check's outcome.
 *  - "Roll damage" on a hit carries the target and the attack on to the damage roll.
 *  - "Apply damage to a target" on a damage card takes the damage off a special character's vitality and wounds,
 *    sends stress and subdual damage to the ledger, or rolls a standard NPC's or a vehicle's Damage save.
 *
 * The rules are in module/rules/damage-application.mjs. Whoever applies damage must own the target: the GC, or the
 * target's own player.
 */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import {
  attackKindOf,
  attackOutcome,
  damageProfile,
  drForAttack,
  lethalHitLines,
  lethalHitPlan,
  reducedDamage
} from "../rules/damage-application.mjs";
import { SUBDUAL_ATTACK_KINDS } from "../rules/subdual-defense.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { applyAccumulatedDamage } from "./damage-ledger.mjs";
import { npcDamageSave, npcIsSpecial } from "./gc/npc-play.mjs";
import { rollObjectDamageSave } from "./vehicle-play.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { loc } from "../i18n.mjs";

const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
const values = c => (typeof c?.values === "function" ? [...c.values()] : Array.isArray(c) ? c : []);
const TARGET_TYPES = ["agent", "npc", "vehicle"];
const canSee = actor => actor?.isOwner === true || game.user?.isGM === true || actor?.visible === true;
const post = (actor, lines) =>
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="spycraft2 chat-note">${lines
      .filter(Boolean)
      .map(line => `<p>${line}</p>`)
      .join("")}</div>`
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

async function condition(target, id, label) {
  if (target.statuses?.has(id)) return "";
  try {
    await setConditionStatus(target, id, true, { label });
    return "";
  } catch (error) {
    return loc`${label} could not be set (${esc(error.message)}); set it by hand.`;
  }
}

async function defeat(target) {
  for (const combat of values(game.combats))
    for (const combatant of combat.combatants ?? [])
      if (combatant.actor === target && !combatant.defeated) await combatant.update({ defeated: true });
}

/** Stress or subdual damage on a character who keeps a ledger; a line for the card either way. */
async function ledgerDamage(target, kind, amount, { source, attackKind, armorPiercing, armorPiercingAll, critical }) {
  if (target.type !== "agent")
    return loc`${esc(target.name)} takes ${amount} ${kind} damage: compare it with the ${kind} threshold by hand (p.339).`;
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
    return loc`${esc(target.name)}: ${amount} ${kind} damage recorded before defenses. Any save it calls for is waiting on the sheet.`;
  } catch (error) {
    return loc`${esc(target.name)}: ${amount} ${kind} damage could not be recorded (${esc(error.message)}); record it by hand.`;
  }
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
  if (plan.stateChanged && ["unconscious", "dying"].includes(plan.state))
    lines.push(await condition(target, "unconscious", loc`Unconscious`));
  if (plan.stateChanged && plan.state === "dying") lines.push(await condition(target, "dying", loc`Dying`));
  if (plan.stateChanged && ["dead", "destroyed"].includes(plan.state)) {
    lines.push(await condition(target, "dead", loc`Dead`));
    await defeat(target);
  }
  if (plan.bruise)
    lines.push(
      await ledgerDamage(target, "subdual", plan.bruise, { source: loc`Bruising: ${source}`, attackKind: "other" })
    );
  return { plan, lines };
}

/**
 * Apply rolled damage to one target.
 * @param {ChatMessage} message  the damage card
 * @param {object} [options]     the dialog's fields, to skip it: { targetUuid, damage, kind, attackKind,
 *                               armorPiercing, armorPiercingAll, critical, criticalDice, blast }
 */
export async function applyDamage(message, options = {}) {
  const check = message.flags?.spycraft2;
  const rolled = Number.isFinite(check?.effectiveTotal) ? check.effectiveTotal : message.rolls?.[0]?.total;
  if (!check || !Number.isFinite(rolled)) return null;
  const weapon = check.weaponUuid ? fromUuidSync(check.weaponUuid) : null,
    attack = check.sourceAttack?.uuid ? fromUuidSync(check.sourceAttack.uuid)?.flags?.spycraft2 : null;
  const profile = damageProfile(weapon?.system?.damage, check.weaponQualities ?? weapon?.system?.qualities),
    kindOfAttack = attackKindOf({
      proficiency: weapon?.system?.proficiency ?? check.weaponProficiency,
      ranged: check.sourceAttack?.ranged === true,
      unarmed: check.unarmed === true
    });
  const applied = Array.isArray(check.damageApplied) ? check.damageApplied : [];
  let input = options;
  if (input.targetUuid === undefined) {
    const choices = targetChoices(),
      selected =
        check.sourceAttack?.targetUuid ||
        check.sneakAttackTarget?.actorUuid ||
        check.attackDamageBenefit?.targetUuid ||
        choices.selected;
    const option = (value, label, chosen) =>
      `<option value="${value}"${value === chosen ? " selected" : ""}>${esc(label)}</option>`;
    input = await systemDialog.input({
      window: { title: loc`Apply ${Math.max(0, rolled)} damage` },
      rejectClose: false,
      ok: { label: loc`Apply` },
      content: `<div class="spycraft2-roll-options">${applied.length ? `<p class="inventory-warning">${loc`Already applied to: ${esc(applied.map(a => a.name).join(", "))}.`}</p>` : ""}<label>${loc`Target`} <select name="targetUuid" required>${targetOptions(
        choices.actors.filter(actor => actor.isOwner),
        selected,
        actor => actor.name
      )}</select></label><label>${loc`Damage`} <input type="number" name="damage" min="0" step="1" value="${Math.max(0, Math.trunc(rolled))}" required /></label><label>${loc`Kind`} <select name="kind">${option("lethal", loc`Lethal`, profile.kind)}${option("subdual", loc`Subdual`, profile.kind)}${option("stress", loc`Stress`, profile.kind)}</select></label><label>${loc`Damage reduction against`} <select name="attackKind">${Object.entries(
        SUBDUAL_ATTACK_KINDS
      )
        .map(([id, label]) => option(id, label, kindOfAttack))
        .join(
          ""
        )}</select></label><label>${loc`Armor-piercing`} <input type="number" name="armorPiercing" min="0" step="1" value="${profile.armorPiercing}" /></label><label><input type="checkbox" name="armorPiercingAll" /> ${loc`Armor-piercing (all): ignore damage reduction`}</label><label><input type="checkbox" name="critical"${attack?.criticalSuccess ? " checked" : ""} /> ${loc`An activated critical hit (a special character with vitality left takes it on wounds)`}</label><label>${loc`Action dice spent on the critical hit (a standard NPC fails that many more Damage saves)`} <input type="number" name="criticalDice" min="0" step="1" value="${attack?.criticalSuccess ? Math.max(1, Number(attack.criticalActivation?.cost) || 1) : 0}" /></label><label><input type="checkbox" name="blast"${profile.blast ? " checked" : ""} /> ${loc`The damage has a blast increment`}</label>${profile.type ? `<p class="hint">${loc`This weapon deals ${profile.type} damage: its own saves and effects are under "Other damage types" on the target's sheet.`}</p>` : ""}<p class="hint">${loc`You can apply damage to characters you own. Enter the damage before damage reduction; the target's is read from its sheet.`}</p></div>`
    });
    if (!input) return null;
  }
  const target = input.targetUuid ? await fromUuid(input.targetUuid) : null;
  if (!target || !TARGET_TYPES.includes(target.type)) return ui.notifications.warn(loc`Choose a target.`);
  if (!target.isOwner)
    return ui.notifications.warn(loc`Only the GC or ${target.name}'s own player can apply damage to that character.`);
  const damage = Number(input.damage),
    kind = input.kind ?? "lethal",
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
    result = null;
  try {
    if (target.type === "vehicle") {
      if (damage < 1) return ui.notifications.warn(loc`A Damage save needs at least 1 point of damage.`);
      result = await rollObjectDamageSave(target, {
        damage,
        armorPiercing,
        blast: input.blast === true,
        critical,
        fire: profile.type === "fire"
      });
    } else if (!isSpecial(target)) {
      // Standard NPCs and animals: damage reduction, then a Damage save on what is left.
      const reduced = kind === "lethal" ? reducedDamage(hit) : { net: damage, dr: 0, stopped: false };
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
      ({ plan: result, lines } = await lethalOnSpecial(target, hit, source));
    } else if (damage > 0) {
      lines.push(
        await ledgerDamage(target, kind, damage, { source, attackKind, armorPiercing, armorPiercingAll, critical })
      );
    } else lines.push(loc`${esc(target.name)} takes no damage.`);
  } catch (error) {
    return ui.notifications.warn(error.message);
  }
  if (lines.filter(Boolean).length) await post(target, lines);
  try {
    await message.update({
      "flags.spycraft2.damageApplied": [...applied, { targetUuid: target.uuid, name: target.name, damage, kind }]
    });
  } catch {
    /* not this user's message to mark: the report above is the record */
  }
  return result ?? true;
}

rollPipeline.register({
  id: "applyDamageControl",
  kinds: ["damage"],
  order: 9772,
  chatControls({ message, check }) {
    if (check.superseded) return null;
    const applied = Array.isArray(check.damageApplied) ? check.damageApplied.length : 0;
    return [
      {
        label: applied ? loc`Apply damage to another target` : loc`Apply damage to a target`,
        run: () => applyDamage(message)
      }
    ];
  }
});
