import { getHrSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import { isSessionExpired } from '@/lib/session';
import { Metadata } from 'next';
import AllLeavesClient from './AllLeavesClient';

export const metadata: Metadata = {
  title: 'รายการใบลาทั้งหมด | ระบบลาออนไลน์',
  description: 'รายการใบลาทั้งหมดพร้อมตัวกรองและวิเคราะห์ข้อมูล',
};

export default async function AllLeavesPage() {
  const session = await getHrSession();

  if (!session.id || !session.createdAt) {
    redirect('/hr/login');
  }

  if (isSessionExpired(session.createdAt)) {
    session.destroy();
    redirect('/hr/login');
  }

  return (
    <AllLeavesClient
      hrUser={{
        id: session.id,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
      }}
    />
  );
}
