import { getHrSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import { isSessionExpired } from '@/lib/session';
import ReportsClient from './ReportsClient';

export default async function ReportsPage() {
  const session = await getHrSession();

  if (!session.id || !session.createdAt) {
    redirect('/hr/login');
  }

  if (isSessionExpired(session.createdAt)) {
    session.destroy();
    redirect('/hr/login');
  }

  return <ReportsClient user={{ role: session.role! }} />;
}
