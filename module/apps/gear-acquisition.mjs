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
import { queueResources, isResourceLock } from "../rules/transactions.mjs";
import {
  PICK_CATEGORIES,
  DELIVERY,
  currentReserves,
  provisionalReserves,
  missionEpoch,
  reserveInitialization,
  gearAcquisitionPlan,
  acquisitionOutcome
} from "../rules/gear-acquisition.mjs";
import { equipmentCategory } from "../rules/gear.mjs";
const queued = (actor, work, options) => queueResources([actor], work, options);
const crossQueued = (actor, actors, work) => queueResources([actor, ...actors], work);
const owned = actor => actor?.type === "agent" && actor.isOwner;
const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
export async function allocateMissionReserves(actor, options = {}) {
  if (!owned(actor)) return null;
  let input = options;
  if (!Object.keys(input).length) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "Unassigned mission reserves" },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options">
   <p>At the end of the Intel Phase, keep unchosen picks and Common Items up to your Wisdom modifier: ${actor.system.reserveCapacity}. Named gear already selected is counted separately.</p>
   ${PICK_CATEGORIES.map(key => `<label>${key} picks (${actor.system.gearPicks?.[key]?.remaining ?? 0} unchosen) <input type="number" name="pick_${key}" min="0" value="0" /></label>`).join("")}
   <details><summary>Categories for reserved Charisma picks (set during Intel)</summary>${(actor.system.affiliationType === "freelance" ? ["E", "S", "V", "W"] : ["G", "T", "V", "R"]).map(k => `<label>CHA → ${k} <input type="number" name="cha_${k}" min="0" value="0" /></label>`).join("")}</details>
   <label>Reserve Common Items <input type="number" name="common" min="0" value="0" /></label>
   <label>Mission Caliber <input type="number" name="caliber" min="1" max="5" value="1" /></label>
   <label><input type="checkbox" name="procureAtIntel" /> Procure: Intel takes place in a city of 10,000+ people with quick contact; hold two additional reserves</label>
   <label><input type="checkbox" name="intelComplete" /> The Intel Phase is complete; these are this mission’s unchosen reserves</label></div>`
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
      (actor.system.activeFeatNames?.includes("Personal Stash") ? provisionalReserves(actor.system) : null);
    if (!record) return ui.notifications.warn("Allocate this mission’s unassigned reserves first.");
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "Request or Gear check" },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options">
   ${record.initialized === false ? "<p>Personal Stash can supply one Common Item without a Reserve item. Allocate mission reserves before making ordinary Gear checks or Requests.</p>" : ""}
   <label>Check <select name="kind"><option value="request">Request a gear pick</option><option value="common">Gear check for a Common Item</option></select></label>
   <label>Request benefit <select name="requestAbility"><option value="">Ordinary Request</option>${(
     actor.system.limitedUses ?? []
   )
     .filter(s => s.workflow === "requestBenefit")
     .map(s => `<option value="${esc(s.id)}" ${selectedAbility === s.id ? "selected" : ""}>${esc(s.name)}</option>`)
     .join("")}</select></label>
   <label><input type="checkbox" name="networkConfirmed" /> Automatic Request: the GC confirms our network can fulfill this Request</label>
   <label><input type="checkbox" name="hourAvailable" /> Spend one hour preparing: Sources consultation (in person/by phone) or Behind the Scenes city supporters</label>
   <label>Sources option <select name="sourcesOption"><option value="">Select only with Sources</option><option value="dossier">Dossier (Sources I+)</option><option value="skillTraining">Skill training (Sources II+)</option><option value="legalImmunity">Legal immunity (Sources III)</option></select></label>
   <label><input type="checkbox" name="sourcesOptionConfirmed" /> The GC confirms this is that actual Resource option (Sources only)</label>
   <label>Exact item or option <input name="name" required /></label>
   <label>Reserve pick <select name="pick">${PICK_CATEGORIES.map(k => `<option value="${k}">${k}: ${record.picks[k] ?? 0} remaining</option>`).join("")}</select></label>
   <label>Requested category <select name="category">${PICK_CATEGORIES.filter(k => k !== "CHA")
     .map(k => `<option value="${k}">${k}</option>`)
     .join("")}</select></label>
   <label>Requested Caliber <input type="number" name="caliber" min="1" max="4" value="1" /></label>
   <label>Location <select name="location">${Object.entries(DELIVERY)
     .map(([key, d]) => `<option value="${key}">${esc(d.label)}: ${d.formula} ${d.unit}</option>`)
     .join("")}</select></label>
   <label><input type="checkbox" name="notIntel" /> We are in the field, after the Intel Phase</label>
   <label><input type="checkbox" name="homeTurf" /> Request is within my home turf: five-block urban radius or one-mile wilderness radius of home (Local Hero)</label>
   <label><input type="checkbox" name="rapidCommunication" /> Request: rapid communication is available</label>
   <label><input type="checkbox" name="minuteAvailable" /> Request: spend one full minute communicating</label>
   <label><input type="checkbox" name="useProcure" /> Use earned Procure in a qualifying city: Request as mission Caliber +1, maximum IV, and half delivery time</label>
   <label><input type="checkbox" name="categoryConfirmed" /> Request: the GC confirms category and Faction availability</label>
   ${actor.system.activeFeatNames?.includes("Personal Stash") ? '<label><input type="checkbox" name="atHome" /> This Gear check is made inside my home (Personal Stash; distinct from Home Turf)</label><label><input type="checkbox" name="usePersonalStash" /> Use Personal Stash: one Gear check per session without spending a Reserve Common Item</label>' : ""}
   <label><input type="checkbox" name="commonConfirmed" /> Gear check: the GC confirms this is a Common Item</label>
   <details><summary>Shared Request funding (optional)</summary><p>Leave all zero to pay the full cost from your ordinary dice. Otherwise contributions must total the base Request cost after waivers plus the requester’s Shaken surcharge. Teammates may pay any portion of this total.</p>${funders
     .map(
       a =>
         `<label>${esc(a.name)}: ordinary dice (${a.system.actionDice.value}) <input type="number" name="fund_${a.id}" min="0" value="0" /></label>${unrestrictedBonusPools(
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
     .join("")}<label><input type="checkbox" name="teammatesConfirmed" /> Other funders are teammates</label></details>
   <p>Sources uses one hour consulting contacts in person or by phone, its earned Resource option, and class level in place of Career Level.</p>
   <p>Current Shaken surcharge for a Request: ${shakenRules(actor.actionDiceFundingSystem).extraDice} action dice, including after a class/origin cost waiver. A Request consumes its Reserve pick. Its base action-die cost equals Caliber unless a selected benefit waives that base cost. Executive Decision also succeeds automatically and ignores the mission Caliber limit (Requests remain I–IV). A Gear check consumes one Reserve Common Item. These checks have no threat/error range. Boost before resolving the result.</p></div>`
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
      "Choose owned funders and positive whole-number contributions. Ask the GC to resolve other players’ contributions."
    );
  const byActor = new Map();
  for (const row of selections) {
    const sources = byActor.get(row.actor.uuid) ?? new Map(),
      prior = sources.get(row.bonusPoolId);
    const count = (prior?.count ?? 0) + row.count;
    if (!Number.isSafeInteger(count)) throw new Error("The Request contribution is unsafe.");
    sources.set(row.bonusPoolId, { ...row, count });
    byActor.set(row.actor.uuid, sources);
  }
  const groups = [...byActor.values()].map(sources => ({
      actor: [...sources.values()][0].actor,
      sources: [...sources.values()]
    })),
    funding = groups.flatMap(g => g.sources);
  if (funding.some(f => f.actor.uuid !== actor.uuid) && !input.teammatesConfirmed)
    throw new Error("Other Request funders must be teammates.");
  if (funding.reduce((n, f) => n + f.count, 0) !== requestedCost)
    throw new Error(
      "Request contributions must total the base cost after waivers plus Shaken surcharge. A Common Item check has no Request action-die cost."
    );
  return crossQueued(
    actor,
    funding.map(f => f.actor),
    async () => {
      requireSettledReserve(actor);
      if (JSON.stringify(shakenRules(actor.actionDiceFundingSystem)) !== expectedShaken)
        throw new Error("The requester’s Shaken condition changed. Confirm the Request and its cost again.");
      for (const f of funding) {
        const source = actionDiceFundingContext(f.actor.actionDiceFundingSystem, {
          bonusPoolId: f.bonusPoolId,
          periods: f.actor.usagePeriods
        });
        if (source.blocked) throw new Error(source.reason);
        if (source.balance < f.count) throw new Error("A funder no longer has enough action dice.");
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
        throw new Error("The Request cost changed before payment. Review its funding again.");
      const abilityId = plan.abilityId ?? plan.requestAbility,
        beforeUse = abilityId ? structuredClone(actor.system.resourceUses?.[abilityId]) : null;
      const deliveryRoll = plan.automatic ? await new Roll(plan.delivery.formula).evaluate() : null;
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
        delivery: deliveryRoll
          ? {
              formula: plan.delivery.formula,
              total: Math.ceil(deliveryRoll.total * (plan.deliveryMultiplier ?? 1)),
              unit: plan.delivery.unit
            }
          : null,
        status: plan.automatic ? "succeeded" : "pending",
        success: plan.automatic ? true : null,
        requestAbility: plan.requestAbility,
        abilityId,
        gearAbility: plan.gearAbility ?? null,
        commonCost: plan.commonCost ?? null,
        automatic: plan.automatic,
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
            await holdReserveReview(actor, reservation, "The Reserve reservation could not be proven.");
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
            throw new Error("The Request benefit source, period or reserved use changed before posting.");
        };
        const post = async () => {
          try {
            validateRequest();
            if (plan.automatic)
              message = await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor }),
                content: `<p>${esc(plan.abilityName)}: ${esc(plan.name)} requested automatically; one ${esc(plan.pick)} Reserve pick consumed, ${plan.cost ? `${plan.cost} action dice spent (${plan.surcharge} Shaken surcharge)` : "no action dice spent"}. Available after ${attempt.delivery.total} ${attempt.delivery.unit}. ${plan.preparationHours ? " One hour of preparation completed before the Request." : ""} Claim on Gear after delivery.</p>`,
                flags: {
                  spycraft2: {
                    actorUuid: actor.uuid,
                    checkKind: "request",
                    requestBenefit: plan.requestBenefit ?? null,
                    actionDiceAllowed: false,
                    resolved: true,
                    successConfirmed: true,
                    gearAttempt: { id, epoch: attempt.epoch, success: true, delivery: attempt.delivery }
                  }
                }
              });
            else
              message = await actor.rollCheck(
                "1d20 + @total",
                { total: plan.bonus },
                {
                  flavor: `${plan.kind === "request" ? "Request" : "Gear check"}: ${esc(plan.name)}<br>DC ${plan.dc}${plan.outsideFaction ? `; ${esc(plan.abilityName)}, class level ${plan.requestLevel} replaces Career Level; outside Faction restrictions; one-hour consultation` : ""}${plan.bonusSources?.length ? `; ${plan.bonusSources.map(s => `${esc(s.name)} +${s.value}`).join("; ")}` : ""}; consumed ${plan.kind === "request" ? `one ${plan.pick} Reserve pick and ${plan.cost} action dice` : plan.commonCost === 0 ? "no Reserve Common Item (Personal Stash session use)" : "one Reserve Common Item"}.`,
                  checkKind: plan.kind,
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
                              "The home Gear check bonus, allowance or its feat sources changed before posting."
                            );
                        }
                      : undefined,
                  gearAttempt: { id, epoch: attempt.epoch }
                }
              );
            if (plan.gearAbility && message?.flags?.spycraft2?.gearAttempt?.id !== id)
              throw new Error("The Personal Stash Gear check did not post a receipt.");
          } catch (error) {
            const committed = [...(game.messages ?? [])].find(
              m => m.flags?.spycraft2?.actorUuid === actor.uuid && m.flags.spycraft2.gearAttempt?.id === id
            );
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
          if (!started) throw new Error("Request funding changed before payment.");
          return result;
        };
        message = await pay(0);
      } catch (error) {
        if (funding.some(f => getActionDieSettlementReview(f.actor).needsReview)) {
          await holdReserveReview(
            actor,
            reservation,
            "A Request funder has an unsettled payment. Resolve the funders and this Reserve before retrying."
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
            "The failed acquisition could not safely restore its Reserve or ability use."
          );
          throw new AggregateError([error, rollback], "The interrupted Reserve transaction needs GC review.");
        }
        throw error;
      }
      // A posted roll has consumed its resources even if this optional linkage update fails.
      try {
        await actor.update({ [`system.missionReserves.attempts.${id}.messageUuid`]: message.uuid ?? message.id });
      } catch (error) {
        ui.notifications.warn(
          "The acquisition is already recorded and its resources are spent, but its chat link needs GC review. Do not repeat the Request."
        );
      }
      return message;
    }
  );
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function refreshAcquisitionChat(message) {
  try {
    await globalThis.ui?.chat?.updateMessage?.(message, { notify: false });
  } catch {
    ui.notifications.warn("The acquisition is complete; reload chat to refresh its controls.");
  }
}
const acquisitionEvidence = check => rollEvidence({ ...check, resolved: false, successConfirmed: undefined });
function validateSettlement(actor, message, record, attempt, receipt) {
  const check = message.flags.spycraft2,
    id = check.gearAttempt.id;
  if (
    receipt?.version !== 1 ||
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
    throw new Error("The recorded acquisition result changed or has an invalid receipt. Ask the GC to review it.");
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
    throw new Error("The acquisition settlement needs GC review.");
  const spec = result.success && receipt.before.kind === "request" ? DELIVERY[receipt.before.location] : null;
  if (
    spec
      ? next.delivery?.formula !== spec.formula ||
        next.delivery?.unit !== spec.unit ||
        !Number.isSafeInteger(next.delivery?.total) ||
        next.delivery.total < 1
      : next.delivery !== null
  )
    throw new Error("The recorded delivery needs GC review.");
  if (receipt.finalTotal !== check.effectiveTotal)
    throw new Error("The final acquisition result changed. Ask the GC to review it.");
  if (attempt.settlementId === receipt.id) {
    if (!same({ ...attempt, claimedItemId: next.claimedItemId }, next))
      throw new Error("The actor acquisition outcome changed after settlement.");
    return true;
  }
  if (!same(attempt, receipt.before))
    throw new Error("The acquisition record changed before settlement. Preserve it for GC review.");
  return false;
}
export function finishGearAcquisition(actor, message) {
  if (!owned(actor) || message.flags?.spycraft2?.actorUuid !== actor.uuid) return null;
  return queued(
    actor,
    async () => {
      requireSettledReserve(actor);
      if (!owned(actor) || message.flags?.spycraft2?.actorUuid !== actor.uuid)
        throw new Error("The acquisition ownership changed.");
      if (message.blind && !game.user?.isGM) throw new Error("The GC resolves secret acquisitions.");
      const check = message.flags.spycraft2,
        record = currentReserves(actor.system),
        id = check.gearAttempt?.id,
        attempt = record?.attempts?.[id];
      if (!attempt || attempt.epoch !== record.epoch || check.gearAttempt.epoch !== record.epoch)
        throw new Error("This acquisition belongs to an earlier mission or has no reserve transaction.");
      if (check.superseded) throw new Error("Resolve the replacement acquisition check instead.");
      let receipt = check.gearAttempt.settlement;
      if (!receipt) {
        if (check.resolved || attempt.status !== "pending")
          return ui.notifications.warn("This acquisition has already been resolved.");
        const result = acquisitionOutcome(attempt, check.effectiveTotal),
          spec = result.success && attempt.kind === "request" ? DELIVERY[attempt.location] : null;
        const roll = spec ? await new Roll(spec.formula).evaluate() : null,
          delivery = spec
            ? {
                formula: spec.formula,
                total: Math.ceil(roll.total * (attempt.deliveryMultiplier ?? 1)),
                unit: spec.unit
              }
            : null,
          settlementId = foundry.utils.randomID();
        const next = { ...attempt, ...result, delivery, settlementId };
        receipt = {
          version: 1,
          id: settlementId,
          actorUuid: actor.uuid,
          messageUuid: message.uuid ?? message.id,
          epoch: record.epoch,
          attemptId: id,
          evidence: acquisitionEvidence(check),
          finalTotal: check.effectiveTotal,
          before: structuredClone(attempt),
          next
        };
        const notes = result.success
          ? `Succeeded.${delivery ? ` Available after ${delivery.total} ${delivery.unit}.` : " The Common Item was already brought along."} Claim it on the Gear tab.`
          : "Failed. The consumed reserve and action dice are not refunded.";
        const gearAttempt = { ...check.gearAttempt, ...result, delivery, settlement: receipt };
        try {
          await message.update({
            "flags.spycraft2.resolved": true,
            "flags.spycraft2.successConfirmed": result.success,
            "flags.spycraft2.gearAttempt": gearAttempt,
            flavor: `${check.baseFlavor ?? "Acquisition"}<br><strong>Final result ${check.effectiveTotal}: ${notes}</strong>`
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
      }
      // The message commits first: its resolved state prevents further boosts or replacement rolls.
      // Actor failures leave that exact final result/delivery available for a bounded retry.
      if (validateSettlement(actor, message, record, attempt, receipt)) {
        await refreshAcquisitionChat(message);
        return attempt;
      }
      try {
        await actor.update({ [`system.missionReserves.attempts.${id}`]: receipt.next });
      } catch (error) {
        if (!same(actor.system.missionReserves?.attempts?.[id], receipt.next))
          throw new Error(
            "The result and delivery are recorded. Retry Finish to complete the acquisition record; its resources remain spent.",
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
  let input = options;
  if (!input.attemptId) {
    const attempts = Object.values(currentReserves(actor.system)?.attempts ?? {}).filter(
      a => a.epoch === missionEpoch(actor.system) && a.success && !a.claimedItemId
    );
    if (!attempts.length)
      return ui.notifications.warn("There are no successful unclaimed acquisitions in this mission.");
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "Claim acquired gear" },
      rejectClose: false,
      content: `<label>Acquisition <select name="attemptId">${attempts.map(a => `<option value="${a.id}">${esc(a.name)}${a.delivery ? ` — ${a.delivery.total} ${a.delivery.unit}` : ""}</option>`).join("")}</select></label><label>Fixed location if this is a non-portable kit <input name="kitLocation" /></label><label><input type="checkbox" name="delivered" /> Request: the delivery time has elapsed and the item is available</label><label><input type="checkbox" name="gcConfirmed" /> The GC confirms the acquired item and its specifications</label>`
    });
    if (!input) return null;
  }
  const initial = currentReserves(actor.system)?.attempts?.[input.attemptId];
  if (!initial || initial.epoch !== missionEpoch(actor.system))
    throw new Error("Choose an acquisition from this mission.");
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
      throw new Error("The named catalog item does not match the requested category, Caliber or Common Item status.");
    else {
      const spec = await foundry.applications.api.DialogV2.input({
        window: { title: `Specifications: ${initial.name}` },
        rejectClose: false,
        content:
          '<p>Acquire one declared item or option. Catalog bundles retain their listed quantity.</p><label>Total weight per item (lbs.) <input type="number" name="weight" min="0" step="any" value="0" /></label><label>Description / approved specifications <textarea name="description" required></textarea></label><p>This creates a general gear record. Weapons and armor require their full item statistics.</p>'
      });
      if (!spec) return null;
      if (!Number.isFinite(Number(spec.weight)) || Number(spec.weight) < 0 || !spec.description?.trim())
        throw new Error("Enter valid quantity, weight and specifications.");
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
      throw new Error("This acquisition did not succeed or was already claimed.");
    if (!input.gcConfirmed || (attempt.kind === "request" && !input.delivered))
      throw new Error("Confirm the item specifications and any required delivery before claiming.");
    const data = structuredClone(input.itemData);
    delete data._id;
    if (
      !["weapon", "armor", "gear"].includes(data.type) ||
      data.name?.trim().toLowerCase() !== attempt.name.toLowerCase()
    )
      throw new Error("Claim the exact item requested before the roll.");
    if (attempt.kind === "common" && (!data.system?.common || data.system.caliber > 0))
      throw new Error("A Gear check can only acquire a Common Item.");
    if (data.type === "gear" && data.system?.kitGrade) {
      if (
        !Number.isSafeInteger(data.system.kitGrade) ||
        data.system.kitGrade < 1 ||
        data.system.kitGrade > 3 ||
        data.system.caliber < data.system.kitGrade
      )
        throw new Error("The kit’s Caliber must support its valid grade.");
      if (attempt.kind === "request") data.system.gearCategory = attempt.category;
      if (data.system.kitNonPortable) {
        data.system.kitLocation = String(input.kitLocation ?? data.system.kitLocation ?? "").trim();
        data.system.carried = false;
        if (!data.system.kitLocation)
          throw new Error("Choose the non-portable kit’s fixed location before introducing it.");
      }
    }
    if (
      attempt.kind === "request" &&
      (equipmentCategory(data) !== attempt.category || data.system?.caliber !== attempt.caliber)
    )
      throw new Error("The claimed item must match the requested equipment category and Caliber.");
    const bundle = Number(data.system.bundleSize ?? 1),
      quantity = Number(data.system.quantity ?? bundle);
    if (
      !Number.isSafeInteger(bundle) ||
      bundle < 1 ||
      quantity !== bundle ||
      (data.system.pickCount != null && data.system.pickCount !== 1)
    )
      throw new Error(
        "One acquisition grants one source-listed bundle; its quantity and pick count cannot be increased after the check."
      );
    const grenadeBonus =
      attempt.kind === "request" &&
      data.type === "weapon" &&
      ["hurled", "exoticHurled"].includes(data.system.proficiency) &&
      /grenade/i.test(data.name) &&
      actor.system.activeFeatNames?.includes("Grenade Basics")
        ? 1
        : 0;
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
        "Multiple items reference this acquisition. The GC must review them before introducing anything else."
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
      throw new Error("The acquired item was not uniquely introduced. Review its current inventory.");
    try {
      await actor.update({ [`system.missionReserves.attempts.${attempt.id}.claimedItemId`]: docs[0].id });
    } catch (error) {
      if (actor.system.missionReserves?.attempts?.[attempt.id]?.claimedItemId === docs[0].id) return docs[0];
      // Keep the uniquely stamped item for a retry of the parent receipt, without introducing it again.
      ui.notifications.warn(
        "The item was introduced but its acquisition receipt needs completion. Retry Claim to link the existing item; no additional item will be created."
      );
      throw error;
    }
    return docs[0];
  });
}
