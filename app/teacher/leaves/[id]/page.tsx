import { getTeacherSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import { isSessionExpired } from '@/lib/session';
import LeaveDetailClient from './LeaveDetailClient';

export default async function TeacherLeaveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getTeacherSession();
  const { id } = await params;

  if (!session.id || !session.createdAt) {
    redirect('/verify');
  }

  if (isSessionExpired(session.createdAt)) {
    session.destroy();
    redirect('/verify');
  }

  return (
    <LeaveDetailClient
      leaveId={id}
      teacher={{
        id: session.id,
        teacherCode: session.teacherCode!,
        firstName: session.firstName!,
        lastName: session.lastName!,
      }}
    />
  );
}
