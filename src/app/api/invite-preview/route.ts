import {NextRequest,NextResponse} from 'next/server';
import {actor,fail,HttpError,shaCode} from '@/lib/server';
import {z} from 'zod';
export async function POST(req:NextRequest){try{
 const {db,profile}=await actor(req);if(profile)throw new HttpError('حساب قبلاً ثبت شده است.',409);
 const b=z.object({code:z.string().min(16).max(200)}).parse(await req.json());
 const {data:invite}=await db.from('invites').select('organization_id,expires_at,used_by').eq('code_hash',shaCode(b.code)).maybeSingle();
 if(!invite||invite.used_by||new Date(invite.expires_at)<=new Date())throw new HttpError('کد دعوت یافت نشد یا معتبر نیست.',404);
 const {data:org}=await db.from('organizations').select('name,activity_type,construction_sector').eq('id',invite.organization_id).maybeSingle();
 if(!org)throw new HttpError('سازمان کد دعوت پیدا نشد.',404);
 return NextResponse.json({organization:org},{headers:{'Cache-Control':'no-store'}});
}catch(e){if(e instanceof z.ZodError)return NextResponse.json({error:'کد دعوت نامعتبر است.'},{status:400});return fail(e);}}
