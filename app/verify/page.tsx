import { Suspense } from 'react';
import VerifyClient from './VerifyClient';

export default function VerifyPage() {
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
