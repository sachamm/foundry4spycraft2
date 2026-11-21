/** Dramatic Conflict tracker (pp.363–388): the GC runs each Conflict round through a short series of dialogs. */
import { esc } from "../../html.mjs";
import { refuse } from "../../error-notices.mjs";
import {
  CONFLICT_TYPES,
  startConflict,
  availableStrategies,
  chooseStrategy,
  strategyModifier,
  resolveCheck,
  advantageOptions,
  chooseAdvantages,
  nextRound,
  concede,
  adjustLead,
  conflictSummary,
  CONFLICT_FEATS,
  photoFinish,
  useConflictFeat,
  declarePace,
  guessStrategy,
  instinctPenalty,
  roomFeatFor,
  easedRoom
} from "../../rules/gc/conflict.mjs";
import { requireGC, getConflicts, saveConflict } from "./state.mjs";
import {
  MANEUVERING_ROOM,
  chaseScale,
  leadDistance,
  participantRatings,
  smashAfterWin,
  smashEligible,
  smashRangeLead,
  smashState,
  spendSmash,
  startingLead
} from "../../rules/chase.mjs";
import { spendFuel } from "../vehicle-play.mjs";
import { recentResultsHint } from "../opposed-checks.mjs";
import { loc } from "../../i18n.mjs";

const ask = (title, content) =>
  foundry.applications.api.DialogV2.input({
    window: { title },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options">${content}</div>`
  });
const options = (rows, selected) =>
  rows
    .map(
      ([value, label]) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`
    )
    .join("");
const gm = () => ChatMessage.getWhisperRecipients("GM").map(user => user.id);
const say = (content, whisper = false) =>
  ChatMessage.create({ speaker: { alias: loc`Dramatic Conflict` }, content, ...(whisper ? { whisper: gm() } : {}) });
const signed = value => (value >= 0 ? `+${value}` : `${value}`);
const sideName = (conflict, side) => conflict[side].name || (side === "predator" ? "Predator" : "Prey");
const strategy = (conflict, side) =>
  CONFLICT_TYPES[conflict.type].strategies.find(entry => entry.id === conflict[side].strategy);

/** Chase participant from an actor: a vehicle supplies its ratings; a character runs on foot. */
const chaseSource = uuid => {
  const actor = uuid ? fromUuidSync(uuid) : null;
  return actor ? { actor, kind: actor.type === "vehicle" ? "vehicle" : "foot", system: actor.system } : null;
};
const chaseActorOptions = () => [
  ["", "— type ratings by hand —"],
  ...[...game.actors]
    .filter(a => ["vehicle", "agent", "npc"].includes(a.type))
    .sort((a, b) => (a.type === "vehicle" ? 0 : 1) - (b.type === "vehicle" ? 0 : 1) || a.name.localeCompare(b.name))
    .map(a => [a.uuid, `${a.name}${a.type === "vehicle" ? "" : " (on foot)"}`])
];
/** The tracked chase feats a participant has: a vehicle's driver supplies them, a character their own. */
const participantFeats = uuid => {
  const actor = uuid ? fromUuidSync(uuid) : null,
    person = actor?.type === "vehicle" ? (actor.system.driver ? fromUuidSync(actor.system.driver) : null) : actor;
  return (person?.system?.activeFeatNames ?? []).filter(feat => CONFLICT_FEATS.includes(feat));
};
const featBoxes = (side, ticked) =>
  `<p>${CONFLICT_FEATS.map(
    feat =>
      `<label><input type="checkbox" name="${side}Feat-${esc(feat)}"${ticked.includes(feat) ? " checked" : ""} /> ${esc(feat)}</label>`
  ).join(" ")}</p>`;
const tickedFeats = (input, side) => CONFLICT_FEATS.filter(feat => input[`${side}Feat-${feat}`] === true);
const roomRows = () =>
  Object.entries(MANEUVERING_ROOM).map(([key, r]) => [
    key,
    loc`${r.label} (×${r.speedFactor} speed, +${r.topMphBonus} fastest, Crisis DC ${r.crisisDC})`
  ]);

/** Current chase ratings and scale for a stored chase. */
function chaseState(conflict) {
  const chase = conflict.chase;
  if (!chase) return null;
  const predator = chaseSource(chase.predator),
    prey = chaseSource(chase.prey);
  const ratings = {
    predator: predator ? participantRatings(predator) : null,
    prey: prey ? participantRatings(prey) : null
  };
  const scale = chaseScale(chase.room, ratings.predator ?? {}, ratings.prey ?? {});
  return { predator, prey, ratings, scale };
}
const chaseLine = (conflict, state) => {
  const r = state.scale,
    distance = leadDistance(conflict.lead, r.leadFeet),
    smash = smashState(conflict.chase?.smash);
  const smashText = smash
    ? ` ${loc`· ${esc(sideName(conflict, smash.side))} holds`} <b>${loc`${smash.points} Smash`}</b> ${loc`(attacks on them use Lead ${smashRangeLead(conflict.lead, smash)} for range)`}`
    : "";
  const eased = ["predator", "prey"]
    .map(side => {
      const source = state[side],
        feat = roomFeatFor(
          conflict[side]?.feats ?? [],
          source && { kind: source.kind, vehicleClass: source.system?.vehicleClass }
        ),
        key = conflict.chase?.room,
        room = MANEUVERING_ROOM[easedRoom(key)];
      return feat
        ? loc` · ${esc(sideName(conflict, side))} (${esc(feat)}) treats it as ${room.label}${easedRoom(key) !== key ? loc` (Crisis DC ${room.crisisDC})` : ""} and has +2 on checks and saves from a Crisis Advantage`
        : "";
    })
    .join("");
  return `Maneuvering Room ${r.room.label} (Crisis DC ${r.crisisDC})${eased}${distance !== null ? loc` · ${distance.toLocaleString("en-US")} ft. apart (${r.leadFeet} ft. per Lead)` : ""}${r.speedMph !== null ? ` · chase speed ${r.speedMph} MPH` : ""}${r.fastest ? loc` · ${esc(sideName(conflict, r.fastest))} has the fastest vehicle (+${r.topMphBonus})` : ""}${r.mismatched ? ` · <b>${loc`mismatched scales: settle with one opposed check`}</b>` : ""}${smashText}`;
};

export function conflictRows() {
  return Object.entries(getConflicts()).map(([id, conflict]) => ({
    id,
    ...conflictSummary(conflict),
    name: conflict.name,
    predator: sideName(conflict, "predator"),
    prey: sideName(conflict, "prey"),
    strategiesChosen: ["predator", "prey"].filter(side => conflict[side].strategy).length
  }));
}

export async function startConflictDialog() {
  requireGC();
  const typeRows = Object.entries(CONFLICT_TYPES).map(([id, type]) => [
    id,
    `${type.name} (pp.${type.pages.join("–")})`
  ]);
  const first = await ask(
    loc`Start a Dramatic Conflict`,
    `
    <label>${loc`Type`} <select name="type">${options(typeRows)}</select></label>
    <label>${loc`Name`} <input name="name" placeholder="${loc`e.g. Rooftop pursuit`}" /></label>
    <label>${loc`Predator`} <input name="predator" /></label>
    <label>${loc`Prey`} <input name="prey" /></label>
    <fieldset><legend>${loc`Chase only`}</legend>
      <label>${loc`Predator vehicle or character`} <select name="predatorActor">${options(chaseActorOptions(), "")}</select></label>
      <label>${loc`Prey vehicle or character`} <select name="preyActor">${options(chaseActorOptions(), "")}</select></label>
      <label>${loc`Maneuvering Room`} <select name="room">${options(roomRows(), "close")}</select></label>
    </fieldset>`
  );
  if (!first) return null;
  const rules = CONFLICT_TYPES[first.type];
  // A chase reads Acceleration, Turning and top MPH from the vehicles involved (pp.364–365).
  let chase = null,
    chaseNote = "",
    suggested = {};
  if (first.type === "chase" && (first.predatorActor || first.preyActor)) {
    chase = { room: first.room || "close", predator: first.predatorActor || "", prey: first.preyActor || "" };
    const state = chaseState({ chase, lead: 5 }),
      start = startingLead(chase.room, state.ratings.predator ?? {}, state.ratings.prey ?? {});
    suggested = { lead: start.lead, p: state.ratings.predator, q: state.ratings.prey };
    first.predator ||= state.predator?.actor.name ?? "";
    first.prey ||= state.prey?.actor.name ?? "";
    chaseNote = `<p><b>${loc`From the vehicles:`}</b> ${loc`starting Lead ${start.lead} (${start.rating} difference ${signed(start.difference)}). ${chaseLine({ ...{ lead: start.lead }, predator: { name: first.predator }, prey: { name: first.prey } }, state)}.`}</p>`;
  }
  const leadRows = (rules.startingLead?.rules ?? [])
    .map(rule => `<li>${esc(rule.when)}: ${rule.lead ?? esc(rule.formula ?? rule.result ?? "")}</li>`)
    .join("");
  const ratingInputs = (rules.powerRatings ?? [])
    .map(
      (rating, i) =>
        `<label>${loc`${esc(rating)} — Predator`} <input type="number" name="p${i}" value="${suggested.p?.[rating] ?? 0}" /> ${loc`Prey`} <input type="number" name="q${i}" value="${suggested.q?.[rating] ?? 0}" /></label>`
    )
    .join("");
  const second = await ask(
    loc`${rules.name}: starting Lead and ratings`,
    `
    <p>${esc(rules.startingLead?.summary ?? "")}</p><ul>${leadRows}</ul>
    <p>${loc`Predator skill: ${esc(rules.predatorSkills.join("; "))}`}<br>${loc`Prey skill: ${esc(rules.preySkills.join("; "))}`}<br>${loc`Each round: ${esc(rules.roundTime)}`}</p>
    ${chaseNote}
    <label>${loc`Starting Lead (1–9)`} <input type="number" name="lead" min="1" max="9" value="${suggested.lead ?? rules.startingLead?.default ?? 5}" required /></label>
    ${ratingInputs}
    <fieldset><legend>${loc`Conflict feats (pp.192–193, 208–209): Predator`}</legend>${featBoxes("p", participantFeats(chase?.predator))}</fieldset>
    <fieldset><legend>${loc`Conflict feats: Prey`}</legend>${featBoxes("q", participantFeats(chase?.prey))}</fieldset>
    <p>${loc`Jackrabbit Start and Relentless Pursuit move the starting Lead by 2 after the value above.`}</p>`
  );
  if (!second) return null;
  const ratings = side =>
    Object.fromEntries((rules.powerRatings ?? []).map((rating, i) => [rating, Number(second[`${side}${i}`]) || 0]));
  try {
    const conflict = startConflict(first.type, {
      lead: Number(second.lead),
      name: first.name,
      predator: {
        name: first.predator,
        actorUuid: chase?.predator || null,
        ratings: ratings("p"),
        feats: tickedFeats(second, "p")
      },
      prey: { name: first.prey, actorUuid: chase?.prey || null, ratings: ratings("q"), feats: tickedFeats(second, "q") }
    });
    if (chase) conflict.chase = chase;
    const id = foundry.utils.randomID();
    await saveConflict(id, conflict);
    if (chase) await say(`<b>${esc(conflict.name)}</b>: ${chaseLine(conflict, chaseState(conflict))}.`);
    await say(
      `<b>${esc(conflict.name)}</b> ${loc`begins — ${esc(rules.name)}. Lead ${conflict.lead}. ${esc(sideName(conflict, "predator"))} (Predator) wins at 0; ${esc(sideName(conflict, "prey"))} (Prey) wins at 10.`}`
    );
    return id;
  } catch (error) {
    return refuse(error.message);
  }
}

/** Advance the chosen conflict by whatever its current step needs. */
export async function advanceConflict(id) {
  requireGC();
  const conflict = getConflicts()[id];
  if (!conflict) return refuse(loc`That conflict no longer exists.`);
  const rules = CONFLICT_TYPES[conflict.type];
  try {
    if (conflict.step === "strategies") {
      const side = conflict.predator.strategy ? "prey" : "predator";
      const list = availableStrategies(conflict, side);
      const rows = list.map(entry => [
        entry.id,
        `${entry.name} (${entry.modifier === null ? "see note" : signed(entry.modifier)}${entry.skill ? `; ${entry.skill}` : ""}${entry.roundDuration && !["—", "**"].includes(entry.roundDuration) ? `; ${entry.roundDuration}` : ""}) — ${entry.advantages.join(", ").replace("*", "any but Victory")}${entry.available ? "" : ` — needs ${entry.reasons.join("; ")}`}${entry.confirm ? loc` — GC confirms other requirement` : ""}`
      ]);
      const input = await ask(
        loc`${conflict.name}: ${sideName(conflict, side)} chooses a Strategy (Lead ${conflict.lead})`,
        `
        <p>${loc`Strategies are secret until both are chosen and cannot be changed afterwards. Ask now about abilities used before the reveal.`}</p>
        <label>${loc`Strategy`} <select name="strategy">${options(rows, list.find(entry => entry.available)?.id)}</select></label>
        <label><input type="checkbox" name="confirmOther" /> ${loc`Other printed requirement confirmed (feat, class ability, approach, software…)`}</label>`
      );
      if (!input) return null;
      const next = chooseStrategy(conflict, side, input.strategy, { confirmOther: !!input.confirmOther });
      await saveConflict(id, next);
      if (next.step === "check")
        await say(
          `<b>${esc(conflict.name)}</b> ${loc`— round ${next.round}, Lead ${next.lead}. Strategies revealed: ${esc(sideName(next, "predator"))}`} <b>${esc(strategy(next, "predator").name)}</b> (${signed(strategyModifier(next, "predator"))}); ${esc(sideName(next, "prey"))} <b>${esc(strategy(next, "prey").name)}</b> ${loc`(${signed(strategyModifier(next, "prey"))}). Make the opposed check.`}`
        );
      for (const target of ["predator", "prey"])
        if (instinctPenalty(next, target))
          await say(
            `<b>${esc(conflict.name)}</b>: ${loc`Driving Instincts — the guess was right; ${esc(sideName(next, target))} takes −${instinctPenalty(next, target)} on this check (included above).`}`
          );
      return next;
    }
    if (conflict.step === "check") {
      const critical = side =>
        `<label>${loc`${esc(sideName(conflict, side))} critical`} <select name="${side}Critical">${options(
          [
            ["", loc`None`],
            ["success", loc`Critical success`],
            ["failure", loc`Critical failure`]
          ],
          ""
        )}</select></label>`;
      const input = await ask(
        loc`${conflict.name}: opposed check`,
        `
        <p>${loc`Enter each final result with its Strategy modifier already applied (${esc(strategy(conflict, "predator").name)} ${signed(strategyModifier(conflict, "predator"))}; ${esc(strategy(conflict, "prey").name)} ${signed(strategyModifier(conflict, "prey"))}). Criticals only shift the Lead by 1; threats and errors otherwise do nothing here.`}</p>
        <p class="hint">${recentResultsHint()}</p>
        <label>${loc`${esc(sideName(conflict, "predator"))} result`} <input type="number" name="predator" required /></label>${critical("predator")}
        <label>${loc`${esc(sideName(conflict, "prey"))} result`} <input type="number" name="prey" required /></label>${critical("prey")}
        <label>${loc`If tied, winner`} <select name="tieWinner">${options(
          [
            ["", "—"],
            ["predator", sideName(conflict, "predator")],
            ["prey", sideName(conflict, "prey")]
          ],
          ""
        )}</select></label>`
      );
      if (!input) return null;
      const next = resolveCheck(conflict, {
        predator: { result: Number(input.predator), critical: input.predatorCritical || null },
        prey: { result: Number(input.prey), critical: input.preyCritical || null },
        tieWinner: input.tieWinner || null
      });
      // Altitude (p.365): the Smash holder gains a point for winning the opposed check and loses one for losing it.
      const checkWinner = next.pending?.winner ?? next.winner,
        smashBefore = smashState(next.chase?.smash);
      if (smashBefore) next.chase.smash = smashAfterWin(smashBefore, checkWinner);
      await saveConflict(id, next);
      if (smashBefore)
        await say(
          `<b>${esc(conflict.name)}</b>: ${esc(sideName(next, smashBefore.side))} ${next.chase.smash ? loc`now holds ${next.chase.smash.points} Smash point${next.chase.smash.points === 1 ? "" : "s"}` : loc`loses the last Smash point and must climb above the opponent again to regain Smash`}.`
        );
      if (next.winner) return announceEnd(id, next);
      await say(
        `<b>${esc(conflict.name)}</b>${loc`: ${esc(sideName(next, next.pending.winner))} wins the check by ${next.pending.margin} and takes ${next.pending.advantages} Advantage(s).${next.pending.criticalShift ? loc` Criticals move the Lead ${next.pending.criticalShift}.` : ""} Lead ${next.lead}.`}`
      );
      return next;
    }
    if (conflict.step === "advantages") {
      const list = advantageOptions(conflict),
        allowed = conflict.pending.advantages;
      const smashNow = smashState(conflict.chase?.smash),
        canSpend = smashNow?.side === conflict.pending.winner;
      const spendLabel = canSpend
        ? smashNow.side === "predator"
          ? loc`cut the Lead by 1 more`
          : loc`gain +4 Defense until the start of the next Initiative Count`
        : "";
      const inputs = list
        .map(
          advantage =>
            `<label title="${esc(advantage.summary)} ${esc(advantage.repeat ?? "")}">${esc(advantage.name)} — ${esc(advantage.summary)} <input type="number" name="pick-${advantage.id}" min="0" max="${allowed}" value="0" /></label>`
        )
        .join("");
      const input = await ask(
        loc`${conflict.name}: ${sideName(conflict, conflict.pending.winner)} chooses ${allowed} Advantage(s)`,
        `
        <p>${loc`Enter how many times each Advantage is chosen (total 1 to ${allowed}).`}</p>${inputs}
        <label>${loc`Override the Lead change (leave blank to use the printed rule)`} <input type="number" name="leadShift" min="0" /></label>
        ${canSpend ? `<label><input type="checkbox" name="spendSmash" /> ${loc`Spend 1 of ${smashNow.points} Smash points to ${spendLabel} (p.365)`}</label>` : ""}`
      );
      if (!input) return null;
      const picks = list.flatMap(advantage =>
        Array(Math.max(0, Number(input[`pick-${advantage.id}`]) || 0)).fill(advantage.id)
      );
      let next = chooseAdvantages(conflict, picks, {
        leadShift:
          input.leadShift === "" || input.leadShift === null || input.leadShift === undefined
            ? null
            : Number(input.leadShift)
      });
      if (canSpend && input.spendSmash && !next.winner) {
        const spent = spendSmash(next.chase.smash, next.lead);
        if (spent.lead !== next.lead) next = adjustLead(next, spent.lead);
        next.chase = { ...next.chase, smash: spent.smash };
        await say(`<b>${esc(conflict.name)}</b>: ${esc(sideName(next, smashNow.side))} — ${esc(spent.note)}`);
      }
      await saveConflict(id, next);
      const last = next.history.at(-1);
      await say(
        `<b>${esc(conflict.name)}</b>${loc`: ${esc(last.advantages.map(pick => list.find(advantage => advantage.id === pick).name).join(", "))}. Lead`} <b>${next.lead}</b>.${last.notes?.length ? `<br>${last.notes.map(esc).join("<br>")}` : ""}`
      );
      if (next.winner) return announceEnd(id, next);
      if (rules.outsideActions) await say(`Outside actions: ${esc(rules.outsideActions)}`, true);
      return next;
    }
    if (conflict.step === "outside") {
      const next = nextRound(conflict),
        state = chaseState(next);
      if (state) {
        for (const side of ["predator", "prey"]) {
          const r = state.ratings[side];
          if (r) next[side].ratings = { ...next[side].ratings, Acceleration: r.Acceleration, Turning: r.Turning };
          if (state[side]?.kind === "vehicle" && state[side].actor.system.fuel)
            await spendFuel(state[side].actor, { hours: 0, rounds: 1 });
        }
      }
      await saveConflict(id, next);
      await say(
        `<b>${esc(conflict.name)}</b> ${loc`— round ${next.round} (${esc(rules.roundTime)}). Lead ${next.lead}.${state ? ` ${chaseLine(next, state)}.` : ""} Choose Strategies.`}`
      );
      return next;
    }
    return ui.notifications.info(loc`This conflict is over. Remove it when you no longer need the record.`);
  } catch (error) {
    return refuse(error.message);
  }
}

async function announceEnd(id, conflict) {
  const summary = conflictSummary(conflict);
  await say(
    `<b>${esc(conflict.name)}</b> ${loc`ends at Lead ${conflict.lead}: ${conflict.winner === "none" ? "no winner" : `${esc(sideName(conflict, conflict.winner))} (${conflict.winner}) wins`}.${summary.result ? `<br>${esc(summary.result)}` : ""}`}`
  );
  return conflict;
}

const SIDES_WITH_INSTINCTS = conflict =>
  ["predator", "prey"].some(side => (conflict[side].feats ?? []).includes("Driving Instincts"));

/** Concede, correct the Lead, or delete the record. */
export async function manageConflict(id) {
  requireGC();
  const conflict = getConflicts()[id];
  if (!conflict) return null;
  const rules = CONFLICT_TYPES[conflict.type];
  const tables = Object.values(rules.tables ?? {})
    .map(
      table =>
        `<details><summary>${esc(table.title)}</summary><table><tr>${table.columns.map(column => `<th>${esc(column)}</th>`).join("")}</tr>${table.rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</table></details>`
    )
    .join("");
  const input = await ask(
    loc`${conflict.name}: manage`,
    `
    <p>${loc`Round ${conflict.round}, Lead ${conflict.lead}. ${esc((rules.notes ?? []).join(" "))}`}</p>${tables}
    ${conflict.chase ? `<p>${chaseLine(conflict, chaseState(conflict))}.</p>` : ""}
    <label>${loc`Action`} <select name="action">${options(
      [
        ["lead", loc`Set the Lead (outside effect or correction)`],
        ...(conflict.chase
          ? [
              ["room", loc`Change the Maneuvering Room`],
              ["smash", loc`Set Smash points (altitude)`]
            ]
          : []),
        ...(conflict.type === "chase"
          ? ["predator", "prey"].flatMap(side => [
              ...((conflict[side].feats ?? []).includes("Photo Finish")
                ? [
                    [
                      `photoFinish-${side}`,
                      loc`${sideName(conflict, side)}: Photo Finish (all Acceleration and Turning −2)`
                    ]
                  ]
                : []),
              ...((conflict[side].feats ?? []).includes("Driving Instincts") && conflict.step === "strategies"
                ? [
                    [
                      `instinct-${side}`,
                      loc`${sideName(conflict, side)}: Driving Instincts (guess the opponent’s Strategy)`
                    ]
                  ]
                : []),
              ...["Defensive Driving", "Offensive Driving"]
                .filter(
                  feat => (conflict[side].feats ?? []).includes(feat) && !conflict.featUses?.[side]?.includes(feat)
                )
                .map(feat => [`feat-${side}-${feat}`, loc`${sideName(conflict, side)}: ${feat} (once per chase)`])
            ])
          : []),
        ...(["interrogation", "brainwashing"].includes(conflict.type)
          ? [
              ["predator", "Breaking Points"],
              ["prey", "Hold Out"]
            ]
              .filter(([side, feat]) => (conflict[side].feats ?? []).includes(feat))
              .map(([side, feat]) => [
                `pace-${side}`,
                loc`${sideName(conflict, side)}: ${feat} (+1 error range, change this round’s duration)`
              ])
          : []),
        ["concedePredator", `${sideName(conflict, "predator")} concedes`],
        ["concedePrey", `${sideName(conflict, "prey")} concedes`],
        ["remove", loc`Remove this conflict`]
      ],
      "lead"
    )}</select></label>
    <label>${loc`Lead`} <input type="number" name="lead" value="${conflict.lead}" /></label>
    ${
      conflict.type === "chase" && SIDES_WITH_INSTINCTS(conflict)
        ? `<fieldset><legend>${loc`Driving Instincts (p.192)`}</legend><label>${loc`Guessed Strategy`} <select name="instinctGuess">${options(
            CONFLICT_TYPES[conflict.type].strategies.map(entry => [entry.id, entry.name]),
            ""
          )}</select></label><label>${loc`Guessing side’s Chase feats`} <input type="number" name="instinctFeats" min="1" step="1" value="1" /></label></fieldset>`
        : ""
    }
    ${
      conflict.chase
        ? `<label>${loc`Maneuvering Room`} <select name="room">${options(roomRows(), conflict.chase.room)}</select></label>
    <fieldset><legend>${loc`Smash (p.365)`}</legend>
      <p>${loc`A pilot in a powered aircraft at least 200 ft. above every opponent holds 1 Smash point per Lead point to the next highest opponent; a threat on a Maneuver check gains 1 (or costs the holder 1 when someone else scores it).`}</p>
      <label>${loc`Held by`} <select name="smashSide">${options(
        [
          ["", loc`Nobody`],
          ["predator", sideName(conflict, "predator")],
          ["prey", sideName(conflict, "prey")]
        ],
        smashState(conflict.chase.smash)?.side ?? ""
      )}</select></label>
      <label>${loc`Points`} <input type="number" name="smashPoints" min="0" value="${smashState(conflict.chase.smash)?.points ?? conflict.lead}" /></label>
    </fieldset>`
        : ""
    }`
  );
  if (!input) return null;
  try {
    if (input.action === "remove") return saveConflict(id, null);
    if (input.action.startsWith("photoFinish-")) {
      const side = input.action.slice("photoFinish-".length),
        next = photoFinish(conflict, side);
      await saveConflict(id, next);
      return say(
        `<b>${esc(conflict.name)}</b>${loc`: ${esc(sideName(conflict, side))} uses Photo Finish — every participant’s Acceleration and Turning drop by 2 (total −${2 * next.photoFinish}).`}`
      );
    }
    if (input.action.startsWith("pace-")) {
      const side = input.action.slice("pace-".length),
        { next, note } = declarePace(conflict, side);
      await saveConflict(id, next);
      return say(`<b>${esc(conflict.name)}</b>: ${esc(sideName(conflict, side))} — ${esc(note)}`);
    }
    if (input.action.startsWith("instinct-")) {
      const side = input.action.slice("instinct-".length),
        next = guessStrategy(conflict, side, input.instinctGuess, Number(input.instinctFeats));
      await saveConflict(id, next);
      return say(
        `<b>${esc(conflict.name)}</b>: ${esc(sideName(conflict, side))} ${loc`— Driving Instincts guess recorded; it is checked when the Strategies are revealed.`}`
      );
    }
    if (input.action.startsWith("feat-")) {
      const [, side, ...rest] = input.action.split("-"),
        { next, note } = useConflictFeat(conflict, side, rest.join("-"));
      await saveConflict(id, next);
      return say(`<b>${esc(conflict.name)}</b>: ${esc(sideName(conflict, side))} — ${esc(note)}`);
    }
    if (input.action === "smash") {
      const next = structuredClone(conflict),
        side = input.smashSide || "";
      const source = side ? chaseSource(conflict.chase[side]) : null;
      if (source && !(source.kind === "vehicle" && smashEligible(source.system)))
        return refuse(loc`Only a pilot in a powered aircraft can hold Smash points.`);
      next.chase.smash = side ? smashState({ side, points: Number(input.smashPoints) }) : null;
      await saveConflict(id, next);
      return say(`<b>${esc(conflict.name)}</b>: ${chaseLine(next, chaseState(next))}.`);
    }
    if (input.action === "room") {
      const next = structuredClone(conflict);
      next.chase.room = input.room;
      await saveConflict(id, next);
      return say(`<b>${esc(conflict.name)}</b>: ${chaseLine(next, chaseState(next))}.`);
    }
    const next =
      input.action === "lead"
        ? adjustLead(conflict, Number(input.lead))
        : concede(conflict, input.action === "concedePredator" ? "predator" : "prey");
    await saveConflict(id, next);
    if (next.winner) await announceEnd(id, next);
    else await say(`<b>${esc(conflict.name)}</b>${loc`: Lead set to ${next.lead}.`}`);
    return next;
  } catch (error) {
    return refuse(error.message);
  }
}
