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
