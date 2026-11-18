/** Faceless p.195, Traceless p.196, Silver Tongue p.205; Ghost Basics p.195: automatic named-rank synergy. */
const SOURCES = [
  { feat: "Faceless", targets: ["blend"], skill: "sneak" },
  { feat: "Traceless", targets: ["falsify"], skill: "blend" },
  { feat: "Silver Tongue", targets: ["bluff", "impress"], skill: "manipulate" }
];
export function rankSynergyFeatPlan(
  system,
  key,
  check,
  { noSharedLanguage = false, ghostHideTargetKind = "", ghostHideTargetName = "", ghostHideConfirmed = false } = {}
) {
  const eligible = SOURCES.filter(s => s.targets.includes(key) && system.activeFeatNames?.includes(s.feat)),
    empty = { evidence: null, bonuses: [], synergies: [], blockedReason: "", notes: [] };
  const ghostSelected = ghostHideTargetKind !== "";
  let ghostHide = null;
  if (ghostSelected) {
    if (!system.activeFeatNames?.includes("Ghost Basics") || key !== "sneak" || check.id !== "hide")
      return {
        ...empty,
        blockedReason: "Ghost Basics target synergies apply only to your Sneak/Hide check with the qualified feat."
      };
    if (
      !["sensor", "living", "both"].includes(ghostHideTargetKind) ||
      typeof ghostHideTargetName !== "string" ||
      !ghostHideTargetName.trim() ||
      ghostHideTargetName.trim().length > 200 ||
      ghostHideConfirmed !== true
    )
      return {
        ...empty,
        blockedReason:
          "Name the actual security sensor, living opponent, or both, and confirm those Hide targets with the GC."
      };
    ghostHide = { targetKind: ghostHideTargetKind, targetName: ghostHideTargetName.trim(), confirmed: true };
    if (["sensor", "both"].includes(ghostHideTargetKind)) eligible.push({ feat: "Ghost Basics", skill: "acrobatics" });
    if (["living", "both"].includes(ghostHideTargetKind)) eligible.push({ feat: "Ghost Basics", skill: "senseMotive" });
  }
  const sources = eligible.map(s => {
    const ranks = system.skillTotals?.[s.skill]?.ranks;
    return {
      feat: s.feat,
      skill: s.skill,
      ranks,
      synergy: Number.isSafeInteger(ranks) && ranks >= 0 ? Math.min(5, Math.floor(ranks / 5)) : null
    };
  });
  if (!sources.length) return empty;
  const blockedReason = sources.some(s => s.synergy === null)
    ? "Review the supporting skill ranks before applying the feat synergy."
    : "";
  return {
    evidence: {
      version: 1,
      skillKey: key,
      checkId: check.id,
      noSharedLanguage: noSharedLanguage === true,
      sources,
      ...(ghostHide ? { ghostHide } : {})
    },
    bonuses: sources.filter(s => s.synergy !== null).map(s => ({ source: s.feat, type: "synergy", value: s.synergy })),
    synergies: sources.map(s => ({ skill: s.skill, focusSkill: false, focus: "", condition: "" })),
    blockedReason,
    notes: [
      ...sources.map(
        s => `${s.feat}: +${s.synergy ?? "unreviewed"} synergy from ${s.skill} ranks; normal synergy stacking applies.`
      ),
      ...(ghostHide
        ? [
            `Ghost Basics: hiding from GC-confirmed ${ghostHide.targetKind === "sensor" ? "security sensor" : ghostHide.targetKind === "living" ? "living opponent" : "security sensors and living opponents"} ${ghostHide.targetName}.`
          ]
        : [])
    ]
  };
}
export function validateRankSynergyFeatProof(system, proof, { checkKind, skillKey, checkId } = {}) {
  if (!proof) return;
  const p = rankSynergyFeatPlan(
    system,
    skillKey,
    { id: checkId },
    {
      noSharedLanguage: proof.noSharedLanguage,
      ...(proof.ghostHide
        ? {
            ghostHideTargetKind: proof.ghostHide.targetKind,
            ghostHideTargetName: proof.ghostHide.targetName,
            ghostHideConfirmed: proof.ghostHide.confirmed
          }
        : {})
    }
  );
  if (
    checkKind !== "skill" ||
    proof.skillKey !== skillKey ||
    proof.checkId !== checkId ||
    p.blockedReason ||
    !p.evidence ||
    JSON.stringify(p.evidence) !== JSON.stringify(proof)
  )
    throw new Error("The rank-synergy feat, supporting ranks, language or Hide-target context changed before posting.");
}
