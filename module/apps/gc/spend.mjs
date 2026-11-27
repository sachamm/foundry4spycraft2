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
  teamActors
} from "./state.mjs";
import { spendProfile, npcIsSpecial, damageSaveState, resetDamageTrack } from "./npc-play.mjs";
import { antagonistRowFor, markAntagonistPromoted } from "./mission.mjs";
import { queueInitiative } from "../../services/combat-queue.mjs";
import { loc } from "../../i18n.mjs";
import { formDialog, raw } from "../dialog-kit.mjs";

const ask = (title, content, ok) => formDialog({ title, ok, fields: [raw(content)] });
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

const npcActors = () => {
  const controlled = (canvas?.tokens?.controlled ?? [])
    .map(token => token.actor)
    .filter(actor => actor?.type === "npc");
  const all = [...(game.actors ?? [])].filter(actor => actor.type === "npc");
  return [...new Set([...controlled, ...all])];
};

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
    const actors = npcActors();
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
      <label>${loc`Use`} <select name="id">${options(uses)}</select></label>
      <label data-when="id=boostRoll|boostDefense|boostDefenseAfterHit|boostInitiative|activateThreat|healNpc|promote|saveNpc|knowsNothing">${loc`NPC`} <select name="actorId">${options([["", "—"], ...actors.map(actor => [actor.uuid, actor.name])], actors[0]?.uuid ?? "")}</select></label>
      <label data-when="id=activateThreat|activateError">${loc`Threat or error scored with`} <select name="checkKind">${options(
        [
          ["attack", "an attack"],
          ["skill", "a skill check"]
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
      <label><input type="checkbox" name="public" /> ${loc`Show the result to the players`}</label>`,
      loc`Spend dice`
    );
    if (!picked) return null;
    input = { ...picked, actor: picked.actorId ? await fromUuid(picked.actorId) : null };
  }
  const spend = GC_SPENDS.find(entry => entry.id === input.id);
  if (!spend) return refuse(loc`Choose a use for the action dice.`);
  const actor = spend.needsNpc ? input.actor : null;
  if (spend.needsNpc && actor?.type !== "npc") return refuse(loc`Choose the NPC this applies to.`);
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
    loc`Cost: ${plan.cost} GC action di${plan.cost === 1 ? "e" : "ce"} (p.${plan.page}).`
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
        antagonistBefore = { entry: antagonistRowFor(actor) };
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
      case "boostDefense":
        lines.push(loc`+2 Defense for ${die.total} round(s).`);
        break;
      case "boostDefenseAfterHit":
        lines.push(loc`+${die.total} Defense against that attack only; it may now miss.`);
        break;
      case "boostDC": {
        lines.push(
          dcCheck ? loc`The DC of ${esc(dcCheck)} rises by ${die.total}.` : loc`The DC rises by ${die.total}.`
        );
        if (dcKey) {
          const scene = getSceneState(),
            now = scene.dcBoostsByCheck ?? {};
          dcBoostMade = { scene: scene.scene, key: dcKey };
          await setSceneState({
            dcBoostsByCheck: {
              ...now,
              [dcKey]: { name: dcCheck, count: (Number(now[dcKey]?.count) || 0) + 1 }
            }
          });
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
export async function doubleOpponentInitiative(combat = game.combat, { quiet = false } = {}) {
  requireGC();
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
    const next = dramaticInitiative(combatant.initiative);
    await combatant.update({ initiative: next, "flags.spycraft2.dramaticDoubled": true });
    changed.push(`${combatant.name}: ${next}`);
  }
  if (changed.length)
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
    queueInitiative(() => doubleOpponentInitiative(combatant.combat, { quiet: true })).catch(error =>
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
  const steps = caliber - mission.caliber;
  if (gcDiceStatus().current) await adjustGCDice(2 * steps, `Mission Caliber increased to ${caliber}`);
  await updateMission({ caliber });
  // The raised Caliber caps every pick and Request for the rest of the mission, so it reaches the team's reserves.
  // Loaded here, not at the top, so the console does not change the order the roll contributors register in.
  const { reserveCaliberIncrease } = await import("../../rules/gear-acquisition.mjs");
  const roman = CONFIG.SPYCRAFT.calibers[caliber],
    team = teamActors().filter(actor => reserveCaliberIncrease(actor.system, caliber));
  if (team.length)
    await withUndo(team, loc`Team reserves raised to mission Caliber ${roman}`, () =>
      Promise.all(team.map(actor => actor.update(reserveCaliberIncrease(actor.system, caliber))))
    );
  await ChatMessage.create({
    speaker: { alias: loc`Game Control` },
    content: esc(
      loc`Mission Caliber is now ${roman}. At the end of this scene, agents may trade mission gear for new picks at Caliber ${roman}, and it caps every Request for the rest of the mission (p.398).`
    )
  });
  return steps;
}
