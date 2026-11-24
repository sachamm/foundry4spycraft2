/**
 * Undo for a step that wrote to characters. The step runs between two pictures of each character; what differs is
 * kept on a short note in chat, whispered to whoever did it, with an Undo button that puts the earlier values back.
 * Only what changed is stored, and Undo warns first when a value has moved again since.
 */
import { loc } from "../i18n.mjs";
import { esc } from "../html.mjs";
import { systemDialog } from "./dialog-theme.mjs";

const leaf = value => value === null || typeof value !== "object" || Array.isArray(value);

/** A nested object as dotted paths; arrays and null count as values. */
export function flatten(object, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(object ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (leaf(value)) out[path] = value;
    else flatten(value, path, out);
  }
  return out;
}

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * What it takes to turn `after` back into `before`, both flat maps of path to value.
 * @returns {{restore: object, unset: string[], expect: object}}  `restore` holds the earlier values, `unset` the
 *   paths that did not exist before, and `expect` the values the step left, to notice later changes.
 */
export function differences(before, after) {
  const restore = {},
    unset = [],
    expect = {};
  for (const path of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (same(before[path], after[path])) continue;
    if (path in before) restore[path] = before[path];
    else unset.push(path);
    if (path in after) expect[path] = after[path];
  }
  return { restore, unset, expect };
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
      initiative: combatant.initiative ?? null
    }))
  };
}

/** The undo record for one character, or null when the step left it as it was. */
export function undoEntry(actor, before, after) {
  const { restore, unset, expect } = differences(before.data, after.data);
  const created = [...after.effects.keys()].filter(id => !before.effects.has(id)),
    removed = [...before.effects].filter(([id]) => !after.effects.has(id)).map(([, data]) => data);
  const combatants = before.combatants.filter(was => {
    const now = after.combatants.find(entry => entry.id === was.id && entry.combat === was.combat);
    return now && (now.defeated !== was.defeated || now.initiative !== was.initiative);
  });
  if (!Object.keys(restore).length && !unset.length && !created.length && !removed.length && !combatants.length)
    return null;
  return { uuid: actor.uuid, name: actor.name, restore, unset, expect, created, removed, combatants };
}

const valueAt = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);

/** Paths the step set that hold something else now: a later change that Undo would overwrite. */
export function movedSince(entry, source) {
  return Object.entries(entry.expect ?? {})
    .filter(([path, value]) => !same(valueAt(source, path), value))
    .map(([path]) => path);
}

/** The update that puts one character back. A path that did not exist before is removed. */
export function restoreUpdate(entry) {
  const update = { ...entry.restore };
  for (const path of entry.unset ?? []) {
    const cut = path.lastIndexOf(".");
    update[`${path.slice(0, cut)}.-=${path.slice(cut + 1)}`] = null;
  }
  return update;
}

/**
 * Run a step that may write to these characters, then leave an Undo note if it changed any of them.
 * @param {object[]} actors
 * @param {string} label           What the step was, as the note will say it
 * @param {() => Promise<any>} work
 * @param {object} [extra]         { gcDice: dice to give back, damageCard: {messageId, targetUuid} }
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

/** Leave the Undo note: one line, seen only by whoever took the step. */
export function postUndo(label, entries, { gcDice = 0, damageCard = null } = {}) {
  return ChatMessage.create({
    speaker: { alias: loc`Undo` },
    whisper: [game.user.id],
    content: `<div class="spycraft2 chat-note sc2-undo-note"><p>${esc(label)}</p></div>`,
    flags: { spycraft2: { undo: { label, entries, gcDice, damageCard, done: false } } }
  });
}

/** Put everything on a note back. Returns the names restored, or null when the GC backs out. */
export async function applyUndo(message) {
  const record = message?.flags?.spycraft2?.undo;
  if (!record || record.done) return null;
  const targets = [];
  for (const entry of record.entries ?? []) {
    const actor = await fromUuid(entry.uuid);
    if (!actor?.isOwner) {
      ui.notifications.warn(loc`${entry.name} can no longer be changed from here.`);
      return null;
    }
    targets.push([entry, actor]);
  }
  const moved = targets.filter(([entry, actor]) => movedSince(entry, actor.toObject?.() ?? actor).length);
  if (moved.length) {
    const ok = await systemDialog.confirm({
      window: { title: loc`Undo` },
      content: `<p>${loc`${esc(moved.map(([entry]) => entry.name).join(", "))} changed again after this step. Undo puts back the values from before the step and drops the later change to the same numbers.`}</p>`,
      yes: { label: loc`Undo anyway` },
      no: { label: loc`Cancel` },
      rejectClose: false
    });
    if (!ok) return null;
  }
  for (const [entry, actor] of targets) {
    const update = restoreUpdate(entry);
    if (Object.keys(update).length) await actor.update(update);
    const made = (entry.created ?? []).filter(id => actor.effects?.get?.(id));
    if (made.length) await actor.deleteEmbeddedDocuments("ActiveEffect", made);
    const gone = (entry.removed ?? []).filter(data => !actor.effects?.get?.(data._id));
    if (gone.length) await actor.createEmbeddedDocuments("ActiveEffect", gone, { keepId: true });
    for (const was of entry.combatants ?? []) {
      const combatant = game.combats?.get(was.combat)?.combatants.get(was.id);
      if (combatant) await combatant.update({ defeated: was.defeated, initiative: was.initiative });
    }
  }
  if (record.gcDice > 0 && game.user.isGM) {
    const { adjustGCDice } = await import("../services/gc-dice.mjs");
    await adjustGCDice(record.gcDice, loc`Undo: ${record.label}`);
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
  await message.update({ "flags.spycraft2.undo.done": true });
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
    note.textContent = loc`Undone.`;
    row.append(note);
  } else {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = loc`Undo`;
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
