import {actionDiceGain} from './action-dice.mjs';
/** Free hints: origins pp.21,23,25; Snoop Intuition p.47. */
export function hintSources(system,items=[]){
 const sources=[];
 for(const [name,type,limit] of [['Retired','talent',1],['Investigator','specialty',2],['Spiritualist','specialty',1],['Stranger','specialty',1]]){
  if(items.some(item=>item.type==='origin'&&item.name===name&&item.system?.originType===type))sources.push({id:`hint${name}`,name:`${name}: free hint`,period:'session',limit,refusalDice:1,minute:false,cost:0,workflow:'hintResponse'});
 }
 const level=system.classLevels?.snoop??0,native=level>=19?3:level>=11?2:level>=2?1:0;
 const inherited=level>=2?0:(system.inheritedClassChoices??[]).filter(entry=>entry.name==='Snoop: Intuition I').length;
 const grade=Math.min(level>0?3:1,native+inherited);
 if(grade)sources.push({id:'hintIntuition',name:`Intuition ${['','I','II','III'][grade]}: free hint`,period:'mission',limit:system.actionDice?.max??0,refusalDice:grade,minute:true,cost:0,workflow:'hintResponse'});
 return sources;
}
export function hintResponsePlan(system,items,{source,outcome,text='',minuteConfirmed=false,careerDie=4}={}){
 const spec=hintSources(system,items).find(entry=>entry.id===source);
 if(!spec)throw new Error('This free-hint source is not currently available.');
 if(!['provided','refused'].includes(outcome))throw new Error('Choose whether the GC provides or refuses the hint.');
 if(spec.minute&&!minuteConfirmed)throw new Error('Intuition requires a one-minute action.');
 const detail=String(text).trim();if(outcome==='provided'&&!detail)throw new Error('Enter the hint provided by the GC.');
 const gain=outcome==='refused'?actionDiceGain(system,careerDie,spec.refusalDice):{units:0,die:null};
 const value=(system.actionDice?.value??0)+gain.units;if(!Number.isSafeInteger(value)||value<0)throw new Error('The bonus action-die balance must be a safe whole number.');
 return {spec,outcome,text:detail,...gain,value};
}
