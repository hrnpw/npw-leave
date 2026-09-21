import { getTeacherSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import { isSessionExpired } from '@/lib/session';
import TeacherDashboardClient from './TeacherDashboardClient';

export default async function TeacherPage() {
  const session = await getTeacherSession();

  // Check if session exists and has required fields
  if (!session.id || !session.createdAt) {
    redirect('/verify');
  }

  // Check if session is expired
  if (isSessionExpired(session.createdAt)) {
    // Destroy expired session
    session.destroy();
    redirect('/verify');
  }

  return (
    <TeacherDashboardClient
      teacher={{
        id: session.id,
        teacherCode: session.teacherCode!,
        firstName: session.firstName!,
        lastName: session.lastName!,
        createdAt: session.createdAt,
      }}
    />
  );
}
