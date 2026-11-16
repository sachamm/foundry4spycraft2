/** Ghost Mastery/Supremacy p.195; current opponent-specific invisibility, p.342.
 * A read-only circumstance plan, not a hidden-state/round/attack lifecycle controller.
 */
export function ghostCoverPlan(system,{declared=false,actorUuid='',actorName='',opponentActorUuid='',opponentName='',hiddenFromOpponent=false,sceneryCover=0,visibleMaterialPercent=0,disturbingMovementFeet=0,confirmed=false}={}){
 if(declared===false)return null;
 if(declared!==true||confirmed!==true)throw new Error('Confirm the Ghost character’s current hidden state, scenery cover and uninterrupted invisibility circumstances with the GC.');
 const uuid=v=>typeof v==='string'&&/^Actor\.[A-Za-z0-9_-]+$/.test(v),name=v=>typeof v==='string'&&v.trim()&&v.trim().length<=200;
 if(!uuid(actorUuid)||!uuid(opponentActorUuid)||actorUuid===opponentActorUuid||!name(actorName)||!name(opponentName))throw new Error('Choose distinct actual Ghost and opponent characters.');
 if(!system||typeof system!=='object'||Array.isArray(system)||!Array.isArray(system.activeFeatNames)||system.activeFeatNames.some(n=>typeof n!=='string'||!n.trim()))throw new Error('Review the Ghost character’s current qualified feat sources.');
 const sources=['Ghost Mastery','Ghost Supremacy'].filter(n=>system.activeFeatNames.includes(n));
 if(!sources.length)throw new Error('The selected character needs current qualified Ghost Mastery or Supremacy.');
 if(typeof hiddenFromOpponent!=='boolean')throw new Error('Declare whether the Ghost character is currently hidden from this opponent.');
 if(!Number.isSafeInteger(sceneryCover)||sceneryCover<0||sceneryCover>4)throw new Error('Choose the actual scenery cover grade from 0 to 4; personal cover does not count.');
 if(typeof visibleMaterialPercent!=='number'||!Number.isFinite(visibleMaterialPercent)||visibleMaterialPercent<0||visibleMaterialPercent>100||typeof disturbingMovementFeet!=='number'||!Number.isFinite(disturbingMovementFeet)||disturbingMovementFeet<0)throw new Error('Enter actual visible-material coverage (0–100 percent) and nonnegative disturbing movement in feet.');
 const requiredSceneryCover=sources.includes('Ghost Supremacy')?2:3;
 const lostToMaterial=visibleMaterialPercent>=25,lostToDisturbance=disturbingMovementFeet>5;
 const invisible=hiddenFromOpponent&&sceneryCover>=requiredSceneryCover&&!lostToMaterial&&!lostToDisturbance;
 const context={declared:true,actorUuid,actorName:actorName.trim(),opponentActorUuid,opponentName:opponentName.trim(),hiddenFromOpponent,sceneryCover,visibleMaterialPercent,disturbingMovementFeet,confirmed:true};
 return {version:1,context,sources,requiredSceneryCover,lostToMaterial,lostToDisturbance,invisible,notes:[`Ghost cover against ${context.opponentName}: ${invisible?'invisible to this opponent':'not invisible from this declaration'}; requires current hidden state and ${requiredSceneryCover}/4 scenery cover (p.195).`,...(lostToMaterial?['Invisibility is lost at 25% visible-material coverage (p.342).']:[]),...(lostToDisturbance?['Invisibility is lost after more than 5 feet through a disturbing environment (p.342).']:[]),'This preview confirms current circumstances only. Reestablishing hidden/invisible state, end-of-round hiding and loss of hidden state after an attack require their separate adjudication.']};
}
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export function validateGhostCoverProof(system,proof,currentContext=proof?.context){
 if(proof===null||proof===undefined)return;
 if(proof.version!==1||!proof.context||proof.context.declared!==true||canonical(ghostCoverPlan(system,currentContext))!==canonical(proof))throw new Error('The Ghost cover source or confirmed circumstances changed. Open the preview again.');
}
