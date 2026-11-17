/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const sheetUX=readFileSync(new URL('../../module/sheets/agent-ux.mjs',import.meta.url),'utf8');
const skillUX=readFileSync(new URL('../../module/apps/skill-dialog-ux.mjs',import.meta.url),'utf8');
const css=readFileSync(new URL('../../styles/spycraft2.css',import.meta.url),'utf8')+readFileSync(new URL('../../styles/retro.css',import.meta.url),'utf8');

async function load(page, source, name) {
  await page.addScriptTag({type:'module',content:`${source}\nwindow.${name}=${name};`});
  await page.waitForFunction(name=>typeof window[name]==='function',name);
}

test('Play/Edit preserves resource access, disables build fields and supports keyboard actions and skill filtering',async({page})=>{
  await page.setContent(`<style>${css}</style><div class="spycraft2 application sheet agent">
    <input name="system.vitality.value" value="11" />
    <div class="edit-only"><input name="system.abilities.str.base" value="10" /><input name="granted" disabled /></div>
    <input class="edit-only" name="system.xp" value="0" />
    <a data-action="rollSave" data-save="fort">Fortitude</a>
    <input class="skill-search" /><input class="trained-filter" type="checkbox" /><span class="skill-count"></span>
    <table class="skills-table"><tbody><tr data-skill-name="Athletics STR/CON" data-trained="true"><td>Athletics</td></tr><tr data-skill-name="Bluff CHA" data-trained="false"><td>Bluff</td></tr></tbody></table>
  </div>`);
  await load(page,sheetUX,'enhanceAgentSheet');
  await page.evaluate(()=>{window.state={_skillSearch:'',_trainedOnly:false};window.root=document.querySelector('.agent');window.enhanceAgentSheet(window.root,{editMode:false},window.state);});
  await expect(page.locator('[name="system.abilities.str.base"]')).toBeHidden();
  await expect(page.locator('[name="system.abilities.str.base"]')).toBeDisabled();
  await expect(page.locator('[name="system.xp"]')).toBeDisabled();
  await expect(page.locator('[name="system.vitality.value"]')).toBeEnabled();
  const action=page.getByRole('button',{name:'Fortitude'});
  await action.focus();await expect(action).toBeFocused();
  await page.locator('.skill-search').fill('CHA');
  await expect(page.locator('[data-skill-name="Athletics STR/CON"]')).toBeHidden();
  await expect(page.locator('.skill-count')).toHaveText('1 of 2 skills');
  await page.locator('.skill-search').fill('');await page.locator('.trained-filter').check();
  await expect(page.locator('[data-skill-name="Bluff CHA"]')).toBeHidden();
  await page.evaluate(()=>window.enhanceAgentSheet(window.root,{editMode:true},window.state));
  await expect(page.locator('[name="system.abilities.str.base"]')).toBeVisible();
  await expect(page.locator('[name="system.abilities.str.base"]')).toBeEnabled();
  await expect(page.locator('[name="granted"]')).toBeDisabled();
  await expect(page.locator('.trained-filter')).toBeChecked();
});

test('named check changes show relevant circumstances, omit stale inputs and update the roll button',async({page})=>{
  await page.setContent(`<form><div class="spycraft2-roll-options">
    <select name="check"><option value="balance">Balance Check (DEX, Active, error 1–1)</option><option value="tumble">Tumble Check (DEX, Active, error 1–1)</option><option value="repair">Repair Check (INT, Active, error 1–1)</option></select>
    <select name="ability"><option value="dex">DEX</option><option value="int">INT</option></select>
    <details><summary>Balance</summary><input name="balanceCircumstances" type="checkbox" /><input name="balanceSurface" value="slippery" /></details>
    <details><summary>Tumble</summary><input name="tumbleCircumstances" type="checkbox" /></details>
    <details><summary>Gear</summary><select name="gearStatus"><option value="unknown">Choose gear</option></select></details>
    <details><summary>Timing</summary><select name="method"><option value="roll">Roll</option><option value="take10">Take 10</option></select></details>
    <input name="modifier" value="0" />
  </div><button type="button" data-action="ok">Confirm</button></form>`);
  await load(page,skillUX,'enhanceSkillDialog');
  await page.evaluate(()=>window.enhanceSkillDialog(null,{element:document.querySelector('form')},[{id:'balance',attributes:['dex'],tags:'Vision'},{id:'tumble',attributes:['dex'],tags:'Vision'},{id:'repair',attributes:['int'],tags:'Gear'}]));
  await expect(page.locator('.sc2-check-context summary')).toHaveText('Balance');
  await expect(page.getByRole('button')).toHaveText('Roll Balance Check');
  await page.locator('details.sc2-check-context').evaluate(el=>el.open=true);
  await page.locator('[name="balanceCircumstances"]').check();
  await page.locator('[name="check"]').selectOption('tumble');
  await expect(page.locator('[name="balanceCircumstances"]')).toBeDisabled();
  await expect(page.locator('.sc2-check-context summary')).toHaveText('Tumble');
  const data=await page.locator('form').evaluate(form=>Object.fromEntries(new FormData(form)));
  expect(data).not.toHaveProperty('balanceCircumstances');expect(data).not.toHaveProperty('balanceSurface');
  await page.locator('[name="check"]').selectOption('repair');
  await expect(page.locator('[name="ability"]')).toHaveValue('int');
  await expect(page.locator('.sc2-check-context summary')).toHaveText('Gear');
  await page.locator('.sc2-advanced-options').evaluate(el=>el.open=true);
  await page.locator('[name="method"]').selectOption('take10');
  await expect(page.getByRole('button')).toHaveText('Take 10: Repair Check');
});
