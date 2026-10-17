import type {Metadata} from 'next';
import Link from 'next/link';
import './globals.css';
export const metadata:Metadata={title:'سامانه سنجش بلوغ مدیریت ریسک سازمانی | RIMS 2022',description:'خودارزیابی پژوهشی بلوغ مدیریت ریسک سازمانی در صنعت ساخت'};
export default function Layout({children}:{children:React.ReactNode}){
 return <html lang="fa" dir="rtl"><body className="font-sans min-h-screen flex flex-col">
  <header className="site-header"><div className="container flex justify-between items-center gap-3 flex-wrap">
   <Link href="/" className="flex items-center gap-3"><span className="brand-box">R</span><span><strong className="block text-sm md:text-base">سامانه بلوغ ریسک سازمانی</strong><small className="text-slate-500">مدل RIMS 2022 · صنعت ساخت</small></span></Link>
   <nav aria-label="ناوبری اصلی" className="flex items-center gap-2 text-sm flex-wrap"><Link className="nav-link" href="/">خانه</Link><Link className="nav-link" href="/login">پرسش‌نامه</Link><Link className="nav-link" href="/admin-login">ورود پژوهشگر</Link><Link className="btn btn-primary text-sm" href="/login">شروع ارزیابی</Link></nav>
  </div></header><main className="flex-1">{children}</main>
  <footer className="site-footer"><div className="container flex justify-between flex-wrap gap-2"><span>پژوهش دانشگاهی · ارزیابی بلوغ مدیریت ریسک سازمانی در صنعت ساخت</span><span>نسخه ابزار: RIMS 2022 فارسی · امتیاز عددی مستقل از آستانه‌های تأییدنشده</span></div></footer>
 </body></html>;
}
