import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin,fail,noStore} from '@/lib/server';
export async function GET(req:NextRequest){try{
 const {db}=await requireAdmin(req);
 const [orgs,people,completed,draft,records,scores]=await Promise.all([
  db.from('organizations').select('*',{count:'exact'}).neq('name','مدیریت پژوهش (سیستمی)').order('created_at',{ascending:false}).limit(300),
  db.from('profiles').select('id,full_name,job_title,organization_id,experience_years,risk_experience_years,erm_familiarity,created_at',{count:'exact'}).eq('role','respondent').limit(1000),
  db.from('assessments').select('*',{head:true,count:'exact'}).eq('status','submitted'),
  db.from('assessments').select('*',{head:true,count:'exact'}).eq('status','draft'),
  db.from('assessments').select('id,organization_id,respondent_id,status,started_at,submitted_at').order('started_at',{ascending:false}).limit(500),
  db.from('maturity_results').select('assessment_id,total_score,tier,algorithm_version,calculated_at').limit(500)
 ]);
 for(const r of [orgs,people,completed,draft,records,scores])if(r.error)throw r.error;
 return NextResponse.json({statistics:{organizations:orgs.count??0,respondents:people.count??0,completed:completed.count??0,draft:draft.count??0},organizations:orgs.data,respondents:people.data,assessments:records.data,scores:scores.data},{headers:noStore});
}catch(e){return fail(e);}}
