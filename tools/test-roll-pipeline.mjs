import test from 'node:test';
import assert from 'node:assert/strict';
import {RollPipeline, formulaWithModifiers, describeModifiers} from '../module/rules/roll-pipeline.mjs';
import {SPYCRAFT as cfg} from '../module/config.mjs';
import {bullRushAttackSkillChecks} from '../module/rules/bull-rush-attack.mjs';
import {bullRushDefenseSkillChecks} from '../module/rules/bull-rush.mjs';
import {conveyanceBullRushSkillChecks} from '../module/rules/conveyance-bull-rush.mjs';
import {feintSkillChecks} from '../module/rules/feint.mjs';
import {restraintSkillChecks} from '../module/rules/restraints.mjs';
import {taskPressureSkillChecks} from '../module/rules/task-pressure.mjs';
import {terrainSkillChecks} from '../module/rules/terrain.mjs';
import {threatenSkillChecks} from '../module/rules/threaten.mjs';
import {tripAttackSkillChecks, tripCounterSkillCheck} from '../module/rules/trip-attack.mjs';
import {tripDefenseSkillChecks} from '../module/rules/trip.mjs';

/* ---------------------------------------------------------------------- */
/*  The registry on its own                                                */
/* ---------------------------------------------------------------------- */

test('registration rejects malformed and duplicate contributors', () => {
  const pipeline = new RollPipeline();
  assert.throws(() => pipeline.register(null), /must be an object/);
  assert.throws(() => pipeline.register({validate() {}}), /string id/);
  assert.throws(() => pipeline.register({id: 'a'}), /implements no phase/);
  assert.throws(() => pipeline.register({id: 'a', validate: true}), /validate must be a function/);
  assert.throws(() => pipeline.register({id: 'a', kinds: 'attack', validate() {}}), /kinds must be an array/);
  assert.throws(() => pipeline.register({id: 'a', order: 'first', validate() {}}), /order must be a finite number/);
  pipeline.register({id: 'a', validate() {}});
  assert.throws(() => pipeline.register({id: 'a', validate() {}}), /already registered/);
  assert.equal(pipeline.has('a'), true);
  assert.equal(pipeline.unregister('a'), true);
  assert.equal(pipeline.unregister('a'), false);
  assert.deepEqual(pipeline.ids, []);
});

test('contributors run in order, then registration order, and only for their check kinds', async () => {
  const pipeline = new RollPipeline(), seen = [];
  const note = id => () => { seen.push(id); };
  pipeline.register({id: 'second', validate: note('second')});
  pipeline.register({id: 'attackOnly', kinds: ['attack'], validate: note('attackOnly')});
  pipeline.register({id: 'first', order: -1, validate: note('first')});
  pipeline.register({id: 'third', validate: note('third')});
  assert.deepEqual(pipeline.ids, ['first', 'second', 'attackOnly', 'third']);
  await pipeline.validate({checkKind: 'save'});
  assert.deepEqual(seen, ['first', 'second', 'third']);
  seen.length = 0;
  await pipeline.validate({checkKind: 'attack'});
  assert.deepEqual(seen, ['first', 'second', 'attackOnly', 'third']);
});

test('validation stops at the first failure and waits only for asynchronous validators', async () => {
  const pipeline = new RollPipeline(), seen = [];
  pipeline.register({id: 'sync1', validate: () => { seen.push('sync1'); }});
  pipeline.register({id: 'sync2', validate: () => { seen.push('sync2'); }});
  pipeline.register({id: 'async', validate: async () => { await null; seen.push('async'); }});
  pipeline.register({id: 'fails', validate: () => { throw new Error('stale source'); }});
  pipeline.register({id: 'never', validate: () => { seen.push('never'); }});
  const pending = pipeline.validate({});
  // Both synchronous validators have already run, with nothing able to interleave between them.
  assert.deepEqual(seen, ['sync1', 'sync2']);
  await assert.rejects(pending, /stale source/);
  assert.deepEqual(seen, ['sync1', 'sync2', 'async']);
});

test('acquire returns the first pending reservation and re-enters with its lease', async () => {
  const pipeline = new RollPipeline(), held = new Set();
  const lease = name => ({
    id: name,
    acquire: ({options}) => options[name] ? null : next => { held.add(name); return next({[name]: true}); }
  });
  pipeline.register(lease('a')).register(lease('b'));
  pipeline.register({id: 'bad', kinds: ['damage'], acquire: () => 'yes'});
  const roll = async options => {
    const pending = pipeline.acquire({checkKind: 'attack', options});
    return pending ? pending(extra => roll({...options, ...extra})) : options;
  };
  assert.deepEqual(await roll({}), {a: true, b: true});
  assert.deepEqual([...held], ['a', 'b']);
  assert.equal(pipeline.acquire({checkKind: 'attack', options: {a: true, b: true}}), null);
  assert.throws(() => pipeline.acquire({checkKind: 'damage', options: {a: true, b: true}}), /must return a function/);
});

test('modifiers are summed, labelled and applied to the dice formula only', () => {
  const pipeline = new RollPipeline();
  pipeline.register({id: 'high', modifiers: () => [{label: 'High ground', value: 1}, {label: 'Unused', value: 0}]});
  pipeline.register({id: 'smoke', kinds: ['attack'], modifiers: () => [{label: 'Smoke', value: -3}]});
  pipeline.register({id: 'quiet', modifiers: () => null});
  assert.deepEqual(pipeline.modifiers({checkKind: 'save'}), {total: 1, rows: [{id: 'high', label: 'High ground', value: 1}]});
  const attack = pipeline.modifiers({checkKind: 'attack'});
  assert.equal(attack.total, -2);
  assert.equal(describeModifiers(attack.rows), 'High ground +1; Smoke −3');
  assert.equal(formulaWithModifiers('1d20 + @total', attack.total), '1d20 + @total - 2');
  assert.equal(formulaWithModifiers('1d20 + @total', 4), '1d20 + @total + 4');
  assert.equal(formulaWithModifiers('1d20 + @total', 0), '1d20 + @total');
  assert.throws(() => formulaWithModifiers('1d20', 1.5), /whole number/);
  pipeline.register({id: 'broken', modifiers: () => [{label: 'Half', value: 0.5}]});
  assert.throws(() => pipeline.modifiers({}), /whole-number value/);
});

test('flags merge, chat controls are collected and named checks are threaded through', () => {
  const pipeline = new RollPipeline();
  pipeline.register({id: 'one', flags: () => ({shared: 1, one: true}), chatControls: () => [{label: 'One', run() {}}]});
  pipeline.register({id: 'two', flags: () => ({shared: 2}), chatControls: () => null});
  pipeline.register({id: 'adds', kinds: ['skill'], skillChecks: (ctx, checks) => [...checks, {id: `${ctx.skillKey}-extra`}]});
  assert.deepEqual(pipeline.flags({}), {shared: 2, one: true});
  assert.deepEqual(pipeline.chatControls({}).map(c => [c.id, c.label]), [['one', 'One']]);
  assert.deepEqual(pipeline.skillChecks({checkKind: 'skill', skillKey: 'sneak'}, [{id: 'hide'}]), [{id: 'hide'}, {id: 'sneak-extra'}]);
  assert.deepEqual(pipeline.skillChecks({checkKind: 'attack', skillKey: 'sneak'}, [{id: 'hide'}]), [{id: 'hide'}]);
  pipeline.register({id: 'badFlags', flags: () => []});
  assert.throws(() => pipeline.flags({}), /flags must return an object/);
  pipeline.register({id: 'badControl', chatControls: () => [{label: 'No handler'}]});
  assert.throws(() => pipeline.chatControls({}), /label and a run function/);
  pipeline.register({id: 'badChecks', kinds: ['skill'], skillChecks: () => null});
  assert.throws(() => pipeline.skillChecks({checkKind: 'skill'}, []), /must return an array/);
});

/* ---------------------------------------------------------------------- */
/*  The system's pipeline, driven through the real Actor document          */
/* ---------------------------------------------------------------------- */

const state = () => ({
  activeFeatNames: [], speed: 30, conditionContext: {}, postureMovement: {standardMove: true},
  abilities: Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map(k => [k, {value: 12, mod: 1}])),
  skillTotals: Object.fromEntries(Object.entries(cfg.skills).map(([key, s]) => [key, {
    name: s.name, ranks: 4, cap: 50, threat: 20, totals: s.abilities.map(ability => ({ability, total: 10})), bonusEntries: []
  }])),
  focusTotals: {}, knowledge: 3
});

globalThis.Actor = class {
  constructor() {
    this.type = 'agent'; this.isOwner = true; this.uuid = 'Actor.pipeline'; this.items = []; this.flags = {}; this.system = state();
  }
};
globalThis.CONFIG = {SPYCRAFT: cfg};
globalThis.game = {user: {id: 'GC', isGM: true}, settings: {get: () => false}, time: {worldTime: 126}, combats: [], actors: [], i18n: {localize: String}};
globalThis.foundry = {utils: {escapeHTML: String, randomID: () => 'id'}};
globalThis.ui = {notifications: {warn: () => null}};
globalThis.ChatMessage = {getSpeaker: () => ({})};
const rolled = [], posts = [];
globalThis.Roll = class {
  constructor(formula, data) { this.formula = formula; this.total = 12 + (data.total ?? 0); this.dice = [{total: 12}]; }
  async evaluate() { rolled.push(this.formula); return this; }
  async toMessage(data) { posts.push(data); return data; }
};
const {SpycraftActor} = await import('../module/documents/actor.mjs');
const {rollPipeline} = await import('../module/rolls/index.mjs');

test('the system registers its reservations, validators, named checks and chat controls in a fixed order', () => {
  const ids = rollPipeline.ids;
  assert.deepEqual(ids.slice(0, 5), ['feintBonusLease', 'attackDamageLease', 'sideStanceLease', 'sideStanceDamageLease', 'sneakAttackTarget']);
  assert.equal(ids.indexOf('callbackSaveContext') - ids.indexOf('sneakAttackTarget') + 1, 71);
  assert.ok(ids.indexOf('terrainChecks') < ids.indexOf('optionalRuleChecks'));
  assert.ok(ids.indexOf('conveyanceBullRushChecks') < ids.indexOf('tripCounterCheck'));
  assert.deepEqual(ids.slice(-2), ['unnervingControl', 'strutControl']);
  assert.equal(new Set(ids).size, ids.length);
});

test('named skill checks match the original fixed composition for every skill', () => {
  const actor = new SpycraftActor();
  const legacy = (key, options, optionalRules) => {
    const base = terrainSkillChecks(actor.system, key, cfg.skills[key]?.checks ?? [])
      .filter(check => !check.optionalRule || optionalRules.includes(check.optionalRule));
    const checks = conveyanceBullRushSkillChecks(key, bullRushAttackSkillChecks(key, bullRushDefenseSkillChecks(key,
      tripAttackSkillChecks(key, tripDefenseSkillChecks(key, feintSkillChecks(key, threatenSkillChecks(key,
        taskPressureSkillChecks(actor.system, key, restraintSkillChecks(actor.system, key, base)))))))));
    if (key === 'acrobatics' && options.tripCounter) checks.push(tripCounterSkillCheck());
    return checks;
  };
  for (const key of Object.keys(cfg.skills)) {
    for (const options of [{}, {tripCounter: {id: 'counter'}}]) {
      for (const optionalRules of [[], ['linguistics']]) {
        const offered = rollPipeline.skillChecks({actor, checkKind: 'skill', skillKey: key, options, optionalRules}, cfg.skills[key].checks ?? []);
        assert.deepEqual(offered, legacy(key, options, optionalRules), key);
      }
    }
  }
});

test('a registered contributor validates before and after the dice, adjusts them once and records its facts', async () => {
  const actor = new SpycraftActor(), phases = [];
  rollPipeline.register({
    id: 'testHighGround',
    kinds: ['attack'],
    validate: ({phase, options}) => { phases.push(phase); if (options.staleAfterRoll && phase === 'after') throw new Error('High ground changed.'); },
    modifiers: ({options}) => options.highGround ? [{label: 'High ground', value: 1}] : [],
    flags: ({options}) => ({highGround: options.highGround === true})
  });
  try {
    rolled.length = 0; posts.length = 0;
    const message = await actor.rollCheck('1d20 + @total', {total: 5}, {checkKind: 'attack', flavor: 'Attack', highGround: true});
    const check = message.flags.spycraft2;
    assert.deepEqual(phases, ['before', 'after']);
    assert.deepEqual(rolled, ['1d20 + @total + 1']);
    assert.equal(check.formula, '1d20 + @total');
    assert.equal(check.highGround, true);
    assert.deepEqual(check.pipelineModifiers, [{id: 'testHighGround', label: 'High ground', value: 1}]);
    assert.match(message.flavor, /High ground \+1\./);

    // Another check kind is untouched and carries no pipeline record.
    rolled.length = 0; phases.length = 0;
    const save = (await actor.rollCheck('1d20 + @total', {total: 5}, {checkKind: 'save', checkId: 'will', flavor: 'Will', highGround: true})).flags.spycraft2;
    assert.deepEqual(rolled, ['1d20 + @total']);
    assert.deepEqual(phases, []);
    assert.equal(Object.hasOwn(save, 'pipelineModifiers'), false);
    assert.equal(Object.hasOwn(save, 'highGround'), false);

    // A failure after the dice posts nothing.
    posts.length = 0;
    await assert.rejects(actor.rollCheck('1d20 + @total', {total: 5}, {checkKind: 'attack', staleAfterRoll: true}), /High ground changed/);
    assert.equal(posts.length, 0);
  } finally {
    rollPipeline.unregister('testHighGround');
  }
});

test('a reservation contributor makes the roll re-enter with its lease before any dice', async () => {
  const actor = new SpycraftActor(), events = [];
  rollPipeline.register({
    id: 'testLease',
    order: -10,
    acquire: ({options}) => options.testLease ? null : async next => {
      events.push('reserve');
      try { return await next({testLease: 'held'}); } finally { events.push('release'); }
    },
    validate: ({options, phase}) => { events.push(`${phase}:${options.testLease}`); }
  });
  try {
    rolled.length = 0;
    await actor.rollCheck('1d20', {}, {checkKind: 'check'});
    assert.deepEqual(events, ['reserve', 'before:held', 'after:held', 'release']);
    assert.equal(rolled.length, 1);
  } finally {
    rollPipeline.unregister('testLease');
  }
});
