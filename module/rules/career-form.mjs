/** A form changes only its intended career fields, never an old copy of vitality/history. */
const shape=rows=>JSON.stringify(rows.map(p=>[p.classId,p.careerEntryId??'']));
const skillKey=k=>typeof k==='string'&&/^[a-zA-Z][a-zA-Z0-9]*$/.test(k)&&!['constructor','prototype','__proto__'].includes(k);
function read(row,edit){return edit.field==='skill'?(row.skills?.[edit.key]??0):(row.intelligenceModifier??null);}
function validate(edit){
 if(!Number.isSafeInteger(edit.index)||edit.index<0||!['skill','intelligenceModifier'].includes(edit.field))throw new Error('Review the career form field.');
 if(edit.field==='skill'&&(!skillKey(edit.key)||!Number.isSafeInteger(edit.value)||edit.value<0))throw new Error('Skill points must be nonnegative whole numbers.');
 if(edit.field==='intelligenceModifier'&&edit.value!==null&&!Number.isSafeInteger(edit.value))throw new Error('The historical Intelligence modifier must be a whole number or blank.');
}
export function careerFormPlan(rows,requests){
 const edits=[];
 for(const request of requests){validate(request);const row=rows[request.index];if(!row)throw new Error('This career level no longer exists. Reopen the sheet.');const before=read(row,request);if(before!==request.value)edits.push({...request,before});}
 return {version:1,shape:shape(rows),edits};
}
export function mergeCareerForm(rows,plan){
 if(plan?.version!==1||!Array.isArray(plan.edits)||shape(rows)!==plan.shape)throw new Error('The career progression changed while the form was pending. Reopen the sheet.');
 const result=rows.map(p=>({...p,skills:{...p.skills}}));
 for(const edit of plan.edits){validate(edit);const row=result[edit.index];if(!row)throw new Error('The edited career level no longer exists.');const current=read(row,edit);if(current!==edit.before&&current!==edit.value)throw new Error('This career field changed while the form was pending. Reopen the sheet before replacing it.');if(edit.field==='skill'){if(edit.value)row.skills[edit.key]=edit.value;else delete row.skills[edit.key];}else row.intelligenceModifier=edit.value;}
 return result;
}
