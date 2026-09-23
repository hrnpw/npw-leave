import { redirect } from 'next/navigation';
import { validateHrSession } from '@/lib/validateSession';
import SignatoriesClient from './SignatoriesClient';

export const metadata = {
  title: 'ผู้ลงนาม | Leave-NPW',
};

export default async function SignatoriesPage() {
  const validation = await validateHrSession();

  if (!validation.valid) {
    redirect('/hr/login');
  }

  const { session } = validation;

  return <SignatoriesClient hrUser={{
    id: session.id!,
    firstName: session.firstName!,
    lastName: session.lastName!,
    role: session.role!,
  }} />;
}
