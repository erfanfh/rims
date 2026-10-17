'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {browserDb, getJson} from '@/lib/browser';

type Identity = {profile: {role: 'admin' | 'respondent'} | null};

// Respondents start without an email address. Supabase still creates a private,
// anonymous Auth identity so ownership checks and server-side access control remain intact.
export default function StartAssessment() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const sb = browserDb();
        const {data: {session}, error: sessionError} = await sb.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          const {error: anonymousError} = await sb.auth.signInAnonymously();
          if (anonymousError) throw anonymousError;
        }
        const me = await getJson<Identity>('/api/me');
        if (cancelled) return;
        router.replace(me.profile?.role === 'admin' ? '/admin' : me.profile ? '/assessment' : '/register');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'آغاز پرسش‌نامه ممکن نشد.');
        setPending(false);
      }
    }
    start();
    return () => {cancelled = true;};
  }, [router]);

  return <div className="container section max-w-2xl"><div className="card">
    <span className="badge mb-5">ورود پاسخ‌دهنده بدون ایمیل</span>
    <h1 className="h2 mb-3">شروع ارزیابی</h1>
    {pending && <p className="alert">در حال آماده‌سازی پرسش‌نامه ...</p>}
    {!pending && error && <>
      <p className="alert alert-error mb-4" role="alert">{error}</p>
      <p className="muted mb-4">در Supabase، بخش Authentication → Providers باید گزینه Anonymous Sign-Ins فعال باشد.</p>
      <button className="btn btn-primary" onClick={() => window.location.reload()}>تلاش دوباره</button>
    </>}
    <p className="muted text-sm mt-5">برای ثبت اطلاعات، کد دعوت سازمان لازم است. برای ادامه ارزیابی ناتمام باید با همان مرورگر و همان دستگاه بازگردید؛ پاک‌کردن اطلاعات مرورگر می‌تواند دسترسی به نشست را از بین ببرد.</p>
    <p className="mt-4"><Link className="underline" href="/admin-login">ورود پژوهشگر (مدیر سامانه)</Link></p>
  </div></div>;
}
