import { getHrSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import { isSessionExpired } from '@/lib/session';
import { Metadata } from 'next';
import HrProxyLeaveClient from './HrProxyLeaveClient';

export const metadata: Metadata = {
  title: 'ยื่นใบลาแทนครู | ระบบลาออนไลน์',
  description: 'ยื่นใบลาให้ครูที่ไม่สะดวกใช้ระบบ',
};

export default async function HrProxyLeavePage() {
  const session = await getHrSession();

  if (!session.id || !session.createdAt) {
    redirect('/hr/login');
  }

  if (isSessionExpired(session.createdAt)) {
    session.destroy();
    redirect('/hr/login');
  }

  return (
    <HrProxyLeaveClient
      hrUser={{
        id: session.id,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
      }}
    />
  );
}
