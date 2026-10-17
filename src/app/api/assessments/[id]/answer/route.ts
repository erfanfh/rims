import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {requireProfile,fail,HttpError} from '@/lib/server';
const spec=z.object({questionId:z.string().regex(/^(q([1-9]|[12][0-9]|3[0-7])|target-[1-5])$/),optionIndex:z.number().int().min(0).max(4)});
export async function PATCH(req:NextRequest,{params}:{params:{id:string}}){try{
 const {db,user}=await requireProfile(req);const {questionId,optionIndex}=spec.parse(await req.json());
 const {data:a}=await db.from('assessments').select('id,respondent_id,status,questionnaire_version').eq('id',params.id).maybeSingle();
 if(!a||a.respondent_id!==user.id||a.status!=='draft')throw new HttpError('دسترسی به ویرایش پاسخ امکان‌پذیر نیست.',403);
 const [q,o]=await Promise.all([
  db.from('questions').select('text,questionnaire_version').eq('id',questionId).maybeSingle(),
  db.from('answer_options').select('label,text').eq('question_id',questionId).eq('option_index',optionIndex).maybeSingle()
 ]);
 if(!q.data||q.data.questionnaire_version!==a.questionnaire_version||!o.data)throw new HttpError('گزینه سؤال معتبر نیست.',400);
 const {error}=await db.from('answers').upsert({assessment_id:params.id,question_id:questionId,selected_index:optionIndex,question_text_snapshot:q.data.text,option_label_snapshot:o.data.label,option_text_snapshot:o.data.text,updated_at:new Date().toISOString()},{onConflict:'assessment_id,question_id'});
 if(error)throw new HttpError('ذخیره پاسخ انجام نشد؛ صفحه را تازه‌سازی کنید.',409);
 return NextResponse.json({saved:true});
}catch(e){if(e instanceof z.ZodError)return NextResponse.json({error:'پاسخ نامعتبر.'},{status:400});return fail(e);}}
