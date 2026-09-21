import { redirect } from 'next/navigation';
import { getHrSession } from '@/lib/getSession';

export default async function HrPage() {
  const session = await getHrSession();

  if (session.id) {
    redirect('/hr/dashboard');
  } else {
    redirect('/hr/login');
  }
}
