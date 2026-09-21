import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getHrSession } from '@/lib/getSession';
import HrLoginClient from './HrLoginClient';

export default async function HrLoginPage() {
  // Check if already logged in
  const session = await getHrSession();

  if (session.id) {
    redirect('/hr/dashboard');
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
