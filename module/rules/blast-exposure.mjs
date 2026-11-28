import { blastDamageAt } from "./damage-application.mjs";
import { loc } from "../i18n.mjs";
import { sameValues } from "./equal.mjs";

/** GC-confirmed direct paths, including character/scenery cover; never invent cover saves or bend a blast. */
export function blastExposurePlan(damage, targets, incrementFeet, { routeConfirmed = false, shape = "circle" } = {}) {
  blastDamageAt(damage, 0, incrementFeet);
  if (routeConfirmed !== true || !["circle", "cone"].includes(shape))
    throw Error(loc`Confirm the blast shape, direct paths and all intervening cover with the GC.`);
  if (!Array.isArray(targets) || !targets.length) throw Error(loc`Choose the actual characters caught in the blast.`);
  const seen = new Set();
  const rows = targets.map(row => {
    if (!row || typeof row.uuid !== "string" || !row.uuid.trim() || row.uuid.trim() !== row.uuid || seen.has(row.uuid))
      throw Error(loc`Choose each actual blast target only once.`);
    seen.add(row.uuid);
    if (row.coverNote != null && typeof row.coverNote !== "string")
      throw Error(loc`Record the actual cover decision as a brief note.`);
    const route = row.route ?? "clear",
      coverNote = (row.coverNote ?? "").trim();
    if (coverNote.length > 2048) throw Error(loc`Keep the cover decision within 2048 characters.`);
    if (!["clear", "blocked", "breached"].includes(route)) throw Error(loc`Review each target's actual blast path.`);
    if (route === "breached" && !coverNote)
      throw Error(
        loc`Identify the intervening cover and its actual failed Damage save before passing the blast through it.`
      );
    const at = blastDamageAt(damage, row.distanceFeet, incrementFeet);
    return {
      uuid: row.uuid,
      distanceFeet: row.distanceFeet,
      route,
      coverNote,
      rings: at.rings,
      damage: route === "blocked" ? 0 : at.damage
    };
  });
  return { version: 1, damage: Math.max(0, damage), incrementFeet, shape, routeConfirmed: true, targets: rows };
}

/** Relay validation checks the computed damage too; a recorded review cannot silently raise it. */
export function validBlastExposureReview(value) {
  try {
    return (
      value?.version === 1 &&
      sameValues(value, blastExposurePlan(value.damage, value.targets, value.incrementFeet, value))
    );
  } catch {
    return false;
  }
}
