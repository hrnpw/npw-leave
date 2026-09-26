import { Suspense } from 'react';
import HrLoginClient from './HrLoginClient';

export default function HrLoginPage() {
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
