import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
for(const line of readFileSync('.env.local','utf8').split(/\r?\n/)){
 const m=line.match(/^([A-Z_]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2];
}
const {NEXT_PUBLIC_SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key,ADMIN_EMAIL:email}=process.env;
if(!url||!key||!email)throw Error('Set URL, server-only service key and ADMIN_EMAIL in .env.local');
const db=createClient(url,key,{auth:{persistSession:false}});
let target=null;
for(let page=1;page<=50&&!target;page++){
 const {data,error}=await db.auth.admin.listUsers({page,perPage:200});if(error)throw error;
 target=data.users.find(u=>u.email?.toLowerCase()===email.toLowerCase());
 if(data.users.length<200)break;
}
if(!target)throw Error('Sign in once using email OTP, then retry grant-admin.');
let {data:org,error:orgErr}=await db.from('organizations').select('id').eq('name','مدیریت پژوهش (سیستمی)').limit(1).maybeSingle();if(orgErr)throw orgErr;
if(!org){const r=await db.from('organizations').insert({name:'مدیریت پژوهش (سیستمی)',activity_type:'مدیریت پژوهش',construction_sector:'داخلی'}).select('id').single();if(r.error)throw r.error;org=r.data;}
const {error}=await db.from('profiles').upsert({id:target.id,organization_id:org.id,role:'admin',full_name:'پژوهشگر',job_title:'مدیر سامانه',specialization:'مدیریت ریسک',consent_at:new Date().toISOString(),consent_version:'admin-1.0'},{onConflict:'id'});
if(error)throw error;
console.log(`Admin granted to verified Auth account ${email}`);
