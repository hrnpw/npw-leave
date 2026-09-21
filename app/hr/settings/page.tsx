import { redirect } from 'next/navigation';
import { getHrSession } from '@/lib/getSession';
import SettingsClient from './SettingsClient';

export const metadata = {
  title: 'ตั้งค่าระบบ | ระบบลาออนไลน์',
  description: 'ตั้งค่าระบบและกำหนดพารามิเตอร์ต่างๆ',
};

export default async function SettingsPage() {
  const session = await getHrSession();

  if (!session.id) {
    redirect('/hr/login');
  }

  return (
    <SettingsClient
      hrUser={{
        id: session.id!,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
      }}
    />
  );
}
