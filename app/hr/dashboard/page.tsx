import { getHrSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import { isSessionExpired } from '@/lib/session';
import HrDashboardClient from './HrDashboardClient';

export default async function HrDashboardPage() {
  const session = await getHrSession();

  // Check if session exists and has required fields
  if (!session.id || !session.createdAt) {
    redirect('/hr/login');
  }

  // Check if session is expired
  if (isSessionExpired(session.createdAt)) {
    // Destroy expired session
    session.destroy();
    redirect('/hr/login');
  }

  return (
    <HrDashboardClient
      user={{
        id: session.id,
        username: session.username!,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
        createdAt: session.createdAt,
      }}
    />
  );
}
