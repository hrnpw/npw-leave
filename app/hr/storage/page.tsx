import { getHrSession } from '@/lib/getSession';
import { redirect } from 'next/navigation';
import StorageClient from './StorageClient';

export default async function StoragePage() {
  const session = await getHrSession();

  if (!session.id) {
    redirect('/hr/login');
  }

  return <StorageClient />;
}
