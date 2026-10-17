import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
const env=readFileSync('.env.local','utf8').split(/\r?\n/);
for(const line of env){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m && !process.env[m[1]])process.env[m[1]]=m[2];}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('Configure .env.local before seeding');
const db=createClient(url,key,{auth:{persistSession:false}});
const catalog=JSON.parse(readFileSync('src/data/questionnaire.json','utf8'));
const dimensions=[
 {key:'strategy',title:'هم‌راستایی با راهبرد',position:1,weight:0.25,item_count:6},
 {key:'culture',title:'فرهنگ و پاسخ‌گویی',position:2,weight:0.30,item_count:7},
 {key:'capability',title:'قابلیت‌های مدیریت ریسک',position:3,weight:0.20,item_count:7},
 {key:'governance',title:'حاکمیت ریسک',position:4,weight:0.13,item_count:7},
 {key:'analytics',title:'تحلیل‌گری',position:5,weight:0.12,item_count:8}
];
const questions=[],options=[];
for(const [ci,c] of catalog.categories.entries()) for(const q of c.questions){
 const dim=ci===0?null:dimensions[ci-1].key;
 const kind=q.type==='target'?'target':ci===0?'baseline':'attribute';
 questions.push({id:q.id,questionnaire_version:'rims-2022-fa-v1',position:questions.length+1,dimension_key:dim,kind,text:q.text,original_number:q.number??null});
 for(const [i,opt] of q.options.entries()) options.push({question_id:q.id,option_index:i,label:opt.label,text:opt.text});
}
if(questions.length!==42 || questions.filter(q=>q.kind==='attribute').length!==35||options.length!==210)throw Error('Questionnaire count mismatch');
const {count,error:cntErr}=await db.from('assessments').select('*',{count:'exact',head:true});
if(cntErr)throw cntErr;
if(count>0)throw Error('Assessments exist: catalog locked to protect research integrity; migrate with a new questionnaire version.');
for(const [table,items,conflict] of [['dimensions',dimensions,'key'],['questions',questions,'id'],['answer_options',options,'question_id,option_index']]){
 const {error}=await db.from(table).upsert(items,{onConflict:conflict});if(error)throw Error(`${table}: ${error.message}`);
 console.log(`${table}: ${items.length} seeded`);
}
console.log('Catalog ready: 42 questions, 210 options; 35 scored attributes; weights sum to 1.');
