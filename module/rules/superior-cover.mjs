import {terrainCoverPlan,validateTerrainCoverProof} from './terrain-cover.mjs';
import {validOwnCountClock,ownCountDurationActive} from './own-count-duration.mjs';
import {coverPlan} from './cover.mjs';
const validId=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(s);
function terrainRecordCover(system,r){
 if(!r.terrainCover)return coverPlan({personalCover:r.personalCover,sceneryCover:r.sceneryCover});
 const p=r.terrainCover,c=p.context,active=(system.activeFeatNames??[]).filter(n=>!['Home Turf','Aquatic Training'].includes(n));
 if(c?.homeTurfCover===true)active.push('Home Turf');if(c?.partialSubmersionCover===true)active.push('Aquatic Training');
 validateTerrainCoverProof({...system,activeFeatNames:active},p);
 if(r.personalCover!==p.personalCover||r.sceneryCover!==p.sceneryCover||r.reflexBonus!==p.grade)throw new Error('The saved terrain cover grades changed.');
 const current=terrainCoverPlan(system,{...c,homeTurfCover:c.homeTurfCover&&system.activeFeatNames?.includes('Home Turf')===true,partialSubmersionCover:c.partialSubmersionCover&&system.activeFeatNames?.includes('Aquatic Training')===true});
 return coverPlan({personalCover:current?.personalCover??c.personalCover,sceneryCover:current?.sceneryCover??c.sceneryCover});
}
export function superiorCoverState(system){
 const r=system.superiorCover,c=system.superiorCoverCombatContext;
 if(!r)return {active:false,penalty:0,dr:0,needsReview:false};
 if(r.version!==1||!validId(r.id)||typeof r.coverLost!=='boolean'||!Number.isSafeInteger(r.startRound)||r.startRound<1||r.dueRound!==r.startRound+1||typeof r.combatId!=='string'||!r.combatId||typeof r.combatantId!=='string'||!r.combatantId)return {active:false,penalty:0,dr:0,needsReview:true,reason:'Review the saved Superior Cover declaration before attack or skill checks.'};
 let cover;try{cover=terrainRecordCover(system,r);}catch{return {active:false,penalty:0,dr:0,needsReview:true,reason:'Review the saved Superior Cover grades.'};}
 if(!r.terrainCover&&r.reflexBonus!==cover.reflexBonus||(!r.coverLost&&cover.reflexBonus===0))return {active:false,penalty:0,dr:0,needsReview:true,reason:'Review the saved Superior Cover Reflex bonus.'};
 const active=ownCountDurationActive(r,c);return {active,penalty:active?2:0,dr:active&&!r.coverLost?cover.reflexBonus:0,needsReview:false,coverLost:r.coverLost,dueRound:r.dueRound};
}
export function superiorCoverPlan(system,combat,{personalCover,sceneryCover,confirmed=false,note,homeTurfCover=false,homeTurfCoverSource='scenery',partialSubmersionCover=false,terrainCoverConfirmed=false}={}){
 if(!system.activeFeatNames?.includes('Superior Cover'))throw new Error('Superior Cover has not been earned.');
 if(!validOwnCountClock(combat)||combat.turn!==combat.ownTurnIndex)throw new Error('Declare Superior Cover during this character’s Initiative Count in a started combat.');
 const cover=coverPlan({personalCover,sceneryCover,defenderSystem:system,homeTurfCover,homeTurfCoverSource,partialSubmersionCover,terrainCoverConfirmed});if(!cover.reflexBonus)throw new Error('Superior Cover requires actual cover.');
 if(confirmed!==true||typeof note!=='string'||!note.trim()||note.length>300)throw new Error('Confirm the current cover, its source and the full-round attack/skill penalty.');
 if(superiorCoverState(system).needsReview)throw new Error('Review the existing Superior Cover declaration before replacing it.');
 return {version:1,combatId:combat.id,combatantId:combat.combatantId,startRound:combat.round,dueRound:combat.round+1,personalCover:cover.personalCover,sceneryCover:cover.sceneryCover,...(cover.terrainCover?{terrainCover:cover.terrainCover}:{}),reflexBonus:cover.reflexBonus,coverLost:false,note:note.trim()};
}
export function superiorCoverReviewPlan(system,{personalCover,sceneryCover,confirmed=false,note,homeTurfCover=false,homeTurfCoverSource='scenery',partialSubmersionCover=false,terrainCoverConfirmed=false}={}){
 const state=superiorCoverState(system);if(state.needsReview||!state.active)throw new Error('Superior Cover is not an active valid full-round declaration.');
 if(confirmed!==true||typeof note!=='string'||!note.trim()||note.length>300)throw new Error('Confirm the actual current cover and a source/review note.');
 const cover=coverPlan({personalCover,sceneryCover,defenderSystem:system,homeTurfCover,homeTurfCoverSource,partialSubmersionCover,terrainCoverConfirmed});if(state.coverLost&&cover.reflexBonus>0)throw new Error('Losing cover ended this DR benefit. A new declaration requires your Initiative Count.');
 const {terrainCover:priorTerrainCover,...prior}=system.superiorCover;
 return {...prior,personalCover:cover.personalCover,sceneryCover:cover.sceneryCover,...(cover.terrainCover?{terrainCover:cover.terrainCover}:{}),reflexBonus:cover.reflexBonus,coverLost:state.coverLost||cover.reflexBonus===0,note:note.trim()};
}
