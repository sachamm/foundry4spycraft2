/** Drunk p.341; 1d8 Deviation Diagram p.346. Direction 1 uses the top of the scene. */
export const DEVIATION_DIRECTIONS=['N','NE','E','SE','S','SW','W','NW'];
const finite=n=>Number.isFinite(n)&&Math.abs(n)<=Number.MAX_SAFE_INTEGER;
function validRoll(json,die){try{const r=JSON.parse(json);const t=r.terms?.[0],active=t?.results?.filter(v=>v.active!==false&&!v.discarded);return r.formula==='1d8'&&r.total===die&&r.evaluated===true&&r.terms?.length===1&&t.number===1&&t.faces===8&&Array.isArray(t.modifiers)&&!t.modifiers.length&&active?.length===1&&active[0].result===die;}catch{return false;}}
export function drunkRepositionHistory(system){
 const rows=[],warnings=[],seen=new Set();
 for(const r of system.drunkRepositions??[]){
  const common=r&&typeof r.combatId==='string'&&r.combatId&&Number.isSafeInteger(r.round)&&r.round>=1&&r.id===r.combatId+':'+r.round&&!seen.has(r.id)&&finite(r.at)&&r.at<=system.worldTime&&r.roundStartConfirmed===true&&(r.needsReview===undefined||typeof r.needsReview==='boolean')&&typeof r.standing==='boolean'&&r.distanceFeet===5&&r.movementAllowanceCost===0;
  const status=common&&(r.state==='awaitingRoll'&&r.standing&&r.die===null||r.state==='skipped'&&!r.standing&&r.die===null||['pending','moving','applied'].includes(r.state)&&r.standing&&Number.isSafeInteger(r.die)&&r.die>=1&&r.die<=8&&r.direction===DEVIATION_DIRECTIONS[r.die-1]&&typeof r.rollJSON==='string'&&validRoll(r.rollJSON,r.die)&&(r.state!=='pending'||r.movementPlan===undefined)&&(r.state!=='moving'&&r.movementPlan===undefined||validMovementPlan(r,system.worldTime))&&(r.state!=='applied'||r.movementConfirmed===true&&finite(r.appliedAt)&&r.appliedAt>=r.at&&r.appliedAt<=system.worldTime));
  if(!status){warnings.push('Review malformed, duplicate or future Drunk reposition history.');continue;}
  seen.add(r.id);rows.push(r);if(r.state==='awaitingRoll'||r.needsReview===true)warnings.push('A Drunk reposition roll needs GC review; do not roll it again.');
 }
 return {rows,warnings};
}
export function drunkRepositionPlan(system,combat,{standing,roundStartConfirmed=false}={}){
 if(system.conditionContext?.drunk!==true||!combat?.started||typeof combat.id!=='string'||!combat.id||!Number.isSafeInteger(combat.round)||combat.round<1||!finite(system.worldTime))throw new Error('An active Drunk condition and a started participating combat round are required.');
 const history=drunkRepositionHistory(system);if(history.warnings.length)throw new Error(history.warnings.join(' '));
 const id=combat.id+':'+combat.round,existing=history.rows.find(r=>r.id===id);
 if(existing)return {reused:true,record:existing};
 if(typeof standing!=='boolean'||roundStartConfirmed!==true)throw new Error('The GC must confirm round start and whether the character was standing then.');
 return {reused:false,record:{id,combatId:combat.id,round:combat.round,at:system.worldTime,roundStartConfirmed:true,standing,state:standing?'awaitingRoll':'skipped',die:null,direction:null,distanceFeet:5,movementAllowanceCost:0,rollJSON:null,receiptUuid:null,movementConfirmed:false,appliedAt:null,needsReview:false}};
}
export function freezeDrunkReposition(record,{die,rollJSON}={}){
 if(record?.state!=='awaitingRoll'||record.standing!==true||!Number.isSafeInteger(die)||die<1||die>8||typeof rollJSON!=='string'||!validRoll(rollJSON,die))throw new Error('Freeze the original d8 result for the pending Drunk reposition.');
 return {...record,state:'pending',die,direction:DEVIATION_DIRECTIONS[die-1],rollJSON};
}
export function drunkRepositionCompletion(system,{id,movementConfirmed=false,interruptedMovementReviewed=false}={}){
 const history=drunkRepositionHistory(system);if(history.warnings.length)throw new Error(history.warnings.join(' '));
 const record=history.rows.find(r=>r.id===id);if(!record||!['pending','moving','applied'].includes(record.state))throw new Error('Choose a frozen pending Drunk reposition.');
 if(record.state==='applied')return {record,reused:true};
 if(record.state==='moving'&&interruptedMovementReviewed!==true)throw new Error('The GC must review the interrupted token movement before confirming its actual resolution.');
 if(movementConfirmed!==true)throw new Error('The GC must confirm the recorded five-foot reposition actually occurred, without reducing allowed movement.');
 return {record:{...record,state:'applied',movementConfirmed:true,appliedAt:system.worldTime,...(record.state==='moving'?{interruptedMovementReviewed:true}:{})},reused:false};
}

const directionOffsets=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
function movementFrame(token){return {sceneUuid:token.sceneUuid,grid:token.grid,sceneRect:token.sceneRect,width:token.width,height:token.height};}
function tokenDestination(token,die){
 const g=token.grid,rect=token.sceneRect,unit=String(g?.units??'').toLowerCase().replace(/[^a-z]/g,'');
 if(g?.type!==1||!['ft','feet','foot'].includes(unit)||!finite(g.size)||g.size<=0||!finite(g.distance)||g.distance<=0)throw new Error('Automatic reposition requires a square grid measured in feet. Use the GC-confirmed manual reposition for this scene.');
 if(![token.x,token.y,token.width,token.height,rect?.x,rect?.y,rect?.width,rect?.height].every(finite)||token.width<=0||token.height<=0||rect.width<=0||rect.height<=0)throw new Error('Review the token size, position and scene bounds.');
 const step=g.size*5/g.distance;if(!Number.isSafeInteger(step)||step<1)throw new Error('This grid cannot represent exactly five feet at whole-pixel positions. Use the manual reposition.');
 const [dx,dy]=directionOffsets[die-1]??[],to={x:token.x+dx*step,y:token.y+dy*step},fits=p=>p.x>=rect.x&&p.y>=rect.y&&p.x+token.width*g.size<=rect.x+rect.width&&p.y+token.height*g.size<=rect.y+rect.height;
 if(!fits(token)||!fits(to))throw new Error('The five-foot reposition crosses the scene boundary. The GC must resolve it manually.');
 return to;
}
function validMovementPlan(record,now){
 const p=record.movementPlan;if(!p||typeof p.tokenUuid!=='string'||!p.tokenUuid||typeof p.actorUuid!=='string'||!p.actorUuid||p.routeConfirmed!==true||!finite(p.reservedAt)||p.reservedAt<record.at||p.reservedAt>now)return false;
 try{const expected=tokenDestination({...p.frame,...p.from},record.die);return expected.x===p.to?.x&&expected.y===p.to?.y;}catch{return false;}
}
export function drunkTokenMovementPlan(system,combat,{id,token,routeConfirmed=false}={}){
 const history=drunkRepositionHistory(system);if(history.warnings.length)throw new Error(history.warnings.join(' '));
 const record=history.rows.find(r=>r.id===id);if(!record||!['pending','moving','applied'].includes(record.state))throw new Error('Choose a frozen Drunk reposition requiring actual movement.');
 if(record.state==='applied')return {record,reused:true,moveRequired:false};
 if(routeConfirmed!==true)throw new Error('The GC must confirm the forced movement path, obstacles and hazards before moving this token.');
 if(!token||token.isOwner!==true||token.actorUuid!==system.actorUuid||typeof token.uuid!=='string'||!token.uuid)throw new Error('Choose an owned token for this character.');
 const currentRound=system.conditionContext?.drunk===true&&combat?.started&&combat.id===record.combatId&&combat.round===record.round;
 if(record.state==='moving'){
  const p=record.movementPlan;if(token.uuid!==p.tokenUuid||token.actorUuid!==p.actorUuid)throw new Error('Resume the original token movement; a different token cannot inherit it.');
  if(token.x===p.to.x&&token.y===p.to.y)return {record,reused:false,moveRequired:false,movementPlan:p};
  if(token.x!==p.from.x||token.y!==p.from.y)throw new Error('The token moved to another position. Preserve it and ask the GC to review the pending reposition.');
  if(JSON.stringify(movementFrame(token))!==JSON.stringify(p.frame))throw new Error('The token size or scene grid changed. Review the original movement plan.');
  if(!currentRound)throw new Error('This pending move belongs to an earlier round. The GC must resolve it manually.');
  return {record,reused:false,moveRequired:true,movementPlan:p};
 }
 if(!currentRound)throw new Error('Automatic movement requires the current Drunk combat round. Confirm older actual movement manually.');
 const p={tokenUuid:token.uuid,actorUuid:token.actorUuid,from:{x:token.x,y:token.y},to:tokenDestination(token,record.die),frame:movementFrame(token),routeConfirmed:true,reservedAt:system.worldTime};
 return {record:{...record,state:'moving',movementPlan:p},reused:false,moveRequired:true,movementPlan:p};
}
