import { getTeacherSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import { isSessionExpired } from '@/lib/session';
import LeaveFormClient from './LeaveFormClient';

export default async function NewLeavePage() {
  const session = await getTeacherSession();

  if (!session.id || !session.createdAt) {
    redirect('/verify');
  }

  if (isSessionExpired(session.createdAt)) {
    session.destroy();
    redirect('/verify');
  }

  return (
    <LeaveFormClient
      teacher={{
        id: session.id,
        teacherCode: session.teacherCode!,
        firstName: session.firstName!,
        lastName: session.lastName!,
      }}
    />
  );
}
