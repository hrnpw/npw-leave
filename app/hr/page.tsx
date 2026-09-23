import { redirect } from 'next/navigation';
import { validateHrSession } from '@/lib/validateSession';

export default async function HrPage() {
  const validation = await validateHrSession();

  if (validation.valid) {
    redirect('/hr/dashboard');
  } else {
    redirect('/hr/login');
  }
}
