import { redirect } from 'next/navigation';
import { getTeacherSession } from '@/lib/getSession';
import { isSessionExpired } from '@/lib/session';
import TeacherLeaveDetailClient from './TeacherLeaveDetailClient';

export default async function TeacherLeaveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getTeacherSession();

  if (!session.id || !session.createdAt) {
    redirect('/verify');
  }

  if (isSessionExpired(session.createdAt)) {
    session.destroy();
    redirect('/verify');
  }

  const { id } = await params;

  return (
    <TeacherLeaveDetailClient
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
