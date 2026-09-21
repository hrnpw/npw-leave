import { redirect } from 'next/navigation';
import { getHrSession } from '@/lib/getSession';
import { isSessionExpired } from '@/lib/session';
import ImportClient from './ImportClient';

export const metadata = {
  title: 'Import ครู | Leave-NPW',
};

export default async function ImportPage() {
  const session = await getHrSession();

  if (!session.id || !session.createdAt) {
    redirect('/hr/login');
  }

  if (isSessionExpired(session.createdAt)) {
    session.destroy();
    redirect('/hr/login');
  }

  return <ImportClient hrUser={{
    id: session.id,
    firstName: session.firstName!,
    lastName: session.lastName!,
    role: session.role!,
  }} />;
}
