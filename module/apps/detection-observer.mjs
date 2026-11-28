import { detectionObserverPlan } from "../rules/detection-observer.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
const actors = () =>
    Array.isArray(game.actors?.contents)
      ? game.actors.contents
      : typeof game.actors?.values === "function"
        ? [...game.actors.values()]
        : Array.isArray(game.actors)
          ? game.actors
          : [],
  readable = a =>
    a?.isOwner === true || game.user?.isGM === true || a?.testUserPermission?.(game.user, "OBSERVER") === true;
const same = (a, b) =>
  JSON.stringify(a, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x
  ) ===
  JSON.stringify(b, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x
  );
export function detectionObserverCandidates() {
  return actors().filter(a => a.type === "agent" && readable(a));
}
/** The caller cannot substitute a target system, name or feat list. Disabled grades read no target. */
export function detectionObserverContext(input) {
  const severity = input.detectionDistraction ?? "";
  if (severity === "")
    return {
      detectionDistraction: "",
      detectionTargetSystem: null,
      detectionActorUuid: "",
      detectionActorName: "",
      detectionConfirmed: false
    };
  const uuid = input.detectionActorUuid;
  if (typeof uuid !== "string") throw new Error(loc`Choose a listed detection target.`);
  const a = actors().find(a => a.uuid === uuid);
  if (!a || a.type !== "agent" || !readable(a))
    throw new Error(
      loc`Choose an actual readable agent character. Ask the GC to resolve unavailable targets or generic NPC profiles.`
    );
  return {
    detectionDistraction: severity,
    detectionTargetSystem: a.system,
    detectionActorUuid: a.uuid,
    detectionActorName: a.name,
    detectionConfirmed: input.detectionConfirmed === true
  };
}
export function detectionObserverContent(key) {
  if (!["notice", "search"].includes(key)) return "";
  const candidates = detectionObserverCandidates();
  if (!candidates.length) return "";
  const esc = foundry.utils.escapeHTML;
  return `<details><summary>${loc`Character-detection distraction`}</summary><p>${loc`Only Notice/Awareness or Search/Perception against one actual agent character. Apply the observer’s distraction from Table 2.25 and Ghost Mastery’s additional−4 when the target has it.`}</p><label>${loc`Distraction`} <select name="detectionDistraction"><option value="">${loc`No selected distraction component`}</option><option value="minor">${loc`Minor: check−2, error+0`}</option><option value="moderate">${loc`Moderate: check−4, error+1`}</option><option value="major">${loc`Major: check−8, error+3`}</option></select></label><label>${loc`Character being detected`} <select name="detectionActorUuid"><option value="">${loc`Choose the actual character`}</option>${candidates.map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`).join("")}</select></label><label><input name="detectionConfirmed" type="checkbox" /> ${loc`The GC confirms this detection check targets that character and the observer faces the selected distraction`}</label></details>`;
}
export function validateDetectionObserverProof(proof, { checkKind, skillKey, checkId, checkMethod = "roll" } = {}) {
  if (!proof) return;
  const c = detectionObserverContext({
      detectionDistraction: proof.severity,
      detectionActorUuid: proof.targetActorUuid,
      detectionConfirmed: proof.confirmed
    }),
    p = detectionObserverPlan(
      c.detectionTargetSystem,
      skillKey,
      { id: checkId },
      {
        actorUuid: c.detectionActorUuid,
        actorName: c.detectionActorName,
        severity: c.detectionDistraction,
        confirmed: c.detectionConfirmed,
        method: checkMethod
      }
    );
  if (
    checkKind !== "skill" ||
    proof.skillKey !== skillKey ||
    proof.checkId !== checkId ||
    proof.method !== checkMethod ||
    p.blockedReason ||
    !p.evidence ||
    !same(p.evidence, proof)
  )
    throw new Error(
      p.blockedReason || loc`The detection target, distraction or Ghost Mastery source changed before posting.`
    );
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "detectionObserver",
  order: 1240,
  validate: ({ options, checkKind, checkId, checkMethod, skillKey }) =>
    validateDetectionObserverProof(options.detectionObserver, { checkKind, skillKey, checkId, checkMethod })
});

// Roll pipeline: this rule's section of the "skill" dialog.
rollPipeline.register({
  id: "detectionObserverContent:skill",
  dialogs: ["skill"],
  dialog: ({ key }) => [{ at: 230, html: detectionObserverContent(key) }]
});
