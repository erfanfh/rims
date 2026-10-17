import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {requireAdmin,fail,HttpError,audit,noStore} from '@/lib/server';
import {validateThresholds} from '@/lib/scoring';
const boundary=z.object({tier:z.string(),min:z.number(),max:z.number()});
const spec=z.object({label:z.string().trim().min(4).max(120),reference:z.string().trim().min(8).max(2000),kind:z.enum(['official_verified','research_decision']),boundaries:z.array(boundary).length(5)});
export async function GET(req:NextRequest){try{
 const {db}=await requireAdmin(req);const {data,error}=await db.from('scoring_rules').select('id,label,evidence_reference,evidence_kind,boundaries,is_active,approved_at,created_at').order('created_at',{ascending:false});if(error)throw error;
 return NextResponse.json({rules:data},{headers:noStore});
}catch(e){return fail(e);}}
export async function POST(req:NextRequest){try{
 const {db,user}=await requireAdmin(req);const body=spec.parse(await req.json());
 if(!validateThresholds(body.boundaries))throw new HttpError('بازه‌ها باید از ۱ تا ۵، بدون همپوشانی و شکاف باشند.',400);
 const {data,error}=await db.from('scoring_rules').insert({label:body.label,evidence_reference:body.reference,evidence_kind:body.kind,boundaries:body.boundaries,is_active:false}).select('id').single();
 if(error)throw error;
 const {error:rpcError}=await db.rpc('activate_rims_rules',{p_id:data.id,p_actor:user.id});
 if(rpcError)throw new HttpError('قواعد ذخیره شدند اما فعال‌سازی ناموفق بود: '+rpcError.message,500);
 await audit(db,user.id,'rules_activated',data.id,{reference:body.reference,kind:body.kind});
 return NextResponse.json({ok:true,id:data.id},{status:201});
}catch(e){if(e instanceof z.ZodError)return NextResponse.json({error:'اطلاعات قواعد معتبر نیست.'},{status:400});return fail(e);}}
