/** Jinx, p.190: the opponent paying to activate an error owns this limited discount. */
export function jinxSource(system){const limit=system.activeFeatSelections?.filter(f=>f.tree==='chance').length??0;return system.activeFeatNames?.includes('Jinx')===true&&limit>0?{limit,session:String(system.usagePeriods?.session??'initial')}:null;}
export function jinxUseSpec(system){const source=jinxSource(system);return source?{id:'jinx',name:'Jinx (opponent error activation discount)',period:'session',limit:source.limit,cost:0,workflow:'jinxCriticalFailure',manualReviewable:true,hidden:true}:null;}
/** Apply payer scope after the acting character's ordinary effect-cost modifiers; Shaken is quoted later. */
export function jinxCostPlan(payerSystem,critical,{jinx=false,payerUuid='',actingActorUuid=''}={}){
 if(typeof jinx!=='boolean')throw new Error('Select Jinx with an explicit boolean choice.');
 if(!jinx)return structuredClone(critical);
 const source=jinxSource(payerSystem);if(!source)throw new Error('The paying opponent must currently possess Jinx and active Chance feats.');
 if(!critical||critical.blocked!==false||critical.kind!=='failure'||!Number.isSafeInteger(critical.cost)||critical.cost<1)throw new Error('Jinx requires a valid opponent error activation with a positive cost before its discount.');
 if(typeof payerUuid!=='string'||!payerUuid.startsWith('Actor.')||typeof actingActorUuid!=='string'||!actingActorUuid.startsWith('Actor.')||payerUuid===actingActorUuid)throw new Error('Jinx belongs to a distinct paying character, not the acting character or the GC pool.');
 return {...structuredClone(critical),cost:critical.cost-1,sources:[...critical.sources,'Jinx –1 (minimum0)'],jinx:{version:1,payerUuid,actingActorUuid,session:source.session,limitAtUse:source.limit,costBefore:critical.cost,costAfter:critical.cost-1}};
}
/** Call only after reserving the one session use in the payer's existing resource transaction. */
export function jinxUseProof(system,context,expectedUse=null){
 if(!context||context.version!==1)throw new Error('A recorded Jinx activation is required.');
 const source=jinxSource(system),use=system.resourceUses?.jinx;
 if(!source||source.session!==context.session||source.limit!==context.limitAtUse||use?.epoch!==source.session||!Number.isSafeInteger(use.used)||use.used<1||use.used>source.limit||expectedUse&&JSON.stringify(expectedUse)!==JSON.stringify(use))throw new Error('The Jinx source, session or reserved use changed before activation.');
 return structuredClone(use);
}
