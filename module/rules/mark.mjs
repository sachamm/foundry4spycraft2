import {attributeActionBlock} from './attributes.mjs';
import {restraintActionBlock} from './restraints.mjs';
import {validOwnCountClock} from './own-count-duration.mjs';
const text=(s,max=200)=>typeof s==='string'&&!!s.trim()&&s.length<=max;
export function markSource(system){const limit=system.activeFeatSelections?.filter(f=>f.tree==='style').length??0;return system.activeFeatNames?.includes('Mark')&&limit>0?{limit,session:String(system.usagePeriods?.session??'initial')}:null;}
export function markPlan(system,cfg,combat,{target='',skills=[],lineOfSightConfirmed=false,freeActionConfirmed=false}={}){
 const source=markSource(system);if(!source)throw new Error('An earned Mark feat and active Style selections are required.');
 const blocked=restraintActionBlock(system,{free:true})||attributeActionBlock(system,{kind:'mentalAbility'});if(blocked)throw new Error(blocked);
 if(system.conditionContext?.blinded)throw new Error('Mark requires line of sight to the target.');
 if(combat?.started&&(!validOwnCountClock(combat)||combat.turn!==combat.ownTurnIndex))throw new Error('Take Mark’s free action during this character’s Initiative Count.');
 if(combat?.started&&system.refreshAction?.state==='waiting'&&system.refreshAction.combatId===combat.id&&system.refreshAction.startRound===combat.round)throw new Error('Refresh forfeited this round’s chance to act.');
 if(!text(target)||lineOfSightConfirmed!==true||freeActionConfirmed!==true)throw new Error('Name one character and confirm current line of sight and a legal free action.');
 if(!Array.isArray(skills)||skills.length!==3||new Set(skills).size!==3||skills.some(k=>!Object.hasOwn(cfg.skills,k)))throw new Error('Name exactly three different skills.');
 return {version:1,source:'Mark',target:target.trim(),skills:[...skills],lineOfSightConfirmed:true,freeActionConfirmed:true,session:source.session,limitAtUse:source.limit,combat:combat?.started?{id:combat.id,combatantId:combat.combatantId,round:combat.round,turn:combat.turn}:null};
}
export function markRecordValid(r,cfg){return !!r&&r.version===1&&r.source==='Mark'&&/^mark_[A-Za-z0-9_-]+$/.test(r.id)&&text(r.target)&&Array.isArray(r.skills)&&r.skills.length===3&&new Set(r.skills).size===3&&r.skills.every(k=>Object.hasOwn(cfg.skills,k))&&r.lineOfSightConfirmed===true&&r.freeActionConfirmed===true&&typeof r.session==='string'&&Number.isSafeInteger(r.limitAtUse)&&r.limitAtUse>0&&r.use?.epoch===r.session&&Number.isSafeInteger(r.use.used)&&r.use.used>=1&&r.use.used<=r.limitAtUse&&Number.isFinite(r.at);}
export function markDisclosurePlan(record,cfg,{bonuses={},contexts={},confirmed=false}={}){
 if(!markRecordValid(record,cfg)||record.disclosure)throw new Error('Choose a valid Mark observation awaiting its first GC disclosure.');
 if(confirmed!==true||!bonuses||typeof bonuses!=='object'||Array.isArray(bonuses)||Object.keys(bonuses).length!==3||record.skills.some(k=>!Object.hasOwn(bonuses,k)||!Number.isSafeInteger(bonuses[k])))throw new Error('The GC must confirm an actual whole-number total bonus for each of the three named skills.');
 if(!contexts||typeof contexts!=='object'||Array.isArray(contexts)||Object.keys(contexts).some(k=>!record.skills.includes(k))||Object.values(contexts).some(v=>typeof v!=='string'||v.length>500))throw new Error('Keep bonus context limited to the three named skills.');
 return {bonuses:Object.fromEntries(record.skills.map(k=>[k,bonuses[k]])),contexts:Object.fromEntries(record.skills.map(k=>[k,String(contexts[k]??'').trim()])),confirmed:true};
}
export function markRows(records,cfg){return Object.entries(records??{}).map(([id,r])=>{const valid=markRecordValid(r,cfg)&&r.id===id;let disclosed=false;if(valid&&r.disclosure){try{markDisclosurePlan({...r,disclosure:null},cfg,r.disclosure);disclosed=true;}catch{}}
 return {id,target:r?.target??'Unknown observation',valid,needsReview:!valid||!!r.disclosure&&!disclosed,pending:valid&&!r.disclosure,disclosed,skills:(Array.isArray(r?.skills)?r.skills:[]).filter(k=>Object.hasOwn(cfg.skills,k)).map(k=>({key:k,name:cfg.skills[k].name,bonus:disclosed?r.disclosure.bonuses[k]:null,context:disclosed?r.disclosure.contexts[k]:''}))};});}
