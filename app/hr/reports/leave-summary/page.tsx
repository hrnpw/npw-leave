import { getHrSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import { isSessionExpired } from '@/lib/session';
import LeaveSummaryClient from './LeaveSummaryClient';

export default async function LeaveSummaryPage() {
  const session = await getHrSession();

  if (!session.id || !session.createdAt) {
    redirect('/hr/login');
  }

  if (isSessionExpired(session.createdAt)) {
    session.destroy();
    redirect('/hr/login');
  }

  return <LeaveSummaryClient />;
}
