import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {actor,fail,HttpError,shaCode,audit} from '@/lib/server';
const spec=z.object({code:z.string().min(16).max(200),name:z.string().trim().min(3).max(120),job:z.string().trim().min(2).max(120),specialization:z.string().max(160).default(''),experience:z.number().min(0).max(80),riskExperience:z.number().min(0).max(80),familiarity:z.enum(['کم','متوسط','زیاد']),consent:z.literal(true)});
export async function POST(req:NextRequest){try{
 const {db,user,profile}=await actor(req);
 if(profile)throw new HttpError('اطلاعات شما قبلاً ثبت شده است.',409);
 const body=spec.parse(await req.json());
 const {data,error}=await db.rpc('redeem_invite',{p_code_hash:shaCode(body.code),p_user_id:user.id,p_name:body.name,p_job:body.job,p_specialization:body.specialization,p_experience:body.experience,p_risk_experience:body.riskExperience,p_familiarity:body.familiarity});
 if(error)throw new HttpError('کد دعوت معتبر نیست، منقضی شده یا قبلاً استفاده شده است.',400);
 await audit(db,user.id,'respondent_registration',user.id,{organization_id:data?.organization_id});
 return NextResponse.json({ok:true});
}catch(e){if(e instanceof z.ZodError)return NextResponse.json({error:'لطفاً اطلاعات ثبت‌نام را کامل و صحیح وارد کنید.'},{status:400});return fail(e);}}
