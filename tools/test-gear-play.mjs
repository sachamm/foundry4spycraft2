import test from 'node:test';
import assert from 'node:assert/strict';
import {parseStandingCost, standingPayment, VEHICLE_NET_WORTH_PER_REPUTATION} from '../module/rules/standing.mjs';

test('standing costs parse from both printed formats', () => {
  assert.deepEqual(parseStandingCost('15/$750,000'), {reputation: 15, netWorth: 750000});
  assert.deepEqual(parseStandingCost('15 Reputation'), {reputation: 15, netWorth: 15 * VEHICLE_NET_WORTH_PER_REPUTATION});
  for (const label of ['', '—', 'R$500', null]) assert.equal(parseStandingCost(label), null, String(label));
});

test('a standing payment never takes Reputation or Net Worth below 0', () => {
  const cost = {reputation: 10, netWorth: 500000};
  assert.deepEqual(standingPayment({reputation: 12}, cost, 'reputation'), {ok: true, amount: 10, balance: 12, after: 2});
  assert.equal(standingPayment({reputation: 9}, cost, 'reputation').ok, false);
  assert.equal(standingPayment({netWorth: 499999}, cost, 'netWorth').ok, false);
  assert.equal(standingPayment({netWorth: 500000}, cost, 'netWorth').after, 0);
  assert.equal(standingPayment({}, cost, 'cash').ok, false);
});

/* ---------------------------------------------------------------------- */
/*  Play actions against stubbed Foundry documents                         */
/* ---------------------------------------------------------------------- */

const posts = [], warnings = [];
globalThis.foundry = {utils: {escapeHTML: String, setProperty: (o, path, v) => { const keys = path.split('.'); let t = o; for (const k of keys.slice(0, -1)) t = t[k] ??= {}; t[keys.at(-1)] = v; }}};
globalThis.ui = {notifications: {warn: message => { warnings.push(message); return null; }}};
globalThis.ChatMessage = {getSpeaker: ({actor}) => ({alias: actor?.name}), create: async data => posts.push(data)};
globalThis.game = {user: {isGM: true, id: 'gm'}, settings: {get: () => ({team: []})}, actors: []};

class FakeItem {
  constructor(parent, data) { Object.assign(this, structuredClone(data)); this.parent = parent; this.flags ??= {}; this.uuid = `${parent?.uuid}.Item.${data.name}`; }
  getFlag(scope, key) { return this.flags[scope]?.[key]; }
  async setFlag(scope, key, value) { (this.flags[scope] ??= {})[key] = value; }
  async unsetFlag(scope, key) { delete this.flags[scope]?.[key]; }
  toObject() { return structuredClone({name: this.name, type: this.type, system: this.system, flags: this.flags}); }
}
class FakeActor {
  constructor(name, system = {}) { this.name = name; this.type = 'agent'; this.system = system; this.items = []; this.isOwner = true; this.hasPlayerOwner = true; this.uuid = `Actor.${name}`; this.id = name; }
  async update(changes) { for (const [path, v] of Object.entries(changes)) this.system[path.replace('system.', '')] = v; }
  async createEmbeddedDocuments(_type, list) { for (const data of list) this.items.push(new FakeItem(this, data)); }
}

const {issueToTeam, chargeStandingCost, refundStandingCost} = await import('../module/apps/gear-play.mjs');

test('paying a standing cost charges once and a GC refund restores it', async () => {
  const actor = new FakeActor('Ada', {reputation: 20, netWorth: 0});
  const item = new FakeItem(actor, {name: 'Cover identity', type: 'gear', system: {standingCost: '15/$750,000'}});
  const paid = await chargeStandingCost(item, {currency: 'reputation'});
  assert.equal(paid.after, 5);
  assert.equal(actor.system.reputation, 5);
  assert.deepEqual([item.getFlag('spycraft2', 'standingCharge').currency, item.getFlag('spycraft2', 'standingCharge').amount], ['reputation', 15]);
  assert.equal(await chargeStandingCost(item, {currency: 'reputation'}), null, 'not charged twice');
  assert.equal(actor.system.reputation, 5);
  await refundStandingCost(item);
  assert.equal(actor.system.reputation, 20);
  assert.equal(item.getFlag('spycraft2', 'standingCharge'), undefined);
  // Not enough Net Worth: nothing changes.
  warnings.length = 0;
  await chargeStandingCost(item, {currency: 'netWorth'});
  assert.equal(actor.system.netWorth, 0);
  assert.match(warnings[0], /Not enough Net Worth/);
});

test('a team-wide pick is issued once to each other team member, at no pick cost', async () => {
  const ada = new FakeActor('Ada'), bo = new FakeActor('Bo'), cy = new FakeActor('Cy');
  game.actors = [ada, bo, cy];
  const radio = new FakeItem(ada, {name: 'Radio, tactical or headset', type: 'gear', system: {perTeamMember: true, pick: 'E', pickCount: 1, bundleSize: 1, quantity: 1}});
  ada.items.push(radio);
  assert.deepEqual(await issueToTeam(radio), ['Bo', 'Cy']);
  for (const actor of [bo, cy]) {
    assert.equal(actor.items.length, 1);
    assert.equal(actor.items[0].system.pick, '', 'no pick charged to the copy');
    assert.equal(actor.items[0].getFlag('spycraft2', 'issuedFrom'), radio.uuid);
  }
  assert.deepEqual(await issueToTeam(radio), [], 'issued only once');
  assert.match(posts.at(-1).content, /Already held: Bo, Cy/);
  game.user.isGM = false;
  assert.equal(await issueToTeam(radio), null, 'players ask the GC');
  game.user.isGM = true;
});

/* ---------------------------------------------------------------------- */
/*  Battery, gadgets, item use in checks, repairs and signals              */
/* ---------------------------------------------------------------------- */

const g = await import('../module/rules/gear-play-rules.mjs');
const gearData = JSON.parse((await import('node:fs')).readFileSync(new URL('../src/data/gear.json', import.meta.url)));

test('battery labels parse to hours or uses, and every printed format is understood', () => {
  assert.deepEqual(g.parseBattery('72 hrs.'), {kind: 'time', hours: 72, label: '72 hrs.'});
  assert.equal(g.parseBattery('30 min.').hours, 0.5);
  assert.equal(g.parseBattery('3 rounds').hours, 3 / 600);
  assert.deepEqual(g.parseBattery('3 doses'), {kind: 'uses', uses: 3, label: '3 doses'});
  assert.equal(g.parseBattery('1 use each').uses, 1);
  for (const label of ['varies', '×2', '', '—']) assert.equal(g.parseBattery(label), null, label);
  const labels = new Set(['electronics', 'gadgets', 'security', 'tradecraft'].flatMap(k => gearData[k]).map(r => r.battery).filter(b => b && !/^(varies|×\d)$/.test(b)));
  for (const label of labels) assert.ok(g.parseBattery(label), label);
});

test('using an item past its battery life risks running dry on the GC\'s d20', () => {
  const state = g.batteryState('8 hrs.', {used: 8});
  assert.deepEqual([state.remaining, state.depleted], [0, true]);
  assert.deepEqual(g.depletedUse(2, 0), {dry: true, count: 1, threshold: 2});
  assert.deepEqual(g.depletedUse(3, 0), {dry: false, count: 1, threshold: 2});
  assert.equal(g.depletedUse(6, 2).dry, true);
});

test('recharging is free from power for rechargeable items, otherwise it costs a Common Item or 1% of value', () => {
  assert.match(g.rechargeCost({rechargeable: true, battery: '8 hrs.'}).label, /Free.*takes 2 hr\./);
  assert.match(g.rechargeCost({streetValue: '$1,500'}).label, /1 Common Item or \$15\./);
  assert.match(g.rechargeCost({streetValue: 'R$20,000'}).label, /\$200/);
  assert.match(g.rechargeCost({streetValue: '', caliber: 3}).label, /3 Common Items or 1 Caliber II gear pick/);
});

test('a gadget housing limits mechanisms by Size and derives its Knowledge DC, Damage save and Complexity', () => {
  const gadget = {housingSize: 'S', mechanisms: [{name: 'Attack', powerRating: '2', complexity: '30/+2'}, {name: 'Disguised gadget', powerRating: '2', complexity: '25/+1'}]};
  const state = g.gadgetState(gadget);
  assert.deepEqual([state.max, state.count, state.knowledgeDC, state.damageSave, state.complexity], [3, 2, 34, 8, '30/+2']);  // 34 − 2 + 2
  assert.equal(g.gadgetState({...gadget, mechanisms: [...gadget.mechanisms, {name: 'Durable gadget', powerRating: '3'}]}, {itemDamageSave: 4}).damageSave, 7);
  assert.equal(g.canAddMechanism({housingSize: 'N', mechanisms: [{name: 'Silence'}]}, {name: 'Attack'}).ok, false);
  assert.equal(g.canAddMechanism({housingSize: '', mechanisms: []}, {name: 'Attack'}).ok, false);
  const hit = g.gadgetDamage(gadget, 1, () => 0);
  assert.deepEqual([hit.lost.map(m => m.name), hit.mechanisms.length, hit.destroyed], [['Attack'], 1, false]);
  assert.equal(g.gadgetDamage(gadget, 5).destroyed, true);
  assert.equal(g.gadgetSkillBonus('3'), 12);
});

test('an item adds its result cap and gear bonus only to the checks it supports, and not when broken or dry', () => {
  const sweeper = {name: 'Bug sweeper, commercial (Caliber II)', system: {resultCap: '+5', sizeHands: 'T/1h', failedSaves: 0}};
  assert.deepEqual([g.gearUsePlan('search', 'perception', sweeper).capIncrease, g.gearUsePlan('search', 'perception', sweeper).applies], [5, true]);
  assert.equal(g.gearUsePlan('notice', 'awareness', sweeper).capIncrease, 0);
  const retina = {name: 'Stress analyzer, retina', system: {resultCap: '+10', failedSaves: 0}};
  assert.deepEqual(g.gearUsePlan('senseMotive', 'detect-lie', retina).bonuses, [{type: 'gear', value: 3, source: 'Stress analyzer, retina'}]);
  assert.match(g.gearUsePlan('search', 'perception', {...sweeper, system: {...sweeper.system, failedSaves: 1}}).blockedReason, /broken/);
  assert.match(g.gearUsePlan('search', 'perception', {...sweeper, system: {...sweeper.system, charge: {dry: true}}}).blockedReason, /run dry/);
  assert.equal(g.gearUsePlan('search', 'perception', {name: 'First Aid Kit', system: {kitType: 'First Aid Kit'}}).applies, false);
});

test('repairs use Electronics or Mechanics against the Complexity DC; signals get harder with range and jamming', () => {
  assert.deepEqual(g.repairPlan({name: 'Bug, audio', system: {gearCategory: 'E', complexity: '25/+1', sizeHands: 'F/1h', failedSaves: 1}}), {possible: true, skillKey: 'electronics', dc: 25, fromComplexity: true});
  assert.equal(g.repairPlan({name: 'Grapple gun, standard', system: {gearCategory: 'S', complexity: '17/+0', sizeHands: 'S/2h', failedSaves: 1}}).skillKey, 'mechanics');
  assert.match(g.repairPlan({name: 'Radio', system: {gearCategory: 'E', failedSaves: 2, sizeHands: 'T/1h'}}).reason, /destroyed/);
  assert.equal(g.repairPlan({name: 'Radio', system: {gearCategory: 'E', failedSaves: 0}}).possible, false);
  assert.deepEqual(g.signalDC({increments: 7, powerRating: 5}), {received: true, automatic: false, dc: 25, effectivePR: 5});
  assert.equal(g.signalDC({increments: 7, powerRating: 5, jamming: 2}).dc, 29);
  assert.equal(g.signalDC({increments: 4, powerRating: 1}).automatic, true);
  assert.equal(g.signalDC({increments: 11, powerRating: 9}).received, false);
  assert.equal(g.signalDC({increments: 6, powerRating: 3, jamming: 3}).received, false);
});
