import { getTeacherSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import TeacherDashboardClient from './TeacherDashboardClient';

export default async function TeacherPage() {
  const session = await getTeacherSession();

  if (!session.id) {
    redirect('/verify');
  }

  return (
    <TeacherDashboardClient
      teacher={{
        id: session.id!,
        teacherCode: session.teacherCode!,
        firstName: session.firstName!,
        lastName: session.lastName!,
        createdAt: session.createdAt!,
      }}
    />
  );
}
