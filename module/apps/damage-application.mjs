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
import { snapshot, undoEntry, postUndo } from "./undo.mjs";
import { readSetting } from "../settings.mjs";
import { esc } from "../html.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { enhanceDamageDialog } from "./dialog-sections.mjs";
import {
  attackKindOf,
  appliedDamageEntries,
  reportText,
  attackOutcome,
  criticalDamageDefaults,
  damageProfile,
  drForAttack,
  blastDamageAt,
  knockoutDuration,
  lethalHitLines,
  lethalHitPlan,
  reducedDamage,
  woundState
} from "../rules/damage-application.mjs";
import { specialistDefense } from "../rules/weapon-specialist.mjs";
import { campaignStress, gladiatorsDefense } from "../rules/campaign-rules.mjs";
import { resolvedTargetRole } from "../rules/npc-qualities.mjs";
import { blastIncrementFeet } from "../rules/combat-actions.mjs";
import { DAMAGE_TYPES, DAMAGE_TYPE_LABELS } from "../rules/damage-types.mjs";
import { criticalInjuryResult, criticalInjuryRollPlan, surgeryDCNow } from "../rules/critical-injuries.mjs";
import { SUBDUAL_ATTACK_KINDS } from "../rules/subdual-defense.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { conditionDuration, setCondition as condition, woundConditions } from "./wound-conditions.mjs";
import { accumulatedDamageLines, nonLethalDamage, nonLethalTotals } from "./non-lethal-damage.mjs";
export { accumulatedDamageLines, nonLethalDamage, nonLethalTotals };
import { npcDamageSave, npcIsSpecial } from "./gc/npc-play.mjs";
import { recordAutomaticFluidEvent } from "./gc/combat.mjs";
import { exposeToFire, hazardSaveResolvers } from "./hazards.mjs";
import { sufferTypedDamage } from "./damage-types.mjs";
import { rollCriticalInjury } from "./critical-injuries.mjs";
import { blastCaught } from "./map.mjs";
import { rollObjectDamageSave } from "./vehicle-play.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { gunplayCountGain, juggernautConversion } from "../rules/class-combat.mjs";
import { shiftCount } from "./dueling.mjs";
import { askGC, gcAvailable, markCard, registerRelay, requesterConcern } from "./gc-relay.mjs";
import { loc, locKey } from "../i18n.mjs";
import { refuse } from "../error-notices.mjs";
import { COVER_GRADES } from "../rules/cover.mjs";

const values = c => (typeof c?.values === "function" ? [...c.values()] : Array.isArray(c) ? c : []);
const TARGET_TYPES = ["agent", "npc", "vehicle"];
/** Whether a token of this actor is in this user's view on the current scene (not hidden, not out of sight). */
export const tokenInView = actor => {
  const tokens = actor?.token ? [actor.token.object ?? { document: actor.token }] : (actor?.getActiveTokens?.() ?? []);
  return tokens.some(token => token && token.document?.hidden !== true && token.visible !== false);
};
const canSee = actor =>
  actor?.isOwner === true || game.user?.isGM === true || actor?.visible === true || tokenInView(actor);
/** Post a report. `pendingSave` makes it a card with a button that rolls the save it calls for. */
export const postDamageReport = (actor, lines, { pendingSave = null, rolls = [] } = {}) =>
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="spycraft2 chat-note">${lines
      .filter(Boolean)
      .map(line => `<p>${line}</p>`)
      .join("")}</div>`,
    ...(rolls.length ? { rolls } : {}),
    ...(pendingSave ? { flags: { spycraft2: { actorUuid: actor.uuid, checkKind: "note", pendingSave } } } : {})
  });

/**
 * Characters and vehicles an attack or its damage can be settled against: targeted tokens first.
 * @param {object} [options]
 * @param {string} [options.exclude]   an actor uuid left out (the attacker, when resolving its own attack)
 * @param {"always"|"fallback"} [options.offScene]  "fallback" lists characters with no token on the scene only
 *                                     when nobody on the scene or in a combat can be chosen
 */
export function targetChoices({ exclude = "", offScene = "always" } = {}) {
  const actors = new Map();
  const allowed = actor => TARGET_TYPES.includes(actor?.type) && actor.uuid !== exclude;
  const targeted = values(game.user?.targets).filter(token => allowed(token.actor));
  for (const token of targeted) actors.set(token.actor.uuid, token.actor);
  const add = actor => {
    if (allowed(actor) && canSee(actor) && !actors.has(actor.uuid)) actors.set(actor.uuid, actor);
  };
  // The fight in view, then any other fight on the scene in view: a fight on another scene is not offered.
  const sceneId = globalThis.canvas?.scene?.id ?? null;
  for (const turn of game.combat?.turns ?? []) add(turn.actor);
  for (const combat of values(game.combats))
    if (!sceneId || !combat.scene || combat.scene.id === sceneId)
      for (const turn of combat.turns ?? []) add(turn.actor);
  // Tokens on the scene in view, then characters with no token there, which are marked as not on the scene.
  for (const token of values(globalThis.canvas?.scene?.tokens)) add(token.actor);
  if (offScene === "always" || !actors.size) for (const actor of values(game.actors)) add(actor);
  return { actors: [...actors.values()], selected: targeted.length === 1 ? targeted[0].actor.uuid : "" };
}

/** The Defense a target's sheet shows now, or null when it has none. */
export function defenseOf(target) {
  const system = target?.system ?? {};
  const value = target?.type === "vehicle" ? (system.defenseNow?.total ?? system.defense) : system.defense?.total;
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * The target an attack card recorded, when this viewer can read its Defense from the sheet: { actor, defense }.
 * A GC setting can hide NPC Defense from players; the one-click resolve then stays with the dialog.
 */
export function declaredTarget(check) {
  const uuid = check.attackContext?.targetActorUuid;
  return readableTarget(uuid && uuid !== check.actorUuid ? fromUuidSync(uuid) : null);
}

/** { actor, defense } for a target whose Defense this viewer may read from its sheet, otherwise null. */
function readableTarget(actor) {
  if (!actor || !TARGET_TYPES.includes(actor.type) || !canSee(actor)) return null;
  if (!actor.isOwner && !game.user?.isGM && !defenseVisibleToPlayers()) return null;
  const defense = defenseOf(actor);
  return defense === null ? null : { actor, defense };
}

/** Players see an opponent's listed Defense when resolving (a world setting, on unless the GC turns it off). */
export function defenseVisibleToPlayers() {
  return readSetting("showDefenseToPlayers", true) !== false;
}

/** A target's label in a picker: its token's name when it differs, and a mark for an actor not on the scene. */
export function targetLabel(actor) {
  const token = actor.token ?? actor.getActiveTokens?.()?.[0]?.document ?? null;
  const name = token?.name || actor.name;
  const onScene = !!actor.token || (actor.getActiveTokens?.().length ?? 0) > 0;
  return onScene || actor.type === "vehicle" ? name : loc`${name} (not on the scene)`;
}

/** The name a target goes by on the map: its token's name, or the actor's when it has no token here. */
export const tokenName = actor =>
  actor?.token?.name || actor?.getActiveTokens?.()?.[0]?.document?.name || actor?.name || "";

/** Number repeated labels ("Thug 1", "Thug 2") so identical tokens can be told apart in a picker. */
export function distinctLabels(labels) {
  const totals = new Map(),
    seen = new Map();
  for (const label of labels) totals.set(label, (totals.get(label) ?? 0) + 1);
  return labels.map(label => {
    if (totals.get(label) < 2) return label;
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    return `${label} ${n}`;
  });
}

const targetOptions = (actors, selected, label) => {
  const labels = distinctLabels(actors.map(actor => label(actor)));
  return actors
    .map(
      (actor, index) =>
        `<option value="${esc(actor.uuid)}"${actor.uuid === selected ? " selected" : ""}>${esc(labels[index])}</option>`
    )
    .join("");
};

/* -------------------------------------------- */
/*  Hit or miss                                  */
/* -------------------------------------------- */

/**
 * Settle a posted attack against a target's Defense and confirm its outcome.
 * @param {ChatMessage} message  the attack card
 * @param {object} [options]     { targetUuid, defense } to skip the dialog; { ask: true } to always show it.
 *                               With neither, an attack that recorded no target is settled straight away against
 *                               the one token the user has targeted, and the dialog opens only when there is none.
 */
export async function resolveAttack(message, options = {}) {
  const check = message.flags?.spycraft2,
    attacker = check?.actorUuid ? fromUuidSync(check.actorUuid) : null;
  if (!attacker?.isOwner || check.checkKind !== "attack" || !Number.isFinite(check.effectiveTotal)) return null;
  if (check.resolved || check.superseded) return refuse(loc`This attack has already been resolved or replaced.`);
  let input = options;
  const declared = check.attackContext?.targetActorUuid || "";
  if (input.defense === undefined && input.targetUuid === undefined) {
    // The attacker is never its own target, and people who are not on the scene are listed only as a fallback.
    const targeted = targetChoices({ exclude: attacker.uuid, offScene: "fallback" }).selected;
    const quick =
      options.ask !== true && !check.attackResolution && !declared && targeted
        ? readableTarget(fromUuidSync(targeted))
        : null;
    if (quick) input = { targetUuid: quick.actor.uuid, defense: "" };
  }
  if (input.defense === undefined && input.targetUuid === undefined) {
    const choices = targetChoices({ exclude: attacker.uuid, offScene: "fallback" }),
      selected = (declared !== attacker.uuid && declared) || choices.selected;
    input = await systemDialog.input({
      window: { title: loc`Attack result ${check.effectiveTotal}: against Defense` },
      rejectClose: false,
      ok: { label: loc`Resolve` },
      content: `<div class="spycraft2-roll-options"><label>${loc`Target`} <select name="targetUuid"><option value="">${loc`Not listed (enter the Defense)`}</option>${targetOptions(
        choices.actors,
        selected,
        actor => {
          const defense = actor.isOwner || game.user?.isGM || defenseVisibleToPlayers() ? defenseOf(actor) : null;
          return defense === null ? targetLabel(actor) : loc`${targetLabel(actor)} — Defense ${defense}`;
        }
      )}</select></label><label>${loc`Cover between attacker and target`} <select name="cover">${COVER_GRADES.slice(
        0,
        4
      )
        .map((label, grade) => `<option value="${grade}">${esc(label)}${grade ? ` (+${2 * grade})` : ""}</option>`)
        .join(
          ""
        )}</select></label><label>${loc`Defense, if different from the target's sheet`} <input type="number" name="defense" min="0" step="1" /></label><p class="hint">${loc`Cover adds to the Defense used, and a miss that only the cover caused hits the cover (p.345). Enter a different Defense for a declared defense or another circumstance; an agent's "Incoming attack — Defense" check works that out. Spend action dice on the attack before resolving it.`}</p></div>`
    });
    if (!input) return null;
  }
  const target = input.targetUuid ? await fromUuid(input.targetUuid) : null;
  if (target && target.uuid === attacker.uuid)
    return refuse(loc`${attacker.name} cannot be the target of its own attack. Choose another target.`);
  const entered = input.defense === "" || input.defense === null || input.defense === undefined;
  const baseDefense = entered ? defenseOf(target) : Number(input.defense);
  if (!Number.isSafeInteger(baseDefense) || baseDefense < 0)
    return refuse(loc`Choose a target with a Defense, or enter the Defense.`);
  const cover = coverOnResolution(input.cover);
  // Weapon Specialist Foibles (p.50): +1 dodge against the chosen proficiencies, on top of the sheet's Defense.
  const foibles = entered && target ? specialistDefense(target.system, check.weaponProficiency).dodge : 0;
  // Gladiators (p.407): +1 against ranged attacks for each Melee or Unarmed Combat feat the target holds.
  const gladiators = entered && target ? gladiatorsDefense(target.system, check.attackContext?.ranged === true) : 0;
  // Laser damage ignores every dodge bonus to Defense (p.338), so a known target's dodge bonuses come off.
  const laserDodge =
    entered && target && check.attackContext?.laser === true && !target.system?.vulnerable
      ? Math.max(0, Number(target.system?.defense?.dodgeBonuses) || 0) + foibles
      : 0;
  const defense = baseDefense + (cover?.bonus ?? 0) + foibles + gladiators - laserDodge;
  let outcome;
  try {
    outcome = attackOutcome({
      total: check.effectiveTotal,
      defense,
      fireAction: check.attackContext?.fireAction ?? null,
      feats: attacker.system?.activeFeatNames ?? []
    });
  } catch (error) {
    return refuse(error.message);
  }
  // A villain role belongs to the target actually hit, not the one declared (pp.447–448): its threat range and
  // critical cost are read again for the target chosen here.
  if (target) {
    const roleChange = resolvedTargetRole(check, target.system);
    if (roleChange) {
      await message.update({
        "flags.spycraft2.threat": roleChange.threat,
        "flags.spycraft2.attackContext.targetRole": roleChange.role
      });
      check.threat = roleChange.threat;
      check.attackContext = { ...check.attackContext, targetRole: roleChange.role };
    }
  }
  const before = check.attackResolution ?? null;
  const resolution = {
    targetUuid: target?.uuid ?? "",
    targetName: target?.name ?? "",
    defense,
    total: check.effectiveTotal,
    // Updates merge, so resolving again without cover clears what an earlier resolution recorded.
    cover: cover ?? null,
    foibles,
    hitsCover: cover ? !outcome.hit && check.effectiveTotal >= defense - cover.bonus : false,
    // The card is public: an NPC's Defense stays off it when the GC keeps it from players.
    ...(target && !target.hasPlayerOwner && !defenseVisibleToPlayers() ? { defenseHidden: true } : {}),
    ...outcome
  };
  await message.update({ "flags.spycraft2.attackResolution": resolution });
  try {
    await attacker.confirmCheckOutcome(message, { succeeded: outcome.hit, difficultyClass: defense });
  } catch (error) {
    await message.update(
      before ? { "flags.spycraft2.attackResolution": before } : { "flags.spycraft2.-=attackResolution": null }
    );
    return refuse(error.message);
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

/**
 * The cover chosen when resolving an attack (Table 5.10, p.345): its grade, name and Defense bonus, or null for none.
 * Total cover is not offered: a target behind it cannot be attacked directly.
 */
export function coverOnResolution(value) {
  const grade = Number(value);
  if (!Number.isSafeInteger(grade) || grade < 1 || grade > 3) return null;
  return { grade, label: COVER_GRADES[grade], bonus: 2 * grade };
}

/** ": hit" or ": miss" for an attack card's total against a Defense, or "" when it cannot be told yet. */
export function standingAgainst(check, defense, attacker) {
  try {
    const outcome = attackOutcome({
      total: check.effectiveTotal,
      defense,
      fireAction: check.attackContext?.fireAction ?? null,
      feats: attacker?.system?.activeFeatNames ?? []
    });
    return outcome.hit ? loc`: hit` : loc`: miss`;
  } catch {
    return "";
  }
}

/** The GC's setting: a quick (Shift-click) NPC attack on a known target is resolved as soon as it is rolled. */
export function registerQuickResolveSetting() {
  game.settings.register("spycraft2", "quickNpcResolve", {
    name: locKey`Resolve quick NPC attacks at once`,
    hint: locKey`On: when an NPC's attack is rolled without its dialog against one targeted token, it is resolved against that token's Defense straight away. Use a normal click when you want to spend action dice on the attack first.`,
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
}

/**
 * After a quick NPC attack: settle it against the target recorded on its card. Anything that cannot be settled
 * this way is left on the card for its usual buttons.
 * @returns the card, as the attack returned it
 */
export async function resolveQuickAttack(message) {
  const check = message?.flags?.spycraft2;
  try {
    if (check?.checkKind !== "attack" || check.attackResolution || check.resolved) return message;
    if (!game.user?.isGM || game.settings.get("spycraft2", "quickNpcResolve") === false) return message;
    if (check.attackContext?.fireAction?.action === "strafe") return message;
    const known = declaredTarget(check);
    if (known) await resolveAttack(message, { targetUuid: known.actor.uuid, defense: "" });
  } catch (error) {
    console.warn("Field Agent's Handbook | The quick attack was left for its card.", error);
  }
  return message;
}

rollPipeline.register({ id: "sourceAttackRecord", order: 9598, record: ["sourceAttack"] });

rollPipeline.register({
  id: "attackResolutionControl",
  kinds: ["attack"],
  order: 9165,
  chatControls({ message, check, actor, user }) {
    if (!Number.isFinite(check.rawTotal) || check.superseded || !(message.isAuthor || user.isGM)) return null;
    const controls = [];
    if (!check.resolved && check.attackContext?.fireAction?.action !== "strafe") {
      // A target recorded with the attack: one click settles it against that target's listed Defense.
      const known = !check.attackResolution ? declaredTarget(check) : null;
      if (known)
        controls.push({
          // The viewer can already read this Defense, so the button says how the roll stands against it.
          label: loc`Resolve vs Defense ${known.defense}${standingAgainst(check, known.defense, actor)}`,
          hint: loc`Resolve this attack against ${tokenName(known.actor)}, Defense ${known.defense}${standingAgainst(check, known.defense, actor)}`,
          placement: "card",
          emphasis: "primary",
          run: () => resolveAttack(message, { targetUuid: known.actor.uuid, defense: "" })
        });
      controls.push({
        label: check.attackResolution
          ? loc`Resolve against Defense again`
          : known
            ? loc`Cover, other target or Defense…`
            : loc`Resolve against Defense`,
        ...(known && !check.attackResolution
          ? { hint: loc`Resolve this attack with cover, against another target, or against a Defense you enter` }
          : {}),
        placement: "card",
        // Resolving again is a correction, not the next step: it stays available but quiet.
        ...(check.attackResolution ? { emphasis: "quiet" } : known ? {} : { emphasis: "primary" }),
        // With no target on the card, the first press settles against the one targeted token, if there is one.
        run: () => resolveAttack(message, check.attackResolution || known ? { ask: true } : {})
      });
    }
    const resolution = check.attackResolution,
      weapon = check.weaponUuid ? fromUuidSync(check.weaponUuid) : null;
    if (resolution?.hit && check.successConfirmed === true && weapon && !check.attackContext?.pummel) {
      const target = resolution.targetUuid ? fromUuidSync(resolution.targetUuid) : null;
      // Once every hit has its damage card, rolling damage is no longer the card's next step.
      const rolled = damageCardsFor(message);
      controls.push({
        label: resolution.hits > 1 ? loc`Roll damage (one of ${resolution.hits} hits)` : loc`Roll damage`,
        placement: "card",
        ...(rolled < Math.max(1, resolution.hits || 1) ? { emphasis: "primary" } : {}),
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

/** How many damage cards answer an attack card. */
export function damageCardsFor(message, messages = globalThis.game?.messages ?? []) {
  let count = 0;
  for (const m of messages)
    if (m.flags?.spycraft2?.checkKind === "damage" && m.flags.spycraft2.sourceAttack?.uuid === message?.uuid) count++;
  return count;
}

/* -------------------------------------------- */
/*  Damage onto a target                         */
/* -------------------------------------------- */

const isSpecial = target => target.type === "agent" || (target.type === "npc" && npcIsSpecial(target));
/** Damage types with rules of their own that an agent's hazards track; fire is kept with the other hazards. */
const TYPED = [...Object.keys(DAMAGE_TYPES), "fire"];
/** Types a special NPC can take through the same saves: nothing is kept on the character between rounds. */
const NPC_TYPED = ["bang", "flash", "explosive"];
const typeLabel = type => (type === "fire" ? loc`Fire` : (DAMAGE_TYPE_LABELS[type] ?? type));

/** Take a lethal hit off a special character's vitality and wounds and set the conditions that follow. */
export async function lethalOnSpecial(target, hit, source) {
  const system = target.system,
    plan = lethalHitPlan(
      {
        vitality: system.vitality?.value,
        wounds: system.wounds?.value,
        woundsMax: system.wounds?.max,
        deathThreshold: system.deathThreshold
      },
      hit
    );
  if (plan.net) await target.update({ "system.vitality.value": plan.vitality, "system.wounds.value": plan.wounds });
  const lines = lethalHitLines(esc(target.name), plan);
  if (plan.fatigued) lines.push(await condition(target, "fatigued", loc`Fatigued`));
  if (plan.stateChanged) lines.push(...(await woundConditions(target, plan.state)));
  if (plan.woundLoss > 0)
    lines.push(await recordAutomaticFluidEvent(target, hit.critical === true ? "criticalWoundLoss" : "woundLoss"));
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
        threshold: plan.massive.threshold ?? 50,
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
    return postDamageReport(actor, [
      loc`${esc(actor.name)} makes the save against massive damage: no critical injury.`
    ]);
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
        ? loc`Critical injury (${result.total}): ${esc(result.name)}. Surgery DC ${surgeryDCNow(result)}.`
        : loc`Critical injury (${result.total}): ${esc(result.name)}.`
    );
  }
  if (save.toMinusNine) {
    const wounds = Math.min(-9, Math.trunc(Number(actor.system.wounds?.value) || 0));
    await actor.update({ "system.wounds.value": wounds });
    lines.push(
      loc`A hit of ${save.threshold ?? 50} or more: wounds drop to ${wounds}.`,
      ...(await woundConditions(actor, woundState(wounds, actor.system.deathThreshold)))
    );
  }
  return postDamageReport(actor, lines, { rolls });
});

/** A stress or subdual threshold on a character without a ledger (pp.339–340). */
hazardSaveResolvers.set("thresholdSave", async (actor, message, save, succeeded, check) => {
  if (succeeded) return postDamageReport(actor, [loc`${esc(actor.name)} makes the save: no further effect.`]);
  if (save.damageKind === "stress")
    return postDamageReport(actor, [
      save.failureOutcome
        ? loc`${esc(actor.name)} fails the save: ${esc(save.failureOutcome)}. Use "Apply Shaken" on the sheet to record it.`
        : loc`${esc(actor.name)} fails the save from a critical hit below every threshold: the GC decides the effect.`
    ]);
  const time = knockoutDuration(save.knockoutBase, save.dc, Number(check?.effectiveTotal));
  return postDamageReport(actor, [
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
    applied: appliedDamageEntries(check)
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
  // Stress ignores DR; Tense and Mellow scale it (pp.407–408).
  return reducedDamage({ damage: campaignStress(hit.damage).amount });
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
  const crit = criticalDamageDefaults(attack, message.id);
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
        actor => (actor.isOwner ? targetLabel(actor) : loc`${targetLabel(actor)} (sent to the GC)`)
      )}</select></label><label>${loc`Damage`} <input type="number" name="damage" min="0" step="1" value="${Math.max(0, Math.trunc(rolled))}" required /></label>${sharedFields(profile, kindOfAttack)}${criticalHint(crit)}<label><input type="checkbox" name="critical"${crit.critical ? " checked" : ""} /> ${loc`An activated critical hit (a special character with vitality left takes it on wounds)`}</label><label>${loc`Size of the critical hit in action dice, before any discount (a standard NPC fails that many more Damage saves)`} <input type="number" name="criticalDice" min="0" step="1" value="${crit.criticalDice}" /></label><label><input type="checkbox" name="blast"${profile.blast ? " checked" : ""} /> ${loc`The damage has a blast increment`}</label>${choices.actors.some(actor => juggernautConversion(actor.system, 2) > 0) ? `<label>${loc`Lethal damage taken as subdual instead (Juggernaut, Brawler 10th: up to half of what gets past damage reduction)`} <input type="number" name="juggernaut" min="0" step="1" value="0" /></label>` : ""}<p class="hint">${loc`Damage to a character you own is applied here; damage to anyone else is sent to the GC to apply. Enter the damage before damage reduction; the target's is read from its sheet. A special damage type opens its own dialog for an agent, and bang, flash and explosive damage for a special NPC.`}</p></div>`
    });
    if (!input) return null;
    input = { ...input, reviewType: true };
  }
  const target = input.targetUuid ? await fromUuid(input.targetUuid) : null;
  if (!target || !TARGET_TYPES.includes(target.type)) return refuse(loc`Choose a target.`);
  if (!target.isOwner) {
    // Someone else's character: the GC's client applies it.
    const { reviewType: _review, ...fields } = input;
    try {
      ui.notifications.info(loc`Sent to the GC: damage to ${target.name}.`);
      return await askGC("applyDamage", { messageId: message.id, input: fields });
    } catch (error) {
      return refuse(error.message);
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
  if (!Number.isSafeInteger(damage) || damage < 0) return refuse(loc`Enter the damage as a whole number, 0 or more.`);
  if (!["lethal", "subdual", "stress"].includes(kind)) return refuse(loc`Choose lethal, subdual or stress damage.`);
  const source = loc`${weapon?.name ?? loc`Damage`} (${message.id ?? "roll"})`;
  const proficiency = weapon?.system?.proficiency ?? check.weaponProficiency ?? "";
  const hit = {
    damage,
    dr: drForAttack(target.system, attackKind, { proficiency }),
    armorPiercing,
    armorPiercingAll,
    critical
  };
  let lines = [],
    pendingSave = null,
    failed = false,
    result = null;
  // A picture of the target before anything is written, so the application can be undone from chat.
  const beforeDamage = snapshot(target);
  try {
    if (target.type === "vehicle") {
      if (damage < 1) return refuse(loc`A Damage save needs at least 1 point of damage.`);
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
          ? await exposeToFire(target, { damage, ap: armorPiercing, reduction, save: true, undo: false })
          : await sufferTypedDamage(target, {
              type,
              amount: damage,
              reduction,
              source: weapon?.name ?? "",
              review: input.reviewType === true,
              allowed: target.type === "agent" ? undefined : NPC_TYPED,
              undo: false
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
      ({ lines, pendingSave, failed } = await nonLethalDamage(target, kind, damage, {
        source,
        attackKind,
        proficiency,
        armorPiercing,
        armorPiercingAll,
        critical
      }));
    } else lines.push(loc`${esc(target.name)} takes no damage.`);
  } catch (error) {
    return refuse(error.message);
  }
  // A Table of Ouch critical on a special character (p.329). An agent's injury is rolled from the damage card, where
  // its sheet records it; a special NPC has no injury record, so its injury is rolled and reported here.
  const ouchHit = crit.ouch && isSpecial(target) && kind === "lethal" && Number.isFinite(result?.net),
    ouch = ouchHit && target.type === "agent",
    rolls = [];
  if (ouch) lines.push(loc`Table of Ouch critical: roll ${esc(target.name)}’s injury from the damage card.`);
  else if (ouchHit) {
    const plan = criticalInjuryRollPlan(target.system, {
        id: `ouch-${message.id}-${target.id}`,
        damage: result.net,
        source: loc`Critical hit: ${weapon?.name ?? loc`Damage`}`,
        confirmed: true
      }),
      roll = await new Roll(plan.formula).evaluate(),
      injury = criticalInjuryResult(plan, roll.total - plan.damage);
    rolls.push(roll);
    lines.push(
      injury.listed
        ? loc`Table of Ouch critical on ${esc(target.name)} (${injury.total}): ${esc(injury.name)}. Surgery DC ${surgeryDCNow(injury)}.`
        : loc`Table of Ouch critical on ${esc(target.name)} (${injury.total}): ${esc(injury.name)}.`
    );
  }
  // A plain outcome on an open card is written on the damage card itself, so one hit does not add a third card; one
  // with a save to roll or dice to show keeps its own card, as does any outcome on a whispered or blind card.
  const report = reportText(lines),
    inline =
      !failed && !pendingSave && !rolls.length && report.length > 0 && !message.blind && !message.whisper?.length;
  if (!inline && lines.filter(Boolean).length) await postDamageReport(target, lines, { pendingSave, rolls });
  // Nothing was written, so the card is not marked: its Apply button stays for another try.
  if (failed) return null;
  // When the card cannot be marked the report above is the record; an outcome meant for the card is posted instead.
  const marked = await markCard(
    message,
    "damageAppliedEntry",
    {
      targetUuid: target.uuid,
      name: target.name,
      damage,
      kind,
      ...(ouch ? { ouch: true, net: result.net } : {}),
      ...(inline ? { report } : {})
    },
    { quiet: true }
  );
  if (inline && !marked) await postDamageReport(target, lines, { pendingSave, rolls });
  // The first critical shot of a Burst or Autofire, a Table of Ouch one included: the attack's other damage cards
  // become normal hits.
  const attackMessage = check.sourceAttack?.uuid ? fromUuidSync(check.sourceAttack.uuid) : null;
  if (
    (critical || crit.ouch) &&
    attackMessage &&
    (Number(attack?.attackResolution?.hits) || 1) > 1 &&
    !attack.criticalShotApplied
  )
    await markCard(attackMessage, "criticalShotApplied", { damageMessageId: message.id }, { quiet: true });
  try {
    const entry = undoEntry(target, beforeDamage, snapshot(target));
    if (entry)
      await postUndo(loc`${damage} ${kind} damage applied to ${target.name}`, [entry], {
        damageCard: { messageId: message.id, targetUuid: target.uuid }
      });
  } catch (error) {
    console.warn("Field Agent's Handbook | No Undo note could be left for this damage.", error);
  }
  return result ?? true;
}

/**
 * A Table of Ouch critical: the injured agent's owner (or the GC) rolls it from the damage card, once per target
 * (p.329). The event reference is fixed, so a second press shows the injury already rolled instead of a new one.
 * Shown under the attacker's buttons and, for a player who owns only the target, in the target's own row.
 */
export function ouchInjuryControls(message, check) {
  const controls = [];
  for (const entry of appliedDamageEntries(check).filter(entry => entry.ouch === true)) {
    const injured = fromUuidSync(entry.targetUuid);
    if (!injured?.isOwner) continue;
    controls.push({
      id: "ouchInjury",
      label: loc`Table of Ouch: ${injured.name}`,
      hint: loc`Roll ${injured.name}’s critical injury on the Table of Ouch`,
      run: () =>
        rollCriticalInjury(injured, {
          id: `ouch-${message.id}-${injured.id}`,
          damage: entry.net,
          source: loc`Critical hit: ${fromUuidSync(check.weaponUuid ?? "")?.name ?? loc`Damage`}`,
          confirmed: true
        })
    });
  }
  return controls;
}

/** What does not fit a relayed damage request: who asks, and whether the amount is above the card's roll. */
function damageConcerns(message, inputs, user) {
  const { rolled } = damageFacts(message),
    rolledAmount = Math.max(0, Math.trunc(Number(rolled) || 0));
  return [
    requesterConcern(message, user),
    ...inputs.map(input =>
      Number(input?.damage) > rolledAmount
        ? loc`Damage raised from the card's ${rolledAmount} to ${Number(input.damage)}.`
        : null
    )
  ];
}

registerRelay("applyDamage", {
  concerns: ({ messageId, input = {} }, user) => damageConcerns(game.messages.get(messageId), [input], user),
  async describe({ messageId, input = {} }, user) {
    const message = game.messages.get(messageId),
      target = input.targetUuid ? await fromUuid(input.targetUuid) : null;
    if (!message || !target) throw new Error(loc`The damage card or its target is no longer there.`);
    return loc`${esc(user.name)} applies ${esc(Number(input.damage) || 0)} ${esc(input.kind ?? "lethal")} damage to ${esc(target.name)}${input.critical === true ? loc` (a critical hit)` : ""}. Allow it?`;
  },
  async run({ messageId, input = {} }) {
    const message = game.messages.get(messageId);
    if (!message) throw new Error(loc`The damage card is no longer there.`);
    const result = await applyDamage(message, { ...input, targetUuid: input.targetUuid ?? "" });
    // Tell the player's client it did not happen; the GC's screen shows the reason.
    if (!result) throw new Error(loc`The GC’s client did not apply the damage; the GC sees why.`);
    return true;
  }
});

registerRelay("applyDamageMany", {
  concerns: ({ messageId, inputs = [] }, user) =>
    damageConcerns(game.messages.get(messageId), Array.isArray(inputs) ? inputs : [], user),
  async describe({ messageId, inputs = [] }, user) {
    const message = game.messages.get(messageId);
    if (!message || !Array.isArray(inputs) || !inputs.length)
      throw new Error(loc`The damage card or its targets are no longer there.`);
    const rows = [];
    for (const input of inputs) {
      const target = input?.targetUuid ? await fromUuid(input.targetUuid) : null;
      if (!target) throw new Error(loc`A target of this damage is no longer there.`);
      rows.push(
        `${esc(target.name)}: ${esc(Number(input.damage) || 0)} ${esc(input.kind ?? "lethal")}${input.critical === true ? loc` (a critical hit)` : ""}`
      );
    }
    return `${loc`${esc(user.name)} applies damage to ${inputs.length} targets. Allow it?`}<br>${rows.join("<br>")}`;
  },
  async run({ messageId, inputs = [] }) {
    const message = game.messages.get(messageId);
    if (!message) throw new Error(loc`The damage card is no longer there.`);
    const done = [],
      missed = [];
    for (const input of inputs) {
      const target = input?.targetUuid ? await fromUuid(input.targetUuid) : null;
      const result = target ? await applyDamage(message, { ...input, targetUuid: input.targetUuid }) : false;
      (result ? done : missed).push(target ? targetLabel(target) : loc`a missing target`);
    }
    return { done, missed };
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
    if (!actors.length) return refuse(loc`There is no character to apply the blast to.`);
    const rows = actors
      .map((actor, index) => {
        const row = measured.get(actor.uuid);
        return `<tr><td><label><input type="checkbox" name="hit${index}"${row && !row.behindWall ? " checked" : ""} /> ${esc(actor.isOwner ? actor.name : loc`${actor.name} (sent to the GC)`)}${row?.behindWall ? ` <i>${loc`(behind a wall)`}</i>` : ""}</label></td><td><input type="number" name="feet${index}" aria-label="${esc(loc`${actor.name}: feet from Ground Zero`)}" min="0" step="5" value="${row ? row.ring * increment : ""}" class="w-2" /></td><td>${row ? row.damage : ""}</td></tr>`;
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
  if (!input.targets.length) return refuse(loc`Tick at least one character caught in the blast.`);
  const inputs = input.targets
    .map(row => ({ row, at: blastDamageAt(rolled, row.distanceFeet, increment) }))
    .filter(({ at }) => at.damage >= 1)
    .map(({ row, at }) => ({
      targetUuid: row.uuid,
      damage: at.damage,
      kind: input.kind ?? profile.kind,
      type: input.type ?? profile.type,
      attackKind: input.attackKind ?? attackKind,
      armorPiercing: input.armorPiercing ?? profile.armorPiercing,
      armorPiercingAll: input.armorPiercingAll === true,
      blast: true
    }));
  const { done, missed } = await applyDamageBatch(message, inputs);
  await postBatchSummary(message, done, missed);
  return done;
}

/**
 * Apply damage to several targets. Targets this user owns are settled here, one after another; all the others go to
 * the GC as ONE request, so the GC answers a single Allow card instead of one per target and the player waits once.
 * @returns {Promise<{done: string[], missed: string[]}>} target labels the damage reached, and did not
 */
export async function applyDamageBatch(message, inputs) {
  const done = [],
    missed = [],
    relayed = [];
  for (const input of inputs) {
    const target = input.targetUuid ? await fromUuid(input.targetUuid) : null;
    if (target && !target.isOwner && !game.user?.isGM && gcAvailable()) {
      relayed.push(input);
      continue;
    }
    const result = await applyDamage(message, input);
    (result ? done : missed).push(target ? targetLabel(target) : input.targetUuid);
  }
  if (relayed.length) {
    try {
      ui.notifications.info(loc`Sent to the GC: damage to ${relayed.length} target(s).`);
      const answer = await askGC("applyDamageMany", { messageId: message.id, inputs: relayed });
      done.push(...(answer?.done ?? []));
      missed.push(...(answer?.missed ?? []));
    } catch (error) {
      refuse(error.message);
      for (const input of relayed) {
        const target = fromUuidSync(input.targetUuid);
        missed.push(target ? targetLabel(target) : input.targetUuid);
      }
    }
  }
  return { done, missed };
}

/** One line per outcome after a multi-target apply; a target the damage did not reach is always named. */
async function postBatchSummary(message, done, missed) {
  if (done.length + missed.length < 2 && !missed.length) return;
  const lines = [
    ...(done.length > 1
      ? [loc`Damage applied to ${done.length} targets: ${done.join(", ")}.`]
      : done.length
        ? [loc`Damage applied to ${done[0]}.`]
        : []),
    ...(missed.length ? [loc`Not applied to: ${missed.join(", ")}. Check the warnings and apply those by hand.`] : [])
  ];
  await ChatMessage.create({
    speaker: message.speaker,
    content: `<div class="spycraft2 chat-note">${lines.map(line => `<p>${esc(line)}</p>`).join("")}</div>`
  });
}

/** The apply dialog's defaults for one target, so a click can apply them without opening it. */
/** A line above the critical fields when the defaults differ from a plain critical hit. */
function criticalHint(crit) {
  if (crit.laterShot)
    return `<p class="hint">${loc`Another shot of this attack was already applied as the critical hit; only the first shot of a Burst or Autofire is critical (pp.354-355).`}</p>`;
  if (crit.ouch)
    return `<p class="hint">${loc`A Table of Ouch injury was chosen for this critical hit, so the damage is applied normally; roll the injury from the button on this card afterwards (p.329).`}</p>`;
  return "";
}

export function quickApplyInput(message, targetUuid, damage = null) {
  const { rolled, profile, attack, attackKind } = damageFacts(message);
  return {
    targetUuid,
    damage: damage ?? Math.max(0, Math.trunc(rolled)),
    kind: profile.kind,
    type: profile.type ?? "",
    attackKind,
    armorPiercing: profile.armorPiercing,
    armorPiercingAll: false,
    ...(({ critical, criticalDice }) => ({ critical, criticalDice }))(criticalDamageDefaults(attack, message.id)),
    blast: profile.blast === true,
    reviewType: true
  };
}

/** The target a damage card already names: the hit it came from, or the attack bonus it used. */
export function damageCardTarget(check) {
  const uuid =
    check.sourceAttack?.targetUuid || check.sneakAttackTarget?.actorUuid || check.attackDamageBenefit?.targetUuid;
  const actor = uuid ? fromUuidSync(uuid) : null;
  return actor && TARGET_TYPES.includes(actor.type) && canSee(actor) ? actor : null;
}

/** Characters targeted on the canvas that damage can be applied to (this user's own, or any through the GC). */
export const targetedForDamage = () =>
  values(game.user?.targets)
    .map(token => token.actor)
    .filter(actor => actor && TARGET_TYPES.includes(actor.type) && (actor.isOwner || gcAvailable()));

/**
 * Apply the same damage to several targets at once, each with its own save or report, then post one summary.
 * @param {ChatMessage} message  the damage card
 * @param {Actor[]} targets
 */
export async function applyDamageToEach(message, targets) {
  const { done, missed } = await applyDamageBatch(
    message,
    targets.map(target => quickApplyInput(message, target.uuid))
  );
  // The summary names any target the damage did not reach, so a refusal is never reported as applied.
  await postBatchSummary(message, done, missed);
  return done;
}

rollPipeline.register({
  id: "applyDamageControl",
  kinds: ["damage"],
  order: 9772,
  chatControls({ message, check }) {
    if (check.superseded) return null;
    const applied = appliedDamageEntries(check);
    const rolled = Number.isFinite(check.effectiveTotal) ? check.effectiveTotal : message.rolls?.[0]?.total;
    const amount = Math.max(0, Math.trunc(Number(rolled) || 0));
    const controls = [];
    const targeted = targetedForDamage(),
      named = damageCardTarget(check) ?? (targeted.length === 1 ? targeted[0] : null);
    if (targeted.length > 1)
      controls.push({
        label: loc`Apply ${amount} to ${targeted.length} targets`,
        hint: loc`Apply ${amount} damage to each of the ${targeted.length} targeted tokens`,
        emphasis: "primary",
        run: () => applyDamageToEach(message, targetedForDamage())
      });
    else if (named && !applied.some(entry => entry.targetUuid === named.uuid) && (named.isOwner || gcAvailable()))
      controls.push({
        label: loc`Apply ${amount} to ${targetLabel(named)}`,
        emphasis: "primary",
        run: () => applyDamage(message, quickApplyInput(message, named.uuid))
      });
    controls.push({
      label: applied.length ? loc`Apply to another target…` : loc`Apply damage to a target…`,
      hint: loc`Choose a target and apply this damage to it`,
      // With no known target to apply to in one press, choosing one is the card's next step.
      ...(!applied.length && !controls.some(control => control.emphasis === "primary") ? { emphasis: "primary" } : {}),
      run: () => applyDamage(message)
    });
    if (/\bBLS\b/.test(check.weaponQualities ?? ""))
      controls.push({
        label: loc`Apply blast to all caught`,
        hint: loc`Apply the blast to everyone caught in it, by distance from the centre`,
        run: () => applyBlast(message)
      });
    controls.push(...ouchInjuryControls(message, check));
    return controls;
  }
});
