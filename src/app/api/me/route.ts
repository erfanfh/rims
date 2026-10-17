import {NextRequest,NextResponse} from 'next/server';
import {actor,fail,noStore} from '@/lib/server';
export async function GET(req:NextRequest){try{
 const {db,user,profile}=await actor(req);
 let organization=null;
 if(profile?.organization_id){const {data}=await db.from('organizations').select('id,name,activity_type,construction_sector').eq('id',profile.organization_id).maybeSingle();organization=data;}
 return NextResponse.json({email:user.email,profile,organization},{headers:noStore});
}catch(e){return fail(e);}}
