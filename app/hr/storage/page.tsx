import { validateHrSession } from '@/lib/validateSession';
import { redirect } from 'next/navigation';
import StorageClient from './StorageClient';

export default async function StoragePage() {
  const validation = await validateHrSession();

  if (!validation.valid) {
    redirect('/hr/login');
  }

  const { session } = validation;

  return <StorageClient />;
}
