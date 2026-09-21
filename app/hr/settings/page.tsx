import { redirect } from 'next/navigation';
import { getHrSession } from '@/lib/getSession';
import { isSessionExpired } from '@/lib/session';
import SettingsClient from './SettingsClient';

export const metadata = {
  title: 'ตั้งค่าระบบ | ระบบลาออนไลน์',
  description: 'ตั้งค่าระบบและกำหนดพารามิเตอร์ต่างๆ',
};

export default async function SettingsPage() {
  const session = await getHrSession();

  if (!session.id || !session.createdAt) {
    redirect('/hr/login');
  }

  if (isSessionExpired(session.createdAt)) {
    session.destroy();
    redirect('/hr/login');
  }

  return (
    <SettingsClient
      hrUser={{
        id: session.id,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
      }}
    />
  );
}
