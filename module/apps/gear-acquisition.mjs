import { esc } from "../html.mjs";
export {
  settleFavoredGearSession,
  reviewFavoredGearSession,
  recordFavoredGearLevelChoices
} from "./favored-gear-session.mjs";
import { refuse, refuseStep } from "../error-notices.mjs";
import { requestBenefitContext } from "../rules/requests.mjs";
import { gearCheckPlan } from "../rules/gear-checks.mjs";
import { shakenRules } from "../rules/shaken.mjs";
import { getActionDieSettlementReview } from "../rules/action-die-payments.mjs";
import {
  reserveTransaction,
  reserveReservationMatches,
  reserveUntouched,
  reserveRollbackPatch
} from "../rules/reserve-transactions.mjs";
import { requireSettledReserve, holdReserveReview } from "./reserve-review.mjs";
import { rollEvidence, rollEvidenceMatches } from "../rules/outcomes.mjs";
import { actionDiceFundingContext, actionDicePaymentPlan, unrestrictedBonusPools } from "../rules/bonus-pools.mjs";
import { queueResources, isResourceLock } from "../services/transactions.mjs";
import {
  PICK_CATEGORIES,
  DELIVERY,
  currentReserves,
  provisionalReserves,
  missionEpoch,
  reserveInitialization,
  gearAcquisitionPlan,
  acquisitionOutcome,
  requestFeatBonus,
  officeGossipTake10
} from "../rules/gear-acquisition.mjs";
import { equipmentCategory } from "../rules/gear.mjs";
import { loc } from "../i18n.mjs";
import { sameValues as same } from "../rules/equal.mjs";
import { systemDialog } from "./dialog-theme.mjs";
import { postedReceipt } from "../services/message-lookup.mjs";
const queued = (actor, work, options) => queueResources([actor], work, options);
const crossQueued = (actor, actors, work) => queueResources([actor, ...actors], work);
const owned = actor => actor?.type === "agent" && actor.isOwner;
export async function allocateMissionReserves(actor, options = {}) {
  if (!owned(actor)) return null;
  let input = options;
  if (!Object.keys(input).length) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Unassigned mission reserves` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options">
   <p>${loc`At the end of the Intel Phase, keep unchosen picks and Common Items up to your Wisdom modifier: ${actor.system.reserveCapacity}. Named gear already selected is counted separately.`}</p>
   ${PICK_CATEGORIES.map(key => `<label>${loc`${key} picks (${actor.system.gearPicks?.[key]?.remaining ?? 0} unchosen)`} <input type="number" name="pick_${key}" min="0" value="0" /></label>`).join("")}
   <details><summary>${loc`Categories for reserved Charisma picks (set during Intel)`}</summary>${(actor.system.affiliationType === "freelance" ? ["E", "S", "V", "W"] : ["G", "T", "V", "R"]).map(k => `<label>${loc`CHA → ${k}`} <input type="number" name="cha_${k}" min="0" value="0" /></label>`).join("")}</details>
   <label>${loc`Reserve Common Items`} <input type="number" name="common" min="0" value="0" /></label>
   <label>${loc`Mission Caliber`} <input type="number" name="caliber" min="1" max="5" value="1" /></label>
   <label><input type="checkbox" name="procureAtIntel" /> ${loc`Procure: Intel takes place in a city of 10,000+ people with quick contact; hold two additional reserves`}</label>
   <label><input type="checkbox" name="intelComplete" /> ${loc`The Intel Phase is complete; these are this mission’s unchosen reserves`}</label></div>`
    });
    if (!input) return null;
    input.charismaPicks = Object.fromEntries(
      PICK_CATEGORIES.filter(k => k !== "CHA").map(k => [k, Number(input["cha_" + k] ?? 0)])
    );
    input.picks = Object.fromEntries(PICK_CATEGORIES.map(k => [k, Number(input["pick_" + k] ?? 0)]));
  }
  return queued(actor, async () => {
    requireSettledReserve(actor);
    const record = reserveInitialization(
        actor.system,
        actor.items.filter(i => !isResourceLock(i)),
        { ...input, common: Number(input.common ?? 0), caliber: Number(input.caliber ?? 1) }
      ),
      before = actor.system.missionReserves;
    const changes = { "system.missionReserves": record };
    if (before) {
      if (before.epoch !== record.epoch || before.initialized !== false)
        changes["system.missionReserveHistory"] = [
          ...(actor.system.missionReserveHistory ?? []),
          structuredClone(before)
        ];
      for (const id of Object.keys(before.attempts ?? {}))
        if (!Object.hasOwn(record.attempts, id)) changes[`system.missionReserves.attempts.-=${id}`] = null;
    }
    try {
      await actor.update(changes);
    } catch (error) {
      if (
        !Object.entries(record).every(([key, value]) => same(actor.system.missionReserves?.[key], value)) ||
        (changes["system.missionReserveHistory"] &&
          !same(actor.system.missionReserveHistory, changes["system.missionReserveHistory"]))
      )
        throw error;
    }
    return record;
  });
}
export async function rollGearAcquisition(actor, options = {}) {
  if (!owned(actor)) return null;
  requireSettledReserve(actor);
  let input = options;
  const expectedShaken = JSON.stringify(shakenRules(actor.actionDiceFundingSystem));
  if (Object.keys(input).every(key => key === "requestAbility")) {
    const selectedAbility = input.requestAbility ?? "";
    const funders = [...(game.actors ?? [])].filter(a => a.type === "agent" && a.isOwner);
    const record =
      currentReserves(actor.system) ??
      (actor.system.activeFeatNames?.includes("Personal Stash") ||
      actor.system.limitedUses?.some(source => source.freePick)
        ? provisionalReserves(
            actor.system,
            actor.system.activeFeatNames?.includes("Personal Stash") ? "personalStash" : "originFreePick"
          )
        : null);
    if (!record) return refuse(loc`Allocate this mission’s unassigned reserves first.`);
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Request or Gear check` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options">
   ${record.initialized === false ? `<p>${loc`An earned free origin Resource pick or Personal Stash does not need a Reserve allocation. Allocate mission reserves before making ordinary Gear checks or Requests.`}</p>` : ""}
   <label>${loc`Check`} <select name="kind"><option value="request">${loc`Request a gear pick`}</option><option value="common">${loc`Gear check for a Common Item`}</option></select></label>
   <label>${loc`Request benefit`} <select name="requestAbility"><option value="">${loc`Ordinary Request`}</option>${(
     actor.system.limitedUses ?? []
   )
     .filter(s => s.workflow === "requestBenefit")
     .map(s => `<option value="${esc(s.id)}" ${selectedAbility === s.id ? "selected" : ""}>${esc(s.name)}</option>`)
     .join("")}</select></label>
   <label><input type="checkbox" name="networkConfirmed" /> ${loc`Automatic Request: the GC confirms our network can fulfill this Request`}</label>
   <label><input type="checkbox" name="hourAvailable" /> ${loc`Spend one hour preparing: Sources consultation (in person/by phone) or Behind the Scenes city supporters`}</label>
   <label>${loc`Sources option`} <select name="sourcesOption"><option value="">${loc`Select only with Sources`}</option><option value="dossier">${loc`Dossier (Sources I+)`}</option><option value="skillTraining">${loc`Skill training (Sources II+)`}</option><option value="legalImmunity">${loc`Legal immunity (Sources III)`}</option></select></label>
   <label><input type="checkbox" name="sourcesOptionConfirmed" /> ${loc`The GC confirms this is that actual Resource option (Sources only)`}</label>
   <label>${loc`Free origin Resource`} <select name="originResource"><option value="">${loc`Select only with Privileged or Rescuer`}</option><option value="legalImmunity">${loc`Privileged: Caliber II legal immunity`}</option><option value="medicalAssistance">${loc`Rescuer: Caliber II medical assistance`}</option></select></label>
   <label><input type="checkbox" name="originResourceConfirmed" /> ${loc`The GC confirms the exact Resource and its Caliber II source. This benefit works in any mission and consumes no Reserve pick.`}</label>
   <label>${loc`Exact item or option`} <input name="name" required /></label>
   <label>${loc`Reserve pick`} <select name="pick"><option value="">${loc`No Reserve pick (free origin benefit only)`}</option>${PICK_CATEGORIES.map(k => `<option value="${k}">${loc`${k}: ${record.picks[k] ?? 0} remaining`}</option>`).join("")}</select></label>
   <label>${loc`Requested category`} <select name="category">${PICK_CATEGORIES.filter(k => k !== "CHA")
     .map(k => `<option value="${k}">${k}</option>`)
     .join("")}</select></label>
   <label>${loc`Requested Caliber`} <input type="number" name="caliber" min="1" max="${actor.system.activeFeatNames?.includes("Total Control") ? 5 : 4}" value="1" /></label>
   <label>${loc`Location`} <select name="location">${Object.entries(DELIVERY)
     .map(([key, d]) => `<option value="${key}">${esc(d.label)}: ${d.formula} ${d.unit}</option>`)
     .join("")}</select></label>
   <label><input type="checkbox" name="notIntel" /> ${loc`We are in the field, after the Intel Phase`}</label>
   <label><input type="checkbox" name="homeTurf" /> ${loc`Request is within my home turf: five-block urban radius or one-mile wilderness radius of home (Local Hero)`}</label>
   <label><input type="checkbox" name="rapidCommunication" /> ${loc`Request: rapid communication is available`}</label>
   <label><input type="checkbox" name="minuteAvailable" /> ${loc`Request: spend one full minute communicating`}</label>
   <label><input type="checkbox" name="useProcure" /> ${loc`Use earned Procure in a qualifying city: Request as mission Caliber +1, maximum IV, and half delivery time`}</label>
   <label><input type="checkbox" name="categoryConfirmed" /> ${loc`Request: the GC confirms category and Faction availability`}</label>
   ${actor.system.activeFeatNames?.includes("Office Gossip") ? `<label><input type="checkbox" name="requestTake10" /> ${loc`Request: take 10 (Office Gossip)`}</label>` : ""}
   ${actor.system.activeFeatNames?.includes("Personal Stash") ? `<label><input type="checkbox" name="atHome" /> ${loc`This Gear check is made inside my home (Personal Stash; distinct from Home Turf)`}</label><label><input type="checkbox" name="usePersonalStash" /> ${loc`Use Personal Stash: one Gear check per session without spending a Reserve Common Item`}</label>` : ""}
   <label><input type="checkbox" name="commonConfirmed" /> ${loc`Gear check: the GC confirms this is a Common Item`}</label>
   <details><summary>${loc`Shared Request funding (optional)`}</summary><p>${loc`Leave all zero to pay the full cost from your ordinary dice. Otherwise contributions must total the base Request cost after waivers plus the requester’s Shaken surcharge. Teammates may pay any portion of this total.`}</p>${funders
     .map(
       a =>
         `<label>${loc`${esc(a.name)}: ordinary dice (${a.system.actionDice.value})`} <input type="number" name="fund_${a.id}" min="0" value="0" /></label>${unrestrictedBonusPools(
           a.actionDiceFundingSystem,
           a.usagePeriods
         )
           .filter(p => p.available)
           .map(
             p =>
               `<label>${esc(a.name)}: ${esc(p.label)} (${p.available} d${p.die}) <input type="number" name="fundPool_${a.id}_${p.id}" min="0" value="0" /></label>`
           )
           .join("")}`
     )
     .join(
       ""
     )}<label><input type="checkbox" name="teammatesConfirmed" /> ${loc`Other funders are teammates`}</label></details>
   <p>${loc`Sources uses one hour consulting contacts in person or by phone, its earned Resource option, and class level in place of Career Level.`}</p>
   <p>${loc`Current Shaken surcharge for a Request: ${shakenRules(actor.actionDiceFundingSystem).extraDice} action dice, including after a class/origin cost waiver. An ordinary Request consumes its Reserve pick. Privileged and Rescuer instead supply their exact Caliber II Resource once per mission, including Caliber I missions, without consuming a Reserve pick or rolling a Request check. Its base action-die cost equals Caliber unless a selected benefit waives that base cost. Executive Decision also succeeds automatically and ignores the mission Caliber limit (Requests remain I–IV). A Gear check consumes one Reserve Common Item. These checks have no threat/error range. Boost before resolving the result.`}</p></div>`
    });
    if (!input) return null;
    input.funding = funders
      .flatMap(a => [
        { actor: a, count: Number(input["fund_" + a.id] ?? 0), bonusPoolId: "" },
        ...unrestrictedBonusPools(a.actionDiceFundingSystem, a.usagePeriods)
          .filter(p => p.available)
          .map(p => ({ actor: a, count: Number(input["fundPool_" + a.id + "_" + p.id] ?? 0), bonusPoolId: p.id }))
      ])
      .filter(f => f.count);
  }
  const preview = gearAcquisitionPlan(actor.system, {
      ...input,
      caliber: Number(input.caliber ?? 1),
      availableFunding: Number.MAX_SAFE_INTEGER
    }),
    requestedCost = preview.cost;
  const selections = (
    input.funding?.length
      ? input.funding
      : requestedCost
        ? [{ actor, count: requestedCost, bonusPoolId: input.bonusPoolId ?? "" }]
        : []
  ).map(f => ({ ...f, bonusPoolId: f.bonusPoolId ?? "" }));
  if (
    selections.some(
      f => typeof f.bonusPoolId !== "string" || !owned(f.actor) || !Number.isSafeInteger(f.count) || f.count < 1
    )
  )
    throw new Error(
      loc`Choose owned funders and positive whole-number contributions. Ask the GC to resolve other players’ contributions.`
    );
  const byActor = new Map();
  for (const row of selections) {
    const sources = byActor.get(row.actor.uuid) ?? new Map(),
      prior = sources.get(row.bonusPoolId);
    const count = (prior?.count ?? 0) + row.count;
    if (!Number.isSafeInteger(count)) throw new Error(loc`The Request contribution is unsafe.`);
    sources.set(row.bonusPoolId, { ...row, count });
    byActor.set(row.actor.uuid, sources);
  }
  const groups = [...byActor.values()].map(sources => ({
      actor: [...sources.values()][0].actor,
      sources: [...sources.values()]
    })),
    funding = groups.flatMap(g => g.sources);
  if (funding.some(f => f.actor.uuid !== actor.uuid) && !input.teammatesConfirmed)
    throw new Error(loc`Other Request funders must be teammates.`);
  if (funding.reduce((n, f) => n + f.count, 0) !== requestedCost)
    throw new Error(
      loc`Request contributions must total the base cost after waivers plus Shaken surcharge. A Common Item check has no Request action-die cost.`
    );
  return crossQueued(
    actor,
    funding.map(f => f.actor),
    async () => {
      requireSettledReserve(actor);
      if (JSON.stringify(shakenRules(actor.actionDiceFundingSystem)) !== expectedShaken)
        throw new Error(loc`The requester’s Shaken condition changed. Confirm the Request and its cost again.`);
      for (const f of funding) {
        const source = actionDiceFundingContext(f.actor.actionDiceFundingSystem, {
          bonusPoolId: f.bonusPoolId,
          periods: f.actor.usagePeriods
        });
        if (source.blocked) throw new Error(source.reason);
        if (source.balance < f.count) throw new Error(loc`A funder no longer has enough action dice.`);
        const payer = actionDicePaymentPlan(f.actor.actionDiceFundingSystem, {
          count: f.count,
          bonusPoolId: f.bonusPoolId,
          periods: f.actor.usagePeriods
        });
        if (payer.blocked) throw new Error(payer.reason);
      }
      const plan = gearAcquisitionPlan(actor.system, {
          ...input,
          caliber: Number(input.caliber ?? 1),
          availableFunding: funding.reduce((n, f) => n + f.count, 0)
        }),
        priorReserve = structuredClone(actor.system.missionReserves),
        before = structuredClone(currentReserves(actor.system) ?? plan.record),
        id = foundry.utils.randomID();
      if (plan.cost !== requestedCost)
        throw new Error(loc`The Request cost changed before payment. Review its funding again.`);
      const abilityId = plan.abilityId ?? plan.requestAbility,
        beforeUse = abilityId ? structuredClone(actor.system.resourceUses?.[abilityId]) : null;
      const immediateDelivery = plan.automatic && plan.delivery.formula === "0";
      const deferredDelivery = plan.automatic && !immediateDelivery;
      // Random delivery starts only in the journaled settlement; immediate benefits need no Roll.
      const attempt = {
        id,
        epoch: missionEpoch(actor.system),
        kind: plan.kind,
        name: plan.name,
        pick: plan.pick ?? "",
        category: plan.category ?? "",
        caliber: plan.caliber ?? 0,
        cost: plan.cost,
        baseCost: plan.baseCost ?? 0,
        surcharge: plan.surcharge ?? 0,
        dc: plan.dc,
        sourcesOption: plan.sourcesOption ?? "",
        outsideFaction: !!plan.outsideFaction,
        requestLevel: plan.requestLevel ?? null,
        bonusSources: plan.bonusSources ?? [],
        gearCheckContext: plan.gearCheckContext ?? null,
        homeTurf: plan.homeTurf ?? false,
        localHeroFeats: plan.localHeroFeats ?? [],
        location: plan.location ?? "",
        deliveryMultiplier: plan.deliveryMultiplier ?? 1,
        delivery: immediateDelivery
          ? {
              formula: plan.delivery.formula,
              total: 0,
              unit: plan.delivery.unit
            }
          : null,
        status: plan.automatic && !deferredDelivery ? "succeeded" : "pending",
        success: plan.automatic && !deferredDelivery ? true : null,
        requestAbility: plan.requestAbility,
        freePick: plan.freePick ?? false,
        originResource: plan.originResource ?? "",
        abilityId,
        gearAbility: plan.gearAbility ?? null,
        commonCost: plan.commonCost ?? null,
        automatic: plan.automatic,
        ...(plan.automatic ? { automaticSource: structuredClone(plan.requestBenefit) } : {}),
        abilityName: plan.abilityName,
        preparationHours: plan.preparationHours ?? 0,
        messageUuid: "",
        claimedItemId: "",
        funding: funding.map(f => ({
          actorUuid: f.actor.uuid,
          count: f.count,
          ...(f.bonusPoolId ? { bonusPoolId: f.bonusPoolId } : {})
        }))
      };
      const record = { ...plan.record, attempts: { ...plan.record.attempts, [id]: attempt } };
      const reservation = reserveTransaction(actor, plan, before, attempt, beforeUse);
      const changes = {
        "system.missionReserves": record,
        ...(abilityId ? { [`system.resourceUses.${abilityId}`]: plan.abilityRecord } : {})
      };
      if (priorReserve?.epoch && priorReserve.epoch !== record.epoch) {
        changes["system.missionReserveHistory"] = [...(actor.system.missionReserveHistory ?? []), priorReserve];
        for (const oldId of Object.keys(priorReserve.attempts ?? {}))
          if (!Object.hasOwn(record.attempts, oldId)) changes[`system.missionReserves.attempts.-=${oldId}`] = null;
      }
      try {
        await actor.update(changes);
      } catch (error) {
        if (!reserveReservationMatches(actor, reservation)) {
          if (!reserveUntouched(actor, reservation))
            await holdReserveReview(actor, reservation, loc`The Reserve reservation could not be proven.`);
          throw error;
        }
      }
      let message;
      try {
        const validateRequest = () => {
          if (
            plan.requestAbility &&
            (JSON.stringify(requestBenefitContext(actor.system, plan.requestAbility)) !==
              JSON.stringify(plan.requestBenefit) ||
              !reserveReservationMatches(actor, reservation))
          )
            throw new Error(loc`The Request benefit source, period or reserved use changed before posting.`);
        };
        const post = async () => {
          try {
            validateRequest();
            if (plan.automatic)
              message = await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor }),
                content: `<p>${loc`${esc(plan.abilityName)}: ${esc(plan.name)} requested automatically; ${plan.freePick ? loc`no Reserve pick consumed` : loc`one ${esc(plan.pick)} Reserve pick consumed`}, ${plan.cost ? loc`${plan.cost} action dice spent (${plan.surcharge} Shaken surcharge)` : loc`no action dice spent`}. ${deferredDelivery ? loc`No Request check is rolled. Resolve delivery once from this card, then claim the Resource after it arrives.` : loc`Available after ${attempt.delivery.total} ${attempt.delivery.unit}.`} ${plan.preparationHours ? loc` One hour of preparation completed before the Request.` : ""} Claim on Gear after delivery.`}</p>`,
                rolls: [],
                flags: {
                  spycraft2: {
                    actorUuid: actor.uuid,
                    checkKind: "request",
                    requestBenefit: plan.requestBenefit ?? null,
                    actionDiceAllowed: false,
                    resolved: !deferredDelivery,
                    ...(!deferredDelivery ? { successConfirmed: true } : {}),
                    gearAttempt: {
                      id,
                      epoch: attempt.epoch,
                      success: deferredDelivery ? null : true,
                      delivery: attempt.delivery
                    }
                  }
                }
              });
            else
              message = await actor.rollCheck(
                officeGossipTake10(actor.system, plan.kind, input) ? "10 + @total" : "1d20 + @total",
                { total: plan.bonus },
                {
                  flavor: `${plan.kind === "request" ? loc`Request` : loc`Gear check`}: ${esc(plan.name)}<br>${loc`DC ${plan.dc}${plan.outsideFaction ? loc`; ${esc(plan.abilityName)}, class level ${plan.requestLevel} replaces Career Level; outside Faction restrictions; one-hour consultation` : ""}${plan.bonusSources?.length ? `; ${plan.bonusSources.map(s => `${esc(s.name)} +${s.value}`).join("; ")}` : ""}; consumed ${plan.kind === "request" ? loc`one ${plan.pick} Reserve pick and ${plan.cost} action dice` : plan.commonCost === 0 ? loc`no Reserve Common Item (Personal Stash session use)` : loc`one Reserve Common Item`}.`}`,
                  checkKind: plan.kind,
                  ...(officeGossipTake10(actor.system, plan.kind, input) ? { checkMethod: "take10" } : {}),
                  requestBenefit: plan.requestBenefit ?? null,
                  threat: 0,
                  error: 0,
                  gearCheckContext: plan.gearCheckContext ?? null,
                  gearAllowance: plan.gearAbility
                    ? {
                        id: abilityId,
                        record: structuredClone(reservation.ability.reserved),
                        commonCost: plan.commonCost
                      }
                    : null,
                  validateSkillContext:
                    plan.gearCheckContext || plan.requestAbility
                      ? () => {
                          validateRequest();
                          if (
                            plan.gearCheckContext &&
                            (JSON.stringify(gearCheckPlan(actor.system, input)) !==
                              JSON.stringify(plan.gearCheckContext) ||
                              (plan.gearAbility &&
                                (!reserveReservationMatches(actor, reservation) ||
                                  String(actor.usagePeriods.session ?? "initial") !== plan.abilityRecord.epoch)))
                          )
                            throw new Error(
                              loc`The home Gear check bonus, allowance or its feat sources changed before posting.`
                            );
                        }
                      : undefined,
                  gearAttempt: { id, epoch: attempt.epoch }
                }
              );
            if (plan.gearAbility && message?.flags?.spycraft2?.gearAttempt?.id !== id)
              throw new Error(loc`The Personal Stash Gear check did not post a receipt.`);
          } catch (error) {
            const committed = postedReceipt(actor, "gearAttempt", id);
            if (!committed) throw error;
            message = committed;
          }
          return message;
        };
        const pay = async index => {
          if (index === groups.length) return post();
          const group = groups[index];
          let started = false;
          const perform = async () => {
            started = true;
            try {
              return await pay(index + 1);
            } catch (error) {
              if (funding.some(f => getActionDieSettlementReview(f.actor).needsReview))
                error.actionDiceSettlementReview = {
                  ...error.actionDiceSettlementReview,
                  purpose: "Shared Request payment",
                  recipientActorUuid: actor.uuid,
                  attemptId: id
                };
              throw error;
            }
          };
          const result =
            plan.surcharge || group.sources.length > 1
              ? await group.actor.payMultipartActionDiceLocked(
                  group.sources.map(f => ({ bonusPoolId: f.bonusPoolId, count: f.count, scope: "general" })),
                  perform,
                  {
                    purpose: "Request for " + actor.name,
                    details: {
                      benefit: "request",
                      recipientActorUuid: actor.uuid,
                      attemptId: id,
                      baseCost: plan.baseCost ?? 0,
                      requesterSurcharge: plan.surcharge ?? 0
                    }
                  }
                )
              : await group.actor.payActionDiceLocked(group.sources[0].count, perform, {
                  bonusPoolId: group.sources[0].bonusPoolId
                });
          if (!started) throw new Error(loc`Request funding changed before payment.`);
          return result;
        };
        message = await pay(0);
      } catch (error) {
        if (funding.some(f => getActionDieSettlementReview(f.actor).needsReview)) {
          await holdReserveReview(
            actor,
            reservation,
            loc`A Request funder has an unsettled payment. Resolve the funders and this Reserve before retrying.`
          );
          throw error;
        }
        try {
          const patch = reserveRollbackPatch(actor, reservation);
          try {
            await actor.update(patch);
          } catch (rollback) {
            if (actor.flags?.spycraft2?.reserveRollbacks?.[id]?.restored !== true) throw rollback;
          }
        } catch (rollback) {
          await holdReserveReview(
            actor,
            reservation,
            loc`The failed acquisition could not safely restore its Reserve or ability use.`
          );
          throw new AggregateError([error, rollback], loc`The interrupted Reserve transaction needs GC review.`);
        }
        throw error;
      }
      // A posted roll has consumed its resources even if this optional linkage update fails.
      try {
        await actor.update({ [loc`system.missionReserves.attempts.${id}.messageUuid`]: message.uuid ?? message.id });
      } catch (error) {
        ui.notifications.warn(
          loc`The acquisition is already recorded and its resources are spent, but its chat link needs GC review. Do not repeat the Request.`
        );
      }
      return message;
    }
  );
}
async function refreshAcquisitionChat(message) {
  try {
    await globalThis.ui?.chat?.updateMessage?.(message, { notify: false });
  } catch {
    ui.notifications.warn(loc`The acquisition is complete; reload chat to refresh its controls.`);
  }
}
const acquisitionEvidence = check => rollEvidence({ ...check, resolved: false, successConfirmed: undefined });
const pendingDeliveries = new Map();
const deliveryKey = (actor, message, receipt) => `${actor.uuid}|${message.uuid ?? message.id}|${receipt.id}`;
const rollSummaries = message => [...(message.rolls ?? [])].map(r => ({ formula: r.formula, total: r.total }));
function validateAcquisitionReceipt(actor, message, record, receipt) {
  const check = message.flags.spycraft2,
    id = check.gearAttempt.id;
  if (
    ![1, 2].includes(receipt?.version) ||
    receipt.actorUuid !== actor.uuid ||
    receipt.messageUuid !== (message.uuid ?? message.id) ||
    receipt.epoch !== record.epoch ||
    receipt.attemptId !== id ||
    receipt.before?.id !== id ||
    receipt.before.epoch !== record.epoch ||
    receipt.before.status !== "pending" ||
    receipt.before.success !== null ||
    !rollEvidenceMatches(receipt.evidence, { ...check, resolved: false, successConfirmed: undefined }) ||
    !check.resolved ||
    check.superseded
  )
    throw new Error(loc`The recorded acquisition result changed or has an invalid receipt. Ask the GC to review it.`);
  if (receipt.finalTotal !== check.effectiveTotal)
    throw new Error(loc`The final acquisition result changed. Ask the GC to review it.`);
}
function deliveryBounds(spec) {
  const match = spec.formula.match(/^(\d+)d(\d+)$/);
  if (!match) throw Error(loc`Review the delivery dice formula.`);
  return { minimum: Number(match[1]), maximum: Number(match[1]) * Number(match[2]) };
}
function validateDeliveryAttachment(message, receipt, spec) {
  const evidence = receipt.deliveryEvidence;
  if (
    !Array.isArray(receipt.baseRolls) ||
    !same(rollSummaries(message).slice(0, receipt.baseRolls.length), receipt.baseRolls)
  )
    throw Error(loc`The acquisition's original dice changed. The GC must review the delivery evidence.`);
  if (!spec) {
    if (evidence !== null) throw Error(loc`This acquisition must not have delivery dice.`);
    return;
  }
  const bounds = deliveryBounds(spec),
    roll = message.rolls?.[evidence?.index];
  if (
    !evidence ||
    evidence.index !== receipt.baseRolls.length ||
    !["rolled", "reviewed"].includes(evidence.origin) ||
    evidence.formula !== spec.formula ||
    !Number.isSafeInteger(evidence.rawTotal) ||
    evidence.rawTotal < bounds.minimum ||
    evidence.rawTotal > bounds.maximum ||
    roll?.total !== evidence.rawTotal ||
    roll.formula !== (evidence.origin === "rolled" ? spec.formula : String(evidence.rawTotal)) ||
    (evidence.origin === "reviewed" &&
      (typeof evidence.note !== "string" ||
        !evidence.note.trim() ||
        typeof evidence.reviewerId !== "string" ||
        !evidence.reviewerId)) ||
    receipt.next.delivery.total !== Math.ceil(evidence.rawTotal * (receipt.before.deliveryMultiplier ?? 1))
  )
    throw Error(loc`The delivery dice or reviewed result do not match the recorded delivery time.`);
}
function validateSettlement(actor, message, record, attempt, receipt) {
  validateAcquisitionReceipt(actor, message, record, receipt);
  const check = message.flags.spycraft2,
    id = check.gearAttempt.id;
  if (receipt.version === 2 && receipt.stage !== "complete")
    throw Error(loc`Complete the interrupted delivery before claiming this acquisition.`);
  const result = acquisitionOutcome(receipt.before, receipt.finalTotal),
    next = receipt.next;
  if (
    !next ||
    next.id !== id ||
    next.epoch !== record.epoch ||
    next.settlementId !== receipt.id ||
    next.success !== result.success ||
    next.status !== result.status ||
    check.successConfirmed !== result.success ||
    check.gearAttempt.success !== result.success ||
    !same(check.gearAttempt.delivery, next.delivery)
  )
    throw new Error(loc`The acquisition settlement needs GC review.`);
  const spec = result.success && receipt.before.kind === "request" ? DELIVERY[receipt.before.location] : null;
  if (
    spec
      ? next.delivery?.formula !== spec.formula ||
        next.delivery?.unit !== spec.unit ||
        !Number.isSafeInteger(next.delivery?.total) ||
        next.delivery.total < 1
      : next.delivery !== null
  )
    throw new Error(loc`The recorded delivery needs GC review.`);
  if (receipt.version === 2) validateDeliveryAttachment(message, receipt, spec);
  if (attempt.settlementId === receipt.id) {
    if (!same({ ...attempt, claimedItemId: next.claimedItemId }, next))
      throw new Error(loc`The actor acquisition outcome changed after settlement.`);
    return true;
  }
  if (!same(attempt, receipt.before))
    throw new Error(loc`The acquisition record changed before settlement. Preserve it for GC review.`);
  return false;
}
async function completeDelivery(actor, message, record, attempt, receipt, { fresh, options }) {
  validateAcquisitionReceipt(actor, message, record, receipt);
  const result = acquisitionOutcome(receipt.before, receipt.finalTotal);
  if (!same(attempt, receipt.before))
    throw Error(loc`The acquisition record changed before settlement. Preserve it for GC review.`);
  if (
    receipt.version !== 2 ||
    receipt.stage !== "rolling" ||
    !same(rollSummaries(message), receipt.baseRolls) ||
    message.flags.spycraft2.successConfirmed !== result.success ||
    message.flags.spycraft2.gearAttempt.success !== result.success
  )
    throw Error(loc`The interrupted acquisition no longer matches its frozen result. Ask the GC to review it.`);
  const spec = result.success && attempt.kind === "request" ? DELIVERY[attempt.location] : null,
    key = deliveryKey(actor, message, receipt);
  let pending = pendingDeliveries.get(key);
  if (spec && options.deliveryTotal !== undefined) {
    if (
      !game.user?.isGM ||
      typeof game.user.id !== "string" ||
      options.confirmed !== true ||
      typeof options.note !== "string" ||
      !options.note.trim() ||
      options.note.length > 500
    )
      throw Error(loc`The GC must confirm the actual delivery result and add a review note.`);
    const value = Number(options.deliveryTotal),
      bounds = deliveryBounds(spec);
    if (!Number.isSafeInteger(value) || value < bounds.minimum || value > bounds.maximum)
      throw Error(loc`Record an actual delivery total from ${bounds.minimum} to ${bounds.maximum}.`);
    pending = {
      roll: await new Roll(String(value)).evaluate(),
      origin: "reviewed",
      note: options.note.trim(),
      reviewerId: game.user.id
    };
    pendingDeliveries.set(key, pending);
  } else if (spec && !pending) {
    if (!fresh) {
      if (!game.user?.isGM) throw Error(loc`The interrupted delivery roll needs GC review; do not roll it again.`);
      const bounds = deliveryBounds(spec);
      const input = await systemDialog.input({
        window: { title: loc`Review interrupted delivery` },
        rejectClose: false,
        ok: { label: loc`Record delivery result` },
        content: `<div class="spycraft2-roll-options"><p>${loc`The acquisition result is closed. Record the actual delivery roll total (${spec.formula}), before its time multiplier. Do not reroll a result that already occurred; adjudicate an unknown result separately.`}</p><label>${loc`Actual delivery roll total`} <input name="deliveryTotal" type="number" min="${bounds.minimum}" max="${bounds.maximum}" step="1" required /></label><label>${loc`GC review note`} <input name="note" maxlength="500" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC reviewed this actual delivery result`}</label></div>`
      });
      if (!input) return null;
      return completeDelivery(actor, message, record, attempt, receipt, { fresh: false, options: input });
    }
    pending = { roll: await new Roll(spec.formula).evaluate(), origin: "rolled" };
    pendingDeliveries.set(key, pending);
  }
  validateAcquisitionReceipt(actor, message, record, receipt);
  const latest = currentReserves(actor.system);
  if (!latest || latest.epoch !== receipt.epoch || !same(latest.attempts?.[receipt.attemptId], receipt.before))
    throw Error(loc`The acquisition record changed before settlement. Preserve it for GC review.`);
  if (spec) {
    const bounds = deliveryBounds(spec),
      value = pending.roll.total,
      multiplier = attempt.deliveryMultiplier ?? 1;
    if (
      !Number.isSafeInteger(value) ||
      value < bounds.minimum ||
      value > bounds.maximum ||
      !Number.isFinite(multiplier) ||
      multiplier <= 0 ||
      pending.roll.formula !== (pending.origin === "rolled" ? spec.formula : String(value))
    )
      throw Error(
        loc`Review the actual delivery dice and positive time multiplier before completing this acquisition.`
      );
  }
  const delivery = spec
    ? {
        formula: spec.formula,
        total: Math.ceil(pending.roll.total * (attempt.deliveryMultiplier ?? 1)),
        unit: spec.unit
      }
    : null;
  const next = { ...attempt, ...result, delivery, settlementId: receipt.id };
  const completed = {
    ...receipt,
    stage: "complete",
    next,
    deliveryEvidence: spec
      ? {
          index: receipt.baseRolls.length,
          formula: spec.formula,
          rawTotal: pending.roll.total,
          origin: pending.origin,
          ...(pending.origin === "reviewed" ? { note: pending.note, reviewerId: pending.reviewerId } : {})
        }
      : null
  };
  const gearAttempt = { ...message.flags.spycraft2.gearAttempt, ...result, delivery, settlement: completed };
  const notes = result.success
    ? loc`Succeeded.${delivery ? loc` Available after ${delivery.total} ${delivery.unit}.` : loc` The Common Item was already brought along.`} Claim it on the Gear tab.`
    : loc`Failed. The consumed reserve and action dice are not refunded.`;
  try {
    await message.update({
      "flags.spycraft2.gearAttempt": gearAttempt,
      ...(spec ? { rolls: [...(message.rolls ?? []), pending.roll] } : {}),
      flavor: `${message.flags.spycraft2.baseFlavor ?? loc`Acquisition`}<br><strong>${loc`Final result ${receipt.finalTotal}: ${notes}`}</strong>`
    });
  } catch (error) {
    if (!same(message.flags?.spycraft2?.gearAttempt, gearAttempt)) throw error;
  }
  validateSettlement(actor, message, record, attempt, completed);
  pendingDeliveries.delete(key);
  return completed;
}
export function finishGearAcquisition(actor, message, options = {}) {
  if (!owned(actor) || message.flags?.spycraft2?.actorUuid !== actor.uuid) return null;
  return queued(
    actor,
    async () => {
      requireSettledReserve(actor);
      if (!owned(actor) || message.flags?.spycraft2?.actorUuid !== actor.uuid)
        throw new Error(loc`The acquisition ownership changed.`);
      if (message.blind && !game.user?.isGM) throw new Error(loc`The GC resolves secret acquisitions.`);
      const check = message.flags.spycraft2,
        record = currentReserves(actor.system),
        id = check.gearAttempt?.id,
        attempt = record?.attempts?.[id];
      if (attempt?.automaticSource && !same(attempt.automaticSource, check.requestBenefit))
        throw Error(loc`The automatic Request's saved source differs from its card. Review the original acquisition.`);
      if (!attempt || attempt.epoch !== record.epoch || check.gearAttempt.epoch !== record.epoch)
        throw new Error(loc`This acquisition belongs to an earlier mission or has no reserve transaction.`);
      if (check.superseded) throw new Error(loc`Resolve the replacement acquisition check instead.`);
      let receipt = check.gearAttempt.settlement,
        fresh = false;
      if (!receipt) {
        if (check.resolved || attempt.status !== "pending")
          return refuseStep(loc`This acquisition has already been resolved.`);
        const result = acquisitionOutcome(attempt, check.effectiveTotal),
          settlementId = foundry.utils.randomID();
        receipt = {
          version: 2,
          stage: "rolling",
          id: settlementId,
          actorUuid: actor.uuid,
          messageUuid: message.uuid ?? message.id,
          epoch: record.epoch,
          attemptId: id,
          evidence: acquisitionEvidence(check),
          finalTotal: check.effectiveTotal,
          before: structuredClone(attempt),
          baseRolls: rollSummaries(message)
        };
        const gearAttempt = { ...check.gearAttempt, ...result, delivery: null, settlement: receipt };
        try {
          await message.update({
            "flags.spycraft2.resolved": true,
            "flags.spycraft2.successConfirmed": result.success,
            "flags.spycraft2.gearAttempt": gearAttempt,
            flavor: `${check.baseFlavor ?? loc`Acquisition`}<br><strong>${attempt.automatic ? loc`Automatic Request benefit recorded; delivery settlement follows.` : loc`Final result ${check.effectiveTotal} recorded; delivery settlement follows.`}</strong>`
          });
        } catch (error) {
          const current = message.flags?.spycraft2;
          if (
            current?.resolved !== true ||
            current.successConfirmed !== result.success ||
            !same(current.gearAttempt, gearAttempt)
          )
            throw error;
        }
        fresh = true;
      }
      if (receipt.version === 2 && receipt.stage === "rolling") {
        receipt = await completeDelivery(actor, message, record, attempt, receipt, { fresh, options });
        if (!receipt) return null;
      }
      // The message commits first: its resolved state prevents further boosts or replacement rolls.
      // Actor failures leave that exact final result/delivery available for a bounded retry.
      pendingDeliveries.delete(deliveryKey(actor, message, receipt));
      if (validateSettlement(actor, message, record, attempt, receipt)) {
        await refreshAcquisitionChat(message);
        return attempt;
      }
      try {
        await actor.update({ [`system.missionReserves.attempts.${id}`]: receipt.next });
      } catch (error) {
        if (!same(actor.system.missionReserves?.attempts?.[id], receipt.next))
          throw new Error(
            loc`The result and delivery are recorded. Retry Finish to complete the acquisition record; its resources remain spent.`,
            { cause: error }
          );
      }
      await refreshAcquisitionChat(message);
      return actor.system.missionReserves.attempts[id];
    },
    { messages: [message] }
  );
}
export async function claimGearAcquisition(actor, options = {}) {
  if (!owned(actor)) return null;
  // A copy: the steps below fill in itemData, which must not leak back into a caller that retries with options.
  let input = { ...options };
  if (!input.attemptId) {
    const attempts = Object.values(currentReserves(actor.system)?.attempts ?? {}).filter(
      a => a.epoch === missionEpoch(actor.system) && a.success && !a.claimedItemId
    );
    if (!attempts.length) return refuse(loc`There are no successful unclaimed acquisitions in this mission.`);
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Claim acquired gear` },
      rejectClose: false,
      content: `<label>${loc`Acquisition`} <select name="attemptId">${attempts.map(a => `<option value="${a.id}">${esc(a.name)}${a.delivery ? ` — ${a.delivery.total} ${a.delivery.unit}` : ""}</option>`).join("")}</select></label><label>${loc`Fixed location if this is a non-portable kit`} <input name="kitLocation" /></label><label><input type="checkbox" name="delivered" /> ${loc`Request: the delivery time has elapsed and the item is available`}</label><label><input type="checkbox" name="gcConfirmed" /> ${loc`The GC confirms the acquired item and its specifications`}</label>`
    });
    if (!input) return null;
  }
  const initial = currentReserves(actor.system)?.attempts?.[input.attemptId];
  if (!initial || initial.epoch !== missionEpoch(actor.system))
    throw new Error(loc`Choose an acquisition from this mission.`);
  if (!input.itemData) {
    const packs = ["spycraft2.weapons", "spycraft2.armor", "spycraft2.kits"]
      .map(id => game.packs.get(id))
      .filter(Boolean);
    const matches = (
      await Promise.all(
        packs.map(async pack => {
          const index = await pack.getIndex();
          return Promise.all(
            index.filter(e => e.name.toLowerCase() === initial.name.toLowerCase()).map(e => pack.getDocument(e._id))
          );
        })
      )
    ).flat();
    const doc = matches.find(d =>
      initial.kind === "common"
        ? d.system.common && d.system.caliber === 0
        : (equipmentCategory(d) === initial.category || (d.type === "gear" && d.system.kitGrade > 0)) &&
          d.system.caliber === initial.caliber
    );
    if (doc) {
      input.itemData = doc.toObject();
      delete input.itemData._id;
    } else if (matches.length)
      throw new Error(
        loc`The named catalog item does not match the requested category, Caliber or Common Item status.`
      );
    else {
      const spec = await foundry.applications.api.DialogV2.input({
        window: { title: loc`Specifications: ${initial.name}` },
        rejectClose: false,
        content: `<p>${loc`Acquire one declared item or option. Catalog bundles retain their listed quantity.`}</p><label>${loc`Total weight per item (lbs.)`} <input type="number" name="weight" min="0" step="any" value="0" /></label><label>${loc`Description / approved specifications`} <textarea name="description" required></textarea></label><p>${loc`This creates a general gear record. Weapons and armor require their full item statistics.`}</p>`
      });
      if (!spec) return null;
      if (!Number.isFinite(Number(spec.weight)) || Number(spec.weight) < 0 || !spec.description?.trim())
        throw new Error(loc`Enter valid quantity, weight and specifications.`);
      input.itemData = {
        name: initial.name,
        type: "gear",
        system: {
          quantity: 1,
          weight: Number(spec.weight),
          description: `<p>${esc(spec.description)}</p>`,
          caliber: initial.caliber,
          common: initial.kind === "common",
          gearCategory: initial.category
        }
      };
    }
  }
  return queued(actor, async () => {
    requireSettledReserve(actor);
    const record = currentReserves(actor.system),
      attempt = record?.attempts?.[input.attemptId];
    if (!attempt?.success || attempt.epoch !== record.epoch || attempt.claimedItemId)
      throw new Error(loc`This acquisition did not succeed or was already claimed.`);
    if (!input.gcConfirmed || (attempt.kind === "request" && !input.delivered))
      throw new Error(loc`Confirm the item specifications and any required delivery before claiming.`);
    const data = structuredClone(input.itemData);
    delete data._id;
    if (
      !["weapon", "armor", "gear"].includes(data.type) ||
      data.name?.trim().toLowerCase() !== attempt.name.toLowerCase()
    )
      throw new Error(loc`Claim the exact item requested before the roll.`);
    if (attempt.kind === "common" && (!data.system?.common || data.system.caliber > 0))
      throw new Error(loc`A Gear check can only acquire a Common Item.`);
    if (data.type === "gear" && data.system?.kitGrade) {
      if (
        !Number.isSafeInteger(data.system.kitGrade) ||
        data.system.kitGrade < 1 ||
        data.system.kitGrade > 3 ||
        data.system.caliber < data.system.kitGrade
      )
        throw new Error(loc`The kit’s Caliber must support its valid grade.`);
      if (attempt.kind === "request") data.system.gearCategory = attempt.category;
      if (data.system.kitNonPortable) {
        data.system.kitLocation = String(input.kitLocation ?? data.system.kitLocation ?? "").trim();
        data.system.carried = false;
        if (!data.system.kitLocation)
          throw new Error(loc`Choose the non-portable kit’s fixed location before introducing it.`);
      }
    }
    if (
      attempt.kind === "request" &&
      (equipmentCategory(data) !== attempt.category || data.system?.caliber !== attempt.caliber)
    )
      throw new Error(loc`The claimed item must match the requested equipment category and Caliber.`);
    const bundle = Number(data.system.bundleSize ?? 1),
      quantity = Number(data.system.quantity ?? bundle);
    if (
      !Number.isSafeInteger(bundle) ||
      bundle < 1 ||
      quantity !== bundle ||
      (data.system.pickCount != null && data.system.pickCount !== 1)
    )
      throw new Error(
        loc`One acquisition grants one source-listed bundle; its quantity and pick count cannot be increased after the check.`
      );
    const featBonus =
        attempt.kind === "request"
          ? requestFeatBonus(actor.system, data, quantity)
          : { extra: 0, powerRating: null, sources: [] },
      grenadeBonus = featBonus.extra;
    if (featBonus.powerRating !== null) data.system.powerRating = featBonus.powerRating;
    Object.assign(data.system, {
      quantity: quantity + grenadeBonus,
      pickCount: 1,
      possessionSource: "",
      possessionApproved: false,
      reserve: false,
      pick: attempt.kind === "request" ? attempt.pick : "",
      reserveAcquisition: { epoch: record.epoch, attemptId: attempt.id, bonusQuantity: grenadeBonus }
    });
    const existing = actor.items.filter(
      i => i.system.reserveAcquisition?.epoch === record.epoch && i.system.reserveAcquisition?.attemptId === attempt.id
    );
    if (existing.length > 1)
      throw new Error(
        loc`Multiple items reference this acquisition. The GC must review them before introducing anything else.`
      );
    let docs = existing;
    if (!docs.length) {
      const claimId = foundry.utils.randomID();
      data.flags = {
        ...data.flags,
        spycraft2: {
          ...data.flags?.spycraft2,
          acquisitionClaim: { id: claimId, epoch: record.epoch, attemptId: attempt.id }
        }
      };
      try {
        docs = await actor.createEmbeddedDocuments("Item", [data]);
      } catch (error) {
        docs = actor.items.filter(
          i =>
            i.flags?.spycraft2?.acquisitionClaim?.id === claimId &&
            i.system.reserveAcquisition?.epoch === record.epoch &&
            i.system.reserveAcquisition?.attemptId === attempt.id
        );
        if (docs.length !== 1) throw error;
      }
    }
    if (docs.length !== 1 || !docs[0]?.id)
      throw new Error(loc`The acquired item was not uniquely introduced. Review its current inventory.`);
    try {
      await actor.update({ [loc`system.missionReserves.attempts.${attempt.id}.claimedItemId`]: docs[0].id });
    } catch (error) {
      if (actor.system.missionReserves?.attempts?.[attempt.id]?.claimedItemId === docs[0].id) return docs[0];
      // Keep the uniquely stamped item for a retry of the parent receipt, without introducing it again.
      ui.notifications.warn(
        loc`The item was introduced but its acquisition receipt needs completion. Retry Claim to link the existing item; no additional item will be created.`
      );
      throw error;
    }
    return docs[0];
  });
}
