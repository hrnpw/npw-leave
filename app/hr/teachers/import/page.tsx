import { redirect } from 'next/navigation';
import { validateHrSession } from '@/lib/validateSession';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const ImportClient = lazy(() => import('./ImportClient'));

export const metadata = {
  title: 'Import ครู | Leave-NPW',
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

export default async function ImportPage() {
  const validation = await validateHrSession();

  if (!validation.valid) {
    redirect('/hr/login');
  }

  const { session } = validation;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <ImportClient hrUser={{
        id: session.id!,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
      }} />
    </Suspense>
  );
}
