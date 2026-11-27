/**
 * Undo for a step that wrote to characters. The step runs between two pictures of each character; what differs is
 * kept on a short note in chat, whispered to whoever did it, with an Undo button that puts the earlier values back.
 * Only what changed is stored, and Undo warns first when a value has moved again since.
 */
import { loc } from "../i18n.mjs";
import { esc } from "../html.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { undoHook } from "../documents/undo-hook.mjs";

// An empty record is a value too: without it, a record the step created could not be told from one it filled.
const leaf = value => value === null || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length;

/** A nested object as dotted paths; arrays, null and empty records count as values. */
export function flatten(object, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(object ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (leaf(value)) out[path] = value;
    else flatten(value, path, out);
  }
  return out;
}

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

const under = (map, path) => Object.keys(map).filter(key => key.startsWith(`${path}.`));
/** The nested value at `path`, rebuilt from the flat paths below it. */
const rebuilt = (map, path) => {
  const out = {};
  for (const key of under(map, path)) {
    const keys = key.slice(path.length + 1).split(".");
    let target = out;
    for (const part of keys.slice(0, -1)) target = target[part] ??= {};
    target[keys.at(-1)] = map[key];
  }
  return out;
};

/**
 * The shallowest part of `path` that did not exist before the step. A record the step created is removed at its own
 * key: removing only its values would leave an empty shell behind, which a later reader takes for a damaged record.
 */
const newRoot = (before, path) => {
  const keys = path.split(".");
  for (let depth = 1; depth < keys.length; depth++) {
    const top = keys.slice(0, depth).join(".");
    if (!(top in before) && !under(before, top).length) return top;
  }
  return path;
};

/**
 * What it takes to turn `after` back into `before`, both flat maps of path to value.
 * @returns {{restore: object, unset: string[], expect: object, whole: string[]}}  `restore` holds the earlier
 *   values, `unset` the paths that did not exist before, and `expect` the values the step left, to notice later
 *   changes. `whole` lists restored paths that changed kind (an empty record that was filled, or the reverse):
 *   those are replaced outright, because one update cannot both clear a record and remove its parts.
 */
export function differences(before, after) {
  const restore = {},
    unset = [],
    expect = {},
    whole = [];
  // A value on one side and a record with parts on the other: handled once, at the shallower path.
  const filled = Object.keys(before).filter(path => !(path in after) && under(after, path).length),
    emptied = Object.keys(after).filter(path => !(path in before) && under(before, path).length);
  const covered = path => [...filled, ...emptied].some(top => path.startsWith(`${top}.`));
  const emptyRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
  for (const path of filled) {
    for (const key of under(after, path)) expect[key] = after[key];
    // An empty record that gained parts: each new part is removed at its own key and the record stays.
    if (emptyRecord(before[path])) {
      for (const key of under(after, path)) unset.push(`${path}.${key.slice(path.length + 1).split(".")[0]}`);
      continue;
    }
    restore[path] = before[path];
    whole.push(path);
  }
  for (const path of emptied) {
    restore[path] = rebuilt(before, path);
    whole.push(path);
    expect[path] = after[path];
  }
  for (const path of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (filled.includes(path) || emptied.includes(path) || covered(path)) continue;
    if (same(before[path], after[path])) continue;
    if (path in before) restore[path] = before[path];
    else unset.push(newRoot(before, path));
    if (path in after) expect[path] = after[path];
  }
  return { restore, unset: [...new Set(unset)], expect, whole };
}

const combatantsOf = actor =>
  [...(globalThis.game?.combats ?? [])].flatMap(combat =>
    [...combat.combatants].filter(combatant => combatant.actor?.uuid === actor.uuid)
  );

/** A picture of everything a step may change about one character. */
export function snapshot(actor) {
  const source = actor.toObject?.() ?? { system: actor.system, flags: actor.flags };
  return {
    data: flatten({ system: source.system ?? {}, flags: { spycraft2: source.flags?.spycraft2 ?? {} } }),
    effects: new Map([...(actor.effects ?? [])].map(effect => [effect.id, effect.toObject?.() ?? { ...effect }])),
    combatants: combatantsOf(actor).map(combatant => ({
      combat: combatant.parent?.id,
      id: combatant.id,
      defeated: !!combatant.defeated,
      initiative: combatant.initiative ?? null,
      // Damage can record a fluid initiative event on the combatant; Undo takes that back too.
      fluid: structuredClone(combatant.flags?.spycraft2?.fluid ?? null)
    }))
  };
}

/** The undo record for one character, or null when the step left it as it was. */
export function undoEntry(actor, before, after) {
  const { restore, unset, expect, whole } = differences(before.data, after.data);
  const created = [...after.effects.keys()].filter(id => !before.effects.has(id)),
    removed = [...before.effects].filter(([id]) => !after.effects.has(id)).map(([, data]) => data);
  const combatants = before.combatants.filter(was => {
    const now = after.combatants.find(entry => entry.id === was.id && entry.combat === was.combat);
    return now && (now.defeated !== was.defeated || now.initiative !== was.initiative || !same(now.fluid, was.fluid));
  });
  if (!Object.keys(restore).length && !unset.length && !created.length && !removed.length && !combatants.length)
    return null;
  // Stored as pairs: a chat message expands dotted keys in its flags, which would turn each path into a nest.
  return {
    uuid: actor.uuid,
    name: actor.name,
    restore: Object.entries(restore),
    unset,
    expect: Object.entries(expect),
    whole,
    created,
    removed,
    combatants
  };
}

/** A stored map as [path, value] pairs, whether it was kept as pairs or as an object. */
const pairs = value => (Array.isArray(value) ? value : Object.entries(flatten(value ?? {})));

const valueAt = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);

/** Paths the step set that hold something else now: a later change that Undo would overwrite. */
export function movedSince(entry, source) {
  return pairs(entry.expect)
    .filter(([path, value]) => !same(valueAt(source, path), value))
    .map(([path]) => path);
}

const POOLS = ["vitality", "wounds"];
/**
 * Vitality and wounds that moved again after the step (a maximum followed a new Threat Level, or more damage came
 * in): Undo gives back what the step took, counted from where the pool stands now, instead of the old number.
 */
export function poolsGivenBack(entry, actor) {
  const out = {},
    restore = new Map(pairs(entry.restore)),
    expect = new Map(pairs(entry.expect));
  for (const pool of POOLS) {
    const path = `system.${pool}.value`,
      was = restore.get(path),
      left = expect.get(path),
      now = actor.system?.[pool]?.value,
      max = actor.system?.[pool]?.max;
    if (![was, left, now].every(Number.isFinite) || now === left) continue;
    const back = now + (was - left);
    out[path] = Number.isFinite(max) && was <= max ? Math.min(back, Math.max(max, now)) : back;
  }
  return out;
}

/** The update that puts one character back. A path that did not exist before is removed. */
export function restoreUpdate(entry) {
  const update = {},
    keyed = (path, mark) => {
      const cut = path.lastIndexOf(".");
      return `${path.slice(0, cut + 1)}${mark}${path.slice(cut + 1)}`;
    };
  for (const [path, value] of pairs(entry.restore))
    update[(entry.whole ?? []).includes(path) ? keyed(path, "==") : path] = value;
  for (const path of entry.unset ?? []) update[keyed(path, "-=")] = null;
  return update;
}

/**
 * Run a step that may write to these characters, then leave an Undo note if it changed any of them.
 * @param {object[]} actors
 * @param {string} label           What the step was, as the note will say it
 * @param {() => Promise<any>} work
 * @param {object} [extra]         { gcDice: dice to give back, damageCard: {messageId, targetUuid},
 *   cardMarks: [{messageId, key}] marks the step set on a card, cleared so the card's button works again }
 */
export async function withUndo(actors, label, work, extra = {}) {
  const list = (actors ?? []).filter(actor => actor?.uuid);
  const before = list.map(snapshot);
  const result = await work();
  try {
    const entries = list.map((actor, index) => undoEntry(actor, before[index], snapshot(actor))).filter(Boolean);
    const more = typeof extra === "function" ? extra(result) : extra;
    if (entries.length || more?.gcDice) await postUndo(label, entries, more ?? {});
  } catch (error) {
    console.warn("Field Agent's Handbook | No Undo note could be left for this step.", error);
  }
  return result;
}
// A document step (a mission XP settlement) leaves its Undo note through this.
undoHook.run = withUndo;

/** Leave the Undo note: one line, seen only by whoever took the step. */
export function postUndo(
  label,
  entries,
  {
    gcDice = 0,
    damageCard = null,
    antagonist = null,
    dcBoost = null,
    standingPaid = null,
    cardMarks = null,
    addedInfractions = null,
    missionRow = null
  } = {}
) {
  return ChatMessage.create({
    speaker: { alias: loc`Undo` },
    // The GC sees every note, so a step a player took can be undone by the GC too.
    whisper: [...new Set([game.user.id, ...(ChatMessage.getWhisperRecipients?.("GM") ?? []).map(user => user.id)])],
    content: `<div class="spycraft2 chat-note sc2-undo-note"><p>${esc(label)}</p></div>`,
    flags: {
      spycraft2: {
        undo: {
          label,
          entries,
          gcDice,
          damageCard,
          antagonist,
          dcBoost,
          standingPaid,
          cardMarks,
          addedInfractions,
          missionRow,
          done: false
        }
      }
    }
  });
}

const running = new Set();
/** Put everything on a note back. Returns the names restored, or null when the GC backs out. */
export async function applyUndo(message) {
  const record = message?.flags?.spycraft2?.undo;
  if (!record || record.done) return null;
  // One note is undone once, however many copies of its button are pressed.
  const key = message.id ?? message;
  if (running.has(key)) return null;
  running.add(key);
  try {
    return await undoRecord(message, record);
  } finally {
    running.delete(key);
  }
}

async function undoRecord(message, record) {
  const targets = [];
  for (const entry of record.entries ?? []) {
    const actor = await fromUuid(entry.uuid);
    if (!actor) {
      // A character deleted since has nothing to put back; the rest of the step is still undone.
      ui.notifications.warn(loc`${entry.name} no longer exists, so it is skipped.`);
      continue;
    }
    if (!actor.isOwner) {
      ui.notifications.warn(loc`${entry.name} can no longer be changed from here.`);
      return null;
    }
    targets.push([entry, actor]);
  }
  const moved = targets.filter(([entry, actor]) => movedSince(entry, actor.toObject?.() ?? actor).length);
  if (moved.length) {
    const ok = await systemDialog.confirm({
      window: { title: loc`Undo` },
      content: `<p>${loc`${esc(moved.map(([entry]) => entry.name).join(", "))} changed again after this step. Undo gives back the vitality and wounds the step took, and sets anything else it changed to its value from before the step.`}</p>`,
      yes: { label: loc`Undo anyway` },
      no: { label: loc`Cancel` },
      rejectClose: false
    });
    if (!ok) return null;
  }
  // Marked first, so a failure half way cannot lead to dice being given back twice on a retry.
  await message.update({ "flags.spycraft2.undo.done": true });
  for (const [entry, actor] of targets) {
    const update = restoreUpdate(entry);
    Object.assign(update, poolsGivenBack(entry, actor));
    if (Object.keys(update).length) await actor.update(update);
    const made = (entry.created ?? []).filter(id => actor.effects?.get?.(id));
    if (made.length) await actor.deleteEmbeddedDocuments("ActiveEffect", made);
    const gone = (entry.removed ?? []).filter(data => !actor.effects?.get?.(data._id));
    if (gone.length) await actor.createEmbeddedDocuments("ActiveEffect", gone, { keepId: true });
    for (const was of entry.combatants ?? []) {
      const combatant = game.combats?.get(was.combat)?.combatants.get(was.id);
      if (!combatant) continue;
      const change = { defeated: was.defeated, initiative: was.initiative };
      if ("fluid" in was) change[was.fluid ? "flags.spycraft2.==fluid" : "flags.spycraft2.-=fluid"] = was.fluid;
      await combatant.update(change);
    }
  }
  if (record.gcDice > 0 && game.user.isGM) {
    const { adjustGCDice } = await import("../services/gc-dice.mjs");
    // A new session has its own pool: the characters are still put back, and the GC is told about the dice.
    await adjustGCDice(record.gcDice, loc`Undo: ${record.label}`).catch(error =>
      ui.notifications.warn(loc`The GC action dice were not given back: ${error.message}`)
    );
  }
  // A promotion's antagonist row goes back to what it was; the rest of the mission's list is left alone.
  // Only within the run of the mission that promoted: a later run keeps its own row as it is.
  if (record.antagonist?.id && game.user.isGM) {
    const { getMission, updateMission, missionEpoch } = await import("./gc/state.mjs");
    const { id, entry: was, period } = record.antagonist,
      mine = entry => entry.id === id;
    if (period !== undefined && period !== missionEpoch())
      ui.notifications.warn(
        loc`The NPC was put back, but a later mission has begun, so its antagonist row was left as it is.`
      );
    else if ((getMission().antagonists ?? []).some(mine))
      await updateMission(now => ({
        antagonists: was
          ? now.antagonists.map(entry => (mine(entry) ? was : entry))
          : now.antagonists.filter(entry => !mine(entry))
      })).catch(error => ui.notifications.warn(loc`The antagonist list was not put back: ${error.message}`));
  }
  // A standing payout's paid marks go back to what they were, so those agents can be paid again.
  // Only within the mission that paid: once a later mission has begun, its own marks are left as they are.
  const standing = record.standingPaid;
  if (standing?.marks && Object.keys(standing.marks).length && game.user.isGM) {
    const { updateMission, missionEpoch } = await import("./gc/state.mjs");
    if (standing.period !== missionEpoch())
      ui.notifications.warn(
        loc`The standing was given back, but a later mission has begun, so its paid marks were left as they are.`
      );
    else
      await updateMission(now => {
        const paid = { ...(now.standingPaid ?? {}) };
        for (const [id, was] of Object.entries(standing.marks)) {
          if (was) paid[id] = was;
          else delete paid[id];
        }
        return { standingPaid: paid };
      }).catch(error => ui.notifications.warn(loc`The standing paid marks were not put back: ${error.message}`));
  }
  // Exposure rows the step added come off the mission record, within the mission that added them; rows added
  // before or since are kept.
  const added = record.addedInfractions;
  if (added?.ids?.length && game.user.isGM) {
    const { updateMission, missionEpoch } = await import("./gc/state.mjs");
    if (added.period === missionEpoch())
      await updateMission(now => ({
        infractions: (now.infractions ?? []).filter(entry => !added.ids.includes(entry?.id))
      })).catch(error => ui.notifications.warn(loc`The exposure rows were not taken off: ${error.message}`));
  }
  // A row taken off the mission record goes back where it was, within the run of the mission that removed it.
  const row = record.missionRow;
  if (row?.list && row.entry && game.user.isGM) {
    const { updateMission, missionEpoch } = await import("./gc/state.mjs");
    const same = entry => (entry?.key ?? entry?.id) === row.key;
    if (row.period !== missionEpoch())
      ui.notifications.warn(loc`A later mission has begun, so the removed row was not put back.`);
    else
      await updateMission(now => {
        const rows = [...(now[row.list] ?? [])];
        if (rows.some(same)) return {};
        rows.splice(Math.min(Number(row.index) || 0, rows.length), 0, row.entry);
        return { [row.list]: rows };
      }).catch(error => ui.notifications.warn(loc`The mission row was not put back: ${error.message}`));
  }
  // A DC boost counted against its check in this scene is taken off that check's count; other checks are left alone.
  if (record.dcBoost?.key && game.user.isGM) {
    const { getSceneState, setSceneState } = await import("./gc/state.mjs");
    const scene = getSceneState(),
      counted = scene.dcBoostsByCheck?.[record.dcBoost.key];
    if (scene.scene === record.dcBoost.scene && counted?.count > 0)
      await setSceneState({
        dcBoostsByCheck: { ...scene.dcBoostsByCheck, [record.dcBoost.key]: { ...counted, count: counted.count - 1 } }
      }).catch(error => ui.notifications.warn(loc`The DC boost count was not put back: ${error.message}`));
  }
  // A step that marked a card done (First Aid applied, a grapple settled) can be taken on that card again.
  for (const mark of record.cardMarks ?? []) {
    const marked = mark?.messageId && mark.key ? game.messages?.get(mark.messageId) : null;
    if (!marked || !(marked.isAuthor || game.user.isGM)) continue;
    const keys = String(mark.key).split("."),
      last = keys.pop(),
      holder = keys.reduce((value, key) => value?.[key], marked.flags?.spycraft2);
    if (holder?.[last] !== undefined)
      await marked.update({ [`flags.spycraft2.${[...keys, `-=${last}`].join(".")}`]: null }).catch(() => null);
  }
  // The damage card may be applied to that target again.
  const card = record.damageCard ? game.messages?.get(record.damageCard.messageId) : null;
  if (card && (card.isAuthor || game.user.isGM)) {
    const marks = Object.entries(card.flags?.spycraft2?.damageAppliedBy ?? {}).filter(
      ([, entry]) => entry?.targetUuid === record.damageCard.targetUuid
    );
    // Only the newest mark for that target goes: an earlier application of the same card stays recorded.
    const last = marks.at(-1);
    if (last) await card.update({ [`flags.spycraft2.damageAppliedBy.-=${last[0]}`]: null }).catch(() => null);
  }
  return targets.map(([entry]) => entry.name);
}

/** The Undo button on a note (the `renderChatMessageHTML` hook). */
export function renderUndo(message, html) {
  const record = message.flags?.spycraft2?.undo;
  if (!record || !(message.isAuthor || game.user?.isGM)) return;
  const row = document.createElement("div");
  row.className = "spycraft2 roll-controls";
  if (record.done) {
    const note = document.createElement("p");
    note.className = "hint";
    note.setAttribute("role", "status");
    note.textContent = loc`Undone.`;
    row.append(note);
  } else {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sc2-quiet-action";
    button.textContent = loc`Undo`;
    // Several notes each carry a button: its name says which step it takes back.
    button.setAttribute("aria-label", loc`Undo: ${record.label}`);
    button.dataset.tooltip = loc`Puts back what this step changed${record.gcDice ? loc` and returns ${record.gcDice} GC action di${record.gcDice === 1 ? "e" : "ce"}` : ""}`;
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const names = await applyUndo(message);
        if (names) ui.notifications.info(loc`Undone: ${record.label}`);
        else button.disabled = false;
      } catch (error) {
        button.disabled = false;
        ui.notifications.warn(loc`Undo could not finish: ${error.message}`);
      }
    });
    row.append(button);
  }
  html.append(row);
}

export function installUndo() {
  Hooks.on("renderChatMessageHTML", renderUndo);
}
