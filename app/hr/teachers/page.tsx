import { redirect } from 'next/navigation';
import { getHrSession } from '@/lib/getSession';
import { isSessionExpired } from '@/lib/session';
import TeachersClient from './TeachersClient';

export const metadata = {
  title: 'จัดการครู | Leave-NPW',
};

export default async function TeachersPage() {
  const session = await getHrSession();

  if (!session.id || !session.createdAt) {
    redirect('/hr/login');
  }

  if (isSessionExpired(session.createdAt)) {
    session.destroy();
    redirect('/hr/login');
  }

  return <TeachersClient hrUser={{
    id: session.id,
    firstName: session.firstName!,
    lastName: session.lastName!,
    role: session.role!,
  }} />;
}
