import { redirect } from 'next/navigation';
import { getHrSession } from '@/lib/getSession';
import TeachersClient from './TeachersClient';

export const metadata = {
  title: 'จัดการครู | Leave-NPW',
};

export default async function TeachersPage() {
  const session = await getHrSession();

  if (!session.id) {
    redirect('/hr/login');
  }

  return <TeachersClient hrUser={{
    id: session.id!,
    firstName: session.firstName!,
    lastName: session.lastName!,
    role: session.role!,
  }} />;
}
