import {installPowerStanceInitiativeHooks} from './module/apps/power-stance.mjs';
import {installCombatStanceHooks} from './module/apps/combat-stance.mjs';
import {installShakenInitiativeHooks,shakenCombatantClass} from './module/apps/shaken-initiative.mjs';
import {hasStrut} from './module/rules/strut.mjs';
import {unnervingEligible} from './module/rules/unnerving.mjs';
import {automaticSkillSuccessSources,manualAdjustmentSource,cunningPlanCheck} from './module/rules/class-checks.mjs';
import {startUsagePeriod,refreshUsagePeriodActors,getUsagePeriodReview,reviewUsagePeriod} from './module/rules/periods.mjs';
import {nativeResourceLocks,periodResourceActors} from "./module/rules/transactions.mjs";
import {manageGCDice,gcDiceStatus,initializeGCDice,adjustGCDice,reviewGCDiceSettlement,recordGCHint} from "./module/rules/gc-dice.mjs";
import {rerollEligibility} from "./module/rules/limited-uses.mjs";
import {checkCandidates} from "./module/rules/outcomes.mjs";
import { SPYCRAFT } from "./module/config.mjs";
import {registerGCSettings,getMission,missionThreatLevel,isDramaticScene,qualitiesInForce,currentCampaignEffects,missionXP} from "./module/apps/gc/state.mjs";
import {openGCConsole} from "./module/apps/gc/console.mjs";
import {installFluidInitiativeHooks,fluidCombatClass,fluidEventDialog,recordFluidEvent,rollGroupInitiative,surpriseRoundDialog} from "./module/apps/gc/combat.mjs";
import {spendGCDice,setDramaticScene,doubleOpponentInitiative} from "./module/apps/gc/spend.mjs";
import {startConflictDialog,advanceConflict,manageConflict} from "./module/apps/gc/conflicts.mjs";
import {rollNpcSkill,npcDamageSave,resetDamageTrack,manageDisposition} from "./module/apps/gc/npc-play.mjs";
import * as gcMission from "./module/apps/gc/mission.mjs";
import * as gcTables from "./module/apps/gc/tables.mjs";
import * as dataModels from "./module/data/_module.mjs";
import { SpycraftActor } from "./module/documents/actor.mjs";
import { SpycraftItem } from "./module/documents/item.mjs";
import { SpycraftAgentSheet, SpycraftNpcSheet } from "./module/sheets/actor-sheet.mjs";
import { SpycraftItemSheet } from "./module/sheets/item-sheet.mjs";
import { SpycraftBrowser } from "./module/apps/browser.mjs";
import { evaluate, renderTemplate } from "./module/rules/formula.mjs";
import { checkPrerequisites, describe } from "./module/rules/prerequisites.mjs";

Hooks.once("init", () => {
  console.log("Spycraft 2.0 | Initializing system");
  CONFIG.SPYCRAFT = SPYCRAFT;
  CONFIG.time.roundTime=6;CONFIG.time.turnTime=0;
  CONFIG.statusEffects??=[];
  for(const [id,name]of [['shaken-1','Shaken I'],['shaken-2','Shaken II'],['shaken-3','Shaken III'],['shaken-4','Shaken IV'],['sleep','Sleeping'],['drunk','Drunk'],['crouched','Crouched'],['mute','Mute'],['held','Held'],['pinned','Pinned'],['baffled','Baffled'],['incompetent','Incompetent'],['prone','Prone'],['sprawled','Sprawled'],['blind','Blinded'],['deaf','Deafened'],['entangled','Entangled'],['nauseated','Nauseated'],['sickened','Sickened'],['fatigued','Fatigued'],['exhausted','Exhausted'],['unconscious','Unconscious'],['flat-footed','Flat-footed']])if(!CONFIG.statusEffects.some(effect=>effect.id===id))CONFIG.statusEffects.push({id,name,img:'icons/svg/downgrade.svg'});
  if(!CONFIG.statusEffects.some(effect=>effect.id==="reeling"))CONFIG.statusEffects.push({id:"reeling",name:"Reeling",img:"icons/svg/daze.svg"});
  if(!CONFIG.statusEffects.some(effect=>effect.id==="bound"))CONFIG.statusEffects.push({id:"bound",name:"SPYCRAFT.Condition.Bound",img:"icons/svg/net.svg"});
  game.settings.register("spycraft2","linguistics",{name:"Optional Linguistics checks",hint:"Enable the optional separate-language rule on p.124; the core game uses Cultures focuses.",scope:"world",config:true,type:Boolean,default:false});

  game.settings.register("spycraft2","usagePeriods",{scope:"world",config:false,type:Object,default:{},onChange:refreshUsagePeriodActors});
  game.settings.register("spycraft2","usagePeriodReview",{scope:"world",config:false,type:Object,default:{},onChange:refreshUsagePeriodActors});
  game.settings.register("spycraft2","gcActionDice",{scope:"world",config:false,type:Object,default:{},onChange(){for(const actor of game.actors??[])actor.sheet?.render(false);}});
  registerGCSettings();
  CONFIG.Combat.documentClass=fluidCombatClass(CONFIG.Combat.documentClass);
  installFluidInitiativeHooks();
  CONFIG.Combatant.documentClass=shakenCombatantClass(CONFIG.Combatant.documentClass);
  installShakenInitiativeHooks();
  installCombatStanceHooks();
  installPowerStanceInitiativeHooks();
  CONFIG.Actor.documentClass = SpycraftActor;
  CONFIG.Item.documentClass = SpycraftItem;
  Object.assign(CONFIG.Actor.dataModels, dataModels.actor);
  Object.assign(CONFIG.Item.dataModels, dataModels.item);
  CONFIG.Actor.trackableAttributes = {
    agent: { bar: ["vitality", "wounds", "actionDice"], value: [] },
    npc: { bar: ["vitality", "wounds"], value: [] }
  };

  CONFIG.Combat.initiative = { formula: "1d20 + @initiative.total", decimals: 0 };

  game.spycraft2 = { gc:{open:openGCConsole,console:null,mission:{...gcMission,get:getMission,threatLevel:missionThreatLevel,xp:missionXP},spend:spendGCDice,setDramaticScene,isDramaticScene,doubleOpponentInitiative,fluidEvent:fluidEventDialog,recordFluidEvent,rollGroupInitiative,surpriseRound:surpriseRoundDialog,conflicts:{start:startConflictDialog,advance:advanceConflict,manage:manageConflict},npc:{rollSkill:rollNpcSkill,damageSave:npcDamageSave,resetDamage:resetDamageTrack,disposition:manageDisposition},campaign:{qualities:qualitiesInForce,effects:currentCampaignEffects},tables:gcTables}, resourceLocks:nativeResourceLocks, SpycraftBrowser, gcDice:{status:gcDiceStatus,initialize:initializeGCDice,adjust:adjustGCDice,manage:manageGCDice,review:reviewGCDiceSettlement,hint:recordGCHint}, resetUsagePeriod:startUsagePeriod, getUsagePeriodReview, reviewUsagePeriod, rules: { evaluate, renderTemplate, checkPrerequisites, describe } };

  const { Actors, Items } = foundry.documents.collections;
  Actors.registerSheet("spycraft2", SpycraftAgentSheet, { types: ["agent"], makeDefault: true, label: "SPYCRAFT.Sheet.Agent" });
  Actors.registerSheet("spycraft2", SpycraftNpcSheet, { types: ["npc"], makeDefault: true, label: "SPYCRAFT.Sheet.Npc" });
  Items.registerSheet("spycraft2", SpycraftItemSheet, { makeDefault: true, label: "SPYCRAFT.Sheet.Item" });

  Handlebars.registerHelper("signed", n => (Number(n) >= 0 ? `+${Number(n)}` : `${Number(n)}`));
  Handlebars.registerHelper("sc2eq", (a, b) => a == b); // eslint-disable-line eqeqeq
  Handlebars.registerHelper("sc2lt", (a, b) => Number(a) < Number(b));
  // Tooltip attributes for a breakdown: rows of [label, value]. Plain text plus an HTML version with one row per line.
  Handlebars.registerHelper("sc2tip", rows => {
    if (!Array.isArray(rows) || !rows.length) return "";
    const esc = Handlebars.escapeExpression;
    const lines = rows.map(([label, value]) => `${label} ${Number(value) >= 0 ? "+" : ""}${Number(value)}`);
    return new Handlebars.SafeString(`data-tooltip="${esc(lines.join(" · "))}" data-tooltip-html="${esc(lines.map(esc).join("<br>"))}"`);
  });

  foundry.applications.handlebars.loadTemplates([
    "systems/spycraft2/templates/item/parts/bonuses.hbs",
    "systems/spycraft2/templates/actor/npc-builder.hbs",
    "systems/spycraft2/templates/apps/gc-console.hbs"
  ]);
});


Hooks.on("renderChatMessageHTML",(message,html)=>{
 const check=message.flags?.spycraft2;
 if(!check?.actorUuid||!Number.isFinite(check.rawTotal)||!(message.isAuthor||game.user.isGM)||message.blind&&!game.user.isGM)return;
 const actor=fromUuidSync(check.actorUuid);if(!actor?.isOwner)return;
 if(check.resolved){
  if(check.restraintEscape?.sourceSnapshot){
   const receipt=actor.flags?.spycraft2?.restraintReleases?.[message.id],review=actor.system.restraintReleaseReview,controls=document.createElement('div');controls.className='spycraft2 roll-controls';
   const add=(label,work)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',async()=>{button.disabled=true;try{await work();}finally{button.disabled=false;}});controls.append(button);};
   if(review?.needsReview&&review.id===message.id){if(game.user.isGM)add('GC review grapple release',()=>actor.reviewRestraintRelease());}
   else if(receipt?.movement?.state==='required')add('Confirm actual escape movement',()=>actor.confirmRestraintEscapeMove(message));
   else if(!receipt&&check.successConfirmed===true&&!check.superseded&&!check.criticalFailure)add('Apply grapple escape benefit',()=>actor.applyRestraintEscape(message));
   if(controls.childElementCount)html.querySelector('.message-content')?.append(controls);return;
  }
  const receipt=check.gearAttempt?.settlement,attempt=actor.system.missionReserves?.attempts?.[check.gearAttempt?.id];
  if(!receipt||check.superseded||attempt?.settlementId===receipt.id)return;
  const controls=document.createElement('div'),complete=document.createElement('button');controls.className='spycraft2 roll-controls';complete.type='button';complete.textContent='Complete acquisition record';
  complete.addEventListener('click',async()=>{complete.disabled=true;try{await actor.finishCheck(message);}finally{complete.disabled=false;}});controls.append(complete);html.querySelector('.message-content')?.append(controls);return;
 }
 const controls=document.createElement("div");controls.className="spycraft2 roll-controls";
 const boost=document.createElement("button");boost.type="button";boost.textContent="Boost before outcome";
 boost.addEventListener("click",async()=>{boost.disabled=true;try{await actor.boostCheck(message);}finally{boost.disabled=false;}});
 const requiredBonus=document.createElement("button");requiredBonus.type="button";requiredBonus.textContent="Spend required class bonus die";
 requiredBonus.addEventListener("click",async()=>{requiredBonus.disabled=true;try{await actor.boostCheck(message,{bonusPoolId:check.requiredBonusPoolId,count:1,askOptions:true});}finally{requiredBonus.disabled=false;}});
 const generous=document.createElement("button");generous.type="button";generous.textContent="Generous teammate die";
 generous.addEventListener("click",async()=>{generous.disabled=true;try{await actor.boostWithGenerous(message);}finally{generous.disabled=false;}});
 const finish=document.createElement("button");finish.type="button";finish.textContent="Outcome resolved";
 finish.addEventListener("click",async()=>{finish.disabled=true;try{await actor.finishCheck(message);}finally{finish.disabled=false;}});
 const reroll=document.createElement("button");reroll.type="button";reroll.textContent="Reroll with ability";
 reroll.addEventListener("click",async()=>{reroll.disabled=true;try{await actor.rerollCheck(message);}finally{reroll.disabled=false;}});
 const confirm=document.createElement("button");confirm.type="button";confirm.textContent="Confirm result";
 confirm.addEventListener("click",async()=>{confirm.disabled=true;try{await actor.confirmCheckOutcome(message);}finally{confirm.disabled=false;}});
 const critical=document.createElement("button");critical.type="button";critical.textContent="Activate critical";
 critical.addEventListener("click",async()=>{critical.disabled=true;try{await actor.activateCritical(message);}finally{critical.disabled=false;}});
 const candidates=checkCandidates(check),adjustment=check.checkKind==='skill'&&manualAdjustmentSource(actor.system)?.skills.includes(check.skillKey);
 let cunningAvailable=false;try{cunningPlanCheck(actor.system,check);cunningAvailable=actor.limitedUseStatus.some(s=>s.id==='cunningPlan'&&s.remaining>0);}catch(error){}
 const cunning=document.createElement('button');cunning.type='button';cunning.textContent='Cunning Plan';cunning.addEventListener('click',async()=>{cunning.disabled=true;try{await actor.useCunningPlan(message);}finally{cunning.disabled=false;}});
 const manual=document.createElement('button');manual.type='button';manual.textContent='Manual Adjustment';
 manual.addEventListener('click',async()=>{manual.disabled=true;try{await actor.useManualAdjustment(message);}finally{manual.disabled=false;}});
 controls.append(...(cunningAvailable?[cunning]:[]),...(adjustment&&check.successConfirmed===false&&!check.criticalFailure&&!check.manualAdjustment?[manual]:[]),...(check.requiredBonusPoolId&&!check.requiredBonusSpent&&!check.criticalFailure?[requiredBonus]:[]),...((check.threatConfirmed||check.errorConfirmed)&&!check.criticalSuccess&&!check.criticalFailure?[critical]:[]),...(check.actionDiceAllowed!==false?[boost,...(!check.generousBoost?[generous]:[])]:[]),...(check.checkMethod==="roll"&&actor.limitedUseStatus?.some(spec=>spec.remaining&&rerollEligibility(spec,check,{failed:true,criticalFailure:!!check.criticalFailure}))?[reroll]:[]),...(candidates.error||candidates.threat||candidates.triumph||automaticSkillSuccessSources(actor.system,check).length>0||adjustment?[confirm]:[]),finish);html.append(controls);
});


// Recompute round-based bonuses and counters when combat progresses or ends.
function refreshCombatActorData(){for(const actor of periodResourceActors())if(actor.type==="agent"){actor.reset();actor.sheet?.render(false);}}
Hooks.once("ready",refreshCombatActorData);
Hooks.on("updateWorldTime",refreshCombatActorData);
Hooks.on("updateCombat",(_combat,changed)=>{if(Object.hasOwn(changed,"round")||Object.hasOwn(changed,"active")||Object.hasOwn(changed,"turn"))refreshCombatActorData();});
Hooks.on("deleteCombat",refreshCombatActorData);
// Preserve the character's completed-round clock before leaving a tracked combat.
function detachMentalLeapClocks(combat){
 for(const actor of periodResourceActors()){
  if(actor.type!=="agent"||!(actor.system.mentalLeaps??[]).some(r=>r.combatId===combat.id&&!r.detached))continue;
  const primary=game.users.activeGM??game.users.filter(u=>u.active&&actor.testUserPermission(u,'OWNER')).sort((a,b)=>a.id.localeCompare(b.id))[0];
  if(primary?.id!==game.user.id||!actor.isOwner)continue;
  actor.detachMentalLeapCombat(combat).catch(error=>ui.notifications.warn(`Mental Leap clock needs review: ${error.message}`));
 }
}
Hooks.on('deleteCombat',detachMentalLeapClocks);
Hooks.on('updateCombat',(combat,changed)=>{if((Object.hasOwn(changed,'active')||Object.hasOwn(changed,'round'))&&!combat.started)detachMentalLeapClocks(combat);});


Hooks.on("updateCombatant",(_combatant,changed)=>{if(["initiative","actorId","tokenId","sceneId","group"].some(key=>Object.hasOwn(changed,key)))refreshCombatActorData();});
Hooks.on("createCombatant",refreshCombatActorData);
Hooks.on("deleteCombatant",refreshCombatActorData);

// Team references read actual class levels, so a source's advancement/removal refreshes its recipients.
function refreshFortuneRecipients(source){for(const actor of game.actors??[])if(actor.type==='agent'&&actor.system.fortuneTeammateIds?.includes(source.id)){actor.reset();actor.sheet?.render(false);}}
Hooks.on('updateActor',(actor,changed)=>{if(changed.system?.progression||Object.hasOwn(changed,'system.progression'))refreshFortuneRecipients(actor);});
Hooks.on('deleteActor',refreshFortuneRecipients);
for(const event of ['createItem','updateItem','deleteItem'])Hooks.on(event,item=>{if(item.type==='class'&&item.parent?.documentName==='Actor')refreshFortuneRecipients(item.parent);});

// A damaging attack's added stress may be recorded after its ordinary outcome is resolved.
Hooks.on('renderChatMessageHTML',(message,html)=>{
 const check=message.flags?.spycraft2;if(!check?.actorUuid||!(message.isAuthor||game.user.isGM)||message.blind&&!game.user.isGM)return;
 const actor=fromUuidSync(check.actorUuid);if(!actor?.isOwner||!unnervingEligible(actor.system,check))return;
 const button=document.createElement('button');button.type='button';button.textContent='Resolve Unnerving stress';
 button.addEventListener('click',async()=>{button.disabled=true;try{await actor.resolveUnnerving(message);}finally{button.disabled=false;}});
 html.append(button);
});

// Strut can follow a resolved attack, so it has a separate receipt control.
Hooks.on('renderChatMessageHTML',(message,html)=>{
 const check=message.flags?.spycraft2;if(!check?.actorUuid||message.blind&&!game.user.isGM)return;
 const actor=fromUuidSync(check.actorUuid);if(!actor?.isOwner||!hasStrut(actor.system)||check.checkKind!=='attack'||check.superseded||check.strutPoolId||!(check.threatConfirmed||check.criticalSuccess))return;
 if(!(check.unarmed||check.weaponProficiency==='unarmed'||check.attackContext?.ranged===false)||!check.rollCombat?.id)return;
 const button=document.createElement('button');button.type='button';button.textContent='Strut: posture next half action';button.addEventListener('click',async()=>{button.disabled=true;try{await actor.useStrut(message);}finally{button.disabled=false;}});html.append(button);
});


// Game Control console: a button at the top of the Actors sidebar for the GC, plus game.spycraft2.gc.open().
Hooks.on("renderActorDirectory",(app,html)=>{
 if(!game.user.isGM)return;
 const root=html instanceof HTMLElement?html:html?.[0];if(!root||root.querySelector(".spycraft2-gc-console-button"))return;
 const button=document.createElement("button");button.type="button";button.className="spycraft2-gc-console-button";button.innerHTML='<i class="fa-solid fa-user-secret"></i> GC Console';
 button.addEventListener("click",()=>openGCConsole());
 (root.querySelector(".header-actions")??root.querySelector(".directory-header")??root).append(button);
});
// A mission's Threat Level and campaign qualities affect derived numbers; refresh sheets when a scene or session starts.
Hooks.on("updateSetting",setting=>{if(setting.key==="spycraft2.usagePeriods")game.spycraft2?.gc?.console?.render(false);});
