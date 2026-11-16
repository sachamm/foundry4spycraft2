/** Numerical advantage p.172 and Tactical Advantage p.175. Team membership is a GC-confirmed relationship. */
function countedSide(rows){
 if(!Array.isArray(rows))throw new Error('Declare each side’s actual characters and teammate groups.');
 const ids=new Set(),prepared=rows.map(r=>{
 if(!r||typeof r.id!=='string'||!r.id||r.id.length>300||ids.has(r.id)||typeof r.name!=='string'||!r.name.trim()||r.name.length>200||!Number.isSafeInteger(r.characters)||r.characters<0||!Number.isSafeInteger(r.countsAs)||r.countsAs<1||typeof r.tacticalAdvantage!=='boolean'||typeof r.team!=='string'||r.team.length>80||typeof r.countingSource!=='string'||r.countingSource.length>500||r.countsAs>1&&!r.countingSource.trim())throw new Error('Each roster group needs a unique reference, whole physical count, teammate group and source for other counting abilities.');
 ids.add(r.id);return {...r,team:r.team.trim().toLowerCase()};
 });
 const providers=prepared.filter(r=>r.tacticalAdvantage&&r.team),teams=new Set(providers.map(r=>r.team));let physical=0,effective=0;
 const counted=prepared.map(r=>{const applies=r.tacticalAdvantage||!!r.team&&teams.has(r.team),perCharacter=r.countsAs>=2?r.countsAs:applies?2:1,weight=r.characters*perCharacter;physical+=r.characters;effective+=weight;if(!Number.isSafeInteger(weight)||!Number.isSafeInteger(physical)||!Number.isSafeInteger(effective))throw new Error('The roster count exceeds safe whole-character arithmetic.');return {...r,tacticalApplies:applies&&r.countsAs<2,perCharacter,effective:weight};});
 return {physical,effective,rows:counted,providers:providers.map(r=>({id:r.id,name:r.name,team:r.team,physicallyCounted:r.characters>0}))};
}
export function numericalAdvantagePlan({own=[],opposition=[],rosterConfirmed=false}={}){
 if(rosterConfirmed!==true)throw new Error('The GC must confirm actual physical characters, opposing sides, teammate relationships and other counting abilities.');
 const a=countedSide(own),b=countedSide(opposition),opponentsPresent=a.physical>0&&b.physical>0,meets=n=>opponentsPresent&&BigInt(a.effective)>=BigInt(n)*BigInt(b.effective);
 return {own:a,opposition:b,opponentsPresent,twoToOne:meets(2),threeToOne:meets(3),notes:['Only physically present characters add to each side’s physical count. A shared Actor can represent a declared group; do not count both its prototype and placed tokens twice.','Tactical Advantage affects the owner and actual teammates, not every ally. Distinct team identifiers separate allied groups. Multiple copies do not multiply the doubling; another ability already counting a character as 2 or more takes precedence.','The counting benefit has no printed distance or owner-participation requirement; a declared zero-count provider may supply it to confirmed teammates, without adding an absent character to the physical roster.','These totals check numerical-advantage thresholds. Other feat conditions, actions, uses and effects require their own resolution. Joint Action DC stacking is separate.']};
}
