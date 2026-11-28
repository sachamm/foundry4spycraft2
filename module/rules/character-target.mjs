import { loc } from "../i18n.mjs";
export const characterTargetsEqual = (a, b) =>
  !!a && !!b && Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);
/** Conditional character type is a fact about this attack's actual target, never a guess. */
export function characterTargetPlan(target, { targetCharacterType = "", targetName = "" } = {}) {
  if (
    !["", "standard", "special", "object"].includes(targetCharacterType) ||
    typeof targetName !== "string" ||
    targetName.length > 200
  )
    throw new Error(loc`Choose the GC-confirmed character type and keep the target name within 200 characters.`);
  if (!target) {
    if (!targetCharacterType || !targetName.trim()) {
      const error = new Error(
        loc`Choose an actual character target, or enter the GC-confirmed type and name of the unrecorded target.`
      );
      error.code = "NEED_CHARACTER_TARGET";
      throw error;
    }
    return {
      version: 1,
      source: "gcManual",
      name: targetName.trim(),
      characterType: targetCharacterType,
      standard: targetCharacterType === "standard"
    };
  }
  if (target.createdTime !== undefined && target.createdTime !== null && !Number.isFinite(target.createdTime))
    throw new Error(loc`Review the actual target identity.`);
  if (
    typeof target.uuid !== "string" ||
    !target.uuid ||
    !["agent", "npc"].includes(target.type) ||
    (target.type === "npc" && !["standard", "special", "villain", "animal"].includes(target.npcType))
  )
    throw new Error(loc`Review the actual target’s character type.`);
  // A villain (the legacy special type) is a special character.
  const known =
    target.type === "agent" || target.npcType === "villain"
      ? "special"
      : target.npcType === "animal"
        ? null
        : target.npcType;
  if (known && targetCharacterType && targetCharacterType !== "object" && known !== targetCharacterType)
    throw new Error(
      loc`The declared target type conflicts with its actual character sheet. Correct the source before attacking.`
    );
  if (!known && !targetCharacterType) {
    const error = new Error(loc`The GC must classify this actual animal as standard or special.`);
    error.code = "NEED_CHARACTER_TARGET";
    throw error;
  }
  const characterType = targetCharacterType === "object" ? "object" : (known ?? targetCharacterType);
  return {
    version: 1,
    source: "actor",
    actorUuid: target.uuid,
    actorType: target.type,
    npcType: target.type === "npc" ? target.npcType : null,
    createdTime: target.createdTime ?? null,
    characterType,
    standard: characterType === "standard",
    gcCharacterType: targetCharacterType
  };
}
export function validCharacterTarget(t) {
  if (!t || t.version !== 1 || typeof t.standard !== "boolean") return false;
  if (t.source === "gcLegacy") return t.standard === true && t.confirmedAtActivation === true;
  if (!["standard", "special", "object"].includes(t.characterType) || t.standard !== (t.characterType === "standard"))
    return false;
  if (t.source === "gcManual") return typeof t.name === "string" && !!t.name.trim() && t.name.length <= 200;
  if (t.source !== "actor") return false;
  try {
    const expected = characterTargetPlan(
      { uuid: t.actorUuid, type: t.actorType, npcType: t.npcType, createdTime: t.createdTime },
      { targetCharacterType: t.gcCharacterType }
    );
    return (
      Object.keys(expected).length === Object.keys(t).length && Object.entries(expected).every(([k, v]) => t[k] === v)
    );
  } catch {
    return false;
  }
}
