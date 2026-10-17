import {NextRequest,NextResponse} from 'next/server';
import {requireProfile,fail,HttpError,audit} from '@/lib/server';
export async function POST(req:NextRequest,{params}:{params:{id:string}}){try{
 const {db,user}=await requireProfile(req);
 const {data,error}=await db.rpc('submit_rims_assessment',{p_id:params.id,p_actor:user.id});
 if(error)throw new HttpError(`ثبت نهایی امکان‌پذیر نیست: ${error.message}`,400);
 await audit(db,user.id,'assessment_submitted',params.id,{score:data?.score});
 return NextResponse.json({ok:true,result:data});
}catch(e){return fail(e);}}
