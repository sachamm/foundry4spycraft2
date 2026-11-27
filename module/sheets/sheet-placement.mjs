/**
 * Where a character sheet opens.
 *
 * Foundry centres a new window, which puts a sheet over the tokens a player has to target and over the chat where
 * rolls are resolved. A sheet opens against the left edge instead, no wider than the room between the scene
 * controls and the sidebar, so the middle of the map and the chat stay in view. The sheet's own narrow layout takes
 * over when it is squeezed. The window stays resizable and movable; this is only where it starts.
 */
const CONTROLS = 110; // room kept clear for the scene controls on the left
const GAP = 12;
const MIN_WIDTH = 640;
// A stat block is read at a glance beside the map, so an NPC sheet may be much narrower than an agent sheet.
const MIN_WIDTHS = { npc: 420 };
const minWidthOf = kind => MIN_WIDTHS[kind] ?? MIN_WIDTH;

/**
 * @param {{width: number, height: number}} wanted  the sheet's preferred size
 * @param {{width: number, height: number, sidebar: number, open: number}} room  the browser window, the sidebar's
 *        width and how many sheets are already open (each new one steps down and right so titles stay reachable)
 * @param {string} [kind]  the sheet kind, for its minimum width
 * @returns {{left: number, top: number, width: number, height: number}}
 */
export function sheetPlacement(wanted, room, kind = "") {
  const step = 24 * ((room.open ?? 0) % 5);
  const available = room.width - room.sidebar - CONTROLS - GAP;
  const width = Math.round(Math.max(Math.min(minWidthOf(kind), wanted.width), Math.min(wanted.width, available)));
  const top = 60 + step;
  const height = Math.round(Math.max(360, Math.min(wanted.height, room.height - top - GAP)));
  return { left: clearOf(room.avoid, CONTROLS + step, width, room), top, width, height };
}

/**
 * A left edge that keeps the sheet off a window the GC works from (the GC Console in its own window): beside it
 * when there is room on the map for both, otherwise the usual place.
 */
function clearOf(avoid, left, width, room) {
  if (!avoid || ![avoid.left, avoid.width].every(Number.isFinite)) return left;
  const right = avoid.left + avoid.width;
  if (left + width <= avoid.left || left >= right) return left;
  const after = right + GAP;
  return after + width <= room.width - room.sidebar ? after : left;
}

/** The room the browser window gives right now. */
export function currentRoom() {
  const doc = globalThis.document,
    sidebar = doc?.getElementById?.("sidebar")?.offsetWidth;
  return {
    width: globalThis.innerWidth ?? 1600,
    height: globalThis.innerHeight ?? 900,
    sidebar: Number.isFinite(sidebar) && sidebar > 0 ? sidebar : 348,
    open: doc?.querySelectorAll?.(".spycraft2.sheet.actor").length ?? 0,
    avoid: consoleWindow(doc)
  };
}

/** The GC Console's own window, where one is open: a new sheet opens beside it rather than over it. */
function consoleWindow(doc) {
  const rect = doc?.querySelector?.(".application.gc-console")?.getBoundingClientRect?.();
  return rect && rect.width > 0 ? { left: rect.left, width: rect.width } : null;
}

const STORE = kind => `spycraft2.sheetPlacement.${kind}`;

/**
 * Where this user last left a sheet of this kind, fitted to the room there is now; null when nothing usable was kept.
 * A sheet moved clear of the tokens once opens there again, instead of over them.
 * @param {{left: number, top: number, width: number, height: number}|null} kept
 * @param {{width: number, height: number, open: number}} room
 */
export function rememberedPlacement(kept, room, kind = "") {
  if (!kept || ![kept.left, kept.top, kept.width, kept.height].every(Number.isFinite)) return null;
  const step = 24 * ((room.open ?? 0) % 5);
  const width = Math.round(Math.max(minWidthOf(kind), Math.min(kept.width, room.width - GAP * 2)));
  const height = Math.round(Math.max(360, Math.min(kept.height, room.height - GAP * 2)));
  const left = Math.round(Math.min(Math.max(0, kept.left + step), Math.max(0, room.width - width)));
  const top = Math.round(Math.min(Math.max(0, kept.top + step), Math.max(0, room.height - height)));
  return { left, top, width, height };
}

/** Keep where a sheet of this kind was when it closed, in this browser only. */
export function rememberSheetPlacement(kind, position, storage = globalThis.localStorage) {
  if (!kind || !position) return;
  const { left, top, width, height } = position;
  if (![left, top, width, height].every(Number.isFinite)) return;
  try {
    storage?.setItem(STORE(kind), JSON.stringify({ left, top, width, height }));
  } catch {
    /* storage refused: the default placement stands next time */
  }
}

function keptPlacement(kind, storage = globalThis.localStorage) {
  try {
    return JSON.parse(storage?.getItem(STORE(kind)) ?? "null");
  } catch {
    return null;
  }
}

/**
 * Mixin step for a sheet's `_initializeApplicationOptions`: a position asked for by the caller is kept; otherwise the
 * place this user last left a sheet of this kind, or the default against the left edge.
 */
export function placeSheet(applied, requested = {}, kind = "") {
  if (requested.position?.left !== undefined || requested.position?.top !== undefined) return applied;
  try {
    const room = currentRoom();
    const place =
      (kind && rememberedPlacement(keptPlacement(kind), room, kind)) || sheetPlacement(applied.position, room, kind);
    applied.position = { ...applied.position, ...place };
  } catch {
    /* no browser window to measure: Foundry's own placement stands */
  }
  return applied;
}
