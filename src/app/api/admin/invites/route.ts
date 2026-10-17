import {NextRequest,NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {requireAdmin,fail,HttpError,shaCode,audit} from '@/lib/server';
const spec=z.object({organizationId:z.string().uuid(),days:z.number().int().min(1).max(90).default(14)});
export async function POST(req:NextRequest){try{
 const {db,user}=await requireAdmin(req);const b=spec.parse(await req.json());
 const {data:org}=await db.from('organizations').select('id,name').eq('id',b.organizationId).maybeSingle();if(!org)throw new HttpError('سازمان پیدا نشد.',404);
 const inviteCode=randomBytes(18).toString('base64url');
 const expires=new Date(Date.now()+b.days*86400000).toISOString();
 const {data,error}=await db.from('invites').insert({code_hash:shaCode(inviteCode),organization_id:b.organizationId,created_by:user.id,expires_at:expires}).select('id').single();
 if(error)throw error;
 await audit(db,user.id,'invite_created',data.id,{organization_id:org.id,expires_at:expires});
 return NextResponse.json({code:inviteCode,organization:org.name,expiresAt:expires},{status:201,headers:{'Cache-Control':'no-store'}});
}catch(e){if(e instanceof z.ZodError)return NextResponse.json({error:'اطلاعات کد دعوت نامعتبر است.'},{status:400});return fail(e);}}
