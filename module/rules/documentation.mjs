import { rollPipeline } from "./roll-pipeline.mjs";
/** Superior Documentation p.209: the Bluff bonus requires actually using a cover identity. */
export function documentationSkillPlan(
  system,
  key,
  check,
  { usingCoverIdentity = false, coverIdentityName = "", coverIdentityConfirmed = false } = {}
) {
  const empty = { evidence: null, bonuses: [], blockedReason: "", notes: [] };
  if (key !== "bluff" || usingCoverIdentity !== true) return empty;
  if (!system.activeFeatNames?.includes("Superior Documentation"))
    return { ...empty, blockedReason: "Superior Documentation must be currently available." };
  if (
    coverIdentityConfirmed !== true ||
    typeof coverIdentityName !== "string" ||
    !coverIdentityName.trim() ||
    coverIdentityName.trim().length > 200
  )
    return {
      ...empty,
      blockedReason: "Name the cover identity and confirm with the GC that you are using it for this Bluff check."
    };
  const evidence = {
    version: 1,
    source: "Superior Documentation",
    skillKey: key,
    checkId: check.id,
    usingCoverIdentity: true,
    coverIdentityName: coverIdentityName.trim(),
    coverIdentityConfirmed: true,
    bonus: { type: "gear", value: 1 }
  };
  return {
    evidence,
    bonuses: [{ source: evidence.source, ...evidence.bonus }],
    blockedReason: "",
    notes: [
      `Superior Documentation: +1 gear on Bluff while using cover identity “${evidence.coverIdentityName}”; normal gear bonus stacking applies (p.209).`
    ]
  };
}
export function validateDocumentationProof(system, proof, { checkKind, skillKey, checkId } = {}) {
  if (!proof) return;
  const current = documentationSkillPlan(system, skillKey, { id: checkId }, proof);
  if (
    checkKind !== "skill" ||
    proof.skillKey !== skillKey ||
    proof.checkId !== checkId ||
    !current.evidence ||
    JSON.stringify(current.evidence) !== JSON.stringify(proof)
  )
    throw new Error("The Superior Documentation source or declared cover identity changed before posting.");
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "documentation",
  order: 1590,
  record: ["documentation"],
  validate: ({ actor, options, checkKind, checkId, skillKey }) =>
    validateDocumentationProof(actor.system, options.documentation, { checkKind, skillKey, checkId })
});
