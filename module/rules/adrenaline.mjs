import { classFeatureLevels } from "./class-features.mjs";
import { actionDiceGain } from "./action-dice.mjs";
import { loc } from "../i18n.mjs";
export function adrenalineSource(system) {
  return system.coreClassIds?.includes("stuntman") &&
    Number.isSafeInteger(classFeatureLevels(system)?.stuntman) &&
    classFeatureLevels(system).stuntman >= 1 &&
    classFeatureLevels(system).stuntman <= 10
    ? {
        id: "adrenalineJunkie",
        name: loc`Adrenaline Junkie (confirmed wound-loss events)`,
        period: "session",
        limit: system.actionDice?.max,
        cost: 0,
        workflow: "adrenalineJunkie"
      }
    : null;
}
export function woundEventKey(eventRef) {
  if (typeof eventRef !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(eventRef))
    throw new Error(
      loc`Enter a unique attack, fall or damage-event reference (letters, numbers, dot, colon, dash or underscore).`
    );
  return encodeURIComponent(eventRef).replaceAll(".", "%2E");
}
export function recordedWoundEvent(record, { actorUuid, eventRef, loss, cause, opponentAttack = false } = {}) {
  if (record === undefined) return null;
  const valid =
    record &&
    record.actorUuid === actorUuid &&
    record.eventRef === eventRef &&
    Number.isSafeInteger(record.beforeWounds) &&
    Number.isSafeInteger(record.loss) &&
    record.loss > 0 &&
    Number.isSafeInteger(record.afterWounds) &&
    record.afterWounds === record.beforeWounds - record.loss &&
    ["attack", "fall", "explosion", "other"].includes(record.cause) &&
    typeof record.opponentAttack === "boolean" &&
    typeof record.granted === "boolean";
  if (!valid) throw new Error(loc`The saved wound event needs GC review before it can be used again.`);
  if (record.loss !== loss || record.cause !== cause || record.opponentAttack !== opponentAttack)
    throw new Error(
      loc`This event reference already records different wound loss. Use the actual unique event reference.`
    );
  return record;
}
/** p.81: one grant per actual eligible wound-loss event, bounded by starting dice per session. */
export function adrenalineWoundPlan(
  system,
  { eventRef, loss, cause, opponentAttack = false, confirmed = false },
  { actorUuid, id, careerDie, periods = system.usagePeriods, status } = {}
) {
  const source = adrenalineSource(system),
    key = woundEventKey(eventRef),
    before = system.wounds?.value;
  if (!source) throw new Error(loc`This character does not have the Stuntman Adrenaline Junkie core ability.`);
  if (
    confirmed !== true ||
    !["attack", "fall", "explosion", "other"].includes(cause) ||
    typeof opponentAttack !== "boolean" ||
    !Number.isSafeInteger(loss) ||
    loss < 1
  )
    throw new Error(loc`Confirm one actual event and its final positive whole wound loss after defenses.`);
  if (!Number.isSafeInteger(before) || !Number.isSafeInteger(before - loss))
    throw new Error(loc`Review the character’s actual wound balance.`);
  const session = String(periods?.session ?? "initial");
  if (
    !Number.isSafeInteger(source.limit) ||
    source.limit < 0 ||
    status?.counterReview ||
    status?.epoch !== session ||
    !Number.isSafeInteger(status?.used) ||
    status.used < 0
  )
    throw new Error(loc`Review Adrenaline Junkie’s saved session count and starting-dice limit.`);
  if (![4, 6, 8, 10].includes(careerDie))
    throw new Error(loc`Review this unsupported default career die before granting Adrenaline dice.`);
  const eligible = cause === "fall" || cause === "explosion" || (cause === "attack" && opponentAttack),
    granted = eligible && status.used < source.limit,
    gain = granted ? actionDiceGain(system, careerDie) : null;
  const record = {
    actorUuid,
    eventRef,
    key,
    loss,
    cause,
    opponentAttack,
    beforeWounds: before,
    afterWounds: before - loss,
    session,
    scene: String(periods?.scene ?? "initial"),
    granted,
    poolId: granted ? id : null,
    units: gain?.units ?? 0,
    die: gain?.die ?? null,
    usedBefore: status.used,
    usedAfter: status.used + (granted ? 1 : 0),
    limit: source.limit,
    at: system.worldTime
  };
  if (!Number.isFinite(record.at) || typeof actorUuid !== "string" || !actorUuid)
    throw new Error(loc`Review the wound event’s actor and time.`);
  const pool = granted
    ? {
        id,
        source: "adrenalineJunkie",
        label: loc`Adrenaline Junkie`,
        unrestricted: true,
        baseDie: careerDie,
        baseCount: 1,
        bold: system.activeFeatNames?.includes("Fortune Favors the Bold") === true,
        die: gain.die,
        granted: gain.units,
        remaining: gain.units,
        scene: record.scene,
        session,
        mission: String(periods?.mission ?? "initial"),
        at: record.at,
        woundEventKey: key,
        needsReview: false
      }
    : null;
  if (pool && (typeof id !== "string" || !/^[A-Za-z0-9_-]+$/.test(id) || system.bonusActionDice?.[id]))
    throw new Error(loc`Review the new Adrenaline grant identifier.`);
  return { record, pool, counter: granted ? { epoch: session, used: record.usedAfter } : null };
}
