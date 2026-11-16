import {terrainCoverContent} from './terrain-cover.mjs';
import {superiorCoverPlan,superiorCoverReviewPlan} from '../rules/superior-cover.mjs';
import {COVER_GRADES} from '../rules/cover.mjs';
import {expertiseCombatContext} from './combat-expertise.mjs';
import {attributeActionBlock} from '../rules/attributes.mjs';
import {restraintActionBlock} from '../rules/restraints.mjs';
import {queueResources} from '../rules/transactions.mjs';
const stable=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const same=(a,b)=>stable(a)===stable(b),snapshot=a=>JSON.stringify({combat:expertiseCombatContext(a),record:a.system.superiorCover??null,feats:(a.system.activeFeatNames??[]).filter(n=>['Superior Cover','Home Turf','Aquatic Training'].includes(n)).sort()});
async function inputFor(actor,review){const esc=foundry.utils.escapeHTML,options=n=>COVER_GRADES.map((label,i)=>`<option value="${i}"${i===n?' selected':''}>${esc(label)}</option>`).join(''),r=actor.system.superiorCover,grades=r?.terrainCover?.context??r;
 return foundry.applications.api.DialogV2.input({window:{title:review?'Review Superior Cover':'Declare Superior Cover'},rejectClose:false,content:`<div class="spycraft2-roll-options"><p>${review?'Confirm changed cover. No cover ends the DR benefit immediately; regaining cover cannot restore that declaration.':'During your Initiative Count, accept −2 to all attack and skill checks for one full round. DR equals the ordinary cover Reflex bonus while that cover remains.'} The penalty lasts until the start of your next Initiative Count, even if cover is lost. The GC confirms geometry; this control does not detect movement or line of sight.</p><label>Best personal cover <select name="personalCover">${options(review?grades?.personalCover??0:0)}</select></label><label>Best scenery cover <select name="sceneryCover">${options(review?grades?.sceneryCover??0:0)}</select></label>${terrainCoverContent(actor.system,review?r?.terrainCover?.context??{}:{})}<label>Actual cover/source note <input name="note" maxlength="300" required /></label><label><input name="confirmed" type="checkbox" /> The GC confirms the actual current cover${review?'':' and I accept the full-round penalty'}</label></div>`});}
async function save(actor,patch,proof){if(actor.system.superiorCover?.terrainCover&&!patch['system.superiorCover']?.terrainCover)patch={...patch,'system.superiorCover.-=terrainCover':null};try{await actor.update(patch);}catch(error){if(!proof())throw error;}if(!proof())throw new Error('Review the Superior Cover transaction before retrying.');}
export async function declareSuperiorCover(actor,options={}){
 if(actor.type!=='agent'||actor.isOwner!==true)return null;const expected=snapshot(actor),input=Object.keys(options).length?options:await inputFor(actor,false);if(!input||input.confirmed!==true)return null;
 return queueResources([actor],async()=>{
  if(!actor.isOwner||snapshot(actor)!==expected)throw new Error('The Superior Cover source or Initiative Count changed. Open the declaration again.');
  const combat=expertiseCombatContext(actor),block=restraintActionBlock(actor.system,{free:true})||attributeActionBlock(actor.system,{kind:'attack'});if(block||actor.system.conditionContext?.sleeping||actor.system.wounds?.value<0||actor.system.mentalLeapState?.unconscious)throw new Error(block||'This character cannot declare Superior Cover.');
  const refresh=actor.system.refreshAction;if(refresh?.state==='waiting'&&refresh.combatId===combat?.id&&refresh.startRound===combat?.round)throw new Error('Refresh forfeited this round’s chance to act.');
  const record={...superiorCoverPlan(actor.system,combat,{...input,personalCover:Number(input.personalCover),sceneryCover:Number(input.sceneryCover)}),id:foundry.utils.randomID(),at:game.time.worldTime,by:game.user.id};
  await save(actor,{'system.superiorCover':record,['flags.spycraft2.superiorCoverDeclarations.'+record.id]:record},()=>same(actor.system.superiorCover,record)&&same(actor.flags?.spycraft2?.superiorCoverDeclarations?.[record.id],record));return record;
 });
}
export async function reviewSuperiorCover(actor,options={}){
 if(actor.type!=='agent'||actor.isOwner!==true)return null;const expected=snapshot(actor),input=Object.keys(options).length?options:await inputFor(actor,true);if(!input||input.confirmed!==true)return null;
 return queueResources([actor],async()=>{
  if(!actor.isOwner||snapshot(actor)!==expected)throw new Error('The Superior Cover source or Initiative Count changed. Open the review again.');
  const combat=expertiseCombatContext(actor),record=superiorCoverReviewPlan({...actor.system,superiorCoverCombatContext:combat},{...input,personalCover:Number(input.personalCover),sceneryCover:Number(input.sceneryCover)}),id=foundry.utils.randomID(),audit={id,declarationId:record.id,before:structuredClone(actor.system.superiorCover),after:record,at:game.time.worldTime,by:game.user.id};
  await save(actor,{'system.superiorCover':record,['flags.spycraft2.superiorCoverReviews.'+id]:audit},()=>same(actor.system.superiorCover,record)&&same(actor.flags?.spycraft2?.superiorCoverReviews?.[id],audit));return audit;
 });
}
