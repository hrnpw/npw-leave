import { validateHrSession } from '@/lib/validateSession';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const LeavesClient = lazy(() => import('./LeavesClient'));

export const metadata: Metadata = {
  title: 'รายการใบลา | ระบบลาออนไลน์',
  description: 'รายการใบลาทั้งหมด',
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

export default async function LeavesPage() {
  const validation = await validateHrSession();

  if (!validation.valid) {
    redirect('/hr/login');
  }

  const { session } = validation;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <LeavesClient
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
