/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {groupBuildTasks, activeConditionLabels} from '../module/sheets/agent-ux.mjs';

test('repeated build choices are counted without merging different destinations or changing engine data', () => {
  const task = {tab:'classes', text:'Pointman: choose a skill for Versatility at class level 1.'};
  const input = [task, {...task}, {...task}, {tab:'skills',text:task.text}];
  const grouped = groupBuildTasks(input);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].text, 'Pointman: choose 3 more skills for Versatility at class level 1.');
  assert.equal(grouped[1].count, 1);
  assert.equal(input[0].text, task.text);
});

test('conditions remain visible when detailed condition actions are collapsed', () => {
  assert.deepEqual(activeConditionLabels({conditionContext:{blinded:true,held:false},conditionPenalties:{sickened:2},mentalLeapState:{fatigued:true},shakenState:{label:'Shaken II'}}), ['Blinded','Sickened','Fatigued','Shaken II']);
  assert.deepEqual(activeConditionLabels(), []);
});
