/** Request-check exceptions: Veteran p.21, Geek p.23, Executive Decision p.77, Sources p.45. */
export function requestSources(system, items = []) {
  const sources = [];
  if (system.activeFeatNames?.includes("Office Gossip"))
    sources.push({
      id: "requestOfficeGossip",
      name: "Office Gossip: Request without action-die cost",
      category: "",
      period: "mission",
      limit: (system.activeFeatSelections ?? []).filter(f => f.tree === "tradecraft").length,
      cost: 0,
      workflow: "requestBenefit"
    });
  const sleuth = system.classLevels?.sleuth ?? 0,
    sourcesGrade =
      sleuth >= 19
        ? 3
        : sleuth >= 11
          ? 2
          : sleuth >= 2
            ? 1
            : (system.inheritedClassChoices ?? []).some(e => e.name === "Sleuth: Sources I")
              ? 1
              : 0;
  if (sourcesGrade)
    sources.push({
      id: "requestSources",
      name: `Sources ${["", "I", "II", "III"][sourcesGrade]}: outside-Faction Request`,
      category: "R",
      hour: true,
      consultSources: true,
      outsideFaction: true,
      requestLevel: Math.max(2, sleuth),
      requestOptions: [
        "dossier",
        ...(sourcesGrade >= 2 ? ["skillTraining"] : []),
        ...(sourcesGrade >= 3 ? ["legalImmunity"] : [])
      ],
      period: "session",
      limit: system.actionDice?.max ?? 0,
      cost: 0,
      workflow: "requestBenefit"
    });
  const advocate = system.classLevels?.advocate ?? 0,
    native = advocate >= 19 ? 3 : advocate >= 11 ? 2 : advocate >= 2 ? 1 : 0;
  const inherited =
    advocate >= 2
      ? 0
      : (system.inheritedClassChoices ?? []).filter(e => e.name === "Advocate: Behind the scenes I").length;
  const grade = Math.min(native + inherited, advocate > 0 ? 3 : 1);
  if (grade)
    sources.push({
      id: "requestBehindScenes",
      name: `Behind the Scenes ${["", "I", "II", "III"][grade]}: automatic Request`,
      category: "",
      automatic: true,
      city: true,
      hour: true,
      maximumDC: 10 * (grade + 1),
      period: "mission",
      limit: system.actionDice?.max ?? 0,
      cost: 0,
      workflow: "requestBenefit"
    });
  for (const [name, type, category] of [
    ["Veteran", "talent", ""],
    ["Geek", "specialty", "E"]
  ])
    if (items.some(i => i.type === "origin" && i.name === name && i.system?.originType === type))
      sources.push({
        id: `request${name}`,
        name: `${name}: Request without action-die cost`,
        category,
        period: "session",
        limit: 1,
        cost: 0,
        workflow: "requestBenefit"
      });
  if ((system.classLevels?.politico ?? 0) >= 10)
    sources.push({
      id: "requestExecutiveDecision",
      name: "Executive Decision: automatic Request without action-die cost",
      category: "",
      automatic: true,
      ignoreMissionCaliber: true,
      period: "mission",
      limit: 1,
      cost: 0,
      workflow: "requestBenefit"
    });
  return sources;
}

/** Priority Request, Cleaner p.66 / Field Analyst p.71: add class level in covered categories. */
export function priorityRequestBonus(system, category) {
  const sources = [];
  for (const [classId, early, late, name] of [
    ["cleaner", ["V", "W"], ["G", "T"], "Cleaner"],
    ["fieldAnalyst", ["E", "R"], ["T", "V"], "Field Analyst"]
  ]) {
    const level = system.classLevels?.[classId] ?? 0;
    if ((level >= 2 && early.includes(category)) || (level >= 7 && late.includes(category)))
      sources.push({ name: `${name}: Priority Request`, value: level });
  }
  const chosen = sources.sort((a, b) => b.value - a.value)[0];
  return { bonus: chosen?.value ?? 0, sources: chosen ? [chosen] : [], options: sources };
}

/** Local Hero, p.207: all possessed Terrain feats count, only in the declared home area. */
export function localHeroRequestBonus(system, { homeTurf = false } = {}) {
  const eligible = homeTurf === true && system.activeFeatNames?.includes("Local Hero") === true;
  const feats = eligible
    ? (system.activeFeatSelections ?? []).filter(feat => feat.tree === "terrain").map(feat => feat.name)
    : [];
  return {
    bonus: feats.length,
    sources: feats.length ? [{ name: "Local Hero (home turf)", value: feats.length }] : [],
    feats,
    homeTurf: homeTurf === true
  };
}

/** Freeze the earned Request source separately from its already-reserved use count. */
export function requestBenefitContext(system, id = "") {
  if (!id) return null;
  const source = system.limitedUses?.find(s => s.id === id && s.workflow === "requestBenefit");
  if (!source) throw new Error("The selected Request benefit is no longer available.");
  return {
    version: 1,
    id,
    source: structuredClone(source),
    epoch: String(system.usagePeriods?.[source.period] ?? "initial")
  };
}
