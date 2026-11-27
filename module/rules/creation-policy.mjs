import { loc } from "../i18n.mjs";
import { CAMPAIGN_QUALITIES, campaignEffects } from "./gc/campaign.mjs";
import { campaignCharacterEffects } from "./campaign-creation.mjs";

export const CREATION_POLICY_KEYS = ["creationPointBuy", "startingAttributeCap", "startingWealth", "modularCreation"];
export const CREATION_QUALITIES = CAMPAIGN_QUALITIES.filter(q =>
  CREATION_POLICY_KEYS.some(k => Object.hasOwn(q.effects, k))
);

export const creationRole = (type, system = {}) =>
  type === "agent" && !system.companionOf?.ownerUuid
    ? "pc"
    : type === "agent" || ["special", "villain"].includes(system.npcType)
      ? "special"
      : "standard";

export function creationEffectsForQualities(ids = []) {
  if (!Array.isArray(ids) || ids.some(id => !CREATION_QUALITIES.some(q => q.id === id)))
    throw new Error(loc`Choose supported creation-only campaign qualities.`);
  const combined = campaignEffects(CREATION_QUALITIES.filter(q => ids.includes(q.id)));
  if (combined.conflicts.some(c => CREATION_POLICY_KEYS.includes(c.key)))
    throw new Error(loc`Resolve the conflicting creation qualities first.`);
  return Object.fromEntries(
    CREATION_POLICY_KEYS.filter(k => Object.hasOwn(combined.effects, k)).map(k => [k, combined.effects[k]])
  );
}

export function creationPolicyValid(record) {
  if (!(
    record?.version === 1 &&
    record.confirmed === true &&
    Array.isArray(record.qualityIds) &&
    ["pc", "special", "standard"].includes(record.role) &&
    typeof record.note === "string" &&
    !!record.note.trim() &&
    record.effects &&
    typeof record.effects === "object" &&
    !Array.isArray(record.effects) &&
    Object.entries(record.effects).every(
      ([key, value]) =>
        CREATION_POLICY_KEYS.includes(key) &&
        Number.isSafeInteger(value) &&
        (key === "startingAttributeCap" ? value >= 1 : value >= 0)
    )
  ))
    return false;
  try {
    const expected = creationEffectsForQualities(record.qualityIds);
    if (record.role !== "pc") {
      delete expected.creationPointBuy;
      delete expected.modularCreation;
    }
    if (record.role === "standard") delete expected.startingWealth;
    return (
      Object.keys(expected).length === Object.keys(record.effects).length &&
      Object.entries(expected).every(([key, value]) => record.effects[key] === value)
    );
  } catch {
    return false;
  }
}

export function creationPolicyRecord(
  effects,
  { role = "pc", qualityIds = null, confirmed = false, note = "", at = 0, reviewedBy = "GC" } = {}
) {
  const chosen = Object.fromEntries(
    CREATION_POLICY_KEYS.filter(k => Object.hasOwn(effects, k)).map(k => [k, effects[k]])
  );
  if (role !== "pc") {
    delete chosen.creationPointBuy;
    delete chosen.modularCreation;
  }
  if (role === "standard") delete chosen.startingWealth;
  const record = {
    version: 1,
    effects: chosen,
    role,
    confirmed,
    note: typeof note === "string" ? note.trim() : "",
    qualityIds:
      qualityIds ??
      CREATION_QUALITIES.filter(q =>
        CREATION_POLICY_KEYS.some(k => q.effects[k] !== undefined && effects[k] === q.effects[k])
      ).map(q => q.id),
    at,
    reviewedBy
  };
  if (!creationPolicyValid(record))
    throw new Error(loc`Confirm the character's original creation rules, role and review note.`);
  return record;
}

/** Creation-only effects follow the recorded birth policy; live campaign rules still govern play and advancement. */
export function characterCampaignPolicy(system, liveEffects = {}, record) {
  const effects = campaignCharacterEffects(system, liveEffects);
  const recorded = creationPolicyValid(record);
  if (recorded) {
    for (const key of CREATION_POLICY_KEYS) delete effects[key];
    Object.assign(effects, record.effects);
  }
  const needsReview =
    (!!record && !recorded) ||
    (!recorded &&
      (system.progression?.length ?? system.level ?? system.threatLevel ?? 0) > 0 &&
      CREATION_POLICY_KEYS.some(k => Object.hasOwn(effects, k)));
  return { effects, recorded, needsReview };
}
