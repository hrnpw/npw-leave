import { getHrSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import ReportsClient from './ReportsClient';

export default async function ReportsPage() {
  const session = await getHrSession();

  if (!session.id) {
    redirect('/hr/login');
  }

  return <ReportsClient user={{ role: session.role! }} />;
}
