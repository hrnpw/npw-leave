import { getTeacherSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import LeaveHistoryClient from './LeaveHistoryClient';

export default async function LeaveHistoryPage() {
  const session = await getTeacherSession();

  if (!session.id) {
    redirect('/verify');
  }

  return (
    <LeaveHistoryClient
      teacher={{
        id: session.id!,
        teacherCode: session.teacherCode!,
        firstName: session.firstName!,
        lastName: session.lastName!,
      }}
    />
  );
}
