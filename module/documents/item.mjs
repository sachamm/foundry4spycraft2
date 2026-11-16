import {captureCandidateBasis} from '../rules/candidate.mjs';
import {CONTACT_FEATS} from '../rules/contact-feats.mjs';
import {captureFeatAcquisition,featAcquisitionSignature,featAcquisitionSignaturesMatch,featAcquisitionValuesMatch,pendingFeatAcquisition} from "../rules/feat-acquisition.mjs";
/**
 * Identifies this browser session. The same user can be logged in from several clients at once, so comparing user ids
 * is not enough to make sure only the client that made a change follows it up.
 */
const CLIENT_ID = foundry.utils.randomID();
/** ObjectField updates merge children. Explicit replacements must remove obsolete keys. */
function removeOldObjectKeys(patch,path,before,after){
 if(!before||!after||typeof before!=='object'||typeof after!=='object'||Array.isArray(before)||Array.isArray(after))return;
 for(const key of Object.keys(before))if(!Object.hasOwn(after,key))patch[path+'.-='+key]=null;else removeOldObjectKeys(patch,path+'.'+key,before[key],after[key]);
}


export class SpycraftItem extends Item {
  /** @override */
  async _preCreate(data, options, user) {
    if ((await super._preCreate(data, options, user)) === false) return false;
    options.spycraft2Client = CLIENT_ID;
    if(this.type==="feat"&&this.parent?.type==="agent"&&(!this.system.granted||this.system.featKind==="temporary")){
      const career=this.system.acquiredAtLevel||Math.max(1,this.parent.system.level);
      const changes={"system.acquiredAtLevel":career};
      if(this.name==='Candidate'&&career===1&&this.parent.system.level===1)changes['system.candidateBasis']=captureCandidateBasis(this.parent.system,this.system.choice);
      if(this.parent.system.level===career)changes["system.acquisitionCheck"]=captureFeatAcquisition(this.parent,{...this.system,acquiredAtLevel:career},this.id);
      else if(career<this.parent.system.level){
        const prior=this.system.acquisitionCheck,next={...this.system,acquiredAtLevel:career};
        if(!prior||prior.level!==career||!featAcquisitionSignaturesMatch(prior.signature,featAcquisitionSignature(next))){
          changes['system.acquisitionCheck']=pendingFeatAcquisition(next,'This feat was added after its recorded acquisition; review prerequisite eligibility at that level.');
          changes['system.historicalPrerequisitesConfirmed']=false;
        }
      }
      if(changes["system.acquisitionCheck"])removeOldObjectKeys(changes,"system.acquisitionCheck",this.system.acquisitionCheck,changes["system.acquisitionCheck"]);
      this.updateSource(changes);
    }
  }

  /** @override */
  async _preUpdate(changed, options, user) {
    if ((await super._preUpdate(changed, options, user)) === false) return false;
    options.spycraft2Client = CLIENT_ID;
    if(this.type==='feat'&&(changed.name??this.name)==='Candidate'&&this.parent?.type==='agent'&&this.parent.system.level===1&&(changed.name==='Candidate'||Object.hasOwn(changed,'system.choice')||Object.hasOwn(changed.system??{},'choice'))){const choice=changed['system.choice']??changed.system?.choice??this.system.choice,basis=captureCandidateBasis(this.parent.system,choice);if(changed.system)changed.system.candidateBasis=basis;changed['system.candidateBasis']=basis;removeOldObjectKeys(changed,'system.candidateBasis',this.system.candidateBasis,basis);}
    if(this.type==='feat'&&(Object.hasOwn(CONTACT_FEATS,this.name)||Object.hasOwn(CONTACT_FEATS,changed.name??''))){
      const bindingChanged=['choice','contactGrantMode','contactTheme'].some(key=>{const present=Object.hasOwn(changed,`system.${key}`)||Object.hasOwn(changed.system??{},key);return present&&(changed[`system.${key}`]??changed.system?.[key])!==this.system[key];})||Object.hasOwn(changed,'name')&&changed.name!==this.name;
      if(bindingChanged){if(changed.system)changed.system.contactThemeConfirmed=false;changed['system.contactThemeConfirmed']=false;}
    }
    if(this.type==="feat"&&this.parent?.type==="agent"){
      const keys=["acquiredAtLevel","acquisitionSource","tree","prerequisites","manualPrerequisitesConfirmed","featKind","granted","historicalPrerequisitesConfirmed"];
      const touched=keys.some(key=>{const dotted=Object.hasOwn(changed,`system.${key}`),nested=Object.hasOwn(changed.system??{},key);return (dotted||nested)&&!featAcquisitionValuesMatch(dotted?changed[`system.${key}`]:changed.system[key],this.system[key]);});
      if(touched){
        const next=this.system.toObject?.()??{...this.system};
        for(const key of keys)if(Object.hasOwn(changed,`system.${key}`))next[key]=changed[`system.${key}`];else if(Object.hasOwn(changed.system??{},key))next[key]=changed.system[key];
        const criteriaChanged=keys.filter(k=>k!=='historicalPrerequisitesConfirmed').some(key=>!featAcquisitionValuesMatch(next[key],this.system[key]));
        const requested=(changed['system.historicalPrerequisitesConfirmed']??changed.system?.historicalPrerequisitesConfirmed)===true;
        const confirmedNow=!criteriaChanged&&requested&&this.system.historicalPrerequisitesConfirmed!==true;
        if(criteriaChanged||!confirmedNow&&this.system.historicalPrerequisitesConfirmed){
          if(changed.system)changed.system.historicalPrerequisitesConfirmed=false;
          changed['system.historicalPrerequisitesConfirmed']=false;next.historicalPrerequisitesConfirmed=false;
        }
        let snapshot=null;
        if(!next.granted||next.featKind==='temporary'){
          const career=next.acquiredAtLevel||1;
          if(confirmedNow)snapshot={ok:true,unmet:[],level:career,signature:featAcquisitionSignature(next),manual:true};
          else if(career===this.parent.system.level)snapshot=captureFeatAcquisition(this.parent,next,this.id);
          else if(career<this.parent.system.level)snapshot=pendingFeatAcquisition(next);
        }
        if(changed.system)changed.system.acquisitionCheck=snapshot;
        changed["system.acquisitionCheck"]=snapshot;
        removeOldObjectKeys(changed,'system.acquisitionCheck',this.system.acquisitionCheck,snapshot);
      }
    }
    if(this.type==='feat'){
      if(Object.hasOwn(changed,'system.prerequisites')||Object.hasOwn(changed.system??{},'prerequisites'))removeOldObjectKeys(changed,'system.prerequisites',this.system.prerequisites,changed['system.prerequisites']??changed.system?.prerequisites);
      if(Object.hasOwn(changed,'system.acquisitionCheck')||Object.hasOwn(changed.system??{},'acquisitionCheck'))removeOldObjectKeys(changed,'system.acquisitionCheck',this.system.acquisitionCheck,changed['system.acquisitionCheck']??changed.system?.acquisitionCheck);
    }
  }

  /** @override */
  async _preDelete(options, user) {
    if ((await super._preDelete(options, user)) === false) return false;
    options.spycraft2Client = CLIENT_ID;
  }

  /** Did this client start the operation? Pre-operation hooks run only on that client. */
  static #isOrigin(options, userId) {
    return userId === game.user.id && options?.spycraft2Client === CLIENT_ID;
  }

  /** @override */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    if (!SpycraftItem.#isOrigin(options, userId) || this.parent?.type !== "agent") return;
    if (this.type === "origin") this.parent.syncGrantedFeats();
  }

  /** @override */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    if (!SpycraftItem.#isOrigin(options, userId) || this.parent?.type !== "agent") return;
    if (this.type === "origin" || this.type === "class") this.parent.syncGrantedFeats();
  }

  /** @override */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    const actor = this.parent;
    if (!SpycraftItem.#isOrigin(options, userId) || actor?.type !== "agent") return;
    if (this.type === "origin") actor.syncGrantedFeats();
    if (this.type === "class") {
      // Deleting a class item removes its levels from the progression.
      const id = this.system.identifier || this.name;
      const progression = actor.system.progression.filter(p => p.classId !== id);
      if (progression.length !== actor.system.progression.length) {
        actor.update({ "system.progression": progression }).then(() => actor.syncGrantedFeats());
      }
    }
  }

  /** Post the item's description to chat. */
  async toChat() {
    const content = `<div class="spycraft2 chat-card"><h3>${foundry.utils.escapeHTML(this.name)}</h3>${this.system.description ?? ""}</div>`;
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.parent }), content });
  }
}
