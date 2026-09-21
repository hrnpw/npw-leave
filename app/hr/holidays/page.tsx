import { redirect } from 'next/navigation';
import { getHrSession } from '@/lib/getSession';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const HolidaysClient = lazy(() => import('./HolidaysClient'));

export const metadata = {
  title: 'วันหยุดราชการ | Leave-NPW',
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

export default async function HolidaysPage() {
  const session = await getHrSession();

  if (!session.id) {
    redirect('/hr/login');
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <HolidaysClient
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
