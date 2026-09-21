import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const TeacherLeaveDetailClient = lazy(() => import('./TeacherLeaveDetailClient'));

async function getTeacherSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('teacher_session');

  if (!sessionCookie) {
    return null;
  }

  try {
    const session = JSON.parse(sessionCookie.value);
    return session;
  } catch {
    return null;
  }
}

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

  if (!session) {
    redirect('/verify');
  }

  const { id } = await params;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <TeacherLeaveDetailClient
        leaveId={id}
        teacher={{
          id: session.teacherId,
          teacherCode: session.teacherCode,
          firstName: session.firstName,
          lastName: session.lastName,
        }}
      />
    </Suspense>
  );
}
