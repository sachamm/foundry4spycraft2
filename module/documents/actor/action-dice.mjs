/** Action dice: spending, healing and refresh, awards, mission XP and starting dice. */
import { refuse, refuseStep } from "../../error-notices.mjs";
import { systemDialog } from "../../apps/dialog-theme.mjs";
import { missionSettlementDefaults } from "../../apps/gc/mission-defaults.mjs";
import {
  mixedHealingFundingControl,
  mixedHealingFundingInput,
  healFromMultipleSources
} from "../../apps/healing-payments.mjs";
import {
  payActionDieBenefitLocked,
  surchargeFundingControl,
  surchargeFundingInput,
  unrolledPaymentFundingControl
} from "../../apps/action-die-benefits.mjs";
import {
  getActionDieSettlementReview,
  setPendingActionDieReview,
  clearPendingActionDieReview,
  multipartRefundPatch,
  paymentRecordMatches
} from "../../rules/action-die-payments.mjs";
import {
  payMultipartActionDiceLocked,
  reviewMultipartActionDice,
  markMultipartActionDieReview
} from "../../apps/action-die-payments.mjs";
import { shakenRules } from "../../rules/shaken.mjs";
import {
  actionDiceFundingContext,
  actionDicePaymentPlan,
  actionDicePaymentRefund,
  actionDicePoolFingerprint,
  unrestrictedBonusPools
} from "../../rules/bonus-pools.mjs";
import {
  queueResources,
  isResourceLock,
  recoverResourceTransaction,
  RULE_RESOURCE_LOCK_ID
} from "../../services/transactions.mjs";
import { withGCDicePool } from "../../services/gc-dice.mjs";
import { rollEvidence } from "../../rules/outcomes.mjs";
import {
  healingPlan,
  healingResult,
  defenseBoostPlan,
  refreshPlan,
  fortunesOfWarPlan,
  noFearPlan
} from "../../rules/health.mjs";
import { actionDieAwardPlan, missionXPPlan } from "../../rules/action-dice.mjs";
import { loc } from "../../i18n.mjs";
import { same } from "../../rules/equal.mjs";

export const ActorActionDice = Base =>
  class ActorActionDice extends Base {
    get actionDiceFundingSystem() {
      return {
        ...this.system,
        ...this.attributeRuleContext,
        bonusPoolCombats: Object.fromEntries(
          [...(game.combats ?? [])].map(c => [c.id, { id: c.id, started: c.started, round: c.round }])
        ),
        actionDieAwardReview: this.flags?.spycraft2?.actionDieAwardReview ?? this.system.actionDieAwardReview,
        actionDiceSettlementReview: getActionDieSettlementReview(this)
      };
    }

    preRollPaymentReceipt(payment) {
      return payment
        ? {
            id:
              payment.id ??
              globalThis.foundry?.utils?.randomID?.() ??
              "preRoll-" + (this._preRollReceiptSequence = (this._preRollReceiptSequence ?? 0) + 1),
            bonusPoolId: payment.bonusPoolId,
            die: payment.die,
            count: payment.count,
            ...(payment.allocations?.length
              ? {
                  baseCost: payment.baseCost,
                  surcharge: payment.surcharge,
                  benefitCount: payment.benefitCount,
                  allocations: payment.allocations
                }
              : {}),
            ...(payment.shakenSignature ? { shakenSignature: payment.shakenSignature } : {})
          }
        : null;
    }

    actionDiceFundingControl() {
      const pools = unrestrictedBonusPools(this.actionDiceFundingSystem, this.usagePeriods).filter(p => p.available),
        esc = foundry.utils.escapeHTML,
        selected = (this.system.actionDice?.value ?? 0) > 0 ? "" : (pools[0]?.id ?? "");
      return `<label>${loc`Funding`} <select name="bonusPoolId"><option value=""${selected ? "" : " selected"}>${loc`Ordinary action dice (${this.system.actionDice?.value ?? 0})`}</option>${pools.map(p => `<option value="${esc(p.id)}"${selected === p.id ? " selected" : ""}>${loc`${esc(p.label)}: ${p.available} d${p.die}, until ${p.expiryLabel}`}</option>`).join("")}</select></label>`;
    }

    actorRecordValue(path) {
      return path.split(".").reduce((value, key) => value?.[key], this);
    }

    actorRecordRestorePatch(path, before) {
      if (before === undefined) {
        const keys = path.split("."),
          last = keys.pop();
        return { [keys.join(".") + ".-=" + last]: null };
      }
      const patch = { [path]: structuredClone(before) },
        walk = (at, old, current) => {
          if (
            !old ||
            !current ||
            typeof old !== "object" ||
            typeof current !== "object" ||
            Array.isArray(old) ||
            Array.isArray(current)
          )
            return;
          for (const key of Object.keys(current)) {
            if (!Object.hasOwn(old, key)) patch[at + ".-=" + key] = null;
            else walk(at + "." + key, old[key], current[key]);
          }
        };
      walk(path, before, this.actorRecordValue(path));
      return patch;
    }

    async settleActionDiceHealing(
      fresh,
      payment,
      { kind = "healing", eligibility = () => ({ blocked: false }), updates = {} } = {}
    ) {
      const roll = fresh.formula ? await new Roll(fresh.formula).evaluate() : null,
        eligible = eligibility();
      if (eligible.blocked) throw new Error(eligible.reason);
      const previousReceipt = structuredClone(this.flags?.spycraft2?.healingReceipt),
        receiptId =
          globalThis.foundry?.utils?.randomID?.() ??
          "healing-" + (this._healingReceiptSequence = (this._healingReceiptSequence ?? 0) + 1),
        beforeExtras = Object.fromEntries(
          Object.keys(updates).map(path => [path, structuredClone(this.actorRecordValue(path))])
        );
      const before = { vitality: this.system.vitality.value, wounds: this.system.wounds.value },
        healed = healingResult(this.system, fresh, roll?.dice.map(d => d.total) ?? []),
        result = {
          ...healed,
          ...(payment.surcharge
            ? {
                baseCost: healed.cost,
                surcharge: payment.surcharge,
                benefitCount: payment.benefitCount,
                cost: payment.cost
              }
            : {})
        },
        target = { vitality: result.vitality, wounds: result.wounds },
        funding = {
          bonusPoolId: payment.bonusPoolId,
          die: payment.healingSources ? null : payment.die,
          count: fresh.cost,
          ...(payment.surcharge || payment.healingSources
            ? {
                paymentId: payment.id,
                surcharge: payment.surcharge ?? 0,
                totalCost: payment.cost,
                allocations: payment.allocations
              }
            : {}),
          ...(payment.healingSources ? { healingSources: payment.healingSources } : {})
        };
      let healthWriteCompleted = false;
      const extrasMatch = expected =>
        Object.entries(expected).every(
          ([path, value]) => JSON.stringify(this.actorRecordValue(path)) === JSON.stringify(value)
        );
      try {
        await this.update({
          "system.vitality.value": target.vitality,
          "system.wounds.value": target.wounds,
          ...updates,
          ...this.actorRecordRestorePatch("flags.spycraft2.healingReceipt", {
            id: receiptId,
            kind,
            at: game.time?.worldTime ?? this.system.worldTime ?? 0,
            before,
            target,
            funding
          })
        });
        healthWriteCompleted = true;
        const message = {
            speaker: ChatMessage.getSpeaker({ actor: this }),
            flags: {
              spycraft2: {
                actorUuid: this.uuid,
                checkKind: kind,
                healingReceiptId: receiptId,
                actionDiceAllowed: false,
                funding,
                ...result
              }
            }
          },
          text = loc`${kind === "refresh" ? loc`Refresh completed. ` : ""}Spent ${payment.count} action dice${payment.surcharge ? loc` (${payment.surcharge} surcharge; ${fresh.cost} benefit dice)` : ""}; recovered ${result.healedVitality} vitality and ${result.healedWounds} wounds.`;
        if (roll) await roll.toMessage({ ...message, flavor: text });
        else await ChatMessage.create({ ...message, content: text });
        return result;
      } catch (error) {
        const now = () => ({ vitality: this.system.vitality.value, wounds: this.system.wounds.value }),
          same = (a, b) => a.vitality === b.vitality && a.wounds === b.wounds,
          currentReceipt = () => this.flags?.spycraft2?.healingReceipt,
          previousMatches = () => JSON.stringify(currentReceipt()) === JSON.stringify(previousReceipt),
          ourReceipt = () => currentReceipt()?.id === receiptId;
        const posted = [...(game.messages ?? [])].find(
          m =>
            m.flags?.spycraft2?.actorUuid === this.uuid &&
            m.flags?.spycraft2?.healingReceiptId === receiptId &&
            m.flags.spycraft2.vitality === target.vitality &&
            m.flags.spycraft2.wounds === target.wounds
        );
        if (posted && (healthWriteCompleted || ourReceipt())) return result;
        if (!healthWriteCompleted && !ourReceipt() && previousMatches() && extrasMatch(beforeExtras)) throw error;
        if (((healthWriteCompleted && (!currentReceipt() || ourReceipt())) || ourReceipt()) && extrasMatch(updates)) {
          const restored = {
              vitality: Math.max(0, this.system.vitality.value - result.healedVitality),
              wounds: this.system.wounds.value - result.healedWounds
            },
            restoreExtras = Object.assign(
              {},
              ...Object.entries(beforeExtras).map(([path, value]) => this.actorRecordRestorePatch(path, value))
            );
          try {
            await this.update({
              "system.vitality.value": restored.vitality,
              "system.wounds.value": restored.wounds,
              ...restoreExtras,
              ...this.actorRecordRestorePatch("flags.spycraft2.healingReceipt", previousReceipt)
            });
          } catch (rollback) {
            if (!previousMatches() || !same(now(), restored) || !extrasMatch(beforeExtras)) {
              const failure = new AggregateError([error, rollback], loc`Healing could not be safely restored.`);
              failure.actionDiceSettlementReview = {
                purpose: kind,
                before,
                target,
                observed: now(),
                beforeExtras: Object.entries(beforeExtras).map(([path, value]) => ({ path, value })),
                targetExtras: Object.entries(updates).map(([path, value]) => ({ path, value }))
              };
              throw failure;
            }
          }
          throw error;
        }
        error.actionDiceSettlementReview = {
          purpose: kind,
          before,
          target,
          observed: now(),
          beforeExtras: Object.entries(beforeExtras).map(([path, value]) => ({ path, value })),
          targetExtras: Object.entries(updates).map(([path, value]) => ({ path, value }))
        };
        throw error;
      }
    }

    async healWithActionDice(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      let input = options;
      const expectedShaken = JSON.stringify(shakenRules(this.actionDiceFundingSystem));
      if (!Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: loc`Heal outside combat with action dice` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options">${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl()}<p>${loc`Choose all healing benefit dice for this use. The Shaken surcharge is paid once for this healing use and restores no health.`}</p><label>${loc`Benefit dice for vitality`} <input type="number" name="vitalityDice" min="0" value="1" /></label><label>${loc`Benefit dice for wounds (2 points each)`} <input type="number" name="woundDice" min="0" value="0" /></label>${mixedHealingFundingControl(this)}<p>${loc`Vitality dice explode normally. Healing cannot exceed the current maximum. Combat healing requires Refresh.`}</p></div>`
        });
        if (!input) return null;
      }
      const healingAllocations = mixedHealingFundingInput(input);
      if (healingAllocations !== undefined)
        return healFromMultipleSources(this, { healingAllocations, ...surchargeFundingInput(input) }, expectedShaken);
      const selected = { vitalityDice: Number(input.vitalityDice ?? 0), woundDice: Number(input.woundDice ?? 0) },
        context = () => ({
          ...selected,
          inCombat: !!this.participatingCombat,
          dead: this.statuses?.has("dead") ?? false
        }),
        funding = actionDiceFundingContext(this.actionDiceFundingSystem, {
          bonusPoolId: input.bonusPoolId ?? "",
          periods: this.usagePeriods
        });
      if (funding.blocked) return refuse(funding.reason);
      const plan = healingPlan(funding.system, context());
      if (plan.blocked) return refuse(plan.reason);
      return this.spendActionDiceBenefit(
        plan.cost,
        async payment => {
          const eligibility = () =>
              JSON.stringify(shakenRules(this.actionDiceFundingSystem)) !== expectedShaken
                ? { blocked: true, reason: loc`The Shaken condition changed while resolving healing.` }
                : healingPlan({ ...this.system, actionDice: payment.system.actionDice }, context()),
            fresh = eligibility();
          if (fresh.blocked) throw new Error(fresh.reason);
          return this.settleActionDiceHealing(fresh, payment, { eligibility });
        },
        {
          bonusPoolId: input.bonusPoolId ?? "",
          ...surchargeFundingInput(input),
          purpose: "Outside-combat healing",
          benefit: "healing",
          expectedShaken
        }
      );
    }

    async refreshWithActionDie(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      let input = options;
      const expectedShaken = JSON.stringify(shakenRules(this.actionDiceFundingSystem));
      if (!Object.keys(input).length) {
        const waiting = this.system.refreshAction?.state === "waiting";
        input = await systemDialog.input({
          window: { title: loc`Refresh: full round, then wait until next initiative` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options">${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl()}<p>${loc`Payment occurs only when you complete Refresh.`}</p>
        <label>${loc`Step`} <select name="phase"><option value="start" ${waiting ? "" : "selected"}>${loc`Begin Refresh`}</option><option value="complete" ${waiting ? "selected" : ""}>${loc`Complete at next initiative`}</option><option value="targeted">${loc`Record an attack during the wait`}</option><option value="cancel">${loc`Cancel pending Refresh`}</option></select></label>
        <label><input type="checkbox" name="forfeitActions" /> ${loc`Beginning: forfeit this round’s chance to act`}</label>
        <label><input type="checkbox" name="atStartOfInitiative" /> ${loc`Completing: this is the start of my next initiative`}</label>
        <label><input type="checkbox" name="notTargeted" /> ${loc`Completing: no attack targeted me since Refresh began, including misses`}</label>
        <label>${loc`Recover`} <select name="resource"><option value="vitality">${loc`One action die’s result in vitality`}</option><option value="wounds">${loc`2 wounds`}</option></select></label>
        <p>${loc`Begin with no conditions. Complete at the start of your next initiative. The GC confirms action timing. Attack targeting is confirmed manually, including attacks made outside this system.`}</p></div>`
        });
        if (!input) return null;
      }
      input = { ...input, phase: input.phase ?? "start" };
      const context = () => {
        const combat = this.participatingCombat,
          current = combat?.combatant;
        const member =
          current?.actor?.uuid === this.uuid ? current : combat?.combatants?.find(c => c.actor?.uuid === this.uuid);
        return {
          combat: combat ? { id: combat.id, round: combat.round, started: combat.started } : null,
          options: {
            ...input,
            combatantId: member?.id,
            currentCombatantId: current?.id,
            conditions: [...(this.statuses ?? [])],
            dead: this.statuses?.has("dead") ?? false
          }
        };
      };
      if (["targeted", "cancel"].includes(input.phase)) {
        const work = async () => {
          const record = this.system.refreshAction;
          if (record?.state !== "waiting") return refuseStep(loc`There is no pending Refresh.`);
          return this.update(
            input.phase === "targeted"
              ? { "system.refreshAction.targeted": true }
              : { "system.refreshAction.state": "cancelled" }
          );
        };
        return queueResources([this], work);
      }
      if (input.phase === "start") {
        const work = async () => {
          const now = context(),
            plan = refreshPlan(this.system, now.combat, now.options);
          if (plan.blocked) return refuseStep(plan.reason);
          await this.update({ "system.refreshAction": plan.record });
          return plan.record;
        };
        return queueResources([this], work);
      }
      const funding = actionDiceFundingContext(this.actionDiceFundingSystem, {
        bonusPoolId: input.bonusPoolId ?? "",
        periods: this.usagePeriods
      });
      if (funding.blocked) return refuse(funding.reason);
      const now = context(),
        plan = refreshPlan(funding.system, now.combat, now.options);
      if (plan.blocked) return refuse(plan.reason);
      return this.spendActionDiceBenefit(
        1,
        async payment => {
          const eligibility = () => {
              if (JSON.stringify(shakenRules(this.actionDiceFundingSystem)) !== expectedShaken)
                return { blocked: true, reason: loc`The Shaken condition changed while completing Refresh.` };
              const current = context();
              return refreshPlan(
                { ...this.system, actionDice: payment.system.actionDice },
                current.combat,
                current.options
              );
            },
            fresh = eligibility();
          if (fresh.blocked) throw new Error(fresh.reason);
          return this.settleActionDiceHealing(fresh, payment, {
            kind: "refresh",
            eligibility,
            updates: { "system.refreshAction": fresh.record }
          });
        },
        {
          bonusPoolId: input.bonusPoolId ?? "",
          ...surchargeFundingInput(input),
          purpose: "Refresh healing",
          benefit: "refresh",
          expectedShaken
        }
      );
    }

    async activateNoFear() {
      if (this.type !== "agent" || !this.isOwner) return null;
      const context = () => {
        const combat = this.participatingCombat,
          own = combat?.turns?.find(c => c.actor?.uuid === this.uuid);
        return combat
          ? {
              id: combat.id,
              round: combat.round,
              started: combat.started,
              turn: combat.turn,
              combatantId: own?.id,
              ownTurnIndex: combat.turns?.findIndex(c => c.id === own?.id) ?? -1
            }
          : null;
      };
      const first = noFearPlan({ ...this.system, usagePeriods: this.usagePeriods }, context());
      if (first.blocked) return refuse(first.reason);
      return this.useLimitedAbility(
        "noFear",
        async () => {
          const plan = noFearPlan({ ...this.system, usagePeriods: this.usagePeriods }, context());
          if (plan.blocked) throw new Error(plan.reason);
          const before = structuredClone(this.system.noFearBoost ?? null);
          await this.update({ "system.noFearBoost": plan.record });
          try {
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              content: loc`No Fear II: stress damage resistance ${plan.record.resistance} for ${plan.record.rounds} rounds, until own initiative in round ${plan.record.dueRound}. One session use spent.`,
              flags: {
                spycraft2: { actorUuid: this.uuid, checkKind: "noFear", actionDiceAllowed: false, ...plan.record }
              }
            });
          } catch (error) {
            await this.update({ "system.noFearBoost": before });
            throw error;
          }
          return plan.record;
        },
        { workflow: "noFear" }
      );
    }

    async boostFortunesOfWar() {
      if (this.type !== "agent" || !this.isOwner) return null;
      const context = () => {
        const combat = this.participatingCombat,
          own = combat?.turns?.find(c => c.actor?.uuid === this.uuid);
        return combat
          ? {
              id: combat.id,
              round: combat.round,
              started: combat.started,
              turn: combat.turn,
              combatantId: own?.id,
              ownTurnIndex: combat.turns?.findIndex(c => c.id === own?.id) ?? -1
            }
          : null;
      };
      const initial = fortunesOfWarPlan(this.system, context());
      if (initial.blocked) return refuse(initial.reason);
      return this.useLimitedAbility(
        "fortunesOfWar",
        async () => {
          const current = { ...this.system, usagePeriods: this.usagePeriods },
            plan = fortunesOfWarPlan(current, context());
          if (plan.blocked) throw new Error(plan.reason);
          const before = structuredClone(this.system.fortunesOfWarBoost ?? null);
          await this.update({ "system.fortunesOfWarBoost": plan.record });
          try {
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              content: loc`Fortunes of War: double only its own DR until the start of this character’s initiative in round ${plan.record.dueRound}. One session use spent; no action die spent.`,
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "fortunesOfWar",
                  actionDiceAllowed: false,
                  ...plan.record
                }
              }
            });
          } catch (error) {
            await this.update({ "system.fortunesOfWarBoost": before });
            throw error;
          }
          return plan.record;
        },
        { workflow: "fortunesOfWar" }
      );
    }

    async boostDefenseWithActionDie(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      let input = options;
      const expectedShaken = JSON.stringify(shakenRules(this.actionDiceFundingSystem));
      const roundSignature = () => {
          const c = this.participatingCombat;
          return JSON.stringify(c ? { id: c.id, round: c.round } : null);
        },
        expectedRound = roundSignature();
      if (!Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: loc`Boost Defense for rolled rounds` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options">${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl()}<p>${loc`Spend one benefit die for +2 Defense. The selected die's result determines duration in rounds.`}</p><label><input name="atStartOfRound" type="checkbox" /> ${loc`This is the start of the combat round`}</label><label><input name="replaceExisting" type="checkbox" /> ${loc`Replace any existing action-die Defense boost`}</label>${this.system.coreClassIds?.includes("transporter") ? `<p>${loc`Watchful Initiative is resolved by the GC while its roll interpretation is pending.`}</p>` : ""}</div>`
        });
        if (!input) return null;
      }
      const context = () => {
          const c = this.participatingCombat;
          return {
            combat: c ? { id: c.id, round: c.round, started: c.started } : null,
            options: { ...input, combatant: c?.combatants?.some(m => m.actor?.uuid === this.uuid) ?? false }
          };
        },
        funding = actionDiceFundingContext(this.actionDiceFundingSystem, {
          bonusPoolId: input.bonusPoolId ?? "",
          periods: this.usagePeriods
        });
      if (funding.blocked) return refuse(funding.reason);
      const first = context(),
        plan = defenseBoostPlan(funding.system, first.combat, first.options);
      if (plan.blocked) return refuse(plan.reason);
      return this.spendActionDiceBenefit(
        1,
        async payment => {
          if (roundSignature() !== expectedRound)
            throw new Error(
              loc`The Defense declaration belongs to an earlier combat round. Confirm the current round start.`
            );
          const now = context(),
            fresh = defenseBoostPlan(
              { ...this.system, actionDice: payment.system.actionDice },
              now.combat,
              now.options
            );
          if (fresh.blocked) throw new Error(fresh.reason);
          const roll = await new Roll(fresh.formula).evaluate();
          if (JSON.stringify(shakenRules(this.actionDiceFundingSystem)) !== expectedShaken)
            throw new Error(loc`The Shaken condition changed while resolving Defense.`);
          const rounds = Math.max(0, Math.trunc(roll.total));
          if (!Number.isSafeInteger(rounds) || !Number.isSafeInteger(now.combat.round + rounds))
            throw new Error(loc`Review the rolled Defense duration before applying it.`);
          const before = structuredClone(this.system.defenseBoost ?? null),
            receiptId =
              globalThis.foundry?.utils?.randomID?.() ??
              "defense-" + (this._defenseReceiptSequence = (this._defenseReceiptSequence ?? 0) + 1),
            fundingInfo = {
              bonusPoolId: payment.bonusPoolId,
              die: payment.die,
              count: 1,
              ...(payment.surcharge
                ? {
                    paymentId: payment.id,
                    surcharge: payment.surcharge,
                    totalCost: payment.cost,
                    allocations: payment.allocations
                  }
                : {})
            },
            boost = {
              combatId: now.combat.id,
              startRound: now.combat.round,
              expiresAtRound: now.combat.round + rounds,
              rounds,
              actionDiceReceiptId: receiptId,
              funding: fundingInfo
            };
          let writeCompleted = false;
          try {
            await this.update(this.actorRecordRestorePatch("system.defenseBoost", boost));
            writeCompleted = true;
            await roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              flavor: loc`Spent ${payment.count} action ${payment.count === 1 ? "die" : "dice"}${payment.surcharge ? loc` (${payment.surcharge} surcharge; one benefit die rolled)` : ""}: +2 Defense for ${rounds} rounds (through round ${boost.expiresAtRound - 1}).`,
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "defenseDuration",
                  defenseReceiptId: receiptId,
                  actionDiceAllowed: false,
                  ...boost
                }
              }
            });
            return boost;
          } catch (error) {
            const current = () => this.system.defenseBoost ?? null,
              ourReceipt = () => current()?.actionDiceReceiptId === receiptId,
              posted = [...(game.messages ?? [])].find(
                m => m.flags?.spycraft2?.actorUuid === this.uuid && m.flags?.spycraft2?.defenseReceiptId === receiptId
              );
            if (posted && (writeCompleted || ourReceipt())) return boost;
            if (!writeCompleted && !ourReceipt() && same(current(), before)) throw error;
            if (ourReceipt() && same(current(), boost)) {
              try {
                await this.update(this.actorRecordRestorePatch("system.defenseBoost", before));
              } catch (rollback) {
                if (!same(current(), before)) {
                  const failure = new AggregateError([error, rollback], loc`Defense could not be safely restored.`);
                  failure.actionDiceSettlementReview = {
                    purpose: "Defense boost",
                    beforeBoost: before,
                    targetBoost: boost,
                    observedBoost: current()
                  };
                  throw failure;
                }
              }
              throw error;
            }
            error.actionDiceSettlementReview = {
              purpose: "Defense boost",
              beforeBoost: before,
              targetBoost: boost,
              observedBoost: current()
            };
            throw error;
          }
        },
        {
          bonusPoolId: input.bonusPoolId ?? "",
          ...surchargeFundingInput(input),
          purpose: "Defense boost",
          benefit: "defenseBoost",
          expectedShaken
        }
      );
    }

    async refundActionDicePayment(payment) {
      if (payment.payments) {
        if (!paymentRecordMatches(this, payment) || payment.state !== "reserved")
          throw new Error(loc`Review the original payment reservation before refunding.`);
        const patch = multipartRefundPatch(this.actionDiceFundingSystem, payment),
          expected = patch["flags.spycraft2.actionDiePayments." + payment.id];
        try {
          await this.update(patch);
        } catch (error) {
          if (!paymentRecordMatches(this, expected)) throw error;
        }
        return;
      }
      const patch = actionDicePaymentRefund(this.actionDiceFundingSystem, payment),
        expected = patch[payment.paymentPath];
      try {
        await this.update(patch);
      } catch (error) {
        const current = payment.bonusPoolId ? this.system.bonusActionDice?.[payment.bonusPoolId] : null,
          balance = payment.bonusPoolId ? current?.remaining : this.system.actionDice.value;
        if (
          balance !== expected ||
          (payment.bonusPoolId && actionDicePoolFingerprint(current) !== payment.poolFingerprint)
        )
          throw error;
      }
    }

    async reviewActionDiceSettlement(options = {}) {
      if (!game.user?.isGM) throw new Error(loc`Only the GC may review an interrupted action-die settlement.`);
      if (this.type !== "agent" || !this.isOwner) return null;
      const saved = getActionDieSettlementReview(this);
      if (!saved?.needsReview) return null;
      if (saved.payments) return reviewMultipartActionDice(this, options);
      const source = saved.payment;
      if (
        !source ||
        typeof source.bonusPoolId !== "string" ||
        (source.bonusPoolId && !/^[A-Za-z0-9_-]+$/.test(source.bonusPoolId)) ||
        source.paymentPath !==
          (source.bonusPoolId
            ? "system.bonusActionDice." + source.bonusPoolId + ".remaining"
            : "system.actionDice.value")
      )
        throw new Error(loc`Review the saved payment source before reconciling action dice.`);
      const state = () => {
          const r = getActionDieSettlementReview(this),
            p = r?.payment,
            pool = p?.bonusPoolId ? this.system.bonusActionDice?.[p.bonusPoolId] : null;
          const related = r?.messageUuid && game.messages?.get?.(String(r.messageUuid).split(".").at(-1));
          return {
            review: r,
            messageEvidence: related ? rollEvidence(related.flags?.spycraft2 ?? {}) : null,
            poolFingerprint: actionDicePoolFingerprint(pool),
            balance: p?.bonusPoolId ? pool?.remaining : this.system.actionDice.value,
            vitality: this.system.vitality.value,
            wounds: this.system.wounds.value,
            refreshAction: this.system.refreshAction,
            defenseBoost: this.system.defenseBoost,
            eagleEyeBoost: this.system.eagleEyeBoost,
            resourceUses: this.system.resourceUses
          };
        },
        expected = JSON.stringify(state());
      let input = options;
      if (input.healthReviewed === undefined) {
        const esc = foundry.utils.escapeHTML,
          current = state();
        input = await systemDialog.input({
          window: { title: loc`Review interrupted action-die use` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`${esc(saved.payment.label)}; current health ${current.vitality} vitality / ${current.wounds} wounds. If health needs correction, close this dialog, correct health on Main, and reopen this review before confirming.`}</p><p>${esc(saved.reason)}</p><label>${loc`Confirmed action-die balance`} <input name="balance" type="number" min="0" step="1" value="${current.balance ?? 0}" /></label>${saved.limitedUseSettlement?.length ? `<label><input name="restoreLimitedUses" type="checkbox" /> ${loc`No replacement result or other activation effect remains; restore this activation’s recorded limited uses`}</label>` : ""}<label>${loc`Resolution`} <input name="resolution" required /></label><label><input name="healthReviewed" type="checkbox" /> ${loc`The GC reviewed actual health, action state and action-die balances and completed any required corrections`}</label></div>`
        });
        if (!input) return null;
      }
      return queueResources([this], async () => {
        if (!game.user?.isGM) throw new Error(loc`Only the GC may review an interrupted action-die settlement.`);
        if (JSON.stringify(state()) !== expected)
          throw new Error(loc`Health, dice or the saved review changed. Review the current values again.`);
        const review = getActionDieSettlementReview(this),
          p = review.payment,
          pool = p.bonusPoolId ? this.system.bonusActionDice?.[p.bonusPoolId] : null,
          balance = Number(input.balance);
        if (
          input.healthReviewed !== true ||
          typeof input.resolution !== "string" ||
          !input.resolution.trim() ||
          !Number.isSafeInteger(balance) ||
          balance < 0
        )
          throw new Error(loc`The GC must confirm the corrected whole-die balance and record the resolution.`);
        if (p.bonusPoolId && (actionDicePoolFingerprint(pool) !== p.poolFingerprint || balance > pool.granted))
          throw new Error(loc`The original bonus grant changed or the confirmed balance exceeds its grant.`);
        const useUpdates = {};
        if (input.restoreLimitedUses === true) {
          const rows = review.limitedUseSettlement;
          if (!Array.isArray(rows) || !rows.length || new Set(rows.map(r => r.id)).size !== rows.length)
            throw new Error(loc`Review the recorded limited-use sources.`);
          for (const row of rows) {
            const valid = v => v && typeof v.epoch === "string" && Number.isSafeInteger(v.used) && v.used >= 0;
            if (
              typeof row.id !== "string" ||
              !/^[A-Za-z0-9_%:-]+$/.test(row.id) ||
              !valid(row.reserved) ||
              (row.before !== null && !valid(row.before)) ||
              (row.before?.epoch === row.reserved.epoch && row.before.used !== row.reserved.used - 1) ||
              JSON.stringify(this.system.resourceUses?.[row.id]) !== JSON.stringify(row.reserved)
            )
              throw new Error(
                loc`The limited-use source changed or its saved restoration is invalid. Review its current count.`
              );
            Object.assign(
              useUpdates,
              this.actorRecordRestorePatch(
                "system.resourceUses." + row.id,
                row.before === null ? undefined : row.before
              )
            );
          }
        }
        const completed = {
          ...review,
          limitedUsesRestored: input.restoreLimitedUses === true,
          needsReview: false,
          resolvedAt: game.time?.worldTime ?? this.system.worldTime ?? 0,
          reviewedBy: game.user.id ?? "GC",
          resolution: input.resolution.trim(),
          settledBalance: balance
        };
        const patch = {
          ...useUpdates,
          [p.paymentPath]: balance,
          ...(review.grantReview === true && p.bonusPoolId
            ? { ["system.bonusActionDice." + p.bonusPoolId + ".needsReview"]: false }
            : {}),
          "flags.spycraft2.actionDiceSettlementReview": completed
        };
        try {
          await this.update(patch);
        } catch (error) {
          if (JSON.stringify(this.flags?.spycraft2?.actionDiceSettlementReview) !== JSON.stringify(completed))
            throw error;
        }
        clearPendingActionDieReview(this, review.id);
        this.system.actionDiceSettlementReview = completed;
        return completed;
      });
    }

    async markActionDiceSettlementReview(payment, error, details = {}) {
      if (payment.payments) return markMultipartActionDieReview(this, payment, error, details);
      const review = {
        id:
          globalThis.foundry?.utils?.randomID?.() ??
          "settlement-" + (this._settlementSequence = (this._settlementSequence ?? 0) + 1),
        needsReview: true,
        at: game.time?.worldTime ?? this.system.worldTime ?? 0,
        reason: error.message,
        payment: {
          count: payment.count,
          balance: payment.balance,
          paymentPath: payment.paymentPath,
          bonusPoolId: payment.bonusPoolId,
          die: payment.die,
          label: payment.label,
          poolFingerprint: payment.poolFingerprint ?? null
        },
        ...details
      };
      setPendingActionDieReview(this, review);
      try {
        await this.update(this.actorRecordRestorePatch("flags.spycraft2.actionDiceSettlementReview", review));
      } catch {}
      ui.notifications.warn(
        details.grantReview
          ? loc`The bonus-die grant needs GC review. Its mission use remains spent; review the grant and receipt.`
          : loc`The action-die settlement needs GC review. Its reserved dice remain spent; review health and the selected balance before retrying.`
      );
      return review;
    }

    actionDiceSurchargeControl(options = {}) {
      return surchargeFundingControl(this, options) + (options.unrolled ? unrolledPaymentFundingControl(this) : "");
    }

    spendActionDiceBenefit(baseCost, perform, options = {}) {
      return queueResources([this], () => this.payActionDiceBenefitLocked(baseCost, perform, options));
    }

    payActionDiceBenefitLocked(baseCost, perform, options = {}) {
      return payActionDieBenefitLocked(this, baseCost, perform, options);
    }

    spendMultipartActionDice(allocations, perform, options = {}) {
      return queueResources([this], () => this.payMultipartActionDiceLocked(allocations, perform, options));
    }

    payMultipartActionDiceLocked(allocations, perform, options = {}) {
      return payMultipartActionDiceLocked(this, allocations, perform, options);
    }

    spendActionDice(count, perform, options = {}) {
      return queueResources([this], () => this.payActionDiceLocked(count, perform, options));
    }

    /** Caller must already hold this actor's resource transaction. */
    async payActionDiceLocked(count, perform, { bonusPoolId = "" } = {}) {
      if (!this.isOwner) throw new Error(loc`You must own the actor spending action dice.`);
      const payment = actionDicePaymentPlan(this.actionDiceFundingSystem, {
        count,
        bonusPoolId,
        periods: this.usagePeriods
      });
      if (payment.blocked) return refuse(payment.reason);
      try {
        await this.update({ [payment.paymentPath]: payment.afterBalance });
      } catch (error) {
        const balance = bonusPoolId
          ? this.system.bonusActionDice?.[bonusPoolId]?.remaining
          : this.system.actionDice.value;
        if (balance === payment.afterBalance)
          try {
            await this.refundActionDicePayment(payment);
          } catch (rollback) {
            await this.markActionDiceSettlementReview(payment, rollback, { purpose: "payment reservation" });
            throw new AggregateError([error, rollback], loc`Review the interrupted payment reservation.`);
          }
        else if (balance !== payment.balance)
          await this.markActionDiceSettlementReview(payment, error, { purpose: "payment reservation" });
        throw error;
      }
      try {
        return await perform(payment);
      } catch (error) {
        if (error.actionDiceSettlementReview) {
          await this.markActionDiceSettlementReview(payment, error, error.actionDiceSettlementReview);
          throw error;
        }
        try {
          await this.refundActionDicePayment(payment);
        } catch (rollback) {
          await this.markActionDiceSettlementReview(payment, rollback, { purpose: "payment refund" });
          throw new AggregateError([error, rollback], loc`The selected action-die balance needs review.`);
        }
        throw error;
      }
    }

    async markActionDieAwardReview(transaction, error) {
      const review = {
        needsReview: true,
        transaction: structuredClone(transaction),
        reason: error.message,
        at: game.time?.worldTime ?? 0
      };
      try {
        await this.update(this.actorRecordRestorePatch("flags.spycraft2.actionDieAwardReview", review));
      } catch {}
      ui.notifications.warn(
        loc`The award needs GC review before awarding or spending more dice. Check player dice, the award ledger and the GC action dice.`
      );
      return review;
    }

    async awardActionDice(options = {}) {
      if (!game.user?.isGM) throw new Error(loc`Only the GC can award action dice.`);
      if (this.type !== "agent" || !this.isOwner) return null;
      if (this.flags?.spycraft2?.missionXPReview?.needsReview)
        throw new Error(loc`Review the interrupted mission XP settlement before recording more awards.`);
      if (this.flags?.spycraft2?.actionDieAwardReview?.needsReview)
        throw new Error(loc`Review the interrupted award before adding another award.`);
      let input = options;
      if (!Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: loc`Award roleplay action dice` },
          rejectClose: false,
          content: `<p>${loc`Ordinary GC awards add player dice, one GC die per awarded die, and counts for mission XP settlement. Bonus dice from abilities use their own rules.`}</p><label>${loc`Dice awarded`} <input name="count" type="number" min="1" step="1" value="1" required /></label><label>${loc`Reason`} <input name="reason" required /></label>`
        });
        if (!input) return null;
      }
      return queueResources([this], () =>
        withGCDicePool(async pool => {
          if (this.flags?.spycraft2?.missionXPReview?.needsReview)
            throw new Error(loc`Review the interrupted mission XP settlement before recording more awards.`);
          if (!game.user?.isGM || this.flags?.spycraft2?.actionDieAwardReview?.needsReview)
            throw new Error(loc`Only the GC may award dice after resolving any interrupted award.`);
          const id = foundry.utils.randomID(),
            periods = this.usagePeriods,
            plan = actionDieAwardPlan(this.system, {
              count: Number(input.count ?? 1),
              reason: input.reason,
              careerDie: globalThis.CONFIG?.SPYCRAFT?.tables?.levels?.[this.system.level ?? 0]?.actionDie ?? 4,
              mission: periods.mission ?? "initial",
              session: periods.session ?? "initial",
              id,
              at: Date.now()
            }),
            value = pool.value + plan.gcGain;
          if (!Number.isSafeInteger(value)) throw new Error(loc`The GC balance exceeds a safe whole number.`);
          const beforeLedger = structuredClone(this.system.actionDieAwards?.[plan.key] ?? null),
            beforeBalance = this.system.actionDice.value,
            next = { ...pool, value, lastReason: loc`Player action-die award: ${this.name}` },
            transaction = {
              id,
              key: plan.key,
              mission: String(periods.mission ?? "initial"),
              session: String(periods.session ?? "initial"),
              units: plan.units,
              count: plan.count,
              die: plan.die,
              beforeBalance,
              beforeLedger,
              afterLedger: plan.record,
              gcBefore: pool,
              gcAfter: next
            },
            ledger = () => this.system.actionDieAwards?.[plan.key] ?? null,
            gc = () => game.settings.get("spycraft2", "gcActionDice");
          try {
            await this.update({
              "system.actionDice.value": plan.value,
              ...this.actorRecordRestorePatch("system.actionDieAwards." + plan.key, plan.record)
            });
          } catch (error) {
            if (!same(ledger(), plan.record)) {
              if (!same(ledger(), beforeLedger) || this.system.actionDice.value !== beforeBalance)
                await this.markActionDieAwardReview(transaction, error);
              throw error;
            }
          }
          try {
            try {
              await game.settings.set("spycraft2", "gcActionDice", next);
            } catch (error) {
              if (!same(gc(), next)) throw error;
            }
            try {
              await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: this }),
                content: loc`${foundry.utils.escapeHTML(this.name)} receives ${plan.units} d${plan.die} action dice from ${plan.count} GC awards; GC action dice +${plan.gcGain}. ${foundry.utils.escapeHTML(String(input.reason).trim())} Award count recorded for mission XP settlement.`,
                flags: {
                  spycraft2: {
                    actorUuid: this.uuid,
                    checkKind: "actionDieAward",
                    awardId: id,
                    count: plan.count,
                    units: plan.units,
                    die: plan.die,
                    actionDiceAllowed: false
                  }
                }
              });
            } catch (error) {
              if (
                ![...(game.messages ?? [])].some(
                  m => m.flags?.spycraft2?.actorUuid === this.uuid && m.flags?.spycraft2?.awardId === id
                )
              )
                throw error;
            }
            return plan;
          } catch (error) {
            if (
              !same(ledger(), plan.record) ||
              !Number.isSafeInteger(this.system.actionDice.value) ||
              this.system.actionDice.value < plan.units ||
              (!same(gc(), pool) && !same(gc(), next))
            ) {
              await this.markActionDieAwardReview(transaction, error);
              throw error;
            }
            const balance = this.system.actionDice.value - plan.units,
              updates = {
                "system.actionDice.value": balance,
                ...this.actorRecordRestorePatch(
                  "system.actionDieAwards." + plan.key,
                  beforeLedger === null ? undefined : beforeLedger
                )
              };
            try {
              await this.update(updates);
            } catch (rollback) {
              if (this.system.actionDice.value !== balance || !same(ledger(), beforeLedger)) {
                await this.markActionDieAwardReview(transaction, rollback);
                throw new AggregateError([error, rollback], loc`The player award could not be safely restored.`);
              }
            }
            if (same(gc(), next))
              try {
                await game.settings.set("spycraft2", "gcActionDice", pool);
              } catch (rollback) {
                if (!same(gc(), pool)) {
                  await this.markActionDieAwardReview(transaction, rollback);
                  throw new AggregateError([error, rollback], loc`The GC award could not be safely restored.`);
                }
              }
            throw error;
          }
        })
      );
    }

    async reviewActionDieAward(options = {}) {
      if (!game.user?.isGM) throw new Error(loc`Only the GC may review an interrupted award.`);
      if (this.type !== "agent" || !this.isOwner) return null;
      const saved = this.flags?.spycraft2?.actionDieAwardReview;
      if (!saved?.needsReview) return null;
      const tx = saved.transaction,
        key = tx && encodeURIComponent(String(tx.mission)).replaceAll(".", "%2E");
      if (
        !tx ||
        tx.key !== key ||
        !tx.id ||
        !Array.isArray(tx.afterLedger?.events) ||
        !tx.afterLedger.events.some(e => e.id === tx.id) ||
        tx.afterLedger.mission !== tx.mission ||
        !Number.isSafeInteger(tx.afterLedger.count) ||
        tx.afterLedger.count < 1
      )
        throw new Error(loc`Review the saved award source before reconciling it.`);
      const state = () => ({
          review: this.flags?.spycraft2?.actionDieAwardReview,
          player: this.system.actionDice.value,
          ledger: this.system.actionDieAwards?.[key] ?? null,
          gc: game.settings.get("spycraft2", "gcActionDice")
        }),
        expected = JSON.stringify(state());
      let input = options;
      if (input.confirmed === undefined) {
        const current = state(),
          esc = foundry.utils.escapeHTML;
        input = await systemDialog.input({
          window: { title: loc`Review interrupted award` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${esc(saved.reason)}</p><p>${loc`Review the actual player dice, recorded award, GC action dice and any posted receipt. Initialize this session’s GC action dice first if the session changed.`}</p><label>${loc`Award`} <select name="retainAward"><option value="retain">${loc`Retain this award in the mission XP ledger`}</option><option value="cancel">${loc`Cancel this award in the mission XP ledger`}</option></select></label><label>${loc`Confirmed player dice`} <input name="playerBalance" type="number" min="0" step="1" value="${current.player}" /></label><label>${loc`Confirmed GC dice`} <input name="gcBalance" type="number" min="0" step="1" value="${current.gc?.value ?? 0}" /></label><label>${loc`Resolution`} <input name="resolution" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC reviewed the award, actual balances and receipt`}</label></div>`
        });
        if (!input) return null;
        input = {
          ...input,
          retainAward: input.retainAward === "retain" ? true : input.retainAward === "cancel" ? false : null
        };
      }
      return queueResources([this], () =>
        withGCDicePool(
          async pool => {
            if (!game.user?.isGM) throw new Error(loc`Only the GC may review an interrupted award.`);
            if (JSON.stringify(state()) !== expected)
              throw new Error(loc`The award or balances changed. Review the current values again.`);
            const number = v => (typeof v === "string" && !v.trim() ? NaN : Number(v)),
              playerBalance = number(input.playerBalance),
              gcBalance = number(input.gcBalance);
            if (
              input.confirmed !== true ||
              typeof input.retainAward !== "boolean" ||
              ![playerBalance, gcBalance].every(v => Number.isSafeInteger(v) && v >= 0) ||
              typeof input.resolution !== "string" ||
              !input.resolution.trim()
            )
              throw new Error(loc`Confirm the award disposition, whole-die balances and resolution.`);
            const current = this.system.actionDieAwards?.[key] ?? null;
            if (!same(current, tx.beforeLedger) && !same(current, tx.afterLedger))
              throw new Error(
                loc`The mission award ledger changed; review its other entries before restoring this award.`
              );
            await this.update({
              "system.actionDice.value": playerBalance,
              ...this.actorRecordRestorePatch(
                "system.actionDieAwards." + key,
                input.retainAward ? tx.afterLedger : tx.beforeLedger === null ? undefined : tx.beforeLedger
              )
            });
            const next = { ...pool, value: gcBalance, lastReason: "Reviewed interrupted award: " + this.name };
            try {
              await game.settings.set("spycraft2", "gcActionDice", next);
            } catch (error) {
              if (!same(game.settings.get("spycraft2", "gcActionDice"), next)) throw error;
            }
            const completed = {
              ...saved,
              needsReview: false,
              retained: input.retainAward,
              playerBalance,
              gcBalance,
              resolution: input.resolution.trim(),
              reviewedBy: game.user.id ?? "GC",
              resolvedAt: game.time?.worldTime ?? 0
            };
            try {
              await this.update(this.actorRecordRestorePatch("flags.spycraft2.actionDieAwardReview", completed));
            } catch (error) {
              if (!same(this.flags?.spycraft2?.actionDieAwardReview, completed)) throw error;
            }
            return completed;
          },
          { allowAwardReview: true }
        )
      );
    }

    async settleMissionXP(options = {}) {
      if (this.flags?.spycraft2?.missionXPReview?.needsReview)
        throw new Error(loc`Review the interrupted mission XP settlement before settling again.`);
      if (this.flags?.spycraft2?.actionDieAwardReview?.needsReview)
        throw new Error(loc`Review the interrupted award before settling mission XP.`);
      if (!game.user?.isGM) throw new Error(loc`Only the GC can settle mission XP.`);
      if (this.type !== "agent" || !this.isOwner) return null;
      const settlementContext = () => {
          const mission = String(this.usagePeriods.mission ?? "initial"),
            key = encodeURIComponent(mission).replaceAll(".", "%2E");
          return JSON.stringify({
            mission,
            level: this.system.level,
            xp: this.system.xp,
            awards: this.system.actionDieAwards?.[key] ?? null,
            reward: this.system.missionXPRewards?.[key] ?? null
          });
        },
        expectedContext = settlementContext();
      let input = options;
      if (!Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: loc`Settle mission XP — p.440` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Base mission XP gains 25 per awarded action die, capped at 25 × Career Level. Multiply that combined base by the lower of Career Level and Threat Level. Current award count: ${this.system.actionDieAwardSummary?.count ?? 0}.`}</p><label>${loc`Base mission XP before action-die awards`} <input type="number" name="baseXP" min="0" value="${missionSettlementDefaults().baseXP}" required /></label><label>${loc`Team Threat Level`} <input type="number" name="threatLevel" min="1" value="${missionSettlementDefaults().threatLevel ?? Math.max(1, this.system.level)}" required /></label><label>${loc`Additional post-multiplier XP`} <input type="number" name="additionalXP" min="0" value="0" /></label><label>${loc`Source of additional XP`} <input name="modifierReason" placeholder="${loc`GC-calculated Crossroads, Triumph or other bonus`}" /></label><p>${loc`Crossroads and Triumph percentages are not calculated by this control. Review their eligibility and rounding, then enter their final XP contribution above. A Crossroads Title first earned this mission starts its benefits next mission.`}</p><label><input type="checkbox" name="missionCompleteConfirmed" /> ${loc`The mission has ended; all post-multiplier modifiers were reviewed and included`}</label></div>`
        });
        if (!input) return null;
      }
      return queueResources([this], async () => {
        if (!game.user?.isGM) throw new Error(loc`Only the GC can settle mission XP.`);
        if (this.flags?.spycraft2?.missionXPReview?.needsReview)
          throw new Error(loc`Review the interrupted mission XP settlement before settling again.`);
        if (this.flags?.spycraft2?.actionDieAwardReview?.needsReview)
          throw new Error(loc`Review the interrupted award before settling mission XP.`);
        if (settlementContext() !== expectedContext)
          throw new Error(
            loc`Mission, level, XP or award counts changed while settlement was being prepared. Review the current mission.`
          );
        const mission = this.usagePeriods.mission ?? "initial",
          plan = missionXPPlan(this.system, {
            baseXP: Number(input.baseXP ?? 0),
            threatLevel: Number(input.threatLevel ?? 1),
            additionalXP: Number(input.additionalXP ?? 0),
            modifierReason: input.modifierReason,
            missionCompleteConfirmed: !!input.missionCompleteConfirmed,
            mission,
            at: Date.now()
          });
        const settlementId = foundry.utils.randomID(),
          record = { ...plan.record, settlementId },
          beforeXP = this.system.xp,
          current = () => this.system.missionXPRewards?.[plan.key] ?? null,
          transaction = { id: settlementId, key: plan.key, mission: String(mission), beforeXP, record };
        const markReview = async error => {
          try {
            await this.update(
              this.actorRecordRestorePatch("flags.spycraft2.missionXPReview", {
                needsReview: true,
                transaction,
                reason: error.message,
                at: game.time?.worldTime ?? 0
              })
            );
          } catch {}
          ui.notifications.warn(
            loc`The mission XP settlement needs GC review. Check actual XP and the recorded mission reward before retrying.`
          );
        };
        try {
          await this.update({
            "system.xp": plan.xp,
            ...this.actorRecordRestorePatch("system.missionXPRewards." + plan.key, record)
          });
        } catch (error) {
          if (!same(current(), record)) {
            if (current() !== null || this.system.xp !== beforeXP) await markReview(error);
            throw error;
          }
        }
        try {
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: loc`Mission XP: (${plan.record.baseXP} base + ${plan.record.awardBaseBonus} action-die award base XP) × ${plan.record.multiplier} + ${plan.record.additionalXP} declared post-multiplier XP = ${plan.record.totalXP} XP. ${foundry.utils.escapeHTML(plan.record.modifierReason)}`,
            flags: { spycraft2: { actorUuid: this.uuid, checkKind: "missionXP", ...record, actionDiceAllowed: false } }
          });
        } catch (error) {
          if (
            [...(game.messages ?? [])].some(
              m =>
                m.flags?.spycraft2?.actorUuid === this.uuid &&
                m.flags?.spycraft2?.checkKind === "missionXP" &&
                m.flags.spycraft2.settlementId === settlementId
            )
          )
            return record;
          if (!same(current(), record) || !Number.isSafeInteger(this.system.xp) || this.system.xp < record.totalXP) {
            await markReview(error);
            throw error;
          }
          const restoredXP = this.system.xp - record.totalXP;
          try {
            await this.update({ "system.xp": restoredXP, [`system.missionXPRewards.-=${plan.key}`]: null });
          } catch (rollback) {
            if (this.system.xp !== restoredXP || current() !== null) {
              await markReview(rollback);
              throw new AggregateError([error, rollback], loc`The mission XP could not be safely restored.`);
            }
          }
          throw error;
        }
        return record;
      });
    }

    async reviewMissionXP(options = {}) {
      if (!game.user?.isGM) throw new Error(loc`Only the GC may review an interrupted XP settlement.`);
      if (this.type !== "agent" || !this.isOwner) return null;
      const saved = this.flags?.spycraft2?.missionXPReview;
      if (!saved?.needsReview) return null;
      const tx = saved.transaction,
        key = tx && encodeURIComponent(String(tx.mission)).replaceAll(".", "%2E");
      if (
        !tx ||
        tx.key !== key ||
        !tx.id ||
        tx.record?.settlementId !== tx.id ||
        tx.record?.mission !== tx.mission ||
        !Number.isSafeInteger(tx.record.totalXP) ||
        tx.record.totalXP < 0
      )
        throw new Error(loc`Review the saved mission XP source before reconciling it.`);
      const r = tx.record,
        whole = v => Number.isSafeInteger(v) && v >= 0,
        baseBonus = 25 * Math.min(r.awardedDice, r.level),
        multiplier = Math.min(r.level, r.threatLevel);
      if (
        ![r.baseXP, r.awardedDice, r.additionalXP, r.totalXP].every(whole) ||
        !Number.isSafeInteger(r.level) ||
        r.level < 1 ||
        r.level > 20 ||
        !Number.isSafeInteger(r.threatLevel) ||
        r.threatLevel < 1 ||
        r.awardBaseBonus !== baseBonus ||
        r.combinedBase !== r.baseXP + baseBonus ||
        r.multiplier !== multiplier ||
        r.coreXP !== (r.baseXP + baseBonus) * multiplier ||
        r.totalXP !== r.coreXP + r.additionalXP ||
        r.source !== "p.440 (user-confirmed)"
      )
        throw new Error(loc`The saved mission XP formula is invalid; review its source before restoring it.`);
      const state = () => ({
          review: this.flags?.spycraft2?.missionXPReview,
          xp: this.system.xp,
          reward: this.system.missionXPRewards?.[key] ?? null
        }),
        expected = JSON.stringify(state());
      let input = options;
      if (input.confirmed === undefined) {
        input = await systemDialog.input({
          window: { title: loc`Review interrupted mission XP` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${foundry.utils.escapeHTML(saved.reason)}</p><label>${loc`Mission reward`} <select name="retainSettlement"><option value="retain">${loc`Retain the recorded mission settlement`}</option><option value="cancel">${loc`Cancel this settlement`}</option></select></label><label>${loc`Confirmed total XP`} <input name="xp" type="number" min="0" step="1" value="${this.system.xp}" /></label><label>${loc`Resolution`} <input name="resolution" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC reviewed actual XP, mission reward and any posted receipt`}</label><p>${loc`This sets the confirmed XP balance; it does not add the reward again.`}</p></div>`
        });
        if (!input) return null;
        input = {
          ...input,
          retainSettlement:
            input.retainSettlement === "retain" ? true : input.retainSettlement === "cancel" ? false : null
        };
      }
      return queueResources([this], async () => {
        if (!game.user?.isGM) throw new Error(loc`Only the GC may review an interrupted XP settlement.`);
        if (JSON.stringify(state()) !== expected)
          throw new Error(loc`XP or the saved mission settlement changed. Review the current values.`);
        const xp = typeof input.xp === "string" && !input.xp.trim() ? NaN : Number(input.xp);
        if (
          input.confirmed !== true ||
          typeof input.retainSettlement !== "boolean" ||
          !Number.isSafeInteger(xp) ||
          xp < 0 ||
          typeof input.resolution !== "string" ||
          !input.resolution.trim()
        )
          throw new Error(loc`Confirm the whole XP balance, settlement disposition and resolution.`);
        const current = this.system.missionXPRewards?.[key] ?? null;
        if (current !== null && !same(current, tx.record))
          throw new Error(loc`The mission reward changed; preserve it for review.`);
        const completed = {
            ...saved,
            needsReview: false,
            retained: input.retainSettlement,
            xp,
            resolution: input.resolution.trim(),
            reviewedBy: game.user.id ?? "GC",
            resolvedAt: game.time?.worldTime ?? 0
          },
          target = input.retainSettlement ? tx.record : null;
        try {
          await this.update({
            "system.xp": xp,
            ...this.actorRecordRestorePatch("system.missionXPRewards." + key, target === null ? undefined : target),
            ...this.actorRecordRestorePatch("flags.spycraft2.missionXPReview", completed)
          });
        } catch (error) {
          if (
            this.system.xp !== xp ||
            !same(this.system.missionXPRewards?.[key] ?? null, target) ||
            !same(this.flags?.spycraft2?.missionXPReview, completed)
          )
            throw error;
        }
        return completed;
      });
    }

    resetActionDice() {
      throw new Error(loc`Starting action dice refresh when the GC starts a new session. Use the new-session control.`);
    }

    recoverResourceTransaction() {
      return recoverResourceTransaction(this, {
        scope: [...(this.items ?? [])].some(i => i.id === RULE_RESOURCE_LOCK_ID && isResourceLock(i))
          ? RULE_RESOURCE_LOCK_ID
          : undefined
      });
    }
  };
