import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTeacherSession } from '@/lib/getSession';
import { isSessionExpired } from '@/lib/session';
import VerifyClient from './VerifyClient';

export default async function VerifyPage() {
  // Check if already logged in with valid session
  const session = await getTeacherSession();

  if (session.id && session.createdAt && !isSessionExpired(session.createdAt)) {
    redirect('/teacher');
  }

  // Clear expired session if exists
  if (session.id && session.createdAt && isSessionExpired(session.createdAt)) {
    await session.destroy();
    console.log('[Verify Page] Destroyed expired session');
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
