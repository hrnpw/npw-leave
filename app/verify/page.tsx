import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTeacherSession } from '@/lib/getSession';
import VerifyClient from './VerifyClient';

export default async function VerifyPage() {
  // Check if already logged in
  const session = await getTeacherSession();

  if (session.id) {
    redirect('/teacher');
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">กำลังโหลด...</div>
      </div>
    }>
      <VerifyClient />
    </Suspense>
  );
}
