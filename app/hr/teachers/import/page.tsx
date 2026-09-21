import { redirect } from 'next/navigation';
import { getHrSession } from '@/lib/getSession';
import ImportClient from './ImportClient';

export const metadata = {
  title: 'Import ครู | Leave-NPW',
};

export default async function ImportPage() {
  const session = await getHrSession();

  if (!session.id) {
    redirect('/hr/login');
  }

  return <ImportClient hrUser={{
    id: session.id!,
    firstName: session.firstName!,
    lastName: session.lastName!,
    role: session.role!,
  }} />;
}
