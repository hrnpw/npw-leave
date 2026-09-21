import { redirect } from 'next/navigation';
import { getHrSession } from '@/lib/getSession';
import HolidaysClient from './HolidaysClient';

export const metadata = {
  title: 'วันหยุดราชการ | Leave-NPW',
};

export default async function HolidaysPage() {
  const session = await getHrSession();

  if (!session.id) {
    redirect('/hr/login');
  }

  return (
    <HolidaysClient
      hrUser={{
        id: session.id!,
        firstName: session.firstName!,
        lastName: session.lastName!,
        role: session.role!,
      }}
    />
  );
}
