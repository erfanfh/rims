import {NextRequest,NextResponse} from 'next/server';
import ExcelJS from 'exceljs';
import {requireAdmin,fail,HttpError,audit} from '@/lib/server';
import {DIMENSIONS} from '@/lib/scoring';

function excelSafe(v:unknown):ExcelJS.CellValue{
 if(v===null||v===undefined)return null;
 if(typeof v==='string')return /^[\s]*[=+@\-\t\r]/.test(v)?`'${v}`:v;
 if(typeof v==='number'||typeof v==='boolean'||v instanceof Date)return v;
 return String(v);
}
const header=(ws:ExcelJS.Worksheet,labels:string[])=>{
 ws.addRow(labels);ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
 ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF194E49'}};
 ws.views=[{state:'frozen',ySplit:1}];
 ws.autoFilter={from:'A1',to:{row:1,column:labels.length}};
 ws.columns=labels.map(l=>({width:Math.min(42,Math.max(15,l.length+5))}));
};
async function all(db:any,table:string,fields:string){
 const out:any[]=[];let from=0;const chunk=600;
 while(true){const {data,error}=await db.from(table).select(fields).range(from,from+chunk-1);
  if(error)throw error;out.push(...data);if(data.length<chunk)break;from+=chunk;
  if(from>120000)throw new HttpError('حجم داده بسیار بزرگ است؛ خروجی مرحله‌ای لازم است.',413);
 }return out;
}
export async function GET(req:NextRequest){try{
 const {db,user}=await requireAdmin(req);
 const identifiable=req.nextUrl.searchParams.get('identifiable')==='1';
 const orgId=req.nextUrl.searchParams.get('organizationId')||'';
 if(orgId && !/^[0-9a-f-]{36}$/i.test(orgId))throw new HttpError('شناسه سازمان نادرست است.',400);
 const [organizations,respondents,assessments,raw,qs,ds,maturity]=await Promise.all([
  all(db,'organizations','*'),all(db,'profiles','*'),all(db,'assessments','*'),
  all(db,'answers','*'),all(db,'questions','*'),all(db,'dimension_scores','*'),all(db,'maturity_results','*')
 ]);
 const filteredAssessments=assessments.filter((a:any)=>!orgId||a.organization_id===orgId);
 const aIds=new Set(filteredAssessments.map((a:any)=>a.id));
 const fs=raw.filter((r:any)=>aIds.has(r.assessment_id));
 const assessmentById=new Map(filteredAssessments.map((a:any)=>[a.id,a]));
 const fds=ds.filter((r:any)=>aIds.has(r.assessment_id));
 const fr=maturity.filter((r:any)=>aIds.has(r.assessment_id));
 const fos=organizations.filter((r:any)=>r.name!=='مدیریت پژوهش (سیستمی)'&&(!orgId||r.id===orgId));
 const fps=respondents.filter((r:any)=>r.role==='respondent'&&(!orgId||r.organization_id===orgId));
 const organizationAliases=new Map(fos.map((o:any,i:number)=>[o.id,`ORG-${String(i+1).padStart(4,'0')}`]));
 const orgLabel=(id:string)=>identifiable?(fos.find((o:any)=>o.id===id)?.name??''):organizationAliases.get(id)??'';
 const wb=new ExcelJS.Workbook();wb.creator='RIMS research platform';wb.created=new Date();
 const add=(title:string,cols:string[],rows:unknown[][])=>{
  const ws=wb.addWorksheet(title);header(ws,cols);
  for(const row of rows)ws.addRow(row.map(excelSafe));
  return ws;
 };
 add('Organizations',['organization_id','organization_name_or_code','activity_type','construction_sector','size_label','years_active'],fos.map((o:any)=>[o.id,orgLabel(o.id),o.activity_type,o.construction_sector,o.size_label,o.years_active]));
 add('Respondents',['respondent_id','organization_id','full_name','job_title','specialization','experience_years','risk_experience_years','erm_familiarity','consent_at'],fps.map((p:any)=>[p.id,p.organization_id,identifiable?p.full_name:null,p.job_title,p.specialization,p.experience_years,p.risk_experience_years,p.erm_familiarity,p.consent_at]));
 add('Assessments',['assessment_id','respondent_id','organization_id','status','started_at','submitted_at','questionnaire_version'],filteredAssessments.map((a:any)=>[a.id,a.respondent_id,a.organization_id,a.status,a.started_at,a.submitted_at,a.questionnaire_version]));
 add('Raw_Answers',['assessment_id','respondent_id','organization_id','question_id','question_text','option_index_0_based','selected_level_1_to_5','option_label','option_text','updated_at'],fs.map((r:any)=>{
  const a:any=assessmentById.get(r.assessment_id);return [r.assessment_id,a?.respondent_id,a?.organization_id,r.question_id,r.question_text_snapshot,r.selected_index,r.selected_index+1,r.option_label_snapshot,r.option_text_snapshot,r.updated_at];
 }));
 const qKind=new Map(qs.map((q:any)=>[q.id,q.kind]));
 add('Question_Scores',['assessment_id','question_id','score_1_to_5','is_official_attribute'],fs.map((r:any)=>[r.assessment_id,r.question_id,r.selected_index+1,qKind.get(r.question_id)==='attribute'?1:0]));
 add('Dimension_Scores',['assessment_id','dimension_key','mean_score','weighted_score','item_count','algorithm_version'],fds.map((r:any)=>[r.assessment_id,r.dimension_key,Number(r.average_score),Number(r.weighted_score),r.item_count,r.algorithm_version]));
 add('Maturity_Results',['assessment_id','total_score','tier_or_blank','ruleset_id','algorithm_version','calculated_at'],fr.map((r:any)=>[r.assessment_id,Number(r.total_score),r.tier,r.scoring_rules_id,r.algorithm_version,r.calculated_at]));
 const rawByAssessment=new Map<string,Map<string,number>>();for(const r of fs){const m=rawByAssessment.get(r.assessment_id)??new Map();m.set(r.question_id,r.selected_index+1);rawByAssessment.set(r.assessment_id,m);}
 const dimByAssessment=new Map<string,Map<string,number>>();for(const r of fds){const m=dimByAssessment.get(r.assessment_id)??new Map();m.set(r.dimension_key,Number(r.average_score));dimByAssessment.set(r.assessment_id,m);}
 const resultMap=new Map(fr.map((r:any)=>[r.assessment_id,r]));
 const questionCols=Array.from({length:37},(_,i)=>`q${i+1}`);
 const targetCols=Array.from({length:5},(_,i)=>`target-${i+1}`);
 const dimensionCols=DIMENSIONS.map(d=>`score_${d.key}`);
 const wideRows=filteredAssessments.map((a:any)=>{
  const ans=rawByAssessment.get(a.id),dim=dimByAssessment.get(a.id),res:any=resultMap.get(a.id);
  return [a.id,a.respondent_id,a.organization_id,a.status,...questionCols.map(q=>ans?.get(q)),...targetCols.map(q=>ans?.get(q)),...dimensionCols.map(q=>dim?.get(q.replace('score_',''))),res?.total_score?Number(res.total_score):null,res?.tier??null];
 });
 add('SPSS_Data',['assessment_id','respondent_id','organization_id','status',...questionCols,...targetCols,...dimensionCols,'M_total','tier'],wideRows);
 const dictionaryRows=[['assessment_id','string','Unique assessment UUID'],['respondent_id','string','Pseudonymous Supabase Auth user UUID'],['organization_id','string','Pseudonymous organization UUID'],['status','category','draft/submitted'],...qs.sort((a:any,b:any)=>a.position-b.position).map((q:any)=>[q.id,q.kind,`1–5; ${q.text}`]),...DIMENSIONS.map(d=>[`score_${d.key}`,'numeric',`Mean of ${d.questionIds.length} attributes, weight ${d.weight}`]),['M_total','numeric','Σ (mean_dimension × dimension_weight); only when submitted'],['tier','category','Only when sourced thresholds have been approved']];
 add('Data_Dictionary',['variable','type','description'],dictionaryRows);
 await audit(db,user.id,'excel_export',orgId||'all',{identifiable,assessments:filteredAssessments.length});
 const bytes=await wb.xlsx.writeBuffer();const bin=new Uint8Array(bytes as ArrayBuffer);
 return new NextResponse(bin,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="RIMS_research_${new Date().toISOString().slice(0,10)}.xlsx"`,'Cache-Control':'no-store, private'}});
}catch(e){return fail(e);}}
