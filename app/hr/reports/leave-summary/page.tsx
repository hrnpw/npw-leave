import { getHrSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import LeaveSummaryClient from './LeaveSummaryClient';

export default async function LeaveSummaryPage() {
  const session = await getHrSession();

  if (!session.id) {
    redirect('/hr/login');
  }

  return <LeaveSummaryClient />;
}
