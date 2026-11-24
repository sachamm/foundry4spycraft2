/** Mission record dialogs (pp.423–440): Threat Level, Caliber, objectives, complications, antagonists, exposure and rewards. */
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
import { qualityAddition, adjustedStartingDice } from "../../rules/gc/campaign.mjs";
import { resolveDevice, SECURITY_DEVICES } from "../../rules/gc/security.mjs";
import { GC_DATA } from "../../rules/gc-tables.mjs";
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
  setCampaign
} from "./state.mjs";
import { loc } from "../../i18n.mjs";
import { startUsagePeriod } from "../../services/periods.mjs";
import { gcDiceStatus, initializeGCDice } from "../../services/gc-dice.mjs";
import { systemDialog } from "../dialog-theme.mjs";
import { formDialog, raw } from "../dialog-kit.mjs";

const T = GC_DATA.tables;
const ask = (title, content, ok) => formDialog({ title, ok, fields: [raw(content)] });
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
        `<label><input type="checkbox" name="team-${actor.id}" ${mission.team.includes(actor.id) || (!mission.team.length && actor.hasPlayerOwner) ? "checked" : ""} /> ${loc`${esc(actor.name)} (level ${actor.system.level ?? "?"})`}</label>`
    )
    .join("");
  const input = await ask(
    loc`Mission record`,
    `
    <label>${loc`Mission name`} <input name="name" value="${esc(mission.name)}" /></label>
    <label>${loc`Caliber`} <select name="caliber">${options(
      [1, 2, 3, 4, 5].map(n => [n, ["I", "II", "III", "IV", "V"][n - 1]]),
      mission.caliber
    )}</select></label>
    <label>${loc`Threat Level adjustment (home campaigns, −2 to +2)`} <input type="number" name="threatAdjust" min="-2" max="2" value="${mission.threatAdjust}" /></label>
    <label>${loc`Fixed Threat Level (published missions; blank to calculate)`} <input type="number" name="threatOverride" min="1" max="20" value="${mission.threatOverride ?? ""}" /></label>
    <label>${loc`Scripted dramatic scenes (1 is free; each extra +100 XP; none −50 XP)`} <input type="number" name="dramaticScenes" min="0" value="${mission.dramaticScenes}" /></label>
    <label><input type="checkbox" name="timeLimit" ${mission.timeLimit ? "checked" : ""} /> ${loc`Time limit complication (+50 XP)`}</label>
    <label>${loc`Common Items in the mission bundle (−1 XP each)`} <input type="number" name="bundleCommonItems" min="0" value="${mission.bundleCommonItems}" /></label>
    <label>${loc`Scenes played so far`} <input type="number" name="scenesPlayed" min="0" value="${mission.scenesPlayed}" /></label>
    <fieldset><legend>${loc`Team (Threat Level = sum of career levels ÷ 5, rounded up)`}</legend>${team || `<p>${loc`No agents exist yet.`}</p>`}</fieldset>
    <label>${loc`Notes`} <input name="notes" value="${esc(mission.notes)}" /></label>`,
    loc`Save mission`
  );
  if (!input) return null;
  const override = Number(input.threatOverride);
  return setMission({
    ...mission,
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
}

/** Begin the mission: the Threat Level is calculated once, now (p.423), and NPCs that follow the mission rescale. */
/** Ask once before a step that resets characters' uses. */
const confirmStep = (title, lines, yes = title) =>
  systemDialog.confirm({
    window: { title },
    content: `<ol>${lines.map(line => `<li>${esc(line)}</li>`).join("")}</ol>`,
    yes: { label: yes },
    no: { label: loc`Cancel` },
    rejectClose: false
  });

/**
 * Begin a play session in one step: start the session period (session uses and action dice reset), set up the GC
 * pool from the team and the mission's Caliber, and apply the Threat Level and campaign-quality starting dice.
 */
export async function beginSession() {
  requireGC();
  const mission = getMission(),
    players = teamActors(mission).length,
    caliber = mission.caliber;
  const ok = await confirmStep(loc`Begin a session`, [
    loc`Start a new session: abilities usable once per session come back and each agent's action dice reset.`,
    loc`GC action dice: ${players} player character(s) + 2 × Caliber ${caliber} = ${players + 2 * caliber}.`,
    loc`Apply the mission's Threat Level and campaign-quality changes to the agents' starting dice.`
  ]);
  if (!ok) return null;
  await startUsagePeriod("session");
  await initializeGCDice({ playersPresent: players, caliber, replaceExisting: gcDiceStatus().current });
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
  const ok = await confirmStep(loc`Next scene`, [
    loc`Abilities usable once per scene come back; a dramatic scene returns to standard; standard NPCs' accumulated damage clears.`,
    ...(mission.active ? [loc`Count the scene just played toward the mission's XP.`] : [])
  ]);
  if (!ok) return null;
  await startUsagePeriod("scene");
  if (mission.active) await updateMission(m => ({ scenesPlayed: (m.scenesPlayed ?? 0) + 1 }));
  return true;
}

export async function startMission() {
  requireGC();
  const before = getMission();
  // An ended record still holds the last run's results. Starting it again is a new run, so they are cleared first.
  const hadResults =
    before.ended &&
    ((before.objectives ?? []).some(objective => objective.complete) ||
      (before.antagonists ?? []).some(antagonist => antagonist.encountered) ||
      (before.infractions ?? []).length > 0 ||
      Object.keys(before.standingPaid ?? {}).length > 0);
  if (hadResults) {
    const ok = await confirmStep(loc`Start the mission again`, [
      loc`This record was ended. Starting it again begins a new run of the same mission.`,
      loc`Completed objectives, antagonists faced, infractions, scenes played and the standing payout are cleared.`,
      loc`To carry on the run that was ended, cancel and use Resume mission.`
    ]);
    if (!ok) return null;
  }
  // The mission record and the mission's usage period begin together: mission uses come back.
  await startUsagePeriod("mission");
  await updateMission(mission => ({
    active: true,
    ended: false,
    infractions: [],
    scenesPlayed: 0,
    standingPaid: {},
    objectives: (mission.objectives ?? []).map(objective => ({ ...objective, complete: false })),
    antagonists: (mission.antagonists ?? []).map(antagonist => ({ ...antagonist, encountered: false }))
  }));
  const tl = await fixThreatLevel(),
    mission = getMission(),
    standing = missionStanding(mission);
  await say(
    `<b>${loc`Mission ${esc(mission.name || "")} begins.`}</b> ${loc`Threat Level`} <b>${tl.value}</b>${loc`${tl.override ? " (fixed)" : ` (${tl.base}${tl.adjust ? ` ${signed(tl.adjust)}` : ""})`}, Caliber ${mission.caliber}.${tl.bonusDice ? loc` Each player character starts each session with ${tl.bonusDice} extra action di${tl.bonusDice === 1 ? "e" : "ce"} (p.61).` : ""} Base standing reward: Reputation ${standing.reputation} or Net Worth ${money(standing.netWorth)}. GC starting dice: ${teamActors(mission).length} + ${2 * mission.caliber}.`}`
  );
  // A session already under way began without this mission's Threat Level, so its bonus dice are given now (p.61).
  if (sessionStarted()) await applySessionDiceAdjustments({ quiet: true });
  return tl;
}

/** End the mission after asking: the record stays for the XP report, settlement and the standing payout. */
export async function endMission({ clear = false } = {}) {
  requireGC();
  const mission = getMission();
  if (clear) return setMission(defaultMission());
  const open = (mission.objectives ?? []).filter(objective => !objective.complete).length;
  const ok = await confirmStep(loc`End the mission`, [
    loc`The mission stops being active: NPCs that follow the mission's Threat Level go back to their own.`,
    loc`The record is kept, so the XP report, each agent's XP settlement and the standing payout still work.`,
    ...(open ? [loc`${open} objective(s) are not marked complete.`] : []),
    loc`Resume mission reopens it with nothing changed.`
  ]);
  if (!ok) return null;
  await setMission({ ...mission, active: false, ended: true });
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
  await setMission({ ...mission, active: true, ended: false });
  await say(`<b>${loc`Mission ${esc(mission.name || "")} resumed.`}</b>`);
  return true;
}

const sessionStarted = () => {
  try {
    return !!game.settings.get("spycraft2", "usagePeriods")?.session && gcDiceStatus().current;
  } catch {
    return false;
  }
};

export async function addObjective() {
  requireGC();
  const categories = [...new Set(T.objectives.map(objective => objective.category))];
  const samples = categories
    .map(
      category =>
        `<optgroup label="${esc(category)}">${options(T.objectives.filter(objective => objective.category === category).map(objective => [`${objective.category} — ${objective.name}|${objective.grade}`, `${objective.grade}: ${objective.name}`.slice(0, 110)]))}</optgroup>`
    )
    .join("");
  const input = await ask(
    loc`Add an objective — grade × 25 XP (p.431)`,
    `
    <label>${loc`Sample (Table 7.6)`} <select name="sample"><option value="">${loc`Custom`}</option>${samples}</select></label>
    <label>${loc`Name (state exactly how it is completed)`} <input name="name" /></label>
    <label>${loc`Grade for a custom objective`} <input type="number" name="grade" min="1" max="5" value="1" /></label>
    <label><input type="checkbox" name="critical" /> ${loc`Critical objective (failing it causes exposure)`}</label>`,
    loc`Add objective`
  );
  if (!input) return null;
  const [sampleName, sampleGrade] = String(input.sample || "").split("|");
  const objective = {
    id: foundry.utils.randomID(),
    name: String(input.name || "").trim() || sampleName || "Objective",
    grade: input.sample ? Number(sampleGrade) : Number(input.grade),
    critical: !!input.critical,
    complete: false,
    scenes: 1
  };
  return updateMission(mission => ({ objectives: [...mission.objectives, objective] }));
}

export async function addAntagonist() {
  requireGC();
  const npcs = [...game.actors].filter(actor => actor.type === "npc");
  const input = await ask(
    loc`Add an antagonist (p.452)`,
    `
    <p>${loc`Each NPC type counts once per mission however many appear; a special NPC counts four times its reward; a ‘full’ special NPC built with the character rules earns 300 XP per scene instead.`}</p>
    <label>${loc`NPC`} <select name="uuid"><option value="">${loc`Not an existing actor`}</option>${options(npcs.map(actor => [actor.uuid, `${actor.name}${Number.isFinite(actor.system.npcBuild?.xp) ? ` (${actor.system.npcBuild.xp} XP)` : " (enter XP)"}`]))}</select></label>
    <label>${loc`Name`} <input name="name" /></label>
    <label>${loc`XP reward if not read from the actor`} <input type="number" name="xp" min="0" value="0" /></label>
    <label>${loc`Type`} <select name="type">${options(
      [
        ["", loc`From the actor`],
        ["standard", loc`Standard or animal`],
        ["special", loc`Special`]
      ],
      ""
    )}</select></label>
    <label><input type="checkbox" name="full" /> ${loc`‘Full’ special NPC (300 XP per scene)`}</label>
    <label>${loc`Scenes a full or promoted NPC appears in`} <input type="number" name="scenes" min="1" value="1" /></label>`,
    loc`Record for XP`
  );
  if (!input) return null;
  const actor = input.uuid ? await fromUuid(input.uuid) : null;
  const antagonist = {
    id: foundry.utils.randomID(),
    uuid: actor?.uuid ?? null,
    typeKey: actor ? (actor.isToken ? (actor.token?.baseActor?.uuid ?? actor.uuid) : actor.uuid) : null,
    name: String(input.name || "").trim() || actor?.name || "Antagonist",
    xp: Number.isFinite(actor?.system.npcBuild?.xp) ? actor.system.npcBuild.xp : Number(input.xp) || 0,
    type: input.type || (["special", "villain"].includes(actor?.system.npcType) ? "special" : "standard"),
    full: !!input.full,
    scenes: Math.max(1, Number(input.scenes) || 1),
    encountered: false
  };
  return updateMission(mission => ({ antagonists: [...mission.antagonists, antagonist] }));
}

/** Whether the mission's XP record already lists this NPC's type. */
export const antagonistRecorded = actor =>
  !!actor && getMission().antagonists.some(entry => entry.typeKey === actor.uuid || entry.uuid === actor.uuid);

/** Add an NPC actor to the mission's XP record without a dialog; a type already listed is left alone. */
export async function recordAntagonist(actor) {
  requireGC();
  if (!actor || antagonistRecorded(actor)) return null;
  const antagonist = {
    id: foundry.utils.randomID(),
    uuid: actor.uuid,
    typeKey: actor.uuid,
    name: actor.name,
    xp: Number.isFinite(actor.system.npcBuild?.xp) ? actor.system.npcBuild.xp : 0,
    type: ["special", "villain"].includes(actor.system.npcType) ? "special" : "standard",
    full: false,
    scenes: 1,
    encountered: false
  };
  await updateMission(mission => ({ antagonists: [...mission.antagonists, antagonist] }));
  return antagonist;
}

export async function addComplication() {
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
    <label data-when="kind=exposure">${loc`Exposure objective`} <select name="exposure">${options(T.exposure.map(entry => [entry.id, `${entry.objective} (${entry.xpPrinted ?? signed(entry.xp)} XP)`]))}</select></label>
    <label data-when="kind=bundle|other">${loc`Bundle pick or other complication name`} <input name="name" /></label>
    <label data-when="kind=bundle">${loc`Bundle pick Caliber (−10 XP per Caliber)`} <input type="number" name="caliber" min="1" max="5" value="1" /></label>
    <label data-when="kind=other">${loc`Other complication XP`} <input type="number" name="xp" value="0" /></label>
    <label>${loc`How many`} <input type="number" name="count" min="1" value="1" /></label>`,
    loc`Add complication`
  );
  if (!input) return null;
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
      case "gear":
        return updateMission(m => ({
          gearRestrictions: [...m.gearRestrictions, { key: id, id: input.gear, count: 1 }]
        }));
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
export async function changeEntry(list, key, change) {
  requireGC();
  return updateMission(mission => ({
    [list]: (mission[list] ?? []).flatMap(entry => {
      if ((entry.key ?? entry.id) !== key) return [entry];
      if (change === "remove") return [];
      return [{ ...entry, [change]: !entry[change] }];
    })
  }));
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
      `${objective.objective}: ${infraction.name} (${infraction.reputation} / −${money(infraction.netWorth)})`.slice(
        0,
        150
      )
    ])
  );
  const { effects } = currentCampaignEffects(),
    rules = effects.gearRules;
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
    <label><input type="checkbox" name="honor" /> ${loc`Honor-code violation under the Corrupt campaign quality (half, rounded down)`}</label>`,
    loc`Record infraction`
  );
  if (!input) return null;
  const actor = game.actors.get(input.actor),
    [objectiveId, index] = String(input.infraction).split("|");
  const infraction = T.exposure.find(row => row.id === objectiveId)?.infractions[Number(index)];
  if (!actor || !infraction) return refuse(loc`Choose a character and an infraction.`);
  const penalty = exposurePenalty(infraction, { preventing: !!input.preventing, halve: !!input.honor })[input.currency];
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
  const lines = [];
  for (const actor of team) {
    const starting = actor.system.actionDice?.max ?? 0,
      target = adjustedStartingDice(starting, effects, bonus),
      change = target - starting,
      before = applied(actor);
    if (before && (before.change === null || before.change === change)) {
      lines.push(loc`${esc(actor.name)}: already adjusted this session`);
      continue;
    }
    const step = change - (before?.change ?? 0);
    const value = Math.max(0, (actor.system.actionDice?.value ?? 0) + step);
    await actor.update({
      "system.actionDice.value": value,
      "flags.spycraft2.sessionDiceAdjusted": { session, change }
    });
    lines.push(`${esc(actor.name)}: ${signed(step)} → ${value}`);
  }
  if (quiet && !lines.some(line => line.includes("→"))) return delta;
  await say(
    `<b>${loc`Starting action dice adjusted`}</b> ${loc`(Threat Level bonus ${signed(bonus)}; campaign qualities ${signed(effects.startingActionDice ?? 0)}).`}<br>${lines.join("<br>")}`
  );
  return delta;
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
  return xp;
}

/**
 * Pay the Table 7.10 standing reward to the team. The mission remembers who was paid, so a second press, or a retry
 * after an interruption, pays only those still unpaid unless the GC asks for a correction.
 */
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
    ok: allPaid ? loc`Pay again` : loc`Pay the unpaid`,
    fields: [
      raw(`
    <p>${loc`Each character earns this for completing the mission whether or not it succeeded; failed critical objectives are exposure infractions recorded separately. A Profession/Accomplishment check may raise it.`}</p>
    <ul>${rows || `<li>${loc`No agents are on the team.`}</li>`}</ul>
    <label>${loc`Paid in`} <select name="currency">${options(
      [
        ["reputation", `Reputation ${signed(standing.reputation)}`],
        ["netWorth", `Net Worth +${money(standing.netWorth)}`]
      ],
      effects.gearRules === "freelance" ? "netWorth" : "reputation"
    )}</select></label>
    ${anyPaid ? `<label><input type="checkbox" name="again" /> ${loc`Correction: also pay those already paid`}</label>` : ""}`)
    ]
  });
  if (!input) return null;
  const amount = standing[input.currency],
    due = team.filter(actor => input.again || !paid[actor.id]);
  if (!due.length) return decline(loc`Everyone on the team has been paid. Tick the correction box to pay again.`);
  const done = [];
  for (const actor of due) {
    await actor.update({ [`system.${input.currency}`]: (actor.system[input.currency] ?? 0) + amount });
    // Recorded agent by agent, so an interrupted payout knows where it stopped.
    await updateMission(m => ({
      standingPaid: { ...(m.standingPaid ?? {}), [actor.id]: { currency: input.currency, amount } }
    }));
    done.push(actor.name);
  }
  await say(
    loc`Mission standing awarded: ${input.currency === "reputation" ? `Reputation ${signed(amount)}` : `Net Worth +${money(amount)}`} to ${esc(done.join(", "))}.`,
    false
  );
  return amount;
}

/** Season-long campaign qualities (p.405). */
export async function editSeasonQualities() {
  requireGC();
  const campaign = getCampaign(),
    current = new Set(campaign.qualities);
  const boxes = GC_DATA.campaignQualities
    .map(
      quality =>
        `<label title="${esc(quality.summary)}"><input type="checkbox" name="q-${quality.id}" ${current.has(quality.id) ? "checked" : ""} /> ${loc`${esc(quality.name)} (${signed(quality.xp)} XP${quality.seasonOnly ? "; seasons only" : ""}) — ${esc(quality.summary)}`}</label>`
    )
    .join("");
  const input = await ask(
    loc`Season campaign qualities — pp.405–408`,
    `<p>${loc`These apply to every mission of the season and modify each mission's base XP reward.`}</p><div class="sc2-scroll-list">${boxes}</div>`,
    loc`Save qualities`
  );
  if (!input) return null;
  await setCampaign({
    ...campaign,
    qualities: GC_DATA.campaignQualities.filter(quality => input[`q-${quality.id}`]).map(quality => quality.id)
  });
  return getCampaign();
}
