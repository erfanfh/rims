'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {RadarChart,Radar,PolarGrid,PolarAngleAxis,PolarRadiusAxis,ResponsiveContainer,BarChart,Bar,XAxis,YAxis,Tooltip,CartesianGrid} from 'recharts';
import {getJson} from '@/lib/browser';
import {DIMENSIONS} from '@/lib/scoring';
import questionnaire from '@/data/questionnaire.json';
// تعیین سطح بلوغ مدیریت ریسک بر اساس امتیاز نهایی

function getMaturityLevel(scoreValue: number | string | null | undefined): string {

  if (scoreValue === null || scoreValue === undefined) {
    return "تعیین نشده";
  }

  const score = Number(scoreValue);

  if (!Number.isFinite(score) || score < 1 || score > 5) {
    return "تعیین نشده";
  }

  if (score < 2) {
    return "سطح یک";
  }

  if (score < 3) {
    return "سطح دو";
  }

  if (score < 4) {
    return "سطح سه";
  }

  if (score < 4.5) {
    return "سطح چهار";
  }

  return "سطح پنج";
}
export default function Results(){const params=useParams();const id=String(params.id);const [data,setData]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{getJson(`/api/assessments/${id}`).then(setData).catch(e=>setError(String(e)))},[id]);
 const rows=useMemo(()=>{if(!data)return [];const a=new Map<string,number>(data.answers.map((r:any)=>[r.question_id,r.selected_index+1]));return DIMENSIONS.map((d,i)=>{const record=data.dimensions.find((x:any)=>x.dimension_key===d.key);const mean=record?Number(record.average_score):null;const target=a.get(`target-${i+1}`)??null;return {name:d.label,score:mean,target,weight:d.weight*100,gap:mean===null||target===null?null:target-mean};});},[data]);
 if(error)return <div className="container section"><div className="alert alert-error">{error} <Link href="/login" className="underline">ورود</Link></div></div>;
 if(!data)return <div className="container section"><div className="card">در حال دریافت نتایج...</div></div>;
 const complete=data.assessment.status==='submitted';
 return <div className="container section"><div className="flex justify-between flex-wrap items-center gap-4 mb-6"><div><span className="badge mb-2">گزارش ارزیابی</span><h1 className="h2">نتیجه سنجش بلوغ مدیریت ریسک</h1><p className="text-sm muted">شناسه ارزیابی: <span dir="ltr">{id}</span></p></div><div className="flex gap-2 hide-print"><Link className="btn" href="/assessment">بازگشت</Link><button className="btn btn-primary" onClick={()=>window.print()}>چاپ / ذخیره PDF</button></div></div>
 {!complete?<div className="alert">این ارزیابی هنوز تکمیل نشده است؛ امتیاز نهایی محاسبه و منتشر نمی‌شود.</div>:<>
 <div className="grid md:grid-cols-3 gap-4 mb-6"><div className="card"><p className="muted text-sm">امتیاز نهایی بلوغ</p><strong className="text-5xl text-pine block mt-4" dir="ltr">{Number(data.result?.total_score).toFixed(3)} <small className="text-base text-slate-400">/ 5</small></strong><p className="text-xs muted mt-3">مجموع موزون میانگین پنج رکن</p></div><div className="card"><p className="muted text-sm">سطح بلوغ</p><strong className="text-2xl block mt-6 text-emerald-700">
  {getMaturityLevel(data.result?.total_score)}
</strong><p className="text-xs muted mt-3">
  تعیین سطح بر اساس دامنه‌های انتخاب‌شده در پژوهش
</p></div><div className="card"><p className="muted text-sm">تاریخ تکمیل</p><strong className="text-xl block mt-6">{new Date(data.assessment.submitted_at).toLocaleDateString('fa-IR')}</strong><p className="text-xs muted mt-3">الگوریتم: {data.result?.algorithm_version}</p></div></div>
 <div className="grid lg:grid-cols-2 gap-5 mb-6"><div className="card"><h2 className="h3 mb-2">نمای بلوغ در پنج رکن</h2><div className="w-full h-[360px]" dir="ltr"><ResponsiveContainer width="100%" height="100%"><RadarChart data={rows}><PolarGrid/><PolarAngleAxis dataKey="name" tick={{fontSize:11}}/><PolarRadiusAxis angle={30} domain={[0,5]} tickCount={6}/><Radar name="وضعیت موجود" dataKey="score" stroke="#1b6b5d" fill="#2e8e73" fillOpacity={0.28}/><Radar name="سطح هدف" dataKey="target" stroke="#c49d5e" fill="#c49d5e" fillOpacity={0.08}/><Tooltip/></RadarChart></ResponsiveContainer></div><div className="text-xs muted">مقیاس راداری ۰ تا ۵؛ مقادیر کمتر از ۱ صرفاً برای نمایش محور هستند.</div></div>
 <div className="card"><h2 className="h3 mb-2">مقایسه ارکان</h2><div className="w-full h-[360px]" dir="ltr"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} layout="vertical" margin={{left:12,right:30}}><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" domain={[0,5]}/><YAxis type="category" dataKey="name" width={130} tick={{fontSize:10}}/><Tooltip/><Bar dataKey="score" name="میانگین" fill="#287b68" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer></div></div></div>
 <div className="card mb-6"><h2 className="h3 mb-4">امتیاز و شکاف ارکان</h2><div className="table-box"><table className="rims-table"><thead><tr><th>رکن</th><th>وزن</th><th>امتیاز فعلی</th><th>سطح هدف</th><th>شکاف (هدف − فعلی)</th></tr></thead><tbody>{rows.map(r=><tr key={r.name}><td>{r.name}</td><td>{r.weight}٪</td><td>{r.score?.toFixed(3)}</td><td>{r.target}</td><td>{r.gap?.toFixed(3)??'—'}</td></tr>)}</tbody></table></div><p className="text-xs muted mt-4">«شکاف» شاخص تکمیلی پژوهشگر است، نه بخشی از امتیاز رسمی RIMS. مقدار منفی نشان‌دهنده بالاتر بودن وضعیت موجود نسبت به هدف انتخاب‌شده است.</p></div>
 <div className="card"><h2 className="h3 mb-3">برداشت اولیه از وضعیت ارکان</h2><p className="text-sm muted">رکن با بیشترین میانگین: <b>{[...rows].sort((a,b)=>(b.score??0)-(a.score??0))[0]?.name}</b>. رکن با کمترین میانگین: <b>{[...rows].sort((a,b)=>(a.score??0)-(b.score??0))[0]?.name}</b>. این مقایسه نسبی است و جایگزین ارزیابی شواهد سازمانی یا داوری تخصصی نیست.</p></div>
 <details className="card mt-6"><summary className="cursor-pointer h3">مرور همه پاسخ‌های خام ثبت‌شده (۴۲ مورد)</summary><p className="muted text-xs mb-4">متن‌ها عیناً مطابق نسخه فارسی پرسش‌نامه‌اند. این جدول در محاسبات ویرایشی ایجاد نمی‌کند.</p><div className="table-box"><table className="rims-table"><thead><tr><th>شماره/نوع</th><th>پرسش</th><th>پاسخ انتخاب‌شده</th></tr></thead><tbody>{questionnaire.categories.flatMap(c=>c.questions).map(q=>{const record=data.answers.find((x:any)=>x.question_id===q.id);const opt=record?q.options[record.selected_index]:null;return <tr key={q.id}><td>{q.type==='target'?'هدف':q.number}</td><td>{q.text}</td><td>{opt?opt.label+' — '+opt.text:'بدون پاسخ'}</td></tr>})}</tbody></table></div></details>
 </>}</div>;
}
