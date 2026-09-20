import { redirect } from 'next/navigation';
import { getHrSession } from '@/lib/getSession';
import SignatoriesClient from './SignatoriesClient';

export const metadata = {
  title: 'ผู้ลงนาม | Leave-NPW',
};

export default async function SignatoriesPage() {
  const session = await getHrSession();

  if (!session.id) {
    redirect('/hr/login');
  }

  return <SignatoriesClient hrUser={{
    id: session.id!,
    firstName: session.firstName!,
    lastName: session.lastName!,
    role: session.role!,
  }} />;
}
