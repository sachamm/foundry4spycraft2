/**
 * Play actions for gear picks that are not tied to one roll: issuing a team-wide pick, and charging the
 * Reputation or Net Worth cost of a standing-only entry.
 */
import { getMission, teamActors } from "./gc/state.mjs";
import { parseStandingCost, standingPayment } from "../rules/standing.mjs";
import {
  batteryState,
  canAddMechanism,
  depletedUse,
  gadgetSkillBonus,
  rechargeCost,
  repairPlan,
  signalDC
} from "../rules/gear-play-rules.mjs";
import { sizeCode } from "../rules/vehicles.mjs";

const esc = value => foundry.utils.escapeHTML(String(value ?? ""));

/**
 * A pick marked "one per team member" (for example tactical radios or bicycles) gives every team member a copy.
 * The GC issues the copies; each is recorded as issued from the original, carries no pick cost of its own and is
 * not issued twice.
 */
export async function issueToTeam(item) {
  if (!item?.system?.perTeamMember) return null;
  if (!game.user.isGM) return ui.notifications.warn("Ask the GC to issue this pick to the team.");
  const owner = item.parent;
  const team = teamActors(getMission()).filter(actor => actor !== owner);
  if (!team.length)
    return ui.notifications.warn(
      "No other team members found. List the team in the GC console, or give players their agents."
    );
  const issued = [],
    skipped = [];
  for (const actor of team) {
    if (actor.items.some(i => i.getFlag("spycraft2", "issuedFrom") === item.uuid)) {
      skipped.push(actor.name);
      continue;
    }
    const data = item.toObject();
    delete data._id;
    Object.assign(data.system, { pick: "", pickCount: 1, reserve: false, quantity: item.system.bundleSize || 1 });
    foundry.utils.setProperty(data, "flags.spycraft2.issuedFrom", item.uuid);
    await actor.createEmbeddedDocuments("Item", [data]);
    issued.push(actor.name);
  }
  const lines = [
    `<strong>${esc(item.name)}</strong> issued to the team${owner ? ` from ${esc(owner.name)}'s pick` : ""}.`
  ];
  if (issued.length) lines.push(`Issued to: ${issued.map(esc).join(", ")}.`);
  if (skipped.length) lines.push(`Already held: ${skipped.map(esc).join(", ")}.`);
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: owner }), content: lines.join("<br>") });
  return issued;
}

const money = n => `$${Number(n).toLocaleString("en-US")}`;
const costText = (currency, amount) =>
  currency === "reputation" ? `${amount} Reputation` : `${money(amount)} Net Worth`;

/** Charge a standing-only pick's Reputation or Net Worth cost to the character holding it, once. */
export async function chargeStandingCost(item, { currency = null } = {}) {
  const actor = item?.parent,
    cost = parseStandingCost(item?.system?.standingCost);
  if (!actor || !cost)
    return ui.notifications.warn("This entry has no Reputation or Net Worth cost to charge, or no character holds it.");
  if (!actor.isOwner) return ui.notifications.warn("Only the character's owner or the GC can pay this cost.");
  if (item.getFlag("spycraft2", "standingCharge"))
    return ui.notifications.warn(`${item.name} has already been paid for.`);
  if (!currency) {
    const input = await foundry.applications.api.DialogV2.input({
      window: { title: `${item.name}: pay the request cost` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>Requested with Reputation or Net Worth only.</p>
        <label><input type="radio" name="currency" value="reputation" checked /> ${costText("reputation", cost.reputation)} (you have ${actor.system.reputation ?? 0})</label>
        <label><input type="radio" name="currency" value="netWorth" /> ${costText("netWorth", cost.netWorth)} (you have ${money(actor.system.netWorth ?? 0)})</label></div>`
    });
    if (!input) return null;
    currency = input.currency;
  }
  const payment = standingPayment(actor.system, cost, currency);
  if (!payment.ok) return ui.notifications.warn(payment.reason);
  await actor.update({ [`system.${currency}`]: payment.after });
  await item.setFlag("spycraft2", "standingCharge", {
    currency,
    amount: payment.amount,
    at: Date.now(),
    user: game.user.id
  });
  const now = currency === "reputation" ? `Reputation now ${payment.after}` : `Net Worth now ${money(payment.after)}`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<strong>${esc(item.name)}</strong> requested for ${costText(currency, payment.amount)}. ${now}.`
  });
  return payment;
}

const ask = (title, content) =>
  foundry.applications.api.DialogV2.input({
    window: { title },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options">${content}</div>`
  });
const speaker = item => ChatMessage.getSpeaker({ actor: item.parent });

/* ---------------------------------------------------------------------- */
/*  Battery life (p.223)                                                   */
/* ---------------------------------------------------------------------- */

/**
 * Record using a powered item: hours of operation or uses. Past its battery life, each use makes the GC's d20
 * roll; at or below twice the uses since depletion it runs dry and the use fails.
 */
export async function useBattery(item, { amount = null } = {}) {
  const state = batteryState(item.system.battery, item.system.charge);
  if (!state) return ui.notifications.warn(`${item.name} has no battery life to track.`);
  if (state.dry) return ui.notifications.warn(`${item.name} has run dry; recharge it first.`);
  if (amount === null) {
    const unit = state.kind === "time" ? "hours" : "uses";
    const input = await ask(
      `${item.name}: use`,
      `<label>${unit === "hours" ? "Hours of use" : "Uses"} <input name="amount" type="number" min="0" step="${unit === "hours" ? "any" : "1"}" value="1" /></label>`
    );
    if (!input) return null;
    amount = Number(input.amount) || 0;
  }
  if (amount <= 0) return null;
  if (!state.depleted) {
    const used = Math.round((state.used + amount) * 1000) / 1000;
    await item.update({ "system.charge.used": used });
    if (used >= state.capacity)
      await ChatMessage.create({
        speaker: speaker(item),
        content: `<strong>${esc(item.name)}</strong> reaches the end of its battery life (${esc(state.label)}). Further use risks it running dry.`
      });
    return { used };
  }
  // Past battery life: one roll per use.
  const roll = await new Roll("1d20").evaluate(),
    check = depletedUse(roll.total, state.depletedUses);
  await item.update({ "system.charge.depletedUses": check.count, "system.charge.dry": check.dry });
  await roll.toMessage({
    speaker: speaker(item),
    flavor: `<strong>${esc(item.name)}</strong> used past its battery life: ${check.dry ? `runs <strong>dry</strong> (${roll.total} ≤ ${check.threshold}); the use fails` : `keeps going (${roll.total} > ${check.threshold})`}.`
  });
  return check;
}

/** Recharge a powered item, posting what the recharge costs. */
export async function rechargeItem(item) {
  if (!batteryState(item.system.battery, item.system.charge)) return null;
  const cost = rechargeCost({
    rechargeable: (item.system.footnotes ?? []).some(f => /recharge/i.test(f)),
    streetValue: item.system.streetValue,
    battery: item.system.battery,
    caliber: item.system.caliber
  });
  await item.update({ "system.charge.used": 0, "system.charge.depletedUses": 0, "system.charge.dry": false });
  await ChatMessage.create({
    speaker: speaker(item),
    content: `<strong>${esc(item.name)}</strong> recharged. Cost: ${esc(cost.label)}`
  });
  return cost;
}

/* ---------------------------------------------------------------------- */
/*  Gadgets (pp.278–281)                                                   */
/* ---------------------------------------------------------------------- */

/** Install a gadget mechanism (a Gadget pick) in this item's housing, within the housing's mechanism limit. */
export async function addMechanism(item, mechanismItem) {
  const gadget = {
    housingSize: item.system.gadget.housingSize || sizeCode(item.system.sizeHands) || "",
    mechanisms: [...item.system.gadget.mechanisms]
  };
  if (mechanismItem.system?.gearCategory !== "G" || /^Gadget housing/.test(mechanismItem.name))
    return ui.notifications.warn("Drop a gadget mechanism from the Gear pack (Gadgets).");
  // Every Gadget pick except the housing sizes is a mechanism, and a mechanism cannot house another (p.278).
  if (item.system.gearCategory === "G" && !/^Gadget housing/.test(item.name))
    return ui.notifications.warn("A gadget mechanism cannot be the housing for another gadget.");
  const mechanism = {
    name: mechanismItem.name,
    caliber: mechanismItem.system.caliber ?? 0,
    powerRating: mechanismItem.system.powerRating ?? "",
    complexity: mechanismItem.system.complexity ?? "",
    skill: ""
  };
  const ok = canAddMechanism(gadget, mechanism);
  if (!ok.ok) return ui.notifications.warn(ok.reason);
  if (/^Skill (check|boost)/.test(mechanism.name)) {
    const input = await ask(
      `${mechanism.name}: skill`,
      `<label>Skill or named check this mechanism serves <input name="skill" placeholder="e.g. Security/Disable" /></label>`
    );
    mechanism.skill = input?.skill ?? "";
  }
  const mechanisms = [...gadget.mechanisms, mechanism];
  await item.update({
    "system.gadget.housingSize": gadget.housingSize,
    "system.gadget.mechanisms": mechanisms,
    ...(item.system.pick === "G" ? { "system.pickCount": mechanisms.length } : {})
  });
  return mechanism;
}

export const removeMechanism = (item, index) =>
  item.update({ "system.gadget.mechanisms": item.system.gadget.mechanisms.filter((_, i) => i !== index) });

/** Roll a gadget's Skill check mechanism: 1d20 + PR × 4, with no result cap (p.281). */
export async function rollGadgetSkillCheck(item, index) {
  const mechanism = item.system.gadget.mechanisms[index];
  if (!mechanism || !/^Skill check/.test(mechanism.name)) return null;
  const bonus = gadgetSkillBonus(mechanism.powerRating);
  const roll = await new Roll("1d20 + @bonus", { bonus }).evaluate();
  return roll.toMessage({
    speaker: speaker(item),
    flavor: `<strong>${esc(item.name)}</strong> — ${esc(mechanism.skill || "gadget skill check")} (Skill check mechanism, PR ${esc(mechanism.powerRating)}): +${bonus}, no result cap. Gear tags are ignored.`
  });
}

/* ---------------------------------------------------------------------- */
/*  Repairs and signals                                                    */
/* ---------------------------------------------------------------------- */

/** The holder makes an Electronics or Mechanics Repair check against the item's Complexity DC; success clears its failed saves. */
export async function repairItem(item) {
  const plan = repairPlan(item);
  if (!plan.possible) return ui.notifications.warn(plan.reason);
  const actor = item.parent;
  if (!actor?.rollSkill) return ui.notifications.warn("Only a character holding the item can repair it.");
  const message = await actor.rollSkill(plan.skillKey, null, {
    check: "repair",
    gearStatus: "available",
    synergySkill: "auto",
    modifier: 0
  });
  const total = message?.flags?.spycraft2?.effectiveTotal ?? message?.rolls?.[0]?.total ?? null;
  if (!Number.isFinite(total)) return message;
  if (total >= plan.dc) {
    await item.update({ "system.failedSaves": 0 });
    await ChatMessage.create({
      speaker: speaker(item),
      content: `<strong>${esc(item.name)}</strong> repaired (${total} vs Complexity DC ${plan.dc}).`
    });
  } else
    await ChatMessage.create({
      speaker: speaker(item),
      content: `<strong>${esc(item.name)}</strong> is still broken (${total} vs Complexity DC ${plan.dc}).`
    });
  return message;
}

/** The Electronics DC to pick up this item's signal at a distance, after any jamming (Tables 4.64–4.65). */
export async function signalCheck(item) {
  const pr = Number(item.system.powerRating);
  if (!Number.isFinite(pr) || pr <= 0) return ui.notifications.warn(`${item.name} has no signal Power Rating.`);
  const input = await ask(
    `${item.name}: picking up the signal`,
    `
    <label>Range increments between signal and receiver <input name="increments" type="number" min="1" max="20" step="1" value="6" /></label>
    <label>Jamming Power Rating at that point (jammer PR minus its range increments) <input name="jamming" type="number" min="0" step="1" value="0" /></label>`
  );
  if (!input) return null;
  const result = signalDC({
    increments: Number(input.increments),
    powerRating: pr,
    jamming: Number(input.jamming) || 0
  });
  const text = !result.received
    ? result.reason
    : result.automatic
      ? "Picked up automatically (5 increments or fewer)."
      : `Electronics (Int) check DC ${result.dc} to pick it up (signal PR ${result.effectivePR}; Hearing/Vision tags).`;
  await ChatMessage.create({
    speaker: speaker(item),
    content: `<strong>${esc(item.name)}</strong> signal at ${input.increments} increments: ${esc(text)}`
  });
  return result;
}

/** Undo a recorded standing charge (GC only), restoring the amount paid. */
export async function refundStandingCost(item) {
  const actor = item?.parent,
    charge = item?.getFlag("spycraft2", "standingCharge");
  if (!actor || !charge) return null;
  if (!game.user.isGM) return ui.notifications.warn("Ask the GC to refund this cost.");
  await actor.update({ [`system.${charge.currency}`]: (actor.system[charge.currency] ?? 0) + charge.amount });
  await item.unsetFlag("spycraft2", "standingCharge");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<strong>${esc(item.name)}</strong>: ${costText(charge.currency, charge.amount)} refunded.`
  });
  return charge;
}
