import {terrainCoverContent} from './terrain-cover.mjs';
import {COVER_GRADES} from '../rules/cover.mjs';
export function saveCoverContent(system={}){
 const esc=foundry.utils.escapeHTML;
 return `<fieldset><legend>Cover against this effect</legend><p>Choose the best personal source and best scenery source after any separately adjudicated grade changes. Cover grants a Reflex bonus only against an effect originating beyond it. An attacker's CQB Supremacy reduction does not reduce this save bonus.</p>${['personal','scenery'].map(kind=>`<label>${kind==='personal'?'Personal':'Scenery'} cover <select name="${kind}Cover">${COVER_GRADES.map((label,i)=>`<option value="${i}">${esc(label)}</option>`).join('')}</select></label>`).join('')}${terrainCoverContent(system)}<label><input name="effectBeyondCover" type="checkbox" /> This effect originates beyond the declared cover</label></fieldset>`;
}
