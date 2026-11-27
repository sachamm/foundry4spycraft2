import { ruleName } from "./rule-name.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
/** Opposing target effects: Silver Tongue p.205; Zeroed p.196; Faceless p.195. */
export function targetSkillEffectApplicable(system, key) {
  return (
    system.activeFeatNames?.includes("Faceless") === true ||
    (key === "senseMotive" && system.activeFeatNames?.includes("Silver Tongue") === true) ||
    (["analysis", "investigation"].includes(key) && system.activeFeatNames?.includes("Zeroed") === true)
  );
}
export function targetSkillEffectPlan(
  targetSystem,
  key,
  check,
  { actorUuid = "", actorName = "", confirmed = false, purpose = "" } = {}
) {
  const empty = { evidence: null, errorIncrease: 0, timeMultiplier: 1, blockedReason: "", notes: [] },
    reject = blockedReason => ({ ...empty, blockedReason });
  if (!actorUuid) return empty;
  if (
    typeof actorUuid !== "string" ||
    !/^Actor\.[A-Za-z0-9_-]+$/.test(actorUuid) ||
    typeof actorName !== "string" ||
    !actorName.trim() ||
    confirmed !== true
  )
    return reject(loc`Choose an actual target character and confirm with the GC that this skill check targets them.`);
  if (!targetSystem || !targetSkillEffectApplicable(targetSystem, key))
    return reject(loc`The selected target no longer has an applicable target feat source for this skill.`);
  if (typeof purpose !== "string" || !["", "past", "location", "intentions", "motives"].includes(purpose))
    return reject(loc`Choose a listed information-gathering purpose.`);
  if (purpose && !targetSystem.activeFeatNames?.includes("Faceless"))
    return reject(loc`The selected target no longer has Faceless for this information-gathering check.`);
  const sources = [];
  if (purpose) sources.push({ source: "Faceless", purpose, timeMultiplier: 3 });
  if (key === "senseMotive" && targetSystem.activeFeatNames?.includes("Silver Tongue")) {
    const charismaModifier = targetSystem.abilities?.cha?.mod;
    if (!Number.isSafeInteger(charismaModifier)) return reject(loc`Review the target’s current Charisma modifier.`);
    sources.push({ source: "Silver Tongue", charismaModifier, errorIncrease: charismaModifier });
  }
  if (["analysis", "investigation"].includes(key) && targetSystem.activeFeatNames?.includes("Zeroed")) {
    const covertFeats = (targetSystem.activeFeatSelections ?? [])
      .filter(f => f.tree === "covert")
      .map(f => ({ name: f.name, choice: f.choice ?? "" }));
    if (
      !covertFeats.length ||
      !covertFeats.some(f => ruleName(f) === "Zeroed") ||
      covertFeats.some(f => typeof f.name !== "string" || !f.name.trim() || typeof f.choice !== "string")
    )
      return reject(loc`Review the target’s active Covert feat selections, including Zeroed itself.`);
    covertFeats.sort((a, b) => a.name.localeCompare(b.name) || a.choice.localeCompare(b.choice));
    sources.push({ source: "Zeroed", covertFeats, errorIncrease: covertFeats.length });
  }
  if (!sources.length)
    return reject(
      loc`Choose the Faceless information-gathering purpose, or clear the selected target for an ordinary check.`
    );
  const errorIncrease = sources.reduce((n, s) => n + (s.errorIncrease ?? 0), 0),
    timeMultiplier = purpose ? 3 : 1;
  return {
    evidence: {
      version: 1,
      skillKey: key,
      checkId: check.id,
      targetActorUuid: actorUuid,
      targetName: actorName.trim(),
      targetConfirmed: true,
      sources,
      errorIncrease,
      ...(purpose ? { purpose, timeMultiplier } : {})
    },
    errorIncrease,
    timeMultiplier,
    blockedReason: "",
    notes: [
      loc`${actorName.trim()}: ${sources.map(s => (s.source === "Faceless" ? loc`Faceless: time required to determine ${purpose === "past" ? "their past" : purpose} ×3` : `${s.source} error range ${s.errorIncrease >= 0 ? "+" : ""}${s.errorIncrease}`)).join("; ")}. Error modifiers precede the acting character’s error reductions. The check targets this GC-confirmed character.`
    ]
  };
}

// Recorded on the posted check as the roll was given them.
rollPipeline.register({ id: "targetSkillEffectsRecord", order: 9770, record: ["targetSkillEffect"] });
