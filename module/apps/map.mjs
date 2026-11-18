/**
 * Measuring from the scene: the roll dialogs open with the distance, adjacency and flanking the tokens show, and a
 * blast lists who it reaches. Everything measured is a starting value the player can change; with no scene, no
 * token for the character or no single target, the dialogs open as they always did.
 */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import {
  COVER,
  adjacent,
  blastTargets,
  coverGrade,
  coverPoints,
  distanceFeet,
  flanking,
  tokenBox
} from "../rules/map.mjs";
import { blastIncrementFeet } from "../rules/combat-actions.mjs";
import { loc } from "../i18n.mjs";

const SETTING = "mapMeasure";

/** Register the client setting that turns map measurement off. Call during `init`. */
export function registerMapSettings() {
  game.settings.register("spycraft2", SETTING, {
    name: "SPYCRAFT.Settings.MapMeasure.Name",
    hint: "SPYCRAFT.Settings.MapMeasure.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
}

function enabled() {
  try {
    return game.settings.get("spycraft2", SETTING) !== false;
  } catch {
    return true;
  }
}

/** Whether there is a scene to measure on. */
export function mapAvailable() {
  return enabled() && !!globalThis.canvas?.ready && !!canvas.scene && canvas.grid?.size > 0;
}

const gridFacts = () => ({
  size: canvas.grid.size,
  distance: canvas.grid.distance ?? canvas.scene.grid?.distance ?? 5
});
const boxOf = token =>
  tokenBox(
    {
      x: token.document.x,
      y: token.document.y,
      width: token.document.width,
      height: token.document.height,
      elevation: token.document.elevation
    },
    gridFacts()
  );

/** How the scene counts diagonal steps, as the measuring rules name it. */
function diagonalRule() {
  const rule = canvas.grid?.diagonals,
    modes = globalThis.CONST?.GRID_DIAGONALS ?? {};
  if ([modes.ALTERNATING_1, modes.ALTERNATING_2].includes(rule)) return "alternating";
  if ([modes.EXACT, modes.APPROXIMATE].includes(rule)) return "exact";
  return "equal";
}

/** The character's token on this scene: one the user controls if there is one, otherwise the first. */
export function actorToken(actor) {
  if (!mapAvailable() || !actor) return null;
  const tokens = actor.getActiveTokens?.(true) ?? [];
  return tokens.find(token => token.controlled) ?? tokens[0] ?? null;
}

/** The one token the user has targeted, or null when there is none or more than one. */
export function targetedToken() {
  const targets = [...(game.user?.targets ?? [])];
  return targets.length === 1 ? targets[0] : null;
}

/** Whether a wall stops sight between two points given in feet. Unknown (no walls layer) counts as clear. */
function sightBlocked(from, to) {
  try {
    const feet = gridFacts().size / gridFacts().distance,
      a = { x: from.x * feet, y: from.y * feet },
      b = { x: to.x * feet, y: to.y * feet };
    const backend = CONFIG.Canvas?.polygonBackends?.sight;
    return backend?.testCollision ? !!backend.testCollision(a, b, { type: "sight", mode: "any" }) : false;
  } catch {
    return false;
  }
}

/**
 * What the scene shows about an attack by this character on the targeted token.
 * @returns {object|null} null when it cannot be measured
 */
export function measureAttack(actor) {
  const attacker = actorToken(actor),
    target = targetedToken();
  if (!attacker || !target || attacker === target) return null;
  const a = boxOf(attacker),
    t = boxOf(target),
    square = gridFacts().distance;
  const centre = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const isAdjacent = adjacent(a, t),
    distance = distanceFeet(a, t, { square, diagonal: diagonalRule() });
  // Flanking partners: tokens on the attacker's side, near enough to the target, standing opposite the attacker.
  const cqb = actor.system?.cqbRange ?? 30;
  const partners = canvas.tokens.placeables.filter(token => {
    if (token === attacker || token === target || token.document.hidden) return false;
    if (token.document.disposition !== attacker.document.disposition) return false;
    if (token.actor?.statuses?.has?.("dead")) return false;
    const box = boxOf(token);
    return distanceFeet(box, t, { square }) <= cqb && flanking(a, box, t);
  });
  const blocked = coverPoints(t).filter(point => sightBlocked(centre, point)).length,
    cover = coverGrade(blocked);
  return {
    attackerName: attacker.name,
    targetName: target.name,
    targetActorUuid: target.actor?.uuid ?? "",
    distanceFeet: distance,
    adjacent: isAdjacent,
    flanked: distance <= cqb && partners.length > 0,
    flankers: partners.map(token => token.name),
    cover,
    coverId: COVER[cover].id
  };
}

const COVER_LABEL = {
  none: () => loc`no cover from walls`,
  quarter: () => loc`one-quarter cover from walls (+2 Defense)`,
  half: () => loc`one-half cover from walls (+4 Defense)`,
  threeQuarters: () => loc`three-quarters cover from walls (+6 Defense)`,
  total: () => loc`total cover from walls (+8 Defense, and the attack must get through it)`
};

/** One line saying what was measured. */
export function measurementLine(m) {
  return [
    loc`From the map: ${m.distanceFeet} ft. to ${m.targetName}`,
    m.adjacent ? loc`adjacent` : loc`not adjacent`,
    m.flanked ? loc`flanking with ${m.flankers.join(", ")}` : loc`not flanking`,
    COVER_LABEL[m.coverId]()
  ].join("; ");
}

/**
 * Put what was measured into an open roll dialog: the distance, the flanking and adjacency boxes and the target.
 * Fields the dialog does not have are skipped; fields already filled in are left alone.
 */
export function applyMeasurement(element, m) {
  if (!element || !m) return false;
  const form = element.querySelector?.("form") ?? element;
  const field = name => form.querySelector?.(`[name="${name}"]`);
  const distance = field("distanceFeet");
  if (distance && distance.value === "") distance.value = String(m.distanceFeet);
  const flanked = field("targetFlanked");
  if (flanked) flanked.checked = m.flanked;
  const reach = field("reachAdjacency");
  if (reach && !reach.value) reach.value = m.adjacent ? "adjacent" : "nonadjacent";
  const target = field("targetActorUuid");
  if (target && m.targetActorUuid && [...(target.options ?? [])].some(option => option.value === m.targetActorUuid))
    target.value = m.targetActorUuid;
  const holder = form.querySelector?.(".spycraft2-roll-options") ?? form;
  if (holder?.prepend && globalThis.document) {
    const note = document.createElement("p");
    note.className = "spycraft2-map-measure hint";
    note.textContent = `${measurementLine(m)}. ${loc`Change anything the map has wrong.`}`;
    holder.prepend(note);
  }
  return true;
}

/** A dialog `render` callback that fills in what the scene shows for this character's attack. */
export function measureInto(actor) {
  return (event, dialog) => {
    try {
      const measurement = measureAttack(actor);
      if (measurement) applyMeasurement(dialog?.element ?? event?.target, measurement);
    } catch (error) {
      console.warn("Spycraft 2.0 | The map could not be measured for this roll.", error);
    }
  };
}

/* -------------------------------------------- */
/*  Blast                                        */
/* -------------------------------------------- */

/**
 * Everyone a blast of this size reaches around the one targeted token, nearest first, each with its token's actor.
 * Null when there is no scene to measure on or no single token is targeted.
 */
export function blastCaught(total, increment) {
  if (!mapAvailable() || !Number.isFinite(total)) return null;
  const zero = targetedToken();
  if (!zero) return null;
  const tokens = canvas.tokens.placeables.filter(token => !token.document.hidden);
  return blastTargets(
    boxOf(zero),
    tokens.map(token => ({ id: token.id, name: token.name, box: boxOf(token) })),
    total,
    increment
  ).map(row => ({ ...row, actor: tokens.find(token => token.id === row.id)?.actor ?? null }));
}

/** List everyone a rolled blast reaches around the targeted token, and outline its reach on the scene. */
export async function blastOnMap(message) {
  const check = message.flags?.spycraft2,
    total = check?.effectiveTotal ?? message.rolls?.[0]?.total;
  if (!mapAvailable() || !Number.isFinite(total)) return null;
  const zero = targetedToken();
  if (!zero) return ui.notifications.warn(loc`Target the one token standing at Ground Zero, then try again.`);
  const increment = blastIncrementFeet(check.weaponQualities),
    origin = boxOf(zero);
  const caught = blastTargets(
    origin,
    canvas.tokens.placeables
      .filter(token => !token.document.hidden)
      .map(token => ({ id: token.id, name: token.name, box: boxOf(token) })),
    total,
    increment
  );
  const esc = foundry.utils.escapeHTML;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: fromUuidSync(check.actorUuid) }),
    content: [
      loc`Blast of ${total} at ${esc(zero.name)}, increment ${increment} ft.:`,
      `<ul>${caught
        .map(
          row =>
            `<li>${row.ring === 0 ? loc`${esc(row.name)} — Ground Zero: ${row.damage}` : loc`${esc(row.name)} — ${row.ring} increment(s) out: ${row.damage}`}</li>`
        )
        .join("")}</ul>`,
      loc`Walls and cover are not taken into account: blast stops at cover that passes its Damage save.`
    ]
      .map(line => (line.startsWith("<ul>") ? line : `<p>${line}</p>`))
      .join("")
  });
  return caught;
}

rollPipeline.register({
  id: "blastMapControl",
  kinds: ["damage"],
  order: 9770,
  chatControls({ message, check }) {
    if (!/\bBLS\b/.test(check.weaponQualities ?? "") || !mapAvailable()) return null;
    return [{ label: loc`Blast: who is caught on the map`, run: () => blastOnMap(message) }];
  }
});
