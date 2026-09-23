import { validateHrSession } from '@/lib/validateSession';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import HrMenuClient from './HrMenuClient';

export const metadata: Metadata = {
  title: 'เมนู | ระบบลาออนไลน์',
  description: 'เมนูเพิ่มเติม',
};

export default async function HrMenuPage() {
  const validation = await validateHrSession();

  if (!validation.valid) {
    redirect('/hr/login');
  }

  const { session } = validation;

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
