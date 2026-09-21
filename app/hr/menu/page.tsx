import { getHrSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import HrMenuClient from './HrMenuClient';

export const metadata: Metadata = {
  title: 'เมนู | ระบบลาออนไลน์',
  description: 'เมนูเพิ่มเติม',
};

export default async function HrMenuPage() {
  const session = await getHrSession();

  if (!session.id) {
    redirect('/hr/login');
  }

  return (
    <HrMenuClient
      hrUser={{
        id: session.id!,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
      }}
    />
  );
}
