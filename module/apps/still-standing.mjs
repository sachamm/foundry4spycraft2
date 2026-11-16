import {stillStandingSource} from '../rules/still-standing.mjs';
export function stillStandingSaveContent(system,key){
 if(key!=='fort')return '';
 try{if(!stillStandingSource(system))return '';}catch(error){return `<p>${foundry.utils.escapeHTML(error.message)}</p>`;}
 return '<fieldset><legend>Still Standing</legend><p>Your earned Brawler Ploy grants+8 only to the Fortitude save to remain standing after being hit by an attack with the takedown quality.</p><label><input name="resistingTakedown" type="checkbox" /> This Fortitude save resists that attack’s takedown</label><label><input name="takedownAttackConfirmed" type="checkbox" /> The GC confirms this legal save follows an actual hit by an attack with the takedown quality</label><p>Other damage events or effects that resemble takedown do not establish this attack-specific purpose. Resolve the save DC and its outcome separately.</p></fieldset>';
}
