import { underminedSpendBlock } from "./taunt.mjs";
import { shakenRules } from "./shaken.mjs";
import { actionDiceGain, actionDieBoostPlan } from "./action-dice.mjs";
import { validFortunatePool } from "./fortunate.mjs";
import { campaignActionDice } from "./campaign-rules.mjs";
import { loc } from "../i18n.mjs";

/**
 * The die a bonus pool rolls when spent: Spirited (p.408) raises every player character action die one type, bonus
 * pools included (d12 at most). Pools keep their book die on record, so their shape checks are unchanged.
 */
export function spentPoolDie(system, die) {
  const step = system?.npcType ? 0 : campaignActionDice().step;
  return step > 0 ? Math.min(12, die + 2 * step) : die;
}
const epoch = (periods, key) => String(periods?.[key] ?? "initial");
/** Bonus pools that may pay any action-die cost, each with its own expiry. */
export const UNRESTRICTED_POOL_SOURCES = Object.freeze(["masterPlan", "strut", "adrenalineJunkie", "fortunate"]);
/** Stuntman 8, p.81: one compulsory d10, confined to its STR/DEX check, once per scene. */
export function difficultSkillBonusPlan(system, result, { dc } = {}) {
  if ((system.classLevels?.stuntman ?? 0) < 8) throw new Error(loc`This bonus requires Stuntman level 8.`);
  if (result?.method !== "roll" || !["str", "dex"].includes(result.ability))
    throw new Error(loc`This bonus requires a rolled Strength- or Dexterity-based skill check.`);
  const target = Number(dc);
  if (!Number.isSafeInteger(target) || target <= (system.level ?? 0) + 20)
    throw new Error(loc`The DC must be more than 20 above Career Level.`);
  return {
    ...actionDiceGain(system, 10),
    source: "iKnowWhatDoing",
    label: loc`…I Know What I’m Doing.`,
    mandatory: true
  };
}
export function checkBonusPool(
  system,
  gain,
  { id, messageUuid, skillKey, ability, periods = system.usagePeriods } = {}
) {
  if (!/^[A-Za-z0-9_-]+$/.test(id) || !messageUuid || system.bonusActionDice?.[id])
    throw new Error(loc`A new bonus-pool identifier and its recorded check are required.`);
  return {
    id,
    source: gain.source,
    label: gain.label,
    die: gain.die,
    remaining: gain.units,
    granted: gain.units,
    mandatory: !!gain.mandatory,
    messageUuid,
    originalMessageUuid: messageUuid,
    skillKey,
    ability,
    scene: epoch(periods, "scene"),
    session: epoch(periods, "session")
  };
}
export function bonusPoolForCheck(system, id, message, { periods = system.usagePeriods } = {}) {
  if (UNRESTRICTED_POOL_SOURCES.includes(system.bonusActionDice?.[id]?.source))
    return unrestrictedBonusPoolForCheck(system, id, message, { periods });
  const pool = system.bonusActionDice?.[id],
    check = message?.flags?.spycraft2;
  const remaining = Number.isSafeInteger(pool?.remaining) ? Math.max(0, pool.remaining) : 0;
  let reason = "";
  if (!pool || pool.id !== id || pool.source !== "iKnowWhatDoing") reason = loc`This bonus pool is unavailable.`;
  else if (
    ![4, 6, 8, 10, 12].includes(pool.die) ||
    !Number.isSafeInteger(pool.granted) ||
    pool.granted < 1 ||
    !Number.isSafeInteger(pool.remaining) ||
    pool.remaining < 0 ||
    pool.remaining > pool.granted
  )
    reason = loc`Review this bonus pool’s recorded dice.`;
  else if (pool.forfeited || pool.session !== epoch(periods, "session"))
    reason = loc`This bonus die was forfeited or expired with its session.`;
  else if (
    pool.messageUuid !== (message?.uuid ?? message?.id) ||
    check?.requiredBonusPoolId !== id ||
    check?.checkKind !== "skill" ||
    check?.skillKey !== pool.skillKey ||
    check?.ability !== pool.ability
  )
    reason = loc`This bonus die belongs only to its original skill check.`;
  else if (check.checkMethod !== "roll" || check.resolved || check.superseded)
    reason = loc`This check has been resolved or replaced.`;
  else if (check.criticalFailure) reason = loc`An activated critical failure cannot be boosted.`;
  else if (!remaining) reason = loc`This bonus pool is already spent.`;
  return { ...pool, remaining, available: reason ? 0 : remaining, reason };
}
export function checkBonusBoostPlan(
  system,
  message,
  { bonusPoolId, count = 1, periods = system.usagePeriods, ...options } = {}
) {
  const pool = bonusPoolForCheck(system, bonusPoolId, message, { periods });
  if (!pool.available) return { blocked: true, reason: pool.reason };
  const ad = system.actionDice ?? {},
    die = spentPoolDie(system, pool.die),
    threshold = Math.max(2, die - Math.max(0, (ad.die ?? 4) - (ad.explodeAt ?? ad.die ?? 4)));
  const virtual = { ...system, actionDice: { ...ad, value: pool.available, die, explodeAt: threshold } };
  // This class's compulsory die may boost its linked passive check; general dice stay prohibited.
  const plan = actionDieBoostPlan(
    virtual,
    { ...message.flags.spycraft2, ...(pool.source === "iKnowWhatDoing" ? { actionDiceAllowed: true } : {}) },
    { ...options, count }
  );
  return { ...plan, pool, bonusPoolId };
}
export function availableCheckBonusPools(system, message, periods = system.usagePeriods) {
  return Object.keys(system.bonusActionDice ?? {})
    .map(id => bonusPoolForCheck(system, id, message, { periods }))
    .filter(pool => pool.available);
}

/** Stuntman 8, p.81: one unrestricted session die per activated error, not per die spent. */
export function hardKnocksGainPlan(system, check, { kind, careerDie = 4 } = {}) {
  if (
    kind !== "failure" ||
    !check?.errorConfirmed ||
    (system.classLevels?.stuntman ?? 0) < 8 ||
    check.schoolOfHardKnocks ||
    check.criticalFailure ||
    check.resolved ||
    check.superseded
  )
    return null;
  const gain = actionDiceGain(system, careerDie),
    value = (system.actionDice?.value ?? 0) + gain.units;
  if (!Number.isSafeInteger(value)) throw new Error(loc`The bonus action-die balance exceeds a safe whole number.`);
  return { ...gain, value, source: "School of Hard Knocks" };
}

/** An eligible reroll replaces this same check. Move only its unspent compulsory dice. */
export function transferableCheckBonusPool(system, message, periods = system.usagePeriods) {
  const check = message?.flags?.spycraft2,
    id = check?.requiredBonusPoolId;
  if (!id) return null;
  const pending = bonusPoolForCheck(
    system,
    id,
    { uuid: message.uuid ?? message.id, flags: { spycraft2: { ...check, criticalFailure: false } } },
    { periods }
  );
  return pending.available ? pending : null;
}

/** Schemer 8, p.79: fixed d4 bonus dice, one mission use, lost at scene end. */
export function masterPlanGainPlan(system) {
  if ((system.classLevels?.schemer ?? 0) < 8) throw new Error(loc`Master Plan requires Schemer level 8.`);
  const modifier = system.abilities?.int?.mod;
  if (!Number.isSafeInteger(modifier) || modifier < 1)
    throw new Error(loc`Master Plan requires a positive current Intelligence modifier to grant bonus dice.`);
  return {
    ...actionDiceGain(system, 4, modifier),
    intelligenceModifier: modifier,
    baseDie: 4,
    source: "masterPlan",
    label: loc`Master Plan`
  };
}
export function masterPlanPool(system, gain, { id, periods = system.usagePeriods } = {}) {
  if (
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(id) ||
    system.bonusActionDice?.[id] ||
    gain?.source !== "masterPlan" ||
    !Number.isSafeInteger(gain.intelligenceModifier) ||
    gain.intelligenceModifier < 1 ||
    gain.units !== gain.intelligenceModifier ||
    ![4, 6].includes(gain.die) ||
    !Number.isFinite(system.worldTime)
  )
    throw new Error(loc`Review the new Master Plan bonus-die grant and its identifier.`);
  return {
    id,
    source: "masterPlan",
    label: loc`Master Plan`,
    unrestricted: true,
    baseDie: 4,
    baseCount: gain.intelligenceModifier,
    die: gain.die,
    granted: gain.units,
    remaining: gain.units,
    scene: epoch(periods, "scene"),
    session: epoch(periods, "session"),
    mission: epoch(periods, "mission"),
    at: system.worldTime,
    needsReview: false
  };
}
export function unrestrictedBonusPoolStatus(system, id, { periods = system.usagePeriods } = {}) {
  const pool = system.bonusActionDice?.[id];
  let reason = "",
    needsReview = false;
  const common =
    typeof id === "string" &&
    /^[A-Za-z0-9_-]+$/.test(id) &&
    pool &&
    pool.id === id &&
    pool.unrestricted === true &&
    Number.isSafeInteger(pool.remaining) &&
    pool.remaining >= 0 &&
    pool.remaining <= pool.granted &&
    ["scene", "session", "mission"].every(key => typeof pool[key] === "string" && pool[key]) &&
    Number.isFinite(pool.at) &&
    Number.isFinite(system.worldTime) &&
    pool.at <= system.worldTime &&
    (pool.needsReview === undefined || typeof pool.needsReview === "boolean");
  const master =
    pool?.source === "masterPlan" &&
    pool.baseDie === 4 &&
    Number.isSafeInteger(pool.baseCount) &&
    pool.baseCount > 0 &&
    pool.granted === pool.baseCount &&
    [4, 6].includes(pool.die);
  const strut =
    pool?.source === "strut" &&
    [4, 6, 8, 10, 12].includes(pool.baseDie) &&
    pool.baseCount === 1 &&
    typeof pool.bold === "boolean" &&
    pool.die === (pool.bold ? (pool.baseDie === 12 ? 6 : pool.baseDie + 2) : pool.baseDie) &&
    pool.granted === (pool.bold && pool.baseDie === 12 ? 2 : 1) &&
    typeof pool.combatId === "string" &&
    !!pool.combatId &&
    typeof pool.combatantId === "string" &&
    !!pool.combatantId &&
    Number.isSafeInteger(pool.combatRound) &&
    pool.combatRound >= 1 &&
    typeof pool.messageUuid === "string" &&
    !!pool.messageUuid &&
    pool.nextHalfActionConfirmed === true;
  const adrenaline =
    pool?.source === "adrenalineJunkie" &&
    [4, 6, 8, 10].includes(pool.baseDie) &&
    pool.baseCount === 1 &&
    typeof pool.bold === "boolean" &&
    pool.die === (pool.bold ? pool.baseDie + 2 : pool.baseDie) &&
    pool.granted === 1 &&
    typeof pool.woundEventKey === "string" &&
    /^[A-Za-z0-9_%:-]+$/.test(pool.woundEventKey);
  const fortunate = validFortunatePool(pool);
  const valid = common && (master || strut || adrenaline || fortunate);
  if (!valid || pool.needsReview || system.actionDiceSettlementReview?.needsReview) {
    reason = loc`Review this bonus-die grant before spending it.`;
    needsReview = true;
  } else if (
    pool.session !== epoch(periods, "session") ||
    ((master || adrenaline || fortunate) && pool.scene !== epoch(periods, "scene"))
  )
    reason = loc`These bonus dice expired at scene or session end.`;
  else if (
    strut &&
    (system.bonusPoolCombats?.[pool.combatId]?.started !== true ||
      !Number.isSafeInteger(system.bonusPoolCombats[pool.combatId].round) ||
      system.bonusPoolCombats[pool.combatId].round < pool.combatRound)
  )
    reason = loc`These bonus dice expired when their combat ended.`;
  else if (!pool.remaining) reason = loc`These bonus dice are already spent.`;
  return {
    ...pool,
    id,
    label: pool?.label ?? loc`Bonus dice`,
    expiryLabel: pool?.source === "strut" ? "combat end" : "scene end",
    needsReview,
    available: reason ? 0 : pool.remaining,
    reason
  };
}
export function unrestrictedBonusPoolForCheck(system, id, message, { periods = system.usagePeriods } = {}) {
  const pool = unrestrictedBonusPoolStatus(system, id, { periods }),
    check = message?.flags?.spycraft2;
  let reason = pool.reason;
  if (
    !reason &&
    (!check ||
      check.resolved ||
      check.superseded ||
      check.criticalFailure ||
      check.actionDiceAllowed === false ||
      ["take10", "take20"].includes(check.checkMethod))
  )
    reason = loc`This check cannot receive these bonus action dice.`;
  return { ...pool, available: reason ? 0 : pool.available, reason };
}
export function unrestrictedBonusPools(system, periods = system.usagePeriods) {
  return Object.entries(system.bonusActionDice ?? {})
    .filter(([, pool]) => UNRESTRICTED_POOL_SOURCES.includes(pool?.source))
    .map(([id]) => unrestrictedBonusPoolStatus(system, id, { periods }));
}

/** Funding preserves each unrestricted grant's die type; check-bound dice cannot pay other costs. */
export function actionDicePoolFingerprint(pool) {
  return JSON.stringify(
    pool
      ? Object.fromEntries(
          [
            "id",
            "source",
            "unrestricted",
            "baseDie",
            "baseCount",
            "die",
            "granted",
            "scene",
            "session",
            "mission",
            "at",
            "mandatory",
            "messageUuid",
            "originalMessageUuid",
            "skillKey",
            "ability",
            "bold",
            "combatId",
            "combatantId",
            "combatRound",
            "nextHalfActionConfirmed",
            "woundEventKey"
          ].map(k => [k, pool[k]])
        )
      : null
  );
}
export function actionDiceFundingContext(system, { bonusPoolId = "", periods = system.usagePeriods } = {}) {
  if (system.actionDieAwardReview?.needsReview)
    return { blocked: true, reason: loc`The GC must review the interrupted award before spending more action dice.` };
  if (system.actionDiceSettlementReview?.needsReview)
    return {
      blocked: true,
      reason: loc`The GC must review the interrupted action-die settlement before further spending.`
    };
  const ad = system.actionDice ?? {};
  if (!bonusPoolId) {
    const balance = ad.value ?? 0,
      die = ad.die ?? 4;
    if (!Number.isSafeInteger(balance) || balance < 0 || ![4, 6, 8, 10, 12].includes(die))
      return { blocked: true, reason: loc`Review the ordinary action-die balance and die type.` };
    return {
      blocked: false,
      bonusPoolId: "",
      label: loc`Ordinary action dice`,
      paymentPath: "system.actionDice.value",
      balance,
      die,
      system: { ...system, actionDice: { ...ad, value: balance, die } }
    };
  }
  const pool = unrestrictedBonusPoolStatus(system, bonusPoolId, { periods });
  if (!pool.available) return { blocked: true, reason: pool.reason };
  const die = spentPoolDie(system, pool.die),
    threshold = Math.max(2, die - Math.max(0, (ad.die ?? 4) - (ad.explodeAt ?? ad.die ?? 4)));
  return {
    blocked: false,
    bonusPoolId,
    pool,
    label: pool.label,
    paymentPath: "system.bonusActionDice." + bonusPoolId + ".remaining",
    balance: pool.remaining,
    die,
    poolFingerprint: actionDicePoolFingerprint(pool),
    system: { ...system, actionDice: { ...ad, value: pool.remaining, die, explodeAt: threshold } }
  };
}
export function actionDicePaymentPlan(system, { count, bonusPoolId = "", periods = system.usagePeriods } = {}) {
  const shaken = shakenRules(system);
  if (shaken.needsReview || shaken.spendingForbidden)
    return {
      blocked: true,
      reason: shaken.needsReview
        ? loc`Review the current Shaken sources before spending action dice.`
        : loc`Shaken IV: no action dice may be spent at all (p.342).`
    };
  if (underminedSpendBlock(system)) return { blocked: true, reason: underminedSpendBlock(system) };
  if (!Number.isSafeInteger(count) || count < 1) throw new Error(loc`Spend a positive whole number of action dice.`);
  const funding = actionDiceFundingContext(system, { bonusPoolId, periods });
  if (funding.blocked) return funding;
  if (count > funding.balance)
    return { blocked: true, reason: loc`Not enough dice remain in the selected action-die balance.` };
  return { ...funding, count, afterBalance: funding.balance - count };
}
export function actionDicePaymentRefund(system, payment) {
  if (
    !payment ||
    !Number.isSafeInteger(payment.count) ||
    payment.count < 1 ||
    typeof payment.bonusPoolId !== "string" ||
    (payment.bonusPoolId && !/^[A-Za-z0-9_-]+$/.test(payment.bonusPoolId)) ||
    payment.paymentPath !==
      (payment.bonusPoolId ? "system.bonusActionDice." + payment.bonusPoolId + ".remaining" : "system.actionDice.value")
  )
    throw new Error(loc`Review the original action-die payment source.`);
  const current = payment.bonusPoolId ? system.bonusActionDice?.[payment.bonusPoolId] : null,
    balance = payment.bonusPoolId ? current?.remaining : system.actionDice?.value;
  if (payment.bonusPoolId && actionDicePoolFingerprint(current) !== payment.poolFingerprint)
    throw new Error(loc`The bonus grant changed; do not refund a different source.`);
  const restored = balance + payment.count;
  if (
    !Number.isSafeInteger(balance) ||
    balance < 0 ||
    !Number.isSafeInteger(restored) ||
    restored < 0 ||
    (payment.bonusPoolId && restored > current.granted)
  )
    throw new Error(loc`The selected action-die balance cannot be safely restored.`);
  return { [payment.paymentPath]: restored };
}

/** p.189: possessed dice include valid unspent temporary grants, not expired/forfeited balances. */
export function possessedActionDice(system, { periods = system.usagePeriods } = {}) {
  if (system.actionDieAwardReview?.needsReview || system.actionDiceSettlementReview?.needsReview)
    throw new Error(loc`Review the interrupted action-die balance before applying The Dice are Hot.`);
  const ordinary = system.actionDice?.value ?? 0;
  if (!Number.isSafeInteger(ordinary) || ordinary < 0)
    throw new Error(loc`Review the ordinary action-die count before applying The Dice are Hot.`);
  const sources = [];
  for (const [id, pool] of Object.entries(system.bonusActionDice ?? {})) {
    if (pool?.remaining === 0) continue;
    if (UNRESTRICTED_POOL_SOURCES.includes(pool?.source)) {
      const status = unrestrictedBonusPoolStatus(system, id, { periods });
      if (status.needsReview) throw new Error(status.reason);
      if (status.available)
        sources.push({ id, source: pool.source, label: status.label, die: pool.die, count: status.available });
      continue;
    }
    if (pool?.source === "iKnowWhatDoing") {
      if (
        typeof pool.session !== "string" ||
        !pool.session ||
        (pool.forfeited !== undefined && typeof pool.forfeited !== "boolean") ||
        !Number.isSafeInteger(pool.remaining) ||
        pool.remaining < 0
      )
        throw new Error(loc`Review the compulsory bonus-die balance before applying The Dice are Hot.`);
      if (pool.forfeited || pool.session !== epoch(periods, "session")) continue;
      const message = system.bonusPoolChecks?.[pool.messageUuid],
        check = message?.flags?.spycraft2;
      if (!check)
        throw new Error(loc`Review the missing check for a compulsory bonus die before applying The Dice are Hot.`);
      if (system.actorUuid && check.actorUuid !== system.actorUuid)
        throw new Error(loc`Review the owner of the compulsory bonus die.`);
      if (check.resolved || check.superseded || check.criticalFailure) continue;
      const status = bonusPoolForCheck(system, id, message, { periods });
      if (!status.available) throw new Error(status.reason);
      sources.push({ id, source: pool.source, label: pool.label, die: pool.die, count: status.available });
      continue;
    }
    throw new Error(loc`Review an unrecognized bonus-die balance before applying The Dice are Hot.`);
  }
  const bonus = sources.reduce((n, s) => n + s.count, 0),
    total = ordinary + bonus;
  if (!Number.isSafeInteger(total)) throw new Error(loc`The possessed action-die count exceeds a safe whole number.`);
  return { ordinary, bonus, total, sources };
}
