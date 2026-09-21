import { getHrSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import HrDashboardClient from './HrDashboardClient';

export default async function HrDashboardPage() {
  const session = await getHrSession();

  if (!session.id) {
    redirect('/hr/login');
  }

  return (
    <HrDashboardClient
      user={{
        id: session.id!,
        username: session.username!,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
        createdAt: session.createdAt!,
      }}
    />
  );
}
