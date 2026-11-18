import { mixedHealingQuote, mixedHealingSignature } from "../rules/healing-payments.mjs";
import { unrestrictedBonusPools } from "../rules/bonus-pools.mjs";
import { shakenRules } from "../rules/shaken.mjs";
import { queueResources } from "../rules/transactions.mjs";
import { loc } from "../i18n.mjs";
export function mixedHealingFundingControl(actor) {
  const esc = foundry.utils.escapeHTML,
    pools = [
      { id: "", label: loc`Ordinary action dice`, available: actor.system.actionDice?.value ?? 0 },
      ...unrestrictedBonusPools(actor.actionDiceFundingSystem, actor.usagePeriods).filter(p => p.available)
    ];
  return `<details><summary>${loc`Use healing benefit dice from multiple sources`}</summary><p>${loc`Optional: contributions replace the benefit source and counts above. Each vitality die keeps its source’s type and modifiers; wound dice each heal2. The Shaken surcharge is once for the whole use. “Same source” surcharge funding uses the first nonzero benefit contribution below.`}</p>${pools.map(p => `<label>${loc`${esc(p.label)} (${p.available} available): vitality`} <input type="number" min="0" step="1" value="0" name="healingVitality__${p.id ? "pool_" + esc(p.id) : "ordinary"}" /></label><label>${loc`Wounds`} <input type="number" min="0" step="1" value="0" name="healingWounds__${p.id ? "pool_" + esc(p.id) : "ordinary"}" /></label>`).join("")}</details>`;
}
export function mixedHealingFundingInput(input = {}) {
  const entries = Object.entries(input).filter(
    ([k]) => k.startsWith("healingVitality__") || k.startsWith("healingWounds__")
  );
  if (!entries.length) return input.healingAllocations;
  const groups = new Map();
  for (const [key, value] of entries) {
    const vitality = key.startsWith("healingVitality__"),
      id = key.slice((vitality ? "healingVitality__" : "healingWounds__").length),
      bonusPoolId = id === "ordinary" ? "" : id.startsWith("pool_") && id.length > 5 ? id.slice(5) : "invalid:source",
      row = groups.get(bonusPoolId) ?? { bonusPoolId, vitalityDice: 0, woundDice: 0 };
    row[vitality ? "vitalityDice" : "woundDice"] =
      typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
    groups.set(bonusPoolId, row);
  }
  const rows = [...groups.values()].filter(p => p.vitalityDice !== 0 || p.woundDice !== 0);
  return rows.length ? rows : undefined;
}
/** Caller enters this queue once; all wallets are reserved together and only benefit dice roll. */
export function healFromMultipleSources(actor, input, expectedShaken) {
  return queueResources([actor], async () => {
    if (!actor.isOwner) throw new Error(loc`You must own the character spending healing dice.`);
    if (JSON.stringify(shakenRules(actor.actionDiceFundingSystem)) !== expectedShaken)
      throw new Error(loc`The Shaken condition changed. Confirm healing again.`);
    const context = () => ({ inCombat: !!actor.participatingCombat, dead: actor.statuses?.has("dead") ?? false });
    let quote;
    try {
      quote = mixedHealingQuote(actor, input, context());
    } catch (error) {
      return ui.notifications.warn(error.message);
    }
    return actor.payMultipartActionDiceLocked(
      quote.allocations,
      async payment => {
        const eligibility = () => {
          if (JSON.stringify(shakenRules(actor.actionDiceFundingSystem)) !== expectedShaken)
            return { blocked: true, reason: loc`The Shaken condition changed while resolving healing.` };
          const current = actor.actionDiceFundingSystem,
            virtual = {
              ...current,
              actionDice: { ...current.actionDice },
              bonusActionDice: { ...current.bonusActionDice }
            };
          for (const row of payment.payments) {
            if (row.bonusPoolId) {
              const pool = virtual.bonusActionDice[row.bonusPoolId];
              if (!pool) return { blocked: true, reason: loc`A healing source disappeared.` };
              virtual.bonusActionDice[row.bonusPoolId] = { ...pool, remaining: pool.remaining + row.count };
            } else virtual.actionDice.value += row.count;
          }
          try {
            const fresh = mixedHealingQuote(
              {
                uuid: actor.uuid,
                system: actor.system,
                actionDiceFundingSystem: virtual,
                usagePeriods: actor.usagePeriods
              },
              input,
              context()
            );
            if (mixedHealingSignature(fresh) !== mixedHealingSignature(quote))
              return { blocked: true, reason: loc`The healing die sources or modifiers changed. Confirm them again.` };
            return fresh.plan;
          } catch (error) {
            return { blocked: true, reason: error.message };
          }
        };
        const fresh = eligibility();
        if (fresh.blocked) throw new Error(fresh.reason);
        return actor.settleActionDiceHealing(
          fresh,
          {
            ...payment,
            baseCost: quote.baseCost,
            benefitCount: 1,
            surcharge: quote.surcharge,
            cost: quote.cost,
            healingSources: quote.healingSources
          },
          { eligibility }
        );
      },
      {
        purpose: "Mixed-source healing",
        details: {
          benefit: "healing",
          baseCost: quote.baseCost,
          benefitCount: 1,
          surcharge: quote.surcharge,
          healingSources: quote.healingSources,
          conditionGrade: quote.grade
        }
      }
    );
  });
}
