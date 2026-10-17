import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {requireAdmin,fail,audit} from '@/lib/server';
const spec=z.object({name:z.string().trim().min(2).max(180),activityType:z.string().trim().min(2).max(100),sector:z.string().trim().min(2).max(160),size:z.string().max(80).optional(),yearsActive:z.number().int().min(0).max(200).nullable().optional()});
export async function POST(req:NextRequest){try{
 const {db,user}=await requireAdmin(req);const b=spec.parse(await req.json());
 const {data,error}=await db.from('organizations').insert({name:b.name,activity_type:b.activityType,construction_sector:b.sector,size_label:b.size??null,years_active:b.yearsActive??null}).select('id,name').single();
 if(error)throw error;await audit(db,user.id,'organization_created',data.id,{});
 return NextResponse.json(data,{status:201});
}catch(e){if(e instanceof z.ZodError)return NextResponse.json({error:'مشخصات سازمان معتبر نیست.'},{status:400});return fail(e);}}
