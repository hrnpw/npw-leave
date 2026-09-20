import { getHrSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import AllLeavesClient from './AllLeavesClient';

export const metadata: Metadata = {
  title: 'รายการใบลาทั้งหมด | ระบบลาออนไลน์',
  description: 'รายการใบลาทั้งหมดพร้อมตัวกรองและวิเคราะห์ข้อมูล',
};

export default async function AllLeavesPage() {
  const session = await getHrSession();

  if (!session.id) {
    redirect('/hr/login');
  }

  return (
    <AllLeavesClient
      hrUser={{
        id: session.id!,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
      }}
    />
  );
}
