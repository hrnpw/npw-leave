import { validateTeacherSession } from '@/lib/validateSession';
import { redirect } from 'next/navigation';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const LeaveFormClient = lazy(() => import('./LeaveFormClient'));

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

export default async function NewLeavePage() {
  const validation = await validateTeacherSession();

  if (!validation.valid) {
    redirect('/verify');
  }

  const { session } = validation;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <LeaveFormClient
        teacher={{
          id: session.id!,
          teacherCode: session.teacherCode!,
          firstName: session.firstName!,
          lastName: session.lastName!,
        }}
      />
    </Suspense>
  );
}
