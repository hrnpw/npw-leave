import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getHrSession } from '@/lib/getSession';
import { isSessionExpired } from '@/lib/session';
import HrLoginClient from './HrLoginClient';

export default async function HrLoginPage() {
  // Check if already logged in with valid session
  const session = await getHrSession();

  if (session.id && session.createdAt && !isSessionExpired(session.createdAt)) {
    redirect('/hr/dashboard');
  }

  // Clear expired session if exists
  if (session.id && session.createdAt && isSessionExpired(session.createdAt)) {
    session.destroy();
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <HrLoginClient />
    </Suspense>
  );
}
