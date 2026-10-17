/** Safe, read-only connectivity & security smoke checks against actual Supabase. */
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
for(const line of readFileSync('.env.local','utf8').split(/\r?\n/)){
 const m=line.match(/^([A-Z_]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2];
}
const {NEXT_PUBLIC_SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key,NEXT_PUBLIC_SUPABASE_ANON_KEY:anon}=process.env;
if(!url||!key||!anon)throw Error('Configure .env.local');
const db=createClient(url,key,{auth:{persistSession:false}}),anonymous=createClient(url,anon,{auth:{persistSession:false}});
for(const [table,expected] of [['dimensions',5],['questions',42],['answer_options',210]]){
 const {count,error}=await db.from(table).select('*',{head:true,count:'exact'});
 if(error)throw error;
 if(count!==expected)throw new Error(`${table} count mismatch, expected ${expected}, got ${count}`);
 console.log(`${table}: ${count} OK`);
}
const {data:d,error:e}=await db.from('dimensions').select('weight,item_count');if(e)throw e;
const weight=d.reduce((a,x)=>a+Number(x.weight),0),items=d.reduce((a,x)=>a+x.item_count,0);
if(Math.abs(weight-1)>1e-10||items!==35)throw Error('Weights or item counts invalid');
const {data:publicQuestions,error:publicErr}=await anonymous.from('questions').select('id').limit(1);
if(publicErr){console.log('RLS direct access denied via API error (acceptable).');}
else if(publicQuestions.length===0){console.log('RLS direct read yields 0 records (acceptable).');}
else{throw Error('RLS LEAK: anonymous client can read question table');}
console.log('Safe smoke checks passed. Run full two-account E2E tests before production.');
