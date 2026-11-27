import { TABLES } from "./tables.mjs";
import { subplotPlan } from "./subplots.mjs";
import { crossroadsSessionPolicy, crossroadsSessionReviewPlan } from "./crossroads-session.mjs";
import { ownedCrossroadsTitle, crossroadsMissionXPPolicy, crossroadsMissionXPReviewPlan } from "./crossroads-xp.mjs";
import { loc } from "../i18n.mjs";

export function crossroadsAwardChoices(system) {
  const validation = subplotPlan(system, TABLES.crossroads);
  return (system.subplots ?? []).flatMap((row, index) => {
    if (row.complete || !Object.hasOwn(TABLES.crossroads, row.kind)) return [];
    const error = validation.errors.find(e => e.index === index)?.text;
    return [
      { index, title: row.kind, label: `${row.name || row.notes} — ${TABLES.crossroads[row.kind].label}`, error }
    ];
  });
}

/** Completing a typed, eligible Crossroads awards its title; it cannot advance either current period's benefits. */
export function crossroadsAwardPlan(system, { index, id, reviewerId, note, confirmed } = {}) {
  const ownedTitle = ownedCrossroadsTitle(system),
    selected = crossroadsAwardChoices(system).find(row => row.index === Number(index));
  if (
    !(
      (typeof index === "number" && Number.isSafeInteger(index)) ||
      (typeof index === "string" && /^\d+$/.test(index))
    ) ||
    !selected
  )
    throw Error(loc`Choose an unfinished Crossroads Subplot before awarding its title.`);
  if (selected.error) throw Error(selected.error);
  if (crossroadsAwardChoices(system).filter(row => row.title === selected.title).length !== 1)
    throw Error(loc`Review the duplicate active attempts for this Crossroads title.`);
  if (system.subplotPicks && system.subplotPicks.used > system.subplotPicks.available)
    throw Error(loc`Resolve the unfinished Subplot limit before completing this Crossroads.`);
  if (confirmed !== true || typeof note !== "string" || !note.trim() || note.trim().length > 500)
    throw Error(loc`The GC must confirm completion and record a bounded review note.`);
  const sessionPolicy = crossroadsSessionPolicy(system),
    missionPolicy = crossroadsMissionXPPolicy(system);
  if (sessionPolicy.needsReview || missionPolicy.needsReview)
    throw Error(loc`Review the current session and mission title eligibility before awarding a new title.`);
  const common = { id, reviewerId, note: note.trim(), confirmed: true },
    sessionReview = crossroadsSessionReviewPlan(system, { ...common, eligibleTitle: sessionPolicy.eligibleTitle }),
    missionReview = crossroadsMissionXPReviewPlan(system, {
      ...common,
      mission: String(system.usagePeriods?.mission ?? "initial"),
      actorUuid: system.actorUuid,
      eligibleTitle: missionPolicy.eligibleTitle ?? ""
    }),
    subplots = system.subplots.map((row, i) => ({ ...row, ...(i === selected.index ? { complete: true } : {}) }));
  return {
    title: selected.title,
    subplots,
    sessionReview,
    missionReview,
    record: {
      version: 1,
      ...common,
      actorUuid: system.actorUuid,
      previousTitle: ownedTitle,
      title: selected.title,
      subplotIndex: selected.index,
      subplot: { ...system.subplots[selected.index] },
      level: system.level,
      session: sessionReview.session,
      mission: missionReview.mission,
      sessionPolicy,
      missionPolicy,
      at: system.worldTime
    }
  };
}
