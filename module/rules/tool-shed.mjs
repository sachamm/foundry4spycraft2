const epoch=system=>String(system.usagePeriods?.mission??'initial');
export function toolShedSource(system){
 const feats=(system.activeFeatSelections??[]).filter(f=>f.name==='Tool Shed'&&f.tree==='gear');
 return system.activeFeatNames?.includes('Home Sweet Home')&&feats.length?{limit:feats.length,epoch:epoch(system)}:null;
}
export function toolShedFingerprint(gear){return JSON.stringify({kitType:gear.kitType,kitGrade:gear.kitGrade,kitSize:gear.kitSize,kitNonPortable:gear.kitNonPortable,kitLocation:gear.kitNonPortable?gear.kitLocation:'',weight:gear.weight,caliber:gear.caliber,quantity:gear.quantity,gearCategory:gear.gearCategory});}
export function toolShedKitState(system,item){
 const s=item?.system,ref=s?.classGearGrant;if(ref?.source!=='toolShed')return {applicable:false,valid:false,expired:false};
 const r=system.classGearGrants?.[ref.id],valid=!!r&&r.source==='toolShed'&&r.itemId===item.id&&r.epoch===ref.epoch&&item.type==='gear'&&s.kitGrade===3&&s.caliber===3&&s.quantity===1&&!s.common&&!s.pick&&!s.possessionSource&&!s.reserve&&!s.reserveAcquisition&&r.fingerprint===toolShedFingerprint(s),expired=valid&&ref.epoch!==epoch(system);
 return {applicable:true,valid,expired,blockedReason:!valid?'Review the selected Tool Shed kit’s grant and unchanged specifications.':expired?'This Tool Shed kit was lost at the end of its mission; choose available gear.':'',evidence:valid?{id:ref.id,epoch:ref.epoch,itemId:item.id,fingerprint:r.fingerprint}:null};
}
export function toolShedPlan(system,kit,{atHome=false,hourCompletedConfirmed=false,home='',id='',at=0}={}){
 const source=toolShedSource(system);if(!source)throw new Error('An active Tool Shed selection and Home Sweet Home are required.');
 if(atHome!==true||hourCompletedConfirmed!==true)throw new Error('Complete one full hour as an action inside your home before claiming this kit.');
 if(typeof home!=='string'||!home.trim()||home.length>200)throw new Error('Record the home where this kit was found.');
 if(!/^[A-Za-z0-9_-]+$/.test(id)||system.classGearGrants?.[id])throw new Error('A unique Tool Shed grant identifier is required.');
 if(kit?.type!=='gear'||kit.system?.kitGrade!==3||!kit.system.kitType||!Number.isFinite(kit.system.weight)||kit.system.weight<0)throw new Error('Choose a source-listed Grade III kit.');
 const data=kit.toObject?.()??structuredClone(kit);delete data._id;delete data.id;delete data.uuid;
 Object.assign(data.system,{quantity:1,bundleSize:1,pickCount:1,common:false,caliber:3,pick:'',possessionSource:'',possessionApproved:false,reserve:false,reserveAcquisition:null,armorMissionGrant:null,bigStickMissionPick:null,missionCaliberGrant:null,carried:false,equipped:false,kitLocation:data.system.kitNonPortable?home.trim():'',classGearGrant:{id,epoch:source.epoch,source:'toolShed'}});
 return {source,data,record:{epoch:source.epoch,source:'toolShed',name:data.name,home:home.trim(),hourCompletedConfirmed:true,at,fingerprint:toolShedFingerprint(data.system)}};
}
