'use client';
import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {browserDb, getJson} from '@/lib/browser';

type Identity = {profile: {role: 'admin' | 'respondent'} | null};

// Email magic links are retained ONLY for the research administrator.
export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    async function redirectAdmin() {
      const {data: {session}} = await browserDb().auth.getSession();
      if (!live || !session) return;
      try {
        const me = await getJson<Identity>('/api/me');
        if (live && me.profile?.role === 'admin') router.replace('/admin');
      } catch { /* Show login form and let the server verify admin role later. */ }
    }
    redirectAdmin();
    const {data: {subscription}} = browserDb().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') setTimeout(redirectAdmin, 100);
    });
    return () => {live = false; subscription.unsubscribe();};
  }, [router]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const {error: sendError} = await browserDb().auth.signInWithOtp({
        email,
        options: {emailRedirectTo: window.location.origin + '/admin-login', shouldCreateUser: false}
      });
      if (sendError) throw sendError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ارسال ایمیل مدیر');
    } finally {
      setPending(false);
    }
  }

  return <div className="container section max-w-2xl"><div className="card">
    <span className="badge mb-5">ویژه پژوهشگر</span>
    <h1 className="h2 mb-3">ورود مدیر سامانه</h1>
    <p className="muted mb-6">برای حفاظت از اطلاعات سازمان‌ها، ورود مدیر همچنان با ایمیل تأییدشده انجام می‌شود.</p>
    <form onSubmit={send}>
      <label className="label" htmlFor="admin-email">ایمیل مدیر</label>
      <input className="input" type="email" id="admin-email" required dir="ltr" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com"/>
      <button className="btn btn-primary w-full mt-5" disabled={pending}>{pending ? 'در حال ارسال...' : 'ارسال لینک ورود مدیر'}</button>
    </form>
    {sent && <div className="alert alert-ok mt-5">لینک ورود مدیر به ایمیل ارسال شد.</div>}
    {error && <p className="alert alert-error mt-4" role="alert">{error}</p>}
    <p className="muted mt-5 text-sm"><Link href="/login" className="underline">شروع پرسش‌نامه بدون ایمیل</Link></p>
  </div></div>;
}
