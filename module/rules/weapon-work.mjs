/** Weapon Focus p.176 changes the DC, not the check result or its cap. */
const norm=v=>String(v??'').trim().toLowerCase();
export function weaponFocusWorkPlan(system,cfg,key,check,{weaponWork=false,weaponWorkProficiency='',weaponWorkDC=null,weaponWorkName='',weaponWorkConfirmed=false,weaponWorkItem=null}={}){
 const inactive={applicable:false,blockedReason:'',notes:''};if(weaponWork===false)return inactive;
 if(weaponWork!==true)return {...inactive,blockedReason:'Declare whether Weapon Focus applies to weapon work.'};
 if(!['electronics','mechanics'].includes(key)||!['build','modify','repair'].includes(check?.id))return {...inactive,blockedReason:'Weapon Focus reduces only weapon Build, Modify and Repair DCs.'};
 const selected=weaponWorkItem?.type==='weapon'?weaponWorkItem.system?.proficiency:weaponWorkProficiency,name=weaponWorkItem?.type==='weapon'?weaponWorkItem.name:weaponWorkName;
 if(weaponWorkItem&&weaponWorkItem.type!=='weapon'||typeof selected!=='string'||!Object.hasOwn(cfg.proficiencies,selected)||selected==='unarmed'||typeof name!=='string'||!name.trim()||name.length>200||weaponWorkConfirmed!==true)return {...inactive,blockedReason:'Confirm the actual target weapon/model and its covered proficiency.'};
 const choices=new Set((system.activeFeatSelections??[]).filter(f=>f.name==='Weapon Focus').map(f=>Object.keys(cfg.proficiencies).find(k=>norm(k)===norm(f.choice)||norm(cfg.proficiencies[k].label)===norm(f.choice))).filter(k=>k&&k!=='unarmed'));
 if(!choices.has(selected))return {...inactive,blockedReason:'An active Weapon Focus for the target weapon proficiency is required; an ordinary forte does not grant this DC reduction.'};
 const baseDC=typeof weaponWorkDC==='string'&&weaponWorkDC.trim()?Number(weaponWorkDC):weaponWorkDC;if(!Number.isSafeInteger(baseDC)||baseDC<0)return {...inactive,blockedReason:'Enter the GC-confirmed nonnegative whole DC before Weapon Focus.'};
 const effectiveDC=Math.min(baseDC,Math.max(5,baseDC-10));return {applicable:true,blockedReason:'',source:'Weapon Focus',proficiency:selected,targetName:name.trim(),targetUuid:weaponWorkItem?.uuid??'',baseDC,effectiveDC,reduction:baseDC-effectiveDC,minimum:5,notes:`Weapon Focus (${name.trim()}): DC ${baseDC} → ${effectiveDC}, reduction ${baseDC-effectiveDC}; minimum 5 without raising an already lower DC. No bonus is added to the check result (p.176).`};
}
