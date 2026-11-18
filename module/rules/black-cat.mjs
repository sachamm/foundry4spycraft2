/**
 * Black Cat, p.189: once per scene, as a free action, the character targets opponents in line of sight, up to the
 * number of Chance feats they have. Until the scene ends those opponents' checks have their error range increased
 * by 2. No character carries more than one Black Cat at a time.
 *
 * Tough Luck, p.191: an opponent targeted by that character's Black Cat must spend 1 extra action die to activate
 * each threat (module/rules/criticals.mjs reads `toughLuck` from the check).
 *
 * The GC applies the marks (sight lines are the table's call). A mark lives in the target's
 * `flags.spycraft2.blackCat` with the world scene it was made in, so it lapses when the scene changes; rolls read it
 * through `activeBlackCat` and record it on the check.
 */
import { chanceFeatCount } from "./fortunate.mjs";
import { loc } from "../i18n.mjs";

export const BLACK_CAT = "Black Cat";
export const BLACK_CAT_ERROR = 2;
const scene = periods => String(periods?.scene ?? "initial");

export function blackCatSpec(system) {
  return system.activeFeatNames?.includes(BLACK_CAT)
    ? { id: "blackCat", name: loc`Black Cat`, period: "scene", limit: 1, workflow: "blackCat" }
    : null;
}

/** The live mark on a character, or null when it is absent, malformed or from an earlier scene. */
export function activeBlackCat(mark, periods) {
  return mark?.version === 1 &&
    typeof mark.sourceUuid === "string" &&
    !!mark.sourceUuid &&
    mark.scene === scene(periods)
    ? mark
    : null;
}

/**
 * The marks to write, one per chosen opponent, or an error saying why not.
 * @param {object} source    the Black Cat character's prepared system data
 * @param {object[]} targets [{ uuid, name, mark }] where mark is the target's current Black Cat record, if any
 */
export function blackCatPlan(
  source,
  targets,
  { sourceUuid, sourceName = "", periods, sightConfirmed = false, at = 0 } = {}
) {
  if (!source.activeFeatNames?.includes(BLACK_CAT)) throw Error(loc`Black Cat has not been earned.`);
  if (sightConfirmed !== true) throw Error(loc`The GC must confirm each chosen opponent is in line of sight.`);
  const limit = chanceFeatCount(source);
  if (!Array.isArray(targets) || !targets.length) throw Error(loc`Choose at least one opponent.`);
  if (targets.length > limit) throw Error(loc`Black Cat targets at most ${limit} opponents (one per Chance feat).`);
  if (new Set(targets.map(t => t.uuid)).size !== targets.length) throw Error(loc`Choose each opponent once.`);
  for (const t of targets) {
    if (t.uuid === sourceUuid) throw Error(loc`Black Cat targets opponents, not yourself.`);
    if (activeBlackCat(t.mark, periods))
      throw Error(loc`${t.name || t.uuid} already carries a Black Cat; no character carries more than one.`);
  }
  const mark = {
    version: 1,
    sourceUuid,
    sourceName: String(sourceName).slice(0, 200),
    scene: scene(periods),
    toughLuck: source.activeFeatNames.includes("Tough Luck"),
    at
  };
  return targets.map(t => ({ uuid: t.uuid, name: t.name, mark }));
}

/** The error-range increase and the record a roll carries, for a character's current mark. */
export function blackCatRollEffect(mark, periods, error) {
  const live = activeBlackCat(mark, periods);
  if (!live || !(error > 0)) return null;
  return {
    error: Math.min(19, error + BLACK_CAT_ERROR),
    record: { sourceUuid: live.sourceUuid, sourceName: live.sourceName, toughLuck: live.toughLuck === true }
  };
}

export const blackCatNote = check =>
  check?.blackCat
    ? loc`Black Cat (${check.blackCat.sourceName || loc`an opponent`}): error range +2 this scene${
        check.blackCat.toughLuck ? loc`; Tough Luck: activating a threat costs 1 more action die` : ""
      } (pp.189,191).`
    : "";
