/** Noncumulative Table 1.17 aging modifiers, printed p.61. */
export function agingEffects(value) {
  const text=String(value??'').trim();
  if(!text)return {category:'Unspecified',modifiers:{},small:false};
  if(!/^\d+$/.test(text)||Number(text)<1)return {category:'Invalid',modifiers:{},small:false,warning:'Age must be a positive whole number of years for aging modifiers.'};
  const age=Number(text),category=age<12?'Child':age<16?'Young Adult':age<=40?'Adult':age<60?'Middle Age':age<80?'Old':'Venerable';
  const mods=age<12?[-3,-1,-3,-1,-1,-1]:age<16?[-1,-1,-1,-1,-1,-1]:age<=40?[0,0,0,0,0,0]:age<60?[-1,-1,-1,1,1,1]:age<80?[-2,-2,-2,1,1,1]:[-3,-3,-3,1,1,1];
  return {category,modifiers:Object.fromEntries(['str','dex','con','int','wis','cha'].map((key,i)=>[key,mods[i]])),small:age<12};
}
