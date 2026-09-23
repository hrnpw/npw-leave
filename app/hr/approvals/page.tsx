import { validateHrSession } from '@/lib/validateSession';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const ApprovalsClient = lazy(() => import('./ApprovalsClient'));

export const metadata: Metadata = {
  title: 'รออนุมัติ | ระบบลาออนไลน์',
  description: 'อนุมัติใบลาของครู',
};

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500 mx-auto mb-2" />
        <p className="text-sm text-slate-600">กำลังโหลด...</p>
      </div>
    </div>
  );
}

export default async function ApprovalsPage() {
  const validation = await validateHrSession();

  if (!validation.valid) {
    redirect('/hr/login');
  }

  const { session } = validation;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <ApprovalsClient
        hrUser={{
          id: session.id!,
          firstName: session.firstName!,
          lastName: session.lastName!,
          role: session.role!,
        }}
      />
    </Suspense>
  );
}
