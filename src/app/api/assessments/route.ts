import {NextRequest,NextResponse} from 'next/server';
import {requireProfile,fail,HttpError,noStore} from '@/lib/server';
export async function GET(req:NextRequest){try{
 const {db,user}=await requireProfile(req);
 const {data,error}=await db.from('assessments').select('id,status,started_at,submitted_at').eq('respondent_id',user.id).order('started_at',{ascending:false}).limit(100);
 if(error)throw error;return NextResponse.json({assessments:data},{headers:noStore});
}catch(e){return fail(e);}}
export async function POST(req:NextRequest){try{
 const {db,user,profile}=await requireProfile(req);
 if(profile.role!=='respondent')throw new HttpError('حساب مدیر نمی‌تواند پاسخ‌دهنده باشد.',403);
 const {data:old}=await db.from('assessments').select('id').eq('respondent_id',user.id).eq('status','draft').maybeSingle();
 if(old)return NextResponse.json({id:old.id,existing:true});
 const {data,error}=await db.from('assessments').insert({respondent_id:user.id,organization_id:profile.organization_id}).select('id').single();
 if(error){const {data:existing}=await db.from('assessments').select('id').eq('respondent_id',user.id).eq('status','draft').maybeSingle();if(existing)return NextResponse.json({id:existing.id,existing:true});throw error;}
 return NextResponse.json({id:data.id,existing:false},{status:201});
}catch(e){return fail(e);}}
