import { getHrSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import LeavesClient from './LeavesClient';

export const metadata: Metadata = {
  title: 'รายการใบลา | ระบบลาออนไลน์',
  description: 'รายการใบลาทั้งหมด',
};

export default async function LeavesPage() {
  const session = await getHrSession();

  if (!session.id) {
    redirect('/hr/login');
  }

  return (
    <LeavesClient
      hrUser={{
        id: session.id!,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
      }}
    />
  );
}
