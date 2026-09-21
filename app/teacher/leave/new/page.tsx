import { getTeacherSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import LeaveFormClient from './LeaveFormClient';

export default async function NewLeavePage() {
  const session = await getTeacherSession();

  if (!session.id) {
    redirect('/verify');
  }

  return (
    <LeaveFormClient
      teacher={{
        id: session.id!,
        teacherCode: session.teacherCode!,
        firstName: session.firstName!,
        lastName: session.lastName!,
      }}
    />
  );
}
