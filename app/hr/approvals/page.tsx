import { getHrSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import { isSessionExpired } from '@/lib/session';
import { Metadata } from 'next';
import ApprovalsClient from './ApprovalsClient';

export const metadata: Metadata = {
  title: 'รออนุมัติ | ระบบลาออนไลน์',
  description: 'อนุมัติใบลาของครู',
};

export default async function ApprovalsPage() {
  const session = await getHrSession();

  if (!session.id || !session.createdAt) {
    redirect('/hr/login');
  }

  if (isSessionExpired(session.createdAt)) {
    session.destroy();
    redirect('/hr/login');
  }

  return (
    <ApprovalsClient
      hrUser={{
        id: session.id,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
      }}
    />
  );
}
