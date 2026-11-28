/**
 * Undo for a step that wrote to characters. The step runs between two pictures of each character; what differs is
 * kept on a short note in chat, whispered to whoever did it, with an Undo button that puts the earlier values back.
 * Only what changed is stored, and Undo warns first when a value has moved again since.
 */
import { loc } from "../i18n.mjs";
import { esc } from "../html.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { readSetting } from "../settings.mjs";
import { queueResources } from "../services/transactions.mjs";
import { setDamageUndo } from "../documents/actor/damage-applications.mjs";
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
const hasGCSession = record => typeof record?.gcDiceSession === "string" && record.gcDiceSession.trim().length > 0;

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

const COMBATANT_FLAGS = ["fluid", "actions", "readied", "initiativeBoost", "defeatedByDamageSave"];
const COMBATANT_FIELDS = ["defeated", "initiative", ...COMBATANT_FLAGS];

const combatantsOf = actor =>
  [...(globalThis.game?.combats ?? [])].flatMap(combat =>
    [...combat.combatants].filter(combatant => combatant.actor?.uuid === actor.uuid)
  );

/** A picture of everything a step may change about one character. */
export function snapshot(actor) {
  const source = actor.toObject?.() ?? { system: actor.system, flags: actor.flags };
  const undoFlags = { ...source.flags?.spycraft2 };
  delete undoFlags.damageApplications;
  delete undoFlags.hazardResolutions;
  delete undoFlags.attackDamageHits;
  delete undoFlags.countShifts;
  delete undoFlags.fallTimelines;
  delete undoFlags.activeFallId;
  return {
    data: flatten({ system: source.system ?? {}, flags: { spycraft2: undoFlags } }),
    effects: new Map([...(actor.effects ?? [])].map(effect => [effect.id, effect.toObject?.() ?? { ...effect }])),
    combatants: combatantsOf(actor).map(combatant => ({
      combat: combatant.parent?.id,
      id: combatant.id,
      defeated: !!combatant.defeated,
      initiative: combatant.initiative ?? null,
      // The combatant's own flags a step may write: a fluid initiative event from damage, the turn's half actions and a
      // readied action, an action die spent on the Count, and a defeat a damage save marked.
      ...Object.fromEntries(
        COMBATANT_FLAGS.map(key => [key, structuredClone(combatant.flags?.spycraft2?.[key] ?? null)])
      )
    }))
  };
}

const combatantNow = (combatant, key) =>
  key === "defeated"
    ? !!combatant.defeated
    : key === "initiative"
      ? (combatant.initiative ?? null)
      : (combatant.flags?.spycraft2?.[key] ?? null);

/** The undo record for one character, or null when the step left it as it was. */
export function undoEntry(actor, before, after) {
  const { restore, unset, expect, whole } = differences(before.data, after.data);
  const created = [...after.effects.keys()].filter(id => !before.effects.has(id)),
    removed = [...before.effects].filter(([id]) => !after.effects.has(id)).map(([, data]) => data);
  const combatants = before.combatants
    .filter(was => {
      const now = after.combatants.find(entry => entry.id === was.id && entry.combat === was.combat);
      return now && COMBATANT_FIELDS.some(key => !same(now[key] ?? null, was[key] ?? null));
    })
    // Only the fields this step changed are kept, with what it left them at: Undo puts back those alone, and only while
    // nothing changed them since, so a later Spend, Count change or defeat stays.
    .map(was => {
      const now = after.combatants.find(entry => entry.id === was.id && entry.combat === was.combat),
        entry = { combat: was.combat, id: was.id },
        left = {};
      for (const key of COMBATANT_FIELDS)
        if (!same(now?.[key] ?? null, was[key] ?? null)) {
          entry[key] = was[key] ?? null;
          left[key] = structuredClone(now?.[key] ?? null);
        }
      entry.left = left;
      return entry;
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
  let result,
    failure = null;
  try {
    result = await work();
  } catch (error) {
    failure = error;
  }
  try {
    const entries = list.map((actor, index) => undoEntry(actor, before[index], snapshot(actor))).filter(Boolean);
    // A step that failed part way still leaves a note for what it did write, without the extras it never reached.
    const more = failure ? {} : typeof extra === "function" ? extra(result) : extra;
    const named = failure ? loc`${label} (stopped part way)` : label;
    if (entries.length || more?.gcDice || more?.missionCaliber) await postUndo(named, entries, more ?? {});
  } catch (error) {
    console.warn("Field Agent's Handbook | No Undo note could be left for this step.", error);
  }
  if (failure) throw failure;
  return result;
}
// A document step (a mission XP settlement) leaves its Undo note through this.
undoHook.run = withUndo;

/** The value a card mark holds now, or undefined. */
function markValue(mark) {
  const card = mark?.messageId ? globalThis.game?.messages?.get?.(mark.messageId) : null;
  return String(mark?.key ?? "")
    .split(".")
    .reduce((value, key) => value?.[key], card?.flags?.spycraft2);
}

/** Leave the Undo note: one line, seen only by whoever took the step. */
export function postUndo(
  label,
  entries,
  {
    gcDice = 0,
    damageCard = null,
    gcDiceSession,
    gcDefenseDeliveryUuid,
    npcHitDefenseUndo,
    declaredDCUndo,
    damageApplicationUndo,
    antagonist = null,
    dcBoost = null,
    standingPaid = null,
    cardMarks = null,
    addedInfractions = null,
    missionRow = null,
    placedTokens = null,
    combatSurprise = null,
    closeSaves = null,
    missionCaliber = null
  } = {}
) {
  return ChatMessage.create({
    speaker: { alias: loc`Undo` },
    // A player's note also goes to the GC, who can undo it too; a GC's note stays with that GC, so in a world with two
    // GCs neither is offered the other's steps.
    whisper: game.user.isGM
      ? [game.user.id]
      : [...new Set([game.user.id, ...(ChatMessage.getWhisperRecipients?.("GM") ?? []).map(user => user.id)])],
    content: `<div class="spycraft2 chat-note sc2-undo-note"><p>${esc(label)}</p></div>`,
    flags: {
      spycraft2: {
        undo: {
          label,
          entries,
          gcDice,
          damageCard,
          ...(damageApplicationUndo ? { damageApplicationUndo } : {}),
          done: false,
          ...(gcDice > 0
            ? { gcDiceSession: gcDiceSession ?? String(readSetting("usagePeriods", {})?.session ?? "initial") }
            : {}),
          ...(gcDefenseDeliveryUuid ? { gcDefenseDeliveryUuid } : {}),
          ...(npcHitDefenseUndo ? { npcHitDefenseUndo } : {}),
          ...(declaredDCUndo ? { declaredDCUndo } : {}),
          antagonist,
          dcBoost,
          standingPaid,
          // Each mark with the value the step left, so Undo clears it only while no later step has set it again.
          cardMarks: (cardMarks ?? null)?.map?.(mark => ({ ...mark, left: markValue(mark) })) ?? null,
          addedInfractions,
          missionRow,
          placedTokens,
          combatSurprise,
          closeSaves,
          missionCaliber
        }
      }
    }
  });
}

const running = new Set();
const chatDocument = uuid => {
  try {
    return globalThis.fromUuidSync?.(uuid) ?? game.messages?.get?.(String(uuid).split(".").at(-1));
  } catch {
    return null;
  }
};
export function npcHitDefenseUndoReason(record) {
  const change = record?.npcHitDefenseUndo;
  if (!change) return "";
  if (!game.user?.isGM) return loc`The GC reviews a pending NPC Defense die.`;
  const attack = chatDocument(change.attackUuid),
    check = attack?.flags?.spycraft2,
    pending = check?.npcDefensePending;
  return !attack?.isOwner ||
    check.resolved ||
    pending?.state !== "pending" ||
    pending.id !== change.reviewId ||
    !same(pending, change.after)
    ? loc`Only the latest Defense die on this still-pending attack can be undone. Undo later dice first; completed outcomes need GC review.`
    : "";
}
export function declaredDCUndoReason(record) {
  const change = record?.declaredDCUndo;
  if (!change) return "";
  if (!game.user?.isGM) return loc`Only the GC can undo a declared DC.`;
  const actor = chatDocument(change.actorUuid),
    source = chatDocument(change.sourceUuid),
    marker = actor?.flags?.spycraft2?.declaredDCs?.[change.id],
    dc = source?.flags?.spycraft2?.declaredDC;
  return !actor?.isOwner ||
    !source?.isOwner ||
    marker?.sourceUuid !== change.sourceUuid ||
    marker?.state !== "available" ||
    dc?.id !== change.id ||
    dc.state !== "ready"
    ? loc`Only an unused DC declaration can be undone. A claimed check needs GC review.`
    : "";
}
function updateNpcUndoButtons() {
  for (const button of globalThis.document?.querySelectorAll?.("[data-npc-hit-undo-note]") ?? []) {
    const record = chatDocument(button.dataset.npcHitUndoNote)?.flags?.spycraft2?.undo;
    const reason = record?.done ? loc`Already undone.` : npcHitDefenseUndoReason(record);
    button.disabled = !!reason;
    button.dataset.tooltip =
      reason || loc`Undo this pending Defense die and return its GC payment when it belongs to the current session.`;
  }
  for (const button of globalThis.document?.querySelectorAll?.("[data-declared-dc-undo-note]") ?? []) {
    const record = chatDocument(button.dataset.declaredDcUndoNote)?.flags?.spycraft2?.undo,
      reason = !record || record.done ? loc`Already undone or unavailable.` : declaredDCUndoReason(record);
    button.disabled = !!reason;
    button.dataset.tooltip = reason || loc`Undo this unused DC declaration and refund its same-session payment.`;
  }
}
/** Put everything on a note back. Returns the names restored, or null when the GC backs out. */
export async function applyUndo(message) {
  const record = message?.flags?.spycraft2?.undo;
  if (!record || record.done) return null;
  // One note is undone once, however many copies of its button are pressed.
  const key = message.id ?? message;
  if (running.has(key)) return null;
  running.add(key);
  try {
    if (record.damageApplicationUndo) {
      const receipt = record.damageApplicationUndo;
      const actor = await fromUuid(receipt.actorUuid);
      if (!actor?.isOwner) throw Error(loc`Own the damage target to undo its application.`);
      return await queueResources(
        [actor],
        async () => {
          const fresh = message.flags?.spycraft2?.undo;
          if (fresh?.done) return null;
          return undoRecord(message, fresh);
        },
        { messages: [message] }
      );
    }
    if (record.declaredDCUndo) {
      if (!game.user?.isGM) throw Error(loc`Only the GC can undo a declared DC.`);
      const actor = await fromUuid(record.declaredDCUndo.actorUuid),
        source = await fromUuid(record.declaredDCUndo.sourceUuid);
      if (!actor?.isOwner || !source) throw Error(loc`The DC's original character or source is unavailable for Undo.`);
      return await queueResources(
        [actor],
        () => {
          const fresh = message.flags?.spycraft2?.undo;
          return fresh?.done ? null : undoRecord(message, fresh);
        },
        { messages: [message, source] }
      );
    }
    if (record.npcHitDefenseUndo) {
      if (!game.user?.isGM) throw Error(loc`The GC reviews a pending NPC Defense die.`);
      const npc = await fromUuid(record.npcHitDefenseUndo.actorUuid),
        attack = await fromUuid(record.npcHitDefenseUndo.attackUuid);
      if (!npc?.isOwner || !attack) throw Error(loc`The original NPC or attack is unavailable for Undo.`);
      return await queueResources(
        [npc],
        () => {
          const fresh = message.flags?.spycraft2?.undo;
          return fresh?.done ? null : undoRecord(message, fresh);
        },
        { messages: [message, attack] }
      );
    }
    return await undoRecord(message, record);
  } finally {
    running.delete(key);
  }
}

/** Paths a snapshot can hold: anything else on a note was not written by withUndo. */
const restorable = path =>
  typeof path === "string" && (path.startsWith("system.") || path.startsWith("flags.spycraft2."));
/**
 * What a note may ask a GC's client to restore. A note a player posted is only that player's claim: it is held to
 * the characters that player owns and to the character paths a snapshot records, and its mission-wide parts (GC
 * dice, mission rows, placed tokens, scene counts) are left out. A GC's own note is trusted as written.
 */
export function trustedRecord(record, author) {
  if (!author || author.isGM) return record;
  const owned = uuid => {
    const actor = globalThis.fromUuidSync?.(uuid);
    return !!actor?.testUserPermission?.(author, "OWNER");
  };
  const clean = entry => ({
    ...entry,
    restore: pairs(entry.restore).filter(([path]) => restorable(path)),
    expect: pairs(entry.expect).filter(([path]) => restorable(path)),
    unset: (entry.unset ?? []).filter(restorable),
    whole: (entry.whole ?? []).filter(restorable)
  });
  return {
    label: record.label,
    done: record.done,
    entries: (record.entries ?? []).filter(entry => owned(entry.uuid)).map(clean),
    damageCard: record.damageCard ?? null,
    cardMarks: record.cardMarks ?? null,
    closeSaves: record.closeSaves ?? null
  };
}

async function undoRecord(message, record) {
  record = trustedRecord(record, message.author);
  let hitAttack = null;
  let dcSource = null,
    dcActor = null;
  if (record.declaredDCUndo) {
    const reason = declaredDCUndoReason(record);
    if (reason) throw Error(reason);
    dcSource = await fromUuid(record.declaredDCUndo.sourceUuid);
    dcActor = await fromUuid(record.declaredDCUndo.actorUuid);
  }
  if (record.npcHitDefenseUndo) {
    const change = record.npcHitDefenseUndo;
    hitAttack = await fromUuid(change.attackUuid);
    const check = hitAttack?.flags?.spycraft2,
      pending = check?.npcDefensePending;
    if (
      !game.user?.isGM ||
      !hitAttack?.isOwner ||
      check.resolved ||
      pending?.state !== "pending" ||
      pending.id !== change.reviewId ||
      !same(pending, change.after)
    )
      throw Error(
        loc`Only the latest Defense die on this still-pending attack can be undone. Undo later dice first; completed outcomes need GC review.`
      );
  }
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
  if (record.damageApplicationUndo) {
    const receipt = record.damageApplicationUndo;
    await setDamageUndo(await fromUuid(receipt.actorUuid), receipt, "undoing");
  }
  await message.update({ "flags.spycraft2.undo.done": true });
  if (dcSource) {
    const id = record.declaredDCUndo.id;
    await dcSource.update({ "flags.spycraft2.declaredDC.state": "cancelled" });
    await dcActor.update({ [`flags.spycraft2.declaredDCs.${id}.state`]: "cancelled" });
  }
  if (hitAttack) await hitAttack.update({ "flags.spycraft2.npcDefensePending": record.npcHitDefenseUndo.before });
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
      const change = {};
      let moved = false;
      for (const key of COMBATANT_FIELDS) {
        if (!(key in was)) continue;
        // Changed again since the step (a later spend, Count change or defeat): putting the old value back would erase it.
        if (was.left && key in was.left && !same(combatantNow(combatant, key), was.left[key])) {
          moved = true;
          continue;
        }
        if (key === "defeated" || key === "initiative") change[key] = was[key];
        else change[was[key] ? `flags.spycraft2.==${key}` : `flags.spycraft2.-=${key}`] = was[key];
      }
      if (moved)
        ui.notifications.warn(
          loc`${combatant.name} changed again in the fight since, so those later changes were kept.`
        );
      if (Object.keys(change).length) await combatant.update(change);
    }
  }
  if (record.gcDice > 0 && game.user.isGM && !hasGCSession(record)) {
    await message.update({
      "flags.spycraft2.undo.gcDiceRefundReview": { version: 1, state: "needsReview", count: record.gcDice }
    });
    ui.notifications.warn(
      loc`The character was restored. This old Undo note does not identify its GC session; review the original payment before crediting any dice.`
    );
  } else if (
    record.gcDice > 0 &&
    game.user.isGM &&
    record.gcDiceSession !== String(readSetting("usagePeriods", {})?.session ?? "initial")
  ) {
    ui.notifications.warn(
      loc`The character was restored. Its GC dice belong to another session, so the current pool was not credited.`
    );
  } else if (record.gcDice > 0 && game.user.isGM) {
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
        record.placedTokens
          ? loc`The placed tokens were taken off, but a later mission has begun, so the antagonist row was kept.`
          : loc`The NPC was put back, but a later mission has begun, so its antagonist row was left as it is.`
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
  // A Caliber increase: the mission's Caliber goes back and the GC gives up the dice it brought, within the same run
  // and only while no later step has changed the Caliber again.
  const raised = record.missionCaliber;
  if (raised && game.user.isGM) {
    const { getMission, updateMission, missionEpoch } = await import("./gc/state.mjs");
    if (raised.period !== missionEpoch() || getMission().caliber !== raised.now)
      ui.notifications.warn(loc`The mission Caliber has changed since, so it was left as it is.`);
    else {
      await updateMission({ caliber: raised.was }).catch(error =>
        ui.notifications.warn(loc`The mission Caliber was not put back: ${error.message}`)
      );
      if (raised.gained > 0) {
        const { adjustGCDice } = await import("../services/gc-dice.mjs");
        await adjustGCDice(-raised.gained, loc`Undo: ${record.label}`).catch(error =>
          ui.notifications.warn(loc`The GC action dice were not taken back: ${error.message}`)
        );
      }
    }
  }
  // A surprise round set from the console: the fight's mark goes back to what it was.
  const surprise = record.combatSurprise;
  if (surprise?.combat && game.user.isGM) {
    const fight = game.combats?.get(surprise.combat);
    if (!fight) ui.notifications.warn(loc`That fight has ended, so its surprise round was left as it is.`);
    else
      await fight
        .update({ "flags.spycraft2.surprise": surprise.was ?? null })
        .catch(error => ui.notifications.warn(loc`The surprise round was not put back: ${error.message}`));
  }
  // Tokens Add NPC placed come off their scene, and with them the combatants they joined as; other tokens stay.
  const placed = record.placedTokens;
  if (placed?.ids?.length && game.user.isGM) {
    const scene = game.scenes?.get(placed.scene),
      fight = placed.combat ? game.combats?.get(placed.combat) : null;
    const joinedNow = (placed.combatants ?? []).filter(id => fight?.combatants?.get(id));
    if (joinedNow.length)
      await fight
        .deleteEmbeddedDocuments("Combatant", joinedNow)
        .catch(error => ui.notifications.warn(loc`The combatants were not taken off: ${error.message}`));
    const there = placed.ids.filter(id => scene?.tokens?.get(id));
    if (!there.length) ui.notifications.warn(loc`Those tokens are no longer on the scene.`);
    else
      await scene
        .deleteEmbeddedDocuments("Token", there)
        .catch(error => ui.notifications.warn(loc`The tokens were not taken off: ${error.message}`));
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
    // Set again by a later step since: that step's mark stays.
    if ("left" in mark && mark.left !== undefined && !same(holder?.[last], mark.left)) continue;
    if (holder?.[last] !== undefined)
      await marked.update({ [`flags.spycraft2.${[...keys, `-=${last}`].join(".")}`]: null }).catch(() => null);
  }
  // A save the step called for is closed: the damage it would follow from has been taken back.
  for (const id of record.closeSaves ?? []) {
    const pending = game.messages?.get(id);
    if (!pending?.flags?.spycraft2?.pendingSave || pending.flags.spycraft2.pendingSave.rolled) continue;
    const { markCard } = await import("./gc-relay.mjs");
    await Promise.resolve(markCard(pending, "pendingSave.rolled", true, { quiet: true })).catch(() => null);
  }
  if (record.damageApplicationUndo) {
    const receipt = record.damageApplicationUndo;
    await setDamageUndo(await fromUuid(receipt.actorUuid), receipt, "undone");
  }
  // The damage card may be applied to that target again.
  const card = record.damageCard ? game.messages?.get(record.damageCard.messageId) : null;
  if (card) {
    const applied = card.flags?.spycraft2?.damageAppliedBy ?? {},
      marks = Object.entries(applied).filter(([, entry]) => entry?.targetUuid === record.damageCard.targetUuid);
    // This step's own mark; an older note without one takes the newest mark for that target. An earlier
    // application of the same card stays recorded either way.
    const own = record.damageCard.entryId && applied[record.damageCard.entryId] ? record.damageCard.entryId : null,
      key = own ?? marks.at(-1)?.[0];
    // A player's own damage was marked on the GC's card through the GC, and is cleared the same way.
    if (key) {
      const { unmarkDamage } = await import("./gc-relay.mjs");
      await Promise.resolve(unmarkDamage(card, key)).catch(error =>
        ui.notifications.warn(loc`The damage card still reads as applied: ${error.message}`)
      );
    }
  }
  return targets.map(([entry]) => entry.name);
}

/** Review an old note after its actor changes were undone; the pool remembers its decision across lost responses. */
export async function reviewLegacyGCRefund(message, input = {}) {
  if (!game.user?.isGM) throw Error(loc`Only the GC reviews an old action-die refund.`);
  const initial = message?.flags?.spycraft2?.undo;
  if (!initial?.done || hasGCSession(initial) || !Number.isSafeInteger(initial.gcDice) || initial.gcDice < 1)
    throw Error(loc`Choose an undone legacy note with an unscoped GC payment.`);
  if (initial.gcDiceRefundReview?.state === "complete") return initial.gcDiceRefundReview;
  const expected = JSON.stringify(initial.gcDiceRefundReview ?? null);
  const session =
    initial.gcDiceRefundReview?.state === "submitting"
      ? initial.gcDiceRefundReview.session
      : String(readSetting("usagePeriods", {})?.session ?? "initial");
  if (initial.gcDiceRefundReview?.state !== "submitting" && input.confirmed !== true) {
    input = await systemDialog.input({
      window: { title: loc`Review old GC refund` },
      rejectClose: false,
      ok: { label: loc`Record refund review` },
      content: `<p>${loc`The character changes are already undone. This note lacks the original GC session. Check that payment before returning ${initial.gcDice} dice; an earlier session's dice do not carry into the current pool.`}</p><label>${loc`Original payment`} <select name="outcome"><option value="earlier">${loc`Earlier session; do not credit this pool`}</option><option value="current">${loc`Current session; return the recorded dice`}</option></select></label><label>${loc`GC review note`} <input name="note" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC checked the original payment and session`}</label>`
    });
  }
  if (!input) return null;
  const { gcDiceController, reviewUndoGCDice } = await import("../services/gc-dice.mjs");
  return queueResources(
    [gcDiceController({ required: false })],
    async () => {
      const current = message.flags.spycraft2.undo;
      if (current.gcDiceRefundReview?.state === "complete") return current.gcDiceRefundReview;
      if (
        !current.done ||
        hasGCSession(current) ||
        current.gcDice !== initial.gcDice ||
        JSON.stringify(current.gcDiceRefundReview ?? null) !== expected
      )
        throw Error(loc`The old refund changed during review. Review the current note again.`);
      let intent = current.gcDiceRefundReview;
      if (intent?.state !== "submitting") {
        if (
          input.confirmed !== true ||
          !["current", "earlier"].includes(input.outcome) ||
          !String(input.note ?? "").trim()
        )
          throw Error(loc`Confirm the original session and give the GC's refund review note.`);
        intent = {
          version: 1,
          state: "submitting",
          session,
          count: current.gcDice,
          credit: input.outcome === "current",
          note: String(input.note).trim(),
          reviewerId: game.user.id
        };
        try {
          await message.update({ "flags.spycraft2.undo.gcDiceRefundReview": intent });
        } catch (error) {
          if (!same(message.flags.spycraft2.undo.gcDiceRefundReview, intent)) throw error;
        }
      }
      const receipt = await reviewUndoGCDice({
        sourceUuid: message.uuid,
        count: intent.count,
        session: intent.session,
        credit: intent.credit,
        note: intent.note
      });
      const result = { ...intent, state: "complete", receipt };
      await message.update({ "flags.spycraft2.undo.gcDiceRefundReview": result });
      return result;
    },
    { messages: [message] }
  );
}

/** The Undo button on a note (the `renderChatMessageHTML` hook). */
export function renderUndo(message, html) {
  const record = message.flags?.spycraft2?.undo;
  if (!record || !(message.isAuthor || (game.user?.isGM && !message.author?.isGM))) return;
  const row = document.createElement("div");
  row.className = "spycraft2 roll-controls";
  if (!message.isAuthor && message.author?.name) {
    // A GC looking at a player's note: say whose step it was.
    const by = document.createElement("p");
    by.className = "hint";
    by.textContent = loc`Step taken by ${message.author.name}.`;
    row.append(by);
  }
  if (record.done) {
    const note = document.createElement("p");
    note.className = "hint";
    note.setAttribute("role", "status");
    note.textContent = loc`Undone.`;
    row.append(note);
    if (game.user?.isGM && record.gcDice > 0 && !hasGCSession(record)) {
      if (record.gcDiceRefundReview?.state === "complete") {
        const result = document.createElement("p");
        result.className = "hint";
        result.textContent = record.gcDiceRefundReview.receipt?.credit
          ? loc`GC refund reviewed and credited.`
          : loc`GC refund reviewed; this pool was not credited.`;
        row.append(result);
      } else {
        const review = document.createElement("button");
        review.type = "button";
        review.className = "sc2-quiet-action";
        review.textContent = loc`Review GC refund`;
        review.addEventListener("click", async () => {
          review.disabled = true;
          try {
            await reviewLegacyGCRefund(message);
          } catch (error) {
            ui.notifications.warn(error.message);
          } finally {
            review.disabled = false;
          }
        });
        row.append(review);
      }
    }
  } else {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sc2-quiet-action";
    button.textContent = loc`Undo`;
    // Several notes each carry a button: its name says which step it takes back.
    button.setAttribute("aria-label", loc`Undo: ${record.label}`);
    button.dataset.tooltip = loc`Puts back what this step changed${record.gcDice ? loc` and returns ${record.gcDice} GC action di${record.gcDice === 1 ? "e" : "ce"}` : ""}`;
    if (record.npcHitDefenseUndo) {
      button.dataset.npcHitUndoNote = message.uuid;
      const reason = npcHitDefenseUndoReason(record);
      button.disabled = !!reason;
      button.dataset.tooltip =
        reason || loc`Undo this pending Defense die and return its GC payment when it belongs to the current session.`;
    }
    if (record.declaredDCUndo) {
      button.dataset.declaredDcUndoNote = message.uuid;
      const reason = declaredDCUndoReason(record);
      button.disabled = !!reason;
      button.dataset.tooltip = reason || loc`Undo this unused DC declaration and refund its same-session payment.`;
    }
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
  Hooks.on("updateChatMessage", updateNpcUndoButtons);
  Hooks.on("updateActor", updateNpcUndoButtons);
}
