import { weaponGrip } from "./gear.mjs";
import { grantedMeleeQuality } from "./melee-tricks.mjs";
import { finesseWeaponPlan } from "./finesse.mjs";
import { readiedMeleeFeatSource } from "./readied-weapons.mjs";
import { rollPipeline } from "./roll-pipeline.mjs";
const stable = v =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map(k => [k, x[k]])
        )
      : x
  );
/** A granted AP(2) is a floor, not an instruction to increase an existing quality. */
export function armorPiercingFloor(qualities = "", minimum = 2) {
  const text = String(qualities),
    entries = [...text.matchAll(/\bAP\b\s*\(([^)]*)\)/gi)];
  if (
    /\bAP\b/i.test(text) &&
    (!entries.length ||
      /\bAP\b/i.test(text.replace(/\bAP\b\s*\([^)]*\)/gi, "")) ||
      entries.some(m => !/^\s*(?:all|\d+)\s*$/i.test(m[1])))
  )
    throw Error("Review the weapon’s existing armor-piercing quality before granting AP(2).");
  const values = entries.map(m => (/^\s*all\s*$/i.test(m[1]) ? Infinity : Number(m[1])));
  if (values.some(v => v !== Infinity && !Number.isSafeInteger(v)))
    throw Error("Review the weapon’s existing armor-piercing value.");
  const intrinsic = values.length ? Math.max(...values) : 0;
  if (intrinsic >= minimum)
    return {
      intrinsic: intrinsic === Infinity ? "all" : intrinsic,
      value: intrinsic === Infinity ? "all" : intrinsic,
      raised: false,
      qualities: text
    };
  const cleaned = text
    .replace(/\bAP\b\s*\([^)]*\)\s*,?\s*/gi, "")
    .replace(/^\s*[,—–-]+\s*|\s*,\s*$/g, "")
    .trim();
  return {
    intrinsic,
    value: minimum,
    raised: true,
    qualities: [cleaned, "AP (" + minimum + ")"].filter(Boolean).join(", ")
  };
}
export function meleeArmorPiercingPlan(system, weapon, { grip } = {}) {
  const empty = { evidence: null, effectiveQualities: String(weapon.qualities ?? ""), blockedReason: "", notes: [] },
    definitions = { axe: { feat: "Axe Basics", page: 176 }, hammer: { feat: "Hammer Basics", page: 179 } },
    definition = definitions[weapon.meleeFamily];
  if (
    !definition ||
    !system.activeFeatNames?.includes(definition.feat) ||
    weapon.equipped !== true ||
    weapon.carried === false ||
    weapon.reserve ||
    weapon.destroyed ||
    (weapon.quantity ?? 1) < 1
  )
    return empty;
  try {
    const source = readiedMeleeFeatSource(system, { name: definition.feat, family: weapon.meleeFamily, bonus: 2 }),
      held = source?.weapons.find(w => w.id === (weapon.id ?? weapon._id));
    if (
      !held ||
      held.proficiency !== weapon.proficiency ||
      !grip ||
      grip.blocked ||
      held.hands !== grip.hands ||
      held.requiredHands !== grip.required
    )
      return empty;
    const floor = armorPiercingFloor(empty.effectiveQualities);
    if (!floor.raised) return empty;
    return {
      ...empty,
      effectiveQualities: floor.qualities,
      evidence: {
        version: 1,
        feat: definition.feat,
        weaponId: held.id,
        family: held.family ?? weapon.meleeFamily,
        proficiency: held.proficiency,
        hands: held.hands,
        requiredHands: held.requiredHands,
        intrinsicQualities: empty.effectiveQualities,
        effectiveQualities: floor.qualities,
        armorPiercing: 2
      },
      notes: [
        definition.feat +
          ": this actual readied " +
          weapon.meleeFamily +
          " gains AP (2); preserve higher intrinsic AP and apply the effective quality to weapon damage (pp." +
          definition.page +
          ",301,332)."
      ]
    };
  } catch (error) {
    return { ...empty, blockedReason: error.message };
  }
}
export function validateMeleeArmorPiercingProof(
  actor,
  proof,
  { checkKind, weaponUuid, weaponProficiency, weaponQualities, attackContext, grantedQuality, rerollOf } = {}
) {
  if (!proof) return;
  const item = actor.items?.get?.(proof.weaponId) ?? actor.items?.find?.(i => i.id === proof.weaponId);
  if (
    !["attack", "damage"].includes(checkKind) ||
    item?.type !== "weapon" ||
    item.uuid !== weaponUuid ||
    item.system.proficiency !== weaponProficiency ||
    proof.version !== 1 ||
    proof.armorPiercing !== 2 ||
    !["Axe Basics", "Hammer Basics"].includes(proof.feat)
  )
    throw Error("The actual owned readied AP weapon changed.");
  if (rerollOf) {
    const c = globalThis.fromUuidSync?.(rerollOf)?.flags?.spycraft2,
      old = c?.meleeArmorPiercing;
    if (
      c?.actorUuid !== actor.uuid ||
      c.checkKind !== checkKind ||
      c.resolved ||
      c.superseded ||
      c.weaponUuid !== weaponUuid ||
      stable(old) !== stable(proof) ||
      c.weaponQualities !== weaponQualities
    )
      throw Error("Use the original owned unresolved AP result and its earned quality for replacement.");
    return;
  }
  const qualities = finesseWeaponPlan(actor.system, item.system).effectiveQualities,
    weapon = {
      ...item.system,
      id: item.id ?? item._id,
      name: item.name,
      qualities: checkKind === "damage" ? grantedMeleeQuality(qualities, grantedQuality) : qualities
    },
    grip = weaponGrip(actor.system, weapon, { hands: proof.hands }),
    current = meleeArmorPiercingPlan(actor.system, weapon, { grip }),
    expectedQualities =
      checkKind === "attack"
        ? grantedMeleeQuality(current.effectiveQualities, attackContext?.meleeTrick?.grantedQuality)
        : current.effectiveQualities;
  if (grip.blocked || stable(current.evidence) !== stable(proof) || weaponQualities !== expectedQualities)
    throw Error("The qualified feat, actual readied AP weapon or legal grip changed before posting.");
}

/** Historical card invariant; read-only recovery never asks for a new held weapon. */
export function validateRecordedMeleeArmorPiercing(check) {
  const p = check?.meleeArmorPiercing;
  if (!p) return;
  const definition = { axe: "Axe Basics", hammer: "Hammer Basics" },
    floor = armorPiercingFloor(p.intrinsicQualities);
  if (
    p.version !== 1 ||
    p.feat !== definition[p.family] ||
    p.armorPiercing !== 2 ||
    !floor.raised ||
    p.effectiveQualities !== floor.qualities ||
    !["attack", "damage"].includes(check.checkKind) ||
    check.weaponQualities !==
      (check.checkKind === "attack"
        ? grantedMeleeQuality(p.effectiveQualities, check.attackContext?.meleeTrick?.grantedQuality)
        : p.effectiveQualities)
  )
    throw Error("The posted result lost or changed its earned armor-piercing quality.");
}

// Roll pipeline: how this rule takes part in a roll (see module/rules/roll-pipeline.mjs).
rollPipeline.register({
  id: "meleeArmorPiercing",
  order: 1020,
  record: ["meleeArmorPiercing"],
  validate: ({ actor, options, checkKind, weaponUuid, weaponProficiency, weaponQualities }) =>
    validateMeleeArmorPiercingProof(actor, options.meleeArmorPiercing, {
      checkKind,
      weaponUuid,
      weaponProficiency,
      weaponQualities,
      attackContext: options.attackContext,
      grantedQuality: options.attackDamageBenefit?.grantedQuality,
      rerollOf: options.rerollOf
    })
});
