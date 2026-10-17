import {NextRequest,NextResponse} from 'next/server';
import {requireProfile,fail,HttpError,noStore} from '@/lib/server';
export async function GET(req:NextRequest,{params}:{params:{id:string}}){try{
 const {db,user,profile}=await requireProfile(req);
 const {data:a,error}=await db.from('assessments').select('*').eq('id',params.id).maybeSingle();
 if(error||!a)throw new HttpError('ارزیابی پیدا نشد.',404);
 if(a.respondent_id!==user.id&&profile.role!=='admin')throw new HttpError('دسترسی غیرمجاز.',403);
 const [ans,dim,res]=await Promise.all([
  db.from('answers').select('question_id,selected_index,updated_at').eq('assessment_id',params.id),
  db.from('dimension_scores').select('dimension_key,average_score,weighted_score,item_count').eq('assessment_id',params.id),
  db.from('maturity_results').select('total_score,tier,scoring_rules_id,algorithm_version,calculated_at').eq('assessment_id',params.id).maybeSingle()
 ]);
 if(ans.error||dim.error||res.error)throw new Error('Unable to load assessment results');
 return NextResponse.json({assessment:a,answers:ans.data,dimensions:dim.data,result:res.data},{headers:noStore});
}catch(e){return fail(e);}}
