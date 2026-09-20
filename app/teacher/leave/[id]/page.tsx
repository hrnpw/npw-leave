import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import TeacherLeaveDetailClient from './TeacherLeaveDetailClient';

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
    <TeacherLeaveDetailClient
      leaveId={id}
      teacher={{
        id: session.teacherId,
        teacherCode: session.teacherCode,
        firstName: session.firstName,
        lastName: session.lastName,
      }}
    />
  );
}
