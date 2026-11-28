/** Spending GC action dice (pp.397–399, 424, 452): pay from the session pool, roll the right die and apply what can be applied. */
import { snapshot, undoEntry, postUndo, withUndo } from "../undo.mjs";
import { esc } from "../../html.mjs";
import { refuse } from "../../error-notices.mjs";
import { adjustGCDice, gcDiceStatus } from "../../services/gc-dice.mjs";
import { GC_SPENDS, planSpend, actionDieTotal } from "../../rules/gc/gc-spend.mjs";
import { campaignQuality, qualityAddition } from "../../rules/gc/campaign.mjs";
import { dramaticInitiative } from "../../rules/gc/fluid-initiative.mjs";
import { GC_DATA } from "../../rules/gc-tables.mjs";
import {
  requireGC,
  getSceneState,
  setSceneState,
  isDramaticScene,
  getMission,
  updateMission,
  qualitiesInForce,
  teamActors,
  missionEpoch
} from "./state.mjs";
import { spendProfile, npcIsSpecial, damageSaveState, resetDamageTrack } from "./npc-play.mjs";
import { antagonistRowFor, markAntagonistPromoted } from "./mission.mjs";
import { queueInitiative } from "../../services/combat-queue.mjs";
import { loc } from "../../i18n.mjs";
import { formDialog, formValues, raw } from "../dialog-kit.mjs";
import { boostNpcDefense } from "./npc-defense.mjs";
import { spendPostHitDefenseForNPC } from "./post-hit-defense.mjs";
import { declareSkillDC } from "./declared-skill-dc.mjs";

const ask = (title, content, ok, validate = null, dialog = {}) =>
  formDialog({ title, ok, validate, dialog, fields: [raw(content)] });
const options = (rows, selected) =>
  rows
    .map(
      ([value, label]) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`
    )
    .join("");
const gmWhisper = () => ChatMessage.getWhisperRecipients("GM").map(user => user.id);

/** Roll one exploding action die. In a dramatic scene the GC's dice also explode on a natural 1 (p.424). */
export async function rollGCDie(faces, { explodeLow = false } = {}) {
  const rolls = [],
    rollObjects = [];
  for (let i = 0; i < 100; i++) {
    const roll = await new Roll(`1d${faces}`).evaluate();
    rolls.push(roll.total);
    rollObjects.push(roll);
    if (actionDieTotal(faces, rolls, { explodeLow }).complete) break;
  }
  // rollObjects go on the spend's chat card, so the dice behind the total can be seen (and animated).
  return { faces, rolls, rollObjects, total: rolls.reduce((sum, value) => sum + value, 0) };
}

/**
 * The NPCs a spend can name, in the order a GC looks for them: the one asked for (the acting NPC), the NPCs in the
 * viewed fight with their Count, the selected tokens, then the rest of the world under their own label. A token copy
 * and its sidebar actor are told apart by that label.
 * @returns {Array<[string, string, Actor]>} uuid, label, actor
 */
export function npcChoices(preferActor = null) {
  const rows = new Map();
  const add = (actor, label) => {
    if (actor?.type !== "npc" || rows.has(actor.uuid)) return;
    rows.set(actor.uuid, [actor.uuid, label, actor]);
  };
  if (preferActor) add(preferActor, loc`${preferActor.name} (acting)`);
  for (const combatant of game.combat?.turns ?? [])
    add(
      combatant.actor,
      Number.isFinite(combatant.initiative)
        ? loc`${combatant.name} · Count ${combatant.initiative}`
        : loc`${combatant.name} · in this fight`
    );
  for (const token of canvas?.tokens?.controlled ?? [])
    add(token.actor, loc`${token.name ?? token.actor?.name} · selected`);
  const inFight = rows.size > 0;
  for (const actor of game.actors ?? []) add(actor, inFight ? loc`${actor.name} (not in this fight)` : actor.name);
  return [...rows.values()];
}

/** The plan a spend dialog's entry would pay for, or why it would be refused: { plan } or { refusal }. */
function spendQuote(values, { dramatic, status }) {
  const spend = GC_SPENDS.find(entry => entry.id === values.id);
  if (!spend) return { refusal: loc`Choose a use for the action dice.` };
  const actor = spend.needsNpc && values.actorId ? globalThis.fromUuidSync?.(values.actorId) : null;
  if (spend.needsNpc && actor?.type !== "npc") return { refusal: loc`Choose the NPC this applies to.` };
  if (values.id === "boostDC" && !String(values.dcCheck ?? "").trim())
    return { refusal: loc`Name the check whose DC rises, so its earlier boosts are counted.` };
  try {
    const quality = values.id === "campaignQuality" ? campaignQuality(values.qualityId) : null;
    const plan = planSpend(values.id, {
      npc: actor ? spendProfile(actor) : null,
      dramatic,
      dice: Number(values.dice) || 1,
      checkKind: values.checkKind,
      alreadyBoostedDC:
        values.id === "boostDC"
          ? Number(getSceneState().dcBoostsByCheck?.[String(values.dcCheck).trim().toLowerCase()]?.count) || 0
          : 0,
      eventCost: Number(values.eventCost) || 1,
      triggered: !!values.triggered,
      free: !!values.free,
      qualityCost: quality?.gcDice ?? null,
      fromDeath: !values.fromCapture,
      inCombat: !!game.combat?.started
    });
    if (plan.cost > status.value)
      return { refusal: loc`That costs ${plan.cost} action dice; the GC has ${status.value}.` };
    return { plan };
  } catch (error) {
    return { refusal: error.message };
  }
}

/** Why a spend dialog's entry would be refused, or "" when it can go ahead. Read before the dialog closes. */
const spendRefusal = (values, context) => spendQuote(values, context).refusal ?? "";

/**
 * The line a spend dialog shows before its button is pressed: the cost, the pool before and after, the die rolled
 * and what the rules attach to the spend. Empty while the entry is incomplete, since the refusal says why.
 */
export function spendCostLine(values, context) {
  const { plan } = spendQuote(values, context);
  if (!plan) return "";
  const left = context.status.value - plan.cost;
  const cost =
    plan.cost === 0
      ? loc`No dice spent: the pool stays at ${context.status.value}.`
      : plan.cost === 1
        ? loc`Costs 1 die: the pool goes from ${context.status.value} to ${left}.`
        : loc`Costs ${plan.cost} dice: the pool goes from ${context.status.value} to ${left}.`;
  return [cost, plan.die ? loc`Rolls a d${plan.die}.` : "", ...(plan.notes ?? [])].filter(Boolean).join(" ");
}

/**
 * Spend GC action dice on one of the listed uses. `input` may pre-fill the dialog:
 * {id, actor, dice, checkKind, eventCost, triggered, free, qualityId, public}
 */
export async function spendGCDice(input = {}) {
  requireGC();
  const status = gcDiceStatus();
  if (!status.current) return refuse(loc`Initialize the GC action dice for this session first.`);
  const dramatic = isDramaticScene(),
    scene = getSceneState();
  if (!input.id) {
    const actors = npcChoices(input.preferActor ?? null);
    const uses = GC_SPENDS.filter(spend => dramatic || !spend.dramaticOnly).map(spend => [
      spend.id,
      `${spend.label} (p.${spend.page})`
    ]);
    const qualityRows = GC_DATA.campaignQualities
      .filter(quality => quality.gcDice)
      .map(quality => [quality.id, `${quality.name} (${quality.gcDice})`]);
    const eventRows = GC_DATA.tables.events.map(event => [event.id, event.name]);
    const picked = await ask(
      loc`GC action dice — ${status.value} left${dramatic ? loc` · dramatic scene` : ""}`,
      `
      <p>${loc`The GC's action dice raise NPC rolls, Defense and DCs, pay for NPC criticals and agents' errors, and buy events. Pick one use; its cost shows below before anything is spent.`}</p>
      <label>${loc`Use`} <select name="id">${options(uses)}</select></label>
      <label data-when="id=boostRoll|boostDefense|boostDefenseAfterHit|boostInitiative|activateThreat|healNpc|promote|saveNpc|knowsNothing">${loc`NPC`} <select name="actorId">${options([["", "—"], ...actors.map(([uuid, label]) => [uuid, label])], actors[0]?.[0] ?? "")}</select></label>
      <label data-when="id=activateThreat|activateError">${loc`Threat or error scored with`} <select name="checkKind">${options(
        [
          ["attack", loc`an attack`],
          ["skill", loc`a skill check`]
        ],
        "attack"
      )}</select></label>
      <label data-when="id=activateThreat|activateError">${loc`Dice for a variable cost (critical activation)`} <input type="number" name="dice" min="1" value="1" /></label>
      <label data-when="id=boostDC">${loc`Check whose DC rises (each DC takes only so many dice)`} <input name="dcCheck" list="sc2-dc-checks" placeholder="${loc`e.g. the vault door's Security check`}" /></label>
      <datalist id="sc2-dc-checks">${Object.values(scene.dcBoostsByCheck ?? {})
        .map(entry => `<option value="${esc(entry.name)}"></option>`)
        .join("")}</datalist>
      <label data-when="id=event">${loc`Event`} <select name="eventId">${options(eventRows)}</select></label>
      <label data-when="id=event">${loc`Event intensity (1–4 dice)`} <input type="number" name="eventCost" min="1" max="4" value="1" /></label>
      <label data-when="id=event"><input type="checkbox" name="triggered" /> ${loc`One of the event's listed triggers has occurred (−1 die)`}</label>
      <label data-when="id=event"><input type="checkbox" name="free" /> ${loc`Prompted by a Subplot or another rule (no cost)`}</label>
      <label data-when="id=campaignQuality">${loc`Campaign quality`} <select name="qualityId">${options(qualityRows)}</select></label>
      <label data-when="id=healNpc">${loc`A special NPC regains`} <select name="healAs">${options([
        ["vitality", loc`Vitality equal to the die`],
        ["wounds", loc`2 wounds`]
      ])}</select></label>
      <label data-when="id=saveNpc"><input type="checkbox" name="fromCapture" /> ${loc`Saving the NPC from capture rather than death`}</label>
      <label><input type="checkbox" name="public" /> ${loc`Show the result to the players`}</label>
      <p class="hint" data-spend-cost role="status"></p>`,
      loc`Spend dice`,
      // A spend that would be refused keeps the dialog open with the reason, so nothing typed is lost.
      values => spendRefusal(values, { dramatic, status }),
      {
        // The cost is stated before the button is pressed, and follows each change to the entry.
        render: (event, app) => {
          const root = app?.element ?? event?.target,
            form = root?.querySelector?.("form"),
            line = root?.querySelector?.("[data-spend-cost]");
          if (!form || !line) return;
          const show = () => (line.textContent = spendCostLine(formValues(form), { dramatic, status }));
          form.addEventListener("input", show);
          form.addEventListener("change", show);
          show();
        }
      }
    );
    if (!picked) return null;
    input = { ...picked, actor: picked.actorId ? await fromUuid(picked.actorId) : null };
  }
  const spend = GC_SPENDS.find(entry => entry.id === input.id);
  if (!spend) return refuse(loc`Choose a use for the action dice.`);
  if (input.id === "boostDC") return declareSkillDC(input);
  const actor = spend.needsNpc ? input.actor : null;
  if (spend.needsNpc && actor?.type !== "npc") return refuse(loc`Choose the NPC this applies to.`);
  if (input.id === "boostDefense") return boostNpcDefense(actor, input);
  if (input.id === "boostDefenseAfterHit") return spendPostHitDefenseForNPC(actor, input);
  const quality = input.id === "campaignQuality" ? campaignQuality(input.qualityId) : null;
  // DC boosts are counted per named check for this scene, so the limit of pp.397 and 424 holds (B-010).
  const dcCheck = String(input.dcCheck ?? "").trim();
  if (input.id === "boostDC" && !dcCheck && input.alreadyBoostedDC === undefined)
    return refuse(loc`Name the check whose DC rises, so its earlier boosts are counted.`);
  const dcKey = dcCheck.toLowerCase();
  const earlierBoosts =
    input.alreadyBoostedDC !== undefined
      ? Number(input.alreadyBoostedDC) || 0
      : // Read again now the dialog is closed: a boost made while it was open counts too.
        Number(getSceneState().dcBoostsByCheck?.[dcKey]?.count) || 0;
  let plan;
  try {
    if (quality) qualityAddition(quality.id, { scope: "spend", active: qualitiesInForce() });
    plan = planSpend(input.id, {
      npc: actor ? spendProfile(actor) : null,
      dramatic,
      dice: Number(input.dice) || 1,
      checkKind: input.checkKind,
      alreadyBoostedDC: input.id === "boostDC" ? earlierBoosts : 0,
      eventCost: Number(input.eventCost) || 1,
      triggered: !!input.triggered,
      free: !!input.free,
      qualityCost: quality?.gcDice ?? null,
      fromDeath: !input.fromCapture,
      inCombat: !!game.combat?.started
    });
  } catch (error) {
    return refuse(error.message);
  }
  if (plan.cost > status.value) return refuse(loc`That costs ${plan.cost} action dice; the GC has ${status.value}.`);

  // What the spend changes on the NPC is pictured first; scene and mission changes have their own way back.
  // A spend made from a chat card changes that card's own result, which a note cannot take back: no note is left.
  const undoable = !input.onCard && !["dramaticScene", "campaignQuality"].includes(input.id),
    beforeSpend = actor && undoable ? snapshot(actor) : null;
  let antagonistBefore = null,
    dcBoostMade = null;
  const event = input.id === "event" ? GC_DATA.tables.events.find(entry => entry.id === input.eventId) : null;
  const reason = `${plan.label}${actor ? ` — ${actor.name}` : ""}${quality ? ` — ${quality.name}` : ""}${event ? ` — ${event.name}` : ""}`;
  if (plan.cost > 0) {
    try {
      await adjustGCDice(-plan.cost, reason);
    } catch (error) {
      return refuse(error.message);
    }
  }

  const die = plan.die ? await rollGCDie(plan.die, { explodeLow: plan.explodeLow }) : null;
  const lines = [
    `<b>${esc(reason)}</b>`,
    plan.cost === 1
      ? loc`Cost: 1 GC action die (p.${plan.page}).`
      : loc`Cost: ${plan.cost} GC action dice (p.${plan.page}).`
  ];
  if (die)
    lines.push(
      `d${die.faces}${plan.explodeLow ? loc` (explodes on 1 and maximum)` : ""}: ${die.rolls.join(" + ")} = <b>${die.total}</b>`
    );
  lines.push(...plan.notes.map(esc));

  // Apply the outcomes that are plain bookkeeping; the rest is reported for the GC to apply to the roll in question.
  try {
    switch (input.id) {
      case "dramaticScene":
        await setSceneState({ dramatic: true, source: "spent" });
        lines.push(
          loc`The scene is now dramatic: GC dice explode on 1 and maximum, opponents’ Initiative doubles (maximum 50), and up to 3 dice may boost one DC.`
        );
        break;
      case "campaignQuality":
        await updateMission(mission => ({
          qualities: [...(mission.qualities ?? []), { id: quality.id, scripted: false }]
        }));
        lines.push(esc(quality.summary));
        break;
      case "promote":
        // Undo puts the antagonist row back as it was, or takes it off when the promotion recorded it.
        // The mission period is kept, so Undo puts the row back only within this run of the mission.
        antagonistBefore = { entry: antagonistRowFor(actor), period: missionEpoch() };
        await actor.update({
          "system.promotion": { mission: String(actor.system.usagePeriods?.mission ?? "initial") }
        });
        // A promoted antagonist's XP is worked out as a full special NPC's, per scene (pp.398, 452).
        lines.push(await markAntagonistPromoted(actor));
        antagonistBefore.id = antagonistRowFor(actor)?.id ?? null;
        break;
      case "healNpc": {
        if (npcIsSpecial(actor)) {
          // Vitality equal to the die, or 2 wounds, as an agent heals with an action die (pp.62, 398); never past the
          // maximum. The spend's Undo note puts it back.
          const pool = input.healAs === "wounds" ? "wounds" : "vitality",
            now = Math.trunc(Number(actor.system[pool]?.value) || 0),
            max = Number(actor.system[pool]?.max),
            raised = now + (pool === "wounds" ? 2 : die.total),
            value = Number.isFinite(max) ? Math.max(now, Math.min(max, raised)) : raised;
          await actor.update({ [`system.${pool}.value`]: value });
          lines.push(pool === "wounds" ? loc`Wounds ${now} → ${value}.` : loc`Vitality ${now} → ${value}.`);
        } else {
          await resetDamageTrack(actor, { heal: die.total });
          lines.push(loc`Accumulated damage is now ${damageSaveState(actor).track.accumulated}.`);
        }
        break;
      }
      case "boostInitiative": {
        const combatant = game.combat?.combatants.find(entry => entry.actor === actor);
        if (combatant && Number.isFinite(combatant.initiative)) {
          await combatant.update({ initiative: combatant.initiative + die.total });
          lines.push(loc`Initiative Count ${combatant.initiative}.`);
        }
        break;
      }
      case "event":
        if (event) lines.push(esc(event.summary));
        break;
      default:
    }
  } catch (error) {
    lines.push(`<span class="bad">${loc`Not applied automatically: ${esc(error.message)}`}</span>`);
  }
  await ChatMessage.create({
    speaker: { alias: loc`Game Control` },
    content: lines.join("<br>"),
    ...(die?.rollObjects?.length ? { rolls: die.rollObjects } : {}),
    // A private spend stays private: whispered to the GC, and its dice shown only there.
    ...(input.public ? {} : { whisper: gmWhisper(), blind: true })
  });
  if (undoable)
    try {
      const entry = beforeSpend ? undoEntry(actor, beforeSpend, snapshot(actor)) : null;
      if (entry || plan.cost > 0)
        await postUndo(loc`GC action dice spent: ${reason}`, entry ? [entry] : [], {
          gcDice: plan.cost,
          antagonist: antagonistBefore?.id ? antagonistBefore : null,
          dcBoost: dcBoostMade
        });
    } catch (error) {
      console.warn("Field Agent's Handbook | No Undo note could be left for this spend.", error);
    }
  return { plan, die };
}

/** Make the current scene dramatic without spending dice (scripted as a complication, p.435) or return it to standard. */
export async function setDramaticScene(dramatic, { source = "scripted" } = {}) {
  requireGC();
  await setSceneState({ dramatic: !!dramatic, source: dramatic ? source : null });
  return getSceneState();
}

/**
 * An opponent of the agents for the dramatic-scene doubling (p.424): a hostile token, or, with no token to say, a
 * combatant no player owns. Allied and neutral NPCs keep their Counts.
 */
export function dramaticOpponent(combatant) {
  if (combatant.hasPlayerOwner) return false;
  const disposition = combatant.token?.disposition;
  const hostile = globalThis.CONST?.TOKEN_DISPOSITIONS?.HOSTILE ?? -1;
  return Number.isFinite(disposition) ? disposition === hostile : true;
}

/** Dramatic scene: double each opponent's current Initiative Count, to at most 50 (p.424). Each combatant is doubled once per combat. */
export function doubleOpponentInitiative(combat = game.combat, options = {}) {
  requireGC();
  // On the Initiative queue, so a doubling never lands in the middle of the end-of-round pass (p.424).
  return queueInitiative(() => doubleNow(combat, options));
}

/**
 * Who a dramatic scene would double in a fight as things stand, with the Count each would move to. `skip` marks the
 * combatants the GC took off the list.
 */
export function dramaticDoublingPreview(combat) {
  return [...(combat?.combatants ?? [])]
    .filter(
      combatant =>
        dramaticOpponent(combatant) &&
        Number.isFinite(combatant.initiative) &&
        !combatant.flags?.spycraft2?.dramaticDoubled
    )
    .map(combatant => ({
      id: combatant.id,
      name: combatant.name,
      from: combatant.initiative,
      to: dramaticInitiative(combatant.initiative)
    }));
}

/**
 * Begin a dramatic scene from one dialog (p.424): scripted at no cost or declared now for GC action dice, with the
 * opponents whose Counts will double listed first so the GC can take any off. Says in chat, to the GC, what began.
 */
export async function startDramaticScene(combat = game.combat, input = null) {
  requireGC();
  if (isDramaticScene()) return refuse(loc`The current scene is already dramatic.`);
  const status = gcDiceStatus(),
    cost = GC_SPENDS.find(spend => spend.id === "dramaticScene")?.cost ?? 4,
    preview = dramaticDoublingPreview(combat?.started || combat?.combatants?.size ? combat : null);
  if (!input) {
    input = await formDialog({
      title: loc`Make this scene dramatic`,
      ok: loc`Begin the dramatic scene`,
      intro: loc`In a dramatic scene the GC's action dice explode on a 1 as well as their maximum, up to 3 dice may boost one DC, and each opponent's Initiative Count doubles, to 50 at most (p.424).`,
      fields: [
        {
          select: "source",
          label: loc`How it comes about`,
          options: [
            ["scripted", loc`Scripted in the mission (no cost)`],
            ["spent", loc`Declared now for ${cost} GC action dice (${status.current ? status.value : 0} left)`]
          ]
        },
        raw(
          preview.length
            ? `<fieldset><legend>${esc(loc`Counts that double now`)}</legend>${preview
                .map(
                  row =>
                    `<label><input type="checkbox" name="double-${esc(row.id)}" checked /> ${esc(row.name)}: ${row.from} → ${row.to}</label>`
                )
                .join(
                  ""
                )}<p class="hint">${esc(loc`Untick anyone who is not an opponent of the agents. An opponent who rolls later is doubled as its Count comes in.`)}</p></fieldset>`
            : `<p class="hint">${esc(loc`No opponent has an Initiative Count yet. Each one is doubled as its Count comes in.`)}</p>`
        )
      ],
      validate: values =>
        values.source === "spent" && !(status.current && status.value >= cost)
          ? loc`The GC's pool has fewer than ${cost} action dice: begin a session, or choose the scripted scene.`
          : ""
    });
    if (!input) return null;
  }
  const skip = new Set(preview.filter(row => input[`double-${row.id}`] === false).map(row => row.id));
  if (input.source === "spent") {
    if (!(await spendGCDice({ id: "dramaticScene" })) || !isDramaticScene()) return null;
  } else await setDramaticScene(true);
  const changed = combat ? await doubleOpponentInitiative(combat, { quiet: true, skip, silent: true }) : [];
  await ChatMessage.create({
    speaker: { alias: loc`Game Control` },
    content: `<b>${esc(input.source === "spent" ? loc`Dramatic scene, declared for ${cost} GC action dice.` : loc`Dramatic scene, scripted (no dice spent).`)}</b><br>${esc(loc`GC action dice explode on 1 and their maximum; up to 3 dice may boost one DC; opponents' Initiative Counts double, to 50 at most (p.424).`)}${
      changed.length ? `<br>${esc(loc`Doubled now:`)} ${changed.map(esc).join("; ")}` : ""
    }${
      skip.size
        ? `<br>${esc(
            loc`Left as they were: ${preview
              .filter(row => skip.has(row.id))
              .map(row => row.name)
              .join(", ")}.`
          )}`
        : ""
    }`,
    whisper: gmWhisper()
  });
  return { source: input.source, doubled: changed, skipped: [...skip] };
}

async function doubleNow(combat, { quiet = false, skip = null, silent = false } = {}) {
  if (!combat) return quiet ? [] : refuse(loc`There is no active combat.`);
  if (!isDramaticScene()) return quiet ? [] : refuse(loc`Only a dramatic scene doubles opponents’ Initiative (p.424).`);
  const changed = [];
  for (const combatant of combat.combatants) {
    if (
      !dramaticOpponent(combatant) ||
      !Number.isFinite(combatant.initiative) ||
      combatant.flags?.spycraft2?.dramaticDoubled
    )
      continue;
    // Taken off the list by the GC: marked as dealt with, so a later pass leaves the Count alone too.
    if (skip?.has(combatant.id)) {
      await combatant.update({ "flags.spycraft2.dramaticDoubled": true });
      continue;
    }
    const next = dramaticInitiative(combatant.initiative);
    await combatant.update({ initiative: next, "flags.spycraft2.dramaticDoubled": true });
    changed.push(`${combatant.name}: ${next}`);
  }
  if (changed.length && !silent)
    await ChatMessage.create({
      speaker: { alias: loc`Game Control` },
      content: `${loc`Dramatic scene — opponents’ Initiative Counts doubled (maximum 50).`}<br>${changed.map(esc).join("<br>")}`,
      whisper: gmWhisper()
    });
  return changed;
}

/** An opponent who joins or rolls once the scene is dramatic is doubled when it first has a Count (p.424). */
export function installDramaticInitiative() {
  Hooks.on("updateCombatant", (combatant, changed) => {
    if (game.users?.activeGM?.id !== game.user.id || !Object.hasOwn(changed, "initiative")) return;
    if (!Number.isFinite(changed.initiative) || combatant.flags?.spycraft2?.dramaticDoubled) return;
    if (!isDramaticScene() || !dramaticOpponent(combatant)) return;
    doubleOpponentInitiative(combatant.combat, { quiet: true }).catch(error =>
      console.warn("Field Agent's Handbook | A dramatic Initiative Count was not doubled.", error)
    );
  });
}

/** Mission Caliber increase (p.398): the stored Caliber follows the pool's +2 dice per step. */
export async function recordCaliberIncrease(caliber) {
  requireGC();
  const mission = getMission();
  if (!Number.isSafeInteger(caliber) || caliber <= mission.caliber || caliber > 5)
    return refuse(loc`Choose a higher Caliber, up to V.`);
  const steps = caliber - mission.caliber,
    was = mission.caliber,
    gained = gcDiceStatus().current ? 2 * steps : 0;
  // The raised Caliber caps every pick and Request for the rest of the mission, so it reaches the team's reserves.
  // Loaded here, not at the top, so the console does not change the order the roll contributors register in.
  const { reserveCaliberIncrease } = await import("../../rules/gear-acquisition.mjs");
  const roman = CONFIG.SPYCRAFT.calibers[caliber],
    team = teamActors().filter(actor => reserveCaliberIncrease(actor.system, caliber));
  // One Undo puts back the team's reserves, the mission's Caliber and the GC dice it gave.
  await withUndo(
    team,
    loc`Mission Caliber raised to ${roman}`,
    async () => {
      if (gained) await adjustGCDice(gained, `Mission Caliber increased to ${caliber}`);
      await updateMission({ caliber });
      await Promise.all(team.map(actor => actor.update(reserveCaliberIncrease(actor.system, caliber))));
    },
    () => ({ missionCaliber: { was, now: caliber, gained, period: missionEpoch() } })
  );
  await ChatMessage.create({
    speaker: { alias: loc`Game Control` },
    content: esc(
      loc`Mission Caliber is now ${roman}. At the end of this scene, agents may trade mission gear for new picks at Caliber ${roman}, and it caps every Request for the rest of the mission (p.398).`
    )
  });
  return steps;
}
