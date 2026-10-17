import {createClient} from '@supabase/supabase-js';
import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'node:crypto';

export function adminDb(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw Error('Supabase server environment is not configured');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function shaCode(code:string){return createHash('sha256').update(code.trim()).digest('hex');}
export function errorJson(message:string,status=400){return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});}
export async function actor(req:NextRequest){
 const header=req.headers.get('authorization')??'';
 if(!header.startsWith('Bearer '))throw new HttpError('نیاز به ورود معتبر دارید.',401);
 const jwt=header.slice(7).trim();
 if(!jwt)throw new HttpError('نشست نامعتبر است.',401);
 const db=adminDb();
 const {data,error}=await db.auth.getUser(jwt);
 if(error||!data.user)throw new HttpError('نشست منقضی شده است؛ دوباره وارد شوید.',401);
 const {data:profile,error:pe}=await db.from('profiles').select('*').eq('id',data.user.id).maybeSingle();
 if(pe)throw new HttpError('خطا در خواندن پروفایل.',500);
 return {db,user:data.user,profile};
}
export async function requireProfile(req:NextRequest){
 const a=await actor(req);if(!a.profile)throw new HttpError('ابتدا اطلاعات پژوهشی خود را تکمیل کنید.',403);return {...a,profile:a.profile!};
}
export async function requireAdmin(req:NextRequest){
 const a=await requireProfile(req);if(a.profile.role!=='admin')throw new HttpError('دسترسی مدیر لازم است.',403);return a;
}
export class HttpError extends Error {constructor(message:string,public status:number){super(message);}}
export function fail(err:unknown){
 if(err instanceof HttpError)return errorJson(err.message,err.status);
 console.error('Request failed',err);
 return errorJson('عملیات انجام نشد؛ در صورت تداوم با مدیر سامانه تماس بگیرید.',500);
}
export async function audit(db:ReturnType<typeof adminDb>,actorId:string,action:string,entityId:string,details:Record<string,unknown>={}){
 const {error}=await db.from('audit_logs').insert({actor_id:actorId,action,entity_id:entityId,details});
 if(error)console.error('Audit write failed:',error.message);
}
export const noStore={'Cache-Control':'no-store, private'};
