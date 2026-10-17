'use client';
import {createClient,SupabaseClient} from '@supabase/supabase-js';
let client:SupabaseClient|null=null;
export function browserDb():SupabaseClient{
 if(!client){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!anon)throw new Error('تنظیمات اتصال سامانه انجام نشده است.');
  client=createClient(url,anon,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
 }return client;
}
export async function api(path:string,init:RequestInit={}){
 const {data:{session}}=await browserDb().auth.getSession();
 if(!session?.access_token)throw new Error('ابتدا وارد حساب خود شوید.');
 const headers=new Headers(init.headers);
 headers.set('Authorization',`Bearer ${session.access_token}`);
 if(init.body && !(init.body instanceof FormData))headers.set('Content-Type','application/json');
 const response=await fetch(path,{...init,headers,cache:'no-store'});
 if(!response.ok){let msg=`خطای ${response.status}`;try{msg=(await response.json()).error??msg;}catch{}throw new Error(msg);}
 return response;
}
export async function getJson<T=any>(path:string):Promise<T>{return (await api(path)).json();}
export async function postJson<T=any>(path:string,body:unknown):Promise<T>{return (await api(path,{method:'POST',body:JSON.stringify(body)})).json();}
