/**
 * Play actions for gear picks that are not tied to one roll: issuing a team-wide pick, and charging the
 * Reputation or Net Worth cost of a standing-only entry.
 */
import {getMission, teamActors} from './gc/state.mjs';
import {parseStandingCost, standingPayment} from '../rules/standing.mjs';

const esc = value => foundry.utils.escapeHTML(String(value ?? ''));

/**
 * A pick marked "one per team member" (for example tactical radios or bicycles) gives every team member a copy.
 * The GC issues the copies; each is recorded as issued from the original, carries no pick cost of its own and is
 * not issued twice.
 */
export async function issueToTeam(item) {
  if (!item?.system?.perTeamMember) return null;
  if (!game.user.isGM) return ui.notifications.warn('Ask the GC to issue this pick to the team.');
  const owner = item.parent;
  const team = teamActors(getMission()).filter(actor => actor !== owner);
  if (!team.length) return ui.notifications.warn('No other team members found. List the team in the GC console, or give players their agents.');
  const issued = [], skipped = [];
  for (const actor of team) {
    if (actor.items.some(i => i.getFlag('spycraft2', 'issuedFrom') === item.uuid)) { skipped.push(actor.name); continue; }
    const data = item.toObject();
    delete data._id;
    Object.assign(data.system, {pick: '', pickCount: 1, reserve: false, quantity: item.system.bundleSize || 1});
    foundry.utils.setProperty(data, 'flags.spycraft2.issuedFrom', item.uuid);
    await actor.createEmbeddedDocuments('Item', [data]);
    issued.push(actor.name);
  }
  const lines = [`<strong>${esc(item.name)}</strong> issued to the team${owner ? ` from ${esc(owner.name)}'s pick` : ''}.`];
  if (issued.length) lines.push(`Issued to: ${issued.map(esc).join(', ')}.`);
  if (skipped.length) lines.push(`Already held: ${skipped.map(esc).join(', ')}.`);
  await ChatMessage.create({speaker: ChatMessage.getSpeaker({actor: owner}), content: lines.join('<br>')});
  return issued;
}

const money = n => `$${Number(n).toLocaleString('en-US')}`;
const costText = (currency, amount) => currency === 'reputation' ? `${amount} Reputation` : `${money(amount)} Net Worth`;

/** Charge a standing-only pick's Reputation or Net Worth cost to the character holding it, once. */
export async function chargeStandingCost(item, {currency = null} = {}) {
  const actor = item?.parent, cost = parseStandingCost(item?.system?.standingCost);
  if (!actor || !cost) return ui.notifications.warn('This entry has no Reputation or Net Worth cost to charge, or no character holds it.');
  if (!actor.isOwner) return ui.notifications.warn('Only the character\'s owner or the GC can pay this cost.');
  if (item.getFlag('spycraft2', 'standingCharge')) return ui.notifications.warn(`${item.name} has already been paid for.`);
  if (!currency) {
    const input = await foundry.applications.api.DialogV2.input({
      window: {title: `${item.name}: pay the request cost`}, rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>Requested with Reputation or Net Worth only.</p>
        <label><input type="radio" name="currency" value="reputation" checked /> ${costText('reputation', cost.reputation)} (you have ${actor.system.reputation ?? 0})</label>
        <label><input type="radio" name="currency" value="netWorth" /> ${costText('netWorth', cost.netWorth)} (you have ${money(actor.system.netWorth ?? 0)})</label></div>`
    });
    if (!input) return null;
    currency = input.currency;
  }
  const payment = standingPayment(actor.system, cost, currency);
  if (!payment.ok) return ui.notifications.warn(payment.reason);
  await actor.update({[`system.${currency}`]: payment.after});
  await item.setFlag('spycraft2', 'standingCharge', {currency, amount: payment.amount, at: Date.now(), user: game.user.id});
  const now = currency === 'reputation' ? `Reputation now ${payment.after}` : `Net Worth now ${money(payment.after)}`;
  await ChatMessage.create({speaker: ChatMessage.getSpeaker({actor}), content: `<strong>${esc(item.name)}</strong> requested for ${costText(currency, payment.amount)}. ${now}.`});
  return payment;
}

/** Undo a recorded standing charge (GC only), restoring the amount paid. */
export async function refundStandingCost(item) {
  const actor = item?.parent, charge = item?.getFlag('spycraft2', 'standingCharge');
  if (!actor || !charge) return null;
  if (!game.user.isGM) return ui.notifications.warn('Ask the GC to refund this cost.');
  await actor.update({[`system.${charge.currency}`]: (actor.system[charge.currency] ?? 0) + charge.amount});
  await item.unsetFlag('spycraft2', 'standingCharge');
  await ChatMessage.create({speaker: ChatMessage.getSpeaker({actor}), content: `<strong>${esc(item.name)}</strong>: ${costText(charge.currency, charge.amount)} refunded.`});
  return charge;
}
