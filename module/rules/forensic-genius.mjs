import { rollPipeline } from "./roll-pipeline.mjs";
/** Complex Analysis challenge counts: Forensic Genius p.209 and Tracking Mastery p.207. */
export function analysisChallengeCount(system, base, { forensics = false } = {}) {
  const raw = typeof base === "string" && base.trim() ? Number(base) : base;
  if (!Number.isSafeInteger(raw) || raw < 2)
    throw new Error(
      "Enter the GC’s whole unmodified Complex Analysis Task Challenge count: at least2(pp.99–100). Feat reductions may lower the required count to1."
    );
  const forensicGenius = system.activeFeatNames?.includes("Forensic Genius") === true,
    trackingMastery = forensics === true && system.activeFeatNames?.includes("Tracking Mastery") === true,
    reduction = (forensicGenius ? 2 : 0) + (trackingMastery ? 1 : 0);
  return { base: raw, required: Math.max(1, raw - reduction), reduction, forensicGenius, trackingMastery };
}
export function forensicGeniusPlan(
  system,
  key,
  check,
  { complexAnalysisTask = false, analysisBaseChallenges = null, forensicsTask = check.id === "forensics" } = {}
) {
  const source = "Forensic Genius",
    genius = system.activeFeatNames?.includes(source) === true,
    task = key === "analysis" && complexAnalysisTask === true,
    tracking =
      task &&
      check.id === "forensics" &&
      forensicsTask === true &&
      system.activeFeatNames?.includes("Tracking Mastery") === true;
  const empty = { synergies: [], evidence: null, trackingEvidence: null, blockedReason: "", notes: [] };
  if (!["analysis", "search"].includes(key) || (!genius && !tracking) || (key === "analysis" && !task)) return empty;
  let counts = null;
  if (task) {
    try {
      counts = analysisChallengeCount(system, analysisBaseChallenges, { forensics: tracking });
    } catch (e) {
      return { ...empty, blockedReason: e.message };
    }
  }
  const challenges = task
    ? {
        base: counts.base,
        required: counts.required,
        reduction: 2,
        ...(tracking ? { combinedReduction: counts.reduction } : {})
      }
    : null;
  const trackingEvidence = tracking
    ? {
        version: 1,
        source: "Tracking Mastery",
        skillKey: key,
        checkId: check.id,
        forensicGenius: genius,
        challenges: { base: counts.base, required: counts.required, reduction: 1, combinedReduction: counts.reduction }
      }
    : null;
  return {
    synergies: key === "search" && genius ? [{ skill: "analysis", focusSkill: false, focus: "", condition: "" }] : [],
    evidence: genius
      ? {
          version: 1,
          source,
          skillKey: key,
          checkId: check.id,
          analysisRanks: system.skillTotals?.analysis?.ranks ?? 0,
          challenges
        }
      : null,
    trackingEvidence,
    blockedReason: "",
    notes: [
      task
        ? `${[...(genius ? [source] : []), ...(tracking ? ["Tracking Mastery"] : [])].join(" + ")}: this declared ${tracking ? "Analysis/Forensics" : "Complex Analysis"} Task requires ${counts.required} Challenges instead of ${counts.base} (−${counts.reduction}, minimum1); resolve task progress separately (pp.207,209).`
        : `${source}: Analysis synergy is available for this Search check; use the normal highest synergy (p.209).`
    ]
  };
}
export function validateTrackingTaskProof(system, proof, { checkKind, skillKey, checkId } = {}) {
  if (!proof) return;
  const expected = forensicGeniusPlan(
    system,
    skillKey,
    { id: checkId },
    { complexAnalysisTask: true, analysisBaseChallenges: proof.challenges?.base, forensicsTask: true }
  ).trackingEvidence;
  if (
    checkKind !== "skill" ||
    skillKey !== "analysis" ||
    checkId !== "forensics" ||
    !expected ||
    JSON.stringify(expected) !== JSON.stringify(proof)
  )
    throw new Error("The Tracking Mastery Forensics task source or challenge count changed before posting.");
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "trackingTask",
  order: 1610,
  record: ["trackingMasteryTask"],
  validate: ({ actor, options, checkKind, checkId, skillKey }) =>
    validateTrackingTaskProof(actor.system, options.trackingMasteryTask, { checkKind, skillKey, checkId })
});
