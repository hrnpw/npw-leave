import { validateTeacherSession } from '@/lib/validateSession';
import { redirect } from 'next/navigation';
import LeaveFormClient from './LeaveFormClient';

export default async function NewLeavePage() {
  const validation = await validateTeacherSession();

  if (!validation.valid) {
    redirect('/verify');
  }

  const { session } = validation;

  return (
    <LeaveFormClient
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
