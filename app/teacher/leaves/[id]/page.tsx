import { getTeacherSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const LeaveDetailClient = lazy(() => import('./LeaveDetailClient'));

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

export default async function TeacherLeaveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getTeacherSession();
  const { id } = await params;

  console.log('[TeacherLeaveDetail] Session:', session);

  if (!session.id) {
    console.log('[TeacherLeaveDetail] No session.id, redirecting to /verify');
    redirect('/verify');
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <LeaveDetailClient
        leaveId={id}
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
