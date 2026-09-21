import { redirect } from 'next/navigation';
import { getHrSession } from '@/lib/getSession';
import { isSessionExpired } from '@/lib/session';
import AdminClient from './AdminClient';

export const metadata = {
  title: 'Super Admin | ระบบลาออนไลน์',
  description: 'จัดการระบบและบัญชีผู้ใช้',
};

export default async function AdminPage() {
  const session = await getHrSession();

  if (!session.id || !session.createdAt) {
    redirect('/hr/login');
  }

  if (isSessionExpired(session.createdAt)) {
    session.destroy();
    redirect('/hr/login');
  }

  if (session.role !== 'super_admin') {
    redirect('/hr/dashboard');
  }

  return (
    <AdminClient
      hrUser={{
        id: session.id,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
      }}
    />
  );
}
