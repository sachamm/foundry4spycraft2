import { campaignRules } from "./campaign-rules.mjs";
import { loc } from "../i18n.mjs";
import { featAcquisitionLevel } from "./career-zero.mjs";
import { campaignFeatReplacementAllowed } from "./campaign-creation.mjs";
/** Explicit class bonus-feat sources, including Scientist Intense Study (p.42). */
export function classFeatSources(items, progression) {
  const sources = [];
  for (const item of items.filter(i => i.type === "class")) {
    const classId = item.system.identifier || item.name;
    const careers = progression.flatMap((p, index) => (p.classId === classId ? [index + 1] : []));
    const lists = Object.fromEntries((item.system.choiceLists ?? []).map(list => [list.key, list]));
    (item.system.choiceSchedule ?? []).forEach((slot, index) => {
      if (slot.level > careers.length) return;
      const pick = item.system.choices?.[index];
      if (pick == null || pick === "") return;
      const list = lists[slot.list],
        option = list?.options.find(o => o.index === Number(pick));
      if (!option) return;
      for (const bonus of option.bonuses ?? []) {
        const tree = bonus.target.match(/^featSlots\.(\w+)$/)?.[1],
          count = Number(bonus.value);
        if (!tree || !Number.isSafeInteger(count) || count < 1) continue;
        for (let n = 0; n < count; n++)
          sources.push({
            id: `${item.id}:${index}:${n}`,
            classId,
            classLevel: slot.level,
            career: careers[slot.level - 1],
            tree,
            levelAllowance: classId === "scientist" && slot.list === "intenseStudy" ? 2 : 0,
            label: `${item.name} ${slot.level}: ${list.name} — ${option.name}${count > 1 ? ` (${n + 1})` : ""}`
          });
      }
    });
  }
  return sources;
}

export function featAcquisition(feat, sources, items, { preview = false, campaignEffects = campaignRules() } = {}) {
  const key = feat.system.acquisitionSource;
  if (!key || feat.system.granted) return { ok: true, levelAllowance: 0 };
  const source = sources.find(s => s.id === key),
    career = featAcquisitionLevel(feat.system);
  if (!source) return { ok: false, levelAllowance: 0, reason: loc`The selected bonus-feat source is unavailable.` };
  const replaced = campaignFeatReplacementAllowed(source.tree, feat.system.tree, campaignEffects);
  if (source.tree !== "any" && source.tree !== feat.system.tree && !replaced)
    return {
      ok: false,
      levelAllowance: 0,
      reason: loc`The feat tree does not match its selected bonus-feat source.`
    };
  if (career < source.career)
    return {
      ok: false,
      levelAllowance: 0,
      reason: loc`The selected bonus feat had not been earned at acquisition.`
    };
  const claimed = items.filter(i => i.type === "feat" && !i.system.granted && i.system.acquisitionSource === key);
  const winner = preview ? claimed.find(i => i.id !== feat.id) : claimed[0];
  if (winner && winner.id !== feat.id)
    return {
      ok: false,
      levelAllowance: 0,
      reason: loc`This bonus-feat source is already assigned to another feat.`
    };
  const levelAllowance = source.levelAllowance;
  return { ok: true, source, levelAllowance, effectiveLevel: career + levelAllowance };
}

const canonical = value =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map(k => [k, canonical(value[k])])
        )
      : value;
export const featAcquisitionValuesMatch = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export function featAcquisitionSignaturesMatch(a, b) {
  if (a === b) return true;
  try {
    return featAcquisitionValuesMatch(JSON.parse(a), JSON.parse(b));
  } catch {
    return false;
  }
}
export function featAcquisitionSignature(system) {
  return JSON.stringify(
    canonical({
      prerequisites: system.prerequisites ?? null,
      tree: system.tree,
      source: system.acquisitionSource ?? "",
      ...(system.acquiredAtCareerZero === true ? { acquiredAtCareerZero: true } : {})
    })
  );
}
export function captureFeatAcquisition(actor, system, excludeFeatId = null) {
  const result = actor.checkPrerequisites(system.prerequisites, {
    temporary: system.featKind === "temporary",
    acquisitionSource: system.acquisitionSource ?? "",
    featTree: system.tree,
    manualConfirmed: !!system.manualPrerequisitesConfirmed,
    excludeFeatId
  });
  return {
    ...result,
    level:
      system.acquiredAtCareerZero === true
        ? featAcquisitionLevel(system)
        : system.acquiredAtLevel || actor.system.level,
    signature: featAcquisitionSignature(system)
  };
}
/** Newly edited or added past selections are not unrecorded legacy imports. */
export function pendingFeatAcquisition(
  system,
  reason = loc`Review prerequisite eligibility at the recorded acquisition level after changing acquisition details.`
) {
  return {
    ok: false,
    unmet: [reason],
    level: featAcquisitionLevel(system),
    signature: featAcquisitionSignature(system),
    needsReview: true
  };
}
export function historicalFeatEligibility(system) {
  const snapshot = system.acquisitionCheck;
  if (!snapshot) return { ok: true, unknown: true };
  if (
    snapshot.level !== featAcquisitionLevel(system) ||
    !featAcquisitionSignaturesMatch(snapshot.signature, featAcquisitionSignature(system))
  )
    return {
      ok: false,
      reason: loc`The historical acquisition check no longer matches this feat's level, source or prerequisites.`
    };
  if (snapshot.needsReview === true)
    return {
      ok: false,
      reason:
        Array.isArray(snapshot.unmet) && snapshot.unmet.length
          ? snapshot.unmet.join("; ")
          : loc`Review recorded feat acquisition eligibility.`
    };
  return snapshot.ok
    ? { ok: true }
    : { ok: false, reason: loc`Prerequisites were not met at acquisition: ${(snapshot.unmet ?? []).join("; ")}` };
}
