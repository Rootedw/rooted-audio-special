"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
export default function RefreshStatus({ lang }: { lang: 'nl' | 'en' }) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  useEffect(() => { if (attempts >= 10) return; const timer = setTimeout(() => { setAttempts(value => value + 1); router.refresh(); }, 3000); return () => clearTimeout(timer); }, [attempts, router]);
  return <div className="ra-form-bottom"><button className="ra-primary" onClick={() => { setAttempts(0); router.refresh(); }}>{lang === 'nl' ? 'BETALING OPNIEUW CONTROLEREN' : 'CHECK PAYMENT AGAIN'}</button><p>{lang === 'nl' ? 'Er wordt geen nieuwe betaling gestart.' : 'No new payment will be started.'}</p></div>;
}
