/**
 * Security devices (pp.437–439, Table 7.9): locks, sensors and traps scaled by a Power Rating (PR).
 * The printed cells are formulas in PR; this module turns them into numbers for one device.
 */
import {GC_DATA} from '../gc-tables.mjs';

export const SECURITY_DEVICES = GC_DATA.tables.security;
export const securityDevice = id => SECURITY_DEVICES.find(device => device.id === id) ?? null;

/** Evaluate a printed formula such as "10 + (PR × 2)" or "+(PR × 3)". Returns null when it is not plain arithmetic. */
export function evaluatePR(formula, pr) {
  if (formula === null || formula === undefined || formula === '') return null;
  if (typeof formula === 'number') return formula;
  if (!Number.isSafeInteger(pr) || pr < 1) throw new Error('Choose a Power Rating of 1 or more.');
  const text = String(formula).replaceAll('PR', String(pr)).replaceAll('×', '*').replace(/^\s*\+/, '').trim();
  if (!/^[\d\s+*()-]+$/.test(text)) return null;
  // Tiny recursive-descent parser: + - * and parentheses over whole numbers.
  let at = 0;
  const skip = () => { while (text[at] === ' ') at++; };
  const atom = () => {
    skip();
    if (text[at] === '(') { at++; const value = sum(); skip(); if (text[at] !== ')') throw new Error('Unbalanced formula.'); at++; return value; }
    const start = at; while (/\d/.test(text[at] ?? '')) at++;
    if (start === at) throw new Error('Malformed formula.');
    return Number(text.slice(start, at));
  };
  const product = () => { let value = atom(); for (skip(); text[at] === '*'; skip()) { at++; value *= atom(); } return value; };
  const sum = () => { let value = product(); for (skip(); text[at] === '+' || text[at] === '-'; skip()) { const op = text[at++]; const right = product(); value = op === '+' ? value + right : value - right; } return value; };
  try { const value = sum(); skip(); return at === text.length ? value : null; } catch { return null; }
}

/** Fill PR into printed text such as "(PR)d6 acid" or "PR × 5 ft. radius". */
export function fillPR(text, pr) {
  return String(text ?? '').replace(/\(PR\)/g, String(pr)).replace(/PR\s*×\s*(\d+)/g, (_, n) => String(pr * Number(n))).replace(/\bPR\b/g, String(pr));
}

/** One device at a given Power Rating, with every scalable number resolved. */
export function resolveDevice(id, pr) {
  const device = securityDevice(id);
  if (!device) throw new Error('Unknown security device.');
  const number = key => evaluatePR(device[key], pr);
  const detectDC = number('detectDC');
  return {
    id: device.id, name: device.name, kind: device.kind, page: device.page, powerRating: pr,
    xp: number('xp'), xpPrinted: device.xp,
    detectDC, disableDC: number('disableDC'),
    defense: detectDC, // p.437: when a device may be attacked, its Defense equals its Detect DC
    damageSave: number('damageSave'), openDC: evaluatePR(device.openDC, pr), openSkill: device.openSkill ?? '', breakingOpens: device.breakingOpens ?? null,
    awareness: number('awareness'), opposedBy: fillPR(device.opposedBy, pr), autoTrigger: !!device.autoTrigger,
    attack: number('attack'), saveDC: number('saveDC'), damage: fillPR(device.damage, pr), repeats: !!device.repeats, autoHit: !!device.autoHit,
    // p.437: a trap that attacks has error range 1 and threat range 20 unless its row says otherwise.
    error: 1, threat: device.rangeIncrementFromPR ? 21 - Math.ceil(pr / 2) : 20,
    targetArea: fillPR(device.targetArea, pr), summary: fillPR(device.summary, pr)
  };
}

/** A sensor's Awareness check against the intruder's opposed result; no result cap applies. */
export function sensorCheck(device, roll, opposedResult) {
  if (device.kind !== 'sensor') throw new Error('Only sensors make Awareness checks.');
  if (device.autoTrigger) return {triggered: true, automatic: true};
  if (device.awareness === null) return {triggered: null, manual: device.opposedBy};
  const total = roll + device.awareness;
  return {total, triggered: total >= opposedResult, tie: total === opposedResult};
}

/** A trap either attacks (error 1, threat 20) or forces a Reflex save for half damage, rounded down. */
export function trapOutcome(device, {roll = null, defense = null, saveResult = null, damage = null} = {}) {
  if (device.kind !== 'trap') throw new Error('Only traps attack.');
  if (device.attack !== null) {
    const total = roll + device.attack;
    return {mode: 'attack', total, hit: roll !== 1 && total >= defense, threat: roll >= device.threat && total >= defense, error: roll <= device.error};
  }
  if (device.saveDC !== null) {
    const saved = Number.isFinite(saveResult) && saveResult >= device.saveDC;
    return {mode: 'save', dc: device.saveDC, saved, damage: Number.isFinite(damage) ? (saved ? Math.floor(damage / 2) : damage) : null};
  }
  return {mode: device.autoHit ? 'automatic' : 'manual'};
}
