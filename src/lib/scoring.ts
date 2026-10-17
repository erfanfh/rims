/** Independently testable scoring specification as documented in thesis, ch. 2.
 * Question IDs q1/q2 are baseline, target-1..5 are targets (excluded from M).
 * Official Tier thresholds are NOT assumed. */
export const DIMENSIONS=[
 {key:'strategy',label:'هم‌راستایی با راهبرد',weight:0.25,questionIds:['q3','q4','q5','q6','q7','q8']},
 {key:'culture',label:'فرهنگ و پاسخ‌گویی',weight:0.30,questionIds:['q9','q10','q11','q12','q13','q14','q15']},
 {key:'capability',label:'قابلیت‌های مدیریت ریسک',weight:0.20,questionIds:['q16','q17','q18','q19','q20','q21','q22']},
 {key:'governance',label:'حاکمیت ریسک',weight:0.13,questionIds:['q23','q24','q25','q26','q27','q28','q29']},
 {key:'analytics',label:'تحلیل‌گری',weight:0.12,questionIds:['q30','q31','q32','q33','q34','q35','q36','q37']}
] as const;
export type DimensionKey=(typeof DIMENSIONS)[number]['key'];
export type ScoreInput=Record<string,number>;
export function calculateScores(answers:ScoreInput){
 const dimensions=DIMENSIONS.map(d=>{
  const vals=d.questionIds.map(id=>answers[id]);
  if(vals.some(v=>!Number.isInteger(v)||v<1||v>5))throw Error(`Missing or invalid response in ${d.key}`);
  const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
  return {key:d.key,label:d.label,itemCount:vals.length,average:mean,weighted:mean*d.weight,weight:d.weight};
 });
 return {dimensions,total:dimensions.reduce((s,d)=>s+d.weighted,0)};
}
export type Threshold={tier:string;min:number;max:number};
export function validateThresholds(arr:Threshold[]):boolean{
 if(arr.length!==5)return false;
 const eps=1e-9;
 for(let i=0;i<5;i++){
  const r=arr[i];if(r.tier!==`Tier ${i+1}`||!Number.isFinite(r.min)||!Number.isFinite(r.max)||r.max<=r.min)return false;
  if(i===0&&Math.abs(r.min-1)>eps)return false;
  if(i>0&&Math.abs(r.min-arr[i-1].max)>eps)return false;
  if(i===4&&Math.abs(r.max-5)>eps)return false;
 }return true;
}
export function getTier(score:number,tiers:Threshold[]):string|null{
 if(!validateThresholds(tiers))return null;
 return tiers.find((r,i)=>score>=r.min&&(score<r.max||(i===4&&score<=r.max)))?.tier??null;
}
