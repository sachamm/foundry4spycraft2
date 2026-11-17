/** Dramatic Conflict tracker (pp.363–388): the GC runs each Conflict round through a short series of dialogs. */
import {CONFLICT_TYPES, startConflict, availableStrategies, chooseStrategy, strategyModifier, resolveCheck, advantageOptions, chooseAdvantages, nextRound, concede, adjustLead, conflictSummary} from '../../rules/gc/conflict.mjs';
import {requireGC, getConflicts, saveConflict} from './state.mjs';

const esc = text => foundry.utils.escapeHTML(String(text ?? ''));
const ask = (title, content) => foundry.applications.api.DialogV2.input({window: {title}, rejectClose: false, content: `<div class="spycraft2-roll-options">${content}</div>`});
const options = (rows, selected) => rows.map(([value, label]) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`).join('');
const gm = () => ChatMessage.getWhisperRecipients('GM').map(user => user.id);
const say = (content, whisper = false) => ChatMessage.create({speaker: {alias: 'Dramatic Conflict'}, content, ...(whisper ? {whisper: gm()} : {})});
const signed = value => (value >= 0 ? `+${value}` : `${value}`);
const sideName = (conflict, side) => conflict[side].name || (side === 'predator' ? 'Predator' : 'Prey');
const strategy = (conflict, side) => CONFLICT_TYPES[conflict.type].strategies.find(entry => entry.id === conflict[side].strategy);

export function conflictRows() {
  return Object.entries(getConflicts()).map(([id, conflict]) => ({id, ...conflictSummary(conflict), name: conflict.name, predator: sideName(conflict, 'predator'), prey: sideName(conflict, 'prey'), strategiesChosen: ['predator', 'prey'].filter(side => conflict[side].strategy).length}));
}

export async function startConflictDialog() {
  requireGC();
  const typeRows = Object.entries(CONFLICT_TYPES).map(([id, type]) => [id, `${type.name} (pp.${type.pages.join('–')})`]);
  const first = await ask('Start a Dramatic Conflict', `
    <label>Type <select name="type">${options(typeRows)}</select></label>
    <label>Name <input name="name" placeholder="e.g. Rooftop pursuit" /></label>
    <label>Predator <input name="predator" /></label>
    <label>Prey <input name="prey" /></label>`);
  if (!first) return null;
  const rules = CONFLICT_TYPES[first.type];
  const leadRows = (rules.startingLead?.rules ?? []).map(rule => `<li>${esc(rule.when)}: ${rule.lead ?? esc(rule.formula ?? rule.result ?? '')}</li>`).join('');
  const ratingInputs = (rules.powerRatings ?? []).map((rating, i) => `<label>${esc(rating)} — Predator <input type="number" name="p${i}" value="0" /> Prey <input type="number" name="q${i}" value="0" /></label>`).join('');
  const second = await ask(`${rules.name}: starting Lead and ratings`, `
    <p>${esc(rules.startingLead?.summary ?? '')}</p><ul>${leadRows}</ul>
    <p>Predator skill: ${esc(rules.predatorSkills.join('; '))}<br>Prey skill: ${esc(rules.preySkills.join('; '))}<br>Each round: ${esc(rules.roundTime)}</p>
    <label>Starting Lead (1–9) <input type="number" name="lead" min="1" max="9" value="${rules.startingLead?.default ?? 5}" required /></label>
    ${ratingInputs}`);
  if (!second) return null;
  const ratings = side => Object.fromEntries((rules.powerRatings ?? []).map((rating, i) => [rating, Number(second[`${side}${i}`]) || 0]));
  try {
    const conflict = startConflict(first.type, {lead: Number(second.lead), name: first.name, predator: {name: first.predator, ratings: ratings('p')}, prey: {name: first.prey, ratings: ratings('q')}});
    const id = foundry.utils.randomID();
    await saveConflict(id, conflict);
    await say(`<b>${esc(conflict.name)}</b> begins — ${esc(rules.name)}. Lead ${conflict.lead}. ${esc(sideName(conflict, 'predator'))} (Predator) wins at 0; ${esc(sideName(conflict, 'prey'))} (Prey) wins at 10.`);
    return id;
  } catch (error) { return ui.notifications.warn(error.message); }
}

/** Advance the chosen conflict by whatever its current step needs. */
export async function advanceConflict(id) {
  requireGC();
  const conflict = getConflicts()[id];
  if (!conflict) return ui.notifications.warn('That conflict no longer exists.');
  const rules = CONFLICT_TYPES[conflict.type];
  try {
    if (conflict.step === 'strategies') {
      const side = conflict.predator.strategy ? 'prey' : 'predator';
      const list = availableStrategies(conflict, side);
      const rows = list.map(entry => [entry.id, `${entry.name} (${entry.modifier === null ? 'see note' : signed(entry.modifier)}${entry.skill ? `; ${entry.skill}` : ''}${entry.roundDuration && !['—', '**'].includes(entry.roundDuration) ? `; ${entry.roundDuration}` : ''}) — ${entry.advantages.join(', ').replace('*', 'any but Victory')}${entry.available ? '' : ` — needs ${entry.reasons.join('; ')}`}${entry.confirm ? ' — GC confirms other requirement' : ''}`]);
      const input = await ask(`${conflict.name}: ${sideName(conflict, side)} chooses a Strategy (Lead ${conflict.lead})`, `
        <p>Strategies are secret until both are chosen and cannot be changed afterwards. Ask now about abilities used before the reveal.</p>
        <label>Strategy <select name="strategy">${options(rows, list.find(entry => entry.available)?.id)}</select></label>
        <label><input type="checkbox" name="confirmOther" /> Other printed requirement confirmed (feat, class ability, approach, software…)</label>`);
      if (!input) return null;
      const next = chooseStrategy(conflict, side, input.strategy, {confirmOther: !!input.confirmOther});
      await saveConflict(id, next);
      if (next.step === 'check') await say(`<b>${esc(conflict.name)}</b> — round ${next.round}, Lead ${next.lead}. Strategies revealed: ${esc(sideName(next, 'predator'))} <b>${esc(strategy(next, 'predator').name)}</b> (${signed(strategyModifier(next, 'predator'))}); ${esc(sideName(next, 'prey'))} <b>${esc(strategy(next, 'prey').name)}</b> (${signed(strategyModifier(next, 'prey'))}). Make the opposed check.`);
      return next;
    }
    if (conflict.step === 'check') {
      const critical = side => `<label>${esc(sideName(conflict, side))} critical <select name="${side}Critical">${options([['', 'None'], ['success', 'Critical success'], ['failure', 'Critical failure']], '')}</select></label>`;
      const input = await ask(`${conflict.name}: opposed check`, `
        <p>Enter each final result with its Strategy modifier already applied (${esc(strategy(conflict, 'predator').name)} ${signed(strategyModifier(conflict, 'predator'))}; ${esc(strategy(conflict, 'prey').name)} ${signed(strategyModifier(conflict, 'prey'))}). Criticals only shift the Lead by 1; threats and errors otherwise do nothing here.</p>
        <label>${esc(sideName(conflict, 'predator'))} result <input type="number" name="predator" required /></label>${critical('predator')}
        <label>${esc(sideName(conflict, 'prey'))} result <input type="number" name="prey" required /></label>${critical('prey')}
        <label>If tied, winner <select name="tieWinner">${options([['', '—'], ['predator', sideName(conflict, 'predator')], ['prey', sideName(conflict, 'prey')]], '')}</select></label>`);
      if (!input) return null;
      const next = resolveCheck(conflict, {predator: {result: Number(input.predator), critical: input.predatorCritical || null}, prey: {result: Number(input.prey), critical: input.preyCritical || null}, tieWinner: input.tieWinner || null});
      await saveConflict(id, next);
      if (next.winner) return announceEnd(id, next);
      await say(`<b>${esc(conflict.name)}</b>: ${esc(sideName(next, next.pending.winner))} wins the check by ${next.pending.margin} and takes ${next.pending.advantages} Advantage(s).${next.pending.criticalShift ? ` Criticals move the Lead ${next.pending.criticalShift}.` : ''} Lead ${next.lead}.`);
      return next;
    }
    if (conflict.step === 'advantages') {
      const list = advantageOptions(conflict), allowed = conflict.pending.advantages;
      const inputs = list.map(advantage => `<label title="${esc(advantage.summary)} ${esc(advantage.repeat ?? '')}">${esc(advantage.name)} — ${esc(advantage.summary)} <input type="number" name="pick-${advantage.id}" min="0" max="${allowed}" value="0" /></label>`).join('');
      const input = await ask(`${conflict.name}: ${sideName(conflict, conflict.pending.winner)} chooses ${allowed} Advantage(s)`, `
        <p>Enter how many times each Advantage is chosen (total 1 to ${allowed}).</p>${inputs}
        <label>Override the Lead change (leave blank to use the printed rule) <input type="number" name="leadShift" min="0" /></label>`);
      if (!input) return null;
      const picks = list.flatMap(advantage => Array(Math.max(0, Number(input[`pick-${advantage.id}`]) || 0)).fill(advantage.id));
      const next = chooseAdvantages(conflict, picks, {leadShift: input.leadShift === '' || input.leadShift === null || input.leadShift === undefined ? null : Number(input.leadShift)});
      await saveConflict(id, next);
      const last = next.history.at(-1);
      await say(`<b>${esc(conflict.name)}</b>: ${esc(last.advantages.map(pick => list.find(advantage => advantage.id === pick).name).join(', '))}. Lead <b>${next.lead}</b>.${last.notes?.length ? `<br>${last.notes.map(esc).join('<br>')}` : ''}`);
      if (next.winner) return announceEnd(id, next);
      if (rules.outsideActions) await say(`Outside actions: ${esc(rules.outsideActions)}`, true);
      return next;
    }
    if (conflict.step === 'outside') { const next = nextRound(conflict); await saveConflict(id, next); await say(`<b>${esc(conflict.name)}</b> — round ${next.round} (${esc(rules.roundTime)}). Lead ${next.lead}. Choose Strategies.`); return next; }
    return ui.notifications.info('This conflict is over. Remove it when you no longer need the record.');
  } catch (error) { return ui.notifications.warn(error.message); }
}

async function announceEnd(id, conflict) {
  const summary = conflictSummary(conflict);
  await say(`<b>${esc(conflict.name)}</b> ends at Lead ${conflict.lead}: ${conflict.winner === 'none' ? 'no winner' : `${esc(sideName(conflict, conflict.winner))} (${conflict.winner}) wins`}.${summary.result ? `<br>${esc(summary.result)}` : ''}`);
  return conflict;
}

/** Concede, correct the Lead, or delete the record. */
export async function manageConflict(id) {
  requireGC();
  const conflict = getConflicts()[id];
  if (!conflict) return null;
  const rules = CONFLICT_TYPES[conflict.type];
  const tables = Object.values(rules.tables ?? {}).map(table => `<details><summary>${esc(table.title)}</summary><table><tr>${table.columns.map(column => `<th>${esc(column)}</th>`).join('')}</tr>${table.rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</table></details>`).join('');
  const input = await ask(`${conflict.name}: manage`, `
    <p>Round ${conflict.round}, Lead ${conflict.lead}. ${esc((rules.notes ?? []).join(' '))}</p>${tables}
    <label>Action <select name="action">${options([['lead', 'Set the Lead (outside effect or correction)'], ['concedePredator', `${sideName(conflict, 'predator')} concedes`], ['concedePrey', `${sideName(conflict, 'prey')} concedes`], ['remove', 'Remove this conflict']], 'lead')}</select></label>
    <label>Lead <input type="number" name="lead" value="${conflict.lead}" /></label>`);
  if (!input) return null;
  try {
    if (input.action === 'remove') return saveConflict(id, null);
    const next = input.action === 'lead' ? adjustLead(conflict, Number(input.lead)) : concede(conflict, input.action === 'concedePredator' ? 'predator' : 'prey');
    await saveConflict(id, next);
    if (next.winner) await announceEnd(id, next); else await say(`<b>${esc(conflict.name)}</b>: Lead set to ${next.lead}.`);
    return next;
  } catch (error) { return ui.notifications.warn(error.message); }
}
