import {attackCharacterTargetChoices} from './character-target.mjs';
export function feintContent(key,actor){
 if(!['sleightOfHand','notice'].includes(key))return '';
 const acting=key==='sleightOfHand',esc=foundry.utils.escapeHTML;
 return `<details><summary>${acting?'Feint action':'Resist Feint'}</summary><p>Choose ${acting?'Feint Action (Sleight of Hand/DEX, Hands-On and Vision)':'Resist Feint (Notice/WIS, Vision)'} above. Both checks add action error+1. ${acting?'The ordinary action requires one half action during your Initiative Count.':'This rolls only your opposed response.'} Fencing Basics with a readied one-handed FIN sword or Flail Basics with a readied flail supplies +2 gear; these bonuses do not stack.</p><label>Actual opposing character <select name="feintOpponentUuid"><option value="">Unrecorded opponent (manual outcomes)</option>${attackCharacterTargetChoices().filter(a=>a.uuid!==actor?.uuid).map(a=>`<option value="${esc(a.uuid)}">${esc(a.name)}</option>`).join('')}</select></label><label>Unrecorded opponent name <input name="feintOpponentName" maxlength="200" /></label><label><input name="feintAdjacent" type="checkbox" /> The opponent is adjacent</label><label><input name="feintTargetEligibleConfirmed" type="checkbox" /> The GC confirms ${acting?'the opponent has':'I have'} not already been targeted by a successful Feint this round</label><label><input name="feintLegalConfirmed" type="checkbox" /> The GC confirms the participants and ${acting?'the legal half action is available now':'this is a legal incoming Feint'}</label><p>For a recorded opponent, confirm and resolve both participant checks in chat, then use Feint outcomes on Main. Unrecorded opponents retain manual outcomes. A critical next-attack bonus requires the recorded opponent on that attack. Alternative skills and free actions require their separate workflows.</p></details>`;
}

export function feintTargetInput(input,actor){
 const uuid=input.feintOpponentUuid??'';if(!uuid)return {};
 const target=attackCharacterTargetChoices().find(a=>a.uuid===uuid&&a.uuid!==actor.uuid);if(!target)throw Error('Choose a currently observed opposing character for Feint.');
 return {feintOpponentUuid:target.uuid,feintOpponentName:target.name};
}
export function validateFeintTarget(actor,proof){
 if(!proof?.opponentUuid)return;
 const target=attackCharacterTargetChoices().find(a=>a.uuid===proof.opponentUuid&&a.uuid!==actor.uuid);if(!target||target.name!==proof.opponentName)throw Error('The actual Feint opponent changed before posting.');
 const victim=proof.role==='attacker'?target:actor;
 for(const row of victim.system.feintHistory??[]){if(row?.version!==1||typeof row.sourceMessage!=='string'||typeof row.combatId!=='string'||!Number.isSafeInteger(row.round))throw Error('Review the recorded successful Feint history.');if(row.combatId===proof.combat.id&&row.round===proof.combat.round)throw Error('This character has already been targeted by a successful Feint this round.');}
}
