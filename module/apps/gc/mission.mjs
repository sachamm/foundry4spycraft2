/** Mission record dialogs (pp.423–440): Threat Level, Caliber, objectives, complications, antagonists, exposure and rewards. */
import { honorExposureMultiplier } from "../../rules/campaign-rules.mjs";
import { esc } from "../../html.mjs";
import { refuse, decline } from "../../error-notices.mjs";
import {
  threatLevel,
  threatBonusActionDice,
  missionStanding,
  characterMissionXP,
  exposurePenalty,
  defaultMission,
  sessionDiceApplied
} from "../../rules/gc/mission.mjs";
import { qualityAddition, qualityClash, adjustedStartingDice } from "../../rules/gc/campaign.mjs";
import { resolveDevice, SECURITY_DEVICES } from "../../rules/gc/security.mjs";
import { GC_DATA } from "../../rules/gc-tables.mjs";
import { gearRestrictionNames } from "../../rules/gear-restrictions.mjs";
import {
  requireGC,
  getMission,
  setMission,
  updateMission,
  teamActors,
  teamLevels,
  fixThreatLevel,
  missionXP,
  qualitiesInForce,
  currentCampaignEffects,
  getCampaign,
  setCampaign,
  missionEpoch
} from "./state.mjs";
import { loc } from "../../i18n.mjs";
import { withUndo, postUndo } from "../undo.mjs";
import { standingStatus, liquidationCheck } from "../../rules/standing.mjs";
import { startUsagePeriod } from "../../services/periods.mjs";
import { gcDiceStatus, initializeGCDice } from "../../services/gc-dice.mjs";
import { systemDialog } from "../dialog-theme.mjs";
import { formDialog, raw } from "../dialog-kit.mjs";
import { qualityHandling } from "./console-view.mjs";

const T = GC_DATA.tables;
const ask = (title, content, ok, validate = null) => formDialog({ title, ok, validate, fields: [raw(content)] });
const options = (rows, selected) =>
  rows
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}"${String(value) === String(selected) ? " selected" : ""}>${esc(label)}</option>`
    )
    .join("");
const gm = () => ChatMessage.getWhisperRecipients("GM").map(user => user.id);
const say = (content, whisper = true) =>
  ChatMessage.create({ speaker: { alias: loc`Game Control` }, content, ...(whisper ? { whisper: gm() } : {}) });
const signed = value => (value >= 0 ? `+${value}` : `${value}`);
const money = value => `$${Math.abs(value).toLocaleString("en-US")}`;
const warn = error => ui.notifications.warn(error.message);

export async function editMission() {
  requireGC();
  const mission = getMission(),
    agents = [...game.actors].filter(actor => actor.type === "agent");
  const team = agents
    .map(
      actor =>
        `<label><input type="checkbox" name="team-${actor.id}" data-level="${Number(actor.system.level) || 0}" ${mission.team.includes(actor.id) || (!mission.team.length && actor.hasPlayerOwner) ? "checked" : ""} /> ${loc`${esc(actor.name)} (level ${actor.system.level ?? "?"})`}</label>`
    )
    .join("");
  // The Threat Level the record gives now, said in words: base from the team, the shift, and what applies (pp.422–423).
  const threatLine = (levels, adjust, override) => {
    const tl = threatLevel({ threatAdjust: adjust, threatOverride: override }, levels);
    if (tl.override) return loc`Threat Level ${tl.value}: fixed by the mission.`;
    const shifted = tl.base + tl.adjust;
    return (
      loc`Threat Level ${tl.value}: ${levels.length} agent(s), career levels ${levels.reduce((a, b) => a + b, 0)} ÷ 5 rounded up = ${tl.base}` +
      (tl.adjust ? loc`, ${signed(tl.adjust)} adjustment` : "") +
      (shifted !== tl.value ? loc` (kept within 1 to 20)` : "") +
      "."
    );
  };
  const chosenLevels = () =>
    agents
      .filter(actor => mission.team.includes(actor.id) || (!mission.team.length && actor.hasPlayerOwner))
      .map(actor => Number(actor.system.level) || 0);
  // What Start mission needs comes first; the rest folds away under headings the GC opens when they matter.
  const input = await formDialog({
    title: loc`Mission record`,
    ok: loc`Save mission`,
    fields: [
      raw(`
    <p class="hint">${loc`A name, the team and the Caliber are all Start mission needs; the rest can wait.`}</p>
    <label>${loc`Mission name`} <input name="name" value="${esc(mission.name)}" /></label>
    <label>${loc`Caliber`} <select name="caliber">${options(
      [1, 2, 3, 4, 5].map(n => [n, ["I", "II", "III", "IV", "V"][n - 1]]),
      mission.caliber
    )}</select></label>
    <fieldset><legend>${loc`Team`}</legend>${team || `<p>${loc`No agents exist yet.`}</p>`}</fieldset>
    <p class="hint" data-threat-preview aria-live="polite">${esc(threatLine(chosenLevels(), mission.threatAdjust, mission.threatOverride))}</p>
    <details${mission.threatAdjust || mission.threatOverride ? " open" : ""}><summary>${loc`Threat Level adjustment`}</summary>
    <label>${loc`Adjustment for a home campaign (−2 to +2)`} <input type="number" name="threatAdjust" min="-2" max="2" value="${mission.threatAdjust}" /></label>
    <label>${loc`Fixed Threat Level for a published mission (blank to calculate)`} <input type="number" name="threatOverride" min="1" max="20" value="${mission.threatOverride ?? ""}" /></label>
    </details>
    <details><summary>${loc`XP extras: dramatic scenes, time limit, bundle`}</summary>
    <label>${loc`Scripted dramatic scenes (1 is free; each extra +100 XP; none −50 XP)`} <input type="number" name="dramaticScenes" min="0" value="${mission.dramaticScenes}" /></label>
    <label><input type="checkbox" name="timeLimit" ${mission.timeLimit ? "checked" : ""} /> ${loc`Time limit complication (+50 XP)`}</label>
    <label>${loc`Common Items in the mission bundle (−1 XP each)`} <input type="number" name="bundleCommonItems" min="0" value="${mission.bundleCommonItems}" /></label>
    </details>
    <details><summary>${loc`Scenes played and notes`}</summary>
    <label>${loc`Scenes played so far`} <input type="number" name="scenesPlayed" min="0" value="${mission.scenesPlayed}" /></label>
    <label>${loc`Notes`} <input name="notes" value="${esc(mission.notes)}" /></label>
    </details>`)
    ],
    dialog: {
      // The Threat Level line follows the ticked team and the adjustment as they change.
      render: (event, app) => {
        const root = app?.element ?? event?.target,
          line = root?.querySelector?.("[data-threat-preview]");
        if (!line) return;
        root.addEventListener("input", () => {
          const levels = [...root.querySelectorAll('input[name^="team-"]:checked')].map(
              box => Number(box.dataset.level) || 0
            ),
            adjust = Math.trunc(Number(root.querySelector('[name="threatAdjust"]')?.value) || 0),
            fixed = Number(root.querySelector('[name="threatOverride"]')?.value);
          line.textContent = threatLine(levels, adjust, Number.isSafeInteger(fixed) && fixed >= 1 ? fixed : null);
        });
      }
    }
  });
  if (!input) return null;
  const override = Number(input.threatOverride);
  // Only this dialog's fields are written: the record may have moved on while the dialog was open.
  const saved = await updateMission({
    name: String(input.name ?? "").trim(),
    caliber: Number(input.caliber),
    threatAdjust: Math.max(-2, Math.min(2, Math.trunc(Number(input.threatAdjust) || 0))),
    threatOverride: Number.isSafeInteger(override) && override >= 1 && override <= 20 ? override : null,
    dramaticScenes: Math.max(0, Number(input.dramaticScenes) || 0),
    timeLimit: !!input.timeLimit,
    bundleCommonItems: Math.max(0, Number(input.bundleCommonItems) || 0),
    scenesPlayed: Math.max(0, Number(input.scenesPlayed) || 0),
    notes: String(input.notes ?? ""),
    team: agents.filter(actor => input[`team-${actor.id}`]).map(actor => actor.id)
  });
  // Said once saved, so the GC knows what the record now gives without reopening it.
  ui.notifications.info(
    loc`${saved.name || loc`Mission`} saved. ${saved.active ? loc`Threat Level ${saved.threatLevel} (fixed at Start mission; Recalculate in More tools).` : threatLine(teamLevels(saved), saved.threatAdjust, saved.threatOverride)}`
  );
  return saved;
}

/** Begin the mission: the Threat Level is calculated once, now (p.423), and NPCs that follow the mission rescale. */
/** Ask once before a step that resets characters' uses. */
// With a warning, the warning leads and Cancel is the default, so Enter does not take a step that loses something.
const confirmStep = (title, lines, yes = title, { warning = "" } = {}) =>
  systemDialog.confirm({
    window: { title },
    content: `${warning ? `<p class="bad" role="alert">${esc(warning)}</p>` : ""}<ol>${lines.map(line => `<li>${esc(line)}</li>`).join("")}</ol>`,
    yes: { label: yes, ...(warning ? { default: false } : {}) },
    no: { label: loc`Cancel`, ...(warning ? { default: true } : {}) },
    rejectClose: false
  });

/** The running fights, named by scene and round, for a warning line; an empty string when there is none. */
const runningFights = () =>
  [...(game.combats ?? [])]
    .filter(combat => combat.started)
    .map(combat => loc`${combat.scene?.name ?? loc`no scene`}, round ${combat.round}`)
    .join("; ");

/**
 * Begin a play session in one step: start the session period (session uses and action dice reset), set up the GC
 * pool from the team and the mission's Caliber, and apply the Threat Level and campaign-quality starting dice.
 */
export async function beginSession() {
  requireGC();
  const mission = getMission(),
    players = teamActors(mission).length,
    caliber = mission.caliber;
  const fights = runningFights(),
    dice = gcDiceStatus();
  const lines = [
    ...(dice.current
      ? [loc`A session has already begun. Beginning another refills the GC's action dice and resets every agent's.`]
      : []),
    ...(fights ? [loc`A fight is running (${fights}).`] : []),
    loc`Start a new session: abilities usable once per session come back and each agent's action dice reset.`,
    loc`GC action dice: player characters at the table + 2 × Caliber ${caliber}.`,
    loc`Apply the mission's Threat Level and campaign-quality changes to the agents' starting dice.`
  ];
  // A guest agent not on the mission's team still counts; more than the team is allowed, with a note so a typo shows.
  const gcDiceTotal = (present, cal) =>
    loc`GC action dice: ${present} + 2 × ${cal} = ${present + 2 * cal}.` +
    (players && present > players ? ` ${loc`That is more than the team's ${players} agents: count guests only.`}` : "");
  // The GC's pool counts the player characters present this session, which can be fewer than the team (p.397).
  const input = await formDialog({
    title: loc`Begin a session`,
    ok: loc`Begin session`,
    fields: [
      raw(`<ol>${lines.map(line => `<li>${esc(line)}</li>`).join("")}</ol>
    <label>${loc`Player characters present`} <input type="number" name="present" min="1" value="${Math.max(1, players)}" /></label>
    <p class="hint" data-gc-dice-total aria-live="polite">${esc(gcDiceTotal(players, caliber))}</p>`)
    ],
    validate: values => (!(Number(values.present) >= 1) ? loc`At least one player character must be present.` : ""),
    dialog: {
      // The total follows the number typed, so the GC sees the pool before beginning.
      render: (event, app) => {
        const root = app?.element ?? event?.target,
          field = root?.querySelector?.('[name="present"]'),
          total = root?.querySelector?.("[data-gc-dice-total]");
        field?.addEventListener("input", () => {
          const present = Math.max(0, Math.trunc(Number(field.value)) || 0);
          if (total) total.textContent = gcDiceTotal(present, caliber);
        });
      }
    }
  });
  if (!input) return null;
  const present = Math.max(1, Math.trunc(Number(input.present)) || players || 1);
  await startUsagePeriod("session");
  await initializeGCDice({ playersPresent: present, caliber, replaceExisting: gcDiceStatus().current });
  await applySessionDiceAdjustments();
  return true;
}

/**
 * Move on to the next scene: start the scene period (scene uses come back, a dramatic scene and NPCs' accumulated
 * damage end) and count the scene played for the mission's XP.
 */
export async function nextScene() {
  requireGC();
  const mission = getMission();
  const fights = runningFights();
  const ok = await confirmStep(loc`Next scene`, [
    ...(fights ? [loc`A fight is running (${fights}). Its standard NPCs lose their accumulated damage too.`] : []),
    loc`Abilities usable once per scene come back; a dramatic scene returns to standard; standard NPCs' accumulated damage clears.`,
    ...(mission.active ? [loc`Count the scene just played toward the mission's XP.`] : [])
  ]);
  if (!ok) return null;
  await startUsagePeriod("scene");
  if (mission.active) await updateMission(m => ({ scenesPlayed: (m.scenesPlayed ?? 0) + 1 }));
  return true;
}

/** Correct the count of scenes played; Next scene and ending the mission keep it in step otherwise (p.440). */
export async function correctSceneCount() {
  requireGC();
  const mission = getMission();
  const input = await formDialog({
    title: loc`Correct the scene count`,
    intro: loc`Next scene counts each scene as it ends, and ending the mission can count the last one. Change the number only to fix a mistake.`,
    fields: [{ number: "scenesPlayed", label: loc`Scenes played so far`, value: mission.scenesPlayed ?? 0, min: 0 }],
    ok: loc`Save the scene count`
  });
  if (!input) return null;
  const scenes = Math.max(0, Math.trunc(Number(input.scenesPlayed) || 0));
  return updateMission({ scenesPlayed: scenes });
}

/** Mark a promoted NPC's antagonist row so its XP is worked out per scene; returns the line for the spend card. */
export async function markAntagonistPromoted(actor) {
  requireGC();
  const mine = rowOf(actor);
  if (!getMission().antagonists.some(mine)) await recordAntagonist(actor);
  // A GC promotes an NPC that is in play, so it has been faced and its reward counts (pp.398, 452).
  await updateMission(now => ({
    antagonists: now.antagonists.map(entry =>
      mine(entry)
        ? { ...entry, promoted: true, encountered: true, scenes: Math.max(1, Number(entry.scenes) || 1) }
        : entry
    )
  }));
  return loc`${actor.name} is special until the mission ends; its XP counts 300 for each scene it appears in. Add scenes on the console's Antagonists list.`;
}

export async function startMission() {
  requireGC();
  const before = getMission();
  // A second press, or a stale button, must not wipe the results of the run in progress.
  if (before.active) return decline(loc`The mission is already active. End it first to start a new run.`);
  // An ended record still holds the last run's results. Starting it again is a new run, so they are cleared first.
  const hadResults =
    !before.active &&
    ((before.objectives ?? []).some(objective => objective.complete) ||
      (before.antagonists ?? []).some(antagonist => antagonist.encountered) ||
      (before.infractions ?? []).length > 0 ||
      (before.scenesPlayed ?? 0) > 0 ||
      Object.keys(before.standingPaid ?? {}).length > 0);
  if (hadResults) {
    const ok = await confirmStep(
      loc`Start the mission again`,
      [
        loc`This record holds the results of an earlier run. Starting it again begins a new run of the same mission.`,
        loc`Completed objectives, antagonists faced, infractions, scenes played and the standing payout are cleared.`,
        loc`A new mission period begins: per-mission uses come back and promoted NPCs return to standard.`,
        loc`To carry on the run that was ended, cancel and use Resume mission.`
      ],
      loc`Start the mission again`,
      { warning: loc`This clears the last run's results and cannot be undone.` }
    );
    if (!ok) return null;
  }
  // The mission record and the mission's usage period begin together: mission uses come back.
  await startUsagePeriod("mission");
  await updateMission(mission => ({
    active: true,
    // When this run began: a Triumph on a card after it counts for the team's XP (p.331).
    startedAt: Date.now(),
    ended: false,
    infractions: [],
    scenesPlayed: 0,
    standingPaid: {},
    reportPosted: false,
    objectives: (mission.objectives ?? []).map(objective => ({ ...objective, complete: false })),
    // A promotion lasts one mission (p.398), so a new run starts the NPC as standard again.
    antagonists: (mission.antagonists ?? []).map(({ promoted: _promoted, ...antagonist }) => ({
      ...antagonist,
      encountered: false,
      ...(antagonist.full ? {} : { scenes: 1 })
    }))
  }));
  const tl = await fixThreatLevel(),
    mission = getMission(),
    standing = missionStanding(mission);
  await say(
    `<b>${loc`Mission ${esc(mission.name || "")} begins.`}</b> ${loc`Threat Level`} <b>${tl.value}</b>${loc`${tl.override ? " (fixed)" : ` (${tl.base}${tl.adjust ? ` ${signed(tl.adjust)}` : ""})`}, Caliber ${mission.caliber}.${tl.bonusDice ? loc` Each player character starts each session with ${tl.bonusDice} extra action di${tl.bonusDice === 1 ? "e" : "ce"} (p.61).` : ""} Base standing reward: Reputation ${standing.reputation} or Net Worth ${money(standing.netWorth)}. GC starting dice: ${teamActors(mission).length} + ${2 * mission.caliber}.`}`
  );
  await rollLiquidations(teamActors(mission));
  // A session already under way began without this mission's Threat Level, so its bonus dice are given now (p.61).
  if (sessionStarted()) await applySessionDiceAdjustments({ quiet: true });
  return tl;
}

/**
 * Targeted for liquidation (p.440): at each mission's start the GC rolls 1d20 for every such agent; a result of 4 +
 * the missions in a row the agent has been targeted (this one included) or less brings a Marked for Death event
 * (p.399). The count lives on the agent and drops back to 0 once the agent is no longer targeted. Undo puts the
 * counts back; the rolls stay in the chat log.
 */
export async function rollLiquidations(team) {
  const counted = actor => Number(actor.flags?.spycraft2?.liquidationMissions) || 0;
  const targeted = team.filter(actor => standingStatus(actor.system).liquidation),
    cleared = team.filter(actor => !targeted.includes(actor) && counted(actor) > 0);
  if (!targeted.length && !cleared.length) return [];
  return withUndo([...targeted, ...cleared], loc`Liquidation counts at the mission's start`, async () => {
    for (const actor of cleared) await actor.update({ "flags.spycraft2.liquidationMissions": 0 });
    const results = [];
    for (const actor of targeted) {
      const missions = counted(actor) + 1;
      await actor.update({ "flags.spycraft2.liquidationMissions": missions });
      const roll = await new Roll("1d20").evaluate(),
        check = liquidationCheck(missions, roll.total);
      results.push({ actor: actor.id, missions, total: roll.total, ...check });
      await ChatMessage.create({
        speaker: { alias: loc`Game Control` },
        content: esc(
          check.marked
            ? loc`Liquidation check for ${actor.name}: ${roll.total} on 1d20, needing ${check.target} or less. Marked for Death: ${actor.name} is the target, and their former network the aggressors (pp.399, 440).`
            : loc`Liquidation check for ${actor.name}: ${roll.total} on 1d20, needing ${check.target} or less. No Marked for Death event this mission (p.440).`
        ),
        rolls: [roll],
        whisper: gm()
      });
    }
    return results;
  });
}

/**
 * The critical objectives a mission record leaves undone, each with its exposure row (pp.435–436), and which of them
 * are still due from an agent: one already charged to that agent (an earlier End before Resume) is not charged again.
 */
function criticalExposure(mission) {
  const criticalRow = T.exposure.find(row => row.id === "complete-critical-objective-complication");
  const failedCritical = (mission.objectives ?? [])
    .filter(objective => objective.critical && !objective.complete)
    .map(objective => ({ objective, infraction: criticalRow?.infractions?.[Number(objective.grade) - 1] }))
    .filter(entry => entry.infraction);
  const charged = actorId =>
    new Set(
      (mission.infractions ?? [])
        .filter(entry => entry.actor === actorId)
        .flatMap(entry => entry.criticalObjectives ?? [])
    );
  return {
    failedCritical,
    dueFor: actor => failedCritical.filter(({ objective }) => !charged(actor.id).has(objective.id))
  };
}

/** The ended mission as a short record, for the journal entry "Plan the next mission" leaves behind. */
export function missionRecordHtml(mission, { xp = null, team = [] } = {}) {
  const list = (title, rows) =>
    rows.length ? `<h2>${esc(title)}</h2><ul>${rows.map(row => `<li>${row}</li>`).join("")}</ul>` : "";
  return [
    `<p>${esc(loc`Caliber ${mission.caliber}, Threat Level ${mission.threatLevel ?? "—"}, ${mission.scenesPlayed ?? 0} scene(s) played.`)}</p>`,
    xp === null ? "" : `<p>${esc(loc`Base XP earned: ${xp}.`)}</p>`,
    list(
      loc`Team`,
      team.map(actor => esc(actor.name))
    ),
    list(
      loc`Objectives`,
      (mission.objectives ?? []).map(
        entry =>
          `${entry.complete ? "✔" : "○"} ${esc(entry.name)} (${esc(loc`grade ${entry.grade}`)}${entry.critical ? `, ${esc(loc`critical`)}` : ""})`
      )
    ),
    list(
      loc`Antagonists`,
      (mission.antagonists ?? []).map(entry => `${entry.encountered ? "✔" : "○"} ${esc(entry.name)}`)
    ),
    list(
      loc`Exposure`,
      (mission.infractions ?? []).map(entry => esc(`${entry.name} (${entry.penalty} ${entry.currency})`))
    ),
    mission.notes ? `<h2>${esc(loc`Notes`)}</h2><p>${esc(mission.notes)}</p>` : ""
  ].join("");
}

/**
 * Plan the next mission once this one has ended: its record goes into a journal entry in a "Mission records" folder,
 * and a fresh record starts that keeps the team and the Caliber. Asks first.
 */
export async function planNextMission() {
  requireGC();
  const mission = getMission();
  if (mission.active) return refuse(loc`End the mission first; its record is kept for the XP report until then.`);
  const name = mission.name || loc`Unnamed mission`;
  const team = teamActors(mission),
    unpaid = team.filter(actor => !mission.standingPaid?.[actor.id]).length;
  const ok = await confirmStep(
    loc`Plan the next mission`,
    [
      loc`The record of ${name} goes into a journal entry in the Mission records folder, so it can be read later.`,
      loc`A new mission record starts with the same team and Caliber; objectives, antagonists, complications, exposure and scenes start empty.`,
      loc`Settle every agent's XP and standing before this: the new record no longer holds the old figures.`
    ],
    loc`Plan the next mission`,
    {
      warning: unpaid
        ? loc`Standing is paid to ${team.length - unpaid} of ${team.length} agents. Award it from Wrap-up first.`
        : ""
    }
  );
  if (!ok) return null;
  const xp = missionXP().total;
  let folder = [...(game.folders ?? [])].find(
    entry => entry.type === "JournalEntry" && entry.name === loc`Mission records`
  );
  folder ??= await CONFIG.Folder.documentClass.create({ name: loc`Mission records`, type: "JournalEntry" });
  const entry = await CONFIG.JournalEntry.documentClass.create({
    name,
    folder: folder?.id ?? null,
    pages: [{ name, type: "text", text: { content: missionRecordHtml(mission, { xp, team }) } }]
  });
  await setMission({
    ...defaultMission(),
    // A new record: Undo notes from the filed mission no longer reach it.
    recordId: foundry.utils.randomID(),
    team: [...(mission.team ?? [])],
    caliber: mission.caliber
  });
  ui.notifications.info(loc`${name} is filed under Mission records. The new mission keeps the team and Caliber.`);
  return entry;
}

/** End the mission after asking: the record stays for the XP report, settlement and the standing payout. */
export async function endMission({ clear = false } = {}) {
  requireGC();
  const mission = getMission();
  if (clear) return setMission(defaultMission());
  const open = (mission.objectives ?? []).filter(objective => !objective.complete).length;
  // A critical objective left undone is exposure for every agent, by its grade (pp.435–436).
  const { failedCritical, dueFor } = criticalExposure(mission);
  const pendingCritical = teamActors(mission).some(actor => dueFor(actor).length);
  const lines = [
    loc`The mission stops being active: NPCs that follow the mission's Threat Level go back to their own.`,
    loc`The record is kept, so the XP report, each agent's XP settlement and the standing payout still work.`,
    ...(open ? [loc`${open} objective(s) are not marked complete.`] : []),
    loc`Resume mission reopens it with nothing changed.`
  ];
  // Next scene counts the scene just finished, so the scene being played when the mission ends is still uncounted.
  const input = await formDialog({
    title: loc`End the mission`,
    fields: [
      raw(`<ol>${lines.map(line => `<li>${esc(line)}</li>`).join("")}</ol>`),
      {
        check: "countFinalScene",
        label: loc`Count the scene being played now as the mission's last (scene ${(mission.scenesPlayed ?? 0) + 1})`,
        checked: true
      },
      ...(pendingCritical
        ? [
            {
              check: "recordCritical",
              label: loc`Record exposure for each agent for the critical objectives not completed: ${failedCritical
                .map(({ objective, infraction }) => {
                  const penalty = exposurePenalty(infraction);
                  return `${objective.name} (${penalty.reputation} / −${money(-penalty.netWorth)})`;
                })
                .join("; ")}`,
              checked: true
            }
          ]
        : [])
    ],
    ok: loc`End the mission`
  });
  if (!input) return null;
  // Only these fields are written: objectives ticked while the question was open are kept.
  await updateMission(now => ({
    active: false,
    ended: true,
    ...(input.countFinalScene === true ? { scenesPlayed: (now.scenesPlayed ?? 0) + 1 } : {})
  }));
  if (input.recordCritical === true && pendingCritical) {
    // Each agent pays in their own affiliation's currency; the Undo note gives the standing back. What is due is
    // worked out again from the record as it is now, so an objective ticked while the dialog was open is not charged.
    const current = getMission(),
      { dueFor: dueNow } = criticalExposure(current),
      team = teamActors(current),
      recorded = [];
    await withUndo(
      team,
      loc`Critical objectives: exposure recorded`,
      async () => {
        for (const actor of team) {
          const currency = actor.system.affiliationType === "freelance" ? "netWorth" : "reputation",
            due = dueNow(actor);
          if (!due.length) continue;
          let total = 0;
          for (const { infraction } of due) total += exposurePenalty(infraction)[currency];
          await actor.update({ [`system.${currency}`]: (actor.system[currency] ?? 0) + total });
          recorded.push({
            id: foundry.utils.randomID(),
            actor: actor.id,
            name: loc`Critical objectives not completed`,
            currency,
            penalty: total,
            criticalObjectives: due.map(({ objective }) => objective.id),
            at: Date.now()
          });
        }
        await updateMission(m => ({ infractions: [...(m.infractions ?? []), ...recorded] }));
      },
      // Undo takes the exposure rows off too, so a later End mission can record them again.
      () => ({ addedInfractions: { period: missionEpoch(), ids: recorded.map(entry => entry.id) } })
    );
  }
  await say(
    `<b>${loc`Mission ${esc(mission.name || "")} ended.`}</b> ${loc`Its record is kept for the XP report, XP settlement and standing. Resume mission reopens it.`}`
  );
  return true;
}

/** Reopen an ended mission exactly as it was: nothing is reset and no new usage period starts. */
export async function resumeMission() {
  requireGC();
  const mission = getMission();
  if (mission.active) return decline(loc`The mission is already active.`);
  await updateMission({ active: true, ended: false });
  await say(`<b>${loc`Mission ${esc(mission.name || "")} resumed.`}</b>`);
  // Threat Level dice taken back by an adjustment made while the mission was ended are returned.
  if (sessionStarted()) await applySessionDiceAdjustments({ quiet: true });
  return true;
}

const sessionStarted = () => {
  try {
    // The session period alone: a Begin session that stopped before the GC dice were set still counts.
    return !!game.settings.get("spycraft2", "usagePeriods")?.session;
  } catch {
    return false;
  }
};

/** Edit one objective in place: the same dialog as Add, filled in, replacing the row by its id. */
export const editObjective = id => addObjective({ edit: getMission().objectives.find(entry => entry.id === id) });

export async function addObjective({ another = false, edit = null } = {}) {
  requireGC();
  const categories = [...new Set(T.objectives.map(objective => objective.category))];
  const samples = categories
    .map(
      category =>
        `<optgroup label="${esc(category)}">${options(T.objectives.filter(objective => objective.category === category).map(objective => [`${objective.category} — ${objective.name}|${objective.grade}`, `${objective.grade}: ${objective.name}`.slice(0, 110)]))}</optgroup>`
    )
    .join("");
  const input = await ask(
    edit ? loc`Edit ${edit.name} — grade × 25 XP (p.431)` : loc`Add an objective — grade × 25 XP (p.431)`,
    `
    <label>${loc`Sample (Table 7.6)`} <select name="sample"><option value="">${loc`Custom`}</option>${samples}</select></label>
    <label>${loc`Name (state exactly how it is completed)`} <input name="name" value="${esc(edit?.name ?? "")}" /></label>
    <label>${loc`Grade for a custom objective`} <input type="number" name="grade" min="1" max="5" value="${edit?.grade ?? 1}" /></label>
    <label><input type="checkbox" name="critical"${edit?.critical ? " checked" : ""} /> ${loc`Critical objective (failing it causes exposure)`}</label>
    ${edit ? "" : `<label><input type="checkbox" name="another"${another ? " checked" : ""} /> ${loc`Add another after this one`}</label>`}`,
    edit ? loc`Save objective` : loc`Add objective`,
    // A custom objective needs its own words: a blank one would be saved as "Objective".
    values => (!values.sample && !String(values.name ?? "").trim() ? loc`Name the objective, or pick a sample.` : "")
  );
  if (!input) return null;
  const [sampleName, sampleGrade] = String(input.sample || "").split("|");
  const objective = {
    ...(edit ?? {}),
    id: edit?.id ?? foundry.utils.randomID(),
    name: String(input.name || "").trim() || sampleName || "Objective",
    grade: input.sample ? Number(sampleGrade) : Number(input.grade),
    critical: !!input.critical,
    complete: edit?.complete ?? false,
    scenes: edit?.scenes ?? 1
  };
  if (edit)
    return updateMission(mission => ({
      objectives: mission.objectives.map(entry => (entry.id === edit.id ? objective : entry))
    }));
  const saved = await updateMission(mission => ({ objectives: [...mission.objectives, objective] }));
  if (!input.another) return saved;
  ui.notifications.info(loc`Added ${objective.name}.`);
  // The next one opens at once, so a five-objective mission is one sitting, not five trips to the console.
  return addObjective({ another: true });
}

/** Edit one antagonist row in place: the same dialog as Record for XP, filled in, replacing the row by its id. */
export const editAntagonist = id => {
  const row = getMission().antagonists.find(entry => entry.id === id);
  return addAntagonist({ uuid: row?.uuid ?? "", edit: row });
};

export async function addAntagonist({ uuid = "", another = false, dropped = null, edit = null } = {}) {
  requireGC();
  const npcs = [...game.actors].filter(actor => actor.type === "npc");
  // A compendium NPC dropped on the console is listed and chosen, though it is not in the world.
  if (dropped?.type === "npc" && !npcs.some(actor => actor.uuid === dropped.uuid)) npcs.unshift(dropped);
  const input = await ask(
    edit ? loc`Edit ${edit.name} (p.452)` : loc`Add an antagonist (p.452)`,
    `
    <p>${loc`Each NPC type counts once per mission however many appear; a special NPC counts four times its reward; a ‘full’ special NPC built with the character rules earns 300 XP per scene instead.`}</p>
    <label>${loc`NPC`} <select name="uuid"><option value="">${loc`Not an existing actor`}</option>${options(
      npcs.map(actor => [
        actor.uuid,
        `${actor.name}${Number.isFinite(actor.system.npcBuild?.xp) ? ` (${actor.system.npcBuild.xp} XP)` : " (enter XP)"}`
      ]),
      uuid
    )}</select></label>
    <label>${loc`Name`} <input name="name" value="${esc(edit?.name ?? "")}" /></label>
    <label>${loc`XP reward if not read from the actor`} <input type="number" name="xp" min="0" value="${edit?.xp ?? 0}" /></label>
    <label>${loc`Type`} <select name="type">${options(
      [
        ["", loc`From the actor`],
        ["standard", loc`Standard or animal`],
        ["special", loc`Special`]
      ],
      edit?.type ?? ""
    )}</select></label>
    <label><input type="checkbox" name="full"${edit?.full ? " checked" : ""} /> ${loc`‘Full’ special NPC (300 XP per scene)`}</label>
    <label>${loc`Scenes a full or promoted NPC appears in`} <input type="number" name="scenes" min="1" value="${edit?.scenes ?? 1}" /></label>
    ${edit ? "" : `<label><input type="checkbox" name="another"${another ? " checked" : ""} /> ${loc`Add another after this one`}</label>`}`,
    edit ? loc`Save antagonist` : loc`Record for XP`,
    values => (!values.uuid && !String(values.name ?? "").trim() ? loc`Choose an NPC, or name the antagonist.` : "")
  );
  if (!input) return null;
  const actor = input.uuid ? await fromUuid(input.uuid) : null;
  const antagonist = {
    ...(edit ?? {}),
    id: edit?.id ?? foundry.utils.randomID(),
    uuid: actor?.uuid ?? null,
    typeKey: actor ? typeKeyOf(actor) : null,
    name: String(input.name || "").trim() || actor?.name || "Antagonist",
    xp: Number.isFinite(actor?.system.npcBuild?.xp) ? actor.system.npcBuild.xp : Number(input.xp) || 0,
    type: input.type || (["special", "villain"].includes(actor?.system.npcType) ? "special" : "standard"),
    full: !!input.full,
    scenes: Math.max(1, Number(input.scenes) || 1),
    encountered: edit?.encountered ?? false
  };
  if (edit)
    return updateMission(mission => ({
      antagonists: mission.antagonists.map(entry => (entry.id === edit.id ? antagonist : entry))
    }));
  const saved = await updateMission(mission => ({ antagonists: [...mission.antagonists, antagonist] }));
  if (!input.another) return saved;
  ui.notifications.info(loc`Added ${antagonist.name}.`);
  return addAntagonist({ another: true });
}

/** The key an NPC's type is listed under: an unlinked token's base actor, so its copies count once (p.398). */
const typeKeyOf = actor => (actor.isToken ? (actor.token?.baseActor?.uuid ?? actor.uuid) : actor.uuid);
/** Whether an antagonist row is this NPC's: by its type, or by the actor or token recorded. */
// A world copy imported from a compendium matches a row recorded from that compendium entry, and the other way round.
const sourceOf = actor => actor?._stats?.compendiumSource ?? actor?.baseActor?._stats?.compendiumSource ?? null;
const rowOf = actor => entry => {
  const source = sourceOf(actor);
  return (
    entry.typeKey === actor.uuid ||
    entry.uuid === actor.uuid ||
    entry.typeKey === typeKeyOf(actor) ||
    (!!source && (entry.typeKey === source || entry.uuid === source))
  );
};

/** This NPC's antagonist row on the mission's XP record, or null. */
export const antagonistRowFor = actor => (actor ? (getMission().antagonists.find(rowOf(actor)) ?? null) : null);

/** Whether the mission's XP record already lists this NPC's type. */
export const antagonistRecorded = actor => !!actor && getMission().antagonists.some(rowOf(actor));

/**
 * Mark the listed antagonists among these actors as faced: an NPC that is in a running fight has been met. Only an
 * active mission is touched, and only rows that are not marked yet. Returns how many rows changed.
 */
export async function markAntagonistsFaced(actors) {
  // A token's own uuid and its base actor's both count, so rows keyed either way are found.
  const uuids = new Set(
    [...(actors ?? [])]
      .filter(Boolean)
      .flatMap(actor => [actor.uuid, typeKeyOf(actor), sourceOf(actor)])
      .filter(Boolean)
  );
  const open = entry => !entry.encountered && (uuids.has(entry.typeKey) || uuids.has(entry.uuid));
  const mission = getMission();
  if (!game.user?.isGM || !mission.active || !uuids.size || !mission.antagonists.some(open)) return 0;
  let count = 0;
  await updateMission(now => ({
    antagonists: now.antagonists.map(entry => (open(entry) ? (count++, { ...entry, encountered: true }) : entry))
  }));
  return count;
}

/** Add an NPC actor to the mission's XP record without a dialog; a type already listed is left alone. */
export async function recordAntagonist(actor, { encountered = false } = {}) {
  requireGC();
  if (!actor || antagonistRecorded(actor)) return null;
  const antagonist = {
    id: foundry.utils.randomID(),
    uuid: actor.uuid,
    typeKey: typeKeyOf(actor),
    name: actor.name,
    xp: Number.isFinite(actor.system.npcBuild?.xp) ? actor.system.npcBuild.xp : 0,
    type: ["special", "villain"].includes(actor.system.npcType) ? "special" : "standard",
    full: false,
    scenes: 1,
    encountered
  };
  await updateMission(mission => ({ antagonists: [...mission.antagonists, antagonist] }));
  return antagonist;
}

/** A complication the dialog would refuse once closed, said while it is still open; "" when it can be saved. */
function complicationRefusal(values) {
  if (!(Number(values.count) >= 1)) return loc`How many must be 1 or more.`;
  try {
    if (values.kind === "quality") qualityAddition(values.quality, { scope: "scripted", active: qualitiesInForce() });
    if (values.kind === "security") {
      const device = resolveDevice(values.security, Number(values.pr));
      if (device.xp === null || device.xp === undefined) {
        if (values.deviceXP === "" || values.deviceXP === null || values.deviceXP === undefined)
          return loc`${device.name}: its XP is printed as “${device.xpPrinted}”; enter the XP by hand.`;
      }
    }
  } catch (error) {
    return error.message;
  }
  if (values.kind === "other" && !String(values.name ?? "").trim()) return loc`Name the complication.`;
  return "";
}

export async function addComplication({ another = false } = {}) {
  requireGC();
  const mission = getMission();
  const qualityRows = GC_DATA.campaignQualities
    .filter(quality => !quality.seasonOnly)
    .map(quality => [quality.id, `${quality.name} (${signed(quality.xp)} XP)`]);
  const input = await ask(
    loc`Add a complication (pp.435–439)`,
    `
    <p>${loc`Complications raise the base XP reward only when they actually stand in the team's way; one that is ignored is worth half.`}</p>
    <label>${loc`Kind`} <select name="kind">${options(
      [
        ["quality", loc`Campaign quality scripted into the mission`],
        ["security", loc`Security device`],
        ["gear", loc`Gear restriction`],
        ["exposure", loc`Exposure objective`],
        ["bundle", loc`Mission bundle gear pick`],
        ["other", loc`Other (enter XP)`]
      ],
      "security"
    )}</select></label>
    <label data-when="kind=quality">${loc`Campaign quality`} <select name="quality">${options(qualityRows)}</select></label>
    <label data-when="kind=security">${loc`Security device`} <select name="security">${options(SECURITY_DEVICES.map(device => [device.id, `${device.name} (${device.kind}; XP ${device.xp})`]))}</select></label>
    <label data-when="kind=security">${loc`Device Power Rating`} <input type="number" name="pr" min="1" value="${Math.max(1, mission.threatLevel ?? 1)}" /></label>
    <label data-when="kind=security">${loc`Device XP if the table gives no plain formula`} <input type="number" name="deviceXP" min="0" /></label>
    <label data-when="kind=gear">${loc`Gear restriction`} <select name="gear">${options(T.gearRestrictions.map(entry => [entry.id, `${entry.name} (${signed(entry.xp)} XP)`]))}</select></label>
    <label data-when="kind=gear">${loc`Allowed weapons or Mechanisms, one per line (list restrictions only, up to 12)`} <textarea name="allowedNames" rows="4"></textarea></label>
    <label data-when="kind=exposure">${loc`Exposure objective`} <select name="exposure">${options(T.exposure.map(entry => [entry.id, `${entry.objective} (${entry.xpPrinted ?? signed(entry.xp)} XP)`]))}</select></label>
    <label data-when="kind=bundle|other">${loc`Bundle pick or other complication name`} <input name="name" /></label>
    <label data-when="kind=bundle">${loc`Bundle pick Caliber (−10 XP per Caliber)`} <input type="number" name="caliber" min="1" max="5" value="1" /></label>
    <label data-when="kind=other">${loc`Other complication XP`} <input type="number" name="xp" value="0" /></label>
    <label>${loc`How many`} <input type="number" name="count" min="1" value="1" /></label>
    <label><input type="checkbox" name="another"${another ? " checked" : ""} /> ${loc`Add another after this one`}</label>`,
    loc`Add complication`,
    complicationRefusal
  );
  if (!input) return null;
  const saved = await saveComplication(input, mission);
  if (!input.another || !saved) return saved;
  ui.notifications.info(loc`Complication added.`);
  return addComplication({ another: true });
}

/** Edit an "other" complication's name, XP and count in place; the other kinds are removed and added again. */
export async function editOtherComplication(key) {
  requireGC();
  const row = (getMission().otherComplications ?? []).find(entry => entry.key === key);
  if (!row) return refuse(loc`That complication is no longer on the record.`);
  const input = await ask(
    loc`Edit ${row.name}`,
    `<label>${loc`Name`} <input name="name" value="${esc(row.name ?? "")}" /></label>
    <label>${loc`XP`} <input type="number" name="xp" value="${Number(row.xp) || 0}" /></label>`,
    loc`Save complication`,
    values => (!String(values.name ?? "").trim() ? loc`Name the complication.` : "")
  );
  if (!input) return null;
  return updateMission(mission => ({
    otherComplications: mission.otherComplications.map(entry =>
      entry.key === key ? { ...entry, name: String(input.name).trim(), xp: Number(input.xp) || 0 } : entry
    )
  }));
}

/** Write one complication from the dialog's values onto the mission record. */
async function saveComplication(input, mission) {
  const count = Math.max(1, Number(input.count) || 1),
    id = foundry.utils.randomID();
  try {
    switch (input.kind) {
      case "quality":
        qualityAddition(input.quality, { scope: "scripted", active: qualitiesInForce() });
        return updateMission(m => ({ qualities: [...m.qualities, { id: input.quality, scripted: true }] }));
      case "security": {
        const device = resolveDevice(input.security, Number(input.pr));
        const xp = device.xp ?? (input.deviceXP === "" || input.deviceXP === null ? null : Number(input.deviceXP));
        if (!Number.isFinite(xp))
          throw new Error(loc`${device.name}: its XP is printed as “${device.xpPrinted}”; enter the XP by hand.`);
        return updateMission(m => ({
          security: [
            ...m.security,
            {
              key: id,
              id: device.id,
              name: loc`${device.name} (PR ${device.powerRating})`,
              pr: device.powerRating,
              xp,
              count
            }
          ]
        }));
      }
      case "gear": {
        const row = T.gearRestrictions.find(entry => entry.id === input.gear);
        const names = row?.data?.allowed ? gearRestrictionNames(input.allowedNames, row.data.allowed) : [];
        return updateMission(m => ({
          gearRestrictions: [
            ...m.gearRestrictions,
            { key: id, id: input.gear, count: 1, ...(row?.data?.allowed ? { names } : {}) }
          ]
        }));
      }
      case "exposure":
        return updateMission(m => ({
          exposure: [...m.exposure.filter(entry => entry.id !== input.exposure), { key: id, id: input.exposure }]
        }));
      case "bundle":
        return updateMission(m => ({
          bundle: [
            ...m.bundle,
            { key: id, name: String(input.name || "Gear pick"), caliber: Number(input.caliber), count }
          ]
        }));
      default:
        return updateMission(m => ({
          otherComplications: [
            ...m.otherComplications,
            { key: id, name: String(input.name || "Complication"), xp: Math.trunc(Number(input.xp) || 0) }
          ]
        }));
    }
  } catch (error) {
    return warn(error);
  }
}

/** Toggle or remove one list entry: list is a mission array name, key matches entry.id or entry.key. */
export async function changeEntry(list, key, change, { notify = false } = {}) {
  requireGC();
  if (change === "remove") return removeEntry(list, key, { notify });
  return updateMission(mission => ({
    [list]: (mission[list] ?? []).flatMap(entry => {
      if ((entry.key ?? entry.id) !== key) return [entry];
      if (change === "remove") return [];
      // A full or promoted antagonist earns 300 XP for each scene it appears in (pp.398, 452).
      if (change === "scenesUp") return [{ ...entry, scenes: Math.max(1, Number(entry.scenes) || 1) + 1 }];
      if (change === "scenesDown") return [{ ...entry, scenes: Math.max(1, (Number(entry.scenes) || 1) - 1) }];
      return [{ ...entry, [change]: !entry[change] }];
    })
  }));
}

/** What a mission row is called in a notice: its own name, else its table name. */
const rowName = entry => entry?.name ?? entry?.objective ?? entry?.id ?? loc`the row`;

/**
 * Take a row off the mission record and leave an Undo note that puts it back where it was. The note restores the
 * row only within the same run of the mission.
 */
async function removeEntry(list, key, { notify = false } = {}) {
  const mission = getMission(),
    rows = mission[list] ?? [],
    index = rows.findIndex(entry => (entry.key ?? entry.id) === key);
  if (index < 0) return null;
  const entry = rows[index];
  await updateMission(now => ({ [list]: (now[list] ?? []).filter(row => (row.key ?? row.id) !== key) }));
  const name = rowName(entry);
  try {
    await postUndo(loc`Removed from the mission: ${name}`, [], {
      missionRow: { list, key, entry, index, period: missionEpoch() }
    });
  } catch (error) {
    console.warn("Field Agent's Handbook | No Undo note could be left for this removal.", error);
  }
  if (notify) ui.notifications.info(loc`Removed ${name}. The Undo note in the chat puts it back.`);
  return entry;
}

/** Exposure (p.435): an infraction immediately reduces the character's Reputation or Net Worth. */
export async function recordInfraction() {
  requireGC();
  const mission = getMission(),
    team = teamActors(mission);
  const active = mission.exposure.map(entry => T.exposure.find(row => row.id === entry.id)).filter(Boolean);
  const pool = active.length ? active : T.exposure;
  const rows = pool.flatMap(objective =>
    objective.infractions.map((infraction, i) => [
      `${objective.id}|${i}`,
      // Net Worth as it will be charged: scaled by Table 7.4 under Historical.
      `${objective.objective}: ${infraction.name} (${infraction.reputation} / −${money(-exposurePenalty(infraction).netWorth)})`.slice(
        0,
        150
      )
    ])
  );
  const { effects } = currentCampaignEffects(),
    rules = effects.gearRules,
    honorMultiplier = honorExposureMultiplier(effects);
  const input = await ask(
    loc`Record an exposure infraction — Table 7.7`,
    `
    ${active.length ? "" : `<p class="bad">${loc`No exposure objective is scripted into this mission; showing every row of Table 7.7.`}</p>`}
    <label>${loc`Character`} <select name="actor">${options(team.map(actor => [actor.id, actor.name]))}</select></label>
    <label>${loc`Infraction`} <select name="infraction">${options(rows)}</select></label>
    <label>${loc`Paid in`} <select name="currency">${options(
      [
        ["reputation", loc`Reputation (Faction)`],
        ["netWorth", loc`Net Worth (Freelance)`]
      ],
      rules === "freelance" ? "netWorth" : "reputation"
    )}</select></label>
    <label><input type="checkbox" name="preventing" /> ${loc`Committed to prevent an equal or worse infraction (half, rounded up)`}</label>
    <label><input type="checkbox" name="honor" /> ${honorMultiplier === 1 ? loc`Honor-code violation (no campaign quality changes it)` : honorMultiplier > 1 ? loc`Honor-code violation: doubled under the Virtuous campaign quality` : loc`Honor-code violation: halved, rounded down, under the Corrupt campaign quality`}</label>`,
    loc`Record infraction`,
    values => (!values.actor || !values.infraction ? loc`Choose a character and an infraction.` : "")
  );
  if (!input) return null;
  const actor = game.actors.get(input.actor),
    [objectiveId, index] = String(input.infraction).split("|");
  const infraction = T.exposure.find(row => row.id === objectiveId)?.infractions[Number(index)];
  if (!actor || !infraction) return refuse(loc`Choose a character and an infraction.`);
  const penalty = exposurePenalty(infraction, {
    preventing: !!input.preventing,
    honorMultiplier: input.honor ? honorMultiplier : 1
  })[input.currency];
  const path = `system.${input.currency}`,
    before = actor.system[input.currency] ?? 0;
  await actor.update({ [path]: before + penalty });
  await updateMission(m => ({
    infractions: [
      ...(m.infractions ?? []),
      { actor: actor.id, name: infraction.name, currency: input.currency, penalty, at: Date.now() }
    ]
  }));
  const after = before + penalty,
    burned = after < 0;
  await say(
    `<b>${loc`Exposure:`}</b> ${esc(actor.name)} — ${esc(infraction.name)}. ${input.currency === "reputation" ? `${loc`Reputation ${before} →`} <b>${after}</b>` : `${loc`Net Worth ${money(before)} →`} <b>${after < 0 ? "−" : ""}${money(after)}</b>`}.${burned ? ` <b>${loc`Negative standing: see p.439 for the consequences.`}</b>` : ""}`
  );
  return penalty;
}

/**
 * Per-session starting dice changes the base sheet does not know about: the Threat Level bonus (p.61) and campaign
 * qualities. Each agent remembers what this session has already given, so running it again gives only the difference:
 * a mission started after the session began still brings its Threat Level bonus, once.
 */
export async function applySessionDiceAdjustments({ quiet = false } = {}) {
  requireGC();
  const mission = getMission(),
    { effects } = currentCampaignEffects(),
    levels = teamLevels(mission);
  const session = String(game.settings.get("spycraft2", "usagePeriods")?.session ?? "initial");
  const bonus = mission.active && mission.threatLevel ? threatBonusActionDice(mission.threatLevel, levels) : 0,
    delta = bonus + (effects.startingActionDice ?? 0);
  const applied = actor => sessionDiceApplied(actor.flags?.spycraft2?.sessionDiceAdjusted, session);
  const team = teamActors(mission);
  if (!delta && !team.some(actor => applied(actor)?.change)) {
    if (quiet) return 0;
    return decline(loc`No Threat Level or campaign-quality change to starting action dice applies.`);
  }
  // The dice and each agent's adjusted mark are on one Undo note, so a wrong adjustment can be taken back and run
  // again.
  const lines = await withUndo(team, loc`Starting action dice adjusted`, () =>
    adjustTeamDice(team, { session, effects, bonus, delta, applied })
  );
  if (quiet && !lines.some(line => line.includes("→"))) return delta;
  await say(
    `<b>${loc`Starting action dice adjusted`}</b> ${loc`(Threat Level bonus ${signed(bonus)}; campaign qualities ${signed(effects.startingActionDice ?? 0)}).`}<br>${lines.join("<br>")}`
  );
  return delta;
}

async function adjustTeamDice(team, { session, effects, bonus, delta, applied }) {
  const lines = [];
  for (const actor of team) {
    // An agent whose dice convert as they are gained (Fortune Favors the Bold at d12: two d6 for each) gains or
    // loses the converted number.
    const per = actor.system.actionDice?.gainMultiplier ?? 1,
      starting = actor.system.actionDice?.max ?? 0,
      target = per === 1 ? adjustedStartingDice(starting, effects, bonus) : Math.max(0, starting + delta * per),
      change = target - starting,
      before = applied(actor);
    if (before && (before.change === null || before.change === change)) {
      lines.push(loc`${esc(actor.name)}: already adjusted this session`);
      continue;
    }
    const flag = actor.flags?.spycraft2?.sessionDiceAdjusted,
      earlier = before?.change ?? 0,
      really = before && Number.isSafeInteger(flag?.applied) ? flag.applied : earlier;
    // Dice that could not be taken at 0 are not handed back when the change is later undone.
    const wanted = change - earlier,
      step = wanted > 0 ? Math.max(0, wanted - Math.max(0, really - earlier)) : wanted;
    const current = actor.system.actionDice?.value ?? 0,
      value = Math.max(0, current + step);
    // The dice and the record of them are written together, one agent at a time, so a failure leaves the others
    // to be adjusted on the next run.
    try {
      await actor.update({
        "system.actionDice.value": value,
        "flags.spycraft2.sessionDiceAdjusted": { session, change, applied: really + (value - current) }
      });
      lines.push(`${esc(actor.name)}: ${signed(step)} → ${value}`);
    } catch (error) {
      lines.push(loc`${esc(actor.name)}: not adjusted (${esc(error.message)}). Run the adjustment again.`);
    }
  }
  return lines;
}

/** Mission summary: base XP breakdown, each character's total, and standing rewards. */
export async function missionReport({ planned = false, whisper = true } = {}) {
  requireGC();
  const mission = getMission(),
    xp = missionXP({ planned }),
    standing = missionStanding(mission),
    tl = mission.threatLevel ?? threatLevel(mission, teamLevels(mission)).value;
  const groups = [...new Set(xp.rows.map(row => row.group))];
  const table = groups
    .map(
      group =>
        `<b>${esc(group)}</b><br>${xp.rows
          .filter(row => row.group === group)
          .map(row => `${esc(row.label)}${row.ignored ? " (ignored: half)" : ""}: ${signed(row.xp)}`)
          .join("<br>")}`
    )
    .join("<br>");
  const characters = teamActors(mission)
    .map(actor => {
      const awards = actor.system.actionDieAwardSummary?.count ?? 0,
        level = actor.system.level;
      try {
        const result = characterMissionXP({ baseXP: xp.total, awards, level, threatLevel: tl });
        return `${esc(actor.name)}: (${xp.total} + ${result.awardXP}) × ${result.multiplier} = <b>${result.total}</b>`;
      } catch {
        return loc`${esc(actor.name)}: finish the character's level first`;
      }
    })
    .join("<br>");
  await say(
    `<b>${loc`${planned ? "Planned" : "Earned"} mission XP — ${esc(mission.name || "mission")}`}</b> ${loc`(Threat Level ${tl}, Caliber ${mission.caliber})`}<br>${table || "Nothing recorded yet."}<br><b>${loc`Base reward: ${xp.total}`}</b>${xp.warnings.length ? `<br><span class="bad">${xp.warnings.map(esc).join("<br>")}</span>` : ""}<br><br><b>${loc`Per character`}</b> (p.440)<br>${characters}<br><br>${loc`Standing: Reputation ${signed(standing?.reputation ?? 0)} or Net Worth +${money(standing?.netWorth ?? 0)} each. Settle XP from each agent's Classes tab; the dialog is pre-filled from this record.`}`,
    whisper
  );
  // The earned report of an ended mission is part of settling it: Wrap-up then points on to the next mission.
  if (!planned && mission.ended && !mission.reportPosted) await updateMission({ reportPosted: true });
  return xp;
}

/**
 * Pay the Table 7.10 standing reward to the team. The mission remembers who was paid, so a second press, or a retry
 * after an interruption, pays only those still unpaid unless the GC asks for a correction.
 */
let payingStanding = false;
export async function awardStanding() {
  requireGC();
  const mission = getMission(),
    standing = missionStanding(mission),
    { effects } = currentCampaignEffects(),
    team = teamActors(mission),
    paid = mission.standingPaid ?? {};
  const label = entry =>
    entry.currency === "reputation" ? `Reputation ${signed(entry.amount)}` : `Net Worth +${money(entry.amount)}`;
  const rows = team
    .map(actor =>
      paid[actor.id]
        ? `<li>${loc`${esc(actor.name)}: already paid ${label(paid[actor.id])}`}</li>`
        : `<li>${loc`${esc(actor.name)}: not paid yet`}</li>`
    )
    .join("");
  const anyPaid = team.some(actor => paid[actor.id]),
    allPaid = team.length > 0 && team.every(actor => paid[actor.id]);
  const input = await formDialog({
    title: loc`Award Reputation or Net Worth — Table 7.10`,
    ok: allPaid ? loc`Pay standing` : loc`Pay the unpaid`,
    fields: [
      raw(`
    <p>${loc`Each character earns this for completing the mission whether or not it succeeded; failed critical objectives are exposure infractions recorded separately. A Profession/Accomplishment check may raise it.`}</p>
    <ul>${rows || `<li>${loc`No agents are on the team.`}</li>`}</ul>
    <label>${loc`Paid in`} <select name="currency">${options(
      [
        ["byAgent", loc`Each agent's affiliation: Faction in Reputation, Freelance in Net Worth`],
        ["reputation", `Reputation ${signed(standing.reputation)}`],
        ["netWorth", `Net Worth +${money(standing.netWorth)}`]
      ],
      effects.gearRules === "freelance" ? "netWorth" : effects.gearRules === "hybrid" ? "byAgent" : "reputation"
    )}</select></label>
    ${anyPaid ? `<label><input type="checkbox" name="again" /> ${loc`Correction: pay everyone the full reward again, including those already paid`}</label>` : ""}`)
    ],
    // Read again on submit: another GC may have paid while this dialog was open.
    validate: values => {
      const now = getMission().standingPaid ?? {};
      return !values.again && team.length && team.every(actor => now[actor.id])
        ? loc`Everyone on the team has been paid. Tick the correction box to pay again.`
        : "";
    }
  });
  if (!input) return null;
  // The record is read again: another dialog, or another GC, may have paid while this one was open.
  const paidNow = () => getMission().standingPaid ?? {};
  // Under Hybrid (p.407) each agent is paid in the currency of their own affiliation.
  const currencyOf = actor =>
    input.currency === "byAgent"
      ? actor.system.affiliationType === "freelance"
        ? "netWorth"
        : "reputation"
      : input.currency;
  const due = team.filter(actor => input.again || !paidNow()[actor.id]);
  if (!due.length) return decline(loc`Everyone on the team has been paid. Tick the correction box to pay again.`);
  if (payingStanding) return decline(loc`A standing payout is already running.`);
  payingStanding = true;
  const done = [],
    paidBefore = {};
  let paidAmount = null;
  try {
    // The Undo note gives the standing back and clears these agents' paid marks, so the payout can be made again.
    await withUndo(
      due,
      loc`Mission standing paid`,
      async () => {
        for (const actor of due) {
          if (!input.again && paidNow()[actor.id]) continue;
          const currency = currencyOf(actor),
            amount = standing[currency];
          paidBefore[actor.id] = paidNow()[actor.id] ?? null;
          // Recorded before the agent is paid, so an interrupted payout can never pay the same agent twice.
          await updateMission(m => ({
            standingPaid: { ...(m.standingPaid ?? {}), [actor.id]: { currency, amount } }
          }));
          await actor.update({ [`system.${currency}`]: (actor.system[currency] ?? 0) + amount });
          done.push(`${actor.name} (${label({ currency, amount })})`);
          paidAmount = amount;
        }
      },
      // The mission period goes with the marks: Undo leaves a later mission's payout alone.
      () => ({ standingPaid: { period: missionEpoch(), marks: paidBefore } })
    );
  } finally {
    payingStanding = false;
  }
  if (!done.length) return decline(loc`Everyone on the team has been paid. Tick the correction box to pay again.`);
  await say(loc`Mission standing awarded: ${esc(done.join(", "))}.`, false);
  return paidAmount;
}

const HANDLING_LABEL = {
  auto: () => loc`applied by the system`,
  partly: () => loc`partly by hand`,
  hand: () => loc`by hand`
};

/** Season-long campaign qualities (p.405). */
export async function editSeasonQualities() {
  requireGC();
  const campaign = getCampaign(),
    current = new Set(campaign.qualities);
  // The qualities in force come first, so the season's choices are in sight before the other sixty.
  const ordered = [...GC_DATA.campaignQualities].sort((a, b) => Number(current.has(b.id)) - Number(current.has(a.id)));
  const boxes = ordered
    .map(
      quality =>
        `<label title="${esc(quality.summary)}"><input type="checkbox" name="q-${quality.id}" ${current.has(quality.id) ? "checked" : ""} /> ${loc`${esc(quality.name)} (${signed(quality.xp)} XP${quality.seasonOnly ? "; seasons only" : ""})`} <span class="tag">${esc(HANDLING_LABEL[qualityHandling(quality)]())}</span> — ${esc(quality.summary)}</label>`
    )
    .join("");
  const chosen = values =>
    GC_DATA.campaignQualities.filter(quality => values[`q-${quality.id}`]).map(quality => quality.id);
  const input = await formDialog({
    title: loc`Season campaign qualities — pp.405–408`,
    ok: loc`Save qualities`,
    fields: [
      raw(
        `<p>${loc`These apply to every mission of the season and modify each mission's base XP reward. Those in force are listed first.`}</p>
    <label>${loc`Find a quality`} <input name="qualitySearch" type="search" autocomplete="off" /></label>
    <p class="hint" data-quality-count aria-live="polite"></p>
    <div class="sc2-scroll-list">${boxes}</div>`
      )
    ],
    // Two qualities that cannot stand together are refused here, with the ticks kept.
    validate: values => qualityClash(chosen(values)) || "",
    dialog: {
      render: (event, app) => {
        const root = app?.element ?? event?.target,
          search = root?.querySelector?.('[name="qualitySearch"]');
        const count = root?.querySelector?.("[data-quality-count]");
        const tally = () => {
          const labels = [...root.querySelectorAll(".sc2-scroll-list > label")],
            shown = labels.filter(label => !label.hidden).length,
            ticked = labels.filter(label => label.querySelector("input")?.checked).length;
          if (count)
            count.textContent = shown
              ? loc`${shown} shown · ${ticked} ticked`
              : loc`No quality matches · ${ticked} ticked`;
        };
        // Enter in the search box searches; it does not save the dialog.
        search?.addEventListener("keydown", event => {
          if (event.key === "Enter") event.preventDefault();
        });
        search?.addEventListener("input", () => {
          const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
          for (const label of root.querySelectorAll(".sc2-scroll-list > label"))
            label.hidden = !words.every(word => label.textContent.toLowerCase().includes(word));
          tally();
        });
        root?.querySelector?.(".sc2-scroll-list")?.addEventListener("change", tally);
        tally();
      }
    }
  });
  if (!input) return null;
  const qualities = GC_DATA.campaignQualities.filter(quality => input[`q-${quality.id}`]).map(quality => quality.id);
  const clash = qualityClash(qualities);
  if (clash) return refuse(clash);
  await setCampaign({ ...campaign, qualities });
  return getCampaign();
}
