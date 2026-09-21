import { getHrSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import { isSessionExpired } from '@/lib/session';
import { Metadata } from 'next';
import LeavesClient from './LeavesClient';

export const metadata: Metadata = {
  title: 'รายการใบลา | ระบบลาออนไลน์',
  description: 'รายการใบลาทั้งหมด',
};

export default async function LeavesPage() {
  const session = await getHrSession();

  if (!session.id || !session.createdAt) {
    redirect('/hr/login');
  }

  if (isSessionExpired(session.createdAt)) {
    session.destroy();
    redirect('/hr/login');
  }

  return (
    <LeavesClient
      hrUser={{
        id: session.id,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
      }}
    />
  );
}
