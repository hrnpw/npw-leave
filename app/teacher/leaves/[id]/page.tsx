import { getTeacherSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import LeaveDetailClient from './LeaveDetailClient';

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
    <LeaveDetailClient
      leaveId={id}
      teacher={{
        id: session.id!,
        teacherCode: session.teacherCode!,
        firstName: session.firstName!,
        lastName: session.lastName!,
      }}
    />
  );
}
