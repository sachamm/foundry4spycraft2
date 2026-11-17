/**
 * Play actions for gear picks that are not tied to one roll: issuing a team-wide pick, and charging the
 * Reputation or Net Worth cost of a standing-only entry.
 */
import {getMission, teamActors} from './gc/state.mjs';

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
